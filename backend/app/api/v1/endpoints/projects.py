from __future__ import annotations

from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import (
    get_admin_or_pm_user,
    get_current_user,
)
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import Project, User
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectDetailsResponse,
    ProjectListResponse,
    ProjectMemberAddRequest,
    ProjectMemberRemoveResponse,
    ProjectMemberResponse,
    ProjectOptionsResponse,
    ProjectSummaryResponse,
    ProjectTeamSummaryResponse,
    ProjectUpdateRequest,
    ProjectUserSummaryResponse,
)
from app.services import project_service
from app.services.project_service import ProjectServiceError

router = APIRouter(prefix="/projects", tags=["Projects"])


def _user_summary(user: User) -> ProjectUserSummaryResponse:
    return ProjectUserSummaryResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role_code=user.role.code,
        employee_id=user.employee_id,
    )


def _project_summary(project: Project) -> ProjectSummaryResponse:
    active_memberships = [
        membership for membership in project.memberships if membership.removed_at is None
    ]

    return ProjectSummaryResponse(
        id=project.id,
        name=project.name,
        key=project.key,
        description=project.description,
        logo_key=project.logo_key,
        project_manager=_user_summary(project.project_manager),
        team=ProjectTeamSummaryResponse(
            id=project.team.id,
            name=project.team.name,
        ),
        start_date=project.start_date,
        end_date=project.end_date,
        status=project.status,
        visibility=project.visibility,
        member_count=len(active_memberships),
        created_at=project.created_at,
        updated_at=project.updated_at,
        archived_at=project.archived_at,
    )


def _project_details(project: Project) -> ProjectDetailsResponse:
    summary = _project_summary(project)

    active_members = [
        ProjectMemberResponse(
            id=membership.id,
            user=_user_summary(membership.user),
            joined_at=membership.joined_at,
        )
        for membership in project.memberships
        if membership.removed_at is None
    ]

    return ProjectDetailsResponse(
        **summary.model_dump(),
        members=active_members,
    )


def _raise_service_error(error: ProjectServiceError) -> None:
    raise HTTPException(
        status_code=error.status_code,
        detail=error.message,
    ) from error


def _ensure_project_access(project: Project, user: User) -> None:
    """Restrict project visibility to Admins, assigned PMs and active members."""
    if user.role.code == "ADMIN":
        return

    if user.role.code == "PM" and project.project_manager_id == user.id:
        return

    if user.role.code in {"DEVELOPER", "TESTER"}:
        is_active_member = any(
            membership.user_id == user.id and membership.removed_at is None
            for membership in project.memberships
        )

        if is_active_member:
            return

    raise HTTPException(
        status_code=404,
        detail="Project not found.",
    )


def _ensure_project_management_access(project: Project, user: User) -> None:
    """Allow Admins to manage all projects and PMs their assigned projects."""
    if user.role.code == "ADMIN":
        return

    if user.role.code == "PM" and project.project_manager_id == user.id:
        return

    raise HTTPException(
        status_code=404,
        detail="Project not found.",
    )


def _handle_database_error(db: Session) -> HTTPException:
    db.rollback()
    return HTTPException(
        status_code=409,
        detail="A project with this key or membership already exists.",
    )


@router.get("", response_model=ProjectListResponse)
@limiter.limit("60/minute")
def get_projects(
    request: Request,
    status: str = Query(
        default="ALL",
        pattern="^(ALL|PLANNING|ACTIVE|ON_HOLD|COMPLETED|ARCHIVED)$",
    ),
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    projects, total = project_service.list_projects(
        db,
        current_user=current_user,
        status_filter=status,
        search=search,
        page=page,
        page_size=page_size,
    )

    return ProjectListResponse(
        items=[_project_summary(project) for project in projects],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.post(
    "",
    response_model=ProjectDetailsResponse,
    status_code=201,
)
@limiter.limit("20/minute")
def create_new_project(
    request: Request,
    data: ProjectCreateRequest,
    actor: User = Depends(get_admin_or_pm_user),
    db: Session = Depends(get_db),
) -> ProjectDetailsResponse:
    try:
        project = project_service.create_project(
            db,
            actor=actor,
            data=data,
        )
    except ProjectServiceError as error:
        _raise_service_error(error)
    except IntegrityError:
        raise _handle_database_error(db) from None

    return _project_details(project)


@router.get("/options", response_model=ProjectOptionsResponse)
@limiter.limit("60/minute")
def get_project_form_options(
    request: Request,
    team_id: UUID | None = None,
    actor: User = Depends(get_admin_or_pm_user),
    db: Session = Depends(get_db),
) -> ProjectOptionsResponse:
    try:
        teams, managers, members = project_service.get_project_options(
            db,
            current_user=actor,
            team_id=team_id,
        )
    except ProjectServiceError as error:
        _raise_service_error(error)

    return ProjectOptionsResponse(
        teams=[ProjectTeamSummaryResponse(id=team.id, name=team.name) for team in teams],
        project_managers=[_user_summary(manager) for manager in managers],
        team_members=[_user_summary(member) for member in members],
    )


@router.get("/{project_id}", response_model=ProjectDetailsResponse)
@limiter.limit("60/minute")
def get_project_details(
    request: Request,
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDetailsResponse:
    try:
        project = project_service.get_project(db, project_id)
    except ProjectServiceError as error:
        _raise_service_error(error)

    _ensure_project_access(project, current_user)
    return _project_details(project)


@router.patch("/{project_id}", response_model=ProjectDetailsResponse)
@limiter.limit("30/minute")
def update_existing_project(
    request: Request,
    project_id: UUID,
    data: ProjectUpdateRequest,
    actor: User = Depends(get_admin_or_pm_user),
    db: Session = Depends(get_db),
) -> ProjectDetailsResponse:
    try:
        existing_project = project_service.get_project(db, project_id)
        _ensure_project_management_access(existing_project, actor)

        # Only Admins can reassign the Project Manager.
        if actor.role.code == "PM" and "project_manager_id" in data.model_fields_set:
            raise HTTPException(
                status_code=403,
                detail="Only Administrators can reassign a project manager.",
            )

        project = project_service.update_project(
            db,
            project_id=project_id,
            data=data,
        )
    except ProjectServiceError as error:
        _raise_service_error(error)
    except IntegrityError:
        raise _handle_database_error(db) from None

    return _project_details(project)


@router.post(
    "/{project_id}/members",
    response_model=ProjectDetailsResponse,
)
@limiter.limit("30/minute")
def add_project_member(
    request: Request,
    project_id: UUID,
    data: ProjectMemberAddRequest,
    actor: User = Depends(get_admin_or_pm_user),
    db: Session = Depends(get_db),
) -> ProjectDetailsResponse:
    try:
        existing_project = project_service.get_project(db, project_id)
        _ensure_project_management_access(existing_project, actor)

        project = project_service.add_project_member(
            db,
            project_id=project_id,
            user_id=data.user_id,
            actor_id=actor.id,
        )
    except ProjectServiceError as error:
        _raise_service_error(error)
    except IntegrityError:
        raise _handle_database_error(db) from None

    return _project_details(project)


@router.delete(
    "/{project_id}/members/{user_id}",
    response_model=ProjectMemberRemoveResponse,
)
@limiter.limit("30/minute")
def remove_project_member(
    request: Request,
    project_id: UUID,
    user_id: UUID,
    actor: User = Depends(get_admin_or_pm_user),
    db: Session = Depends(get_db),
) -> ProjectMemberRemoveResponse:
    try:
        existing_project = project_service.get_project(db, project_id)
        _ensure_project_management_access(existing_project, actor)

        removed_at = project_service.remove_project_member(
            db,
            project_id=project_id,
            user_id=user_id,
        )
    except ProjectServiceError as error:
        _raise_service_error(error)

    return ProjectMemberRemoveResponse(
        message="Project member removed successfully.",
        project_id=project_id,
        user_id=user_id,
        removed_at=removed_at,
    )


@router.post(
    "/{project_id}/archive",
    response_model=ProjectDetailsResponse,
)
@limiter.limit("20/minute")
def archive_existing_project(
    request: Request,
    project_id: UUID,
    actor: User = Depends(get_admin_or_pm_user),
    db: Session = Depends(get_db),
) -> ProjectDetailsResponse:
    try:
        existing_project = project_service.get_project(db, project_id)
        _ensure_project_management_access(existing_project, actor)

        project = project_service.archive_project(
            db,
            project_id=project_id,
        )
    except ProjectServiceError as error:
        _raise_service_error(error)

    return _project_details(project)
