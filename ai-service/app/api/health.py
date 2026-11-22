from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.health import HealthData, HealthResponse, MetaInfo

router = APIRouter()


@router.get("", response_model=HealthResponse, summary="Health check")
def health_check() -> HealthResponse:
    return HealthResponse(
        data=HealthData(status="ok", version=settings.app_version),
        meta=MetaInfo(timestamp=datetime.now(UTC).isoformat()),
    )
