from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import Attachment, Project, Ticket, TicketActivity, User
from app.schemas.attachment import (
    AttachmentListResponse,
    AttachmentResponse,
    AttachmentUploaderResponse,
)
from app.services import project_service, ticket_service
from app.services.attachment_storage import (
    read_and_validate_upload,
    remove_private_file,
    safe_original_filename,
    storage_path,
    write_private_file,
)
from app.services.project_service import ProjectServiceError
from app.services.ticket_service import TicketServiceError

router = APIRouter(tags=["Attachments"])


def _project_for_actor(db: Session, project_id: UUID, actor: User) -> Project:
    try:
        project = project_service.get_project(db, project_id)
    except ProjectServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    if actor.role.code == "ADMIN":
        return project
    if actor.role.code == "PM" and project.project_manager_id == actor.id:
        return project
    if actor.role.code in {"DEVELOPER", "TESTER"}:
        allowed = any(
            item.user_id == actor.id and item.removed_at is None for item in project.memberships
        )
        if allowed:
            return project
    raise HTTPException(status_code=404, detail="Project not found.")


def _ticket_for_actor(db: Session, ticket_id: UUID, actor: User) -> Ticket:
    try:
        ticket = ticket_service.get_ticket(db, ticket_id)
        ticket_service.ensure_ticket_access(db, project=ticket.project, actor=actor)
        return ticket
    except TicketServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def _response(item: Attachment) -> AttachmentResponse:
    return AttachmentResponse(
        id=item.id,
        project_id=item.project_id,
        ticket_id=item.ticket_id,
        original_filename=item.original_filename,
        file_size=item.file_size,
        mime_type=item.mime_type,
        uploaded_by=AttachmentUploaderResponse(
            id=item.uploader.id,
            full_name=item.uploader.full_name,
            email=item.uploader.email,
        ),
        uploaded_at=item.uploaded_at,
    )


def _load_attachment(
    db: Session,
    *,
    attachment_id: UUID,
    project_id: UUID,
    ticket_id: UUID | None,
) -> Attachment:
    query = (
        select(Attachment)
        .options(joinedload(Attachment.uploader))
        .where(
            Attachment.id == attachment_id,
            Attachment.project_id == project_id,
            Attachment.ticket_id == ticket_id,
            Attachment.deleted_at.is_(None),
        )
    )
    item = db.scalar(query)
    if item is None:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    return item


def _list_attachments(
    db: Session, *, project_id: UUID, ticket_id: UUID | None
) -> AttachmentListResponse:
    items = (
        db.scalars(
            select(Attachment)
            .options(joinedload(Attachment.uploader))
            .where(
                Attachment.project_id == project_id,
                Attachment.ticket_id == ticket_id,
                Attachment.deleted_at.is_(None),
            )
            .order_by(Attachment.uploaded_at.desc(), Attachment.id.desc())
        )
        .unique()
        .all()
    )
    return AttachmentListResponse(items=[_response(item) for item in items])


def _record_ticket_activity(
    db: Session, *, ticket_id: UUID, actor: User, action: str, filename: str
) -> None:
    verb = "uploaded" if action == "ATTACHMENT_UPLOADED" else "deleted"
    db.add(
        TicketActivity(
            ticket_id=ticket_id,
            actor_user_id=actor.id,
            action=action,
            description=f"Attachment {filename} {verb}.",
        )
    )


async def _create_attachments(
    db: Session,
    *,
    project: Project,
    ticket: Ticket | None,
    actor: User,
    files: list[UploadFile],
) -> AttachmentListResponse:
    if not files:
        raise HTTPException(status_code=400, detail="Select at least one file to upload.")
    if project.archived_at is not None or project.status == "ARCHIVED":
        raise HTTPException(
            status_code=409, detail="Attachments cannot be changed in an archived project."
        )

    # Validate the complete batch before writing any bytes. This avoids partial uploads
    # when a later file in the same request fails validation.
    validated: list[tuple[str, bytes, str, str]] = []
    for upload in files:
        filename, data, mime_type = await read_and_validate_upload(upload)
        extension = Path(filename).suffix.lower()
        validated.append((filename, data, mime_type, extension))

    if ticket is not None:
        # Serialize quota checks on PostgreSQL by locking the ticket row.
        db.scalar(select(Ticket.id).where(Ticket.id == ticket.id).with_for_update())
        active_count = (
            db.scalar(
                select(func.count(Attachment.id)).where(
                    Attachment.ticket_id == ticket.id,
                    Attachment.deleted_at.is_(None),
                )
            )
            or 0
        )
        if active_count + len(validated) > 5:
            raise HTTPException(
                status_code=409,
                detail=(
                    "A ticket can have no more than 5 active attachments. "
                    f"{active_count} are already attached."
                ),
            )

    stored_keys: list[str] = []
    try:
        for filename, data, mime_type, extension in validated:
            storage_key = write_private_file(data, extension)
            stored_keys.append(storage_key)
            item = Attachment(
                project_id=project.id,
                ticket_id=ticket.id if ticket else None,
                uploaded_by_user_id=actor.id,
                original_filename=filename,
                storage_key=storage_key,
                file_size=len(data),
                mime_type=mime_type,
            )
            db.add(item)
            db.flush()
            if ticket is not None:
                _record_ticket_activity(
                    db,
                    ticket_id=ticket.id,
                    actor=actor,
                    action="ATTACHMENT_UPLOADED",
                    filename=filename,
                )
        db.commit()
    except Exception:
        db.rollback()
        for key in stored_keys:
            try:
                remove_private_file(key)
            except OSError:
                pass
        raise

    return _list_attachments(db, project_id=project.id, ticket_id=ticket.id if ticket else None)


def _content_response(item: Attachment, *, inline: bool) -> Response:
    path = storage_path(item.storage_key)
    if not path.is_file():
        raise HTTPException(
            status_code=404, detail="The attachment file is missing or unavailable."
        )
    disposition = (
        "inline"
        if inline and item.mime_type in {"application/pdf", "image/jpeg", "image/png", "image/webp"}
        else "attachment"
    )
    filename = quote(safe_original_filename(item.original_filename), safe="")
    return Response(
        content=path.read_bytes(),
        media_type=item.mime_type,
        headers={
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{filename}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


def _delete_attachment(
    db: Session,
    *,
    item: Attachment,
    actor: User,
    project: Project,
) -> dict[str, str]:
    is_project_manager = actor.role.code == "PM" and project.project_manager_id == actor.id
    if (
        item.uploaded_by_user_id != actor.id
        and actor.role.code != "ADMIN"
        and not is_project_manager
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own attachments unless you manage this project.",
        )

    item.deleted_at = datetime.now(UTC)
    if item.ticket_id is not None:
        _record_ticket_activity(
            db,
            ticket_id=item.ticket_id,
            actor=actor,
            action="ATTACHMENT_DELETED",
            filename=item.original_filename,
        )
    storage_key = item.storage_key
    db.commit()
    # Metadata remains as a soft-delete record; private bytes are removed after access is revoked.
    try:
        remove_private_file(storage_key)
    except OSError:
        # The deleted metadata prevents further downloads even if physical cleanup needs attention.
        pass
    return {"message": "Attachment deleted successfully.", "attachment_id": str(item.id)}


@router.get("/projects/{project_id}/attachments", response_model=AttachmentListResponse)
@limiter.limit("60/minute")
def list_project_attachments(
    request: Request,
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AttachmentListResponse:
    _project_for_actor(db, project_id, actor)
    return _list_attachments(db, project_id=project_id, ticket_id=None)


@router.post(
    "/projects/{project_id}/attachments", response_model=AttachmentListResponse, status_code=201
)
@limiter.limit("20/minute")
async def upload_project_attachments(
    request: Request,
    project_id: UUID,
    files: list[UploadFile] = File(...),
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AttachmentListResponse:
    project = _project_for_actor(db, project_id, actor)
    try:
        return await _create_attachments(db, project=project, ticket=None, actor=actor, files=files)
    finally:
        for upload in files:
            await upload.close()


@router.get("/projects/{project_id}/attachments/{attachment_id}/preview")
@limiter.limit("60/minute")
def preview_project_attachment(
    request: Request,
    project_id: UUID,
    attachment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _project_for_actor(db, project_id, actor)
    item = _load_attachment(db, attachment_id=attachment_id, project_id=project_id, ticket_id=None)
    return _content_response(item, inline=True)


@router.get("/projects/{project_id}/attachments/{attachment_id}/download")
@limiter.limit("60/minute")
def download_project_attachment(
    request: Request,
    project_id: UUID,
    attachment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _project_for_actor(db, project_id, actor)
    item = _load_attachment(db, attachment_id=attachment_id, project_id=project_id, ticket_id=None)
    return _content_response(item, inline=False)


@router.delete("/projects/{project_id}/attachments/{attachment_id}")
@limiter.limit("20/minute")
def delete_project_attachment(
    request: Request,
    project_id: UUID,
    attachment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    project = _project_for_actor(db, project_id, actor)
    item = _load_attachment(db, attachment_id=attachment_id, project_id=project_id, ticket_id=None)
    return _delete_attachment(db, item=item, actor=actor, project=project)


@router.get("/tickets/{ticket_id}/attachments", response_model=AttachmentListResponse)
@limiter.limit("60/minute")
def list_ticket_attachments(
    request: Request,
    ticket_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AttachmentListResponse:
    ticket = _ticket_for_actor(db, ticket_id, actor)
    return _list_attachments(db, project_id=ticket.project_id, ticket_id=ticket.id)


@router.post(
    "/tickets/{ticket_id}/attachments", response_model=AttachmentListResponse, status_code=201
)
@limiter.limit("20/minute")
async def upload_ticket_attachments(
    request: Request,
    ticket_id: UUID,
    files: list[UploadFile] = File(...),
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AttachmentListResponse:
    ticket = _ticket_for_actor(db, ticket_id, actor)
    try:
        return await _create_attachments(
            db, project=ticket.project, ticket=ticket, actor=actor, files=files
        )
    finally:
        for upload in files:
            await upload.close()


@router.get("/tickets/{ticket_id}/attachments/{attachment_id}/preview")
@limiter.limit("60/minute")
def preview_ticket_attachment(
    request: Request,
    ticket_id: UUID,
    attachment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    ticket = _ticket_for_actor(db, ticket_id, actor)
    item = _load_attachment(
        db, attachment_id=attachment_id, project_id=ticket.project_id, ticket_id=ticket.id
    )
    return _content_response(item, inline=True)


@router.get("/tickets/{ticket_id}/attachments/{attachment_id}/download")
@limiter.limit("60/minute")
def download_ticket_attachment(
    request: Request,
    ticket_id: UUID,
    attachment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    ticket = _ticket_for_actor(db, ticket_id, actor)
    item = _load_attachment(
        db, attachment_id=attachment_id, project_id=ticket.project_id, ticket_id=ticket.id
    )
    return _content_response(item, inline=False)


@router.delete("/tickets/{ticket_id}/attachments/{attachment_id}")
@limiter.limit("20/minute")
def delete_ticket_attachment(
    request: Request,
    ticket_id: UUID,
    attachment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    ticket = _ticket_for_actor(db, ticket_id, actor)
    item = _load_attachment(
        db, attachment_id=attachment_id, project_id=ticket.project_id, ticket_id=ticket.id
    )
    return _delete_attachment(db, item=item, actor=actor, project=ticket.project)
