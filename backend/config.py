"""
Application configuration - reads from .env file
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Vision API Provider: "anthropic", "openai", "gemini", "ollama"
    VISION_PROVIDER: str = "anthropic"
    
    # API Keys
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GOOGLE_BOOKS_API_KEY: str = ""
    
    # Other settings
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    DATABASE_URL: str = "sqlite+aiosqlite:///./library_scanner.db"
    ALLOWED_ORIGINS_STR: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """Parse ALLOWED_ORIGINS_STR into a list"""
        return [url.strip() for url in self.ALLOWED_ORIGINS_STR.split(",")]
    MAX_IMAGE_SIZE_MB: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
