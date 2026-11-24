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
from app.models import (
    Project,
    ProjectMember,
    Role,
    Team,
    TeamMember,
    Ticket,
    TicketActivity,
    User,
)

TEST_PASSWORD = "Valid-Test-Password-2026!"


@pytest.fixture
def ticket_environment(monkeypatch):
    """Provide isolated database, users, project, and authenticated API client."""
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

            for code in roles:
                user = User(
                    full_name=f"Test {code.title()}",
                    email=f"{code.lower()}@test.agribid.ai",
                    password_hash=hash_password(TEST_PASSWORD),
                    role=roles[code],
                    is_active=True,
                )
                session.add(user)
                users[code] = user

            outsider = User(
                full_name="Outside Developer",
                email="outsider@test.agribid.ai",
                password_hash=hash_password(TEST_PASSWORD),
                role=roles["DEVELOPER"],
                is_active=True,
            )
            session.add(outsider)
            users["OUTSIDER"] = outsider
            session.flush()

            team = Team(
                name="Ticket Test Team",
                status="ACTIVE",
            )
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
                name="Ticket Test Project",
                key="TST",
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
            "email": f"{role.lower()}@test.agribid.ai",
            "password": TEST_PASSWORD,
        },
    )
    assert response.status_code == 200, response.text


def create_ticket(
    client: TestClient,
    ids: dict[str, UUID],
) -> dict:
    response = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": "Implement ticket workflow",
            "description": "Verify ticket creation and assignment.",
            "type": "TASK",
            "priority": "HIGH",
            "assignee_id": str(ids["developer"]),
            "reviewer_id": str(ids["pm"]),
            "tester_id": str(ids["tester"]),
            "labels": ["backend", "workflow"],
        },
    )

    assert response.status_code == 201, response.text
    return response.json()


def change_status(
    client: TestClient,
    ticket_id: str,
    status: str,
    reason: str | None = None,
):
    return client.patch(
        f"/api/v1/tickets/{ticket_id}/status",
        json={"status": status, "reason": reason},
    )


def test_admin_can_create_ticket_and_activity_is_recorded(ticket_environment):
    client, session_factory, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    result = create_ticket(client, ids)

    assert result["ticket_key"] == "TST-1"
    assert result["title"] == "Implement ticket workflow"
    assert result["type"] == "TASK"
    assert result["priority"] == "HIGH"
    assert result["status"] == "BACKLOG"
    assert result["reporter"]["id"] == str(ids["admin"])
    assert result["assignee"]["id"] == str(ids["developer"])
    assert result["reviewer"]["id"] == str(ids["pm"])
    assert result["tester"]["id"] == str(ids["tester"])

    actions = {activity["action"] for activity in result["activities"]}
    assert "CREATED" in actions
    assert "ASSIGNED" in actions

    with session_factory() as session:
        ticket = session.scalar(select(Ticket).where(Ticket.id == UUID(result["id"])))
        assert ticket is not None
        assert ticket.number == 1

        activities = session.scalars(
            select(TicketActivity).where(TicketActivity.ticket_id == ticket.id)
        ).all()

        assert len(activities) >= 4


def test_project_ticket_numbers_increment(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    first = create_ticket(client, ids)
    second = create_ticket(client, ids)

    assert first["ticket_key"] == "TST-1"
    assert second["ticket_key"] == "TST-2"


def test_developer_cannot_create_or_edit_ticket(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "DEVELOPER")

    create_response = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": "Unauthorized ticket",
        },
    )

    assert create_response.status_code == 403

    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    sign_in_as(client, "DEVELOPER")

    update_response = client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        json={"title": "Unauthorized title change"},
    )

    assert update_response.status_code == 404


def test_outsider_cannot_view_project_ticket(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    ticket = create_ticket(client, ids)

    sign_in_as(client, "OUTSIDER")

    detail_response = client.get(f"/api/v1/tickets/{ticket['id']}")
    list_response = client.get(
        "/api/v1/tickets",
        params={"project_id": str(ids["project"])},
    )

    assert detail_response.status_code == 404
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0


def test_ticket_listing_filters_and_pagination(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    first = create_ticket(client, ids)
    second = create_ticket(client, ids)

    response = client.get(
        "/api/v1/tickets",
        params={
            "project_id": str(ids["project"]),
            "priority": "HIGH",
            "search": "workflow",
            "sort_by": "number",
            "sort_order": "asc",
            "page": 1,
            "page_size": 1,
        },
    )

    assert response.status_code == 200
    result = response.json()

    assert result["total"] == 2
    assert result["page"] == 1
    assert result["page_size"] == 1
    assert result["total_pages"] == 2
    assert len(result["items"]) == 1
    assert result["items"][0]["id"] == first["id"]
    assert first["id"] != second["id"]


def test_role_specific_ticket_status_workflow(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    ticket = create_ticket(client, ids)
    ticket_id = ticket["id"]

    sign_in_as(client, "PM")
    assert change_status(client, ticket_id, "TODO").status_code == 200

    sign_in_as(client, "DEVELOPER")
    assert change_status(client, ticket_id, "IN_PROGRESS").status_code == 200
    assert change_status(client, ticket_id, "IN_REVIEW").status_code == 200

    sign_in_as(client, "PM")
    assert change_status(client, ticket_id, "TESTING").status_code == 200

    sign_in_as(client, "TESTER")
    response = change_status(client, ticket_id, "TESTING_DONE")
    assert response.status_code == 200
    assert response.json()["status"] == "TESTING_DONE"

    # TESTING_DONE is not final completion; PM can route it back to testing.
    sign_in_as(client, "PM")
    assert change_status(client, ticket_id, "TESTING").status_code == 200

    sign_in_as(client, "TESTER")
    assert change_status(client, ticket_id, "REOPENED").status_code == 400
    response = change_status(
        client,
        ticket_id,
        "REOPENED",
        reason="Testing failed; another fix is required.",
    )
    assert response.status_code == 200
    assert response.json()["status"] == "REOPENED"

    sign_in_as(client, "DEVELOPER")
    assert change_status(client, ticket_id, "IN_PROGRESS").status_code == 200
    assert change_status(client, ticket_id, "IN_REVIEW").status_code == 200

    sign_in_as(client, "PM")
    assert change_status(client, ticket_id, "TESTING").status_code == 200

    sign_in_as(client, "TESTER")
    response = change_status(client, ticket_id, "BUG_FIXED")
    assert response.status_code == 200
    assert response.json()["status"] == "BUG_FIXED"

    sign_in_as(client, "PM")
    response = change_status(client, ticket_id, "COMPLETED")
    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"
    assert response.json()["completed_at"] is not None
    assert response.json()["completed_by"]["id"] == str(ids["pm"])


def test_tester_cannot_skip_testing(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    ticket = create_ticket(client, ids)

    sign_in_as(client, "PM")
    response = change_status(client, ticket["id"], "TESTING")
    assert response.status_code == 200

    sign_in_as(client, "TESTER")

    response = change_status(client, ticket["id"], "COMPLETED")

    assert response.status_code == 403


def test_unassigned_developer_cannot_transition_ticket(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    response = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": "Unassigned ticket",
        },
    )

    assert response.status_code == 201
    ticket_id = response.json()["id"]

    sign_in_as(client, "DEVELOPER")

    response = change_status(client, ticket_id, "IN_PROGRESS")

    assert response.status_code == 403


def test_soft_delete_preserves_ticket_and_history(ticket_environment):
    client, session_factory, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    ticket = create_ticket(client, ids)
    ticket_id = UUID(ticket["id"])

    response = client.delete(f"/api/v1/tickets/{ticket_id}")

    assert response.status_code == 200
    assert response.json()["ticket_id"] == str(ticket_id)

    detail_response = client.get(f"/api/v1/tickets/{ticket_id}")
    assert detail_response.status_code == 404

    with session_factory() as session:
        stored_ticket = session.scalar(select(Ticket).where(Ticket.id == ticket_id))

        assert stored_ticket is not None
        assert stored_ticket.deleted_at is not None

        activities = session.scalars(
            select(TicketActivity).where(TicketActivity.ticket_id == ticket_id)
        ).all()

        assert any(activity.action == "DELETED" for activity in activities)


def test_developer_cannot_skip_in_progress_when_moving_to_in_review(
    ticket_environment,
):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    ticket = create_ticket(client, ids)

    sign_in_as(client, "PM")
    assert change_status(client, ticket["id"], "TODO").status_code == 200

    sign_in_as(client, "DEVELOPER")
    response = change_status(client, ticket["id"], "IN_REVIEW")

    assert response.status_code == 403


def test_tester_can_return_failed_testing_to_in_progress_with_reason(
    ticket_environment,
):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    sign_in_as(client, "PM")
    assert change_status(client, ticket["id"], "TESTING").status_code == 200

    sign_in_as(client, "TESTER")
    assert change_status(client, ticket["id"], "IN_PROGRESS").status_code == 400

    response = change_status(
        client,
        ticket["id"],
        "IN_PROGRESS",
        reason="Testing failed; developer action is required.",
    )
    assert response.status_code == 200
    assert response.json()["status"] == "IN_PROGRESS"


def test_blocking_unblocking_and_cancellation_require_reasons(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    sign_in_as(client, "PM")

    assert change_status(client, ticket["id"], "BLOCKED").status_code == 400
    response = change_status(
        client,
        ticket["id"],
        "BLOCKED",
        reason="Waiting for an external dependency.",
    )
    assert response.status_code == 200

    assert change_status(client, ticket["id"], "TODO").status_code == 400
    response = change_status(
        client,
        ticket["id"],
        "TODO",
        reason="The dependency is now available.",
    )
    assert response.status_code == 200

    assert change_status(client, ticket["id"], "CANCELLED").status_code == 400
    response = change_status(
        client,
        ticket["id"],
        "CANCELLED",
        reason="The requested work is no longer required.",
    )
    assert response.status_code == 200


def test_legacy_done_status_is_rejected(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    response = change_status(client, ticket["id"], "DONE")
    assert response.status_code == 422


def test_project_member_can_create_comment_and_mention_project_member(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)
    sign_in_as(client, "DEVELOPER")

    response = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"body": "Please review this change.", "mentioned_user_ids": [str(ids["tester"])]},
    )
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["body"] == "Please review this change."
    assert result["author"]["id"] == str(ids["developer"])
    assert [item["id"] for item in result["mentioned_users"]] == [str(ids["tester"])]
    assert result["is_deleted"] is False

    ticket_response = client.get(f"/api/v1/tickets/{ticket['id']}")
    assert ticket_response.status_code == 200
    assert any(item["action"] == "COMMENT_ADDED" for item in ticket_response.json()["activities"])


def test_comment_replies_and_edit_ownership(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)
    parent = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments", json={"body": "Parent comment"}
    )
    assert parent.status_code == 201, parent.text
    parent_data = parent.json()

    reply = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"body": "A reply", "parent_comment_id": parent_data["id"]},
    )
    assert reply.status_code == 201, reply.text
    assert reply.json()["parent_comment_id"] == parent_data["id"]

    sign_in_as(client, "DEVELOPER")
    forbidden = client.patch(
        f"/api/v1/tickets/{ticket['id']}/comments/{parent_data['id']}",
        json={"body": "Edited by another user"},
    )
    assert forbidden.status_code == 403

    sign_in_as(client, "ADMIN")
    edited = client.patch(
        f"/api/v1/tickets/{ticket['id']}/comments/{parent_data['id']}",
        json={"body": "Edited by author"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["body"] == "Edited by author"
    assert edited.json()["edited_at"] is not None


def test_comment_delete_is_soft_and_keeps_thread_record(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)
    created = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments", json={"body": "Keep this thread position"}
    )
    assert created.status_code == 201, created.text

    deleted = client.delete(f"/api/v1/tickets/{ticket['id']}/comments/{created.json()['id']}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["is_deleted"] is True
    assert deleted.json()["body"] is None

    listed = client.get(f"/api/v1/tickets/{ticket['id']}/comments")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["is_deleted"] is True


def test_comment_mentions_must_be_project_authorized(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)
    response = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"body": "Mention an outsider", "mentioned_user_ids": [str(ids["outsider"])]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Mentioned users must have access to this project."


def test_outsider_cannot_read_or_comment_on_ticket(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)
    sign_in_as(client, "OUTSIDER")

    listed = client.get(f"/api/v1/tickets/{ticket['id']}/comments")
    created = client.post(f"/api/v1/tickets/{ticket['id']}/comments", json={"body": "Unauthorized"})
    assert listed.status_code == 404
    assert created.status_code == 404
