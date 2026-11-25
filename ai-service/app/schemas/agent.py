"""Pydantic schemas for multi-agent graph execution endpoints."""

from pydantic import BaseModel, Field

from app.schemas.chat import ChatMessage, Citation


class AgentRunRequest(BaseModel):
    company_id: str = Field(
        ..., min_length=1, description="Tenant company ID for strict scoping"
    )
    query: str = Field(..., min_length=1, description="Employee prompt or request")
    chat_history: list[ChatMessage] = Field(
        default_factory=list,
        description="Optional preceding conversation turns",
    )
    document_ids: list[str] | None = Field(
        default=None,
        description="Optional list of document IDs to scope retrieval",
    )


class AgentRunData(BaseModel):
    answer: str
    agent_handled: str
    agent_path: list[str]
    citations: list[Citation] = Field(default_factory=list)
    iterations: int = 1


class AgentRunResponse(BaseModel):
    success: bool = True
    data: AgentRunData
