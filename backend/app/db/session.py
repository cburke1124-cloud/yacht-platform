from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    # Render free-tier Postgres supports up to 20 simultaneous connections.
    # Keep pool small so long-running background scraper threads can't starve the API.
    pool_size=8,
    max_overflow=12,      # total max = 20
    pool_timeout=30,      # wait up to 30 s before raising TimeoutError
    pool_recycle=1800,    # discard connections idle > 30 min (prevents stale-conn errors)
    pool_pre_ping=True,   # test each connection before checkout (catches dropped conns)
    poolclass=QueuePool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()