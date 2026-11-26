from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    Project,
    ProjectMember,
    Sprint,
    SprintTicket,
    Ticket,
    TicketActivity,
    User,
)
from app.schemas.sprint import SprintCreateRequest, SprintUpdateRequest


class SprintServiceError(Exception):
    """Represent an expected Sprint Management business-rule failure."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _sprint_options():
    return (
        joinedload(Sprint.project),
        selectinload(Sprint.ticket_assignments)
        .joinedload(SprintTicket.ticket)
        .joinedload(Ticket.assignee),
    )


def _get_project(db: Session, project_id: UUID) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id))
    if project is None:
        raise SprintServiceError("Project not found.", 404)
    return project


def _get_sprint(db: Session, sprint_id: UUID) -> Sprint:
    sprint = db.scalar(
        select(Sprint).options(*_sprint_options()).where(Sprint.id == sprint_id)
    )
    if sprint is None:
        raise SprintServiceError("Sprint not found.", 404)
    return sprint


def _ensure_project_access(db: Session, *, project: Project, actor: User) -> None:
    if actor.role.code == "ADMIN":
        return

    if actor.role.code == "PM" and project.project_manager_id == actor.id:
        return

    membership = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == actor.id,
            ProjectMember.removed_at.is_(None),
        )
    )
    if membership is None:
        raise SprintServiceError("Project not found.", 404)


def _ensure_project_management_access(*, project: Project, actor: User) -> None:
    if actor.role.code == "ADMIN":
        return

    if actor.role.code == "PM" and project.project_manager_id == actor.id:
        return

    raise SprintServiceError("Project not found.", 404)


def _ensure_project_can_be_modified(project: Project) -> None:
    if project.archived_at is not None or project.status == "ARCHIVED":
        raise SprintServiceError("Archived projects cannot be modified.", 409)


def _visible_assignments(sprint: Sprint) -> list[SprintTicket]:
    """Return tickets currently assigned or included in the completed sprint snapshot."""
    if sprint.status == "COMPLETED":
        return [
            row
            for row in sprint.ticket_assignments
            if row.removed_at is not None
            and row.status_at_close is not None
            and row.ticket.deleted_at is None
        ]

    return [
        row
        for row in sprint.ticket_assignments
        if row.removed_at is None and row.ticket.deleted_at is None
    ]


def sprint_payload(sprint: Sprint) -> dict:
    assignments = _visible_assignments(sprint)
    completed_count = sum(
        1
        for row in assignments
        if (
            row.status_at_close if sprint.status == "COMPLETED" else row.ticket.status
        )
        == "COMPLETED"
    )
    assigned_count = len(assignments)
    pending_count = assigned_count - completed_count

    ticket_items = []
    for row in assignments:
        ticket = row.ticket
        displayed_status = (
            row.status_at_close if sprint.status == "COMPLETED" else ticket.status
        )
        ticket_items.append(
            {
                "id": row.id,
                "ticket_id": ticket.id,
                "ticket_key": ticket.ticket_key,
                "title": ticket.title,
                "type": ticket.type,
                "priority": ticket.priority,
                "status": displayed_status,
                "assignee_name": ticket.assignee.full_name if ticket.assignee else None,
                "due_date": ticket.due_date,
                "added_at": row.added_at,
                "status_at_close": row.status_at_close,
            }
        )

    return {
        "id": sprint.id,
        "project_id": sprint.project_id,
        "project_name": sprint.project.name,
        "project_key": sprint.project.key,
        "name": sprint.name,
        "goal": sprint.goal,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "status": sprint.status,
        "created_at": sprint.created_at,
        "updated_at": sprint.updated_at,
        "started_at": sprint.started_at,
        "completed_at": sprint.completed_at,
        "assigned_tickets": assigned_count,
        "completed_tickets": completed_count,
        "pending_tickets": pending_count,
        "completion_percentage": (
            round(completed_count / assigned_count * 100, 2) if assigned_count else 0.0
        ),
        "tickets": ticket_items,
    }


def list_sprints(
    db: Session,
    *,
    project_id: UUID,
    actor: User,
    page: int,
    page_size: int,
) -> tuple[list[Sprint], int]:
    project = _get_project(db, project_id)
    _ensure_project_access(db, project=project, actor=actor)

    total = int(
        db.scalar(select(func.count(Sprint.id)).where(Sprint.project_id == project_id)) or 0
    )
    sprints = list(
        db.scalars(
            select(Sprint)
            .options(*_sprint_options())
            .where(Sprint.project_id == project_id)
            .order_by(Sprint.created_at.desc(), Sprint.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return sprints, total


def get_sprint_for_user(db: Session, *, sprint_id: UUID, actor: User) -> Sprint:
    sprint = _get_sprint(db, sprint_id)
    _ensure_project_access(db, project=sprint.project, actor=actor)
    return sprint


def create_sprint(
    db: Session,
    *,
    project_id: UUID,
    actor: User,
    data: SprintCreateRequest,
) -> Sprint:
    if actor.role.code not in {"ADMIN", "PM"}:
        raise SprintServiceError("Only Administrators and Project Managers can create sprints.", 403)

    project = db.scalar(
        select(Project).where(Project.id == project_id).with_for_update()
    )
    if project is None:
        raise SprintServiceError("Project not found.", 404)
    _ensure_project_management_access(project=project, actor=actor)
    _ensure_project_can_be_modified(project)

    sprint = Sprint(
        project_id=project.id,
        name=data.name,
        goal=data.goal,
        start_date=data.start_date,
        end_date=data.end_date,
        status="PLANNED",
        created_by_user_id=actor.id,
    )
    db.add(sprint)
    db.commit()
    return _get_sprint(db, sprint.id)


def update_sprint(
    db: Session,
    *,
    sprint_id: UUID,
    actor: User,
    data: SprintUpdateRequest,
) -> Sprint:
    sprint = _get_sprint(db, sprint_id)
    _ensure_project_management_access(project=sprint.project, actor=actor)
    _ensure_project_can_be_modified(sprint.project)

    if sprint.status != "PLANNED":
        raise SprintServiceError("Only planned sprints can be edited.", 409)

    changes = data.model_dump(exclude_unset=True)
    if any(value is None for value in changes.values()):
        raise SprintServiceError("Sprint fields cannot be cleared.", 400)

    start_date = changes.get("start_date", sprint.start_date)
    end_date = changes.get("end_date", sprint.end_date)
    if start_date is None or end_date is None or end_date < start_date:
        raise SprintServiceError("Sprint end date cannot be before its start date.", 400)

    for field, value in changes.items():
        setattr(sprint, field, value)

    db.commit()
    return _get_sprint(db, sprint.id)


def list_backlog_tickets(
    db: Session,
    *,
    project_id: UUID,
    actor: User,
    search: str | None,
    page: int,
    page_size: int,
) -> tuple[list[Ticket], int]:
    project = _get_project(db, project_id)
    _ensure_project_access(db, project=project, actor=actor)

    filters = [
        Ticket.project_id == project_id,
        Ticket.deleted_at.is_(None),
        Ticket.status == "BACKLOG",
        Project.archived_at.is_(None),
    ]
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(Ticket.ticket_key.ilike(term), Ticket.title.ilike(term)))

    available_assignment = (
        select(SprintTicket.id)
        .where(
            SprintTicket.ticket_id == Ticket.id,
            SprintTicket.removed_at.is_(None),
        )
        .exists()
    )
    filters.append(~available_assignment)

    query = select(Ticket).join(Project, Project.id == Ticket.project_id).where(*filters)
    total = int(
        db.scalar(
            select(func.count(Ticket.id))
            .select_from(Ticket)
            .join(Project, Project.id == Ticket.project_id)
            .where(*filters)
        )
        or 0
    )
    tickets = list(
        db.scalars(
            query.options(joinedload(Ticket.assignee))
            .order_by(Ticket.priority.desc(), Ticket.updated_at.desc(), Ticket.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return tickets, total


def add_tickets_to_sprint(
    db: Session,
    *,
    sprint_id: UUID,
    ticket_ids: list[UUID],
    actor: User,
) -> Sprint:
    sprint = _get_sprint(db, sprint_id)
    _ensure_project_management_access(project=sprint.project, actor=actor)
    _ensure_project_can_be_modified(sprint.project)
    if sprint.status == "COMPLETED":
        raise SprintServiceError("Tickets cannot be added to a completed sprint.", 409)

    tickets = list(
        db.scalars(
            select(Ticket)
            .where(
                Ticket.id.in_(ticket_ids),
                Ticket.project_id == sprint.project_id,
                Ticket.deleted_at.is_(None),
            )
            .with_for_update()
        ).all()
    )
    if len(tickets) != len(ticket_ids):
        raise SprintServiceError(
            "One or more selected tickets are unavailable in this project.", 400
        )

    by_id = {ticket.id: ticket for ticket in tickets}
    for ticket_id in ticket_ids:
        ticket = by_id[ticket_id]
        if ticket.status != "BACKLOG":
            raise SprintServiceError(
                f"Ticket {ticket.ticket_key} must be in Backlog before it can be added.",
                409,
            )
        existing = db.scalar(
            select(SprintTicket.id).where(
                SprintTicket.ticket_id == ticket.id,
                SprintTicket.removed_at.is_(None),
            )
        )
        if existing is not None:
            raise SprintServiceError(
                f"Ticket {ticket.ticket_key} is already assigned to a sprint.", 409
            )

        db.add(
            SprintTicket(
                sprint_id=sprint.id,
                ticket_id=ticket.id,
                added_by_user_id=actor.id,
            )
        )
        if sprint.status == "ACTIVE":
            ticket.status = "TODO"
            db.add(
                TicketActivity(
                    ticket_id=ticket.id,
                    actor_user_id=actor.id,
                    action="STATUS_CHANGED",
                    field_name="status",
                    old_value="BACKLOG",
                    new_value="TODO",
                    description=f"Ticket moved to TODO when added to active sprint {sprint.name}.",
                )
            )

    db.commit()
    return _get_sprint(db, sprint.id)


def remove_ticket_from_sprint(
    db: Session,
    *,
    sprint_id: UUID,
    ticket_id: UUID,
    actor: User,
) -> Sprint:
    sprint = _get_sprint(db, sprint_id)
    _ensure_project_management_access(project=sprint.project, actor=actor)
    _ensure_project_can_be_modified(sprint.project)
    if sprint.status == "COMPLETED":
        raise SprintServiceError("Tickets cannot be removed from a completed sprint.", 409)

    assignment = db.scalar(
        select(SprintTicket).where(
            SprintTicket.sprint_id == sprint.id,
            SprintTicket.ticket_id == ticket_id,
            SprintTicket.removed_at.is_(None),
        )
    )
    if assignment is None:
        raise SprintServiceError("Ticket is not assigned to this sprint.", 404)

    assignment.removed_at = datetime.now(UTC)
    assignment.status_at_close = None
    ticket = assignment.ticket
    if sprint.status == "ACTIVE" and ticket.deleted_at is None and ticket.status not in {
        "COMPLETED",
        "CANCELLED",
        "BACKLOG",
    }:
        old_status = ticket.status
        ticket.status = "BACKLOG"
        db.add(
            TicketActivity(
                ticket_id=ticket.id,
                actor_user_id=actor.id,
                action="STATUS_CHANGED",
                field_name="status",
                old_value=old_status,
                new_value="BACKLOG",
                description=f"Ticket returned to Backlog when removed from sprint {sprint.name}.",
            )
        )
    db.commit()
    return _get_sprint(db, sprint.id)


def start_sprint(db: Session, *, sprint_id: UUID, actor: User) -> Sprint:
    sprint = _get_sprint(db, sprint_id)
    _ensure_project_management_access(project=sprint.project, actor=actor)
    _ensure_project_can_be_modified(sprint.project)
    if sprint.status != "PLANNED":
        raise SprintServiceError("Only planned sprints can be started.", 409)

    now = datetime.now(UTC)
    for assignment in sprint.ticket_assignments:
        ticket = assignment.ticket
        if assignment.removed_at is not None or ticket.deleted_at is not None:
            continue
        if ticket.status == "BACKLOG":
            ticket.status = "TODO"
            db.add(
                TicketActivity(
                    ticket_id=ticket.id,
                    actor_user_id=actor.id,
                    action="STATUS_CHANGED",
                    field_name="status",
                    old_value="BACKLOG",
                    new_value="TODO",
                    description=f"Ticket moved to TODO when sprint {sprint.name} started.",
                )
            )

    sprint.status = "ACTIVE"
    sprint.started_at = now
    db.commit()
    return _get_sprint(db, sprint.id)


def complete_sprint(db: Session, *, sprint_id: UUID, actor: User) -> Sprint:
    sprint = _get_sprint(db, sprint_id)
    _ensure_project_management_access(project=sprint.project, actor=actor)
    _ensure_project_can_be_modified(sprint.project)
    if sprint.status != "ACTIVE":
        raise SprintServiceError("Only active sprints can be completed.", 409)

    now = datetime.now(UTC)
    for assignment in sprint.ticket_assignments:
        if assignment.removed_at is not None:
            continue

        ticket = assignment.ticket
        if ticket.deleted_at is not None:
            assignment.removed_at = now
            assignment.status_at_close = None
            continue

        old_status = ticket.status
        assignment.status_at_close = old_status
        assignment.removed_at = now

        # Completed work stays completed. Cancelled work stays cancelled.
        # All other unfinished work returns to the existing Backlog status.
        if old_status not in {"COMPLETED", "CANCELLED", "BACKLOG"}:
            ticket.status = "BACKLOG"
            db.add(
                TicketActivity(
                    ticket_id=ticket.id,
                    actor_user_id=actor.id,
                    action="STATUS_CHANGED",
                    field_name="status",
                    old_value=old_status,
                    new_value="BACKLOG",
                    description=f"Unfinished ticket returned to Backlog when sprint {sprint.name} completed.",
                )
            )

    sprint.status = "COMPLETED"
    sprint.completed_at = now
    db.commit()
    return _get_sprint(db, sprint.id)
