import logging
from typing import Any

import httpx

from app.core.config import settings
from app.schemas.chat import ChatMessage

logger = logging.getLogger(__name__)

FALLBACK_UNAVAILABLE_MSG = "The AI model is temporarily unreachable. Please ensure GEMINI_API_KEY is configured."


def call_gemini_api(
    system_prompt: str,
    user_prompt: str,
    chat_history: list[ChatMessage] | None = None,
) -> str:
    """Invoke Google Gemini API with system instructions and user message context."""
    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY is not configured in settings")
        return FALLBACK_UNAVAILABLE_MSG

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

    # Append current augmented prompt
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

        if response.status_code != 200:
            logger.error(
                "Gemini API returned status %d: %s",
                response.status_code,
                response.text[:200],
            )
            return (
                f"Unable to generate response from Gemini API ({response.status_code}). "
                "Please verify the model configuration."
            )

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return "No response candidates returned by the model."

        first_candidate = candidates[0]
        content_parts = first_candidate.get("content", {}).get("parts", [])
        if not content_parts:
            return "Empty response returned by the model."

        answer_text = content_parts[0].get("text", "").strip()
        return answer_text

    except httpx.TimeoutException as exc:
        logger.error("Gemini API call timed out after 30 seconds: %s", exc)
        return "Request to Gemini API timed out. Please try again."
    except Exception as exc:
        logger.exception("Unexpected error invoking Gemini API")
        return f"Error communicating with Gemini model: {exc}"
