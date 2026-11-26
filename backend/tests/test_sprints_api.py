from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.core.database import Base, get_db
from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.main import app
from app.models import Project, ProjectMember, Role, Team, TeamMember, Ticket, User

TEST_PASSWORD = "Valid-Test-Password-2026!"


@pytest.fixture
def sprint_environment(monkeypatch):
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

    try:
        with test_session_factory() as session:
            roles = {
                "ADMIN": Role(code="ADMIN", name="Admin"),
                "PM": Role(code="PM", name="Project Manager"),
                "DEVELOPER": Role(code="DEVELOPER", name="Developer"),
                "TESTER": Role(code="TESTER", name="Tester"),
            }
            session.add_all(roles.values())
            session.flush()

            users = {}
            for code, role in roles.items():
                user = User(
                    full_name=f"Test {code.title()}",
                    email=f"{code.lower()}@sprint-test.agribid.ai",
                    password_hash=hash_password(TEST_PASSWORD),
                    role=role,
                    is_active=True,
                )
                session.add(user)
                users[code] = user

            outsider = User(
                full_name="Outside Developer",
                email="outsider@sprint-test.agribid.ai",
                password_hash=hash_password(TEST_PASSWORD),
                role=roles["DEVELOPER"],
                is_active=True,
            )
            session.add(outsider)
            users["OUTSIDER"] = outsider
            session.flush()

            team = Team(name="Sprint Test Team", status="ACTIVE")
            session.add(team)
            session.flush()

            for code in ("PM", "DEVELOPER", "TESTER"):
                session.add(
                    TeamMember(
                        team_id=team.id,
                        user_id=users[code].id,
                        designation=code.title(),
                    )
                )

            project = Project(
                name="Sprint Test Project",
                key="SPT",
                project_manager_id=users["PM"].id,
                team_id=team.id,
                created_by_user_id=users["ADMIN"].id,
                status="ACTIVE",
                visibility="INTERNAL",
            )
            session.add(project)
            session.flush()

            for code in ("DEVELOPER", "TESTER"):
                session.add(
                    ProjectMember(
                        project_id=project.id,
                        user_id=users[code].id,
                        added_by_user_id=users["ADMIN"].id,
                    )
                )
            session.commit()

            ids = {
                "project": project.id,
                "admin": users["ADMIN"].id,
                "pm": users["PM"].id,
                "developer": users["DEVELOPER"].id,
                "tester": users["TESTER"].id,
                "outsider": users["OUTSIDER"].id,
            }

        with TestClient(app) as client:
            yield client, test_session_factory, ids
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def sign_in_as(client: TestClient, role: str) -> None:
    response = client.post(
        "/api/v1/auth/sign",
        json={
            "email": f"{role.lower()}@sprint-test.agribid.ai",
            "password": TEST_PASSWORD,
        },
    )
    assert response.status_code == 200, response.text


def create_ticket(client: TestClient, ids: dict[str, UUID], title: str = "Sprint work") -> dict:
    response = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": title,
            "type": "TASK",
            "priority": "HIGH",
            "assignee_id": str(ids["developer"]),
            "tester_id": str(ids["tester"]),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_sprint(client: TestClient, ids: dict[str, UUID], name: str = "Sprint 1") -> dict:
    response = client.post(
        f"/api/v1/projects/{ids['project']}/sprints",
        json={
            "name": name,
            "goal": "Complete the planned sprint work",
            "start_date": "2026-11-27",
            "end_date": "2026-12-11",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_pm_can_create_and_view_planned_sprint(sprint_environment):
    client, _, ids = sprint_environment
    sign_in_as(client, "PM")

    sprint = create_sprint(client, ids)

    assert sprint["name"] == "Sprint 1"
    assert sprint["status"] == "PLANNED"
    assert sprint["assigned_tickets"] == 0
    assert sprint["completed_tickets"] == 0
    assert sprint["pending_tickets"] == 0
    assert sprint["completion_percentage"] == 0
    assert sprint["tickets"] == []

    listed = client.get(f"/api/v1/projects/{ids['project']}/sprints")
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] == 1


def test_sprint_dates_are_validated(sprint_environment):
    client, _, ids = sprint_environment
    sign_in_as(client, "PM")

    response = client.post(
        f"/api/v1/projects/{ids['project']}/sprints",
        json={
            "name": "Invalid dates",
            "goal": "Check date order",
            "start_date": "2026-12-12",
            "end_date": "2026-12-11",
        },
    )
    assert response.status_code == 422


def test_non_pm_cannot_manage_sprints_but_project_member_can_view(sprint_environment):
    client, _, ids = sprint_environment
    sign_in_as(client, "PM")
    sprint = create_sprint(client, ids)

    sign_in_as(client, "DEVELOPER")
    details = client.get(f"/api/v1/sprints/{sprint['id']}")
    denied_create = client.post(
        f"/api/v1/projects/{ids['project']}/sprints",
        json={
            "name": "Unauthorized sprint",
            "goal": "Should not be created",
            "start_date": "2026-11-27",
            "end_date": "2026-12-11",
        },
    )

    assert details.status_code == 200
    assert denied_create.status_code == 403


def test_outsider_cannot_view_sprints_or_backlog(sprint_environment):
    client, _, ids = sprint_environment
    sign_in_as(client, "PM")
    sprint = create_sprint(client, ids)

    sign_in_as(client, "OUTSIDER")
    sprint_response = client.get(f"/api/v1/sprints/{sprint['id']}")
    backlog_response = client.get(f"/api/v1/projects/{ids['project']}/backlog")

    assert sprint_response.status_code == 404
    assert backlog_response.status_code == 404


def test_only_backlog_tickets_can_be_added_and_active_assignment_is_unique(sprint_environment):
    client, _, ids = sprint_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    sign_in_as(client, "PM")
    first_sprint = create_sprint(client, ids, "Sprint A")
    second_sprint = create_sprint(client, ids, "Sprint B")

    added = client.post(
        f"/api/v1/sprints/{first_sprint['id']}/tickets",
        json={"ticket_ids": [ticket["id"]]},
    )
    duplicate = client.post(
        f"/api/v1/sprints/{second_sprint['id']}/tickets",
        json={"ticket_ids": [ticket["id"]]},
    )

    assert added.status_code == 200, added.text
    assert added.json()["assigned_tickets"] == 1
    assert duplicate.status_code == 409


def test_start_moves_backlog_tickets_to_todo_and_completion_returns_incomplete_to_backlog(
    sprint_environment,
):
    client, session_factory, ids = sprint_environment
    sign_in_as(client, "ADMIN")
    completed_ticket = create_ticket(client, ids, "Completed sprint ticket")
    incomplete_ticket = create_ticket(client, ids, "Incomplete sprint ticket")

    sign_in_as(client, "PM")
    sprint = create_sprint(client, ids)
    added = client.post(
        f"/api/v1/sprints/{sprint['id']}/tickets",
        json={"ticket_ids": [completed_ticket["id"], incomplete_ticket["id"]]},
    )
    assert added.status_code == 200, added.text

    started = client.post(f"/api/v1/sprints/{sprint['id']}/start")
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "ACTIVE"

    with session_factory() as session:
        stored_completed = session.scalar(
            select(Ticket).where(Ticket.id == UUID(completed_ticket["id"]))
        )
        stored_incomplete = session.scalar(
            select(Ticket).where(Ticket.id == UUID(incomplete_ticket["id"]))
        )
        assert stored_completed.status == "TODO"
        assert stored_incomplete.status == "TODO"

    completed = client.patch(
        f"/api/v1/tickets/{completed_ticket['id']}/status",
        json={"status": "COMPLETED"},
    )
    assert completed.status_code == 200, completed.text

    live_details = client.get(f"/api/v1/sprints/{sprint['id']}")
    assert live_details.status_code == 200
    assert live_details.json()["completed_tickets"] == 1
    assert live_details.json()["pending_tickets"] == 1
    assert live_details.json()["completion_percentage"] == 50

    closed = client.post(f"/api/v1/sprints/{sprint['id']}/complete")
    assert closed.status_code == 200, closed.text
    payload = closed.json()
    assert payload["status"] == "COMPLETED"
    assert payload["assigned_tickets"] == 2
    assert payload["completed_tickets"] == 1
    assert payload["pending_tickets"] == 1
    assert payload["completion_percentage"] == 50

    with session_factory() as session:
        stored_completed = session.scalar(
            select(Ticket).where(Ticket.id == UUID(completed_ticket["id"]))
        )
        stored_incomplete = session.scalar(
            select(Ticket).where(Ticket.id == UUID(incomplete_ticket["id"]))
        )
        assert stored_completed.status == "COMPLETED"
        assert stored_incomplete.status == "BACKLOG"


def test_removed_ticket_returns_to_available_backlog(sprint_environment):
    client, _, ids = sprint_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    sign_in_as(client, "PM")
    sprint = create_sprint(client, ids)
    added = client.post(
        f"/api/v1/sprints/{sprint['id']}/tickets",
        json={"ticket_ids": [ticket["id"]]},
    )
    assert added.status_code == 200

    removed = client.delete(
        f"/api/v1/sprints/{sprint['id']}/tickets/{ticket['id']}"
    )
    assert removed.status_code == 200, removed.text

    backlog = client.get(f"/api/v1/projects/{ids['project']}/backlog")
    assert backlog.status_code == 200, backlog.text
    assert [item["id"] for item in backlog.json()["items"]] == [ticket["id"]]


def test_sprint_cannot_be_started_twice_or_edited_after_start(sprint_environment):
    client, _, ids = sprint_environment
    sign_in_as(client, "PM")
    sprint = create_sprint(client, ids)

    first_start = client.post(f"/api/v1/sprints/{sprint['id']}/start")
    second_start = client.post(f"/api/v1/sprints/{sprint['id']}/start")
    update_after_start = client.patch(
        f"/api/v1/sprints/{sprint['id']}",
        json={"name": "Changed after start"},
    )

    assert first_start.status_code == 200
    assert second_start.status_code == 409
    assert update_after_start.status_code == 409
