from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Project, ProjectMember, Role, Team, TeamMember, User
from app.schemas.project import ProjectCreateRequest, ProjectUpdateRequest


class ProjectServiceError(Exception):
    """Represent an expected Project Management business-rule failure."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _project_options():
    return (
        joinedload(Project.project_manager).joinedload(User.role),
        joinedload(Project.team),
        selectinload(Project.project_managers).joinedload(User.role),
        selectinload(Project.teams),
        selectinload(Project.memberships).joinedload(ProjectMember.user).joinedload(User.role),
    )


def get_project(db: Session, project_id: UUID) -> Project:
    project = db.scalar(
        select(Project).options(*_project_options()).where(Project.id == project_id)
    )

    if project is None:
        raise ProjectServiceError("Project not found.", 404)

    return project


def _require_active_project(db: Session, project_id: UUID) -> Project:
    project = get_project(db, project_id)

    if project.archived_at is not None or project.status == "ARCHIVED":
        raise ProjectServiceError("Archived projects cannot be modified.", 409)

    return project


def _require_active_team(db: Session, team_id: UUID) -> Team:
    team = db.scalar(select(Team).where(Team.id == team_id))

    if team is None:
        raise ProjectServiceError("Team not found.", 404)

    if team.status != "ACTIVE" or team.archived_at is not None:
        raise ProjectServiceError("Only active teams can be assigned to projects.", 400)

    return team


def _require_project_manager(db: Session, user_id: UUID) -> User:
    user = db.scalar(
        select(User)
        .options(joinedload(User.role))
        .where(User.id == user_id, User.is_active.is_(True))
    )

    if user is None:
        raise ProjectServiceError("Project manager is not an active user.", 400)

    if user.role.code != "PM":
        raise ProjectServiceError("The assigned project manager must have the PM role.", 400)

    return user


def _validate_team_members(
    db: Session,
    *,
    team_ids: list[UUID],
    user_ids: list[UUID],
) -> None:
    """Require project members to belong to at least one assigned team."""
    if not user_ids:
        return

    active_member_ids = set(
        db.scalars(
            select(TeamMember.user_id)
            .join(User, User.id == TeamMember.user_id)
            .where(
                TeamMember.team_id.in_(team_ids),
                TeamMember.user_id.in_(user_ids),
                TeamMember.removed_at.is_(None),
                User.is_active.is_(True),
            )
        ).all()
    )

    missing_ids = set(user_ids) - active_member_ids
    if missing_ids:
        raise ProjectServiceError(
            "Every project member must be an active member of at least one assigned team.",
            400,
        )


def _active_member_count(project: Project) -> int:
    return sum(1 for membership in project.memberships if membership.removed_at is None)


def list_projects(
    db: Session,
    *,
    current_user: User,
    status_filter: str | None,
    search: str | None,
    page: int,
    page_size: int,
) -> tuple[list[Project], int]:
    filters = []

    if status_filter == "ARCHIVED":
        filters.append(Project.archived_at.is_not(None))
    else:
        # ALL means all non-archived project statuses.
        filters.append(Project.archived_at.is_(None))

        if status_filter and status_filter != "ALL":
            filters.append(Project.status == status_filter)

    if search:
        term = f"%{search.strip()}%"
        filters.append((Project.name.ilike(term)) | (Project.key.ilike(term)))

    if current_user.role.code == "PM":
        filters.append(
            or_(
                Project.project_manager_id == current_user.id,
                Project.project_managers.any(User.id == current_user.id),
            )
        )

    elif current_user.role.code != "ADMIN":
        filters.append(
            exists(
                select(ProjectMember.id).where(
                    ProjectMember.project_id == Project.id,
                    ProjectMember.user_id == current_user.id,
                    ProjectMember.removed_at.is_(None),
                )
            )
        )

    total = db.scalar(select(func.count()).select_from(Project).where(*filters)) or 0

    projects = list(
        db.scalars(
            select(Project)
            .options(*_project_options())
            .where(*filters)
            .order_by(Project.updated_at.desc(), Project.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )

    return projects, total


def create_project(
    db: Session,
    *,
    actor: User,
    data: ProjectCreateRequest,
) -> Project:
    manager_ids = data.project_manager_ids or [data.project_manager_id]
    team_ids = data.team_ids or [data.team_id]

    if not manager_ids or not team_ids:
        raise ProjectServiceError("At least one project manager and one assigned team are required.", 400)

    if actor.role.code == "PM" and any(manager_id != actor.id for manager_id in manager_ids):
        raise ProjectServiceError(
            "Project Managers can only create projects assigned to themselves.",
            403,
        )

    managers = [_require_project_manager(db, manager_id) for manager_id in manager_ids]
    teams = [_require_active_team(db, team_id) for team_id in team_ids]

    _validate_team_members(
        db,
        team_ids=team_ids,
        user_ids=data.member_ids,
    )

    duplicate_key = db.scalar(select(Project.id).where(func.lower(Project.key) == data.key.lower()))
    if duplicate_key is not None:
        raise ProjectServiceError("Project key already exists.", 409)

    project = Project(
        name=data.name,
        key=data.key,
        description=data.description,
        logo_key=data.logo_key,
        project_manager_id=manager_ids[0],
        team_id=team_ids[0],
        created_by_user_id=actor.id,
        start_date=data.start_date,
        end_date=data.end_date,
        status=data.status,
        visibility=data.visibility,
        archived_at=datetime.now(UTC) if data.status == "ARCHIVED" else None,
    )

    db.add(project)
    db.flush()
    project.project_managers = managers
    project.teams = teams

    for user_id in data.member_ids:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=user_id,
                added_by_user_id=actor.id,
            )
        )

    db.commit()
    return get_project(db, project.id)


def update_project(
    db: Session,
    *,
    project_id: UUID,
    data: ProjectUpdateRequest,
) -> Project:
    project = _require_active_project(db, project_id)
    changes = data.model_dump(exclude_unset=True)

    for field in ("name", "key", "status", "visibility"):
        if field in changes and changes[field] is None:
            raise ProjectServiceError(
                f"Project {field.replace('_', ' ')} cannot be empty.",
                400,
            )

    manager_ids: list[UUID] | None = None
    if "project_manager_ids" in changes:
        manager_ids = changes.pop("project_manager_ids")
    elif "project_manager_id" in changes:
        manager_ids = [changes.pop("project_manager_id")]

    team_ids: list[UUID] | None = None
    if "team_ids" in changes:
        team_ids = changes.pop("team_ids")
    elif "team_id" in changes:
        team_ids = [changes.pop("team_id")]

    if manager_ids is not None:
        if not manager_ids:
            raise ProjectServiceError("At least one project manager is required.", 400)
        managers = [_require_project_manager(db, manager_id) for manager_id in manager_ids]
        project.project_managers = managers
        project.project_manager_id = manager_ids[0]

    if team_ids is not None:
        if not team_ids:
            raise ProjectServiceError("At least one assigned team is required.", 400)
        teams = [_require_active_team(db, team_id) for team_id in team_ids]
        active_member_ids = [
            membership.user_id
            for membership in project.memberships
            if membership.removed_at is None
        ]
        _validate_team_members(
            db,
            team_ids=team_ids,
            user_ids=active_member_ids,
        )
        project.teams = teams
        project.team_id = team_ids[0]

    start_date = changes.get("start_date", project.start_date)
    end_date = changes.get("end_date", project.end_date)
    if start_date is not None and end_date is not None and end_date < start_date:
        raise ProjectServiceError("Project end date cannot be before its start date.", 400)

    if changes.get("status") == "ARCHIVED":
        project.archived_at = datetime.now(UTC)

    for field, value in changes.items():
        setattr(project, field, value)

    db.commit()
    return get_project(db, project.id)


def add_project_member(
    db: Session,
    *,
    project_id: UUID,
    user_id: UUID,
    actor_id: UUID,
) -> Project:
    project = _require_active_project(db, project_id)

    _validate_team_members(
        db,
        team_ids=[team.id for team in (project.teams or [project.team])],
        user_ids=[user_id],
    )

    existing_membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.removed_at.is_(None),
        )
    )

    if existing_membership is not None:
        raise ProjectServiceError("User is already an active project member.", 409)

    membership = ProjectMember(
        project_id=project_id,
        user_id=user_id,
        added_by_user_id=actor_id,
    )

    db.add(membership)
    db.commit()
    db.expire(project, ["memberships"])

    return get_project(db, project_id)


def remove_project_member(
    db: Session,
    *,
    project_id: UUID,
    user_id: UUID,
) -> datetime:
    project = _require_active_project(db, project_id)

    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id,
            ProjectMember.removed_at.is_(None),
        )
    )

    if membership is None:
        raise ProjectServiceError("Active project membership not found.", 404)

    removed_at = datetime.now(UTC)
    membership.removed_at = removed_at

    db.commit()
    return removed_at


def archive_project(db: Session, *, project_id: UUID) -> Project:
    project = _require_active_project(db, project_id)

    project.status = "ARCHIVED"
    project.archived_at = datetime.now(UTC)

    db.commit()
    return get_project(db, project_id)


def get_project_options(
    db: Session,
    *,
    current_user: User,
    team_ids: list[UUID] | None = None,
    team_id: UUID | None = None,
) -> tuple[list[Team], list[User], list[User]]:
    """Return active teams, selectable PMs and members across selected teams."""
    teams = list(
        db.scalars(
            select(Team)
            .where(Team.status == "ACTIVE", Team.archived_at.is_(None))
            .order_by(Team.name.asc())
        ).all()
    )

    managers_query = (
        select(User)
        .join(Role, User.role_id == Role.id)
        .options(joinedload(User.role))
        .where(User.is_active.is_(True), Role.code == "PM")
        .order_by(User.full_name.asc())
    )
    if current_user.role.code == "PM":
        managers_query = managers_query.where(User.id == current_user.id)
    managers = list(db.scalars(managers_query).unique().all())

    selected_team_ids = list(dict.fromkeys([*(team_ids or []), *([team_id] if team_id else [])]))
    members: list[User] = []
    if selected_team_ids:
        for selected_team_id in selected_team_ids:
            _require_active_team(db, selected_team_id)
        members = list(
            db.scalars(
                select(User)
                .join(TeamMember, TeamMember.user_id == User.id)
                .options(joinedload(User.role))
                .where(
                    TeamMember.team_id.in_(selected_team_ids),
                    TeamMember.removed_at.is_(None),
                    User.is_active.is_(True),
                )
                .order_by(User.full_name.asc(), User.id.asc())
            ).unique().all()
        )

    return teams, managers, members
