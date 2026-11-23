from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette import status

from app.api.v1.dependencies.auth import get_admin_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import Team, User
from app.schemas.team import (
    TeamCreateRequest,
    TeamDetailsResponse,
    TeamLeadUpdateRequest,
    TeamListResponse,
    TeamMemberAddRequest,
    TeamMemberRemoveResponse,
    TeamMemberResponse,
    TeamSummaryResponse,
    TeamUpdateRequest,
    TeamUserSummaryResponse,
)
from app.services.team_service import (
    TeamServiceError,
    add_team_member,
    archive_team,
    create_team,
    get_team,
    list_teams,
    remove_team_member,
    set_team_lead,
    update_team,
)

router = APIRouter(prefix="/teams", tags=["Team Management"])


def _user_summary(user: User | None) -> TeamUserSummaryResponse | None:
    if user is None:
        return None

    return TeamUserSummaryResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role_code=user.role.code,
        employee_id=user.employee_id,
    )


def _team_summary(
    team: Team,
    current_user_id: UUID,
) -> TeamSummaryResponse:
    active_members = [
        membership
        for membership in team.memberships
        if membership.removed_at is None and membership.user.is_active
    ]

    return TeamSummaryResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        status=team.status,
        lead=_user_summary(team.lead),
        member_count=len(active_members),
        is_joined=any(membership.user_id == current_user_id for membership in active_members),
        members_preview=[
            TeamUserSummaryResponse(
                id=membership.user.id,
                full_name=membership.user.full_name,
                email=membership.user.email,
                role_code=membership.user.role.code,
                employee_id=membership.user.employee_id,
            )
            for membership in active_members[:4]
        ],
        created_at=team.created_at,
        updated_at=team.updated_at,
        archived_at=team.archived_at,
    )


def _team_details(
    team: Team,
    current_user_id: UUID,
) -> TeamDetailsResponse:
    members = [
        TeamMemberResponse(
            id=membership.id,
            user=TeamUserSummaryResponse(
                id=membership.user.id,
                full_name=membership.user.full_name,
                email=membership.user.email,
                role_code=membership.user.role.code,
                employee_id=membership.user.employee_id,
            ),
            designation=membership.designation,
            joined_at=membership.joined_at,
        )
        for membership in team.memberships
        if membership.removed_at is None and membership.user.is_active
    ]

    members.sort(key=lambda member: member.user.full_name.casefold())

    summary = _team_summary(team, current_user_id)

    return TeamDetailsResponse(
        **summary.model_dump(),
        members=members,
    )


def _raise_service_error(error: TeamServiceError) -> None:
    raise HTTPException(
        status_code=error.status_code,
        detail=error.detail,
    ) from None


def _handle_database_error(db: Session, message: str) -> HTTPException:
    db.rollback()
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=message,
    )


@router.get("", response_model=TeamListResponse)
@limiter.limit("60/minute")
def get_teams(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    status_filter: Literal["ACTIVE", "ARCHIVED", "ALL"] = Query(
        default="ACTIVE",
        alias="status",
    ),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TeamListResponse:
    """Return a paginated team list. Admin access required."""
    try:
        teams, total = list_teams(
            db,
            page=page,
            page_size=page_size,
            search=search,
            status_filter=status_filter,
        )

        return TeamListResponse(
            items=[_team_summary(team, admin.id) for team in teams],
            total=total,
            page=page,
            page_size=page_size,
        )

    except SQLAlchemyError:
        raise _handle_database_error(
            db,
            "Unable to retrieve teams.",
        ) from None


@router.post(
    "",
    response_model=TeamDetailsResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("20/minute")
def create_new_team(
    request: Request,
    data: TeamCreateRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TeamDetailsResponse:
    """Create a team, optionally with members and a lead."""
    try:
        team = create_team(
            db,
            name=data.name,
            description=data.description,
            lead_user_id=data.lead_user_id,
            member_ids=data.member_ids,
        )

        db.commit()
        return _team_details(get_team(db, team.id), admin.id)

    except TeamServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team with this name or membership already exists.",
        ) from None

    except SQLAlchemyError:
        raise _handle_database_error(
            db,
            "Unable to create the team.",
        ) from None


@router.get("/{team_id}", response_model=TeamDetailsResponse)
@limiter.limit("60/minute")
def get_team_details(
    request: Request,
    team_id: UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TeamDetailsResponse:
    """Return team details and active members."""
    try:
        return _team_details(get_team(db, team_id), admin.id)

    except TeamServiceError as error:
        _raise_service_error(error)

    except SQLAlchemyError:
        raise _handle_database_error(
            db,
            "Unable to retrieve team details.",
        ) from None


@router.patch("/{team_id}", response_model=TeamDetailsResponse)
@limiter.limit("30/minute")
def update_existing_team(
    request: Request,
    team_id: UUID,
    data: TeamUpdateRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TeamDetailsResponse:
    """Update a team's name or description."""
    try:
        updates = data.model_dump(exclude_unset=True)

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one team field must be provided.",
            )

        team = update_team(
            db,
            team_id=team_id,
            updates=updates,
        )

        db.commit()
        return _team_details(get_team(db, team.id), admin.id)

    except TeamServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team with this name already exists.",
        ) from None

    except SQLAlchemyError:
        raise _handle_database_error(
            db,
            "Unable to update the team.",
        ) from None


@router.post("/{team_id}/members", response_model=TeamDetailsResponse)
@limiter.limit("30/minute")
def add_member(
    request: Request,
    team_id: UUID,
    data: TeamMemberAddRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TeamDetailsResponse:
    """Add an active employee to a team."""
    try:
        team = add_team_member(
            db,
            team_id=team_id,
            user_id=data.user_id,
            designation=data.designation,
        )

        db.commit()
        return _team_details(get_team(db, team.id), admin.id)

    except TeamServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The employee is already a member of this team.",
        ) from None

    except SQLAlchemyError:
        raise _handle_database_error(
            db,
            "Unable to add the team member.",
        ) from None


@router.delete(
    "/{team_id}/members/{user_id}",
    response_model=TeamMemberRemoveResponse,
)
@limiter.limit("30/minute")
def remove_member(
    request: Request,
    team_id: UUID,
    user_id: UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TeamMemberRemoveResponse:
    """Soft-remove a member while preserving membership history."""
    try:
        membership = remove_team_member(
            db,
            team_id=team_id,
            user_id=user_id,
        )

        db.commit()

        return TeamMemberRemoveResponse(
            message="Team member removed successfully.",
            team_id=membership.team_id,
            user_id=membership.user_id,
            removed_at=membership.removed_at,
        )

    except TeamServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except SQLAlchemyError:
        raise _handle_database_error(
            db,
            "Unable to remove the team member.",
        ) from None


@router.patch("/{team_id}/lead", response_model=TeamDetailsResponse)
@limiter.limit("20/minute")
def update_team_lead(
    request: Request,
    team_id: UUID,
    data: TeamLeadUpdateRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TeamDetailsResponse:
    """Assign an active team member as lead or clear the existing lead."""
    try:
        team = set_team_lead(
            db,
            team_id=team_id,
            user_id=data.user_id,
        )

        db.commit()
        return _team_details(get_team(db, team.id), admin.id)

    except TeamServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except SQLAlchemyError:
        raise _handle_database_error(
            db,
            "Unable to update the team lead.",
        ) from None


@router.post("/{team_id}/archive", response_model=TeamDetailsResponse)
@limiter.limit("20/minute")
def archive_existing_team(
    request: Request,
    team_id: UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TeamDetailsResponse:
    """Archive a team without deleting its members or history."""
    try:
        team = archive_team(db, team_id=team_id)

        db.commit()
        return _team_details(get_team(db, team.id), admin.id)

    except TeamServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except SQLAlchemyError:
        raise _handle_database_error(
            db,
            "Unable to archive the team.",
        ) from None
