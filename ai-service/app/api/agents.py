"""FastAPI endpoint for multi-agent graph execution."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.agents.graph import run_agent_workflow
from app.core.auth import verify_internal_key
from app.schemas.agent import AgentRunData, AgentRunRequest, AgentRunResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["agents"])


@router.post(
    "/agents/run",
    response_model=AgentRunResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_key)],
)
def run_agent_graph_endpoint(payload: AgentRunRequest) -> AgentRunResponse:
    """Execute LangGraph supervisor and worker nodes with tenant boundary protection."""
    try:
        chat_history_dicts = [msg.model_dump() for msg in payload.chat_history]
        result = run_agent_workflow(
            company_id=payload.company_id,
            query=payload.query,
            chat_history=chat_history_dicts,
            document_ids=payload.document_ids,
        )

        return AgentRunResponse(
            success=True,
            data=AgentRunData(
                answer=result["answer"],
                agent_handled=result["agent_handled"],
                agent_path=result["agent_path"],
                citations=result["citations"],
                iterations=result["iterations"],
                pending_approval=result.get("pending_approval", False),
                approval_token=result.get("approval_token"),
                draft_payload=result.get("draft_payload"),
            ),
        )
    except Exception as exc:
        logger.exception(
            "Agent workflow execution failed for company '%s'", payload.company_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent workflow execution failed: {exc}",
        ) from exc
