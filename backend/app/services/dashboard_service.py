from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Text, and_, cast, distinct, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Project, ProjectMember, Team, Ticket, TicketActivity, User

TERMINAL_STATUSES = {"COMPLETED", "CANCELLED"}
UPCOMING_WINDOW_DAYS = 30
RECENT_ACTIVITY_LIMIT = 10
UPCOMING_DEADLINE_LIMIT = 8


def _count(db: Session, model, *conditions) -> int:
    statement = select(func.count()).select_from(model)
    if conditions:
        statement = statement.where(*conditions)
    return int(db.scalar(statement) or 0)


def _project_scope(current_user: User):
    """Return active project visibility conditions for the user's role."""
    role_code = current_user.role.code
    if role_code == "ADMIN":
        return []

    active_projects = [
        Project.archived_at.is_(None),
        Project.status != "ARCHIVED",
    ]
    if role_code == "PM":
        return [Project.project_manager_id == current_user.id, *active_projects]

    member_project_ids = select(ProjectMember.project_id).where(
        ProjectMember.user_id == current_user.id,
        ProjectMember.removed_at.is_(None),
    )
    return [Project.id.in_(member_project_ids), *active_projects]


def _ticket_scope(current_user: User):
    """Return the ticket population visible to the current role."""
    conditions = [Ticket.deleted_at.is_(None)]
    if current_user.role.code != "ADMIN":
        conditions.extend(_project_scope(current_user))
    return conditions


def _ticket_count(db: Session, conditions, *extra_conditions) -> int:
    statement = (
        select(func.count(Ticket.id))
        .select_from(Ticket)
        .join(Project, Project.id == Ticket.project_id)
        .where(*conditions, *extra_conditions)
    )
    return int(db.scalar(statement) or 0)


def _metric(key: str, title: str, value: int | float, description: str) -> dict:
    return {"key": key, "title": title, "value": value, "description": description}


def _project_metrics(
    db: Session,
    current_user: User,
    *,
    include_planning_and_on_hold: bool = False,
) -> list[dict]:
    """Return the existing project KPIs within the user's project visibility scope."""
    project_conditions = _project_scope(current_user)
    is_project_manager = current_user.role.code == "PM"
    assigned_description = (
        "Projects managed by you"
        if is_project_manager
        else "Projects where you are an active member"
    )

    assigned_projects = _count(db, Project, *project_conditions)
    active_projects = _count(
        db, Project, *project_conditions, Project.status == "ACTIVE"
    )
    completed_projects = _count(
        db, Project, *project_conditions, Project.status == "COMPLETED"
    )

    metrics = [
        _metric(
            "assigned_projects",
            "Assigned projects",
            assigned_projects,
            assigned_description,
        ),
        _metric(
            "active_projects",
            "Active projects",
            active_projects,
            "Projects currently in progress",
        ),
    ]

    if include_planning_and_on_hold:
        planning_projects = _count(
            db, Project, *project_conditions, Project.status == "PLANNING"
        )
        on_hold_projects = _count(
            db, Project, *project_conditions, Project.status == "ON_HOLD"
        )
        metrics.extend(
            [
                _metric(
                    "planning_projects",
                    "Planning projects",
                    planning_projects,
                    "Projects currently in planning",
                ),
                _metric(
                    "on_hold_projects",
                    "On-hold projects",
                    on_hold_projects,
                    "Projects currently on hold",
                ),
            ]
        )

    metrics.append(
        _metric(
            "completed_projects",
            "Completed projects",
            completed_projects,
            "Projects marked as completed",
        )
    )
    return metrics


def _serialize_project(project: Project) -> dict:
    active_members = [
        membership for membership in project.memberships
        if membership.removed_at is None
    ]
    return {
        "id": project.id,
        "name": project.name,
        "key": project.key,
        "status": project.status,
        "start_date": project.start_date,
        "end_date": project.end_date,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "team_name": project.team.name,
        "project_manager_name": project.project_manager.full_name,
        "member_count": len(active_members),
    }


def serialize_activity(activity: TicketActivity) -> dict:
    ticket = activity.ticket
    project = ticket.project
    return {
        "id": activity.id,
        "ticket_id": ticket.id,
        "ticket_key": ticket.ticket_key,
        "ticket_title": ticket.title,
        "project_id": project.id,
        "project_name": project.name,
        "actor_name": activity.actor.full_name,
        "action": activity.action,
        "description": activity.description,
        "created_at": activity.created_at,
    }


def serialize_deadline(ticket: Ticket) -> dict:
    return {
        "ticket_id": ticket.id,
        "ticket_key": ticket.ticket_key,
        "title": ticket.title,
        "project_id": ticket.project.id,
        "project_name": ticket.project.name,
        "due_date": ticket.due_date,
        "status": ticket.status,
        "priority": ticket.priority,
        "assignee_name": ticket.assignee.full_name if ticket.assignee else None,
        "tester_name": ticket.tester.full_name if ticket.tester else None,
    }


def _recent_activities(db: Session, conditions: list) -> list[dict]:
    statement = (
        select(TicketActivity)
        .join(Ticket, Ticket.id == TicketActivity.ticket_id)
        .join(Project, Project.id == Ticket.project_id)
        .options(
            joinedload(TicketActivity.ticket).joinedload(Ticket.project),
            joinedload(TicketActivity.actor),
        )
        .where(*conditions)
        .order_by(TicketActivity.created_at.desc(), TicketActivity.id.desc())
        .limit(RECENT_ACTIVITY_LIMIT)
    )
    rows = db.scalars(statement).unique().all()
    return [serialize_activity(row) for row in rows]


def _upcoming_deadline_count(db: Session, conditions: list, *, today: date) -> int:
    end_date = today + timedelta(days=UPCOMING_WINDOW_DAYS)
    return _ticket_count(
        db,
        conditions,
        Ticket.due_date.is_not(None),
        Ticket.due_date >= today,
        Ticket.due_date <= end_date,
        Ticket.status.not_in(tuple(TERMINAL_STATUSES)),
    )


def _upcoming_deadlines(db: Session, conditions: list, *, today: date) -> list[dict]:
    end_date = today + timedelta(days=UPCOMING_WINDOW_DAYS)
    statement = (
        select(Ticket)
        .join(Project, Project.id == Ticket.project_id)
        .options(
            joinedload(Ticket.project),
            joinedload(Ticket.assignee),
            joinedload(Ticket.tester),
        )
        .where(
            *conditions,
            Ticket.due_date.is_not(None),
            Ticket.due_date >= today,
            Ticket.due_date <= end_date,
            Ticket.status.not_in(tuple(TERMINAL_STATUSES)),
        )
        .order_by(Ticket.due_date.asc(), Ticket.updated_at.desc())
        .limit(UPCOMING_DEADLINE_LIMIT)
    )
    return [serialize_deadline(ticket) for ticket in db.scalars(statement).unique().all()]


def _team_workload(db: Session, current_user: User, today: date) -> list[dict]:
    open_condition = and_(
        Ticket.id.is_not(None),
        Ticket.status.not_in(tuple(TERMINAL_STATUSES)),
    )
    overdue_condition = and_(
        Ticket.id.is_not(None),
        Ticket.due_date.is_not(None),
        Ticket.due_date < today,
        Ticket.status.not_in(tuple(TERMINAL_STATUSES)),
    )
    statement = (
        select(
            Team.id.label("team_id"),
            Team.name.label("team_name"),
            func.count(distinct(Project.id)).label("project_count"),
            func.count(Ticket.id).filter(open_condition).label("open_tickets"),
            func.count(Ticket.id).filter(overdue_condition).label("overdue_tickets"),
        )
        .select_from(Project)
        .join(Team, Team.id == Project.team_id)
        .outerjoin(
            Ticket,
            and_(
                Ticket.project_id == Project.id,
                Ticket.deleted_at.is_(None),
            ),
        )
        .where(
            Project.project_manager_id == current_user.id,
            Project.archived_at.is_(None),
            Project.status != "ARCHIVED",
            Team.archived_at.is_(None),
        )
        .group_by(Team.id, Team.name)
        .order_by(Team.name.asc())
    )
    return [
        {
            "team_id": row.team_id,
            "team_name": row.team_name,
            "project_count": int(row.project_count or 0),
            "open_tickets": int(row.open_tickets or 0),
            "overdue_tickets": int(row.overdue_tickets or 0),
        }
        for row in db.execute(statement).all()
    ]


def _reopened_ticket_history_count(db: Session, assigned_scope: list) -> int:
    """Count distinct assigned tickets with a recorded transition into REOPENED."""
    if db.get_bind().dialect.name == "sqlite":
        reopened_value = func.json_extract(TicketActivity.new_value, "$") == "REOPENED"
    else:
        reopened_value = cast(TicketActivity.new_value, Text) == '"REOPENED"'

    statement = (
        select(func.count(distinct(TicketActivity.ticket_id)))
        .select_from(TicketActivity)
        .join(Ticket, Ticket.id == TicketActivity.ticket_id)
        .join(Project, Project.id == Ticket.project_id)
        .where(
            *assigned_scope,
            TicketActivity.action == "STATUS_CHANGED",
            TicketActivity.field_name == "status",
            reopened_value,
        )
    )
    return int(db.scalar(statement) or 0)


def get_dashboard(db: Session, current_user: User) -> dict:
    role_code = current_user.role.code
    today = datetime.now(UTC).date()
    ticket_scope = _ticket_scope(current_user)
    open_condition = Ticket.status.not_in(tuple(TERMINAL_STATUSES))
    overdue_condition = and_(
        Ticket.due_date.is_not(None),
        Ticket.due_date < today,
        open_condition,
    )

    metrics: list[dict] = []
    team_distribution: list[dict] = []
    team_workload: list[dict] = []
    upcoming_deadlines: list[dict] = []

    if role_code == "ADMIN":
        total_users = _count(db, User)
        active_users = _count(db, User, User.is_active.is_(True))
        total_teams = _count(db, Team, Team.archived_at.is_(None))
        total_projects = _count(db, Project)
        active_projects = _count(
            db, Project, Project.archived_at.is_(None), Project.status == "ACTIVE"
        )
        completed_projects = _count(
            db, Project, Project.archived_at.is_(None), Project.status == "COMPLETED"
        )
        total_tickets = _ticket_count(db, ticket_scope)
        pending_tickets = _ticket_count(db, ticket_scope, open_condition)
        completed_tickets = _ticket_count(db, ticket_scope, Ticket.status == "COMPLETED")
        overdue_tickets = _ticket_count(db, ticket_scope, overdue_condition)

        metrics = [
            _metric("total_users", "Total users", total_users, "All registered user accounts"),
            _metric("active_users", "Active users", active_users, "Currently active user accounts"),
            _metric("total_teams", "Total teams", total_teams, "Teams that have not been archived"),
            _metric(
                "total_projects",
                "Total projects",
                total_projects,
                "Including archived projects",
            ),
            _metric(
                "active_projects",
                "Active projects",
                active_projects,
                "Projects currently in progress",
            ),
            _metric(
                "completed_projects",
                "Completed projects",
                completed_projects,
                "Projects marked as completed",
            ),
            _metric("total_tickets", "Total tickets", total_tickets, "All non-deleted tickets"),
            _metric(
                "pending_tickets",
                "Pending tickets",
                pending_tickets,
                "Tickets not completed or cancelled",
            ),
            _metric(
                "completed_tickets",
                "Completed tickets",
                completed_tickets,
                "Tickets in Completed status",
            ),
            _metric(
                "overdue_tickets",
                "Overdue tickets",
                overdue_tickets,
                "Open tickets past their due date",
            ),
        ]

        distribution_statement = (
            select(
                Team.id,
                Team.name,
                func.count(Project.id).label("project_count"),
            )
            .outerjoin(
                Project,
                (
                    (Project.team_id == Team.id)
                    & Project.archived_at.is_(None)
                    & (Project.status != "ARCHIVED")
                ),
            )
            .where(Team.archived_at.is_(None))
            .group_by(Team.id, Team.name)
            .order_by(Team.name)
        )
        team_distribution = [
            {
                "team_id": row.id,
                "team_name": row.name,
                "project_count": int(row.project_count or 0),
            }
            for row in db.execute(distribution_statement).all()
        ]

    elif role_code == "PM":
        total_tickets = _ticket_count(db, ticket_scope)
        completed_tickets = _ticket_count(db, ticket_scope, Ticket.status == "COMPLETED")
        open_tickets = _ticket_count(db, ticket_scope, open_condition)
        in_progress_tickets = _ticket_count(db, ticket_scope, Ticket.status == "IN_PROGRESS")
        overdue_tickets = _ticket_count(db, ticket_scope, overdue_condition)
        completion_percentage = (
            round((completed_tickets / total_tickets) * 100, 1)
            if total_tickets
            else 0.0
        )
        metrics = _project_metrics(
            db, current_user, include_planning_and_on_hold=True
        ) + [
            _metric(
                "project_completion",
                "Project completion",
                completion_percentage,
                "Completed tickets as a percentage of all project tickets",
            ),
            _metric(
                "total_tickets",
                "Total tickets",
                total_tickets,
                "Tickets across projects you manage",
            ),
            _metric(
                "open_tickets",
                "Open tickets",
                open_tickets,
                "Tickets not completed or cancelled",
            ),
            _metric(
                "in_progress_tickets",
                "In-progress tickets",
                in_progress_tickets,
                "Tickets currently in development",
            ),
            _metric(
                "completed_tickets",
                "Completed tickets",
                completed_tickets,
                "Tickets in Completed status",
            ),
            _metric(
                "overdue_tickets",
                "Overdue tickets",
                overdue_tickets,
                "Open tickets past their due date",
            ),
        ]
        team_workload = _team_workload(db, current_user, today)
        upcoming_deadlines = _upcoming_deadlines(db, ticket_scope, today=today)

    elif role_code == "DEVELOPER":
        assigned_scope = [*ticket_scope, Ticket.assignee_id == current_user.id]
        my_assigned = _ticket_count(db, assigned_scope)
        my_pending = _ticket_count(db, assigned_scope, open_condition)
        in_progress = _ticket_count(db, assigned_scope, Ticket.status == "IN_PROGRESS")
        awaiting_review = _ticket_count(db, assigned_scope, Ticket.status == "IN_REVIEW")
        completed = _ticket_count(db, assigned_scope, Ticket.status == "COMPLETED")
        overdue = _ticket_count(db, assigned_scope, overdue_condition)
        upcoming_deadlines = _upcoming_deadlines(db, assigned_scope, today=today)
        upcoming_deadline_count = _upcoming_deadline_count(db, assigned_scope, today=today)
        metrics = _project_metrics(db, current_user) + [
            _metric(
                "my_assigned_tickets",
                "My assigned tickets",
                my_assigned,
                "Tickets currently assigned to you",
            ),
            _metric(
                "my_pending_tickets",
                "My pending tickets",
                my_pending,
                "Assigned tickets not completed or cancelled",
            ),
            _metric(
                "in_progress_tickets",
                "In-progress tickets",
                in_progress,
                "Your tickets in development",
            ),
            _metric(
                "tickets_awaiting_review",
                "Tickets awaiting review",
                awaiting_review,
                "Your tickets currently in review",
            ),
            _metric(
                "completed_tickets",
                "Completed tickets",
                completed,
                "Your tickets in Completed status",
            ),
            _metric(
                "upcoming_deadlines",
                "Upcoming deadlines",
                upcoming_deadline_count,
                "Assigned tickets due in the next 30 days",
            ),
            _metric(
                "overdue_tasks",
                "Overdue tasks",
                overdue,
                "Assigned open tickets past their due date",
            ),
        ]

    elif role_code == "TESTER":
        assigned_scope = [*ticket_scope, Ticket.tester_id == current_user.id]
        assigned_testing = _ticket_count(db, assigned_scope)
        testing_queue = _ticket_count(db, assigned_scope, Ticket.status == "TESTING")
        passed = _ticket_count(db, assigned_scope, Ticket.status == "TESTING_DONE")
        # Approved business rule: current REOPENED tickets count as failed.
        failed = _ticket_count(db, assigned_scope, Ticket.status == "REOPENED")
        pending_testing = _ticket_count(
            db,
            assigned_scope,
            Ticket.status.not_in(("TESTING_DONE", "BUG_FIXED", "COMPLETED", "CANCELLED")),
        )
        bugs_reported = _ticket_count(db, ticket_scope, Ticket.type == "BUG")

        # Reopened = distinct assigned tickets that have ever entered REOPENED.
        # Failed = tickets whose current state is REOPENED (the agreed KPI definition).
        reopened_history = _reopened_ticket_history_count(db, assigned_scope)
        upcoming_deadlines = _upcoming_deadlines(db, assigned_scope, today=today)
        upcoming_testing_deadline_count = _upcoming_deadline_count(
            db, assigned_scope, today=today
        )
        metrics = _project_metrics(db, current_user) + [
            _metric(
                "assigned_testing_tickets",
                "Assigned testing tickets",
                assigned_testing,
                "Tickets assigned to you as tester",
            ),
            _metric(
                "testing_queue",
                "Testing queue",
                testing_queue,
                "Assigned tickets currently in Testing",
            ),
            _metric("passed_tickets", "Passed tickets", passed, "Tickets marked Testing done"),
            _metric(
                "failed_tickets",
                "Failed tickets",
                failed,
                "Tickets currently in Reopened status",
            ),
            _metric(
                "reopened_tickets",
                "Reopened tickets",
                reopened_history,
                "Assigned tickets that have entered Reopened at least once",
            ),
            _metric(
                "bugs_reported",
                "Bugs reported",
                bugs_reported,
                "Bug-type tickets in your accessible projects",
            ),
            _metric(
                "pending_testing",
                "Pending testing",
                pending_testing,
                "Assigned tickets not yet passed, fixed, completed or cancelled",
            ),
            _metric(
                "upcoming_testing_deadlines",
                "Upcoming testing deadlines",
                upcoming_testing_deadline_count,
                "Assigned testing tickets due in the next 30 days",
            ),
        ]

    else:
        raise ValueError(f"Unsupported dashboard role: {role_code}")

    visible_project_conditions = [
        *_project_scope(current_user),
        Project.archived_at.is_(None),
        Project.status != "ARCHIVED",
    ]
    project_statement = (
        select(Project)
        .options(
            joinedload(Project.team),
            joinedload(Project.project_manager),
            selectinload(Project.memberships),
        )
        .where(*visible_project_conditions)
        .order_by(Project.updated_at.desc())
        .limit(6)
    )
    projects = db.scalars(project_statement).unique().all()

    activity_scope = ticket_scope
    if role_code == "DEVELOPER":
        activity_scope = [*ticket_scope, Ticket.assignee_id == current_user.id]
    elif role_code == "TESTER":
        activity_scope = [*ticket_scope, Ticket.tester_id == current_user.id]

    recent_activities = _recent_activities(db, activity_scope)
    return {
        "role_code": role_code,
        "metrics": metrics,
        "projects": [_serialize_project(project) for project in projects],
        "team_project_distribution": team_distribution,
        "recent_activities": recent_activities,
        "upcoming_deadlines": upcoming_deadlines,
        "team_workload": team_workload,
    }
