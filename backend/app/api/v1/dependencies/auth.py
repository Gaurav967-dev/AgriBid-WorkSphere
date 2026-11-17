from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import decode_signed_token
from app.models import AuthSession, User


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required or session expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    authorization: str | None = Header(default=None),
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the current user from a bearer token or access cookie."""
    token: str | None = None

    if authorization:
        scheme, separator, credentials = authorization.partition(" ")

        if not separator or scheme.lower() != "bearer" or not credentials:
            raise unauthorized()

        token = credentials.strip()
    else:
        token = access_token

    if not token:
        raise unauthorized()

    try:
        payload = decode_signed_token(token, "access")
        user_id = UUID(payload["sub"])
        session_id = UUID(payload["sid"])
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise unauthorized() from None

    now = datetime.now(UTC)

    auth_session = db.scalar(
        select(AuthSession).where(
            AuthSession.id == session_id,
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
    )

    if auth_session is None:
        raise unauthorized()

    user = db.scalar(
        select(User)
        .options(joinedload(User.role))
        .where(User.id == user_id, User.is_active.is_(True))
    )

    if user is None:
        raise unauthorized()

    return user


def get_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Allow access only to authenticated administrators."""
    if current_user.role.code != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )

    return current_user
