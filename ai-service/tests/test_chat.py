from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.chat import ChatData, Citation

client = TestClient(app)


def test_chat_endpoint_success():
    mock_chat_data = ChatData(
        query="What is the remote work policy?",
        answer="Employees can work from home 2 days a week [Source: chunk-1].",
        citations=[
            Citation(
                chunk_id="chunk-1",
                document_id="doc-100",
                chunk_index=0,
                snippet="Remote work is allowed 2 days per week...",
                similarity_score=0.91,
            )
        ],
        model="gemini-3.8-flash",
        grounded=True,
    )

    with (
        patch("app.api.chat.get_engine"),
        patch("app.api.chat.Session"),
        patch("app.api.chat.run_rag_pipeline", return_value=mock_chat_data),
    ):
        payload = {
            "company_id": "company_test_abc",
            "query": "What is the remote work policy?",
            "top_k": 3,
            "threshold": 0.4,
        }

        response = client.post("/api/v1/chat", json=payload)

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["query"] == "What is the remote work policy?"
        assert "Employees can work from home" in body["data"]["answer"]
        assert body["data"]["model"] == "gemini-3.8-flash"
        assert body["data"]["grounded"] is True
        assert len(body["data"]["citations"]) == 1
        assert body["data"]["citations"][0]["chunk_id"] == "chunk-1"


def test_chat_endpoint_validation_errors():
    # Missing required query
    response = client.post("/api/v1/chat", json={"company_id": "c1"})
    assert response.status_code == 422

    # Missing required company_id
    response = client.post("/api/v1/chat", json={"query": "test query"})
    assert response.status_code == 422

    # Empty query string
    response = client.post("/api/v1/chat", json={"company_id": "c1", "query": ""})
    assert response.status_code == 422

    # top_k exceeds max 20
    response = client.post(
        "/api/v1/chat",
        json={"company_id": "c1", "query": "test", "top_k": 50},
    )
    assert response.status_code == 422


def test_chat_endpoint_error_handling():
    with (
        patch("app.api.chat.get_engine"),
        patch("app.api.chat.Session", side_effect=Exception("Database failure")),
    ):
        payload = {
            "company_id": "company_test_abc",
            "query": "something",
        }

        response = client.post("/api/v1/chat", json=payload)
        assert response.status_code == 500
        assert "RAG chat pipeline failed" in response.json()["detail"]
