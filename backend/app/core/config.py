from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    DEBUG: bool = False

    # JWT Auth (self-hosted)
    JWT_SECRET_KEY: str
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    # Azure OpenAI Configuration
    AZURE_OPENAI_API_KEY: Optional[str] = None
    AZURE_OPENAI_ENDPOINT: Optional[str] = None
    AZURE_OPENAI_DEPLOYMENT: Optional[str] = None
    AZURE_OPENAI_API_VERSION: str = "2024-06-01"
    # Azure Speech Configuration
    AZURE_SPEECH_KEY: Optional[str] = None
    AZURE_SPEECH_REGION: Optional[str] = None
    # Azure Whisper Configuration
    AZURE_WHISPER_URI: Optional[str] = None
    AZURE_WHISPER_KEY: Optional[str] = None
    # Gemini API Key (used client-side; kept here so backend can read if needed)
    VITE_GEMINI_API_KEY: Optional[str] = None

    # Cloudflare R2 Configuration
    R2_ACCOUNT_ID: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET_NAME: Optional[str] = None
    R2_PUBLIC_URL_BASE: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
