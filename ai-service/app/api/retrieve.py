import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_engine
from app.schemas.retrieve import RetrieveData, RetrieveRequest, RetrieveResponse
from app.services.retriever import retrieve_relevant_chunks

logger = logging.getLogger(__name__)
router = APIRouter(tags=["retrieval"])


@router.post(
    "/retrieve", response_model=RetrieveResponse, status_code=status.HTTP_200_OK
)
def retrieve_chunks(payload: RetrieveRequest) -> RetrieveResponse:
    """Retrieve ranked chunks for a natural language query using vector similarity."""
    engine = get_engine()

    try:
        with Session(engine) as session:
            chunks = retrieve_relevant_chunks(
                session=session,
                company_id=payload.company_id,
                query=payload.query,
                top_k=payload.top_k,
                threshold=payload.threshold,
                document_ids=payload.document_ids,
            )

        return RetrieveResponse(
            success=True,
            data=RetrieveData(
                query=payload.query,
                company_id=payload.company_id,
                total_results=len(chunks),
                chunks=chunks,
            ),
        )
    except Exception as exc:
        logger.exception("Vector retrieval failed for company '%s'", payload.company_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vector retrieval failed: {exc}",
        ) from exc
