from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Team, TeamMember, User


class TeamServiceError(Exception):
    """Represent an expected Team Management business-rule failure."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _team_options():
    return (
        joinedload(Team.lead).joinedload(User.role),
        selectinload(Team.memberships).joinedload(TeamMember.user).joinedload(User.role),
    )


def get_team(db: Session, team_id: UUID) -> Team:
    team = db.scalar(select(Team).options(*_team_options()).where(Team.id == team_id))

    if team is None:
        raise TeamServiceError(404, "Team not found.")

    return team


def _require_active_team(db: Session, team_id: UUID) -> Team:
    team = get_team(db, team_id)

    if team.status != "ACTIVE" or team.archived_at is not None:
        raise TeamServiceError(409, "This team is archived.")

    return team


def _require_active_user(db: Session, user_id: UUID) -> User:
    user = db.scalar(
        select(User)
        .options(joinedload(User.role))
        .where(User.id == user_id, User.is_active.is_(True))
    )

    if user is None:
        raise TeamServiceError(404, "Active employee not found.")

    return user


def _validate_member_users(
    db: Session,
    user_ids: set[UUID],
) -> list[User]:
    if not user_ids:
        return []

    users = list(
        db.scalars(
            select(User)
            .options(joinedload(User.role))
            .where(
                User.id.in_(user_ids),
                User.is_active.is_(True),
            )
        ).all()
    )

    if len(users) != len(user_ids):
        raise TeamServiceError(
            422,
            "One or more selected employees do not exist or are inactive.",
        )

    return users


def _active_member_count(team: Team) -> int:
    return sum(
        1
        for membership in team.memberships
        if membership.removed_at is None and membership.user.is_active
    )


def list_teams(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None,
    status_filter: str,
) -> tuple[list[Team], int]:
    statement = select(Team).options(*_team_options())
    count_statement = select(func.count(Team.id))

    if status_filter != "ALL":
        statement = statement.where(Team.status == status_filter)
        count_statement = count_statement.where(Team.status == status_filter)

    if search:
        pattern = f"%{search.strip()}%"
        condition = Team.name.ilike(pattern)
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)

    total = db.scalar(count_statement) or 0

    teams = list(
        db.scalars(
            statement.order_by(Team.created_at.desc(), Team.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )

    return teams, total


def create_team(
    db: Session,
    *,
    name: str,
    description: str | None,
    lead_user_id: UUID | None,
    member_ids: list[UUID],
) -> Team:
    normalized_name = " ".join(name.split())

    duplicate = db.scalar(select(Team.id).where(func.lower(Team.name) == normalized_name.lower()))

    if duplicate is not None:
        raise TeamServiceError(409, "A team with this name already exists.")

    selected_ids = set(member_ids)

    if lead_user_id is not None:
        selected_ids.add(lead_user_id)

    users = _validate_member_users(db, selected_ids)

    team = Team(
        name=normalized_name,
        description=description,
        status="ACTIVE",
    )

    db.add(team)
    db.flush()

    for user in users:
        db.add(
            TeamMember(
                team_id=team.id,
                user_id=user.id,
            )
        )

    if lead_user_id is not None:
        team.lead_user_id = lead_user_id

    db.flush()
    return get_team(db, team.id)


def update_team(
    db: Session,
    *,
    team_id: UUID,
    updates: dict,
) -> Team:
    team = _require_active_team(db, team_id)

    if "name" in updates:
        name = updates["name"]

        if name is None:
            raise TeamServiceError(422, "Team name cannot be null.")

        duplicate = db.scalar(
            select(Team.id).where(
                func.lower(Team.name) == name.lower(),
                Team.id != team.id,
            )
        )

        if duplicate is not None:
            raise TeamServiceError(
                409,
                "A team with this name already exists.",
            )

        team.name = name

    if "description" in updates:
        team.description = updates["description"]

    db.flush()
    return get_team(db, team.id)


def add_team_member(
    db: Session,
    *,
    team_id: UUID,
    user_id: UUID,
    designation: str | None,
) -> Team:
    team = _require_active_team(db, team_id)
    user = _require_active_user(db, user_id)

    existing = db.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user.id,
            TeamMember.removed_at.is_(None),
        )
    )

    if existing is not None:
        raise TeamServiceError(
            409,
            "This employee is already an active member of the team.",
        )

    db.add(
        TeamMember(
            team_id=team.id,
            user_id=user.id,
            designation=designation,
        )
    )

    db.flush()

    # The team was loaded before the membership was inserted.
    # Expire the cached collection so the next query loads the new member.
    db.expire(team, ["memberships"])

    return get_team(db, team.id)


def remove_team_member(
    db: Session,
    *,
    team_id: UUID,
    user_id: UUID,
) -> TeamMember:
    team = get_team(db, team_id)

    membership = db.scalar(
        select(TeamMember)
        .where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user_id,
            TeamMember.removed_at.is_(None),
        )
        .with_for_update()
    )

    if membership is None:
        raise TeamServiceError(
            404,
            "Active team membership not found.",
        )

    now = datetime.now(UTC)
    membership.removed_at = now

    if team.lead_user_id == user_id:
        team.lead_user_id = None
        db.flush()
        db.expire(team, ["lead"])

    db.flush()
    return membership


def set_team_lead(
    db: Session,
    *,
    team_id: UUID,
    user_id: UUID | None,
) -> Team:
    team = _require_active_team(db, team_id)

    if user_id is not None:
        _require_active_user(db, user_id)

        membership = db.scalar(
            select(TeamMember.id).where(
                TeamMember.team_id == team.id,
                TeamMember.user_id == user_id,
                TeamMember.removed_at.is_(None),
            )
        )

        if membership is None:
            raise TeamServiceError(
                422,
                "The team lead must be an active member of this team.",
            )

    team.lead_user_id = user_id
    db.flush()
    db.expire(team, ["lead"])

    return get_team(db, team.id)


def archive_team(db: Session, *, team_id: UUID) -> Team:
    team = _require_active_team(db, team_id)

    now = datetime.now(UTC)
    team.status = "ARCHIVED"
    team.archived_at = now

    db.flush()
    return get_team(db, team.id)
