from __future__ import annotations

from datetime import UTC, datetime
from math import ceil
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import ProjectMember, Ticket, TicketActivity, TicketComment, User
from app.schemas.ticket import (
    TicketActivityResponse,
    TicketCommentCreateRequest,
    TicketCommentListResponse,
    TicketCommentResponse,
    TicketCommentUpdateRequest,
    TicketCreateRequest,
    TicketDeleteResponse,
    TicketDetailsResponse,
    TicketListResponse,
    TicketProjectSummaryResponse,
    TicketResponse,
    TicketStatusUpdateRequest,
    TicketUpdateRequest,
    TicketUserSummaryResponse,
)
from app.services import ticket_service
from app.services.ticket_service import TicketServiceError

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def _user_summary(user: User) -> TicketUserSummaryResponse:
    return TicketUserSummaryResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role_code=user.role.code,
    )


def _ticket_response(ticket: Ticket) -> TicketResponse:
    return TicketResponse(
        id=ticket.id,
        project=TicketProjectSummaryResponse(
            id=ticket.project.id,
            name=ticket.project.name,
            key=ticket.project.key,
        ),
        number=ticket.number,
        ticket_key=ticket.ticket_key,
        title=ticket.title,
        description=ticket.description,
        type=ticket.type,
        priority=ticket.priority,
        status=ticket.status,
        reporter=_user_summary(ticket.reporter),
        assignee=_user_summary(ticket.assignee) if ticket.assignee else None,
        reviewer=_user_summary(ticket.reviewer) if ticket.reviewer else None,
        tester=_user_summary(ticket.tester) if ticket.tester else None,
        start_date=ticket.start_date,
        due_date=ticket.due_date,
        estimated_effort=ticket.estimated_effort,
        labels=ticket.labels,
        parent_ticket_id=ticket.parent_ticket_id,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        completed_at=ticket.completed_at,
        completed_by=(_user_summary(ticket.completed_by) if ticket.completed_by else None),
    )


def _activity_response(activity: TicketActivity) -> TicketActivityResponse:
    return TicketActivityResponse(
        id=activity.id,
        actor=_user_summary(activity.actor),
        action=activity.action,
        field_name=activity.field_name,
        old_value=activity.old_value,
        new_value=activity.new_value,
        description=activity.description,
        created_at=activity.created_at,
    )


def _ticket_details(ticket: Ticket) -> TicketDetailsResponse:
    summary = _ticket_response(ticket)

    return TicketDetailsResponse(
        **summary.model_dump(),
        activities=[_activity_response(activity) for activity in ticket.activities],
    )


def _raise_service_error(error: TicketServiceError) -> None:
    raise HTTPException(
        status_code=error.status_code,
        detail=error.message,
    ) from error


def _handle_database_error(db: Session) -> HTTPException:
    db.rollback()
    return HTTPException(
        status_code=409,
        detail="The ticket could not be saved because of a conflicting record.",
    )


@router.get("", response_model=TicketListResponse)
@limiter.limit("60/minute")
def get_tickets(
    request: Request,
    project_id: UUID | None = None,
    status: Literal[
        "BACKLOG",
        "TODO",
        "IN_PROGRESS",
        "IN_REVIEW",
        "TESTING",
        "TESTING_DONE",
        "BUG_FIXED",
        "COMPLETED",
        "BLOCKED",
        "REOPENED",
        "CANCELLED",
    ]
    | None = None,
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = None,
    ticket_type: Literal[
        "EPIC",
        "STORY",
        "TASK",
        "SUBTASK",
        "BUG",
        "IMPROVEMENT",
        "TECHNICAL_DEBT",
    ]
    | None = None,
    assignee_id: UUID | None = None,
    search: str | None = Query(default=None, max_length=100),
    sort_by: Literal[
        "created_at",
        "updated_at",
        "due_date",
        "priority",
        "title",
        "number",
    ] = "updated_at",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketListResponse:
    tickets, total = ticket_service.list_tickets(
        db,
        current_user=current_user,
        project_id=project_id,
        status_filter=status,
        priority_filter=priority,
        type_filter=ticket_type,
        assignee_id=assignee_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )

    return TicketListResponse(
        items=[_ticket_response(ticket) for ticket in tickets],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=TicketDetailsResponse, status_code=201)
@limiter.limit("20/minute")
def create_new_ticket(
    request: Request,
    data: TicketCreateRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketDetailsResponse:
    try:
        ticket = ticket_service.create_ticket(
            db,
            actor=actor,
            data=data,
        )
    except TicketServiceError as error:
        _raise_service_error(error)
    except IntegrityError:
        raise _handle_database_error(db) from None

    return _ticket_details(ticket)


@router.get("/{ticket_id}", response_model=TicketDetailsResponse)
@limiter.limit("60/minute")
def get_ticket_details(
    request: Request,
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketDetailsResponse:
    try:
        ticket = ticket_service.get_ticket(db, ticket_id)
        project = ticket.project

        ticket_service.ensure_ticket_access(
            db,
            project=project,
            actor=current_user,
        )
    except TicketServiceError as error:
        _raise_service_error(error)

    return _ticket_details(ticket)


@router.patch("/{ticket_id}", response_model=TicketDetailsResponse)
@limiter.limit("30/minute")
def update_existing_ticket(
    request: Request,
    ticket_id: UUID,
    data: TicketUpdateRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketDetailsResponse:
    try:
        ticket = ticket_service.update_ticket(
            db,
            ticket_id=ticket_id,
            actor=actor,
            data=data,
        )
    except TicketServiceError as error:
        _raise_service_error(error)
    except IntegrityError:
        raise _handle_database_error(db) from None

    return _ticket_details(ticket)


@router.patch("/{ticket_id}/status", response_model=TicketDetailsResponse)
@limiter.limit("30/minute")
def change_ticket_status(
    request: Request,
    ticket_id: UUID,
    data: TicketStatusUpdateRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketDetailsResponse:
    try:
        ticket = ticket_service.update_ticket_status(
            db,
            ticket_id=ticket_id,
            actor=actor,
            new_status=data.status,
            reason=data.reason,
        )
    except TicketServiceError as error:
        _raise_service_error(error)

    return _ticket_details(ticket)


@router.delete("/{ticket_id}", response_model=TicketDeleteResponse)
@limiter.limit("20/minute")
def delete_existing_ticket(
    request: Request,
    ticket_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketDeleteResponse:
    try:
        deleted_at = ticket_service.delete_ticket(
            db,
            ticket_id=ticket_id,
            actor=actor,
        )
    except TicketServiceError as error:
        _raise_service_error(error)

    return TicketDeleteResponse(
        message="Ticket deleted successfully.",
        ticket_id=ticket_id,
        deleted_at=deleted_at,
    )


def _comment_response(comment: TicketComment) -> TicketCommentResponse:
    is_deleted = comment.deleted_at is not None
    return TicketCommentResponse(
        id=comment.id,
        ticket_id=comment.ticket_id,
        parent_comment_id=comment.parent_comment_id,
        author=_user_summary(comment.author),
        body=None if is_deleted else comment.body,
        mentioned_users=[_user_summary(user) for user in comment.mentioned_users],
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        edited_at=comment.edited_at,
        deleted_at=comment.deleted_at,
        is_deleted=is_deleted,
    )


def _ticket_for_comment(
    db: Session,
    ticket_id: UUID,
    actor: User,
) -> Ticket:
    try:
        ticket = ticket_service.get_ticket(db, ticket_id)
        ticket_service.ensure_ticket_access(
            db,
            project=ticket.project,
            actor=actor,
        )
        return ticket
    except ticket_service.TicketServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=str(exc),
        ) from exc


def _validated_mentioned_users(db: Session, *, ticket: Ticket, user_ids: list[UUID]) -> list[User]:
    if not user_ids:
        return []

    users = (
        db.scalars(
            select(User)
            .options(joinedload(User.role))
            .where(User.id.in_(user_ids), User.is_active.is_(True))
        )
        .unique()
        .all()
    )
    if len(users) != len(user_ids):
        raise HTTPException(status_code=400, detail="One or more mentioned users are unavailable.")

    member_ids = set(
        db.scalars(
            select(ProjectMember.user_id).where(
                ProjectMember.project_id == ticket.project_id,
                ProjectMember.removed_at.is_(None),
            )
        ).all()
    )
    allowed_ids = member_ids | {ticket.project.project_manager_id}
    for mentioned_user in users:
        if mentioned_user.role.code != "ADMIN" and mentioned_user.id not in allowed_ids:
            raise HTTPException(
                status_code=400, detail="Mentioned users must have access to this project."
            )
    return users


def _load_ticket_comment(db: Session, *, ticket_id: UUID, comment_id: UUID) -> TicketComment:
    comment = db.scalar(
        select(TicketComment)
        .options(
            joinedload(TicketComment.author).joinedload(User.role),
            selectinload(TicketComment.mentioned_users).joinedload(User.role),
        )
        .where(TicketComment.id == comment_id, TicketComment.ticket_id == ticket_id)
    )
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found.")
    return comment


def _record_comment_activity(
    db: Session, *, ticket_id: UUID, actor: User, action: str, description: str
) -> None:
    db.add(
        TicketActivity(
            ticket_id=ticket_id,
            actor_user_id=actor.id,
            action=action,
            description=description,
        )
    )


@router.get("/{ticket_id}/comments", response_model=TicketCommentListResponse)
@limiter.limit("60/minute")
def list_ticket_comments(
    request: Request,
    ticket_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketCommentListResponse:
    ticket = _ticket_for_comment(db, ticket_id, actor)
    comments = (
        db.scalars(
            select(TicketComment)
            .options(
                joinedload(TicketComment.author).joinedload(User.role),
                selectinload(TicketComment.mentioned_users).joinedload(User.role),
            )
            .where(TicketComment.ticket_id == ticket.id)
            .order_by(TicketComment.created_at.asc(), TicketComment.id.asc())
        )
        .unique()
        .all()
    )
    return TicketCommentListResponse(items=[_comment_response(item) for item in comments])


@router.post("/{ticket_id}/comments", response_model=TicketCommentResponse, status_code=201)
@limiter.limit("30/minute")
def create_ticket_comment(
    request: Request,
    ticket_id: UUID,
    data: TicketCommentCreateRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketCommentResponse:
    ticket = _ticket_for_comment(db, ticket_id, actor)
    if data.parent_comment_id is not None:
        parent = db.scalar(
            select(TicketComment).where(
                TicketComment.id == data.parent_comment_id,
                TicketComment.ticket_id == ticket.id,
                TicketComment.deleted_at.is_(None),
            )
        )
        if parent is None:
            raise HTTPException(
                status_code=400, detail="Reply target must be an existing comment on this ticket."
            )

    mentioned_users = _validated_mentioned_users(
        db, ticket=ticket, user_ids=data.mentioned_user_ids
    )
    comment = TicketComment(
        ticket_id=ticket.id,
        author_user_id=actor.id,
        parent_comment_id=data.parent_comment_id,
        body=data.body,
        mentioned_users=mentioned_users,
    )
    db.add(comment)
    db.flush()
    _record_comment_activity(
        db,
        ticket_id=ticket.id,
        actor=actor,
        action="COMMENT_ADDED",
        description="A ticket comment was added.",
    )
    db.commit()
    return _comment_response(_load_ticket_comment(db, ticket_id=ticket.id, comment_id=comment.id))


@router.patch("/{ticket_id}/comments/{comment_id}", response_model=TicketCommentResponse)
@limiter.limit("30/minute")
def update_ticket_comment(
    request: Request,
    ticket_id: UUID,
    comment_id: UUID,
    data: TicketCommentUpdateRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketCommentResponse:
    ticket = _ticket_for_comment(db, ticket_id, actor)
    comment = _load_ticket_comment(db, ticket_id=ticket.id, comment_id=comment_id)
    if comment.deleted_at is not None:
        raise HTTPException(status_code=409, detail="Deleted comments cannot be edited.")
    if comment.author_user_id != actor.id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments.")

    comment.body = data.body
    comment.edited_at = datetime.now(UTC)
    if data.mentioned_user_ids is not None:
        comment.mentioned_users = _validated_mentioned_users(
            db, ticket=ticket, user_ids=data.mentioned_user_ids
        )
    _record_comment_activity(
        db,
        ticket_id=ticket.id,
        actor=actor,
        action="COMMENT_EDITED",
        description="A ticket comment was edited.",
    )
    db.commit()
    return _comment_response(_load_ticket_comment(db, ticket_id=ticket.id, comment_id=comment.id))


@router.delete("/{ticket_id}/comments/{comment_id}", response_model=TicketCommentResponse)
@limiter.limit("20/minute")
def delete_ticket_comment(
    request: Request,
    ticket_id: UUID,
    comment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketCommentResponse:
    ticket = _ticket_for_comment(db, ticket_id, actor)
    comment = _load_ticket_comment(db, ticket_id=ticket.id, comment_id=comment_id)
    is_project_manager = actor.role.code == "PM" and ticket.project.project_manager_id == actor.id
    if comment.author_user_id != actor.id and actor.role.code != "ADMIN" and not is_project_manager:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own comments unless you manage this project.",
        )
    if comment.deleted_at is None:
        comment.deleted_at = datetime.now(UTC)
        _record_comment_activity(
            db,
            ticket_id=ticket.id,
            actor=actor,
            action="COMMENT_DELETED",
            description="A ticket comment was deleted.",
        )
        db.commit()
    return _comment_response(_load_ticket_comment(db, ticket_id=ticket.id, comment_id=comment.id))
