"""Office Agent node: specialized prompt and execution for safe enterprise drafting."""

import json
import logging
import re
from typing import Any

from app.agents.state import AgentState
from app.schemas.chat import ChatMessage
from app.services.llm import call_gemini_api

logger = logging.getLogger(__name__)

_EMAIL_INTENT_RE = re.compile(
    r"\b(e-?mail|mail|send\s+(?:a\s+)?(?:note|message|email)|write\s+to|reply\s+to)\b",
    re.IGNORECASE,
)
_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)

OFFICE_AGENT_SYSTEM_PROMPT = """You are WorkMesh Office Agent, an enterprise administrative workflow assistant for WorkMesh Technologies Pvt. Ltd.
Your job is to assist employees with internal office workflows: drafting professional memos, executive announcements, meeting summaries, follow-up emails, and structured action-item checklists.

Strict Enterprise Safety Guardrails:
1. Human-in-the-Loop Safe Execution:
   - When drafting emails, announcements, or notifications, always structure them clearly with explicit metadata placeholders:
     * Subject: [Subject Line]
     * Audience / To: [Target Team or Department]
     * Summary / Body: [Professional, well-structured content]
     * Action Items & Next Steps: [Checklist with checkboxes '- [ ]', assignees, and deadlines if applicable]
   - Always append an operational safety notice at the end:
     "> ⚠️ **WorkMesh Safe Execution Notice**: This is a generated draft. Please review and approve before distributing or sending externally."
2. Prohibited Actions:
   - Do NOT attempt to execute external network requests, schedule live meetings, or transmit communications directly. All output is strictly draft-only for employee review.
3. Tone and Style:
   - Maintain a crisp, professional, enterprise-grade executive tone.
   - Use clean Markdown headers, bullet points, and callouts for readability.
"""

EMAIL_DRAFT_JSON_PROMPT = """You are WorkMesh Office Agent drafting an email for human-in-the-loop approval.
Return ONLY a valid JSON object (no surrounding markdown or prose) with these exact keys:
{
  "to": "recipient@company.com",
  "subject": "Concise professional subject line",
  "body": "Well-structured professional email body",
  "cc": []
}
If no specific recipient email is mentioned, use "team@workmesh.com".
Never include secrets or claim the email has already been sent.
"""


def _extract_email_payload(raw_text: str) -> dict[str, Any] | None:
    """Parse structured email draft JSON from LLM output if present."""
    candidate = raw_text.strip()
    block_match = _JSON_BLOCK_RE.search(candidate)
    if block_match:
        candidate = block_match.group(1).strip()

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return None

    if not isinstance(parsed, dict):
        return None

    to_val = str(parsed.get("to") or "").strip()
    subject_val = str(parsed.get("subject") or "").strip()
    body_val = str(parsed.get("body") or "").strip()
    raw_cc = parsed.get("cc") or []
    cc_val = [str(addr).strip() for addr in raw_cc if str(addr).strip()] if isinstance(raw_cc, list) else []

    if not (to_val and subject_val and body_val):
        return None

    return {
        "to": to_val,
        "subject": subject_val,
        "body": body_val,
        "cc": cc_val,
    }


def generate_email_draft_payload(
    instruction: str,
    context: str | None = None,
) -> dict[str, Any]:
    """Generate a structured email draft dict from an instruction and optional context."""
    user_prompt = f"Email Instruction: {instruction}"
    if context and context.strip():
        user_prompt = f"{user_prompt}\n\nAdditional Context:\n{context.strip()}"

    raw_output = call_gemini_api(
        system_prompt=EMAIL_DRAFT_JSON_PROMPT,
        user_prompt=user_prompt,
        chat_history=[],
    )

    payload = _extract_email_payload(raw_output)
    if payload is not None:
        return payload

    # Safe fallback if the model returned prose instead of strict JSON
    return {
        "to": "team@workmesh.com",
        "subject": instruction[:80].strip() or "WorkMesh Email Draft",
        "body": raw_output.strip(),
        "cc": [],
    }


def office_agent_node(state: AgentState) -> dict[str, Any]:
    """Execute enterprise office workflow drafting and action item structuring."""
    query = state.get("query", "")
    agent_path = list(state.get("agent_path") or [])
    agent_path.append("office_agent")

    raw_history = state.get("messages") or []
    chat_history = [
        ChatMessage(role=msg.get("role", "user"), content=msg.get("content", ""))
        for msg in raw_history
        if isinstance(msg, dict) and msg.get("content")
    ]

    is_email = bool(_EMAIL_INTENT_RE.search(query))
    draft_payload: dict[str, Any] | None = None

    try:
        if is_email:
            draft_payload = generate_email_draft_payload(instruction=query)
            cc_line = f"\n* **CC:** {', '.join(draft_payload['cc'])}" if draft_payload["cc"] else ""
            draft = (
                f"I have prepared an email draft for your review:\n\n"
                f"* **To:** {draft_payload['to']}{cc_line}\n"
                f"* **Subject:** {draft_payload['subject']}\n\n"
                f"{draft_payload['body']}\n\n"
                "> ⚠️ **WorkMesh Safe Execution Notice**: This draft is awaiting your explicit approval before sending."
            )
        else:
            draft = call_gemini_api(
                system_prompt=OFFICE_AGENT_SYSTEM_PROMPT,
                user_prompt=f"Office Task Request: {query}",
                chat_history=chat_history,
            )
    except Exception as exc:  # noqa: BLE001
        logger.error("Office agent drafting error: %s", exc)
        draft = (
            "I encountered an issue preparing this office draft. "
            "Please refine your prompt or try again."
        )
        draft_payload = None

    result: dict[str, Any] = {
        "current_agent": "office_agent",
        "route": "FINISH",
        "final_response": draft,
        "citations": [],
        "agent_path": agent_path,
    }
    if draft_payload is not None:
        result["draft_payload"] = draft_payload

    return result
