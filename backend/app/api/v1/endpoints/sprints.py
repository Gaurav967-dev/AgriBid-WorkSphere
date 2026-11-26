from __future__ import annotations

from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import Sprint, Ticket, User
from app.schemas.sprint import (
    SprintBacklogResponse,
    SprintBacklogTicketResponse,
    SprintCreateRequest,
    SprintDeleteTicketResponse,
    SprintListResponse,
    SprintResponse,
    SprintTicketAddRequest,
    SprintTicketResponse,
    SprintUpdateRequest,
)
from app.services import sprint_service
from app.services.sprint_service import SprintServiceError

router = APIRouter(tags=["Sprints"])


def _raise_service_error(error: SprintServiceError) -> None:
    raise HTTPException(status_code=error.status_code, detail=error.message) from error


def _handle_database_error(db: Session) -> HTTPException:
    db.rollback()
    return HTTPException(
        status_code=409,
        detail="The sprint or ticket assignment conflicts with an existing record.",
    )


def _sprint_response(sprint: Sprint) -> SprintResponse:
    return SprintResponse(**sprint_service.sprint_payload(sprint))


def _backlog_ticket_response(ticket: Ticket) -> SprintBacklogTicketResponse:
    return SprintBacklogTicketResponse(
        id=ticket.id,
        ticket_key=ticket.ticket_key,
        title=ticket.title,
        type=ticket.type,
        priority=ticket.priority,
        status=ticket.status,
        assignee_name=ticket.assignee.full_name if ticket.assignee else None,
        due_date=ticket.due_date,
    )


@router.get(
    "/projects/{project_id}/sprints",
    response_model=SprintListResponse,
)
@limiter.limit("60/minute")
def get_project_sprints(
    request: Request,
    project_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintListResponse:
    try:
        sprints, total = sprint_service.list_sprints(
            db,
            project_id=project_id,
            actor=actor,
            page=page,
            page_size=page_size,
        )
    except SprintServiceError as error:
        _raise_service_error(error)

    return SprintListResponse(
        items=[_sprint_response(sprint) for sprint in sprints],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.post(
    "/projects/{project_id}/sprints",
    response_model=SprintResponse,
    status_code=201,
)
@limiter.limit("20/minute")
def create_project_sprint(
    request: Request,
    project_id: UUID,
    data: SprintCreateRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintResponse:
    try:
        sprint = sprint_service.create_sprint(
            db,
            project_id=project_id,
            actor=actor,
            data=data,
        )
    except SprintServiceError as error:
        _raise_service_error(error)
    except IntegrityError:
        raise _handle_database_error(db) from None

    return _sprint_response(sprint)


@router.get(
    "/projects/{project_id}/backlog",
    response_model=SprintBacklogResponse,
)
@limiter.limit("60/minute")
def get_project_backlog(
    request: Request,
    project_id: UUID,
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintBacklogResponse:
    try:
        tickets, total = sprint_service.list_backlog_tickets(
            db,
            project_id=project_id,
            actor=actor,
            search=search,
            page=page,
            page_size=page_size,
        )
    except SprintServiceError as error:
        _raise_service_error(error)

    return SprintBacklogResponse(
        items=[_backlog_ticket_response(ticket) for ticket in tickets],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.get("/sprints/{sprint_id}", response_model=SprintResponse)
@limiter.limit("60/minute")
def get_sprint_details(
    request: Request,
    sprint_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintResponse:
    try:
        sprint = sprint_service.get_sprint_for_user(
            db,
            sprint_id=sprint_id,
            actor=actor,
        )
    except SprintServiceError as error:
        _raise_service_error(error)

    return _sprint_response(sprint)


@router.patch("/sprints/{sprint_id}", response_model=SprintResponse)
@limiter.limit("30/minute")
def update_existing_sprint(
    request: Request,
    sprint_id: UUID,
    data: SprintUpdateRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintResponse:
    try:
        sprint = sprint_service.update_sprint(
            db,
            sprint_id=sprint_id,
            actor=actor,
            data=data,
        )
    except SprintServiceError as error:
        _raise_service_error(error)

    return _sprint_response(sprint)


@router.post(
    "/sprints/{sprint_id}/tickets",
    response_model=SprintResponse,
)
@limiter.limit("30/minute")
def add_sprint_tickets(
    request: Request,
    sprint_id: UUID,
    data: SprintTicketAddRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintResponse:
    try:
        sprint = sprint_service.add_tickets_to_sprint(
            db,
            sprint_id=sprint_id,
            ticket_ids=data.ticket_ids,
            actor=actor,
        )
    except SprintServiceError as error:
        _raise_service_error(error)
    except IntegrityError:
        raise _handle_database_error(db) from None

    return _sprint_response(sprint)


@router.delete(
    "/sprints/{sprint_id}/tickets/{ticket_id}",
    response_model=SprintDeleteTicketResponse,
)
@limiter.limit("30/minute")
def remove_sprint_ticket(
    request: Request,
    sprint_id: UUID,
    ticket_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintDeleteTicketResponse:
    try:
        sprint_service.remove_ticket_from_sprint(
            db,
            sprint_id=sprint_id,
            ticket_id=ticket_id,
            actor=actor,
        )
    except SprintServiceError as error:
        _raise_service_error(error)

    return SprintDeleteTicketResponse(
        message="Ticket removed from sprint successfully.",
        sprint_id=sprint_id,
        ticket_id=ticket_id,
    )


@router.post("/sprints/{sprint_id}/start", response_model=SprintResponse)
@limiter.limit("20/minute")
def start_existing_sprint(
    request: Request,
    sprint_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintResponse:
    try:
        sprint = sprint_service.start_sprint(
            db,
            sprint_id=sprint_id,
            actor=actor,
        )
    except SprintServiceError as error:
        _raise_service_error(error)

    return _sprint_response(sprint)


@router.post("/sprints/{sprint_id}/complete", response_model=SprintResponse)
@limiter.limit("20/minute")
def complete_existing_sprint(
    request: Request,
    sprint_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SprintResponse:
    try:
        sprint = sprint_service.complete_sprint(
            db,
            sprint_id=sprint_id,
            actor=actor,
        )
    except SprintServiceError as error:
        _raise_service_error(error)

    return _sprint_response(sprint)
