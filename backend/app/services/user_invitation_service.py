from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import quote
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import get_settings
from app.core.security import generate_invitation_token, hash_invitation_token, hash_password
from app.models import Role, Team, TeamMember, User, UserInvitation


class InvitationServiceError(Exception):
    """Represent an expected invitation business-rule failure."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _utc(value: datetime) -> datetime:
    """Normalize database datetimes to UTC, including SQLite naive values."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def invitation_status(
    invitation: UserInvitation,
    now: datetime | None = None,
) -> str:
    """Calculate the current invitation status from its timestamps."""
    now = now or datetime.now(UTC)
    expires_at = _utc(invitation.expires_at)

    if invitation.accepted_at is not None:
        return "ACCEPTED"

    if invitation.revoked_at is not None:
        if expires_at <= _utc(invitation.revoked_at):
            return "EXPIRED"
        return "REVOKED"

    if expires_at <= now:
        return "EXPIRED"

    return "PENDING"


def create_invitation(
    db: Session,
    *,
    full_name: str,
    email: str,
    employee_id: str | None,
    role_code: str,
    team_ids: list[UUID],
    invited_by: User,
) -> tuple[UserInvitation, str]:
    """Create an invitation and return it with its one-time invitation URL."""
    now = datetime.now(UTC)
    normalized_email = email.strip().lower()

    settings = get_settings()
    if settings.invitation_expire_days < 1:
        raise RuntimeError("INVITATION_EXPIRE_DAYS must be at least 1.")

    # An existing account must never receive an invitation for the same email.
    existing_user = db.scalar(select(User.id).where(func.lower(User.email) == normalized_email))
    if existing_user is not None:
        raise InvitationServiceError(
            409,
            "An account with this email address already exists.",
        )

    # Validate the selected role.
    role = db.scalar(select(Role).where(Role.code == role_code))
    if role is None:
        raise InvitationServiceError(422, "The selected role is not available.")

    # Validate every selected team. Archived or inactive teams cannot receive
    # new members through an invitation.
    teams: list[Team] = []

    if team_ids:
        teams = list(
            db.scalars(
                select(Team).where(
                    Team.id.in_(team_ids),
                    Team.status == "ACTIVE",
                    Team.archived_at.is_(None),
                )
            ).all()
        )

        if len(teams) != len(team_ids):
            raise InvitationServiceError(
                422,
                "One or more selected teams do not exist or are inactive.",
            )

    # Expired pending invitations must be marked so that the partial unique
    # pending-email index permits a replacement invitation.
    old_invitations = db.scalars(
        select(UserInvitation)
        .where(
            func.lower(UserInvitation.email) == normalized_email,
            UserInvitation.accepted_at.is_(None),
            UserInvitation.revoked_at.is_(None),
        )
        .with_for_update()
    ).all()

    for old_invitation in old_invitations:
        if _utc(old_invitation.expires_at) <= now:
            old_invitation.revoked_at = now

    db.flush()

    # Reject another invitation that is still pending.
    pending = db.scalar(
        select(UserInvitation.id).where(
            func.lower(UserInvitation.email) == normalized_email,
            UserInvitation.accepted_at.is_(None),
            UserInvitation.revoked_at.is_(None),
            UserInvitation.expires_at > now,
        )
    )

    if pending is not None:
        raise InvitationServiceError(
            409,
            "A pending invitation already exists for this email address.",
        )

    # Generate a high-entropy token. Only its digest is stored.
    raw_token = generate_invitation_token()

    invitation = UserInvitation(
        full_name=full_name,
        email=normalized_email,
        employee_id=employee_id,
        role=role,
        invited_by_user_id=invited_by.id,
        token_hash=hash_invitation_token(raw_token),
        expires_at=now + timedelta(days=settings.invitation_expire_days),
        teams=teams,
    )

    db.add(invitation)
    db.flush()

    base_url = settings.frontend_base_url.rstrip("/")
    invitation_url = f"{base_url}/accept-invitation#token={quote(raw_token, safe='')}"

    return invitation, invitation_url


def list_invitations(
    db: Session,
    *,
    page: int,
    page_size: int,
) -> tuple[list[UserInvitation], int]:
    """Return invitations with role and team details using pagination."""
    total = db.scalar(select(func.count(UserInvitation.id))) or 0

    statement = (
        select(UserInvitation)
        .options(
            joinedload(UserInvitation.role),
            selectinload(UserInvitation.teams),
        )
        .order_by(UserInvitation.created_at.desc(), UserInvitation.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    invitations = list(db.scalars(statement).unique().all())

    return invitations, total


def accept_invitation(
    db: Session,
    *,
    token: str,
    password: str,
) -> User:
    """Create an employee account and accept an invitation atomically."""
    now = datetime.now(UTC)
    token_digest = hash_invitation_token(token)

    # Lock the invitation row to prevent two concurrent acceptance requests.
    invitation = db.scalar(
        select(UserInvitation)
        .options(
            joinedload(UserInvitation.role),
            selectinload(UserInvitation.teams),
        )
        .where(UserInvitation.token_hash == token_digest)
        .with_for_update(of=UserInvitation)
    )

    if invitation is None:
        raise InvitationServiceError(
            400,
            "The invitation token is invalid or unavailable.",
        )

    if invitation.accepted_at is not None or invitation.revoked_at is not None:
        raise InvitationServiceError(
            409,
            "This invitation has already been used or revoked.",
        )

    if _utc(invitation.expires_at) <= now:
        raise InvitationServiceError(
            410,
            "This invitation has expired.",
        )

    if any(team.status != "ACTIVE" or team.archived_at is not None for team in invitation.teams):
        raise InvitationServiceError(
            409,
            "One or more teams assigned to this invitation are no longer active.",
        )

    # Recheck account existence in case another account was created after
    # this invitation was issued.
    existing_user = db.scalar(
        select(User.id).where(func.lower(User.email) == invitation.email.lower())
    )

    if existing_user is not None:
        raise InvitationServiceError(
            409,
            "An account with this email address already exists.",
        )

    user = User(
        full_name=invitation.full_name,
        email=invitation.email,
        employee_id=invitation.employee_id,
        password_hash=hash_password(password),
        role=invitation.role,
        is_active=True,
    )

    db.add(user)
    db.flush()

    # The invitation can contain zero or more teams.
    for team in invitation.teams:
        db.add(
            TeamMember(
                team_id=team.id,
                user_id=user.id,
            )
        )

    invitation.accepted_at = now
    invitation.accepted_user_id = user.id

    db.flush()

    return user


def revoke_invitation(
    db: Session,
    *,
    invitation_id: UUID,
) -> UserInvitation:
    """Revoke a pending invitation."""
    now = datetime.now(UTC)

    invitation = db.scalar(
        select(UserInvitation).where(UserInvitation.id == invitation_id).with_for_update()
    )

    if invitation is None:
        raise InvitationServiceError(404, "Invitation not found.")

    if invitation.accepted_at is not None:
        raise InvitationServiceError(
            409,
            "An accepted invitation cannot be revoked.",
        )

    if invitation.revoked_at is not None:
        raise InvitationServiceError(
            409,
            "This invitation has already been revoked.",
        )

    if _utc(invitation.expires_at) <= now:
        raise InvitationServiceError(
            410,
            "This invitation has expired.",
        )

    invitation.revoked_at = now
    db.flush()

    return invitation
