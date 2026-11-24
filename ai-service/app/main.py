from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.api.retrieve import router as retrieve_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.include_router(health_router, prefix="/api/v1/health", tags=["health"])
app.include_router(ingest_router, prefix="/api/v1", tags=["ingest"])
app.include_router(retrieve_router, prefix="/api/v1", tags=["retrieval"])


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "WorkMesh AI Service is running."}
