from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services.embeddings import generate_embeddings


def test_generate_embeddings_empty():
    assert generate_embeddings([]) == []


def test_generate_embeddings_fallback_without_key():
    with patch.object(settings, "gemini_api_key", ""):
        embeddings = generate_embeddings(["Sample document text"])
        assert len(embeddings) == 1
        assert len(embeddings[0]) == 768
        assert embeddings[0] == [0.0] * 768


def test_generate_embeddings_batch_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "embeddings": [
            {"values": [0.05] * 768},
            {"values": [-0.02] * 768},
        ]
    }

    with (
        patch.object(settings, "gemini_api_key", "mock-test-gemini-key"),
        patch("httpx.Client.post", return_value=mock_response),
    ):
        texts = [
            "WorkMesh AI enterprise document search",
            "Employee onboarding and security handbook",
        ]
        embeddings = generate_embeddings(texts)

        assert len(embeddings) == 2
        assert len(embeddings[0]) == 768
        assert len(embeddings[1]) == 768
        assert embeddings[0][0] == 0.05
        assert embeddings[1][0] == -0.02


def test_generate_embeddings_individual_fallback():
    # Simulate batch endpoint returning 404, fallback to individual embedContent
    batch_resp = MagicMock()
    batch_resp.status_code = 404

    single_resp = MagicMock()
    single_resp.status_code = 200
    single_resp.json.return_value = {"embedding": {"values": [0.12] * 768}}

    def side_effect(url, **kwargs):
        if "batchEmbedContents" in url:
            return batch_resp
        return single_resp

    with (
        patch.object(settings, "gemini_api_key", "mock-test-gemini-key"),
        patch("httpx.Client.post", side_effect=side_effect),
    ):
        embeddings = generate_embeddings(["Individual chunk test"])
        assert len(embeddings) == 1
        assert len(embeddings[0]) == 768
        assert embeddings[0][0] == 0.12
