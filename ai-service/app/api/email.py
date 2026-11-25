"""FastAPI endpoint for MCP email draft generation with human-in-the-loop approval token."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.agents.nodes.human_approval import human_approval_node
from app.agents.office_agent import generate_email_draft_payload
from app.agents.state import AgentState
from app.core.auth import verify_internal_key

logger = logging.getLogger(__name__)
router = APIRouter(tags=["email"])


class EmailDraftGenerateRequest(BaseModel):
    """Request payload for generating a pending email draft."""

    company_id: str = Field(..., min_length=1, description="Tenant company ID")
    instruction: str = Field(..., min_length=1, description="Email drafting instruction")
    context: str | None = Field(default=None, description="Optional supporting context")


class EmailDraftPayload(BaseModel):
    """Structured email draft returned for human review."""

    to: str
    subject: str
    body: str
    cc: list[str] = Field(default_factory=list)


class EmailDraftGenerateData(BaseModel):
    """Response data containing the UUID4 approval token and structured draft."""

    approval_token: str
    draft: EmailDraftPayload


class EmailDraftGenerateResponse(BaseModel):
    """Envelope for email draft generation endpoint."""

    success: bool = True
    data: EmailDraftGenerateData


@router.post(
    "/agents/email/draft",
    response_model=EmailDraftGenerateResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_key)],
)
def generate_email_draft_endpoint(
    payload: EmailDraftGenerateRequest,
) -> EmailDraftGenerateResponse:
    """Generate a structured email draft and halt with a UUID4 approval token."""
    try:
        draft_dict = generate_email_draft_payload(
            instruction=payload.instruction,
            context=payload.context,
        )
        state: AgentState = {
            "company_id": payload.company_id,
            "query": payload.instruction,
            "draft_payload": draft_dict,
        }
        approval_result = human_approval_node(state)

        return EmailDraftGenerateResponse(
            success=True,
            data=EmailDraftGenerateData(
                approval_token=approval_result["approval_token"],
                draft=EmailDraftPayload(**draft_dict),
            ),
        )
    except Exception as exc:
        logger.exception(
            "Email draft generation failed for company '%s'", payload.company_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Email draft generation failed: {exc}",
        ) from exc
