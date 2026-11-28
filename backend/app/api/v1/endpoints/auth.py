from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload
from starlette import status

from app.api.v1.dependencies.auth import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import (
    decode_signed_token,
    hash_refresh_token,
    verify_password_or_dummy,
)
from app.models import AuthSession, User
from app.schemas.auth import (
    AuthResponse,
    AuthUserResponse,
    SignInRequest,
    TokenVerificationResponse,
)
from app.services.auth_service import (
    clear_auth_cookies,
    create_refresh_session,
    set_access_refresh_cookies,
    set_auth_cookies,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def public_user(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role_code=user.role.code,
        role_name=user.role.name,
        is_active=user.is_active,
    )


def invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/sign", response_model=AuthResponse)
@limiter.limit("5/minute")
def sign_in(
    request: Request,
    data: SignInRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Authenticate an active employee and issue three HttpOnly cookies."""
    user = db.scalar(
        select(User).options(joinedload(User.role)).where(func.lower(User.email) == data.email)
    )

    password_matches = verify_password_or_dummy(
        data.password,
        user.password_hash if user is not None else None,
    )

    if user is None or not password_matches:
        raise invalid_credentials()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account has been deactivated. "
                "Please contact your administrator to reactivate your account."
            ),
        )

    try:
        auth_session, refresh_token = create_refresh_session(db, user)
        user.last_login_at = datetime.now(UTC)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to create an authentication session.",
        ) from None

    set_auth_cookies(response, user, auth_session, refresh_token)

    return AuthResponse(
        message="Login successful.",
        user=public_user(user),
    )


@router.get("/verify-token", response_model=TokenVerificationResponse)
def verify_token(
    user: User = Depends(get_current_user),
) -> TokenVerificationResponse:
    """Validate the access token and return the authenticated employee."""
    return TokenVerificationResponse(
        valid=True,
        user=public_user(user),
    )


@router.get("/id-token/verify", response_model=TokenVerificationResponse)
def verify_id_token(
    response: Response,
    id_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> TokenVerificationResponse:
    """Validate the ID token once after sign-in; never use it for API authorization."""
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ID token missing or invalid.",
        )

    try:
        payload = decode_signed_token(id_token, "id")
        user_id = UUID(payload["sub"])
        session_id = UUID(payload["sid"])
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ID token missing or invalid.",
        ) from None

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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ID token missing or invalid.",
        )

    user = db.scalar(
        select(User)
        .options(joinedload(User.role))
        .where(User.id == user_id, User.is_active.is_(True))
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ID token missing or invalid.",
        )

    # The ID token is a one-time sign-in identity assertion, not a session token.
    settings = get_settings()
    cookie_options = {
        "secure": settings.cookie_secure,
        "httponly": True,
        "samesite": "lax",
    }
    response.delete_cookie(
        "id_token",
        path="/api/v1/auth/id-token/verify",
        **cookie_options,
    )
    return TokenVerificationResponse(valid=True, user=public_user(user))


@router.post("/refresh-token", response_model=AuthResponse)
@limiter.limit("10/minute")
def refresh_token_endpoint(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Rotate the opaque refresh token and issue a new token set."""
    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail="Refresh token missing.",
        )

    token_hash = hash_refresh_token(refresh_token)
    now = datetime.now(UTC)

    try:
        old_session = db.scalar(
            select(AuthSession).where(AuthSession.token_hash == token_hash).with_for_update()
        )

        if old_session is None:
            raise HTTPException(
                status_code=401,
                detail="Refresh token invalid or expired.",
            )

        if old_session.revoked_at is not None:
            # Reuse of a token that was already rotated indicates possible theft.
            if old_session.replaced_by_session_id is not None:
                db.execute(
                    update(AuthSession)
                    .where(
                        AuthSession.user_id == old_session.user_id,
                        AuthSession.revoked_at.is_(None),
                    )
                    .values(revoked_at=now)
                )
                db.commit()

                raise HTTPException(
                    status_code=401,
                    detail="Refresh token reuse detected. Active sessions revoked.",
                )

            raise HTTPException(
                status_code=401,
                detail="Refresh token invalid or expired.",
            )

        expires_at = old_session.expires_at

        # SQLite returns naive datetimes even for timezone-aware columns.
        # Normalize database values before comparing them with UTC.
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        else:
            expires_at = expires_at.astimezone(UTC)

        if expires_at <= now:
            old_session.revoked_at = now
            db.commit()
            raise HTTPException(
                status_code=401,
                detail="Refresh token invalid or expired.",
            )

        user = db.scalar(
            select(User)
            .options(joinedload(User.role))
            .where(
                User.id == old_session.user_id,
                User.is_active.is_(True),
            )
        )

        if user is None:
            old_session.revoked_at = now
            db.commit()
            raise HTTPException(
                status_code=401,
                detail="Account unavailable.",
            )

        new_session, new_refresh_token = create_refresh_session(db, user)

        old_session.revoked_at = now
        old_session.replaced_by_session_id = new_session.id

        db.commit()

    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to refresh the authentication session.",
        ) from None

    set_access_refresh_cookies(response, user, new_session, new_refresh_token)

    return AuthResponse(
        message="Tokens refreshed successfully.",
        user=public_user(user),
    )


@router.post("/logout")
@router.post("/refresh-token/logout")
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Revoke the current session and clear current plus legacy auth cookies.

    Both routes receive the refresh cookie scoped to /api/v1/auth. The normal
    /logout route is used by the workspace; /refresh-token/logout remains as a
    backward-compatible alias for clients from previous releases.
    """
    now = datetime.now(UTC)
    auth_session: AuthSession | None = None

    try:
        if refresh_token:
            auth_session = db.scalar(
                select(AuthSession)
                .where(AuthSession.token_hash == hash_refresh_token(refresh_token))
                .with_for_update()
            )

        if auth_session is None and access_token:
            try:
                payload = decode_signed_token(access_token, "access")
                user_id = UUID(payload["sub"])
                session_id = UUID(payload["sid"])
            except (jwt.PyJWTError, ValueError, TypeError, KeyError):
                user_id = None
                session_id = None

            if user_id is not None and session_id is not None:
                auth_session = db.scalar(
                    select(AuthSession)
                    .where(
                        AuthSession.id == session_id,
                        AuthSession.user_id == user_id,
                        AuthSession.revoked_at.is_(None),
                    )
                    .with_for_update()
                )

        if auth_session is not None and auth_session.revoked_at is None:
            auth_session.revoked_at = now

        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to revoke the authentication session.",
        ) from None

    clear_auth_cookies(response)
    return {"message": "Logged out successfully."}
