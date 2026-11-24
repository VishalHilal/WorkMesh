from unittest.mock import MagicMock, patch

import httpx

from app.core.config import settings
from app.schemas.chat import ChatMessage
from app.services.llm import FALLBACK_UNAVAILABLE_MSG, call_gemini_api


def test_call_gemini_api_missing_key():
    with patch.object(settings, "gemini_api_key", ""):
        res = call_gemini_api("System", "User query")
        assert res == FALLBACK_UNAVAILABLE_MSG


def test_call_gemini_api_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": (
                                "Employees are entitled to 20 days paid leave [Source: chunk_1]."
                            )
                        }
                    ]
                }
            }
        ]
    }

    with (
        patch.object(settings, "gemini_api_key", "test_key"),
        patch("httpx.Client.post", return_value=mock_response),
    ):
        history = [ChatMessage(role="user", content="Hello")]
        result = call_gemini_api("System prompt", "User query", history)
        assert "Employees are entitled to 20 days paid leave" in result
        assert "[Source: chunk_1]" in result


def test_call_gemini_api_http_error():
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = "Forbidden"

    with (
        patch.object(settings, "gemini_api_key", "test_key"),
        patch("httpx.Client.post", return_value=mock_response),
    ):
        result = call_gemini_api("System", "User query")
        assert "Unable to generate response from Gemini API (403)" in result


def test_call_gemini_api_timeout():
    with (
        patch.object(settings, "gemini_api_key", "test_key"),
        patch("httpx.Client.post", side_effect=httpx.TimeoutException("Timeout")),
    ):
        result = call_gemini_api("System", "User query")
        assert "timed out" in result
