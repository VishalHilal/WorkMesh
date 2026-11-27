"""Unit tests for LangSmith tracing configuration and token/latency telemetry.

Covers Issue #89 — Phase 15 AI Observability, Guardrails & Evaluation.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.schemas.agent import AgentRunData
from app.schemas.chat import ChatData
from app.services.llm import call_gemini_api, call_gemini_with_usage


def test_call_gemini_with_usage_extracts_tokens_and_latency() -> None:
    """call_gemini_with_usage parses Gemini usageMetadata and positive latency_ms."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {"content": {"parts": [{"text": "Employees get 12 sick days."}]}}
        ],
        "usageMetadata": {
            "promptTokenCount": 42,
            "candidatesTokenCount": 18,
            "totalTokenCount": 60,
        },
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value.post.return_value = mock_response

    with (
        patch("app.services.llm.settings.gemini_api_key", "dummy-key"),
        patch("app.services.llm.httpx.Client", return_value=mock_client),
    ):
        result = call_gemini_with_usage(
            system_prompt="You are helpful.",
            user_prompt="How many sick days?",
        )

    assert result["text"] == "Employees get 12 sick days."
    assert result["usage"]["prompt_tokens"] == 42
    assert result["usage"]["completion_tokens"] == 18
    assert result["usage"]["total_tokens"] == 60
    assert result["usage"]["latency_ms"] >= 0.0


def test_call_gemini_api_backwards_compatible_string_return() -> None:
    """call_gemini_api wrapper continues returning plain str."""
    with patch(
        "app.services.llm.call_gemini_with_usage",
        return_value={"text": "Hello from Gemini", "usage": {"total_tokens": 5}},
    ):
        output = call_gemini_api(system_prompt="sys", user_prompt="hi")

    assert output == "Hello from Gemini"


def test_langsmith_noop_when_api_key_unset() -> None:
    """Calling traced LLM helper without LangSmith or Gemini API key never crashes."""
    with (
        patch("app.services.llm.settings.langsmith_tracing", False),
        patch("app.services.llm.settings.langsmith_api_key", ""),
        patch("app.services.llm.settings.gemini_api_key", ""),
    ):
        result = call_gemini_with_usage(system_prompt="sys", user_prompt="hi")

    assert "GEMINI_API_KEY" in result["text"]
    assert result["usage"]["total_tokens"] == 0


def test_schemas_accept_optional_usage_telemetry() -> None:
    """ChatData and AgentRunData accept optional usage dictionary."""
    usage = {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15, "latency_ms": 120.5}
    chat = ChatData(
        query="q",
        answer="a",
        citations=[],
        model="gemini-3.5-flash-lite",
        grounded=True,
        usage=usage,
    )
    agent = AgentRunData(
        answer="a",
        agent_handled="knowledge_agent",
        agent_path=["supervisor", "knowledge_agent"],
        usage=usage,
    )
    assert chat.usage == usage
    assert agent.usage == usage
