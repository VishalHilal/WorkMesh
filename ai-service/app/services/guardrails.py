"""Pre-LLM prompt-injection defense and post-LLM PII/secret redaction guardrails."""

from __future__ import annotations

import re
from dataclasses import dataclass

MAX_QUERY_LENGTH = 2000
SAFE_REFUSAL_MESSAGE = (
    "Your request could not be processed due to WorkMesh safety policies."
)

_INJECTION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "PROMPT_OVERRIDE",
        re.compile(
            r"\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|system)\s+instructions\b",
            re.IGNORECASE,
        ),
    ),
    (
        "SYSTEM_PROMPT_EXFIL",
        re.compile(
            r"\b(reveal|print|show|output|repeat)\s+(your\s+)?(system\s+prompt|hidden\s+instructions)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "SAFETY_BYPASS",
        re.compile(
            r"\b(bypass|disable|override)\s+(safety|guardrails|restrictions|filters)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "JAILBREAK_PERSONA",
        re.compile(
            r"\byou\s+are\s+now\s+(dan|unrestricted|in\s+developer\s+mode)\b",
            re.IGNORECASE,
        ),
    ),
)

_REDACTION_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    (
        "API_KEY",
        re.compile(r"\b(?:AIza[0-9A-Za-z_-]{20,}|(?:sk|lsv2)_[0-9A-Za-z_-]{16,}|sk-[0-9A-Za-z_-]{16,})\b"),
        "[REDACTED_API_KEY]",
    ),
    (
        "SSN",
        re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "[REDACTED_SSN]",
    ),
    (
        "CARD",
        re.compile(r"\b(?:\d{4}[-\s]){3}\d{4}\b"),
        "[REDACTED_CARD]",
    ),
)


@dataclass(frozen=True)
class GuardrailResult:
    """Outcome of pre-LLM user input validation."""

    allowed: bool
    rule: str | None = None
    reason: str | None = None


def validate_user_input(query: str) -> GuardrailResult:
    """Validate user input for length bounds and prompt-injection patterns."""
    if len(query) > MAX_QUERY_LENGTH:
        return GuardrailResult(
            allowed=False,
            rule="MAX_LENGTH_EXCEEDED",
            reason=f"Query exceeds maximum allowed length of {MAX_QUERY_LENGTH} characters.",
        )

    for rule_name, pattern in _INJECTION_PATTERNS:
        if pattern.search(query):
            return GuardrailResult(
                allowed=False,
                rule=rule_name,
                reason=f"Blocked by input guardrail rule: {rule_name}.",
            )

    return GuardrailResult(allowed=True)


def redact_sensitive_output(text: str) -> tuple[str, list[str]]:
    """Redact API keys, SSNs, and payment card numbers from text."""
    redacted = text
    triggered: list[str] = []

    for rule_name, pattern, replacement in _REDACTION_RULES:
        updated, count = pattern.subn(replacement, redacted)
        if count > 0:
            redacted = updated
            triggered.append(rule_name)

    return redacted, triggered
