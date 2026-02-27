import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:admin123@localhost:5432/yacht_db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "admin123")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    STRIPE_SECRET_KEY: str | None = os.getenv("STRIPE_SECRET_KEY")

settings = Settings()