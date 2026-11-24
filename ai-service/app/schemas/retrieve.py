from pydantic import BaseModel, Field


class RetrieveRequest(BaseModel):
    company_id: str = Field(
        ..., min_length=1, description="Tenant company ID for strict isolation"
    )
    query: str = Field(..., min_length=1, description="Natural language search query")
    top_k: int = Field(
        default=5, ge=1, le=20, description="Max number of ranked chunks to return"
    )
    threshold: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity score threshold (0.0 to 1.0)",
    )
    document_ids: list[str] | None = Field(
        default=None, description="Optional list of document IDs to scope search"
    )


class ChunkMatch(BaseModel):
    chunk_id: str
    document_id: str
    chunk_index: int
    content: str
    token_count: int
    similarity_score: float


class RetrieveData(BaseModel):
    query: str
    company_id: str
    total_results: int
    chunks: list[ChunkMatch]


class RetrieveResponse(BaseModel):
    success: bool = True
    data: RetrieveData
