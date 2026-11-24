import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_engine
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.rag import run_rag_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
def chat_with_knowledge_base(payload: ChatRequest) -> ChatResponse:
    """Answer employee questions using Google Gemini Flash RAG synthesis over company documents."""
    engine = get_engine()

    try:
        with Session(engine) as session:
            chat_data = run_rag_pipeline(
                session=session,
                company_id=payload.company_id,
                query=payload.query,
                chat_history=payload.chat_history,
                top_k=payload.top_k,
                threshold=payload.threshold,
                document_ids=payload.document_ids,
            )

        return ChatResponse(success=True, data=chat_data)
    except Exception as exc:
        logger.exception(
            "RAG chat pipeline failed for company '%s'", payload.company_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG chat pipeline failed: {exc}",
        ) from exc
