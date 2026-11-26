from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import Project, ProjectMember, Team, Ticket, User
from app.schemas.search import (
    GlobalSearchResponse,
    SearchProjectResult,
    SearchTeamResult,
    SearchTicketResult,
    SearchUserResult,
)

router = APIRouter(prefix="/search", tags=["Search"])


def _visible_project_ids(db: Session, actor: User) -> list[UUID]:
    filters = [Project.archived_at.is_(None)]

    if actor.role.code == "PM":
        filters.append(Project.project_manager_id == actor.id)
    elif actor.role.code != "ADMIN":
        filters.append(
            select(ProjectMember.id)
            .where(
                ProjectMember.project_id == Project.id,
                ProjectMember.user_id == actor.id,
                ProjectMember.removed_at.is_(None),
            )
            .exists()
        )

    return list(db.scalars(select(Project.id).where(*filters)).all())


def _visible_user_ids_query(project_ids: list[UUID]):
    return (
        select(Project.project_manager_id).where(Project.id.in_(project_ids))
        .union(
            select(ProjectMember.user_id).where(
                ProjectMember.project_id.in_(project_ids),
                ProjectMember.removed_at.is_(None),
            )
        )
        .union(
            select(Ticket.reporter_id).where(
                Ticket.project_id.in_(project_ids),
                Ticket.deleted_at.is_(None),
            )
        )
        .union(
            select(Ticket.assignee_id).where(
                Ticket.project_id.in_(project_ids),
                Ticket.deleted_at.is_(None),
                Ticket.assignee_id.is_not(None),
            )
        )
        .union(
            select(Ticket.reviewer_id).where(
                Ticket.project_id.in_(project_ids),
                Ticket.deleted_at.is_(None),
                Ticket.reviewer_id.is_not(None),
            )
        )
        .union(
            select(Ticket.tester_id).where(
                Ticket.project_id.in_(project_ids),
                Ticket.deleted_at.is_(None),
                Ticket.tester_id.is_not(None),
            )
        )
    )


@router.get("", response_model=GlobalSearchResponse)
@limiter.limit("60/minute")
def global_search(
    request: Request,
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=6, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GlobalSearchResponse:
    """Search authorized projects, tickets, users, and teams."""
    term_value = q.strip()
    if len(term_value) < 2:
        return GlobalSearchResponse()

    term = f"%{term_value}%"
    project_ids = _visible_project_ids(db, current_user)
    if not project_ids:
        return GlobalSearchResponse()

    projects = list(
        db.scalars(
            select(Project)
            .where(
                Project.id.in_(project_ids),
                or_(Project.name.ilike(term), Project.key.ilike(term)),
            )
            .order_by(Project.name.asc(), Project.id.asc())
            .limit(limit)
        ).all()
    )

    tickets = list(
        db.scalars(
            select(Ticket)
            .options(joinedload(Ticket.project))
            .join(Project, Project.id == Ticket.project_id)
            .where(
                Ticket.project_id.in_(project_ids),
                Ticket.deleted_at.is_(None),
                or_(
                    Ticket.ticket_key.ilike(term),
                    Ticket.title.ilike(term),
                    cast(Ticket.id, String).ilike(term),
                ),
            )
            .order_by(Ticket.updated_at.desc(), Ticket.id.asc())
            .limit(limit)
        )
        .unique()
        .all()
    )

    teams_query = select(Team).where(
        Team.id.in_(
            select(Project.team_id).where(Project.id.in_(project_ids))
        ),
        Team.archived_at.is_(None),
        Team.name.ilike(term),
    )
    teams = list(
        db.scalars(teams_query.order_by(Team.name.asc(), Team.id.asc()).limit(limit)).all()
    )

    user_filters = [
        or_(User.full_name.ilike(term), User.email.ilike(term)),
    ]
    if current_user.role.code != "ADMIN":
        user_filters.append(User.id.in_(_visible_user_ids_query(project_ids)))

    users = list(
        db.scalars(
            select(User)
            .options(joinedload(User.role))
            .where(*user_filters)
            .order_by(User.full_name.asc(), User.id.asc())
            .limit(limit)
        )
        .unique()
        .all()
    )

    return GlobalSearchResponse(
        projects=[
            SearchProjectResult(
                id=project.id,
                name=project.name,
                key=project.key,
                status=project.status,
            )
            for project in projects
        ],
        tickets=[
            SearchTicketResult(
                id=ticket.id,
                ticket_key=ticket.ticket_key,
                title=ticket.title,
                status=ticket.status,
                priority=ticket.priority,
                project_id=ticket.project_id,
                project_name=ticket.project.name,
                project_key=ticket.project.key,
            )
            for ticket in tickets
        ],
        users=[
            SearchUserResult(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                role_code=user.role.code,
            )
            for user in users
        ],
        teams=[
            SearchTeamResult(id=team.id, name=team.name)
            for team in teams
        ],
    )
