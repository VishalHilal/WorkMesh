from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_ingest_document_endpoint():
    mock_file_content = (
        b"WorkMesh Technologies Code of Conduct.\nEmployees must act with integrity."
    )

    with (
        patch("app.api.ingest.download_object", return_value=mock_file_content),
        patch("app.api.ingest.get_engine"),
        patch("app.api.ingest.Session"),
    ):
        payload = {
            "document_id": "doc_test_123",
            "company_id": "company_test_abc",
            "storage_key": "documents/company_test_abc/123-test.txt",
            "file_name": "test.txt",
        }

        response = client.post("/api/v1/ingest", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["document_id"] == "doc_test_123"
        assert data["data"]["company_id"] == "company_test_abc"
        assert data["data"]["status"] == "READY"
        assert data["data"]["chunk_count"] >= 1
        assert "timestamp" in data["meta"]
