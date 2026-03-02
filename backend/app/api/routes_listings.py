from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import Optional, Any
from functools import lru_cache
from sqlalchemy import inspect, text, func
import logging

from app.db.session import get_db
from app.db.session import engine
from app.api.deps import get_current_user
from app.models.listing import Listing, ListingImage
from app.models.media import MediaFile, ListingMediaAttachment
from app.models.misc import Inquiry, Notification
from app.models.user import User
from app.models.dealer import DealerProfile
from app.exceptions import ResourceNotFoundException, AuthorizationException
from app.services.email_service import email_service
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _listing_columns() -> set[str]:
    inspector = inspect(engine)
    return {col["name"] for col in inspector.get_columns("listings")}


def _has_listing_column(name: str) -> bool:
    try:
        return name in _listing_columns()
    except Exception:
        return False


def _normalize_feature_bullets(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()][:8]
    if isinstance(raw, str):
        return [
            line.replace("•", "").lstrip("-* ").strip()
            for line in raw.splitlines()
            if line.strip()
        ][:8]
    return []


def _derive_feature_bullets(payload: dict[str, Any]) -> list[str]:
    existing = _normalize_feature_bullets(payload.get("feature_bullets"))
    if existing:
        return existing

    from_features = _normalize_feature_bullets(payload.get("features"))
    if from_features:
        return from_features

    derived = [
        f"{payload.get('length_feet') or '—'} ft {payload.get('boat_type') or 'yacht'} layout",
        f"{payload.get('engine_count') or 'Twin'} {payload.get('engine_make') or 'diesel'} power setup",
        f"{payload.get('cabins') or 'Spacious'} cabin configuration",
        f"{payload.get('fuel_capacity_gallons') or 'Large'} gallon fuel capacity",
        "Factory-new condition" if payload.get("condition") == "new" else "Well-kept pre-owned condition",
    ]
    return [item.strip() for item in derived if item and item.strip()][:8]


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class ListingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    features: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    bin: str
    # Dimensions
    length_feet: Optional[float] = None
    beam_feet: Optional[float] = None
    draft_feet: Optional[float] = None
    # Type & hull
    boat_type: Optional[str] = None
    hull_material: Optional[str] = None
    hull_type: Optional[str] = None
    # Engine
    engine_make: Optional[str] = None
    engine_model: Optional[str] = None
    engine_type: Optional[str] = None
    engine_count: Optional[int] = None
    engine_hours: Optional[int] = None
    additional_engines: Optional[list[dict[str, Any]]] = None
    generators: Optional[list[dict[str, Any]]] = None
    # Performance
    fuel_type: Optional[str] = None
    max_speed_knots: Optional[float] = None
    cruising_speed_knots: Optional[float] = None
    # Capacity
    fuel_capacity_gallons: Optional[float] = None
    water_capacity_gallons: Optional[float] = None
    cabins: Optional[int] = None
    berths: Optional[int] = None
    heads: Optional[int] = None
    # Location
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "USA"
    zip_code: Optional[str] = None
    continent: Optional[str] = None
    # Condition / status
    condition: str = "used"
    status: str = "draft"
    # Videos
    youtube_video_url: Optional[str] = None
    vimeo_video_url: Optional[str] = None
    video_tour_url: Optional[str] = None
    feature_bullets: Optional[list[str]] = None
    additional_specs: Optional[dict[str, Any]] = None
    # Co-brokering: set False to exclude this listing from the public co-brokering API
    allow_cobrokering: Optional[bool] = True


class ListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    features: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    bin: Optional[str] = None
    length_feet: Optional[float] = None
    beam_feet: Optional[float] = None
    draft_feet: Optional[float] = None
    boat_type: Optional[str] = None
    hull_material: Optional[str] = None
    hull_type: Optional[str] = None
    engine_make: Optional[str] = None
    engine_model: Optional[str] = None
    engine_type: Optional[str] = None
    engine_count: Optional[int] = None
    engine_hours: Optional[int] = None
    additional_engines: Optional[list[dict[str, Any]]] = None
    generators: Optional[list[dict[str, Any]]] = None
    fuel_type: Optional[str] = None
    max_speed_knots: Optional[float] = None
    cruising_speed_knots: Optional[float] = None
    fuel_capacity_gallons: Optional[float] = None
    water_capacity_gallons: Optional[float] = None
    cabins: Optional[int] = None
    berths: Optional[int] = None
    heads: Optional[int] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    zip_code: Optional[str] = None
    continent: Optional[str] = None
    condition: Optional[str] = None
    status: Optional[str] = None
    youtube_video_url: Optional[str] = None
    vimeo_video_url: Optional[str] = None
    video_tour_url: Optional[str] = None
    feature_bullets: Optional[list[str]] = None
    additional_specs: Optional[dict[str, Any]] = None
    # Co-brokering opt-out at listing level
    allow_cobrokering: Optional[bool] = None


class ListingQuickEdit(BaseModel):
    title: Optional[str] = None
    price: Optional[float] = None
    status: Optional[str] = None


class ListingMediaAttachRequest(BaseModel):
    media_ids: list[int]


class FinanceCalculation(BaseModel):
    down_payment_percent: float = 20.0
    interest_rate: float = 5.5
    term_years: int = 20
    insurance_annual: Optional[float] = None
    maintenance_annual_percent: float = 10.0


class PublicInquiry(BaseModel):
    sender_name: str
    sender_email: str
    sender_phone: Optional[str] = None
    message: str


# ─── Helper: full listing serializer ──────────────────────────────────────────

def _serialize_listing(listing: Listing) -> dict:
    """Return every field from the Listing model."""
    return {
        "id": listing.id,
        "user_id": listing.user_id,
        "created_by_user_id": listing.created_by_user_id,
        "assigned_salesman_id": listing.assigned_salesman_id,
        "title": listing.title,
        "price": listing.price,
        "currency": listing.currency or "USD",
        "year": listing.year,
        "make": listing.make,
        "model": listing.model,
        "bin": listing.bin,
        "boat_type": listing.boat_type,
        "condition": listing.condition,
        "status": listing.status,
        # Dimensions
        "length_feet": listing.length_feet,
        "beam_feet": listing.beam_feet,
        "draft_feet": listing.draft_feet,
        # Hull
        "hull_material": listing.hull_material,
        "hull_type": listing.hull_type,
        # Engine
        "engine_make": listing.engine_make,
        "engine_model": listing.engine_model,
        "engine_type": listing.engine_type,
        "engine_count": listing.engine_count,
        "engine_hours": listing.engine_hours,
        "additional_engines": (listing.additional_engines or []) if _has_listing_column("additional_engines") else [],
        "generators": (listing.generators or []) if _has_listing_column("generators") else [],
        # Performance
        "fuel_type": listing.fuel_type,
        "max_speed_knots": listing.max_speed_knots,
        "cruising_speed_knots": listing.cruising_speed_knots,
        # Capacity
        "fuel_capacity_gallons": listing.fuel_capacity_gallons,
        "water_capacity_gallons": listing.water_capacity_gallons,
        "cabins": listing.cabins,
        "berths": listing.berths,
        "heads": listing.heads,
        # Location
        "city": listing.city,
        "state": listing.state,
        "country": listing.country,
        "zip_code": listing.zip_code,
        "continent": listing.continent,
        "latitude": listing.latitude,
        "longitude": listing.longitude,
        # Description
        "description": listing.description,
        "features": listing.features,
        "feature_bullets": (listing.feature_bullets or []) if _has_listing_column("feature_bullets") else [],
        "additional_specs": (listing.additional_specs or {}) if _has_listing_column("additional_specs") else {},
        # Video
        "youtube_video_url": listing.youtube_video_url,
        "vimeo_video_url": listing.vimeo_video_url,
        "video_tour_url": listing.video_tour_url,
        "has_video": listing.has_video or False,
        # Meta
        "views": listing.views or 0,
        "featured": listing.featured or False,
        "previous_owners": listing.previous_owners,
        "source": listing.source,
        "published_at": listing.published_at.isoformat() if listing.published_at else None,
        "created_at": listing.created_at.isoformat() if listing.created_at else None,
        "updated_at": listing.updated_at.isoformat() if listing.updated_at else None,
        # Images (legacy fallback; prefer /media endpoint)
        "images": [
            {
                "id": img.id,
                "url": img.url,
                "thumbnail_url": img.thumbnail_url,
                "is_primary": img.is_primary,
                "display_order": img.display_order or 0,
                "caption": img.caption,
            }
            for img in sorted(
                listing.images,
                key=lambda i: (not i.is_primary, i.display_order or 0),
            )
        ],
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/makes")
def get_distinct_makes(db: Session = Depends(get_db)):
    """Return sorted list of distinct, non-empty makes from active listings."""
    try:
        rows = (
            db.query(Listing.make)
            .filter(Listing.status == "active", Listing.make != None, Listing.make != "")
            .distinct()
            .order_by(Listing.make)
            .all()
        )
        return sorted({r[0].strip() for r in rows if r[0] and r[0].strip()})
    except Exception:
        return []


@router.get("/price-range")
def get_price_range(db: Session = Depends(get_db)):
    """Return the min and max price of active listings with a price set."""
    try:
        result = (
            db.query(func.min(Listing.price), func.max(Listing.price))
            .filter(Listing.status == "active", Listing.price.isnot(None), Listing.price > 0)
            .first()
        )
        lo = int(result[0]) if result and result[0] else 0
        hi = int(result[1]) if result and result[1] else 10_000_000
        return {"min": lo, "max": hi}
    except Exception:
        return {"min": 0, "max": 10_000_000}


@router.get("/models")
def get_distinct_models(make: Optional[str] = None, db: Session = Depends(get_db)):
    """Return sorted list of distinct models for a given make from active listings."""
    try:
        q = db.query(Listing.model).filter(
            Listing.status == "active",
            Listing.model != None,
            Listing.model != "",
        )
        if make:
            q = q.filter(Listing.make.ilike(f"%{make}%"))
        rows = q.distinct().order_by(Listing.model).all()
        return sorted({r[0].strip() for r in rows if r[0] and r[0].strip()})
    except Exception:
        return []


@router.get("")
@router.get("/")
def get_listings(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: str = "active",
    make: Optional[str] = None,
    model: Optional[str] = None,
    boat_type: Optional[str] = None,
    condition: Optional[str] = None,
    propulsion: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_length: Optional[float] = None,
    max_length: Optional[float] = None,
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    fuel: Optional[str] = None,
    hull_material: Optional[str] = None,
    engine: Optional[str] = None,
):
    SAIL_TYPES = {"Sailing Yacht", "Catamaran", "Sloop", "Ketch", "Schooner", "Motorsailer"}
    try:
        q = (
            db.query(Listing)
            .options(
                joinedload(Listing.owner).joinedload(User.dealer_profile),
                joinedload(Listing.owner).joinedload(User.parent_dealer).joinedload(User.dealer_profile),
            )
            .filter(Listing.status == status)
        )
        if make:
            q = q.filter(Listing.make.ilike(f"%{make}%"))
        if model:
            q = q.filter(Listing.model.ilike(f"%{model}%"))
        if boat_type:
            q = q.filter(Listing.boat_type == boat_type)
        elif propulsion == "sail":
            q = q.filter(Listing.boat_type.in_(SAIL_TYPES))
        elif propulsion == "power":
            q = q.filter(~Listing.boat_type.in_(SAIL_TYPES))
        if condition:
            q = q.filter(Listing.condition.ilike(condition))
        if min_price is not None:
            q = q.filter(Listing.price >= min_price)
        if max_price is not None:
            q = q.filter(Listing.price <= max_price)
        if min_length is not None:
            q = q.filter(Listing.length_feet >= min_length)
        if max_length is not None:
            q = q.filter(Listing.length_feet <= max_length)
        if min_year is not None:
            q = q.filter(Listing.year >= min_year)
        if max_year is not None:
            q = q.filter(Listing.year <= max_year)
        if city:
            q = q.filter(Listing.city.ilike(f"%{city}%"))
        if state:
            q = q.filter(Listing.state.ilike(f"%{state}%"))
        if fuel:
            q = q.filter(Listing.fuel_type.ilike(f"%{fuel}%"))
        if hull_material:
            q = q.filter(Listing.hull_material.ilike(f"%{hull_material}%"))
        if engine:
            q = q.filter(
                Listing.engine_make.ilike(f"%{engine}%") |
                Listing.engine_type.ilike(f"%{engine}%") |
                Listing.engine_model.ilike(f"%{engine}%")
            )
        listings = (
            q.order_by(
                Listing.featured.desc(),
                Listing.featured_priority.desc(),
                Listing.featured_until.desc(),
                Listing.created_at.desc(),
            )
            .offset(skip)
            .limit(limit)
            .all()
        )
    except Exception:
        logger.exception("Primary listings ORM query failed; trying raw SQL fallbacks")
        db.rollback()

        params = {"limit": limit, "skip": skip, "status": status}

        # Fallback A: rich query with status filter and featured ordering.
        try:
            rows = db.execute(
                text(
                    """
                    SELECT id, title, price, currency, year, make, model, length_feet, city, state, status,
                           COALESCE(views, 0) AS views,
                           COALESCE(featured, false) AS featured
                    FROM listings
                    WHERE status = :status
                    ORDER BY featured DESC, created_at DESC
                    LIMIT :limit OFFSET :skip
                    """
                ),
                params,
            ).mappings().all()

            return [
                {
                    "id": row.get("id"),
                    "title": row.get("title"),
                    "price": row.get("price"),
                    "currency": row.get("currency") or "USD",
                    "year": row.get("year"),
                    "make": row.get("make"),
                    "model": row.get("model"),
                    "length_feet": row.get("length_feet"),
                    "city": row.get("city"),
                    "state": row.get("state"),
                    "status": row.get("status") or status,
                    "views": row.get("views") or 0,
                    "featured": bool(row.get("featured")),
                    "images": [],
                    "dealer": None,
                }
                for row in rows
            ]
        except Exception:
            logger.exception("Fallback A failed; trying minimal listings query")
            db.rollback()

        # Fallback B: minimal query without status/featured assumptions.
        try:
            rows = db.execute(
                text(
                    """
                    SELECT id, title, price, currency, year, make, model, length_feet, city, state
                    FROM listings
                    ORDER BY id DESC
                    LIMIT :limit OFFSET :skip
                    """
                ),
                {"limit": limit, "skip": skip},
            ).mappings().all()

            return [
                {
                    "id": row.get("id"),
                    "title": row.get("title"),
                    "price": row.get("price"),
                    "currency": row.get("currency") or "USD",
                    "year": row.get("year"),
                    "make": row.get("make"),
                    "model": row.get("model"),
                    "length_feet": row.get("length_feet"),
                    "city": row.get("city"),
                    "state": row.get("state"),
                    "status": status,
                    "views": 0,
                    "featured": False,
                    "images": [],
                    "dealer": None,
                }
                for row in rows
            ]
        except Exception:
            logger.exception("Fallback B failed; returning empty listings array")
            return []

    def dealer_payload(listing: Listing) -> dict[str, Any] | None:
        try:
            owner = listing.owner
            if not owner:
                return None

            dealer_user = owner.parent_dealer if owner.parent_dealer_id and owner.parent_dealer else owner
            profile = dealer_user.dealer_profile if dealer_user else None

            if not dealer_user:
                return None

            name = " ".join(filter(None, [dealer_user.first_name, dealer_user.last_name])).strip() or dealer_user.email
            company_name = (profile.company_name if profile and profile.company_name else dealer_user.company_name) or name

            return {
                "name": name,
                "company_name": company_name,
                "slug": profile.slug if profile else None,
                "logo_url": profile.logo_url if profile else None,
            }
        except Exception:
            return None

    return [
        {
            "id": l.id,
            "title": l.title,
            "price": l.price,
            "currency": l.currency or "USD",
            "year": l.year,
            "make": l.make,
            "model": l.model,
            "length_feet": l.length_feet,
            "city": l.city,
            "state": l.state,
            "status": l.status,
            "views": l.views or 0,
            "featured": l.featured or False,
            "images": [{"url": img.url} for img in l.images[:1]],
            "dealer": dealer_payload(l),
        }
        for l in listings
    ]


@router.get("/my-listings")
def get_my_listings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[str] = None,
):
    query = db.query(Listing).filter(Listing.user_id == current_user.id)
    if status:
        query = query.filter(Listing.status == status)
    listings = query.order_by(Listing.created_at.desc()).all()
    return [
        {
            "id": l.id,
            "title": l.title,
            "price": l.price,
            "currency": l.currency or "USD",
            "year": l.year,
            "make": l.make,
            "model": l.model,
            "length_feet": l.length_feet,
            "city": l.city,
            "state": l.state,
            "status": l.status,
            "views": l.views or 0,
            "inquiries": l.inquiries or 0,
            "featured": l.featured or False,
            "featured_until": l.featured_until.isoformat() if l.featured_until else None,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "images": [{"url": img.url, "is_primary": img.is_primary} for img in l.images],
        }
        for l in listings
    ]


@router.post("/")
def create_listing(
    listing_data: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_type = (current_user.user_type or "").lower()
    subscription_tier = (current_user.subscription_tier or "").lower()
    permissions = current_user.permissions or {}

    paid_dealer_tiers = {"basic", "plus", "pro", "premium"}
    paid_private_tiers = {"private_basic", "private_plus", "private_pro"}

    is_admin = user_type == "admin"
    has_create_permission = bool(permissions.get("can_create_listings"))
    is_paid_dealer = user_type == "dealer" and subscription_tier in paid_dealer_tiers
    is_paid_private = user_type == "private" and subscription_tier in paid_private_tiers

    if not (is_admin or has_create_permission or is_paid_dealer or is_paid_private):
        raise AuthorizationException("Listing creation requires a paid dealer or private seller account")

    existing = db.query(Listing).filter(Listing.bin == listing_data.bin).first()
    if existing:
        raise HTTPException(status_code=400, detail="A listing with this BIN already exists")

    listing_payload = listing_data.dict()
    if _has_listing_column("feature_bullets"):
        listing_payload["feature_bullets"] = _derive_feature_bullets(listing_payload)
    for field_name in ("additional_engines", "generators", "feature_bullets", "additional_specs"):
        if field_name in listing_payload and not _has_listing_column(field_name):
            listing_payload.pop(field_name, None)

    new_listing = Listing(
        user_id=current_user.id,
        created_by_user_id=current_user.id,
        **listing_payload,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(new_listing)
    db.commit()
    db.refresh(new_listing)
    return {
        "id": new_listing.id,
        "title": new_listing.title,
        "bin": new_listing.bin,
        "status": new_listing.status,
        "message": "Listing created successfully",
    }


@router.put("/{listing_id}")
def update_listing(
    listing_id: int,
    listing_data: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    if listing.user_id != current_user.id and current_user.user_type != "admin":
        raise AuthorizationException("Not authorized to update this listing")

    if listing_data.bin and listing_data.bin != listing.bin:
        existing = db.query(Listing).filter(
            Listing.bin == listing_data.bin, Listing.id != listing_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="A listing with this BIN already exists")

    update_payload = listing_data.dict(exclude_unset=True)
    if _has_listing_column("feature_bullets"):
        merged = {**{k: getattr(listing, k, None) for k in [
            "feature_bullets", "features", "length_feet", "boat_type", "engine_count", "engine_make", "cabins", "fuel_capacity_gallons", "condition"
        ]}, **update_payload}
        update_payload["feature_bullets"] = _derive_feature_bullets(merged)
    for field_name in ("additional_engines", "generators", "feature_bullets", "additional_specs"):
        if field_name in update_payload and not _has_listing_column(field_name):
            update_payload.pop(field_name, None)

    for field, value in update_payload.items():
        setattr(listing, field, value)

    listing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(listing)
    return {
        "id": listing.id,
        "title": listing.title,
        "bin": listing.bin,
        "status": listing.status,
        "message": "Listing updated successfully",
    }


@router.patch("/{listing_id}/quick-edit")
def quick_edit_listing(
    listing_id: int,
    listing_data: ListingQuickEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    if listing.user_id != current_user.id and current_user.user_type != "admin":
        raise AuthorizationException("Not authorized to update this listing")

    update_payload = listing_data.dict(exclude_unset=True)
    if not update_payload:
        raise HTTPException(status_code=400, detail="No quick-edit fields were provided")

    if "status" in update_payload:
        valid_statuses = {"active", "draft", "pending", "sold", "archived"}
        if update_payload["status"] not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status value")

    for field, value in update_payload.items():
        setattr(listing, field, value)

    if update_payload.get("status") == "active" and not listing.published_at:
        listing.published_at = datetime.utcnow()

    listing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(listing)
    return {
        "id": listing.id,
        "title": listing.title,
        "price": listing.price,
        "status": listing.status,
        "message": "Listing quick edit saved",
    }


@router.patch("/{listing_id}/status")
def patch_listing_status(
    listing_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    status = data.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="Status is required")
    return quick_edit_listing(
        listing_id=listing_id,
        listing_data=ListingQuickEdit(status=status),
        current_user=current_user,
        db=db,
    )


@router.delete("/{listing_id}")
def delete_listing(
    listing_id: int,
    permanent: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    if listing.user_id != current_user.id and current_user.user_type != "admin":
        raise AuthorizationException("Not authorized")
    if permanent:
        db.delete(listing)
        db.commit()
        return {"message": "Listing permanently deleted"}
    listing.status = "archived"
    listing.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Listing archived"}


# ─── GET single listing (FULL detail) ─────────────────────────────────────────

@router.get("/{listing_id}")
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    # Increment view counter
    listing.views = (listing.views or 0) + 1
    db.commit()
    return _serialize_listing(listing)


# ─── GET media for a listing ──────────────────────────────────────────────────

@router.get("/{listing_id}/media")
def get_listing_media(listing_id: int, db: Session = Depends(get_db)):
    """
    Returns media for a listing.  Prefers the new ListingMediaAttachment
    junction table (images uploaded via the media library).  Falls back to
    the legacy ListingImage rows if no attachments exist.
    Video embed entries stored in MediaFile (file_type='video') are included.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    items = []

    # ── New system: ListingMediaAttachment → MediaFile ────────────────────
    attachments = (
        db.query(ListingMediaAttachment, MediaFile)
        .join(MediaFile, ListingMediaAttachment.media_id == MediaFile.id)
        .filter(
            ListingMediaAttachment.listing_id == listing_id,
            MediaFile.deleted_at == None,  # noqa: E711
        )
        .order_by(
            ListingMediaAttachment.is_primary.desc(),
            ListingMediaAttachment.display_order,
        )
        .all()
    )

    if attachments:
        for attachment, mf in attachments:
            items.append(
                {
                    "id": mf.id,
                    "url": mf.url,
                    "thumbnail_url": mf.thumbnail_url,
                    "file_type": mf.file_type,  # 'image' | 'video' | 'pdf'
                    "is_primary": attachment.is_primary,
                    "display_order": attachment.display_order,
                    "caption": attachment.caption or mf.caption,
                    "width": mf.width,
                    "height": mf.height,
                    "alt_text": mf.alt_text,
                }
            )
        items = sorted(
            items,
            key=lambda item: (
                1 if item.get("file_type") == "pdf" else 0,
                0 if item.get("is_primary") else 1,
                item.get("display_order") or 0,
            ),
        )
    else:
        # ── Legacy: ListingImage rows ─────────────────────────────────────
        for img in sorted(
            listing.images,
            key=lambda i: (not i.is_primary, i.display_order or 0),
        ):
            items.append(
                {
                    "id": img.id,
                    "url": img.url,
                    "thumbnail_url": img.thumbnail_url,
                    "file_type": "image",
                    "is_primary": img.is_primary,
                    "display_order": img.display_order or 0,
                    "caption": img.caption,
                    "width": None,
                    "height": None,
                    "alt_text": None,
                }
            )

    return {"listing_id": listing_id, "media": items, "total": len(items)}


@router.post("/{listing_id}/media/attach")
def attach_listing_media(
    listing_id: int,
    payload: ListingMediaAttachRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Replace listing media attachments with the provided media IDs.
    PDFs are intentionally ordered after images/videos by default.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    if listing.user_id != current_user.id and current_user.user_type != "admin":
        raise AuthorizationException("Not authorized to update listing media")

    media_ids = [mid for mid in payload.media_ids if isinstance(mid, int)]
    if not media_ids:
        db.query(ListingMediaAttachment).filter(ListingMediaAttachment.listing_id == listing_id).delete()
        db.commit()
        return {"success": True, "attached": 0}

    media_files = (
        db.query(MediaFile)
        .filter(
            MediaFile.id.in_(media_ids),
            MediaFile.deleted_at == None,  # noqa: E711
        )
        .all()
    )
    media_by_id = {m.id: m for m in media_files}

    db.query(ListingMediaAttachment).filter(ListingMediaAttachment.listing_id == listing_id).delete()

    display_order = 0
    attached = 0
    for media_id in media_ids:
        mf = media_by_id.get(media_id)
        if not mf:
            continue
        if mf.user_id != current_user.id and current_user.user_type != "admin":
            continue

        order_for_item = display_order + (10000 if mf.file_type == "pdf" else 0)
        db.add(
            ListingMediaAttachment(
                listing_id=listing_id,
                media_id=media_id,
                display_order=order_for_item,
                is_primary=(attached == 0 and mf.file_type != "pdf"),
                caption=mf.caption,
            )
        )
        display_order += 1
        attached += 1

    db.commit()
    return {"success": True, "attached": attached}


# ─── GET contact info (expanded with dealer address / social) ─────────────────

@router.get("/{listing_id}/contact-info")
def get_listing_contact_info(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    owner = db.query(User).filter(User.id == listing.user_id).first()
    if not owner:
        return {"dealer": {}, "sales_contact": None}

    def _dealer_dict(user: User, profile: Optional[DealerProfile]) -> dict:
        """Build the dealer/brokerage response dict."""
        return {
            "id": user.id,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "company_name": (profile.company_name if profile else None) or getattr(user, "company_name", None),
            "email": (profile.email if profile else None) or user.email,
            "phone": (profile.phone if profile else None) or getattr(user, "phone", None),
            "logo_url": profile.logo_url if profile else None,
            "banner_url": profile.banner_url if profile else None,
            "slug": profile.slug if profile else None,
            "address": profile.address if profile else None,
            "city": profile.city if profile else None,
            "state": profile.state if profile else None,
            "country": profile.country if profile else None,
            "postal_code": profile.postal_code if profile else None,
            "website": profile.website if profile else None,
            "facebook_url": profile.facebook_url if profile else None,
            "instagram_url": profile.instagram_url if profile else None,
            "twitter_url": profile.twitter_url if profile else None,
            "linkedin_url": profile.linkedin_url if profile else None,
            "description": profile.description if profile else None,
        }

    # ── Sales rep listed under a parent dealer ────────────────────────────
    if owner.parent_dealer_id:
        parent = db.query(User).filter(User.id == owner.parent_dealer_id).first()
        parent_profile = (
            db.query(DealerProfile).filter(DealerProfile.user_id == parent.id).first()
            if parent
            else None
        )
        return {
            "dealer": _dealer_dict(parent, parent_profile) if parent else {},
            "sales_contact": {
                "id": owner.id,
                "name": f"{owner.first_name or ''} {owner.last_name or ''}".strip(),
                "title": getattr(owner, "role", None) or "Sales Representative",
                "email": owner.email,
                "phone": getattr(owner, "phone", None),
                "photo_url": getattr(owner, "photo_url", None),
                "bio": getattr(owner, "bio", None),
            },
        }

    # ── Direct dealer owns the listing ────────────────────────────────────
    profile = db.query(DealerProfile).filter(DealerProfile.user_id == owner.id).first()
    return {
        "dealer": _dealer_dict(owner, profile),
        "sales_contact": None,
    }


# ─── POST public (unauthenticated) inquiry ────────────────────────────────────

@router.post("/{listing_id}/inquiry")
def submit_inquiry(
    listing_id: int,
    data: PublicInquiry,
    db: Session = Depends(get_db),
):
    """
    Public inquiry endpoint — no auth required.
    Saves to the inquiries table, emails the listing owner,
    and creates an in-app notification.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    # Route to the assigned salesman if one exists, otherwise the listing owner
    notify_user_id = listing.assigned_salesman_id or listing.user_id

    inquiry = Inquiry(
        listing_id=listing_id,
        sender_name=data.sender_name,
        sender_email=data.sender_email,
        sender_phone=data.sender_phone,
        message=data.message,
        status="new",
        assigned_to_id=notify_user_id,
    )
    db.add(inquiry)
    listing.inquiries = (listing.inquiries or 0) + 1
    db.commit()
    db.refresh(inquiry)

    # Notify the assigned person (salesman or dealer)
    owner = db.query(User).filter(User.id == notify_user_id).first()
    if owner:
        try:
            email_service.send_email(
                to_email=owner.email,
                subject=f"New Inquiry: {listing.title}",
                html_content=f"""
                <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:linear-gradient(135deg,#10214F,#01BBDC);padding:30px;text-align:center;">
                    <h1 style="color:white;margin:0;">New Inquiry</h1>
                  </div>
                  <div style="padding:30px;background:#f9fafb;">
                    <h2 style="color:#10214F;">{listing.title}</h2>
                    <div style="background:white;border-left:4px solid #01BBDC;padding:20px;margin:20px 0;">
                      <p><strong>From:</strong> {data.sender_name}</p>
                      <p><strong>Email:</strong> <a href="mailto:{data.sender_email}">{data.sender_email}</a></p>
                      {"<p><strong>Phone:</strong> <a href='tel:" + data.sender_phone + "'>" + data.sender_phone + "</a></p>" if data.sender_phone else ""}
                    </div>
                    <div style="background:white;border:1px solid #e5e7eb;padding:20px;margin:20px 0;">
                      <h3 style="margin-top:0;color:#10214F;">Message</h3>
                      <p style="line-height:1.6;white-space:pre-wrap;">{data.message}</p>
                    </div>
                  </div>
                  <div style="background:#10214F;padding:20px;text-align:center;color:#9ca3af;font-size:12px;">
                    <p style="margin:0;">© 2026 YachtVersal.</p>
                  </div>
                </body></html>
                """,
            )
        except Exception:
            pass
        try:
            db.add(
                Notification(
                    user_id=owner.id,
                    notification_type="inquiry",
                    title=f"New inquiry: {listing.title}",
                    body=f"From {data.sender_name}: {data.message[:120]}{'…' if len(data.message) > 120 else ''}",
                    link=f"/dashboard/inquiries/{inquiry.id}",
                    read=False,
                )
            )
            db.commit()
        except Exception:
            pass

    return {
        "success": True,
        "inquiry_id": inquiry.id,
        "message": "Your inquiry has been sent.",
    }


# ─── Finance calculator ───────────────────────────────────────────────────────

@router.post("/{listing_id}/calculate-financing")
def calculate_financing(
    listing_id: int,
    calc: FinanceCalculation,
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    if not listing.price:
        raise HTTPException(status_code=400, detail="Listing has no price")

    price = listing.price
    down_payment = price * (calc.down_payment_percent / 100)
    loan_amount = price - down_payment
    monthly_rate = (calc.interest_rate / 100) / 12
    term_months = calc.term_years * 12

    if monthly_rate > 0:
        monthly_payment = (
            loan_amount * monthly_rate * (1 + monthly_rate) ** term_months
        ) / ((1 + monthly_rate) ** term_months - 1)
    else:
        monthly_payment = loan_amount / term_months

    total_paid = monthly_payment * term_months + down_payment
    total_interest = total_paid - price
    insurance_monthly = (calc.insurance_annual or (price * 0.01)) / 12
    maintenance_monthly = (price * (calc.maintenance_annual_percent / 100)) / 12
    total_monthly = monthly_payment + insurance_monthly + maintenance_monthly

    return {
        "purchase_price": price,
        "down_payment": round(down_payment, 2),
        "loan_amount": round(loan_amount, 2),
        "monthly_payment": round(monthly_payment, 2),
        "insurance_monthly": round(insurance_monthly, 2),
        "maintenance_monthly": round(maintenance_monthly, 2),
        "total_monthly_cost": round(total_monthly, 2),
        "total_interest": round(total_interest, 2),
        "total_cost": round(total_paid, 2),
        "term_years": calc.term_years,
        "term_months": term_months,
        "interest_rate": calc.interest_rate,
        "breakdown": {
            "principal_and_interest": round(monthly_payment, 2),
            "insurance": round(insurance_monthly, 2),
            "maintenance": round(maintenance_monthly, 2),
        },
    }


# ─── Share tracking ───────────────────────────────────────────────────────────

@router.post("/{listing_id}/track-share")
def track_share(listing_id: int, data: dict, db: Session = Depends(get_db)):
    return {"success": True, "platform": data.get("platform")}


@router.get("/{listing_id}/share-metadata")
def get_share_metadata(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    from app.core.config import settings
    return {
        "url": f"{settings.BASE_URL}/listings/{listing_id}",
        "title": listing.title,
        "description": (listing.description or "")[:200]
        or f"{listing.year} {listing.make} {listing.model}",
        "image": listing.images[0].url if listing.images else None,
        "price": listing.price,
        "currency": listing.currency or "USD",
    }