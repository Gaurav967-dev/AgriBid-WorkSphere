from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import joinedload, selectinload
from starlette import status

from app.api.v1.dependencies.auth import get_admin_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import AuthSession, Role, Team, TeamMember, User, UserInvitation
from app.schemas.auth import AuthUserResponse
from app.schemas.user_invitation import (
    InvitationAcceptRequest,
    InvitationAcceptResponse,
    InvitationCreatedResponse,
    InvitationCreateRequest,
    InvitationDetailsResponse,
    InvitationListResponse,
    InvitationRevokeResponse,
    InvitationTeamResponse,
)
from app.schemas.user_management import (
    UserDetailResponse,
    UserListResponse,
    UserManagementListResponse,
    UserManagementRecordResponse,
    UserManagementTeamResponse,
    UserStatusUpdateRequest,
    UserSummaryResponse,
    UserTeamSummaryResponse,
    UserUpdateRequest,
)
from app.services.user_invitation_service import (
    InvitationServiceError,
    accept_invitation,
    create_invitation,
    invitation_status,
    list_invitations,
    revoke_invitation,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["User Management"])


@router.get(
    "",
    response_model=UserListResponse,
)
@limiter.limit("60/minute")
def get_active_users(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    admin: User = Depends(get_admin_user),
    db=Depends(get_db),
) -> UserListResponse:
    """Return paginated active employees. Admin access required."""
    try:
        filters = [User.is_active.is_(True)]

        search_term = search.strip() if search else None

        if search_term:
            pattern = f"%{search_term}%"
            filters.append(
                or_(
                    User.full_name.ilike(pattern),
                    User.email.ilike(pattern),
                    User.employee_id.ilike(pattern),
                )
            )

        total = db.scalar(select(func.count(User.id)).where(*filters)) or 0

        users = db.scalars(
            select(User)
            .options(joinedload(User.role))
            .where(*filters)
            .order_by(User.full_name.asc(), User.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()

        return UserListResponse(
            items=[
                UserSummaryResponse(
                    id=user.id,
                    full_name=user.full_name,
                    email=user.email,
                    employee_id=user.employee_id,
                    role_code=user.role.code,
                    role_name=user.role.name,
                    is_active=user.is_active,
                )
                for user in users
            ],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    except SQLAlchemyError:
        raise _database_error("Unable to retrieve active users.") from None


@router.get(
    "/management",
    response_model=UserManagementListResponse,
)
@limiter.limit("60/minute")
def get_user_management_records(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    account_status: Literal["ALL", "ACTIVE", "INACTIVE", "PENDING", "REVOKED", "EXPIRED"] = "ALL",
    role_code: Literal["ADMIN", "PM", "DEVELOPER", "TESTER"] | None = None,
    team_id: UUID | None = None,
    sort_by: Literal[
        "full_name",
        "email",
        "employee_id",
        "role",
        "teams",
        "status",
        "created_at",
        "last_login_at",
    ] = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
    admin: User = Depends(get_admin_user),
    db=Depends(get_db),
) -> UserManagementListResponse:
    """Return one searchable, filterable directory of employees and open invitation records."""
    try:
        employee_rows = db.scalars(
            select(User).options(
                joinedload(User.role),
                selectinload(User.team_memberships).joinedload(TeamMember.team),
            )
        ).all()

        invitation_rows = db.scalars(
            select(UserInvitation)
            .options(
                joinedload(UserInvitation.role),
                selectinload(UserInvitation.teams),
            )
            .where(
                UserInvitation.accepted_user_id.is_(None),
                UserInvitation.accepted_at.is_(None),
            )
        ).all()

        records: list[UserManagementRecordResponse] = []

        for employee in employee_rows:
            teams = [
                UserManagementTeamResponse(id=membership.team.id, name=membership.team.name)
                for membership in employee.team_memberships
                if membership.removed_at is None
            ]
            records.append(
                UserManagementRecordResponse(
                    id=employee.id,
                    record_type="EMPLOYEE",
                    user_id=employee.id,
                    full_name=employee.full_name,
                    email=employee.email,
                    profile_image_key=employee.profile_image_key,
                    employee_id=employee.employee_id,
                    role_code=employee.role.code,
                    role_name=employee.role.name,
                    teams=teams,
                    account_status="ACTIVE" if employee.is_active else "INACTIVE",
                    created_at=employee.created_at,
                    last_login_at=employee.last_login_at,
                )
            )

        for invitation in invitation_rows:
            current_status = invitation_status(invitation)
            if current_status == "ACCEPTED":
                continue
            records.append(
                UserManagementRecordResponse(
                    id=invitation.id,
                    record_type="INVITATION",
                    invitation_id=invitation.id,
                    full_name=invitation.full_name,
                    email=invitation.email,
                    profile_image_key=None,
                    employee_id=invitation.employee_id,
                    role_code=invitation.role.code,
                    role_name=invitation.role.name,
                    teams=[
                        UserManagementTeamResponse(id=team.id, name=team.name)
                        for team in invitation.teams
                    ],
                    account_status=current_status,
                    created_at=invitation.created_at,
                    last_login_at=None,
                    expires_at=invitation.expires_at,
                )
            )

        search_value = search.strip().casefold() if search else ""
        filtered: list[UserManagementRecordResponse] = []
        for record in records:
            if account_status != "ALL" and record.account_status != account_status:
                continue
            if role_code and record.role_code != role_code:
                continue
            if team_id and all(team.id != team_id for team in record.teams):
                continue
            if search_value:
                searchable = " ".join(
                    [
                        record.full_name,
                        record.email,
                        record.employee_id or "",
                        record.role_name,
                        " ".join(team.name for team in record.teams),
                    ]
                ).casefold()
                if search_value not in searchable:
                    continue
            filtered.append(record)

        def sort_value(record: UserManagementRecordResponse):
            if sort_by == "role":
                value = record.role_name
            elif sort_by == "teams":
                value = ", ".join(team.name for team in record.teams)
            elif sort_by == "status":
                value = record.account_status
            else:
                value = getattr(record, sort_by)
            if value is None:
                return None
            if isinstance(value, datetime):
                return value.timestamp()
            return str(value).casefold()

        present = [record for record in filtered if sort_value(record) is not None]
        missing = [record for record in filtered if sort_value(record) is None]
        present.sort(key=sort_value, reverse=sort_order == "desc")
        filtered = present + missing

        total = len(filtered)
        start = (page - 1) * page_size
        items = filtered[start : start + page_size]
        return UserManagementListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )
    except SQLAlchemyError:
        logger.exception("Unable to retrieve the combined user-management directory.")
        raise _database_error("Unable to retrieve user-management records.") from None


def _invitation_response(
    invitation: UserInvitation,
) -> InvitationDetailsResponse:
    """Build a safe invitation response without exposing its token hash."""
    return InvitationDetailsResponse(
        id=invitation.id,
        full_name=invitation.full_name,
        email=invitation.email,
        employee_id=invitation.employee_id,
        role_code=invitation.role.code,
        role_name=invitation.role.name,
        teams=[InvitationTeamResponse(id=team.id, name=team.name) for team in invitation.teams],
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        revoked_at=invitation.revoked_at,
        status=invitation_status(invitation),
    )


def _auth_user_response(user: User) -> AuthUserResponse:
    """Build the standard authenticated-user response."""
    return AuthUserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role_code=user.role.code,
        role_name=user.role.name,
        is_active=user.is_active,
    )


def _raise_service_error(error: InvitationServiceError) -> None:
    raise HTTPException(
        status_code=error.status_code,
        detail=error.detail,
    ) from None


def _database_error(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=detail,
    )


@router.post(
    "/invitations",
    response_model=InvitationCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
def create_user_invitation(
    request: Request,
    data: InvitationCreateRequest,
    admin: User = Depends(get_admin_user),
    db=Depends(get_db),
) -> InvitationCreatedResponse:
    """Create an invitation for a new employee. Admin access required."""
    try:
        invitation, invitation_url = create_invitation(
            db,
            full_name=data.full_name,
            email=data.email,
            employee_id=data.employee_id,
            role_code=data.role_code,
            team_ids=data.team_ids,
            invited_by=admin,
        )

        db.commit()

        invitation = db.scalar(
            select(UserInvitation)
            .options(
                joinedload(UserInvitation.role),
                selectinload(UserInvitation.teams),
            )
            .where(UserInvitation.id == invitation.id)
        )

        if invitation is None:
            raise _database_error("Unable to retrieve the created invitation.")

        details = _invitation_response(invitation)

        return InvitationCreatedResponse(
            **details.model_dump(),
            invitation_url=invitation_url,
        )

    except InvitationServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An invitation or account with this email already exists.",
        ) from None

    except SQLAlchemyError:
        db.rollback()
        raise _database_error("Unable to create the invitation.") from None


@router.get(
    "/invitations",
    response_model=InvitationListResponse,
)
@limiter.limit("60/minute")
def get_user_invitations(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db=Depends(get_db),
) -> InvitationListResponse:
    """Return paginated invitations. Admin access required."""
    try:
        invitations, total = list_invitations(
            db,
            page=page,
            page_size=page_size,
        )

        return InvitationListResponse(
            items=[_invitation_response(invitation) for invitation in invitations],
            total=total,
            page=page,
            page_size=page_size,
        )

    except SQLAlchemyError:
        raise _database_error("Unable to retrieve invitations.") from None


@router.post(
    "/invitations/accept",
    response_model=InvitationAcceptResponse,
)
@limiter.limit("5/minute")
def accept_user_invitation(
    request: Request,
    data: InvitationAcceptRequest,
    db=Depends(get_db),
) -> InvitationAcceptResponse:
    """Accept an invitation and create the employee account."""
    try:
        user = accept_invitation(
            db,
            token=data.token,
            password=data.password,
        )

        db.commit()

        user = db.scalar(select(User).options(joinedload(User.role)).where(User.id == user.id))

        if user is None:
            raise _database_error("Unable to retrieve the created account.")

        return InvitationAcceptResponse(
            message="Invitation accepted. Your account has been created.",
            user=_auth_user_response(user),
        )

    except InvitationServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The account could not be created because of a duplicate or conflicting record.",
        ) from None

    except SQLAlchemyError:
        logger.exception("Database error occurred while accepting employee invitation.")
        db.rollback()
        raise _database_error("Unable to accept the invitation.") from None


@router.post(
    "/invitations/{invitation_id}/revoke",
    response_model=InvitationRevokeResponse,
)
@limiter.limit("20/minute")
def revoke_user_invitation(
    request: Request,
    invitation_id: UUID,
    admin: User = Depends(get_admin_user),
    db=Depends(get_db),
) -> InvitationRevokeResponse:
    """Revoke a pending invitation. Admin access required."""
    try:
        invitation = revoke_invitation(
            db,
            invitation_id=invitation_id,
        )

        db.commit()

        return InvitationRevokeResponse(
            message="Invitation revoked successfully.",
            invitation_id=invitation.id,
            revoked_at=invitation.revoked_at or datetime.now(UTC),
        )

    except InvitationServiceError as error:
        db.rollback()
        _raise_service_error(error)

    except SQLAlchemyError:
        db.rollback()
        raise _database_error("Unable to revoke the invitation.") from None


def _get_user_with_relationships(db, user_id: UUID) -> User | None:
    return db.scalar(
        select(User)
        .options(
            joinedload(User.role),
            selectinload(User.team_memberships).joinedload(TeamMember.team),
        )
        .where(User.id == user_id)
    )


def _user_detail_response(user: User) -> UserDetailResponse:
    return UserDetailResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        employee_id=user.employee_id,
        role_code=user.role.code,
        role_name=user.role.name,
        is_active=user.is_active,
        profile_image_key=user.profile_image_key,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at,
        deactivated_at=user.deactivated_at,
        teams=[
            UserTeamSummaryResponse(id=membership.team.id, name=membership.team.name)
            for membership in user.team_memberships
            if membership.removed_at is None and membership.team is not None
        ],
    )


@router.get("/{user_id}", response_model=UserDetailResponse)
@limiter.limit("60/minute")
def get_user_detail(
    request: Request,
    user_id: UUID,
    admin: User = Depends(get_admin_user),
    db=Depends(get_db),
) -> UserDetailResponse:
    """Return employee details and active team memberships."""
    try:
        user = _get_user_with_relationships(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="Employee not found.")
        return _user_detail_response(user)
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise _database_error("Unable to retrieve employee details.") from None


@router.patch("/{user_id}", response_model=UserDetailResponse)
@limiter.limit("30/minute")
def update_user(
    request: Request,
    user_id: UUID,
    data: UserUpdateRequest,
    admin: User = Depends(get_admin_user),
    db=Depends(get_db),
) -> UserDetailResponse:
    """Update employee name, employee ID, role, and active team memberships."""
    if not data.model_fields_set:
        raise HTTPException(status_code=422, detail="Provide at least one field to update.")

    try:
        user = _get_user_with_relationships(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="Employee not found.")

        if "full_name" in data.model_fields_set:
            full_name = (data.full_name or "").strip()
            if not full_name:
                raise HTTPException(status_code=422, detail="Full name cannot be empty.")
            user.full_name = full_name

        if "employee_id" in data.model_fields_set:
            user.employee_id = (
                data.employee_id.strip() if data.employee_id and data.employee_id.strip() else None
            )

        if "role_code" in data.model_fields_set and data.role_code is not None:
            role_code = data.role_code.strip().upper()
            role = db.scalar(select(Role).where(Role.code == role_code))
            if role is None:
                raise HTTPException(status_code=422, detail="Selected role does not exist.")
            if user.role.code == "ADMIN" and role.code != "ADMIN":
                active_admin_count = (
                    db.scalar(
                        select(func.count(User.id))
                        .join(Role, User.role_id == Role.id)
                        .where(Role.code == "ADMIN", User.is_active.is_(True))
                    )
                    or 0
                )
                if active_admin_count <= 1:
                    raise HTTPException(
                        status_code=409,
                        detail="The role of the last active administrator cannot be changed.",
                    )
            user.role_id = role.id

        if "team_ids" in data.model_fields_set and data.team_ids is not None:
            desired_team_ids = set(data.team_ids)
            if desired_team_ids:
                active_teams = db.scalars(
                    select(Team).where(
                        Team.id.in_(desired_team_ids),
                        Team.status == "ACTIVE",
                        Team.archived_at.is_(None),
                    )
                ).all()
            else:
                active_teams = []
            if {team.id for team in active_teams} != desired_team_ids:
                raise HTTPException(
                    status_code=422,
                    detail="One or more selected teams do not exist or are inactive.",
                )

            now = datetime.now(UTC)
            current_memberships = {
                membership.team_id: membership
                for membership in user.team_memberships
                if membership.removed_at is None
            }
            for team_id, membership in current_memberships.items():
                if team_id not in desired_team_ids:
                    membership.removed_at = now
            for team_id in desired_team_ids - set(current_memberships):
                db.add(TeamMember(team_id=team_id, user_id=user.id))

        db.commit()
        refreshed = _get_user_with_relationships(db, user_id)
        if refreshed is None:
            raise _database_error("Unable to retrieve the updated employee.")
        return _user_detail_response(refreshed)

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The employee could not be updated because of a conflicting record.",
        ) from None
    except SQLAlchemyError:
        db.rollback()
        raise _database_error("Unable to update the employee.") from None


@router.patch("/{user_id}/status", response_model=UserDetailResponse)
@limiter.limit("20/minute")
def update_user_status(
    request: Request,
    user_id: UUID,
    data: UserStatusUpdateRequest,
    admin: User = Depends(get_admin_user),
    db=Depends(get_db),
) -> UserDetailResponse:
    """Activate/deactivate an employee; deactivation revokes their sessions."""
    try:
        user = _get_user_with_relationships(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="Employee not found.")

        if user.is_active == data.is_active:
            return _user_detail_response(user)

        if not data.is_active:
            if user.id == admin.id:
                raise HTTPException(
                    status_code=409, detail="You cannot deactivate your own account."
                )
            if user.role.code == "ADMIN":
                active_admin_count = (
                    db.scalar(
                        select(func.count(User.id))
                        .join(Role, User.role_id == Role.id)
                        .where(Role.code == "ADMIN", User.is_active.is_(True))
                    )
                    or 0
                )
                if active_admin_count <= 1:
                    raise HTTPException(
                        status_code=409,
                        detail="The last active administrator cannot be deactivated.",
                    )

            now = datetime.now(UTC)
            user.is_active = False
            user.deactivated_at = now
            db.execute(
                update(AuthSession)
                .where(
                    AuthSession.user_id == user.id,
                    AuthSession.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )
        else:
            user.is_active = True
            user.deactivated_at = None

        db.commit()
        refreshed = _get_user_with_relationships(db, user_id)
        if refreshed is None:
            raise _database_error("Unable to retrieve the updated employee status.")
        return _user_detail_response(refreshed)

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise _database_error("Unable to update employee status.") from None
