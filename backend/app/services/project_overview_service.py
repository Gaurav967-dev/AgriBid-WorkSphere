from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Project, Ticket, TicketActivity
from app.services.dashboard_service import serialize_activity, serialize_deadline

TICKET_STATUSES = (
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
)
TERMINAL_STATUSES = ("COMPLETED", "CANCELLED")


def get_project_overview(db: Session, project: Project) -> dict:
    """Return project-level ticket analytics, activity and upcoming deadlines."""
    status_rows = db.execute(
        select(Ticket.status, func.count(Ticket.id))
        .where(
            Ticket.project_id == project.id,
            Ticket.deleted_at.is_(None),
        )
        .group_by(Ticket.status)
    ).all()
    counts = {status: int(count) for status, count in status_rows}
    total_tickets = sum(counts.values())
    completed_tickets = counts.get("COMPLETED", 0)
    completion_percentage = (
        round((completed_tickets / total_tickets) * 100, 1)
        if total_tickets
        else 0.0
    )

    ticket_distribution = [
        {"status": status, "count": counts.get(status, 0)}
        for status in TICKET_STATUSES
    ]

    activity_rows = db.scalars(
        select(TicketActivity)
        .join(Ticket, Ticket.id == TicketActivity.ticket_id)
        .options(
            joinedload(TicketActivity.ticket).joinedload(Ticket.project),
            joinedload(TicketActivity.actor),
        )
        .where(
            Ticket.project_id == project.id,
            Ticket.deleted_at.is_(None),
        )
        .order_by(TicketActivity.created_at.desc(), TicketActivity.id.desc())
        .limit(10)
    ).unique().all()

    today = datetime.now(UTC).date()
    upcoming_rows = db.scalars(
        select(Ticket)
        .options(
            joinedload(Ticket.project),
            joinedload(Ticket.assignee),
            joinedload(Ticket.tester),
        )
        .where(
            Ticket.project_id == project.id,
            Ticket.deleted_at.is_(None),
            Ticket.due_date.is_not(None),
            Ticket.due_date >= today,
            Ticket.due_date <= today + timedelta(days=30),
            Ticket.status.not_in(TERMINAL_STATUSES),
        )
        .order_by(Ticket.due_date.asc(), Ticket.updated_at.desc())
        .limit(10)
    ).unique().all()

    active_members = [
        {
            "user_id": membership.user.id,
            "full_name": membership.user.full_name,
            "email": membership.user.email,
            "role_code": membership.user.role.code,
            "joined_at": membership.joined_at,
        }
        for membership in project.memberships
        if membership.removed_at is None
    ]

    return {
        "project_id": project.id,
        "project_name": project.name,
        "project_key": project.key,
        "total_tickets": total_tickets,
        "completed_tickets": completed_tickets,
        "completion_percentage": completion_percentage,
        "ticket_distribution": ticket_distribution,
        "team_members": active_members,
        "recent_activities": [serialize_activity(item) for item in activity_rows],
        "upcoming_deadlines": [serialize_deadline(item) for item in upcoming_rows],
    }
