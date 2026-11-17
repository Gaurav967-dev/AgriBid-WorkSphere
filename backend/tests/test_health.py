from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.endpoints import health as health_endpoint
from app.main import app

client = TestClient(app)


def test_root_endpoint() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["application"] == "AgriBid WorkSphere"


def test_health_endpoint() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "agribid-worksphere-api",
    }


def test_openapi_endpoint() -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "AgriBid WorkSphere API" == response.json()["info"]["title"]


def test_readiness_endpoint_when_database_is_available(
    monkeypatch,
) -> None:
    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def execute(self, statement):
            assert str(statement) == "SELECT 1"

    monkeypatch.setattr(
        health_endpoint.engine,
        "connect",
        lambda: FakeConnection(),
    )

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "database": "connected",
    }


def test_readiness_endpoint_when_database_is_unavailable(
    monkeypatch,
) -> None:
    def failed_connection():
        raise SQLAlchemyError("Simulated database failure")

    monkeypatch.setattr(
        health_endpoint.engine,
        "connect",
        failed_connection,
    )

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == ("Database connection is unavailable.")
