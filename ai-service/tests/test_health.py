from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_status() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code in (200, 503)


def test_health_response_shape() -> None:
    response = client.get("/api/v1/health")
    body = response.json()

    assert body["data"]["status"] in ("ok", "degraded")
    assert "version" in body["data"]
    assert "timestamp" in body["meta"]


def test_root_returns_200() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "message" in response.json()
