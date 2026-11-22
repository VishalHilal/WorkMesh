from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import check_db_connection
from app.schemas.health import HealthData, HealthResponse, MetaInfo, ServiceStatus

router = APIRouter()


@router.get("", response_model=HealthResponse, summary="Health check")
def health_check() -> JSONResponse:
    db_ok = check_db_connection()
    db_status = "ok" if db_ok else "error"
    overall = "ok" if db_ok else "degraded"
    http_status = 200 if db_ok else 503

    body = HealthResponse(
        data=HealthData(
            status=overall,
            version=settings.app_version,
            services=ServiceStatus(database=db_status),
        ),
        meta=MetaInfo(timestamp=datetime.now(UTC).isoformat()),
    )

    return JSONResponse(content=body.model_dump(), status_code=http_status)
