"""Knowledge Agent node: performs tenant-scoped RAG retrieval and synthesis."""

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.agents.state import AgentState
from app.core.database import get_engine
from app.schemas.chat import ChatMessage
from app.services.rag import run_rag_pipeline

logger = logging.getLogger(__name__)


def knowledge_agent_node(state: AgentState) -> dict[str, Any]:
    """Execute grounded knowledge retrieval over company documents."""
    company_id = state.get("company_id", "")
    query = state.get("query", "")
    document_ids = state.get("document_ids")
    agent_path = list(state.get("agent_path") or [])
    agent_path.append("knowledge_agent")

    raw_history = state.get("messages") or []
    chat_history = [
        ChatMessage(role=msg.get("role", "user"), content=msg.get("content", ""))
        for msg in raw_history
        if isinstance(msg, dict) and msg.get("content")
    ]

    engine = get_engine()
    try:
        with Session(engine) as session:
            rag_result = run_rag_pipeline(
                session=session,
                company_id=company_id,
                query=query,
                chat_history=chat_history,
                document_ids=document_ids,
            )
            answer = rag_result.answer
            citations = [cit.model_dump() for cit in rag_result.citations]
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Knowledge agent execution error for company '%s': %s", company_id, exc
        )
        answer = (
            "An error occurred while searching your company documents. "
            "Please verify your connection and try again."
        )
        citations = []

    return {
        "current_agent": "knowledge_agent",
        "route": "FINISH",
        "final_response": answer,
        "citations": citations,
        "agent_path": agent_path,
    }
