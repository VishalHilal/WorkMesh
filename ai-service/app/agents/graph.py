"""Compiled LangGraph StateGraph orchestration for WorkMesh multi-agent workflows."""

import logging
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.agents.knowledge_agent import knowledge_agent_node
from app.agents.nodes.human_approval import human_approval_node
from app.agents.office_agent import office_agent_node
from app.agents.state import AgentState
from app.agents.supervisor import supervisor_node
from app.services.guardrails import (
    SAFE_REFUSAL_MESSAGE,
    redact_sensitive_output,
    validate_user_input,
)

logger = logging.getLogger(__name__)


def route_supervisor(state: AgentState) -> str:
    """Evaluate supervisor route decision to transition to a worker node or finish."""
    route = state.get("route", "FINISH")
    if route == "knowledge_agent":
        return "knowledge_agent"
    if route == "office_agent":
        return "office_agent"
    return END


def route_office_agent(state: AgentState) -> str:
    """Route Office Agent output: email drafts go to human_approval_node; others finish."""
    draft_payload = state.get("draft_payload")
    if draft_payload:
        return "human_approval"
    return END


def create_agent_graph() -> Any:
    """Build and compile the multi-agent StateGraph."""
    builder = StateGraph(AgentState)

    builder.add_node("supervisor", supervisor_node)
    builder.add_node("knowledge_agent", knowledge_agent_node)
    builder.add_node("office_agent", office_agent_node)
    builder.add_node("human_approval", human_approval_node)

    builder.add_edge(START, "supervisor")
    builder.add_conditional_edges(
        "supervisor",
        route_supervisor,
        {
            "knowledge_agent": "knowledge_agent",
            "office_agent": "office_agent",
            END: END,
        },
    )
    builder.add_edge("knowledge_agent", END)
    builder.add_conditional_edges(
        "office_agent",
        route_office_agent,
        {
            "human_approval": "human_approval",
            END: END,
        },
    )
    builder.add_edge("human_approval", END)

    return builder.compile()


# Compile graph instance
compiled_agent_graph = create_agent_graph()


def run_agent_workflow(
    company_id: str,
    query: str,
    chat_history: list[dict[str, Any]] | None = None,
    document_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Execute the compiled agent graph with tenant-isolated initial state."""
    guard = validate_user_input(query)
    if not guard.allowed:
        logger.warning(
            "Agent input guardrail triggered for company '%s' (rule=%s)",
            company_id,
            guard.rule,
        )
        return {
            "answer": SAFE_REFUSAL_MESSAGE,
            "agent_handled": "supervisor",
            "agent_path": ["guardrail"],
            "citations": [],
            "iterations": 0,
            "pending_approval": False,
            "approval_token": None,
            "draft_payload": None,
        }

    initial_state: AgentState = {
        "company_id": company_id,
        "query": query,
        "messages": chat_history or [],
        "document_ids": document_ids,
        "iteration_count": 0,
        "agent_path": [],
        "citations": [],
    }

    logger.info(
        "Invoking agent graph for company '%s' (query: '%s')",
        company_id,
        query[:50],
    )

    final_state = compiled_agent_graph.invoke(initial_state)

    raw_answer = (
        final_state.get("final_response")
        or "I was unable to synthesize a response for this request."
    )
    answer, redacted_rules = redact_sensitive_output(raw_answer)
    if redacted_rules:
        logger.warning(
            "Redacted sensitive output in agent response for company '%s' (rules=%s)",
            company_id,
            redacted_rules,
        )
    agent_handled = final_state.get("current_agent") or "supervisor"
    agent_path = final_state.get("agent_path") or ["supervisor"]
    citations = final_state.get("citations") or []
    iterations = final_state.get("iteration_count") or 1

    pending_approval = final_state.get("pending_approval") or False
    approval_token = final_state.get("approval_token") or None
    draft_payload = final_state.get("draft_payload") or None

    return {
        "answer": answer,
        "agent_handled": agent_handled,
        "agent_path": agent_path,
        "citations": citations,
        "iterations": iterations,
        "pending_approval": pending_approval,
        "approval_token": approval_token,
        "draft_payload": draft_payload,
    }
