import logging
import time
from typing import Any

import httpx
from langsmith import traceable

from app.core.config import settings
from app.schemas.chat import ChatMessage

logger = logging.getLogger(__name__)

FALLBACK_UNAVAILABLE_MSG = (
    "The AI model is temporarily unreachable. Please ensure GEMINI_API_KEY is configured."
)


def _empty_usage(latency_ms: float = 0.0) -> dict[str, Any]:
    return {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "latency_ms": round(latency_ms, 2),
    }


@traceable(run_type="llm", name="gemini_generate_content")
def call_gemini_with_usage(
    system_prompt: str,
    user_prompt: str,
    chat_history: list[ChatMessage] | None = None,
) -> dict[str, Any]:
    """Invoke Google Gemini API and return answer text alongside token & latency telemetry."""
    started = time.perf_counter()

    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY is not configured in settings")
        return {
            "text": FALLBACK_UNAVAILABLE_MSG,
            "usage": _empty_usage((time.perf_counter() - started) * 1000),
        }

    url = (
        f"{settings.gemini_api_base_url}/models/"
        f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    )

    contents: list[dict[str, Any]] = []

    # Map previous conversation turns (Gemini uses 'user' and 'model')
    if chat_history:
        for msg in chat_history:
            role = "model" if msg.role == "assistant" else "user"
            contents.append(
                {
                    "role": role,
                    "parts": [{"text": msg.content}],
                }
            )

    contents.append(
        {
            "role": "user",
            "parts": [{"text": user_prompt}],
        }
    )

    payload = {
        "system_instruction": {
            "parts": [{"text": system_prompt}],
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048,
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload)

        latency_ms = (time.perf_counter() - started) * 1000

        if response.status_code != 200:
            logger.error(
                "Gemini API returned status %d: %s",
                response.status_code,
                response.text[:200],
            )
            return {
                "text": (
                    f"Unable to generate response from Gemini API ({response.status_code}). "
                    "Please verify the model configuration."
                ),
                "usage": _empty_usage(latency_ms),
            }

        data = response.json()
        usage_meta = data.get("usageMetadata") or {}
        usage = {
            "prompt_tokens": int(usage_meta.get("promptTokenCount") or 0),
            "completion_tokens": int(usage_meta.get("candidatesTokenCount") or 0),
            "total_tokens": int(usage_meta.get("totalTokenCount") or 0),
            "latency_ms": round(latency_ms, 2),
        }

        candidates = data.get("candidates", [])
        if not candidates:
            return {"text": "No response candidates returned by the model.", "usage": usage}

        first_candidate = candidates[0]
        content_parts = first_candidate.get("content", {}).get("parts", [])
        if not content_parts:
            return {"text": "Empty response returned by the model.", "usage": usage}

        answer_text = content_parts[0].get("text", "").strip()
        logger.info(
            "Gemini call completed model=%s total_tokens=%d latency_ms=%.2f",
            settings.gemini_model,
            usage["total_tokens"],
            usage["latency_ms"],
        )
        return {"text": answer_text, "usage": usage}

    except httpx.TimeoutException as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        logger.error("Gemini API call timed out after 30 seconds: %s", exc)
        return {
            "text": "Request to Gemini API timed out. Please try again.",
            "usage": _empty_usage(latency_ms),
        }
    except Exception as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        logger.exception("Unexpected error invoking Gemini API")
        return {
            "text": f"Error communicating with Gemini model: {exc}",
            "usage": _empty_usage(latency_ms),
        }


def call_gemini_api(
    system_prompt: str,
    user_prompt: str,
    chat_history: list[ChatMessage] | None = None,
) -> str:
    """Invoke Google Gemini API and return synthesized text (backwards-compatible wrapper)."""
    result = call_gemini_with_usage(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        chat_history=chat_history,
    )
    return str(result["text"])
