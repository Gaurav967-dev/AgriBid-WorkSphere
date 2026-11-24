from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Project, ProjectMember, Ticket, TicketActivity, User
from app.schemas.ticket import TicketCreateRequest, TicketUpdateRequest


class TicketServiceError(Exception):
    """Represent an expected Ticket Management business-rule failure."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _ticket_options():
    """Eager-load relationships used by ticket response schemas."""
    return (
        joinedload(Ticket.project),
        joinedload(Ticket.reporter).joinedload(User.role),
        joinedload(Ticket.assignee).joinedload(User.role),
        joinedload(Ticket.reviewer).joinedload(User.role),
        joinedload(Ticket.tester).joinedload(User.role),
        joinedload(Ticket.completed_by).joinedload(User.role),
        selectinload(Ticket.activities).joinedload(TicketActivity.actor).joinedload(User.role),
    )


def get_ticket(db: Session, ticket_id: UUID) -> Ticket:
    """Return a non-deleted ticket with its response relationships."""
    ticket = db.scalar(
        select(Ticket)
        .options(*_ticket_options())
        .where(
            Ticket.id == ticket_id,
            Ticket.deleted_at.is_(None),
        )
    )

    if ticket is None:
        raise TicketServiceError("Ticket not found.", 404)

    return ticket


def _get_active_project(db: Session, project_id: UUID) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id))

    if project is None:
        raise TicketServiceError("Project not found.", 404)

    if project.archived_at is not None or project.status == "ARCHIVED":
        raise TicketServiceError("Archived projects cannot be modified.", 409)

    return project


def _ensure_project_access(
    db: Session,
    *,
    project: Project,
    actor: User,
) -> None:
    """Allow Admins, assigned PMs, and active project members to access tickets."""
    if actor.role.code == "ADMIN":
        return

    if actor.role.code == "PM" and project.project_manager_id == actor.id:
        return

    is_member = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == actor.id,
            ProjectMember.removed_at.is_(None),
        )
    )

    if is_member is None:
        raise TicketServiceError("Project not found.", 404)


def ensure_ticket_access(
    db: Session,
    *,
    project: Project,
    actor: User,
) -> None:
    """Verify that the current user can access a ticket's project."""
    _ensure_project_access(db, project=project, actor=actor)


def _ensure_project_management_access(
    *,
    project: Project,
    actor: User,
) -> None:
    """Only Admins and the assigned PM can manage project tickets."""
    if actor.role.code == "ADMIN":
        return

    if actor.role.code == "PM" and project.project_manager_id == actor.id:
        return

    raise TicketServiceError("Project not found.", 404)


def _validate_project_user(
    db: Session,
    *,
    project: Project,
    user_id: UUID,
    field_name: str,
) -> User:
    """Require an active project member or the assigned project manager."""
    user = db.scalar(
        select(User)
        .options(joinedload(User.role))
        .where(
            User.id == user_id,
            User.is_active.is_(True),
        )
    )

    if user is None:
        raise TicketServiceError(
            f"The selected {field_name} is not an active user.",
            400,
        )

    if field_name == "tester" and user.role.code != "TESTER":
        raise TicketServiceError(
            "The assigned tester must have the TESTER role.",
            400,
        )

    if user.id == project.project_manager_id:
        return user

    membership = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
            ProjectMember.removed_at.is_(None),
        )
    )

    if membership is None:
        raise TicketServiceError(
            f"The selected {field_name} must be an active member of this project.",
            400,
        )

    return user


def _validate_parent_ticket(
    db: Session,
    *,
    project_id: UUID,
    parent_ticket_id: UUID,
    ticket_id: UUID | None = None,
) -> Ticket:
    if ticket_id is not None and parent_ticket_id == ticket_id:
        raise TicketServiceError("A ticket cannot be its own parent.", 400)

    parent = db.scalar(
        select(Ticket).where(
            Ticket.id == parent_ticket_id,
            Ticket.project_id == project_id,
            Ticket.deleted_at.is_(None),
        )
    )

    if parent is None:
        raise TicketServiceError(
            "Parent ticket must be an active ticket in the same project.",
            400,
        )

    if parent.type == "SUBTASK":
        raise TicketServiceError("A subtask cannot be a parent ticket.", 400)

    return parent


def _json_value(value: object | None) -> object | None:
    """Convert Python values to JSON-safe values for activity history."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, (UUID, Decimal)):
        return str(value)

    if isinstance(value, list):
        return [_json_value(item) for item in value]

    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}

    return value


def _add_activity(
    db: Session,
    *,
    ticket_id: UUID,
    actor_id: UUID,
    action: str,
    field_name: str | None = None,
    old_value: object | None = None,
    new_value: object | None = None,
    description: str | None = None,
) -> None:
    db.add(
        TicketActivity(
            ticket_id=ticket_id,
            actor_user_id=actor_id,
            action=action,
            field_name=field_name,
            old_value=_json_value(old_value),
            new_value=_json_value(new_value),
            description=description,
        )
    )


def create_ticket(
    db: Session,
    *,
    actor: User,
    data: TicketCreateRequest,
) -> Ticket:
    """Create a ticket and its initial activity record."""
    if actor.role.code not in {"ADMIN", "PM"}:
        raise TicketServiceError(
            "Only Administrators and Project Managers can create tickets.",
            403,
        )

    # Lock the project row while allocating its next ticket number.
    project = db.scalar(select(Project).where(Project.id == data.project_id).with_for_update())

    if project is None:
        raise TicketServiceError("Project not found.", 404)

    if project.archived_at is not None or project.status == "ARCHIVED":
        raise TicketServiceError("Archived projects cannot receive tickets.", 409)

    _ensure_project_management_access(project=project, actor=actor)

    for field_name, user_id in (
        ("assignee", data.assignee_id),
        ("reviewer", data.reviewer_id),
        ("tester", data.tester_id),
    ):
        if user_id is not None:
            _validate_project_user(
                db,
                project=project,
                user_id=user_id,
                field_name=field_name,
            )

    if data.parent_ticket_id is not None:
        _validate_parent_ticket(
            db,
            project_id=project.id,
            parent_ticket_id=data.parent_ticket_id,
        )

    next_number = (
        db.scalar(
            select(func.coalesce(func.max(Ticket.number), 0) + 1).where(
                Ticket.project_id == project.id
            )
        )
        or 1
    )

    ticket_key = f"{project.key}-{next_number}"

    ticket = Ticket(
        project_id=project.id,
        number=next_number,
        ticket_key=ticket_key,
        title=data.title,
        description=data.description,
        type=data.type,
        priority=data.priority,
        status="BACKLOG",
        reporter_id=actor.id,
        assignee_id=data.assignee_id,
        reviewer_id=data.reviewer_id,
        tester_id=data.tester_id,
        start_date=data.start_date,
        due_date=data.due_date,
        estimated_effort=data.estimated_effort,
        labels=data.labels,
        parent_ticket_id=data.parent_ticket_id,
    )

    db.add(ticket)
    db.flush()

    _add_activity(
        db,
        ticket_id=ticket.id,
        actor_id=actor.id,
        action="CREATED",
        new_value={
            "ticket_key": ticket_key,
            "status": "BACKLOG",
            "title": ticket.title,
        },
        description=f"Ticket {ticket_key} created.",
    )

    for field_name, user_id in (
        ("assignee_id", data.assignee_id),
        ("reviewer_id", data.reviewer_id),
        ("tester_id", data.tester_id),
    ):
        if user_id is not None:
            _add_activity(
                db,
                ticket_id=ticket.id,
                actor_id=actor.id,
                action="ASSIGNED",
                field_name=field_name,
                new_value=str(user_id),
            )

    db.commit()
    return get_ticket(db, ticket.id)


def list_tickets(
    db: Session,
    *,
    current_user: User,
    project_id: UUID | None,
    status_filter: str | None,
    priority_filter: str | None,
    type_filter: str | None,
    assignee_id: UUID | None,
    search: str | None,
    sort_by: str,
    sort_order: str,
    page: int,
    page_size: int,
) -> tuple[list[Ticket], int]:
    """List tickets visible to the current user with filters and pagination."""
    filters = [
        Ticket.deleted_at.is_(None),
        Project.archived_at.is_(None),
    ]

    if project_id is not None:
        filters.append(Ticket.project_id == project_id)

    if current_user.role.code == "PM":
        filters.append(Project.project_manager_id == current_user.id)

    elif current_user.role.code != "ADMIN":
        filters.append(
            select(ProjectMember.id)
            .where(
                ProjectMember.project_id == Ticket.project_id,
                ProjectMember.user_id == current_user.id,
                ProjectMember.removed_at.is_(None),
            )
            .exists()
        )

    if status_filter:
        filters.append(Ticket.status == status_filter)

    if priority_filter:
        filters.append(Ticket.priority == priority_filter)

    if type_filter:
        filters.append(Ticket.type == type_filter)

    if assignee_id is not None:
        filters.append(Ticket.assignee_id == assignee_id)

    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Ticket.ticket_key.ilike(term),
                Ticket.title.ilike(term),
            )
        )

    base_query = select(Ticket).join(Project, Project.id == Ticket.project_id).where(*filters)

    total = (
        db.scalar(
            select(func.count(Ticket.id))
            .select_from(Ticket)
            .join(Project, Project.id == Ticket.project_id)
            .where(*filters)
        )
        or 0
    )

    sort_columns = {
        "created_at": Ticket.created_at,
        "updated_at": Ticket.updated_at,
        "due_date": Ticket.due_date,
        "priority": Ticket.priority,
        "title": Ticket.title,
        "number": Ticket.number,
    }

    sort_column = sort_columns.get(sort_by, Ticket.updated_at)
    ordering = sort_column.asc() if sort_order == "asc" else sort_column.desc()

    tickets = list(
        db.scalars(
            base_query.options(*_ticket_options())
            .order_by(ordering, Ticket.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )

    return tickets, total


def update_ticket(
    db: Session,
    *,
    ticket_id: UUID,
    actor: User,
    data: TicketUpdateRequest,
) -> Ticket:
    """Update ticket fields without allowing a status change."""
    ticket = get_ticket(db, ticket_id)
    project = _get_active_project(db, ticket.project_id)
    _ensure_project_management_access(project=project, actor=actor)

    changes = data.model_dump(exclude_unset=True)

    start_date = changes.get("start_date", ticket.start_date)
    due_date = changes.get("due_date", ticket.due_date)

    if start_date is not None and due_date is not None and due_date < start_date:
        raise TicketServiceError("Ticket due date cannot be before its start date.", 400)

    for field_name in ("assignee_id", "reviewer_id", "tester_id"):
        if field_name in changes and changes[field_name] is not None:
            _validate_project_user(
                db,
                project=project,
                user_id=changes[field_name],
                field_name=field_name.removesuffix("_id"),
            )

    if changes.get("parent_ticket_id") is not None:
        _validate_parent_ticket(
            db,
            project_id=project.id,
            parent_ticket_id=changes["parent_ticket_id"],
            ticket_id=ticket.id,
        )

    for field_name, new_value in changes.items():
        old_value = getattr(ticket, field_name)

        if old_value == new_value:
            continue

        setattr(ticket, field_name, new_value)

        is_assignment_change = field_name in {
            "assignee_id",
            "reviewer_id",
            "tester_id",
        }

        _add_activity(
            db,
            ticket_id=ticket.id,
            actor_id=actor.id,
            action="ASSIGNED" if is_assignment_change else "UPDATED",
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            description=("Ticket assignment changed." if is_assignment_change else None),
        )

    db.commit()
    return get_ticket(db, ticket.id)


def update_ticket_status(
    db: Session,
    *,
    ticket_id: UUID,
    actor: User,
    new_status: str,
    reason: str | None = None,
) -> Ticket:
    """Apply the approved workflow and record the status change."""
    ticket = get_ticket(db, ticket_id)
    project = _get_active_project(db, ticket.project_id)

    _ensure_project_access(db, project=project, actor=actor)

    current_status = ticket.status
    role_code = actor.role.code
    reason = reason.strip() if reason and reason.strip() else None

    if current_status == new_status:
        raise TicketServiceError("Ticket is already in that status.", 409)

    # The approved workflow requires explanations for exception transitions.
    if new_status in {"BLOCKED", "REOPENED", "CANCELLED"} and not reason:
        raise TicketServiceError(
            f"A reason is required when moving a ticket to {new_status}.",
            400,
        )

    if current_status == "BLOCKED" and not reason:
        raise TicketServiceError(
            "A reason is required when unblocking a ticket.",
            400,
        )

    if (
        role_code == "TESTER"
        and current_status == "TESTING"
        and new_status == "IN_PROGRESS"
        and not reason
    ):
        raise TicketServiceError(
            "A comment is required when returning failed testing to development.",
            400,
        )

    allowed = False

    if role_code == "ADMIN":
        allowed = True

    elif role_code == "PM":
        _ensure_project_management_access(project=project, actor=actor)
        allowed = True

    # The assigned reviewer may approve IN_REVIEW work for testing.
    elif (
        current_status == "IN_REVIEW" and new_status == "TESTING" and ticket.reviewer_id == actor.id
    ):
        allowed = True

    elif role_code == "DEVELOPER":
        if ticket.assignee_id != actor.id:
            raise TicketServiceError(
                "Developers can only transition tickets assigned to them.",
                403,
            )

        allowed_transitions = {
            "TODO": {"IN_PROGRESS"},
            "IN_PROGRESS": {"IN_REVIEW"},
            "REOPENED": {"IN_PROGRESS"},
        }
        allowed = new_status in allowed_transitions.get(current_status, set())

    elif role_code == "TESTER":
        if ticket.tester_id != actor.id:
            raise TicketServiceError(
                "Testers can only transition tickets assigned to them for testing.",
                403,
            )

        allowed_transitions = {
            "TESTING": {
                "TESTING_DONE",
                "BUG_FIXED",
                "REOPENED",
                "IN_PROGRESS",
            },
        }
        allowed = new_status in allowed_transitions.get(current_status, set())

    if not allowed:
        raise TicketServiceError(
            f"Role {role_code} cannot move a ticket from {current_status} to {new_status}.",
            403,
        )

    old_status = ticket.status
    ticket.status = new_status

    if new_status == "COMPLETED":
        ticket.completed_at = datetime.now(UTC)
        ticket.completed_by_user_id = actor.id
        ticket.completed_by = actor
    elif old_status == "COMPLETED":
        ticket.completed_at = None
        ticket.completed_by_user_id = None
        ticket.completed_by = None

    _add_activity(
        db,
        ticket_id=ticket.id,
        actor_id=actor.id,
        action="STATUS_CHANGED",
        field_name="status",
        old_value=old_status,
        new_value=new_status,
        description=reason,
    )

    db.commit()
    return get_ticket(db, ticket.id)


def delete_ticket(
    db: Session,
    *,
    ticket_id: UUID,
    actor: User,
) -> datetime:
    """Soft-delete a ticket while preserving its history."""
    ticket = get_ticket(db, ticket_id)
    project = _get_active_project(db, ticket.project_id)

    _ensure_project_management_access(project=project, actor=actor)

    deleted_at = datetime.now(UTC)
    ticket.deleted_at = deleted_at

    _add_activity(
        db,
        ticket_id=ticket.id,
        actor_id=actor.id,
        action="DELETED",
        field_name="deleted_at",
        new_value=deleted_at,
        description="Ticket soft-deleted.",
    )

    db.commit()
    return deleted_at
