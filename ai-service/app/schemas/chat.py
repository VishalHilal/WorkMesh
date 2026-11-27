from typing import Any

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the speaker: 'user' or 'assistant'")
    content: str = Field(..., min_length=1, description="Text content of the message")


class Citation(BaseModel):
    chunk_id: str
    document_id: str
    chunk_index: int
    snippet: str
    similarity_score: float


class ChatRequest(BaseModel):
    company_id: str = Field(
        ..., min_length=1, description="Tenant company ID for strict scoping"
    )
    query: str = Field(..., min_length=1, description="Employee question or prompt")
    chat_history: list[ChatMessage] = Field(
        default_factory=list,
        description="Optional preceding conversation turns",
    )
    top_k: int = Field(
        default=5, ge=1, le=20, description="Max number of context chunks to retrieve"
    )
    threshold: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity threshold",
    )
    document_ids: list[str] | None = Field(
        default=None,
        description="Optional list of document IDs to scope retrieval",
    )


class ChatData(BaseModel):
    query: str
    answer: str
    citations: list[Citation]
    model: str
    grounded: bool
    usage: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    success: bool = True
    data: ChatData
