from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.core.database import Base, get_db
from app.core.rate_limit import limiter
from app.core.security import hash_password, hash_refresh_token
from app.main import app
from app.models import AuthSession, Role, User

TEST_PASSWORD = "Valid-Test-Password-2026!"


@pytest.fixture
def auth_environment(monkeypatch):
    """Provide an isolated SQLite database and FastAPI test client."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(engine)

    test_session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )

    def override_get_db():
        with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    # Rate limiting is tested separately; it should not make these
    # functional tests depend on execution timing.
    monkeypatch.setattr(limiter, "enabled", False, raising=False)

    try:
        with TestClient(app) as client:
            yield client, test_session_factory
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def create_test_user(
    session_factory,
    *,
    active: bool = True,
    email: str = "admin@test.agribid.ai",
):
    """Create a test ADMIN account."""
    with session_factory() as session:
        role = Role(
            id=uuid4(),
            code="ADMIN",
            name="Admin",
            description="Test administrator",
        )
        session.add(role)
        session.flush()

        user = User(
            id=uuid4(),
            role_id=role.id,
            full_name="Test Administrator",
            email=email,
            password_hash=hash_password(TEST_PASSWORD),
            is_active=active,
        )
        session.add(user)
        session.commit()

        return user.id


def sign_in(client: TestClient, password: str = TEST_PASSWORD):
    return client.post(
        "/api/v1/auth/sign",
        json={
            "email": "admin@test.agribid.ai",
            "password": password,
        },
    )


def test_sign_in_issues_three_httponly_cookies(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)

    response = sign_in(client)

    assert response.status_code == 200
    assert response.json()["user"]["role_code"] == "ADMIN"

    cookies = response.headers.get_list("set-cookie")

    issued_cookie_headers = [item for item in cookies if "max-age=0" not in item.lower()]

    assert len(issued_cookie_headers) == 3

    assert all("httponly" in item.lower() for item in cookies)

    issued_cookie_names = {item.split("=", 1)[0] for item in issued_cookie_headers}

    assert issued_cookie_names == {
        "id_token",
        "access_token",
        "refresh_token",
    }

    # Tokens are supplied as cookies, not exposed in the JSON body.
    assert "access_token" not in response.json()
    assert "refresh_token" not in response.json()
    assert "id_token" not in response.json()


def test_verify_token_returns_authenticated_user(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)

    login_response = sign_in(client)
    assert login_response.status_code == 200

    response = client.get("/api/v1/auth/verify-token")

    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["user"]["email"] == "admin@test.agribid.ai"


def test_verify_token_rejects_missing_access_token(auth_environment) -> None:
    client, _ = auth_environment

    response = client.get("/api/v1/auth/verify-token")

    assert response.status_code == 401


def test_refresh_rotates_token_and_revokes_old_session(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)

    login_response = sign_in(client)
    assert login_response.status_code == 200

    old_refresh_token = client.cookies.get("refresh_token")
    assert old_refresh_token

    refresh_response = client.post("/api/v1/auth/refresh-token")

    assert refresh_response.status_code == 200
    assert refresh_response.json()["message"] == "Tokens refreshed successfully."

    new_refresh_token = client.cookies.get("refresh_token")
    assert new_refresh_token
    assert new_refresh_token != old_refresh_token

    with session_factory() as session:
        sessions = session.scalars(
            select(AuthSession).order_by(AuthSession.created_at, AuthSession.id)
        ).all()

        assert len(sessions) == 2

        old_session_hash = hash_refresh_token(old_refresh_token)
        old_session = next(item for item in sessions if item.token_hash == old_session_hash)
        new_session = next(
            item for item in sessions if item.id == old_session.replaced_by_session_id
        )

        assert old_session.revoked_at is not None
        assert old_session.replaced_by_session_id == new_session.id
        assert new_session.revoked_at is None


def test_reused_refresh_token_revokes_active_sessions(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)

    assert sign_in(client).status_code == 200

    old_refresh_token = client.cookies.get("refresh_token")
    assert old_refresh_token

    first_refresh = client.post("/api/v1/auth/refresh-token")
    assert first_refresh.status_code == 200

    # Replay the previously rotated token from a separate client.
    replay_response = client.post(
        "/api/v1/auth/refresh-token",
        cookies={"refresh_token": old_refresh_token},
    )

    assert replay_response.status_code == 401
    assert "reuse detected" in replay_response.json()["detail"].lower()

    # The newly issued session is revoked as part of reuse detection.
    verification = client.get("/api/v1/auth/verify-token")
    assert verification.status_code == 401

    with session_factory() as session:
        active_sessions = session.scalars(
            select(AuthSession).where(AuthSession.revoked_at.is_(None))
        ).all()

        assert active_sessions == []


def test_logout_revokes_session_and_clears_cookies(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)

    assert sign_in(client).status_code == 200

    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully."

    verification = client.get("/api/v1/auth/verify-token")
    assert verification.status_code == 401

    with session_factory() as session:
        auth_sessions = session.scalars(select(AuthSession)).all()

        assert len(auth_sessions) == 1
        assert auth_sessions[0].revoked_at is not None


def test_invalid_password_returns_generic_401(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)

    response = sign_in(client, password="Wrong-Password-2026!")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."
    assert "access_token" not in client.cookies


def test_inactive_user_cannot_sign_in(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory, active=False)

    response = sign_in(client)

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Your account has been deactivated. "
        "Please contact your administrator to reactivate your account."
    )
    assert "access_token" not in client.cookies


def test_refresh_without_cookie_returns_401(auth_environment) -> None:
    client, _ = auth_environment

    response = client.post("/api/v1/auth/refresh-token")

    assert response.status_code == 401


def test_public_signup_is_not_available(auth_environment) -> None:
    client, _ = auth_environment

    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": "public@test.agribid.ai",
            "password": TEST_PASSWORD,
            "full_name": "Public User",
        },
    )

    assert response.status_code == 404


def test_auth_cookie_paths_are_scoped_to_their_endpoints(auth_environment) -> None:
    client, _ = auth_environment
    # The fixture's standard helper creates the test employee before sign-in.
    create_test_user(auth_environment[1])
    response = sign_in(client)
    assert response.status_code == 200

    cookie_headers = response.headers.get_list("set-cookie")
    cookies = {item.split("=", 1)[0]: item.lower() for item in cookie_headers}
    assert "path=/api/v1/auth/id-token" in cookies["id_token"]
    assert "path=/api/v1/auth/refresh-token" in cookies["refresh_token"]
    assert "path=/;" in cookies["access_token"] or "path=/," in cookies["access_token"]


def test_id_token_can_be_verified_once_after_sign_in(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)
    assert sign_in(client).status_code == 200

    response = client.get("/api/v1/auth/id-token/verify")

    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["user"]["role_code"] == "ADMIN"


def test_logout_revokes_session_without_refresh_cookie_on_logout_request(auth_environment) -> None:
    client, _ = auth_environment
    create_test_user(auth_environment[1])
    assert sign_in(client).status_code == 200

    # The refresh cookie's Path excludes /logout; logout must use access_token.
    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 200
    assert client.get("/api/v1/auth/verify-token").status_code == 401


def test_refresh_reissues_only_access_and_refresh_cookies(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)
    assert sign_in(client).status_code == 200

    response = client.post("/api/v1/auth/refresh-token")

    assert response.status_code == 200
    cookie_headers = response.headers.get_list("set-cookie")
    cookie_names = {item.split("=", 1)[0] for item in cookie_headers}
    assert "access_token" in cookie_names
    assert "refresh_token" in cookie_names
    assert "id_token" not in cookie_names


def test_scoped_logout_revokes_session_using_refresh_cookie(auth_environment) -> None:
    client, session_factory = auth_environment
    create_test_user(session_factory)
    assert sign_in(client).status_code == 200

    # Prove the scoped logout route can revoke without an access-token cookie.
    client.cookies.delete("access_token")
    response = client.post("/api/v1/auth/refresh-token/logout")

    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully."

    with session_factory() as session:
        auth_sessions = session.scalars(select(AuthSession)).all()
        assert len(auth_sessions) == 1
        assert auth_sessions[0].revoked_at is not None
