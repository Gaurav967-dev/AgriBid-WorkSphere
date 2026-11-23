from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import joinedload, selectinload
from starlette import status

from app.api.v1.dependencies.auth import get_admin_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import User, UserInvitation
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
from app.schemas.user_management import UserListResponse, UserSummaryResponse
from app.services.user_invitation_service import (
    InvitationServiceError,
    accept_invitation,
    create_invitation,
    invitation_status,
    list_invitations,
    revoke_invitation,
)

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
