import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]
AI_SERVICE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(AI_SERVICE_DIR / ".env"), str(ROOT_DIR / ".env")],
        extra="ignore",
    )

    app_name: str = "WorkMesh AI Service"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = "development"
    port: int = 8000
    internal_api_key: str = "workmesh-internal-secret-2026-prod-xyz"

    # Database
    database_url: str = ""

    # Neon Object Storage S3 configuration
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_endpoint_url_s3: str = ""
    aws_region: str = "us-east-2"
    neon_storage_bucket: str = "assets"

    # Embedding configuration (Google Gemini)
    embedding_model_name: str = "gemini-embedding-2"
    gemini_embedding_model: str = "gemini-embedding-2"
    embedding_dimension: int = 768

    # Google Gemini LLM configuration
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_api_base_url: str = "https://generativelanguage.googleapis.com/v1beta"

    # LangSmith observability (free developer tier supported)
    langsmith_tracing: bool = False
    langsmith_api_key: str = ""
    langsmith_project: str = "workmesh-ai"


settings = Settings()


def configure_langsmith_env() -> None:
    """Propagate LangSmith settings into process environment when tracing is enabled."""
    if settings.langsmith_tracing and settings.langsmith_api_key:
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
        os.environ.setdefault("LANGCHAIN_API_KEY", settings.langsmith_api_key)
        os.environ.setdefault("LANGCHAIN_PROJECT", settings.langsmith_project)
        os.environ.setdefault("LANGSMITH_TRACING", "true")
        os.environ.setdefault("LANGSMITH_API_KEY", settings.langsmith_api_key)
        os.environ.setdefault("LANGSMITH_PROJECT", settings.langsmith_project)


configure_langsmith_env()
