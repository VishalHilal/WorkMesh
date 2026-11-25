"""Human-in-the-loop approval node: halts graph execution pending user confirmation."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.agents.state import AgentState

logger = logging.getLogger(__name__)


def human_approval_node(state: AgentState) -> dict[str, Any]:
    """Halt the agent graph and emit a unique approval token for the pending email draft.

    This node does NOT send any email.  It sets ``pending_approval=True`` and
    generates a deterministic UUID4 ``approval_token`` that the backend will
    persist and surface to the frontend for the human to approve or reject.
    """
    draft_payload: dict[str, Any] = state.get("draft_payload") or {}
    approval_token: str = str(uuid.uuid4())

    logger.info(
        "Human approval required — token=%s  draft_to=%s",
        approval_token,
        draft_payload.get("to", "<unknown>"),
    )

    return {
        "pending_approval": True,
        "approval_token": approval_token,
        "approved": False,
        "rejected": False,
        "draft_payload": draft_payload,
    }
