from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_status() -> None:
    with patch("app.api.health.check_db_connection", return_value=True):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json()["data"]["status"] == "ok"


def test_health_response_shape() -> None:
    with patch("app.api.health.check_db_connection", return_value=False):
        response = client.get("/api/v1/health")
        assert response.status_code == 503
        body = response.json()
        assert body["data"]["status"] == "degraded"
        assert "version" in body["data"]
        assert "timestamp" in body["meta"]


def test_root_returns_200() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()
