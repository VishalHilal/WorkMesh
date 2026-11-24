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

    # Database
    database_url: str = ""

    # Neon Object Storage S3 configuration
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_endpoint_url_s3: str = ""
    aws_region: str = "us-east-2"
    neon_storage_bucket: str = "assets"

    # Embedding configuration
    embedding_model_name: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # Google Gemini LLM configuration
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_api_base_url: str = "https://generativelanguage.googleapis.com/v1beta"


settings = Settings()
