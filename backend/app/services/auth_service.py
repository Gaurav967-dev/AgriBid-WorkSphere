from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_signed_token,
    generate_refresh_token,
    hash_refresh_token,
)
from app.models import AuthSession, User


def create_refresh_session(
    db: Session,
    user: User,
) -> tuple[AuthSession, str]:
    """Create a refresh session and return the raw token once."""
    settings = get_settings()
    raw_token = generate_refresh_token()

    session = AuthSession(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
    )

    db.add(session)
    db.flush()

    return session, raw_token


def _cookie_options() -> dict[str, object]:
    settings = get_settings()
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": "lax",
    }


def _create_access_token(user: User, session: AuthSession) -> str:
    settings = get_settings()
    return create_signed_token(
        user_id=user.id,
        session_id=session.id,
        token_type="access",
        lifetime=timedelta(minutes=settings.access_token_expire_minutes),
    )


def _clear_legacy_auth_cookie_paths(response: Response) -> None:
    """Remove cookies issued by the earlier, broader auth cookie paths."""
    common = _cookie_options()
    # Previous releases used /api/v1/auth and then /api/v1/auth/id-token.
    response.delete_cookie("id_token", path="/api/v1/auth", **common)
    response.delete_cookie("id_token", path="/api/v1/auth/id-token", **common)
    response.delete_cookie("refresh_token", path="/api/v1/auth", **common)


def set_auth_cookies(
    response: Response,
    user: User,
    session: AuthSession,
    refresh_token: str,
) -> None:
    """Issue the ID, access and refresh cookies after successful sign-in."""
    settings = get_settings()
    id_token = create_signed_token(
        user_id=user.id,
        session_id=session.id,
        token_type="id",
        lifetime=timedelta(minutes=settings.id_token_expire_minutes),
        identity={
            "name": user.full_name,
            "email": user.email,
            "role": user.role.code,
        },
    )
    access_token = _create_access_token(user, session)
    common = _cookie_options()

    # Clear cookies from previous releases before issuing the narrowly scoped ones.
    _clear_legacy_auth_cookie_paths(response)

    response.set_cookie(
        key="id_token",
        value=id_token,
        max_age=settings.id_token_expire_minutes * 60,
        path="/api/v1/auth/id-token/verify",
        **common,
    )
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
        **common,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/v1/auth/refresh-token",
        **common,
    )


def set_access_refresh_cookies(
    response: Response,
    user: User,
    session: AuthSession,
    refresh_token: str,
) -> None:
    """Rotate only access and refresh credentials; never reissue the ID token."""
    settings = get_settings()
    common = _cookie_options()
    access_token = _create_access_token(user, session)

    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
        **common,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/v1/auth/refresh-token",
        **common,
    )


def clear_auth_cookies(response: Response) -> None:
    """Delete current and legacy authentication cookies using their original paths."""
    common = _cookie_options()

    response.delete_cookie("id_token", path="/api/v1/auth/id-token/verify", **common)
    response.delete_cookie("id_token", path="/api/v1/auth/id-token", **common)
    response.delete_cookie("id_token", path="/api/v1/auth", **common)
    response.delete_cookie("access_token", path="/", **common)
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh-token", **common)
    response.delete_cookie("refresh_token", path="/api/v1/auth", **common)
