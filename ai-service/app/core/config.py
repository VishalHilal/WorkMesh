from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "WorkMesh AI Service"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = "development"
    port: int = 8000


settings = Settings()
