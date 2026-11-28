from __future__ import annotations

import csv
from datetime import UTC, date, datetime
from io import StringIO
from uuid import UUID

from sqlalchemy import func, or_, select, union
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    Project,
    ProjectMember,
    Sprint,
    SprintTicket,
    Team,
    TeamMember,
    Ticket,
    User,
    project_project_managers,
    project_teams,
    ticket_assignees,
)

TERMINAL_STATUSES = ("COMPLETED", "CANCELLED")
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
TICKET_PRIORITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
TICKET_TYPES = (
    "EPIC",
    "STORY",
    "TASK",
    "SUBTASK",
    "BUG",
    "IMPROVEMENT",
    "TECHNICAL_DEBT",
)


def _project_visibility_conditions(current_user: User) -> list:
    """Mirror the workspace's Admin, assigned-PM, and active-project-member visibility."""
    if current_user.role.code == "ADMIN":
        return []

    if current_user.role.code == "PM":
        return [
            or_(
                Project.project_manager_id == current_user.id,
                Project.project_managers.any(User.id == current_user.id),
            )
        ]

    active_membership = (
        select(ProjectMember.id)
        .where(
            ProjectMember.project_id == Project.id,
            ProjectMember.user_id == current_user.id,
            ProjectMember.removed_at.is_(None),
        )
        .exists()
    )
    return [active_membership]


def _visible_project_ids(db: Session, current_user: User) -> list[UUID]:
    return list(
        db.scalars(
            select(Project.id).where(*_project_visibility_conditions(current_user))
        ).all()
    )


def _get_visible_project(
    db: Session,
    *,
    project_id: UUID,
    current_user: User,
) -> Project:
    project = db.scalar(
        select(Project)
        .options(joinedload(Project.team))
        .where(
            Project.id == project_id,
            *_project_visibility_conditions(current_user),
        )
    )
    if project is None:
        raise LookupError("Project not found.")
    return project


def _ticket_base_filters(*, project_ids: list[UUID]) -> list:
    return [
        Ticket.project_id.in_(project_ids),
        Ticket.deleted_at.is_(None),
    ]


def _ticket_count(db: Session, filters: list, *extra_filters) -> int:
    return int(
        db.scalar(
            select(func.count(Ticket.id)).where(*filters, *extra_filters)
        )
        or 0
    )


def _bucket_rows(
    db: Session,
    *,
    column,
    filters: list,
    keys: tuple[str, ...],
) -> list[dict]:
    rows = db.execute(
        select(column, func.count(Ticket.id))
        .where(*filters)
        .group_by(column)
    ).all()
    counts = {str(key): int(count) for key, count in rows}
    return [
        {"key": key, "label": key.replace("_", " ").title(), "count": counts.get(key, 0)}
        for key in keys
    ]


def get_reports_options(db: Session, current_user: User) -> dict:
    project_conditions = _project_visibility_conditions(current_user)
    projects = list(
        db.scalars(
            select(Project)
            .options(joinedload(Project.team))
            .where(*project_conditions)
            .order_by(Project.name.asc(), Project.id.asc())
        )
        .unique()
        .all()
    )
    project_ids = [project.id for project in projects]
    if not project_ids:
        return {"projects": [], "teams": [], "sprints": []}

    team_rows = db.execute(
        select(
            Team.id,
            Team.name,
            func.count(func.distinct(Project.id)).label("project_count"),
        )
        .join(project_teams, project_teams.c.team_id == Team.id)
        .join(Project, Project.id == project_teams.c.project_id)
        .where(Project.id.in_(project_ids))
        .group_by(Team.id, Team.name)
        .order_by(Team.name.asc(), Team.id.asc())
    ).all()

    sprint_rows = db.execute(
        select(
            Sprint.id,
            Sprint.project_id,
            Project.key,
            Sprint.name,
            Sprint.status,
            Sprint.start_date,
            Sprint.end_date,
        )
        .join(Project, Project.id == Sprint.project_id)
        .where(Project.id.in_(project_ids))
        .order_by(Project.key.asc(), Sprint.start_date.desc(), Sprint.name.asc())
    ).all()

    return {
        "projects": [
            {
                "id": project.id,
                "name": project.name,
                "key": project.key,
                "status": project.status,
            }
            for project in projects
        ],
        "teams": [
            {
                "id": row.id,
                "name": row.name,
                "project_count": int(row.project_count or 0),
            }
            for row in team_rows
        ],
        "sprints": [
            {
                "id": row.id,
                "project_id": row.project_id,
                "project_key": row.key,
                "name": row.name,
                "status": row.status,
                "start_date": row.start_date,
                "end_date": row.end_date,
            }
            for row in sprint_rows
        ],
    }


def get_project_report(
    db: Session,
    *,
    project_id: UUID,
    current_user: User,
    today: date | None = None,
) -> dict:
    project = _get_visible_project(
        db,
        project_id=project_id,
        current_user=current_user,
    )
    filters = _ticket_base_filters(project_ids=[project.id])
    report_date = today or datetime.now(UTC).date()

    total = _ticket_count(db, filters)
    completed = _ticket_count(db, filters, Ticket.status == "COMPLETED")
    pending = _ticket_count(db, filters, Ticket.status.not_in(TERMINAL_STATUSES))
    overdue = _ticket_count(
        db,
        filters,
        Ticket.due_date.is_not(None),
        Ticket.due_date < report_date,
        Ticket.status.not_in(TERMINAL_STATUSES),
    )

    return {
        "project_id": project.id,
        "project_name": project.name,
        "project_key": project.key,
        "project_status": project.status,
        "team_name": project.team.name,
        "total_tickets": total,
        "completed_tickets": completed,
        "pending_tickets": pending,
        "overdue_tickets": overdue,
        "completion_percentage": round(completed / total * 100, 1) if total else 0.0,
        "tickets_by_priority": _bucket_rows(
            db, column=Ticket.priority, filters=filters, keys=TICKET_PRIORITIES
        ),
        "tickets_by_status": _bucket_rows(
            db, column=Ticket.status, filters=filters, keys=TICKET_STATUSES
        ),
        "tickets_by_type": _bucket_rows(
            db, column=Ticket.type, filters=filters, keys=TICKET_TYPES
        ),
    }


def get_team_report(
    db: Session,
    *,
    team_id: UUID,
    current_user: User,
    today: date | None = None,
) -> dict:
    project_ids = list(
        db.scalars(
            select(Project.id).where(
                or_(
                    Project.team_id == team_id,
                    Project.teams.any(Team.id == team_id),
                ),
                *_project_visibility_conditions(current_user),
            )
        ).all()
    )
    team = db.get(Team, team_id)
    if team is None or not project_ids:
        raise LookupError("Team not found.")

    report_date = today or datetime.now(UTC).date()
    filters = _ticket_base_filters(project_ids=project_ids)
    assigned_filter = or_(Ticket.assignee_id.is_not(None), Ticket.assignees.any())
    total_assigned = _ticket_count(db, filters, assigned_filter)
    completed = _ticket_count(
        db, filters, assigned_filter, Ticket.status == "COMPLETED"
    )
    pending = _ticket_count(
        db, filters, assigned_filter, Ticket.status.not_in(TERMINAL_STATUSES)
    )
    overdue = _ticket_count(
        db,
        filters,
        assigned_filter,
        Ticket.due_date.is_not(None),
        Ticket.due_date < report_date,
        Ticket.status.not_in(TERMINAL_STATUSES),
    )

    visible_team_member_ids = union(
        select(Project.project_manager_id).where(Project.id.in_(project_ids)),
        select(project_project_managers.c.user_id).where(
            project_project_managers.c.project_id.in_(project_ids)
        ),
        select(ProjectMember.user_id).where(
            ProjectMember.project_id.in_(project_ids),
            ProjectMember.removed_at.is_(None),
        ),
    )
    members = list(
        db.scalars(
            select(TeamMember)
            .options(joinedload(TeamMember.user).joinedload(User.role))
            .where(
                TeamMember.team_id == team_id,
                TeamMember.removed_at.is_(None),
                TeamMember.user_id.in_(visible_team_member_ids),
            )
            .order_by(TeamMember.joined_at.asc(), TeamMember.id.asc())
        )
        .unique()
        .all()
    )
    member_ids = [membership.user_id for membership in members]
    grouped_workload = {}
    if member_ids:
        workload_rows = db.execute(
            select(
                ticket_assignees.c.user_id.label("assignee_id"),
                func.count(Ticket.id).label("assigned"),
                func.count(Ticket.id)
                .filter(Ticket.status == "COMPLETED")
                .label("completed"),
                func.count(Ticket.id)
                .filter(Ticket.status.not_in(TERMINAL_STATUSES))
                .label("pending"),
                func.count(Ticket.id)
                .filter(
                    Ticket.due_date.is_not(None),
                    Ticket.due_date < report_date,
                    Ticket.status.not_in(TERMINAL_STATUSES),
                )
                .label("overdue"),
                func.count(Ticket.id)
                .filter(Ticket.status == "IN_PROGRESS")
                .label("in_progress"),
            )
            .join(Ticket, Ticket.id == ticket_assignees.c.ticket_id)
            .where(*filters, ticket_assignees.c.user_id.in_(member_ids))
            .group_by(ticket_assignees.c.user_id)
        ).all()
        grouped_workload = {row.assignee_id: row for row in workload_rows}

    workload = []
    for membership in members:
        member = membership.user
        row = grouped_workload.get(member.id)
        assigned = int(row.assigned or 0) if row else 0
        member_completed = int(row.completed or 0) if row else 0
        workload.append(
            {
                "user_id": member.id,
                "full_name": member.full_name,
                "role_code": member.role.code,
                "assigned_tickets": assigned,
                "completed_tickets": member_completed,
                "pending_tickets": int(row.pending or 0) if row else 0,
                "overdue_tickets": int(row.overdue or 0) if row else 0,
                "in_progress_tickets": int(row.in_progress or 0) if row else 0,
                "completion_percentage": (
                    round(member_completed / assigned * 100, 1) if assigned else 0.0
                ),
            }
        )

    return {
        "team_id": team.id,
        "team_name": team.name,
        "project_count": len(project_ids),
        "total_assigned_tickets": total_assigned,
        "completed_tickets": completed,
        "pending_tickets": pending,
        "overdue_tickets": overdue,
        "completion_percentage": (
            round(completed / total_assigned * 100, 1) if total_assigned else 0.0
        ),
        "workload_by_member": workload,
        "tickets_by_status": _bucket_rows(
            db, column=Ticket.status, filters=filters, keys=TICKET_STATUSES
        ),
        "interpretation_note": (
            "Workload and completion figures describe assigned work in visible projects; "
            "they are not an individual performance score."
        ),
    }


def _get_visible_sprint(
    db: Session,
    *,
    sprint_id: UUID,
    current_user: User,
) -> Sprint:
    visible_project_ids = select(Project.id).where(
        *_project_visibility_conditions(current_user)
    )
    sprint = db.scalar(
        select(Sprint)
        .join(Project, Project.id == Sprint.project_id)
        .options(
            joinedload(Sprint.project),
            selectinload(Sprint.ticket_assignments)
            .joinedload(SprintTicket.ticket)
            .joinedload(Ticket.assignee),
        )
        .where(
            Sprint.id == sprint_id,
            Sprint.project_id.in_(visible_project_ids),
        )
    )
    if sprint is None:
        raise LookupError("Sprint not found.")
    return sprint


def get_sprint_report(
    db: Session,
    *,
    sprint_id: UUID,
    current_user: User,
) -> dict:
    sprint = _get_visible_sprint(
        db,
        sprint_id=sprint_id,
        current_user=current_user,
    )
    assignments = [
        assignment
        for assignment in sprint.ticket_assignments
        if assignment.ticket.deleted_at is None
    ]

    if sprint.status == "COMPLETED":
        sprint_scope = [
            assignment
            for assignment in assignments
            if assignment.status_at_close is not None
        ]
    else:
        sprint_scope = [
            assignment
            for assignment in assignments
            if assignment.removed_at is None
        ]

    tickets = []
    for assignment in sprint_scope:
        status = (
            assignment.status_at_close
            if sprint.status == "COMPLETED"
            else assignment.ticket.status
        )
        tickets.append(
            {
                "ticket_id": assignment.ticket.id,
                "ticket_key": assignment.ticket.ticket_key,
                "title": assignment.ticket.title,
                "status": status,
                "priority": assignment.ticket.priority,
                "type": assignment.ticket.type,
                "assignee_name": (
                    assignment.ticket.assignee.full_name
                    if assignment.ticket.assignee
                    else None
                ),
                "added_at": assignment.added_at,
            }
        )

    total = len(tickets)
    completed = sum(1 for item in tickets if item["status"] == "COMPLETED")
    cancelled = sum(1 for item in tickets if item["status"] == "CANCELLED")
    incomplete = total - completed - cancelled

    scope_changes = []
    added_after_start = 0
    removed_after_start = 0
    if sprint.started_at is not None:
        for assignment in assignments:
            ticket = assignment.ticket
            if assignment.added_at > sprint.started_at:
                added_after_start += 1
                scope_changes.append(
                    {
                        "ticket_id": ticket.id,
                        "ticket_key": ticket.ticket_key,
                        "title": ticket.title,
                        "change_type": "ADDED_AFTER_START",
                        "occurred_at": assignment.added_at,
                    }
                )
            if (
                assignment.removed_at is not None
                and assignment.status_at_close is None
                and assignment.removed_at > sprint.started_at
            ):
                removed_after_start += 1
                scope_changes.append(
                    {
                        "ticket_id": ticket.id,
                        "ticket_key": ticket.ticket_key,
                        "title": ticket.title,
                        "change_type": "REMOVED_AFTER_START",
                        "occurred_at": assignment.removed_at,
                    }
                )

    scope_changes.sort(key=lambda item: item["occurred_at"])
    return {
        "sprint_id": sprint.id,
        "sprint_name": sprint.name,
        "project_id": sprint.project.id,
        "project_name": sprint.project.name,
        "project_key": sprint.project.key,
        "sprint_status": sprint.status,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "started_at": sprint.started_at,
        "completed_at": sprint.completed_at,
        "total_tickets": total,
        "completed_work": completed,
        "incomplete_work": incomplete,
        "cancelled_work": cancelled,
        "completion_rate": round(completed / total * 100, 1) if total else 0.0,
        "tickets_added_after_start": added_after_start,
        "tickets_removed_after_start": removed_after_start,
        "scope_change_count": added_after_start + removed_after_start,
        "tickets": tickets,
        "scope_changes": scope_changes,
    }


def build_report_csv(
    db: Session,
    *,
    report_type: str,
    report_id: UUID,
    current_user: User,
) -> tuple[str, str]:
    if report_type == "project":
        report = get_project_report(
            db, project_id=report_id, current_user=current_user
        )
        filename = f"project-report-{report['project_key'].lower()}.csv"
        rows = [
            ("summary", "Total tickets", report["total_tickets"], ""),
            ("summary", "Completed tickets", report["completed_tickets"], ""),
            ("summary", "Pending tickets", report["pending_tickets"], ""),
            ("summary", "Overdue tickets", report["overdue_tickets"], ""),
            ("summary", "Completion percentage", report["completion_percentage"], ""),
        ]
        for section, key in (
            ("priority", "tickets_by_priority"),
            ("status", "tickets_by_status"),
            ("type", "tickets_by_type"),
        ):
            rows.extend(
                (section, item["label"], item["count"], "")
                for item in report[key]
            )
    elif report_type == "team":
        report = get_team_report(
            db, team_id=report_id, current_user=current_user
        )
        filename = f"team-report-{report['team_id']}.csv"
        rows = [
            ("summary", "Total assigned tickets", report["total_assigned_tickets"], ""),
            ("summary", "Completed tickets", report["completed_tickets"], ""),
            ("summary", "Pending tickets", report["pending_tickets"], ""),
            ("summary", "Overdue tickets", report["overdue_tickets"], ""),
            ("summary", "Completion percentage", report["completion_percentage"], ""),
        ]
        rows.extend(
            (
                "member workload",
                item["full_name"],
                item["assigned_tickets"],
                (
                    f"Completed: {item['completed_tickets']}; "
                    f"Pending: {item['pending_tickets']}; "
                    f"Overdue: {item['overdue_tickets']}; "
                    f"In progress: {item['in_progress_tickets']}; "
                    f"Completion: {item['completion_percentage']}%"
                ),
            )
            for item in report["workload_by_member"]
        )
        rows.extend(
            ("status", item["label"], item["count"], "")
            for item in report["tickets_by_status"]
        )
    elif report_type == "sprint":
        report = get_sprint_report(
            db, sprint_id=report_id, current_user=current_user
        )
        filename = f"sprint-report-{report['sprint_id']}.csv"
        rows = [
            ("summary", "Total sprint tickets", report["total_tickets"], ""),
            ("summary", "Completed work", report["completed_work"], ""),
            ("summary", "Incomplete work", report["incomplete_work"], ""),
            ("summary", "Cancelled work", report["cancelled_work"], ""),
            ("summary", "Completion rate", report["completion_rate"], ""),
            ("scope", "Tickets added after start", report["tickets_added_after_start"], ""),
            ("scope", "Tickets removed after start", report["tickets_removed_after_start"], ""),
        ]
        rows.extend(
            (
                "ticket",
                item["ticket_key"],
                item["status"],
                f"{item['title']} · {item['priority']} · {item['type']}",
            )
            for item in report["tickets"]
        )
        rows.extend(
            (
                "scope change",
                item["ticket_key"],
                item["change_type"],
                item["occurred_at"].isoformat(),
            )
            for item in report["scope_changes"]
        )
    else:
        raise ValueError("Unsupported report type.")

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(("section", "name", "value", "details"))
    writer.writerows(rows)
    return filename, output.getvalue()
