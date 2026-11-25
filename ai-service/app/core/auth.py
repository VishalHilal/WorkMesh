"""Internal authentication dependencies for WorkMesh AI service."""

from fastapi import Header, HTTPException, status

from app.core.config import settings


def verify_internal_key(
    x_internal_key: str | None = Header(None, alias="X-Internal-Key"),
) -> None:
    """Verify that incoming requests carry a valid internal service key."""
    expected = settings.internal_api_key
    if expected and x_internal_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Internal-Key header",
        )
