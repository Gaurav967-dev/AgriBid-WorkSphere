from __future__ import annotations

from datetime import date, timedelta
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
                "team": team.id,
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


def test_admin_can_create_ticket_in_selected_kanban_status(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    response = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": "Create directly in progress",
            "status": "IN_PROGRESS",
        },
    )

    assert response.status_code == 201, response.text
    result = response.json()
    assert result["status"] == "IN_PROGRESS"
    created_activity = next(
        activity for activity in result["activities"]
        if activity["action"] == "CREATED"
    )
    assert created_activity["new_value"]["status"] == "IN_PROGRESS"

    completed = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": "Create completed ticket from board",
            "status": "COMPLETED",
        },
    )
    assert completed.status_code == 201, completed.text
    assert completed.json()["status"] == "COMPLETED"
    assert completed.json()["completed_at"] is not None
    assert completed.json()["completed_by"]["id"] == str(ids["admin"])


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


def test_comments_are_limited_to_250_characters(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    accepted = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"body": "a" * 250},
    )
    assert accepted.status_code == 201, accepted.text
    assert len(accepted.json()["body"]) == 250

    rejected = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"body": "a" * 251},
    )
    assert rejected.status_code == 422

    update_accepted = client.patch(
        f"/api/v1/tickets/{ticket['id']}/comments/{accepted.json()['id']}",
        json={"body": "b" * 250},
    )
    assert update_accepted.status_code == 200, update_accepted.text
    assert len(update_accepted.json()["body"]) == 250

    update_rejected = client.patch(
        f"/api/v1/tickets/{ticket['id']}/comments/{accepted.json()['id']}",
        json={"body": "b" * 251},
    )
    assert update_rejected.status_code == 422


def test_users_cannot_reply_to_their_own_comment(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    sign_in_as(client, "DEVELOPER")
    parent = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={"body": "Developer comment"},
    )
    assert parent.status_code == 201, parent.text

    self_reply = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={
            "body": "A reply to my own comment",
            "parent_comment_id": parent.json()["id"],
        },
    )
    assert self_reply.status_code == 400
    assert self_reply.json()["detail"] == "You cannot reply to your own comment."

    sign_in_as(client, "TESTER")
    other_user_reply = client.post(
        f"/api/v1/tickets/{ticket['id']}/comments",
        json={
            "body": "A reply from another project member",
            "parent_comment_id": parent.json()["id"],
        },
    )
    assert other_user_reply.status_code == 201, other_user_reply.text


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


def test_ticket_attachment_upload_list_preview_download_and_soft_delete(
    ticket_environment, monkeypatch, tmp_path
):
    from app.core.config import get_settings
    from app.models import Attachment

    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path / "private-files"))
    client, session_factory, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)
    sign_in_as(client, "DEVELOPER")
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"module-six-test-image"

    uploaded = client.post(
        f"/api/v1/tickets/{ticket['id']}/attachments",
        files=[("files", ("evidence.png", png_bytes, "image/png"))],
    )
    assert uploaded.status_code == 201, uploaded.text
    item = uploaded.json()["items"][0]
    assert item["original_filename"] == "evidence.png"
    assert item["mime_type"] == "image/png"
    assert item["file_size"] == len(png_bytes)
    assert item["uploaded_by"]["id"] == str(ids["developer"])

    listed = client.get(f"/api/v1/tickets/{ticket['id']}/attachments")
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    preview = client.get(f"/api/v1/tickets/{ticket['id']}/attachments/{item['id']}/preview")
    assert preview.status_code == 200
    assert preview.headers["content-type"].startswith("image/png")
    assert preview.content == png_bytes

    download = client.get(f"/api/v1/tickets/{ticket['id']}/attachments/{item['id']}/download")
    assert download.status_code == 200
    assert "attachment;" in download.headers["content-disposition"]
    assert download.content == png_bytes

    deleted = client.delete(f"/api/v1/tickets/{ticket['id']}/attachments/{item['id']}")
    assert deleted.status_code == 200
    assert client.get(f"/api/v1/tickets/{ticket['id']}/attachments").json()["items"] == []
    assert (
        client.get(f"/api/v1/tickets/{ticket['id']}/attachments/{item['id']}/download").status_code
        == 404
    )

    with session_factory() as session:
        metadata = session.get(Attachment, UUID(item["id"]))
        assert metadata is not None and metadata.deleted_at is not None
        actions = session.scalars(
            select(TicketActivity).where(TicketActivity.ticket_id == UUID(ticket["id"]))
        ).all()
        assert {row.action for row in actions}.issuperset(
            {"ATTACHMENT_UPLOADED", "ATTACHMENT_DELETED"}
        )


def test_ticket_attachments_reject_mismatched_content_and_oversized_file(
    ticket_environment, monkeypatch, tmp_path
):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path / "private-files"))
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    mismatch = client.post(
        f"/api/v1/tickets/{ticket['id']}/attachments",
        files=[("files", ("fake.png", b"not really a png", "image/png"))],
    )
    assert mismatch.status_code == 400

    monkeypatch.setattr(get_settings(), "max_upload_size_bytes", 8)
    oversized = client.post(
        f"/api/v1/tickets/{ticket['id']}/attachments",
        files=[("files", ("large.png", b"\x89PNG\r\n\x1a\n12345", "image/png"))],
    )
    assert oversized.status_code == 413


def test_ticket_attachment_limit_is_five_active_files(ticket_environment, monkeypatch, tmp_path):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path / "private-files"))
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)
    payload = b"\x89PNG\r\n\x1a\n" + b"x"

    five_files = [("files", (f"image-{index}.png", payload, "image/png")) for index in range(5)]
    first = client.post(f"/api/v1/tickets/{ticket['id']}/attachments", files=five_files)
    assert first.status_code == 201, first.text
    sixth = client.post(
        f"/api/v1/tickets/{ticket['id']}/attachments",
        files=[("files", ("sixth.png", payload, "image/png"))],
    )
    assert sixth.status_code == 409


def test_project_attachment_is_private_to_project_members(
    ticket_environment, monkeypatch, tmp_path
):
    monkeypatch.setattr(
        "app.services.attachment_storage.get_settings",
        lambda: type(
            "Settings",
            (),
            {
                "upload_dir": str(tmp_path / "private-files"),
                "max_upload_size_bytes": 5 * 1024 * 1024,
            },
        )(),
    )
    client, _, ids = ticket_environment
    sign_in_as(client, "DEVELOPER")
    png_bytes = b"\x89PNG\r\n\x1a\nproject-file"
    uploaded = client.post(
        f"/api/v1/projects/{ids['project']}/attachments",
        files=[("files", ("project.png", png_bytes, "image/png"))],
    )
    assert uploaded.status_code == 201, uploaded.text
    attachment_id = uploaded.json()["items"][0]["id"]

    sign_in_as(client, "OUTSIDER")
    denied = client.get(f"/api/v1/projects/{ids['project']}/attachments/{attachment_id}/download")
    assert denied.status_code == 404


def dashboard_metric_map(payload: dict) -> dict[str, int | float]:
    return {item["key"]: item["value"] for item in payload["metrics"]}


def test_admin_dashboard_includes_ticket_kpis_and_recent_activity(ticket_environment):
    client, session_factory, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    pending_ticket = create_ticket(client, ids)
    completed_ticket = create_ticket(client, ids)
    reopened_ticket = create_ticket(client, ids)

    assert change_status(client, completed_ticket["id"], "COMPLETED").status_code == 200
    assert (
        change_status(
            client,
            reopened_ticket["id"],
            "REOPENED",
            "Failed during testing",
        ).status_code
        == 200
    )

    with session_factory() as session:
        overdue_ticket = session.scalar(
            select(Ticket).where(Ticket.id == UUID(pending_ticket["id"]))
        )
        overdue_ticket.due_date = date.today() - timedelta(days=1)
        session.commit()

    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200, response.text

    payload = response.json()
    metrics = dashboard_metric_map(payload)
    assert metrics["total_tickets"] == 3
    assert metrics["pending_tickets"] == 2
    assert metrics["completed_tickets"] == 1
    assert metrics["overdue_tickets"] == 1
    assert payload["recent_activities"]
    assert payload["team_project_distribution"]


def test_pm_dashboard_includes_project_completion_and_team_workload(ticket_environment):
    client, _session_factory, ids = ticket_environment
    sign_in_as(client, "PM")
    ticket = create_ticket(client, ids)

    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200, response.text

    payload = response.json()
    metrics = dashboard_metric_map(payload)
    assert metrics["assigned_projects"] == 1
    assert metrics["total_tickets"] == 1
    assert metrics["open_tickets"] == 1
    assert metrics["completed_tickets"] == 0
    assert metrics["project_completion"] == 0.0
    assert len(payload["team_workload"]) == 1
    assert payload["team_workload"][0]["project_count"] == 1
    assert payload["team_workload"][0]["open_tickets"] == 1
    assert payload["recent_activities"]
    assert ticket["ticket_key"] in {
        item["ticket_key"] for item in payload["recent_activities"]
    }


def test_developer_dashboard_is_limited_to_assigned_tickets_and_deadlines(
    ticket_environment,
):
    client, session_factory, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    with session_factory() as session:
        assigned_ticket = session.scalar(
            select(Ticket).where(Ticket.id == UUID(ticket["id"]))
        )
        assigned_ticket.due_date = date.today() + timedelta(days=5)
        session.commit()

    sign_in_as(client, "DEVELOPER")
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200, response.text

    payload = response.json()
    metrics = dashboard_metric_map(payload)
    assert metrics["my_assigned_tickets"] == 1
    assert metrics["my_pending_tickets"] == 1
    assert metrics["in_progress_tickets"] == 0
    assert metrics["tickets_awaiting_review"] == 0
    assert metrics["completed_tickets"] == 0
    assert metrics["upcoming_deadlines"] == 1
    assert metrics["overdue_tasks"] == 0
    assert len(payload["upcoming_deadlines"]) == 1
    assert payload["upcoming_deadlines"][0]["ticket_id"] == ticket["id"]


def test_tester_failed_kpi_uses_only_current_reopened_non_deleted_tickets(
    ticket_environment,
):
    client, _session_factory, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    currently_reopened = create_ticket(client, ids)
    reopened_then_in_progress = create_ticket(client, ids)
    testing_done = create_ticket(client, ids)
    bug_fixed = create_ticket(client, ids)
    deleted_reopened = create_ticket(client, ids)

    for ticket in (currently_reopened, reopened_then_in_progress, deleted_reopened):
        transition = change_status(
            client,
            ticket["id"],
            "REOPENED",
            "Testing failed and returned to development",
        )
        assert transition.status_code == 200, transition.text

    # A ticket that was reopened but has since returned to development is not
    # currently failed, even though its status history contains REOPENED.
    sign_in_as(client, "DEVELOPER")
    transition = change_status(
        client,
        reopened_then_in_progress["id"],
        "IN_PROGRESS",
    )
    assert transition.status_code == 200, transition.text

    sign_in_as(client, "PM")
    for ticket in (testing_done, bug_fixed):
        transition = change_status(client, ticket["id"], "TESTING")
        assert transition.status_code == 200, transition.text

    sign_in_as(client, "TESTER")
    transition = change_status(client, testing_done["id"], "TESTING_DONE")
    assert transition.status_code == 200, transition.text
    transition = change_status(client, bug_fixed["id"], "BUG_FIXED")
    assert transition.status_code == 200, transition.text

    # Soft-deleted tickets must not contribute to either current-state KPIs
    # or the distinct reopened-history KPI.
    sign_in_as(client, "ADMIN")
    deleted_response = client.delete(f"/api/v1/tickets/{deleted_reopened['id']}")
    assert deleted_response.status_code == 200, deleted_response.text

    sign_in_as(client, "TESTER")
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200, response.text

    metrics = dashboard_metric_map(response.json())
    assert metrics["failed_tickets"] == 1
    assert metrics["reopened_tickets"] == 2
    assert metrics["passed_tickets"] == 1
    assert metrics["assigned_testing_tickets"] == 4


def test_project_overview_returns_full_ticket_distribution_activity_and_deadlines(
    ticket_environment,
):
    client, session_factory, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    completed_ticket = create_ticket(client, ids)
    upcoming_ticket = create_ticket(client, ids)
    deleted_ticket = create_ticket(client, ids)
    assert change_status(client, completed_ticket["id"], "COMPLETED").status_code == 200
    deleted_response = client.delete(f"/api/v1/tickets/{deleted_ticket['id']}")
    assert deleted_response.status_code == 200, deleted_response.text

    with session_factory() as session:
        ticket = session.scalar(
            select(Ticket).where(Ticket.id == UUID(upcoming_ticket["id"]))
        )
        ticket.due_date = date.today() + timedelta(days=5)
        session.commit()

    sign_in_as(client, "DEVELOPER")
    response = client.get(f"/api/v1/projects/{ids['project']}/overview")
    assert response.status_code == 200, response.text

    payload = response.json()
    assert payload["total_tickets"] == 2
    assert payload["completed_tickets"] == 1
    assert payload["completion_percentage"] == 50.0
    assert len(payload["ticket_distribution"]) == 11
    assert sum(item["count"] for item in payload["ticket_distribution"]) == 2
    assert len(payload["team_members"]) == 2
    assert payload["recent_activities"]
    assert len(payload["upcoming_deadlines"]) == 1
    assert payload["upcoming_deadlines"][0]["ticket_id"] == upcoming_ticket["id"]


def test_outsider_cannot_read_project_overview(ticket_environment):
    client, _session_factory, ids = ticket_environment
    sign_in_as(client, "OUTSIDER")

    response = client.get(f"/api/v1/projects/{ids['project']}/overview")
    assert response.status_code == 404


def test_project_attachment_limit_is_five_active_files(ticket_environment, monkeypatch, tmp_path):
    from types import SimpleNamespace

    monkeypatch.setattr(
        "app.services.attachment_storage.get_settings",
        lambda: SimpleNamespace(
            upload_dir=str(tmp_path / "private-files"),
            max_upload_size_bytes=5 * 1024 * 1024,
        ),
    )
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    png_bytes = b"\x89PNG\r\n\x1a\nproject-file"

    five_files = [
        ("files", (f"project-{index}.png", png_bytes, "image/png"))
        for index in range(5)
    ]
    uploaded = client.post(
        f"/api/v1/projects/{ids['project']}/attachments",
        files=five_files,
    )
    assert uploaded.status_code == 201, uploaded.text
    assert len(uploaded.json()["items"]) == 5

    sixth = client.post(
        f"/api/v1/projects/{ids['project']}/attachments",
        files=[("files", ("sixth.png", png_bytes, "image/png"))],
    )
    assert sixth.status_code == 409
    assert "no more than 5 active attachments" in sixth.json()["detail"]

    attachment_id = uploaded.json()["items"][0]["id"]
    deleted = client.delete(
        f"/api/v1/projects/{ids['project']}/attachments/{attachment_id}"
    )
    assert deleted.status_code == 200

    replacement = client.post(
        f"/api/v1/projects/{ids['project']}/attachments",
        files=[("files", ("replacement.png", png_bytes, "image/png"))],
    )
    assert replacement.status_code == 201, replacement.text
    assert len(replacement.json()["items"]) == 5


def test_project_attachment_hard_limit_is_five_mb(
    ticket_environment, monkeypatch, tmp_path
):
    from types import SimpleNamespace

    monkeypatch.setattr(
        "app.services.attachment_storage.get_settings",
        lambda: SimpleNamespace(
            upload_dir=str(tmp_path / "private-files"),
            max_upload_size_bytes=10 * 1024 * 1024,
        ),
    )
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    oversized_png = b"\x89PNG\r\n\x1a\n" + b"x" * (5 * 1024 * 1024 - 7)

    response = client.post(
        f"/api/v1/projects/{ids['project']}/attachments",
        files=[("files", ("over-five-mb.png", oversized_png, "image/png"))],
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "Each attachment must be 5 MB or smaller."

def test_global_search_returns_only_authorized_records(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    ticket = create_ticket(client, ids)

    project_results = client.get(
        "/api/v1/search",
        params={"q": "Ticket Test"},
    )
    assert project_results.status_code == 200, project_results.text
    project_payload = project_results.json()
    assert any(item["id"] == str(ids["project"]) for item in project_payload["projects"])
    assert any(item["id"] == str(ids["team"]) for item in project_payload["teams"])

    ticket_results = client.get(
        "/api/v1/search",
        params={"q": "Implement ticket workflow"},
    )
    assert ticket_results.status_code == 200, ticket_results.text
    assert any(item["id"] == ticket["id"] for item in ticket_results.json()["tickets"])

    ticket_id_results = client.get(
        "/api/v1/search",
        params={"q": ticket["id"][:8]},
    )
    assert ticket_id_results.status_code == 200, ticket_id_results.text
    assert any(item["id"] == ticket["id"] for item in ticket_id_results.json()["tickets"])

    user_results = client.get(
        "/api/v1/search",
        params={"q": "Test Admin"},
    )
    assert user_results.status_code == 200, user_results.text
    assert any(item["id"] == str(ids["admin"]) for item in user_results.json()["users"])

    sign_in_as(client, "OUTSIDER")
    outsider_results = client.get(
        "/api/v1/search",
        params={"q": "Implement ticket workflow"},
    )
    assert outsider_results.status_code == 200, outsider_results.text
    outsider_payload = outsider_results.json()
    assert outsider_payload == {
        "projects": [],
        "tickets": [],
        "users": [],
        "teams": [],
    }


def test_global_search_supports_visible_project_members(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "DEVELOPER")

    response = client.get(
        "/api/v1/search",
        params={"q": "Ticket Test"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert any(item["id"] == str(ids["project"]) for item in payload["projects"])
    assert any(item["id"] == str(ids["team"]) for item in payload["teams"])

    unrelated_user = client.get(
        "/api/v1/search",
        params={"q": "Outside Developer"},
    )
    assert unrelated_user.status_code == 200, unrelated_user.text
    assert not any(
        item["id"] == str(ids["outsider"])
        for item in unrelated_user.json()["users"]
    )


def test_ticket_filter_options_follow_project_visibility(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")
    create_ticket(client, ids)

    response = client.get(
        "/api/v1/tickets/filter-options",
        params={"project_id": str(ids["project"])},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert {person["id"] for person in payload["people"]} >= {
        str(ids["admin"]),
        str(ids["pm"]),
        str(ids["developer"]),
        str(ids["tester"]),
    }
    assert payload["teams"] == [{"id": str(ids["team"]), "name": "Ticket Test Team"}]

    sign_in_as(client, "OUTSIDER")
    denied = client.get(
        "/api/v1/tickets/filter-options",
        params={"project_id": str(ids["project"])},
    )
    assert denied.status_code == 404


def test_ticket_filters_combine_before_pagination(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    first_response = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": "Module 10 acceptance target",
            "type": "TASK",
            "priority": "HIGH",
            "assignee_id": str(ids["developer"]),
            "reviewer_id": str(ids["pm"]),
            "tester_id": str(ids["tester"]),
            "start_date": "2026-11-26",
            "due_date": "2026-11-27",
            "labels": ["module-ten", "workflow"],
        },
    )
    second_response = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": "Module 10 acceptance later",
            "type": "TASK",
            "priority": "HIGH",
            "assignee_id": str(ids["developer"]),
            "reviewer_id": str(ids["pm"]),
            "tester_id": str(ids["tester"]),
            "start_date": "2026-11-26",
            "due_date": "2026-11-28",
            "labels": ["module-ten", "workflow"],
        },
    )
    assert first_response.status_code == 201, first_response.text
    assert second_response.status_code == 201, second_response.text
    first_ticket = first_response.json()
    second_ticket = second_response.json()

    sprint_response = client.post(
        f"/api/v1/projects/{ids['project']}/sprints",
        json={
            "name": "Module 10 Filter Sprint",
            "goal": "Validate combined ticket filters",
            "start_date": "2026-11-27",
            "end_date": "2026-12-04",
        },
    )
    assert sprint_response.status_code == 201, sprint_response.text
    sprint_id = sprint_response.json()["id"]
    added = client.post(
        f"/api/v1/sprints/{sprint_id}/tickets",
        json={"ticket_ids": [first_ticket["id"], second_ticket["id"]]},
    )
    assert added.status_code == 200, added.text

    response = client.get(
        "/api/v1/tickets",
        params={
            "project_id": str(ids["project"]),
            "reporter_id": str(ids["admin"]),
            "team_id": str(ids["team"]),
            "due_date_from": "2026-11-27",
            "due_date_to": "2026-11-27",
            "created_date_from": (date.today() - timedelta(days=2)).isoformat(),
            "created_date_to": (date.today() + timedelta(days=2)).isoformat(),
            "label": "module-ten",
            "sprint_id": sprint_id,
            "search": "Module 10 acceptance",
            "sort_by": "created_at",
            "sort_order": "desc",
            "page": 1,
            "page_size": 1,
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 1
    assert payload["page"] == 1
    assert payload["page_size"] == 1
    assert payload["total_pages"] == 1
    assert [item["id"] for item in payload["items"]] == [first_ticket["id"]]
    assert first_ticket["id"] != second_ticket["id"]


def test_unassigned_filter_is_applied_before_pagination(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    assigned = create_ticket(client, ids)
    unassigned_response = client.post(
        "/api/v1/tickets",
        json={
            "project_id": str(ids["project"]),
            "title": "Unassigned module 10 ticket",
            "type": "TASK",
            "priority": "LOW",
        },
    )
    assert unassigned_response.status_code == 201, unassigned_response.text

    response = client.get(
        "/api/v1/tickets",
        params={
            "assignee_unassigned": "true",
            "page": 1,
            "page_size": 1,
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == unassigned_response.json()["id"]
    assert payload["items"][0]["assignee"] is None
    assert assigned["id"] != unassigned_response.json()["id"]

def test_priority_sort_uses_ticket_priority_order(ticket_environment):
    client, _, ids = ticket_environment
    sign_in_as(client, "ADMIN")

    expected = []
    for priority in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        response = client.post(
            "/api/v1/tickets",
            json={
                "project_id": str(ids["project"]),
                "title": f"Priority sort {priority}",
                "type": "TASK",
                "priority": priority,
            },
        )
        assert response.status_code == 201, response.text
        expected.append((priority, response.json()["ticket_key"]))

    descending = client.get(
        "/api/v1/tickets",
        params={"sort_by": "priority", "sort_order": "desc"},
    )
    ascending = client.get(
        "/api/v1/tickets",
        params={"sort_by": "priority", "sort_order": "asc"},
    )

    assert descending.status_code == 200, descending.text
    assert ascending.status_code == 200, ascending.text
    assert [item["priority"] for item in descending.json()["items"]] == [
        "CRITICAL", "HIGH", "MEDIUM", "LOW",
    ]
    assert [item["priority"] for item in ascending.json()["items"]] == [
        "LOW", "MEDIUM", "HIGH", "CRITICAL",
    ]

