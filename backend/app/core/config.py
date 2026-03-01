import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:admin123@localhost:5432/yacht_db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "admin123")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    STRIPE_SECRET_KEY: str | None = os.getenv("STRIPE_SECRET_KEY")

settings = Settings()

# ── Secret-key hardening ──────────────────────────────────────────────────────
# Fail fast so a weak key never reaches buyers in production.
_KNOWN_WEAK_KEYS = {"admin123", "secret", "changeme", "your-secret-key", ""}
_env = os.getenv("ENVIRONMENT", "development").lower()

if _env in ("production", "staging"):
    if settings.SECRET_KEY in _KNOWN_WEAK_KEYS or len(settings.SECRET_KEY) < 32:
        raise RuntimeError(
            "FATAL: SECRET_KEY is weak or missing. "
            "Set a cryptographically random SECRET_KEY env var "
            "(minimum 32 characters) before deploying to production."
        )