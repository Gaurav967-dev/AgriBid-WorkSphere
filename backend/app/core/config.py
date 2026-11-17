from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000

    database_url: str = "postgresql+psycopg://postgres:CHANGE_ME@localhost:5432/agribid_worksphere"

    cors_allowed_origins: str = "http://localhost:3000"

    jwt_secret_key: str = "CHANGE_ME"
    jwt_issuer: str = "agribid-worksphere"
    jwt_audience: str = "agribid-worksphere-api"
    id_token_expire_minutes: int = 5
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    invitation_expire_days: int = 7
    frontend_base_url: str = "http://localhost:3000"

    cookie_secure: bool = False

    upload_dir: str = "storage/uploads"
    max_upload_size_bytes: int = 5 * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        """Convert the comma-separated CORS setting into a list."""
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached settings instance."""
    return Settings()
