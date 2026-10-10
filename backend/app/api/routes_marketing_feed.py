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
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api.routes_listings import _get_primary_images_for_listings
from app.db.session import get_db
from app.models.listing import Listing
from app.models.user import User
from app.services.billing_status import paid_owner_filter

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
