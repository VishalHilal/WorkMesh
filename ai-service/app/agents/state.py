"""Typed state representation for WorkMesh LangGraph multi-agent orchestration."""

import operator
from typing import Annotated, Any, Literal, TypedDict

RouteOption = Literal["knowledge_agent", "office_agent", "FINISH"]


class AgentState(TypedDict, total=False):
    """Shared state dictionary tracked and modified across graph nodes."""

    # Tenant boundary
    company_id: str

    # User input and conversation history
    query: str
    messages: Annotated[list[dict[str, Any]], operator.add]
    document_ids: list[str] | None

    # Routing and active worker
    current_agent: str
    route: RouteOption
    iteration_count: int

    # Results and trajectory
    plan: str | None
    final_response: str | None
    citations: list[dict[str, Any]]
    agent_path: list[str]
    error: str | None

    # Human-in-the-loop approval state (Phase 9 — MCP Email Tools)
    pending_approval: bool       # True when graph is halted awaiting human confirm
    approval_token: str | None   # UUID4 token identifying this approval request
    approved: bool               # Set True by the approve API endpoint
    rejected: bool               # Set True by the reject API endpoint
    draft_payload: dict[str, Any] | None  # Structured email draft for review
