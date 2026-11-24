from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.retrieve import ChunkMatch

client = TestClient(app)


def test_retrieve_endpoint_success():
    mock_chunks = [
        ChunkMatch(
            chunk_id="chunk-abc",
            document_id="doc-123",
            chunk_index=0,
            content="WorkMesh Technologies employee handbook overview.",
            token_count=8,
            similarity_score=0.9125,
        )
    ]

    with (
        patch("app.api.retrieve.get_engine"),
        patch("app.api.retrieve.Session"),
        patch(
            "app.api.retrieve.retrieve_relevant_chunks",
            return_value=mock_chunks,
        ),
    ):
        payload = {
            "company_id": "company_test_123",
            "query": "employee handbook overview",
            "top_k": 5,
            "threshold": 0.4,
        }

        response = client.post("/api/v1/retrieve", json=payload)

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["query"] == "employee handbook overview"
        assert body["data"]["company_id"] == "company_test_123"
        assert body["data"]["total_results"] == 1
        assert len(body["data"]["chunks"]) == 1
        assert body["data"]["chunks"][0]["chunk_id"] == "chunk-abc"
        assert body["data"]["chunks"][0]["similarity_score"] == 0.9125


def test_retrieve_endpoint_validation_errors():
    # Missing required query
    response = client.post("/api/v1/retrieve", json={"company_id": "c1"})
    assert response.status_code == 422

    # Missing required company_id
    response = client.post("/api/v1/retrieve", json={"query": "test"})
    assert response.status_code == 422

    # Empty company_id
    response = client.post("/api/v1/retrieve", json={"company_id": "", "query": "test"})
    assert response.status_code == 422

    # top_k exceeds max 20
    response = client.post(
        "/api/v1/retrieve",
        json={"company_id": "c1", "query": "test", "top_k": 50},
    )
    assert response.status_code == 422

    # threshold exceeds 1.0
    response = client.post(
        "/api/v1/retrieve",
        json={"company_id": "c1", "query": "test", "threshold": 1.5},
    )
    assert response.status_code == 422


def test_retrieve_endpoint_error_handling():
    with (
        patch("app.api.retrieve.get_engine"),
        patch(
            "app.api.retrieve.Session",
            side_effect=Exception("Database connection error"),
        ),
    ):
        payload = {
            "company_id": "company_test_123",
            "query": "something",
        }

        response = client.post("/api/v1/retrieve", json=payload)
        assert response.status_code == 500
        assert "Database connection error" in response.json()["detail"]
