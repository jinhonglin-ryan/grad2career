from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    # ---------- Supabase ----------
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: Optional[str] = None

    # ---------- Google OAuth ----------
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
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
    careeronestop_api_key: Optional[str] = None  # API token for Bearer authentication
    careeronestop_user_id: Optional[str] = None  # User ID for API endpoint (if separate from API key)

    # ---------- Credential Engine API ----------
    credential_engine_api_key: Optional[str] = None

    # ---------- OpenAI API ----------
    openai_api_key: Optional[str] = None

    # ---------- Search API (for live training search) ----------
    serper_api_key: Optional[str] = None

    # ---------- Speech / Transcription ----------
    # Path to your JSON key, read from .env via:
    # GOOGLE_APPLICATION_CREDENTIALS=google-credentials.json
    google_application_credentials: Optional[str] = None

    # Defaults for transcription service
    google_speech_language_code: str = "en-US"
    google_speech_sample_rate_hz: int = 16000

    # ---------- General Config ----------
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


def configure_adk_env():
    """Applies the right environment variables so ADK (and Google SDKs) can detect your credentials."""
    # Gemini / Vertex flags
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = (
        "TRUE" if settings.google_genai_use_vertexai else "FALSE"
    )

    if settings.google_genai_use_vertexai:
        if settings.google_cloud_project:
            os.environ["GOOGLE_CLOUD_PROJECT"] = settings.google_cloud_project
        os.environ["GOOGLE_CLOUD_LOCATION"] = settings.google_cloud_location
    elif settings.google_api_key:
        os.environ["GOOGLE_API_KEY"] = settings.google_api_key

    # 🔑 ***THIS IS THE IMPORTANT PART***:
    # Forward the path from .env into the real env var that google-auth reads.
    if settings.google_application_credentials:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.google_application_credentials
