from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import String, case, cast, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    Project,
    ProjectMember,
    SprintTicket,
    Team,
    Ticket,
    TicketActivity,
    User,
)
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
        selectinload(Ticket.assignees).joinedload(User.role),
        selectinload(Ticket.reviewers).joinedload(User.role),
        selectinload(Ticket.testers).joinedload(User.role),
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

    if actor.role.code == "PM" and (
        project.project_manager_id == actor.id
        or any(manager.id == actor.id for manager in project.project_managers)
    ):
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

    if actor.role.code == "PM" and (
        project.project_manager_id == actor.id
        or any(manager.id == actor.id for manager in project.project_managers)
    ):
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

    if user.id == project.project_manager_id or any(
        manager.id == user.id for manager in project.project_managers
    ):
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

    assignment_ids = {
        "assignees": data.assignee_ids or ([data.assignee_id] if data.assignee_id else []),
        "reviewers": data.reviewer_ids or ([data.reviewer_id] if data.reviewer_id else []),
        "testers": data.tester_ids or ([data.tester_id] if data.tester_id else []),
    }
    assignment_users: dict[str, list[User]] = {}
    for relationship_name, user_ids in assignment_ids.items():
        field_name = relationship_name.removesuffix("s")
        assignment_users[relationship_name] = [
            _validate_project_user(
                db,
                project=project,
                user_id=user_id,
                field_name=field_name,
            )
            for user_id in user_ids
        ]

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
        status=data.status,
        reporter_id=actor.id,
        completed_at=datetime.now(UTC) if data.status == "COMPLETED" else None,
        completed_by_user_id=actor.id if data.status == "COMPLETED" else None,
        assignee_id=assignment_ids["assignees"][0] if assignment_ids["assignees"] else None,
        reviewer_id=assignment_ids["reviewers"][0] if assignment_ids["reviewers"] else None,
        tester_id=assignment_ids["testers"][0] if assignment_ids["testers"] else None,
        start_date=data.start_date,
        due_date=data.due_date,
        estimated_effort=data.estimated_effort,
        labels=data.labels,
        parent_ticket_id=data.parent_ticket_id,
    )

    db.add(ticket)
    db.flush()
    ticket.assignees = assignment_users["assignees"]
    ticket.reviewers = assignment_users["reviewers"]
    ticket.testers = assignment_users["testers"]

    _add_activity(
        db,
        ticket_id=ticket.id,
        actor_id=actor.id,
        action="CREATED",
        new_value={
            "ticket_key": ticket_key,
            "status": data.status,
            "title": ticket.title,
        },
        description=f"Ticket {ticket_key} created.",
    )

    for relationship_name, user_ids in assignment_ids.items():
        if user_ids:
            _add_activity(
                db,
                ticket_id=ticket.id,
                actor_id=actor.id,
                action="ASSIGNED",
                field_name=relationship_name,
                new_value=[str(user_id) for user_id in user_ids],
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
    assignee_unassigned: bool,
    reporter_id: UUID | None,
    team_id: UUID | None,
    due_date_from: date | None,
    due_date_to: date | None,
    created_date_from: date | None,
    created_date_to: date | None,
    label: str | None,
    sprint_id: UUID | None,
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
        filters.append(
            or_(
                Project.project_manager_id == current_user.id,
                Project.project_managers.any(User.id == current_user.id),
            )
        )

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

    if assignee_unassigned:
        filters.append(Ticket.assignee_id.is_(None) & ~Ticket.assignees.any())
    elif assignee_id is not None:
        filters.append(
            or_(
                Ticket.assignee_id == assignee_id,
                Ticket.assignees.any(User.id == assignee_id),
            )
        )

    if reporter_id is not None:
        filters.append(Ticket.reporter_id == reporter_id)

    if team_id is not None:
        filters.append(or_(Project.team_id == team_id, Project.teams.any(Team.id == team_id)))

    if due_date_from is not None:
        filters.append(Ticket.due_date >= due_date_from)

    if due_date_to is not None:
        filters.append(Ticket.due_date <= due_date_to)

    if created_date_from is not None:
        filters.append(
            Ticket.created_at
            >= datetime.combine(created_date_from, datetime.min.time(), tzinfo=UTC)
        )

    if created_date_to is not None:
        filters.append(
            Ticket.created_at
            < datetime.combine(
                created_date_to + timedelta(days=1),
                datetime.min.time(),
                tzinfo=UTC,
            )
        )

    if label and label.strip():
        escaped_label = label.strip().replace("\\", "\\\\").replace('"', '\\"')
        filters.append(cast(Ticket.labels, String).ilike(f'%"{escaped_label}"%'))

    if sprint_id is not None:
        filters.append(
            select(SprintTicket.id)
            .where(
                SprintTicket.ticket_id == Ticket.id,
                SprintTicket.sprint_id == sprint_id,
            )
            .exists()
        )

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

    priority_order = case(
        (Ticket.priority == "LOW", 1),
        (Ticket.priority == "MEDIUM", 2),
        (Ticket.priority == "HIGH", 3),
        (Ticket.priority == "CRITICAL", 4),
        else_=0,
    )
    sort_columns = {
        "created_at": Ticket.created_at,
        "updated_at": Ticket.updated_at,
        "due_date": Ticket.due_date,
        "priority": priority_order,
        "title": Ticket.title,
        "number": Ticket.number,
    }

    sort_column = sort_columns.get(sort_by, Ticket.updated_at)
    ordering = sort_column.asc() if sort_order == "asc" else sort_column.desc()
    if sort_by == "due_date":
        ordering = ordering.nullslast()

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

    assignment_fields = {
        "assignee_ids": ("assignees", "assignee_id", "assignee"),
        "reviewer_ids": ("reviewers", "reviewer_id", "reviewer"),
        "tester_ids": ("testers", "tester_id", "tester"),
    }
    for plural_field, (relationship_name, legacy_field, field_name) in assignment_fields.items():
        if plural_field in changes:
            user_ids = changes.pop(plural_field) or []
            changes.pop(legacy_field, None)
        elif legacy_field in changes:
            legacy_id = changes.pop(legacy_field)
            user_ids = [legacy_id] if legacy_id is not None else []
        else:
            continue

        users = [
            _validate_project_user(
                db,
                project=project,
                user_id=user_id,
                field_name=field_name,
            )
            for user_id in user_ids
        ]
        previous_users = getattr(ticket, relationship_name) or (
            [getattr(ticket, field_name)] if getattr(ticket, field_name) else []
        )
        old_ids = [str(user.id) for user in previous_users]
        new_ids = [str(user.id) for user in users]

        if old_ids == new_ids:
            continue

        setattr(ticket, relationship_name, users)
        setattr(ticket, legacy_field, users[0].id if users else None)
        _add_activity(
            db,
            ticket_id=ticket.id,
            actor_id=actor.id,
            action="ASSIGNED",
            field_name=relationship_name,
            old_value=old_ids,
            new_value=new_ids,
            description="Ticket assignment changed.",
        )

    for field_name, new_value in changes.items():
        old_value = getattr(ticket, field_name)
        if old_value == new_value:
            continue

        setattr(ticket, field_name, new_value)
        _add_activity(
            db,
            ticket_id=ticket.id,
            actor_id=actor.id,
            action="UPDATED",
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
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
        current_status == "IN_REVIEW"
        and new_status == "TESTING"
        and (
            ticket.reviewer_id == actor.id
            or any(user.id == actor.id for user in ticket.reviewers)
        )
    ):
        allowed = True

    elif role_code == "DEVELOPER":
        if ticket.assignee_id != actor.id and not any(
            user.id == actor.id for user in ticket.assignees
        ):
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
        if ticket.tester_id != actor.id and not any(user.id == actor.id for user in ticket.testers):
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
