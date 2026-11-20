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
from app.models import (
    Project,
    ProjectMember,
    Role,
    Team,
    TeamMember,
    User,
    UserInvitation,
)

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


def test_team_management_requires_authentication(users_environment):
    client, _, _, _ = users_environment

    response = client.get("/api/v1/teams")

    assert response.status_code == 401


def test_non_admin_cannot_manage_teams(users_environment):
    client, _, _, _ = users_environment

    assert sign_in(client, DEVELOPER_EMAIL).status_code == 200

    response = client.get("/api/v1/teams")

    assert response.status_code == 403


def test_admin_can_create_list_and_view_team(users_environment):
    client, session_factory, _, _ = users_environment

    assert sign_in(client).status_code == 200

    with session_factory() as session:
        developer = session.scalar(select(User).where(User.email == DEVELOPER_EMAIL))
        assert developer is not None
        developer_id = str(developer.id)

    create_response = client.post(
        "/api/v1/teams",
        json={
            "name": "Platform Engineering",
            "description": "Platform and infrastructure team",
            "lead_user_id": developer_id,
            "member_ids": [developer_id],
        },
    )

    assert create_response.status_code == 201

    created = create_response.json()
    assert created["name"] == "Platform Engineering"
    assert created["status"] == "ACTIVE"
    assert created["member_count"] == 1
    assert created["lead"]["id"] == developer_id
    assert len(created["members"]) == 1

    list_response = client.get(
        "/api/v1/teams",
        params={"search": "Platform"},
    )

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["items"][0]["id"] == created["id"]

    detail_response = client.get(f"/api/v1/teams/{created['id']}")

    assert detail_response.status_code == 200
    assert detail_response.json()["members"][0]["user"]["email"] == DEVELOPER_EMAIL


def test_team_name_is_unique_case_insensitively(users_environment):
    client, _, _, _ = users_environment

    assert sign_in(client).status_code == 200

    response = client.post(
        "/api/v1/teams",
        json={"name": "engineering"},
    )

    assert response.status_code == 409


def test_admin_can_update_team(users_environment):
    client, _, _, _ = users_environment

    assert sign_in(client).status_code == 200

    create_response = client.post(
        "/api/v1/teams",
        json={"name": "Original Team"},
    )

    assert create_response.status_code == 201

    team_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/teams/{team_id}",
        json={
            "name": "Updated Team",
            "description": "Updated description",
        },
    )

    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Team"
    assert update_response.json()["description"] == "Updated description"


def test_team_member_can_be_removed_without_deleting_history(
    users_environment,
):
    client, session_factory, _, _ = users_environment

    assert sign_in(client).status_code == 200

    with session_factory() as session:
        developer = session.scalar(select(User).where(User.email == DEVELOPER_EMAIL))
        assert developer is not None
        developer_id = str(developer.id)

    create_response = client.post(
        "/api/v1/teams",
        json={"name": "Membership Test Team"},
    )

    assert create_response.status_code == 201

    team_id = create_response.json()["id"]

    add_response = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"user_id": developer_id, "designation": "Backend Developer"},
    )

    assert add_response.status_code == 200
    assert add_response.json()["member_count"] == 1

    lead_response = client.patch(
        f"/api/v1/teams/{team_id}/lead",
        json={"user_id": developer_id},
    )

    assert lead_response.status_code == 200
    assert lead_response.json()["lead"]["id"] == developer_id

    remove_response = client.delete(f"/api/v1/teams/{team_id}/members/{developer_id}")

    assert remove_response.status_code == 200

    detail_response = client.get(f"/api/v1/teams/{team_id}")
    assert detail_response.status_code == 200

    details = detail_response.json()
    assert details["member_count"] == 0
    assert details["members"] == []
    assert details["lead"] is None

    with session_factory() as session:
        memberships = session.scalars(
            select(TeamMember).where(
                TeamMember.team_id == UUID(team_id),
                TeamMember.user_id == UUID(developer_id),
            )
        ).all()

        assert len(memberships) == 1
        assert memberships[0].removed_at is not None


def test_team_lead_must_be_an_active_member(users_environment):
    client, session_factory, _, _ = users_environment

    assert sign_in(client).status_code == 200

    with session_factory() as session:
        developer = session.scalar(select(User).where(User.email == DEVELOPER_EMAIL))
        assert developer is not None
        developer_id = str(developer.id)

    create_response = client.post(
        "/api/v1/teams",
        json={"name": "Lead Validation Team"},
    )

    assert create_response.status_code == 201

    team_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/teams/{team_id}/lead",
        json={"user_id": developer_id},
    )

    assert response.status_code == 422


def test_archived_team_is_excluded_from_active_list_and_cannot_add_members(
    users_environment,
):
    client, session_factory, _, _ = users_environment

    assert sign_in(client).status_code == 200

    with session_factory() as session:
        developer = session.scalar(select(User).where(User.email == DEVELOPER_EMAIL))
        assert developer is not None
        developer_id = str(developer.id)

    create_response = client.post(
        "/api/v1/teams",
        json={"name": "Archive Test Team"},
    )

    assert create_response.status_code == 201

    team_id = create_response.json()["id"]

    archive_response = client.post(f"/api/v1/teams/{team_id}/archive")

    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == "ARCHIVED"
    assert archive_response.json()["archived_at"] is not None

    active_response = client.get(
        "/api/v1/teams",
        params={"search": "Archive Test Team"},
    )

    assert active_response.status_code == 200
    assert active_response.json()["total"] == 0

    archived_response = client.get(
        "/api/v1/teams",
        params={"status": "ARCHIVED", "search": "Archive Test Team"},
    )

    assert archived_response.status_code == 200
    assert archived_response.json()["total"] == 1

    add_response = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"user_id": developer_id},
    )

    assert add_response.status_code == 409


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


def create_project_manager(
    session_factory,
    email: str = "pm@test.agribid.ai",
):
    """Create an active PM user for project-management tests."""
    with session_factory() as session:
        role = session.scalar(select(Role).where(Role.code == "PM"))
        assert role is not None

        manager = User(
            full_name="Test Project Manager",
            email=email,
            password_hash=hash_password(TEST_PASSWORD),
            role_id=role.id,
            is_active=True,
        )
        session.add(manager)
        session.commit()

        return manager.id


def create_test_project(
    client: TestClient,
    team_id: UUID,
    manager_id: UUID,
    key: str = "AGR",
):
    """Create a project through the API."""
    return client.post(
        "/api/v1/projects",
        json={
            "name": f"Project {key}",
            "key": key,
            "description": "Project API test",
            "project_manager_id": str(manager_id),
            "team_id": str(team_id),
            "start_date": "2026-11-01",
            "end_date": "2026-12-31",
            "member_ids": [],
        },
    )


def test_project_api_requires_authentication(users_environment):
    client, session_factory, team_ids, _ = users_environment
    manager_id = create_project_manager(session_factory)

    list_response = client.get("/api/v1/projects")
    create_response = create_test_project(
        client,
        team_ids[0],
        manager_id,
    )

    assert list_response.status_code == 401
    assert create_response.status_code == 401


def test_non_admin_developer_cannot_create_projects(users_environment):
    client, session_factory, team_ids, _ = users_environment
    manager_id = create_project_manager(session_factory)

    assert sign_in(client, DEVELOPER_EMAIL).status_code == 200

    response = create_test_project(
        client,
        team_ids[0],
        manager_id,
    )

    assert response.status_code == 403


def test_admin_can_create_list_and_view_project(users_environment):
    client, session_factory, team_ids, _ = users_environment
    manager_id = create_project_manager(session_factory)

    assert sign_in(client).status_code == 200

    create_response = create_test_project(
        client,
        team_ids[0],
        manager_id,
        "AGR",
    )

    assert create_response.status_code == 201

    project = create_response.json()
    assert project["name"] == "Project AGR"
    assert project["key"] == "AGR"
    assert project["status"] == "PLANNING"
    assert project["visibility"] == "INTERNAL"
    assert project["project_manager"]["id"] == str(manager_id)
    assert project["team"]["id"] == str(team_ids[0])
    assert project["member_count"] == 0

    list_response = client.get("/api/v1/projects")

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["items"][0]["key"] == "AGR"

    detail_response = client.get(f"/api/v1/projects/{project['id']}")

    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == project["id"]


def test_project_key_is_unique_case_insensitively(users_environment):
    client, session_factory, team_ids, _ = users_environment
    manager_id = create_project_manager(session_factory)

    assert sign_in(client).status_code == 200

    first = create_test_project(
        client,
        team_ids[0],
        manager_id,
        "AGR",
    )
    second = create_test_project(
        client,
        team_ids[0],
        manager_id,
        "agr",
    )

    assert first.status_code == 201
    assert second.status_code == 409


def test_project_rejects_invalid_date_range(users_environment):
    client, session_factory, team_ids, _ = users_environment
    manager_id = create_project_manager(session_factory)

    assert sign_in(client).status_code == 200

    response = client.post(
        "/api/v1/projects",
        json={
            "name": "Invalid Date Project",
            "key": "DATE",
            "project_manager_id": str(manager_id),
            "team_id": str(team_ids[0]),
            "start_date": "2026-12-31",
            "end_date": "2026-11-01",
        },
    )

    assert response.status_code == 422


def test_pm_can_only_access_assigned_projects(users_environment):
    client, session_factory, team_ids, _ = users_environment

    assigned_pm_id = create_project_manager(
        session_factory,
        "assigned.pm@test.agribid.ai",
    )
    create_project_manager(
        session_factory,
        "other.pm@test.agribid.ai",
    )

    assert sign_in(client).status_code == 200

    create_response = create_test_project(
        client,
        team_ids[0],
        assigned_pm_id,
        "PMACCESS",
    )
    assert create_response.status_code == 201

    project_id = create_response.json()["id"]

    # Another PM must not see or modify this project.
    assert sign_in(client, "other.pm@test.agribid.ai").status_code == 200

    list_response = client.get("/api/v1/projects")
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0

    detail_response = client.get(f"/api/v1/projects/{project_id}")
    assert detail_response.status_code == 404

    update_response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Unauthorized Update"},
    )
    assert update_response.status_code == 404

    # The assigned PM can view and update the project.
    assert sign_in(client, "assigned.pm@test.agribid.ai").status_code == 200

    assigned_detail = client.get(f"/api/v1/projects/{project_id}")
    assert assigned_detail.status_code == 200

    update_response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Updated By Assigned PM"},
    )
    assert update_response.status_code == 200


def test_project_member_access_and_removal_preserve_history(
    users_environment,
):
    client, session_factory, team_ids, _ = users_environment
    manager_id = create_project_manager(session_factory)

    with session_factory() as session:
        developer = session.scalar(select(User).where(User.email == DEVELOPER_EMAIL))
        assert developer is not None
        developer_id = developer.id

    assert sign_in(client).status_code == 200

    # The developer must first belong to the assigned team.
    team_response = client.post(
        f"/api/v1/teams/{team_ids[0]}/members",
        json={
            "user_id": str(developer_id),
            "designation": "Developer",
        },
    )
    assert team_response.status_code == 200

    project_response = create_test_project(
        client,
        team_ids[0],
        manager_id,
        "MEMBER",
    )
    assert project_response.status_code == 201

    project_id = project_response.json()["id"]

    add_response = client.post(
        f"/api/v1/projects/{project_id}/members",
        json={"user_id": str(developer_id)},
    )
    assert add_response.status_code == 200
    assert add_response.json()["member_count"] == 1

    # Active members can view their project.
    assert sign_in(client, DEVELOPER_EMAIL).status_code == 200

    member_detail = client.get(f"/api/v1/projects/{project_id}")
    assert member_detail.status_code == 200

    member_list = client.get("/api/v1/projects")
    assert member_list.status_code == 200
    assert member_list.json()["total"] == 1

    # Admin removes the developer, preserving the membership record.
    assert sign_in(client).status_code == 200

    remove_response = client.delete(f"/api/v1/projects/{project_id}/members/{developer_id}")
    assert remove_response.status_code == 200

    with session_factory() as session:
        membership = session.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == UUID(project_id),
                ProjectMember.user_id == developer_id,
            )
        )

        assert membership is not None
        assert membership.removed_at is not None

    # Removed members can no longer view the project.
    assert sign_in(client, DEVELOPER_EMAIL).status_code == 200

    removed_detail = client.get(f"/api/v1/projects/{project_id}")
    assert removed_detail.status_code == 404

    removed_list = client.get("/api/v1/projects")
    assert removed_list.status_code == 200
    assert removed_list.json()["total"] == 0


def test_archived_projects_are_excluded_from_active_listing(
    users_environment,
):
    client, session_factory, team_ids, _ = users_environment
    manager_id = create_project_manager(session_factory)

    assert sign_in(client).status_code == 200

    create_response = create_test_project(
        client,
        team_ids[0],
        manager_id,
        "ARCHIVE",
    )
    assert create_response.status_code == 201

    project_id = create_response.json()["id"]

    archive_response = client.post(f"/api/v1/projects/{project_id}/archive")

    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == "ARCHIVED"
    assert archive_response.json()["archived_at"] is not None

    active_list = client.get("/api/v1/projects")
    assert active_list.status_code == 200
    assert active_list.json()["total"] == 0

    archived_list = client.get("/api/v1/projects?status=ARCHIVED")
    assert archived_list.status_code == 200
    assert archived_list.json()["total"] == 1
    assert archived_list.json()["items"][0]["key"] == "ARCHIVE"


def _create_dashboard_user(
    session,
    *,
    email: str,
    full_name: str,
    role_code: str,
) -> User:
    role = session.scalar(select(Role).where(Role.code == role_code))
    assert role is not None

    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        role=role,
        is_active=True,
    )
    session.add(user)
    session.flush()

    return user


def _create_dashboard_project(
    session,
    *,
    admin: User,
    project_manager: User,
    team_id: UUID,
    name: str,
    key: str,
    status: str = "ACTIVE",
    archived: bool = False,
) -> Project:
    project = Project(
        name=name,
        key=key,
        project_manager_id=project_manager.id,
        team_id=team_id,
        created_by_user_id=admin.id,
        status=status,
        archived_at=datetime.now(UTC) if archived else None,
    )
    session.add(project)
    session.flush()

    return project


def test_dashboard_requires_authentication(users_environment):
    client, _, _, _ = users_environment

    response = client.get("/api/v1/dashboard")

    assert response.status_code == 401


def test_admin_dashboard_returns_workspace_metrics_and_team_distribution(
    users_environment,
):
    client, session_factory, team_ids, _ = users_environment

    with session_factory() as session:
        admin = session.scalar(select(User).where(User.email == ADMIN_EMAIL))
        assert admin is not None

        manager = _create_dashboard_user(
            session,
            email="dashboard.pm@agribid.ai",
            full_name="Dashboard PM",
            role_code="PM",
        )

        _create_dashboard_project(
            session,
            admin=admin,
            project_manager=manager,
            team_id=team_ids[0],
            name="Engineering Active Project",
            key="ENG_ACTIVE",
            status="ACTIVE",
        )

        _create_dashboard_project(
            session,
            admin=admin,
            project_manager=manager,
            team_id=team_ids[1],
            name="QA Completed Project",
            key="QA_DONE",
            status="COMPLETED",
        )

        _create_dashboard_project(
            session,
            admin=admin,
            project_manager=manager,
            team_id=team_ids[0],
            name="Archived Project",
            key="ARCHIVED",
            status="ARCHIVED",
            archived=True,
        )

        session.commit()

    assert sign_in(client).status_code == 200

    response = client.get("/api/v1/dashboard")

    assert response.status_code == 200

    result = response.json()

    assert result["role_code"] == "ADMIN"

    metrics = {item["key"]: item["value"] for item in result["metrics"]}

    assert metrics["total_users"] == 3
    assert metrics["active_users"] == 3
    assert metrics["total_teams"] == 2
    assert metrics["total_projects"] == 3
    assert metrics["active_projects"] == 1
    assert metrics["completed_projects"] == 1

    project_keys = {project["key"] for project in result["projects"]}

    assert "ENG_ACTIVE" in project_keys
    assert "QA_DONE" in project_keys
    assert "ARCHIVED" not in project_keys

    distribution = {
        item["team_name"]: item["project_count"] for item in result["team_project_distribution"]
    }

    assert distribution["Engineering"] == 1
    assert distribution["Quality Assurance"] == 1


def test_pm_dashboard_only_returns_projects_managed_by_that_pm(
    users_environment,
):
    client, session_factory, team_ids, _ = users_environment

    with session_factory() as session:
        admin = session.scalar(select(User).where(User.email == ADMIN_EMAIL))
        assert admin is not None

        first_pm = _create_dashboard_user(
            session,
            email="first.pm@agribid.ai",
            full_name="First Project Manager",
            role_code="PM",
        )

        second_pm = _create_dashboard_user(
            session,
            email="second.pm@agribid.ai",
            full_name="Second Project Manager",
            role_code="PM",
        )

        _create_dashboard_project(
            session,
            admin=admin,
            project_manager=first_pm,
            team_id=team_ids[0],
            name="First PM Project",
            key="FIRST_PM",
            status="ACTIVE",
        )

        _create_dashboard_project(
            session,
            admin=admin,
            project_manager=second_pm,
            team_id=team_ids[1],
            name="Second PM Project",
            key="SECOND_PM",
            status="ACTIVE",
        )

        session.commit()

    assert sign_in(client, "first.pm@agribid.ai").status_code == 200

    response = client.get("/api/v1/dashboard")

    assert response.status_code == 200

    result = response.json()

    assert result["role_code"] == "PM"

    metrics = {item["key"]: item["value"] for item in result["metrics"]}

    assert metrics["assigned_projects"] == 1
    assert metrics["active_projects"] == 1

    project_keys = {project["key"] for project in result["projects"]}

    assert project_keys == {"FIRST_PM"}


@pytest.mark.parametrize(
    ("role_code", "email", "full_name"),
    [
        ("DEVELOPER", DEVELOPER_EMAIL, "Test Developer"),
        ("TESTER", "dashboard.tester@agribid.ai", "Dashboard Tester"),
    ],
)
def test_developer_and_tester_only_see_active_project_memberships(
    users_environment,
    role_code,
    email,
    full_name,
):
    client, session_factory, team_ids, _ = users_environment

    with session_factory() as session:
        admin = session.scalar(select(User).where(User.email == ADMIN_EMAIL))
        assert admin is not None

        if role_code == "DEVELOPER":
            member = session.scalar(select(User).where(User.email == email))
            assert member is not None
        else:
            member = _create_dashboard_user(
                session,
                email=email,
                full_name=full_name,
                role_code=role_code,
            )

        manager = _create_dashboard_user(
            session,
            email=f"{role_code.lower()}.manager@agribid.ai",
            full_name=f"{role_code} Test Manager",
            role_code="PM",
        )

        assigned_project = _create_dashboard_project(
            session,
            admin=admin,
            project_manager=manager,
            team_id=team_ids[0],
            name=f"{role_code} Assigned Project",
            key=f"{role_code}_ASSIGNED",
        )

        _create_dashboard_project(
            session,
            admin=admin,
            project_manager=manager,
            team_id=team_ids[1],
            name=f"{role_code} Private Project",
            key=f"{role_code}_PRIVATE",
        )

        session.add(
            ProjectMember(
                project_id=assigned_project.id,
                user_id=member.id,
                added_by_user_id=admin.id,
            )
        )

        session.commit()

    assert sign_in(client, email).status_code == 200

    response = client.get("/api/v1/dashboard")

    assert response.status_code == 200

    result = response.json()

    assert result["role_code"] == role_code

    metrics = {item["key"]: item["value"] for item in result["metrics"]}

    assert metrics["assigned_projects"] == 1

    project_keys = {project["key"] for project in result["projects"]}

    assert project_keys == {f"{role_code}_ASSIGNED"}
