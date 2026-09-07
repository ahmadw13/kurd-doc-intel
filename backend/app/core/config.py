from pydantic_settings import BaseSettings
from typing import List, Any, Union
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "KurdDocIntel Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: Union[List[str], str] = ["*"]
    
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # Storage
    UPLOAD_DIR: str = "uploads"
    CHROMA_PERSIST_DIR: str = "chroma_db"
    
    class Config:
        env_file = (".env", "../.env")
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
