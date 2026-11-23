from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as SQLAlchemySession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.core.database import Base, get_db
from app.core.rate_limit import limiter
from app.core.security import hash_invitation_token, hash_password, verify_password
from app.main import app
from app.models import Role, Team, TeamMember, User, UserInvitation

TEST_PASSWORD = "Valid-Test-Password-2026!"
ADMIN_EMAIL = "admin@test.agribid.ai"
DEVELOPER_EMAIL = "developer@test.agribid.ai"


@pytest.fixture
def users_environment(monkeypatch):
    """Provide an isolated database and test users for user-management tests."""
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
    monkeypatch.setattr(limiter, "enabled", False, raising=False)

    with test_session_factory() as session:
        roles = {
            "ADMIN": Role(code="ADMIN", name="Admin"),
            "PM": Role(code="PM", name="Project Manager"),
            "DEVELOPER": Role(code="DEVELOPER", name="Developer"),
            "TESTER": Role(code="TESTER", name="Tester"),
        }

        session.add_all(roles.values())
        session.flush()

        teams = [
            Team(name="Engineering", status="ACTIVE"),
            Team(name="Quality Assurance", status="ACTIVE"),
        ]
        session.add_all(teams)
        session.flush()

        admin = User(
            full_name="Test Administrator",
            email=ADMIN_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            role=roles["ADMIN"],
            is_active=True,
        )

        developer = User(
            full_name="Test Developer",
            email=DEVELOPER_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            role=roles["DEVELOPER"],
            is_active=True,
        )

        session.add_all([admin, developer])
        session.commit()

        team_ids = [team.id for team in teams]
        invitation_team_ids = [str(team_id) for team_id in team_ids]

    try:
        with TestClient(app) as client:
            yield client, test_session_factory, team_ids, invitation_team_ids
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def sign_in(client: TestClient, email: str = ADMIN_EMAIL):
    return client.post(
        "/api/v1/auth/sign",
        json={"email": email, "password": TEST_PASSWORD},
    )


def create_invitation(
    client: TestClient,
    team_ids: list[str],
    email: str = "new.employee@agribid.ai",
):
    return client.post(
        "/api/v1/users/invitations",
        json={
            "full_name": "New Employee",
            "email": email,
            "employee_id": "EMP-1001",
            "role_code": "DEVELOPER",
            "team_ids": team_ids,
        },
    )


def extract_invitation_token(invitation_url: str) -> str:
    """Extract the token from the URL fragment used by the acceptance page."""
    fragment = urlsplit(invitation_url).fragment
    values = parse_qs(fragment)

    return values["token"][0]


def test_invitation_management_requires_authentication(users_environment):
    client, _, _, team_ids = users_environment

    list_response = client.get("/api/v1/users/invitations")
    create_response = create_invitation(client, team_ids)

    assert list_response.status_code == 401
    assert create_response.status_code == 401


def test_non_admin_cannot_manage_invitations(users_environment):
    client, _, _, team_ids = users_environment

    login_response = sign_in(client, DEVELOPER_EMAIL)
    assert login_response.status_code == 200

    create_response = create_invitation(client, team_ids)
    list_response = client.get("/api/v1/users/invitations")

    assert create_response.status_code == 403
    assert list_response.status_code == 403


def test_admin_can_create_and_list_invitation_without_exposing_token(
    users_environment,
):
    client, session_factory, _, team_ids = users_environment

    assert sign_in(client).status_code == 200

    response = create_invitation(client, team_ids)

    assert response.status_code == 201

    result = response.json()
    invitation_url = result["invitation_url"]
    raw_token = extract_invitation_token(invitation_url)

    assert raw_token
    assert result["status"] == "PENDING"
    assert result["email"] == "new.employee@agribid.ai"
    assert len(result["teams"]) == 2

    with session_factory() as session:
        invitation = session.scalar(
            select(UserInvitation).where(UserInvitation.id == UUID(result["id"]))
        )

        assert invitation is not None
        assert invitation.token_hash == hash_invitation_token(raw_token)
        assert invitation.token_hash != raw_token

    list_response = client.get("/api/v1/users/invitations")

    assert list_response.status_code == 200
    listed_invitation = list_response.json()["items"][0]

    assert listed_invitation["id"] == result["id"]
    assert "token_hash" not in listed_invitation
    assert "invitation_url" not in listed_invitation


def test_duplicate_pending_invitation_is_rejected_case_insensitively(
    users_environment,
):
    client, _, _, team_ids = users_environment

    assert sign_in(client).status_code == 200

    first = create_invitation(
        client,
        team_ids,
        "duplicate@agribid.ai",
    )

    second = create_invitation(
        client,
        team_ids,
        "DUPLICATE@AGRIBID.AI",
    )

    assert first.status_code == 201
    assert second.status_code == 409


def test_accept_invitation_creates_user_and_multiple_team_memberships(
    users_environment,
):
    client, session_factory, team_ids, invitation_team_ids = users_environment

    assert sign_in(client).status_code == 200

    create_response = create_invitation(client, invitation_team_ids)
    assert create_response.status_code == 201

    token = extract_invitation_token(create_response.json()["invitation_url"])

    new_password = "New-Employee-Password-2026!"

    accept_response = client.post(
        "/api/v1/users/invitations/accept",
        json={
            "token": token,
            "password": new_password,
        },
    )

    assert accept_response.status_code == 200

    result = accept_response.json()
    assert result["user"]["email"] == "new.employee@agribid.ai"
    assert result["user"]["role_code"] == "DEVELOPER"

    user_id = UUID(result["user"]["id"])

    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == "new.employee@agribid.ai"))

        assert user is not None
        assert user.id == user_id
        assert verify_password(new_password, user.password_hash)

        memberships = session.scalars(select(TeamMember).where(TeamMember.user_id == user.id)).all()

        assert len(memberships) == 2
        assert {membership.team_id for membership in memberships} == set(team_ids)

        invitation = session.scalar(
            select(UserInvitation).where(UserInvitation.email == "new.employee@agribid.ai")
        )

        assert invitation is not None
        assert invitation.accepted_at is not None
        assert invitation.accepted_user_id == user.id

    # The same token must not create a second account.
    repeated_acceptance = client.post(
        "/api/v1/users/invitations/accept",
        json={
            "token": token,
            "password": new_password,
        },
    )

    assert repeated_acceptance.status_code == 409


def test_expired_invitation_cannot_be_accepted(users_environment):
    client, session_factory, _, team_ids = users_environment

    assert sign_in(client).status_code == 200

    create_response = create_invitation(client, team_ids)
    assert create_response.status_code == 201

    token = extract_invitation_token(create_response.json()["invitation_url"])

    with session_factory() as session:
        invitation = session.scalar(
            select(UserInvitation).where(UserInvitation.email == "new.employee@agribid.ai")
        )
        assert invitation is not None
        invitation.expires_at = datetime.now(UTC) - timedelta(days=1)
        session.commit()

    response = client.post(
        "/api/v1/users/invitations/accept",
        json={
            "token": token,
            "password": "New-Employee-Password-2026!",
        },
    )

    assert response.status_code == 410

    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == "new.employee@agribid.ai"))
        assert user is None


def test_admin_can_revoke_pending_invitation(users_environment):
    client, _, _, team_ids = users_environment

    assert sign_in(client).status_code == 200

    create_response = create_invitation(client, team_ids)
    assert create_response.status_code == 201

    invitation_id = create_response.json()["id"]
    token = extract_invitation_token(create_response.json()["invitation_url"])

    revoke_response = client.post(f"/api/v1/users/invitations/{invitation_id}/revoke")

    assert revoke_response.status_code == 200

    accept_response = client.post(
        "/api/v1/users/invitations/accept",
        json={
            "token": token,
            "password": "New-Employee-Password-2026!",
        },
    )

    assert accept_response.status_code == 409


def test_invitation_acceptance_requires_token(users_environment):
    client, _, _, _ = users_environment

    response = client.post(
        "/api/v1/users/invitations/accept",
        json={
            "token": "x" * 64,
            "password": "New-Employee-Password-2026!",
        },
    )

    assert response.status_code == 400


@pytest.mark.parametrize(
    "password",
    [
        "Short1!",
        "lowercaseonly123!",
        "NoDigitsPassword!",
    ],
)
def test_invitation_acceptance_rejects_passwords_that_violate_policy(
    users_environment,
    password,
):
    client, _, _, _ = users_environment

    response = client.post(
        "/api/v1/users/invitations/accept",
        json={
            "token": "x" * 64,
            "password": password,
        },
    )

    assert response.status_code == 422, response.text


def test_acceptance_rolls_back_if_team_membership_insert_fails(
    users_environment,
):
    client, session_factory, _, invitation_team_ids = users_environment

    assert sign_in(client).status_code == 200

    create_response = create_invitation(client, invitation_team_ids)
    assert create_response.status_code == 201

    token = extract_invitation_token(create_response.json()["invitation_url"])

    def fail_team_member_flush(session, flush_context, instances):
        if any(isinstance(item, TeamMember) for item in session.new):
            raise IntegrityError(
                "Simulated team membership insertion failure",
                {},
                RuntimeError("Simulated database failure"),
            )

    event.listen(
        SQLAlchemySession,
        "before_flush",
        fail_team_member_flush,
    )

    try:
        response = client.post(
            "/api/v1/users/invitations/accept",
            json={
                "token": token,
                "password": "New-Employee-Password-2026!",
            },
        )
    finally:
        event.remove(
            SQLAlchemySession,
            "before_flush",
            fail_team_member_flush,
        )

    assert response.status_code == 409

    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == "new.employee@agribid.ai"))
        assert user is None

        invitation = session.scalar(
            select(UserInvitation).where(UserInvitation.email == "new.employee@agribid.ai")
        )

        assert invitation is not None
        assert invitation.accepted_at is None
        assert invitation.accepted_user_id is None

        memberships = session.scalars(
            select(TeamMember).join(User).where(User.email == "new.employee@agribid.ai")
        ).all()

        assert memberships == []


def test_invitation_cannot_be_accepted_when_assigned_team_is_archived(
    users_environment,
):
    client, session_factory, team_ids, invitation_team_ids = users_environment

    assert sign_in(client).status_code == 200

    create_response = create_invitation(client, invitation_team_ids)
    assert create_response.status_code == 201

    token = extract_invitation_token(create_response.json()["invitation_url"])

    with session_factory() as session:
        team = session.get(Team, team_ids[0])
        assert team is not None

        team.archived_at = datetime.now(UTC)
        session.commit()

    response = client.post(
        "/api/v1/users/invitations/accept",
        json={
            "token": token,
            "password": "New-Employee-Password-2026!",
        },
    )

    assert response.status_code == 409

    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == "new.employee@agribid.ai"))

        assert user is None

        invitation = session.scalar(
            select(UserInvitation).where(UserInvitation.email == "new.employee@agribid.ai")
        )

        assert invitation is not None
        assert invitation.accepted_at is None


def test_active_users_list_requires_authentication(users_environment):
    client, _, _, _ = users_environment

    response = client.get("/api/v1/users")

    assert response.status_code == 401


def test_admin_can_list_and_search_active_users(users_environment):
    client, _, _, _ = users_environment

    sign_in_response = sign_in(client)
    assert sign_in_response.status_code == 200

    list_response = client.get(
        "/api/v1/users",
        params={"page": 1, "page_size": 10},
    )

    assert list_response.status_code == 200

    data = list_response.json()

    assert "items" in data
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert data["total"] >= 1

    for user in data["items"]:
        assert user["is_active"] is True
        assert user["role_code"]
        assert user["role_name"]

    search_response = client.get(
        "/api/v1/users",
        params={"search": DEVELOPER_EMAIL},
    )

    assert search_response.status_code == 200

    search_data = search_response.json()

    assert search_data["total"] == 1
    assert search_data["items"][0]["email"] == DEVELOPER_EMAIL
