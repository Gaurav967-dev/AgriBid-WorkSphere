from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import get_settings

password_hasher = PasswordHash.recommended()

# Used to perform a password verification even when the email does not exist.
DUMMY_PASSWORD_HASH = password_hasher.hash("work-sphere-dummy-password-never-used")


def hash_password(password: str) -> str:
    """Hash a password using the recommended Argon2 configuration."""
    return password_hasher.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password without exposing invalid-hash details."""
    try:
        return password_hasher.verify(password, hashed_password)
    except UnknownHashError:
        return False


def verify_password_or_dummy(
    password: str,
    hashed_password: str | None,
) -> bool:
    """Perform password verification for both existing and unknown users."""
    candidate_hash = hashed_password or DUMMY_PASSWORD_HASH
    is_valid = verify_password(password, candidate_hash)
    return bool(hashed_password) and is_valid


def hash_refresh_token(token: str) -> str:
    """Return a SHA-256 digest of an opaque refresh token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    """Generate a high-entropy opaque refresh token."""
    return secrets.token_urlsafe(64)


def create_signed_token(
    *,
    user_id: UUID,
    session_id: UUID,
    token_type: str,
    lifetime: timedelta,
    identity: dict[str, str] | None = None,
) -> str:
    """Create a signed JWT with fixed issuer, audience and algorithm."""
    settings = get_settings()
    now = datetime.now(UTC)

    payload: dict[str, object] = {
        "sub": str(user_id),
        "sid": str(session_id),
        "jti": str(uuid4()),
        "token_type": token_type,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "nbf": now,
        "exp": now + lifetime,
    }

    if identity:
        payload.update(identity)

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm="HS256",
    )


def decode_signed_token(token: str, expected_type: str) -> dict:
    """Decode a JWT and validate its signature, claims and intended use."""
    settings = get_settings()

    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=["HS256"],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        options={
            "require": [
                "sub",
                "sid",
                "jti",
                "token_type",
                "iss",
                "aud",
                "iat",
                "nbf",
                "exp",
            ],
        },
        leeway=5,
    )

    if payload.get("token_type") != expected_type:
        raise jwt.InvalidTokenError("Unexpected token type.")

    # Validate the UUID claims before they reach database queries.
    UUID(payload["sub"])
    UUID(payload["sid"])

    return payload
