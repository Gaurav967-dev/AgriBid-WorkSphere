from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Project, ProjectMember, Team, User


def _count(db: Session, model, *conditions) -> int:
    statement = select(func.count()).select_from(model)

    if conditions:
        statement = statement.where(*conditions)

    return db.scalar(statement) or 0


def _project_scope(current_user: User):
    """
    Return project visibility conditions based on the user's role.
    """
    role_code = current_user.role.code

    if role_code == "ADMIN":
        return []

    if role_code == "PM":
        return [Project.project_manager_id == current_user.id]

    member_project_ids = select(ProjectMember.project_id).where(
        ProjectMember.user_id == current_user.id,
        ProjectMember.removed_at.is_(None),
    )

    return [Project.id.in_(member_project_ids)]


def _metric(
    key: str,
    title: str,
    value: int,
    description: str,
) -> dict:
    return {
        "key": key,
        "title": title,
        "value": value,
        "description": description,
    }


def _serialize_project(project: Project) -> dict:
    active_members = [
        membership for membership in project.memberships if membership.removed_at is None
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


def get_dashboard(db: Session, current_user: User) -> dict:
    role_code = current_user.role.code

    active_project_conditions = [
        Project.archived_at.is_(None),
        Project.status != "ARCHIVED",
    ]

    visible_project_conditions = [
        *_project_scope(current_user),
        *active_project_conditions,
    ]

    metrics = []
    team_distribution = []

    if role_code == "ADMIN":
        total_users = _count(db, User)
        active_users = _count(db, User, User.is_active.is_(True))

        total_teams = _count(
            db,
            Team,
            Team.archived_at.is_(None),
        )

        total_projects = _count(db, Project)

        active_projects = _count(
            db,
            Project,
            *active_project_conditions,
            Project.status == "ACTIVE",
        )

        completed_projects = _count(
            db,
            Project,
            *active_project_conditions,
            Project.status == "COMPLETED",
        )

        metrics = [
            _metric(
                "total_users",
                "Total users",
                total_users,
                "All registered user accounts",
            ),
            _metric(
                "active_users",
                "Active users",
                active_users,
                "Currently active user accounts",
            ),
            _metric(
                "total_teams",
                "Total teams",
                total_teams,
                "Teams that have not been archived",
            ),
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

        distribution_rows = db.execute(distribution_statement).all()

        team_distribution = [
            {
                "team_id": row.id,
                "team_name": row.name,
                "project_count": row.project_count,
            }
            for row in distribution_rows
        ]

    elif role_code == "PM":
        assigned = _count(
            db,
            Project,
            *visible_project_conditions,
        )

        active = _count(
            db,
            Project,
            *visible_project_conditions,
            Project.status == "ACTIVE",
        )

        planning = _count(
            db,
            Project,
            *visible_project_conditions,
            Project.status == "PLANNING",
        )

        on_hold = _count(
            db,
            Project,
            *visible_project_conditions,
            Project.status == "ON_HOLD",
        )

        completed = _count(
            db,
            Project,
            *visible_project_conditions,
            Project.status == "COMPLETED",
        )

        metrics = [
            _metric(
                "assigned_projects",
                "Assigned projects",
                assigned,
                "Projects managed by you",
            ),
            _metric(
                "active_projects",
                "Active projects",
                active,
                "Projects currently in progress",
            ),
            _metric(
                "planning_projects",
                "Planning",
                planning,
                "Projects being planned",
            ),
            _metric(
                "on_hold_projects",
                "On hold",
                on_hold,
                "Projects temporarily paused",
            ),
            _metric(
                "completed_projects",
                "Completed projects",
                completed,
                "Projects marked as completed",
            ),
        ]

    else:
        assigned = _count(
            db,
            Project,
            *visible_project_conditions,
        )

        active = _count(
            db,
            Project,
            *visible_project_conditions,
            Project.status == "ACTIVE",
        )

        completed = _count(
            db,
            Project,
            *visible_project_conditions,
            Project.status == "COMPLETED",
        )

        metrics = [
            _metric(
                "assigned_projects",
                "Assigned projects",
                assigned,
                "Projects you are a member of",
            ),
            _metric(
                "active_projects",
                "Active projects",
                active,
                "Projects currently in progress",
            ),
            _metric(
                "completed_projects",
                "Completed projects",
                completed,
                "Projects marked as completed",
            ),
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

    return {
        "role_code": role_code,
        "metrics": metrics,
        "projects": [_serialize_project(project) for project in projects],
        "team_project_distribution": team_distribution,
    }
