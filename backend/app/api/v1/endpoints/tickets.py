from __future__ import annotations

from math import ceil
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import Ticket, TicketActivity, User
from app.schemas.ticket import (
    TicketActivityResponse,
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
