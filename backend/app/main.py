from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from sqlalchemy.orm import Session
import os
import logging

from app.core.logging import setup_logging
from app.db.base import Base
from app.db.session import engine, get_db

from app.api.routes_auth import router as auth_router
from app.api.routes_users import router as users_router
from app.api.routes_listings import router as listings_router
from app.api.routes_featured import router as featured_router
from app.api.routes_search import router as search_router
from app.api.routes_ai_search import router as ai_search_router
from app.api.routes_permissions import router as permissions_router
from app.api.routes_team import router as team_router
from app.api.routes_sales import router as sales_router
from app.api.routes_messaging import router as messaging_router
from app.api.routes_bulk_and_currency import router as bulk_currency_router
from app.api.routes_admin import router as admin_router
from app.api.routes_blog import router as blog_router
from app.api.routes_dealers import router as dealers_router 
from app.api.routes_bulk_import_export import router as bulk_import_export_router

from app.api.routes_public_api import router as public_api_router
from app.api.routes_payments import router as payments_router
from app.api.routes_crm import router as crm_router
from app.services.seo_service import seo_router
from app.api.routes_videos import router as videos_router
from app.api.routes_pdf import router as pdf_router
from app.api.routes_video_embeds import router as video_embeds_router
from app.api.routes_media import router as media_router
from app.api.routes_profiles import router as profiles_router
from app.api.routes_scraper import router as scraper_router



from app.api.routes_wordpress_sites import router as wp_sites_router




from app.api.routes_auth_extended import router as auth_extended_router
from app.api.routes_api_keys import router as api_keys_router
from app.api.routes_comparison import router as comparison_router
from app.api.routes_email_inbound import router as email_inbound_router
from app.api.routes_catalog import router as catalog_router
from app.api.routes_sms_inbound import router as sms_inbound_router
from app.api.routes_inquiries import router as inquiries_router
from app.api.routes_contact import router as contact_router

setup_logging()

app = FastAPI(title="YachtVersal API")

# Wire the global rate-limiter into the app so slowapi can read it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def _resolve_cors_origins() -> list[str]:
    defaults = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://yacht-platform.vercel.app",
        "https://yachtversal.com",
        "https://www.yachtversal.com",
    ]

    configured = []
    for key in ("CORS_ORIGINS", "FRONTEND_URL", "FRONTEND_BASE_URL"):
        raw = os.getenv(key, "").strip()
        if raw:
            configured.extend([item.strip() for item in raw.split(",") if item.strip()])

    merged: list[str] = []
    for origin in defaults + configured:
        if origin not in merged:
            merged.append(origin)
    return merged

from app.api.error_handlers import register_exception_handlers
from app.middleware.request_logging import RequestLoggingMiddleware

from app.middleware.anti_scraping import (
    AntiScrapingMiddleware,
    honeypot_router,
    rate_limit
)

from app.scheduler import setup_scheduler

@app.on_event("startup")
async def startup_event():
    # Run alembic migrations via Python API (avoids PATH issues on Render)
    import os
    try:
        from alembic.config import Config
        from alembic import command as alembic_command
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        alembic_ini = os.path.join(backend_dir, "alembic.ini")
        print(f"[STARTUP] Running alembic upgrade head (ini={alembic_ini})", flush=True)
        cfg = Config(alembic_ini)
        database_url = os.getenv("DATABASE_URL", "")
        if database_url:
            cfg.set_main_option("sqlalchemy.url", database_url)
        alembic_command.upgrade(cfg, "head")
        print("[STARTUP] Alembic migrations completed successfully", flush=True)
    except Exception as e:
        print(f"[STARTUP] Alembic migration failed: {e}", flush=True)

    # Auto-seed / update default documentation
    try:
        from app.db.session import SessionLocal
        from app.models.documentation import Documentation
        from app.services.default_documentation import DEFAULT_DOCS
        seed_db = SessionLocal()
        seeded = []
        updated = []
        for doc_data in DEFAULT_DOCS:
            existing = seed_db.query(Documentation).filter(Documentation.slug == doc_data["slug"]).first()
            if not existing:
                doc = Documentation(
                    slug=doc_data["slug"],
                    title=doc_data["title"],
                    description=doc_data["description"],
                    category=doc_data["category"],
                    audience=doc_data["audience"],
                    order=doc_data["order"],
                    content=doc_data["content"],
                    published=True,
                )
                seed_db.add(doc)
                seeded.append(doc_data["slug"])
            else:
                # Update content if it has changed
                changed = False
                for field in ("title", "description", "category", "audience", "order", "content"):
                    if getattr(existing, field) != doc_data.get(field):
                        setattr(existing, field, doc_data[field])
                        changed = True
                if changed:
                    updated.append(doc_data["slug"])
        if seeded or updated:
            seed_db.commit()
            if seeded:
                print(f"[STARTUP] Seeded documentation: {seeded}", flush=True)
            if updated:
                print(f"[STARTUP] Updated documentation: {updated}", flush=True)
        seed_db.close()
    except Exception as e:
        print(f"[STARTUP] Documentation seed skipped: {e}", flush=True)

    setup_scheduler()


# Register exception handlers first
register_exception_handlers(app)

# Add custom HTTP exception handler for anti-scraping middleware
@app.exception_handler(FastAPIHTTPException)
async def fastapi_http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(StarletteHTTPException)
async def starlette_http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Add middleware in correct order (last added = first executed)
app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(),
    allow_origin_regex=r"https://(yacht-platform[^/]*\.vercel\.app|yachtversal\.com|[^/]+\.yachtversal\.com)",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

if os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true":
    logging.getLogger(__name__).warning("AUTO_CREATE_TABLES enabled; running Base.metadata.create_all()")
    Base.metadata.create_all(bind=engine)

# Register all routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router, prefix="/api", tags=["users"])
app.include_router(listings_router, prefix="/api/listings", tags=["listings"])
app.include_router(featured_router, prefix="/api", tags=["featured"])
app.include_router(search_router, prefix="/api/search", tags=["search"])
app.include_router(ai_search_router, prefix="/api", tags=["ai-search"])
app.include_router(dealers_router, prefix="/api/dealers", tags=["dealers"])
app.include_router(permissions_router, prefix="/api/permissions", tags=["permissions"])
app.include_router(team_router, prefix="/api/team", tags=["team"])
app.include_router(sales_router, prefix="/api/sales-rep", tags=["sales"])
app.include_router(messaging_router, prefix="/api", tags=["messaging", "notifications"])
app.include_router(bulk_currency_router, prefix="/api", tags=["bulk", "currency"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(blog_router, prefix="/api", tags=["blog", "media"])
app.include_router(auth_extended_router, prefix="/api/auth", tags=["auth"])
app.include_router(api_keys_router, prefix="/api", tags=["api-keys", "invitations"])
app.include_router(public_api_router, tags=["public-api"])
app.include_router(honeypot_router)
app.include_router(payments_router, prefix="/api", tags=["payments"])
app.include_router(crm_router, prefix="/api", tags=["crm"])
app.include_router(seo_router, tags=["seo"])
app.include_router(comparison_router, prefix="/api", tags=["comparison"])
app.include_router(videos_router, prefix="/api", tags=["videos"])
app.include_router(pdf_router, prefix="/api", tags=["pdf"])
app.include_router(video_embeds_router, prefix="/api", tags=["video-embeds"])
app.include_router(media_router, prefix="/api/media", tags=["media"])
app.include_router(bulk_import_export_router, prefix="/api", tags=["bulk-import"])
app.include_router(profiles_router, prefix="/api", tags=["profiles"])
app.include_router(scraper_router, prefix="/api", tags=["scraper"])
app.include_router(wp_sites_router, prefix="/api", tags=["wordpress-sites"])
app.include_router(email_inbound_router, tags=["inbound"])
app.include_router(sms_inbound_router, tags=["inbound"])
app.include_router(inquiries_router, prefix="/api", tags=["inquiries"])
app.include_router(contact_router, prefix="/api", tags=["contact"])
app.include_router(catalog_router, prefix="/api/catalog", tags=["catalog"])


# Add anti-scraping middleware LAST so it runs FIRST (middleware runs in reverse order)
app.add_middleware(AntiScrapingMiddleware)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "yachtversal-backend",
    }


@app.get("/api/pricing-tiers")
def get_public_pricing_tiers(db: Session = Depends(get_db)):
    """Public endpoint — returns subscription tier pricing for the sell/pricing page."""
    from app.models.misc import SiteSettings
    from app.api.routes_admin import _DEFAULT_BROKER_TIERS, _DEFAULT_PRIVATE_TIERS
    settings = db.query(SiteSettings).first()
    config = (settings.subscription_config or {}) if settings else {}
    # Merge: start with current defaults (which always have the latest tiers),
    # then overlay any admin-customised tiers on top.
    broker = {**_DEFAULT_BROKER_TIERS, **config.get("broker_tiers", {})}
    private = {**_DEFAULT_PRIVATE_TIERS, **config.get("private_tiers", {})}
    return {
        "broker": broker,
        "private": private,
    }