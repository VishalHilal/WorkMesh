"""FastAPI endpoint for grounded DOCX/PDF report generation."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import verify_internal_key
from app.core.database import get_engine
from app.schemas.report import ReportGenerateRequest, ReportGenerateResponse
from app.services.report_generator import generate_report

logger = logging.getLogger(__name__)
router = APIRouter(tags=["reports"])


@router.post(
    "/reports/generate",
    response_model=ReportGenerateResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_key)],
)
def generate_report_endpoint(
    payload: ReportGenerateRequest,
) -> ReportGenerateResponse:
    """Synthesize a grounded company report and return rendered PDF/DOCX bytes."""
    engine = get_engine()

    try:
        with Session(engine) as session:
            data = generate_report(
                session=session,
                company_id=payload.company_id,
                title=payload.title,
                prompt=payload.prompt,
                report_format=payload.format,
                template=payload.template,
                document_ids=payload.document_ids,
            )

        return ReportGenerateResponse(success=True, data=data)
    except Exception as exc:
        logger.exception(
            "Report generation failed for company '%s'", payload.company_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {exc}",
        ) from exc
