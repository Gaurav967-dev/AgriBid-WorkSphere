from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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
    Sprint,
    SprintTicket,
    Team,
    TeamMember,
    Ticket,
    User,
)

TEST_PASSWORD = "Valid-Test-Password-2026!"


@pytest.fixture
def reports_environment(monkeypatch):
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
                code: Role(code=code, name=label)
                for code, label in (
                    ("ADMIN", "Admin"),
                    ("PM", "Project Manager"),
                    ("DEVELOPER", "Developer"),
                    ("TESTER", "Tester"),
                )
            }
            session.add_all(roles.values())
            session.flush()

            users = {}
            for code, role in roles.items():
                user = User(
                    full_name=f"Report {code.title()}",
                    email=f"{code.lower()}@reports-test.agribid.ai",
                    password_hash=hash_password(TEST_PASSWORD),
                    role=role,
                    is_active=True,
                )
                session.add(user)
                users[code] = user

            outsider = User(
                full_name="Report Outsider",
                email="outsider@reports-test.agribid.ai",
                password_hash=hash_password(TEST_PASSWORD),
                role=roles["DEVELOPER"],
                is_active=True,
            )
            session.add(outsider)
            users["OUTSIDER"] = outsider
            session.flush()

            team = Team(name="Reports Team", status="ACTIVE")
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
                name="Reports Project",
                key="RPT",
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

            other_team = Team(name="Other Reports Team", status="ACTIVE")
            session.add(other_team)
            session.flush()
            other_project = Project(
                name="Private Reports Project",
                key="PRV",
                project_manager_id=users["PM"].id,
                team_id=other_team.id,
                created_by_user_id=users["ADMIN"].id,
                status="ACTIVE",
                visibility="INTERNAL",
            )
            session.add(other_project)
            session.flush()

            today = datetime.now(UTC).date()
            tickets = [
                Ticket(
                    project_id=project.id,
                    number=1,
                    ticket_key="RPT-1",
                    title="Completed high priority",
                    type="TASK",
                    priority="HIGH",
                    status="COMPLETED",
                    reporter_id=users["PM"].id,
                    assignee_id=users["DEVELOPER"].id,
                    due_date=today + timedelta(days=3),
                ),
                Ticket(
                    project_id=project.id,
                    number=2,
                    ticket_key="RPT-2",
                    title="Overdue critical bug",
                    type="BUG",
                    priority="CRITICAL",
                    status="IN_PROGRESS",
                    reporter_id=users["PM"].id,
                    assignee_id=users["DEVELOPER"].id,
                    due_date=today - timedelta(days=1),
                ),
                Ticket(
                    project_id=project.id,
                    number=3,
                    ticket_key="RPT-3",
                    title="Pending low story",
                    type="STORY",
                    priority="LOW",
                    status="TODO",
                    reporter_id=users["ADMIN"].id,
                    assignee_id=users["TESTER"].id,
                ),
                Ticket(
                    project_id=project.id,
                    number=4,
                    ticket_key="RPT-4",
                    title="Cancelled medium task",
                    type="TASK",
                    priority="MEDIUM",
                    status="CANCELLED",
                    reporter_id=users["PM"].id,
                    assignee_id=users["TESTER"].id,
                    due_date=today - timedelta(days=4),
                ),
                Ticket(
                    project_id=project.id,
                    number=5,
                    ticket_key="RPT-5",
                    title="Deleted ticket",
                    type="TASK",
                    priority="LOW",
                    status="TODO",
                    reporter_id=users["PM"].id,
                    assignee_id=users["DEVELOPER"].id,
                    deleted_at=datetime.now(UTC),
                ),
                Ticket(
                    project_id=other_project.id,
                    number=1,
                    ticket_key="PRV-1",
                    title="Private project ticket",
                    type="TASK",
                    priority="HIGH",
                    status="TODO",
                    reporter_id=users["PM"].id,
                    assignee_id=users["DEVELOPER"].id,
                ),
            ]
            session.add_all(tickets)
            session.flush()

            sprint_start = datetime.now(UTC) - timedelta(hours=2)
            sprint_completed = datetime.now(UTC)
            sprint = Sprint(
                project_id=project.id,
                name="Reports Sprint",
                goal="Validate sprint reporting",
                start_date=today - timedelta(days=2),
                end_date=today + timedelta(days=5),
                status="COMPLETED",
                created_by_user_id=users["PM"].id,
                started_at=sprint_start,
                completed_at=sprint_completed,
            )
            session.add(sprint)
            session.flush()

            # Three tickets remained in the final sprint scope; one was removed
            # after the sprint started and is represented as a scope change.
            sprint_assignments = [
                SprintTicket(
                    sprint_id=sprint.id,
                    ticket_id=tickets[0].id,
                    added_by_user_id=users["PM"].id,
                    added_at=sprint_start - timedelta(hours=1),
                    removed_at=sprint_completed,
                    status_at_close="COMPLETED",
                ),
                SprintTicket(
                    sprint_id=sprint.id,
                    ticket_id=tickets[1].id,
                    added_by_user_id=users["PM"].id,
                    added_at=sprint_start - timedelta(hours=1),
                    removed_at=sprint_completed,
                    status_at_close="IN_PROGRESS",
                ),
                SprintTicket(
                    sprint_id=sprint.id,
                    ticket_id=tickets[2].id,
                    added_by_user_id=users["PM"].id,
                    added_at=sprint_start + timedelta(minutes=20),
                    removed_at=sprint_completed,
                    status_at_close="TODO",
                ),
                SprintTicket(
                    sprint_id=sprint.id,
                    ticket_id=tickets[3].id,
                    added_by_user_id=users["PM"].id,
                    added_at=sprint_start - timedelta(hours=1),
                    removed_at=sprint_start + timedelta(minutes=30),
                    status_at_close=None,
                ),
            ]
            session.add_all(sprint_assignments)
            session.commit()

            ids = {
                "project": project.id,
                "team": team.id,
                "other_project": other_project.id,
                "other_team": other_team.id,
                "sprint": sprint.id,
                "admin": users["ADMIN"].id,
                "pm": users["PM"].id,
                "developer": users["DEVELOPER"].id,
                "tester": users["TESTER"].id,
                "outsider": users["OUTSIDER"].id,
            }

        with TestClient(app) as client:
            yield client, ids
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def sign_in_as(client: TestClient, role: str) -> None:
    response = client.post(
        "/api/v1/auth/sign",
        json={
            "email": f"{role.lower()}@reports-test.agribid.ai",
            "password": TEST_PASSWORD,
        },
    )
    assert response.status_code == 200, response.text


def test_project_report_uses_real_ticket_records_and_excludes_deleted(
    reports_environment,
):
    client, ids = reports_environment
    sign_in_as(client, "ADMIN")

    response = client.get(f"/api/v1/reports/projects/{ids['project']}")
    assert response.status_code == 200, response.text
    report = response.json()

    assert report["total_tickets"] == 4
    assert report["completed_tickets"] == 1
    assert report["pending_tickets"] == 2
    assert report["overdue_tickets"] == 1
    assert report["completion_percentage"] == 25.0
    priorities = {item["key"]: item["count"] for item in report["tickets_by_priority"]}
    assert priorities == {"LOW": 1, "MEDIUM": 1, "HIGH": 1, "CRITICAL": 1}
    statuses = {item["key"]: item["count"] for item in report["tickets_by_status"]}
    assert statuses["COMPLETED"] == 1
    assert statuses["IN_PROGRESS"] == 1
    assert statuses["TODO"] == 1
    assert statuses["CANCELLED"] == 1


def test_project_and_team_reports_respect_project_visibility(reports_environment):
    client, ids = reports_environment
    sign_in_as(client, "DEVELOPER")

    project = client.get(f"/api/v1/reports/projects/{ids['project']}")
    private_project = client.get(
        f"/api/v1/reports/projects/{ids['other_project']}"
    )
    team = client.get(f"/api/v1/reports/teams/{ids['team']}")
    private_team = client.get(
        f"/api/v1/reports/teams/{ids['other_team']}"
    )

    assert project.status_code == 200
    assert private_project.status_code == 404
    assert team.status_code == 200
    assert private_team.status_code == 404


def test_team_report_includes_workload_and_completion_context(reports_environment):
    client, ids = reports_environment
    sign_in_as(client, "ADMIN")

    response = client.get(f"/api/v1/reports/teams/{ids['team']}")
    assert response.status_code == 200, response.text
    report = response.json()

    assert report["project_count"] == 1
    assert report["total_assigned_tickets"] == 4
    assert report["completed_tickets"] == 1
    assert report["pending_tickets"] == 2
    assert report["overdue_tickets"] == 1
    assert "not an individual performance score" in report["interpretation_note"]

    workload = {item["role_code"]: item for item in report["workload_by_member"]}
    developer = workload["DEVELOPER"]
    assert developer["assigned_tickets"] == 2
    assert developer["completed_tickets"] == 1
    assert developer["pending_tickets"] == 1
    assert developer["overdue_tickets"] == 1
    assert developer["completion_percentage"] == 50.0

    tester = workload["TESTER"]
    assert tester["assigned_tickets"] == 2
    assert tester["completed_tickets"] == 0
    assert tester["pending_tickets"] == 1


def test_sprint_report_counts_scope_changes_and_final_work(reports_environment):
    client, ids = reports_environment
    sign_in_as(client, "PM")

    response = client.get(f"/api/v1/reports/sprints/{ids['sprint']}")
    assert response.status_code == 200, response.text
    report = response.json()

    assert report["total_tickets"] == 3
    assert report["completed_work"] == 1
    assert report["incomplete_work"] == 2
    assert report["cancelled_work"] == 0
    assert report["completion_rate"] == 33.3
    assert report["tickets_added_after_start"] == 1
    assert report["tickets_removed_after_start"] == 1
    assert report["scope_change_count"] == 2
    assert {item["change_type"] for item in report["scope_changes"]} == {
        "ADDED_AFTER_START",
        "REMOVED_AFTER_START",
    }


def test_sprint_report_is_not_visible_to_an_outsider(reports_environment):
    client, ids = reports_environment
    sign_in_as(client, "OUTSIDER")

    response = client.get(f"/api/v1/reports/sprints/{ids['sprint']}")
    assert response.status_code == 404


def test_report_csv_export_is_authorized_and_contains_report_data(
    reports_environment,
):
    client, ids = reports_environment
    sign_in_as(client, "ADMIN")

    response = client.get(
        f"/api/v1/reports/project/{ids['project']}/export.csv"
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment;" in response.headers["content-disposition"]
    assert "Total tickets" in response.text
    assert "Completed tickets" in response.text

    sign_in_as(client, "OUTSIDER")
    denied = client.get(
        f"/api/v1/reports/project/{ids['project']}/export.csv"
    )
    assert denied.status_code == 404


def test_report_options_only_include_projects_visible_to_the_user(
    reports_environment,
):
    client, ids = reports_environment
    sign_in_as(client, "DEVELOPER")

    response = client.get("/api/v1/reports/options")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert [item["id"] for item in payload["projects"]] == [str(ids["project"])]
    assert [item["id"] for item in payload["teams"]] == [str(ids["team"])]
    assert [item["id"] for item in payload["sprints"]] == [str(ids["sprint"])]
