from datetime import timedelta
from uuid import uuid4

import jwt
import pytest

from app.core.security import (
    create_signed_token,
    decode_signed_token,
    generate_invitation_token,
    generate_refresh_token,
    hash_invitation_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_hash_and_verification() -> None:
    password = "A-Strong-Test-Password-2026!"
    hashed = hash_password(password)

    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed)
    assert not verify_password("incorrect-password", hashed)


def test_refresh_tokens_are_random_and_hashed() -> None:
    first = generate_refresh_token()
    second = generate_refresh_token()

    assert first != second
    assert hash_refresh_token(first) != first
    assert hash_refresh_token(first) == hash_refresh_token(first)


def test_access_token_round_trip() -> None:
    user_id = uuid4()
    session_id = uuid4()

    token = create_signed_token(
        user_id=user_id,
        session_id=session_id,
        token_type="access",
        lifetime=timedelta(minutes=15),
    )

    payload = decode_signed_token(token, "access")

    assert payload["sub"] == str(user_id)
    assert payload["sid"] == str(session_id)
    assert payload["token_type"] == "access"


def test_access_token_cannot_be_used_as_refresh_token() -> None:
    token = create_signed_token(
        user_id=uuid4(),
        session_id=uuid4(),
        token_type="access",
        lifetime=timedelta(minutes=15),
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_signed_token(token, "refresh")


def test_expired_access_token_is_rejected() -> None:
    token = create_signed_token(
        user_id=uuid4(),
        session_id=uuid4(),
        token_type="access",
        lifetime=timedelta(seconds=-10),
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_signed_token(token, "access")


def test_invitation_tokens_are_random_and_hashed() -> None:
    first = generate_invitation_token()
    second = generate_invitation_token()

    assert first != second
    assert len(first) >= 64
    assert hash_invitation_token(first) != first
    assert hash_invitation_token(first) == hash_invitation_token(first)
    assert hash_invitation_token(first) != hash_invitation_token(second)


def test_invitation_token_hash_is_deterministic() -> None:
    token = "sample-invitation-token"

    first_hash = hash_invitation_token(token)
    second_hash = hash_invitation_token(token)

    assert first_hash == second_hash
    assert len(first_hash) == 64
