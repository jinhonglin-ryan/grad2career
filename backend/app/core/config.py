from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---------- Supabase ----------
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: Optional[str] = None

    # ---------- Google OAuth ----------
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str = "http://127.0.0.1:8000/auth/google/callback"

    # ---------- JWT ----------
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 10080  # 7 days

    # ---------- Frontend ----------
    frontend_url: str = "http://localhost:5173"

    # ---------- Gemini / ADK ----------
    google_genai_use_vertexai: bool = False
    google_api_key: Optional[str] = None
    google_cloud_project: Optional[str] = None
    google_cloud_location: str = "us-central1"

    # ---------- YouTube ----------
    youtube_api_key: Optional[str] = None

    # ---------- CareerOneStop API ----------
    careeronestop_api_key: Optional[str] = None

    # ---------- Credential Engine API ----------
    credential_engine_api_key: Optional[str] = None

    # ---------- General Config ----------
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


def configure_adk_env():
    """Applies the right environment variables so ADK can detect your credentials."""
    import os

    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE" if settings.google_genai_use_vertexai else "FALSE"

    if settings.google_genai_use_vertexai:
        if settings.google_cloud_project:
            os.environ["GOOGLE_CLOUD_PROJECT"] = settings.google_cloud_project
        os.environ["GOOGLE_CLOUD_LOCATION"] = settings.google_cloud_location
    elif settings.google_api_key:
        os.environ["GOOGLE_API_KEY"] = settings.google_api_key