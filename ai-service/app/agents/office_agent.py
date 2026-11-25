"""Office Agent node: specialized prompt and execution for safe enterprise drafting."""

import logging
from typing import Any

from app.agents.state import AgentState
from app.schemas.chat import ChatMessage
from app.services.llm import call_gemini_api

logger = logging.getLogger(__name__)

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

    try:
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

    return {
        "current_agent": "office_agent",
        "route": "FINISH",
        "final_response": draft,
        "citations": [],
        "agent_path": agent_path,
    }
