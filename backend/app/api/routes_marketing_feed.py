"""Read-only feed for the standalone marketing agent.

Exists because the public /api/listings response has no created_at, no source
(manual vs broker_scrape) and no stable broker id, which the agent needs to
detect genuinely new listings and avoid promoting scraped inventory.

Guarded by a shared secret in the X-Marketing-Key header. If MARKETING_FEED_KEY
is not set the whole feed answers 503, so deploying this exposes nothing until
it is configured. Applies the same visibility rules as the public site (active,
not deleted, not demo, paid owner).
"""
import hmac
import json
import os
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.api.routes_blog import _sanitize_blog_html, calculate_reading_time
from app.api.routes_listings import _get_primary_images_for_listings
from app.db.session import get_db
from app.models.blog import BlogCategory, BlogPost, BlogPostTag, BlogTag, PostStatus
from app.models.listing import Listing
from app.models.user import User
from app.services.billing_status import paid_owner_filter
from app.services.marketing_stats import summarize
from app.services.marketing_blog import (
    MAX_BLOCKS, Block, foreign_links, to_blocknote, to_html, to_plain_text,
)

router = APIRouter()

_DESCRIPTION_LIMIT = 800


def require_marketing_key(x_marketing_key: Optional[str] = Header(None)) -> None:
    expected = os.getenv("MARKETING_FEED_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Marketing feed is not configured")
    if not x_marketing_key or not hmac.compare_digest(x_marketing_key, expected):
        raise HTTPException(status_code=401, detail="Invalid marketing key")


def _site_url() -> str:
    return os.getenv("BASE_URL", "https://yachtversal.com").rstrip("/")


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _dealer_for(listing: Listing) -> Optional[dict]:
    owner = listing.owner
    if not owner:
        return None
    dealer_user = owner.parent_dealer if owner.parent_dealer_id and owner.parent_dealer else owner
    profile = dealer_user.dealer_profile
    name = " ".join(filter(None, [dealer_user.first_name, dealer_user.last_name])).strip()
    slug = profile.slug if profile else None
    return {
        "id": dealer_user.id,
        "company_name": (profile.company_name if profile and profile.company_name else dealer_user.company_name) or name,
        "slug": slug,
        "verified": bool(dealer_user.verified),
        "url": f"{_site_url()}/dealers/{slug}" if slug else None,
    }


@router.get("/listings", dependencies=[Depends(require_marketing_key)])
def marketing_listings(
    skip: int = 0,
    limit: int = Query(100, ge=1, le=200),
    since: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    """Active, publicly visible listings, newest first. `since` filters on created_at."""
    query = (
        db.query(Listing)
        .join(User, Listing.user_id == User.id)
        .options(
            selectinload(Listing.owner).selectinload(User.dealer_profile),
            selectinload(Listing.owner).selectinload(User.parent_dealer).selectinload(User.dealer_profile),
            selectinload(Listing.images),
        )
        .filter(
            Listing.status == "active",
            Listing.deleted_at.is_(None),
            User.is_demo != True,  # noqa: E712
            paid_owner_filter(),
        )
    )
    if since:
        query = query.filter(Listing.created_at >= since)

    total = query.count()
    listings = query.order_by(Listing.created_at.desc(), Listing.id.desc()).offset(skip).limit(limit).all()
    media_map = _get_primary_images_for_listings(db, [l.id for l in listings])

    def primary_image(listing: Listing) -> Optional[str]:
        media = media_map.get(listing.id) or []
        if media and media[0].get("url"):
            return media[0]["url"]
        legacy = sorted(listing.images or [], key=lambda i: (not i.is_primary, i.display_order or 0))
        return legacy[0].url if legacy else None

    return {
        "total": total,
        "listings": [
            {
                "id": l.id,
                "url": f"{_site_url()}/listings/{l.id}",
                "title": l.title,
                "price": l.price,
                "currency": l.currency or "USD",
                "year": l.year,
                "make": l.make,
                "model": l.model,
                "boat_type": l.boat_type,
                "condition": l.condition,
                "length_feet": l.length_feet,
                "city": l.city,
                "state": l.state,
                "country": l.country,
                "description": (l.description or "")[:_DESCRIPTION_LIMIT] or None,
                "source": l.source or "manual",
                "featured": bool(l.featured),
                "views": l.views or 0,
                "created_at": _iso(l.created_at),
                "updated_at": _iso(l.updated_at),
                "published_at": _iso(l.published_at),
                "image_url": primary_image(l),
                "dealer": _dealer_for(l),
            }
            for l in listings
        ],
    }


# --- market statistics -----------------------------------------------------------------------------

_STATS_ROW_CAP = 20000


@router.get("/market-stats", dependencies=[Depends(require_marketing_key)])
def marketing_market_stats(
    boat_type: Optional[str] = Query(None, max_length=60),
    make: Optional[str] = Query(None, max_length=60),
    state: Optional[str] = Query(None, max_length=60),
    condition: Optional[str] = Query(None, max_length=20),
    min_length: Optional[float] = Query(None, ge=0, le=1000),
    max_length: Optional[float] = Query(None, ge=0, le=1000),
    min_year: Optional[int] = Query(None, ge=1900, le=2100),
    max_year: Optional[int] = Query(None, ge=1900, le=2100),
    db: Session = Depends(get_db),
):
    """Summary of the publicly visible listings that match the filters: counts, price quartiles,
    typical size/age, top makes and places, and three example boats. Same visibility rules as
    the public site, and scraped (not broker-entered) listings are left out."""
    query = (
        db.query(
            Listing.id, Listing.title, Listing.price, Listing.currency, Listing.year, Listing.make,
            Listing.length_feet, Listing.city, Listing.state, Listing.boat_type,
        )
        .join(User, Listing.user_id == User.id)
        .filter(
            Listing.status == "active",
            Listing.deleted_at.is_(None),
            User.is_demo != True,  # noqa: E712
            paid_owner_filter(),
            or_(Listing.source.is_(None), Listing.source != "broker_scrape"),
        )
    )
    if boat_type:
        query = query.filter(Listing.boat_type.ilike(f"%{boat_type}%"))
    if make:
        query = query.filter(Listing.make.ilike(f"%{make}%"))
    if state:
        query = query.filter(Listing.state.ilike(f"%{state}%"))
    if condition:
        query = query.filter(Listing.condition.ilike(condition))
    if min_length is not None:
        query = query.filter(Listing.length_feet >= min_length)
    if max_length is not None:
        query = query.filter(Listing.length_feet <= max_length)
    if min_year is not None:
        query = query.filter(Listing.year >= min_year)
    if max_year is not None:
        query = query.filter(Listing.year <= max_year)

    keys = ("id", "title", "price", "currency", "year", "make", "length_feet", "city", "state", "boat_type")
    rows = [dict(zip(keys, r)) for r in query.limit(_STATS_ROW_CAP).all()]
    stats = summarize(rows, _site_url())

    images = _get_primary_images_for_listings(db, [e["id"] for e in stats["examples"]])
    for example in stats["examples"]:
        media = images.get(example["id"]) or []
        example["image_url"] = media[0].get("url") if media and media[0].get("url") else None

    return {
        "as_of": datetime.utcnow().date().isoformat(),
        "filters": {k: v for k, v in {
            "boat_type": boat_type, "make": make, "state": state, "condition": condition,
            "min_length": min_length, "max_length": max_length, "min_year": min_year, "max_year": max_year,
        }.items() if v is not None},
        "truncated": len(rows) >= _STATS_ROW_CAP,
        **stats,
    }


# --- blog drafts ---------------------------------------------------------------------------------
#
# The agent can CREATE drafts and read their status; it can never publish. Publishing happens in
# the normal admin Blog tab, where a person reviews and edits the draft first.

class BlogDraftIn(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    # Doubles as the idempotency key: re-sending the same slug returns the existing post untouched,
    # so a retry can never duplicate a draft or overwrite a reviewer's edits.
    slug: str = Field(min_length=3, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    blocks: list[Block] = Field(min_length=1, max_length=MAX_BLOCKS)
    excerpt: Optional[str] = Field(None, max_length=500)
    featured_image: Optional[str] = Field(None, max_length=500)
    featured_image_alt: Optional[str] = Field(None, max_length=255)
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=320)
    meta_keywords: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    tags: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("featured_image")
    @classmethod
    def _https_only(cls, value):
        if value and not value.startswith("https://"):
            raise ValueError("featured_image must be an https URL")
        return value


def _status_value(post: BlogPost) -> str:
    if getattr(post, "deleted_at", None):
        return "deleted"
    status = post.status
    return status.value if hasattr(status, "value") else str(status)


def _blog_author(db: Session) -> User:
    raw = os.getenv("MARKETING_BLOG_AUTHOR_ID", "").strip()
    if not raw.isdigit():
        raise HTTPException(status_code=503, detail="Blog drafts are not configured (MARKETING_BLOG_AUTHOR_ID)")
    author = db.query(User).filter(User.id == int(raw), User.deleted_at.is_(None)).first()
    if not author or author.user_type not in ("admin", "editor"):
        raise HTTPException(status_code=503, detail="MARKETING_BLOG_AUTHOR_ID must be an existing admin or editor account")
    return author


def _draft_response(post: BlogPost, existing: bool) -> dict:
    return {
        "success": True,
        "existing": existing,
        "post_id": post.id,
        "slug": post.slug,
        "status": _status_value(post),
    }


@router.post("/blog-drafts", dependencies=[Depends(require_marketing_key)])
def create_blog_draft(payload: BlogDraftIn, db: Session = Depends(get_db)):
    author = _blog_author(db)

    existing = db.query(BlogPost).filter(BlogPost.slug == payload.slug).first()
    if existing:
        return _draft_response(existing, existing=True)

    bad_links = foreign_links(payload.blocks, _site_url())
    if bad_links:
        raise HTTPException(status_code=422, detail=f"Links must point at {_site_url()}: {bad_links[:3]}")

    html = _sanitize_blog_html(to_html(payload.blocks))
    plain = to_plain_text(payload.blocks)

    category_id = None
    if payload.category:
        category = db.query(BlogCategory).filter(BlogCategory.slug == payload.category).first()
        category_id = category.id if category else None

    post = BlogPost(
        title=payload.title,
        slug=payload.slug,
        excerpt=payload.excerpt or "",
        content=plain,
        content_blocks=json.dumps(to_blocknote(payload.blocks)),
        content_html=html,
        featured_image=payload.featured_image,
        featured_image_alt=payload.featured_image_alt,
        meta_title=payload.meta_title or payload.title,
        meta_description=payload.meta_description or payload.excerpt or "",
        meta_keywords=payload.meta_keywords,
        status=PostStatus.DRAFT,  # always; there is no way to request anything else
        author_id=author.id,
        category_id=category_id,
        reading_time_minutes=calculate_reading_time(plain),
        allow_comments=True,
        featured=False,
    )
    db.add(post)
    db.flush()

    seen_tags = set()
    for raw_tag in payload.tags:
        tag_slug = re.sub(r"[^a-z0-9]+", "-", raw_tag.lower()).strip("-")[:60]
        if not tag_slug or tag_slug in seen_tags:
            continue
        seen_tags.add(tag_slug)
        tag = db.query(BlogTag).filter(BlogTag.slug == tag_slug).first()
        if not tag:
            tag = BlogTag(name=tag_slug.replace("-", " ").title()[:50], slug=tag_slug)
            db.add(tag)
            db.flush()
        db.add(BlogPostTag(post_id=post.id, tag_id=tag.id))

    db.commit()
    db.refresh(post)
    return _draft_response(post, existing=False)


@router.get("/blog-drafts/status", dependencies=[Depends(require_marketing_key)])
def blog_draft_status(slugs: str = Query(..., max_length=4000), db: Session = Depends(get_db)):
    """Current status of posts by slug, so the agent can show when a reviewer publishes one."""
    wanted = list(dict.fromkeys(s for s in (part.strip() for part in slugs.split(",")) if s))[:50]
    posts = db.query(BlogPost).filter(BlogPost.slug.in_(wanted)).all() if wanted else []
    return {
        "posts": [
            {
                "slug": p.slug,
                "id": p.id,
                "status": _status_value(p),
                "published_at": _iso(p.published_at),
                "url": f"{_site_url()}/blog/{p.slug}",
            }
            for p in posts
        ]
    }


@router.get("/brokers", dependencies=[Depends(require_marketing_key)])
def marketing_brokers(
    skip: int = 0,
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Approved (verified), active broker accounts. Used to reconcile missed approval webhooks."""
    query = (
        db.query(User)
        .options(selectinload(User.dealer_profile))
        .filter(
            User.user_type == "dealer",
            User.verified == True,  # noqa: E712
            User.active == True,  # noqa: E712
            User.deleted_at.is_(None),
            User.is_demo != True,  # noqa: E712
        )
    )
    total = query.count()
    brokers = query.order_by(User.created_at.desc(), User.id.desc()).offset(skip).limit(limit).all()

    counts = {}
    if brokers:
        counts = dict(
            db.query(Listing.user_id, func.count(Listing.id))
            .filter(
                Listing.user_id.in_([b.id for b in brokers]),
                Listing.status == "active",
                Listing.deleted_at.is_(None),
            )
            .group_by(Listing.user_id)
            .all()
        )

    results = []
    for b in brokers:
        profile = b.dealer_profile
        slug = profile.slug if profile else None
        results.append(
            {
                "id": b.id,
                "company_name": (profile.company_name if profile and profile.company_name else b.company_name),
                "name": " ".join(filter(None, [b.first_name, b.last_name])).strip() or None,
                "slug": slug,
                "url": f"{_site_url()}/dealers/{slug}" if slug else None,
                "city": profile.city if profile else None,
                "state": profile.state if profile else None,
                "country": profile.country if profile else None,
                "logo_url": profile.logo_url if profile else None,
                "active_listings": counts.get(b.id, 0),
                "created_at": _iso(b.created_at),
            }
        )
    return {"total": total, "brokers": results}
