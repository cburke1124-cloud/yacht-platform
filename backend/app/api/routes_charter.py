from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import or_, String
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import date, datetime
from io import StringIO
from urllib.parse import urlparse
import csv
import re
import logging
import os

from app.db.session import get_db
from app.models.charter import CharterListing, CharterAvailabilityBlock, CharterSeasonalRate, CharterHourlyRate
from app.models.media import MediaFile, ListingMediaAttachment
from app.api.deps import get_current_user, get_optional_user
from app.models.user import User
from app.services.billing_status import user_has_paid
from app.services.media_scope import org_media_ids
from app.utils.phone import normalize_phone

logger = logging.getLogger(__name__)
CHARTER_INQUIRY_EMAIL = os.getenv("CONTACT_EMAIL", "info@yachtversal.com")

router = APIRouter()


class CharterInquiryRequest(BaseModel):
    charter_id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    message: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    guests: Optional[int] = None


class AvailabilityBlockRequest(BaseModel):
    start_date: date
    end_date: date
    status: str = "booked"
    source: str = "manual"
    notes: Optional[str] = None
    external_ref: Optional[str] = None


class SeasonalRateRequest(BaseModel):
    season_name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    day_rate: Optional[float] = None
    half_day_rate: Optional[float] = None
    week_rate: Optional[float] = None
    currency: Optional[str] = "USD"
    min_charter_days: Optional[int] = None
    notes: Optional[str] = None


class HourlyRateRequest(BaseModel):
    hours: int
    price: float
    label: Optional[str] = None
    notes: Optional[str] = None


def _is_admin(user: User) -> bool:
    # NOTE: User has no `is_admin` column — admin-ness is user_type == "admin"
    # everywhere else in the codebase. The old getattr(user, "is_admin", False)
    # checks here always returned False, locking real admins out of
    # /charter/admin/all (the UI then fell back to the public list, hiding drafts).
    return (user.user_type or "").lower() == "admin"


def _with_company_fallback(data: dict, charter: CharterListing, db: Session) -> dict:
    """Fill in charter_company_* display fields from the owning dealer's
    DealerProfile when the charter itself has none set.

    Charter listings created via admin import/scraper assignment often have
    an owning dealer (charter.user_id) but nobody filled in the "Charter
    Company" fields in the admin modal — those are just free-text display
    fields on the CharterListing row, never linked to the dealer's actual
    profile. Without this fallback the public listing page's contact card
    renders completely empty (no name, phone, email, logo, bio, socials)
    even though the owning dealer has a fully populated profile, exactly
    the same gap the for-sale listing page had before its dealer-profile
    section was fleshed out.

    charter.user_id can also be a team member/salesman rather than the
    top-level dealer account — team members have no DealerProfile of their
    own (only the parent dealer account does), so a direct lookup finds
    nothing and the profile-only fields (bio, logo, socials) silently stay
    blank even though the dealer's profile is fully configured. Mirrors
    routes_listings.py's get_listing_contact_info, which resolves through
    owner.parent_dealer_id for exactly this case.
    """
    if not charter.user_id:
        return data

    from app.models.dealer import DealerProfile

    owner = db.query(User).filter(User.id == charter.user_id).first()
    if not owner:
        return data
    profile_owner = owner
    if owner.parent_dealer_id:
        parent = db.query(User).filter(User.id == owner.parent_dealer_id).first()
        if parent:
            profile_owner = parent
    profile = db.query(DealerProfile).filter(DealerProfile.user_id == profile_owner.id).first()

    data["charter_company_name"] = data.get("charter_company_name") or (profile.company_name if profile else None) or getattr(owner, "company_name", None)
    data["charter_company_slug"] = data.get("charter_company_slug") or (profile.slug if profile else None)
    data["charter_company_email"] = data.get("charter_company_email") or (profile.email if profile else None) or owner.email
    data["charter_company_phone"] = data.get("charter_company_phone") or (profile.phone if profile else None) or getattr(owner, "phone", None)
    data["charter_company_website"] = data.get("charter_company_website") or (profile.website if profile else None)
    data["charter_company_logo_url"] = profile.logo_url if profile else None
    data["charter_company_description"] = profile.description if profile else None
    data["charter_company_city"] = profile.city if profile else None
    data["charter_company_state"] = profile.state if profile else None
    data["charter_company_country"] = profile.country if profile else None
    data["charter_company_facebook_url"] = profile.facebook_url if profile else None
    data["charter_company_instagram_url"] = profile.instagram_url if profile else None
    data["charter_company_twitter_url"] = profile.twitter_url if profile else None
    data["charter_company_linkedin_url"] = profile.linkedin_url if profile else None
    return data


def _can_manage_charter(charter: CharterListing, current_user: User, db: Session) -> bool:
    """True if current_user may edit/delete this charter: the owner, an admin,
    the dealer whose team member owns it, or the salesman it's assigned to.

    Mirrors routes_listings.py's team-inclusive ownership check — without this,
    a broker could see their team member's charter in /charter/my (which is
    already team-scoped) but get 403'd on every actual edit/delete/media/
    availability action against it, since those endpoints here only compared
    charter.user_id to current_user.id.
    """
    if _is_admin(current_user):
        return True
    if charter.user_id == current_user.id or charter.assigned_salesman_id == current_user.id:
        return True
    owner = db.query(User).filter(User.id == charter.user_id).first()
    return bool(owner and owner.parent_dealer_id == current_user.id)


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text


def _make_unique_slug(base: str, db: Session, exclude_id: Optional[int] = None) -> str:
    slug = _slugify(base)
    candidate = slug
    n = 1
    while True:
        q = db.query(CharterListing).filter(CharterListing.slug == candidate)
        if exclude_id:
            q = q.filter(CharterListing.id != exclude_id)
        if not q.first():
            return candidate
        candidate = f"{slug}-{n}"
        n += 1


def _charter_images(c: CharterListing) -> list:
    """Prefer the shared media-gallery attachments over the legacy flat
    `images` JSON array, so cards/lists reflect photos added via the new
    gallery. Falls back to the legacy array for charters not yet migrated."""
    attachments = sorted(
        (a for a in c.media_attachments if a.media and a.media.deleted_at is None),
        key=lambda a: (0 if a.is_primary else 1, a.display_order or 0),
    )
    if attachments:
        return [a.media.url for a in attachments]
    return c.images or []


def _serialize(c: CharterListing) -> dict:
    return {
        "id": c.id,
        "user_id": c.user_id,
        "assigned_salesman_id": c.assigned_salesman_id,
        "title": c.title,
        "vessel_name": c.vessel_name,
        "slug": c.slug,
        "make": c.make,
        "model": c.model,
        "year": c.year,
        "length_feet": c.length_feet,
        "beam_feet": c.beam_feet,
        "draft_feet": c.draft_feet,
        "boat_type": c.boat_type,
        "hull_material": c.hull_material,
        "engine_make": c.engine_make,
        "engine_count": c.engine_count,
        "fuel_type": c.fuel_type,
        "max_speed_knots": c.max_speed_knots,
        "cruising_speed_knots": c.cruising_speed_knots,
        "cabins": c.cabins,
        "berths": c.berths,
        "heads": c.heads,
        "max_guests": c.max_guests,
        "crew_included": c.crew_included,
        "crew_count": c.crew_count,
        "crew_profiles": c.crew_profiles or [],
        "home_port": c.home_port,
        "home_port_city": c.home_port_city,
        "home_port_state": c.home_port_state,
        "home_port_country": c.home_port_country,
        "operating_regions": c.operating_regions,
        "embarkation_ports": c.embarkation_ports or [],
        "disembarkation_ports": c.disembarkation_ports or [],
        "one_way_allowed": c.one_way_allowed or False,
        "turnaround_days": c.turnaround_days,
        "day_rate": c.day_rate,
        "half_day_rate": c.half_day_rate,
        "week_rate": c.week_rate,
        "currency": c.currency or "USD",
        "min_charter_days": c.min_charter_days,
        "max_charter_days": c.max_charter_days,
        "apa_percentage": c.apa_percentage,
        "security_deposit": c.security_deposit,
        "tax_notes": c.tax_notes,
        "cancellation_policy": c.cancellation_policy,
        "included_items": c.included_items or [],
        "excluded_items": c.excluded_items or [],
        "description": c.description,
        "amenities": c.amenities or [],
        "special_features": c.special_features or [],
        "images": _charter_images(c),
        "booking_url": c.booking_url,
        "charter_company_name": c.charter_company_name,
        "charter_company_slug": c.charter_company_slug,
        "charter_company_email": c.charter_company_email,
        "charter_company_phone": c.charter_company_phone,
        "charter_company_website": c.charter_company_website,
        "status": c.status,
        "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _serialize_block(b: CharterAvailabilityBlock) -> dict:
    return {
        "id": b.id,
        "charter_id": b.charter_id,
        "start_date": b.start_date.isoformat() if b.start_date else None,
        "end_date": b.end_date.isoformat() if b.end_date else None,
        "status": b.status,
        "source": b.source,
        "notes": b.notes,
        "external_ref": b.external_ref,
        "hold_expires_at": b.hold_expires_at.isoformat() if b.hold_expires_at else None,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


def _serialize_rate(r: CharterSeasonalRate) -> dict:
    return {
        "id": r.id,
        "charter_id": r.charter_id,
        "season_name": r.season_name,
        "start_date": r.start_date.isoformat() if r.start_date else None,
        "end_date": r.end_date.isoformat() if r.end_date else None,
        "day_rate": r.day_rate,
        "half_day_rate": r.half_day_rate,
        "week_rate": r.week_rate,
        "currency": r.currency or "USD",
        "min_charter_days": r.min_charter_days,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _serialize_hourly_rate(r: CharterHourlyRate) -> dict:
    return {
        "id": r.id,
        "charter_id": r.charter_id,
        "hours": r.hours,
        "price": r.price,
        "label": r.label,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@router.get("/facets")
def get_charter_facets(db: Session = Depends(get_db)):
    """Return distinct makes, models, cabin counts, and length/price ranges for active listings."""
    base = db.query(CharterListing).filter(CharterListing.status == "active")

    makes = (
        base.filter(CharterListing.make.isnot(None), CharterListing.make != "")
        .with_entities(CharterListing.make)
        .distinct()
        .order_by(CharterListing.make)
        .all()
    )
    models = (
        base.filter(CharterListing.model.isnot(None), CharterListing.model != "")
        .with_entities(CharterListing.make, CharterListing.model)
        .distinct()
        .order_by(CharterListing.make, CharterListing.model)
        .all()
    )
    cabins = (
        base.filter(CharterListing.cabins.isnot(None))
        .with_entities(CharterListing.cabins)
        .distinct()
        .order_by(CharterListing.cabins)
        .all()
    )

    from sqlalchemy import func
    agg = base.with_entities(
        func.min(CharterListing.length_feet),
        func.max(CharterListing.length_feet),
        func.min(CharterListing.day_rate),
        func.max(CharterListing.day_rate),
        func.min(CharterListing.week_rate),
        func.max(CharterListing.week_rate),
    ).one()

    return {
        "makes": [r[0] for r in makes],
        "models": [{"make": r[0], "model": r[1]} for r in models],
        "cabins": sorted({r[0] for r in cabins if r[0] is not None}),
        "length": {"min": int(agg[0] or 0), "max": int(agg[1] or 300)},
        "day_rate": {"min": int(agg[2] or 0), "max": int(agg[3] or 50000)},
        "week_rate": {"min": int(agg[4] or 0), "max": int(agg[5] or 300000)},
    }


@router.get("")
def list_charters(
    q: Optional[str] = Query(None),
    boat_type: Optional[str] = Query(None),
    charter_category: Optional[str] = Query(None),
    vessel_name: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    crew_included: Optional[bool] = Query(None),
    min_guests: Optional[int] = Query(None),
    min_cabins: Optional[int] = Query(None),
    min_length: Optional[float] = Query(None),
    max_length: Optional[float] = Query(None),
    min_year: Optional[int] = Query(None),
    max_year: Optional[int] = Query(None),
    max_day_rate: Optional[float] = Query(None),
    max_week_rate: Optional[float] = Query(None),
    max_min_days: Optional[int] = Query(None),
    features: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    region: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    make: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    exact_cabins: Optional[int] = Query(None),
    min_day_rate: Optional[float] = Query(None),
    min_week_rate: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(CharterListing).filter(CharterListing.status == "active")

    if q:
        q_like = f"%{q}%"
        query = query.filter(
            or_(
                CharterListing.title.ilike(q_like),
                CharterListing.vessel_name.ilike(q_like),
                CharterListing.make.ilike(q_like),
                CharterListing.description.ilike(q_like),
                CharterListing.charter_company_name.ilike(q_like),
            )
        )
    if vessel_name:
        query = query.filter(CharterListing.vessel_name.ilike(f"%{vessel_name}%"))
    if make:
        query = query.filter(CharterListing.make.ilike(f"%{make}%"))
    if model:
        query = query.filter(CharterListing.model.ilike(f"%{model}%"))
    if exact_cabins is not None:
        query = query.filter(CharterListing.cabins == exact_cabins)
    if boat_type:
        query = query.filter(CharterListing.boat_type.ilike(f"%{boat_type}%"))
    if charter_category:
        cat = charter_category.lower()
        if cat == "sailboat":
            query = query.filter(CharterListing.boat_type.ilike("%sailing%"))
        elif cat == "catamaran":
            query = query.filter(CharterListing.boat_type.ilike("%catamaran%"))
        elif cat == "yacht":
            query = query.filter(
                or_(
                    CharterListing.boat_type.ilike("%motor yacht%"),
                    CharterListing.boat_type.ilike("%mega yacht%"),
                    CharterListing.boat_type.ilike("%superyacht%"),
                    CharterListing.boat_type.ilike("%trawler%"),
                )
            )
    if location:
        loc_like = f"%{location}%"
        query = query.filter(
            or_(
                CharterListing.home_port_city.ilike(loc_like),
                CharterListing.home_port_state.ilike(loc_like),
                CharterListing.home_port_country.ilike(loc_like),
                CharterListing.operating_regions.ilike(loc_like),
            )
        )
    if region:
        reg_like = f"%{region}%"
        query = query.filter(
            or_(
                CharterListing.home_port_city.ilike(reg_like),
                CharterListing.home_port_state.ilike(reg_like),
                CharterListing.home_port_country.ilike(reg_like),
                CharterListing.operating_regions.ilike(reg_like),
                CharterListing.embarkation_ports.cast(String).ilike(reg_like),
                CharterListing.disembarkation_ports.cast(String).ilike(reg_like),
            )
        )
    if country:
        country_like = f"%{country}%"
        query = query.filter(
            or_(
                CharterListing.home_port_country.ilike(country_like),
                CharterListing.operating_regions.ilike(country_like),
                CharterListing.embarkation_ports.cast(String).ilike(country_like),
                CharterListing.disembarkation_ports.cast(String).ilike(country_like),
            )
        )
    if state:
        state_like = f"%{state}%"
        query = query.filter(
            or_(
                CharterListing.home_port_state.ilike(state_like),
                CharterListing.operating_regions.ilike(state_like),
            )
        )
    if crew_included is not None:
        query = query.filter(CharterListing.crew_included == crew_included)
    if min_guests is not None:
        query = query.filter(CharterListing.max_guests >= min_guests)
    if min_cabins is not None:
        query = query.filter(CharterListing.cabins >= min_cabins)
    if min_length is not None:
        query = query.filter(CharterListing.length_feet >= min_length)
    if max_length is not None:
        query = query.filter(CharterListing.length_feet <= max_length)
    if min_year is not None:
        query = query.filter(CharterListing.year >= min_year)
    if max_year is not None:
        query = query.filter(CharterListing.year <= max_year)
    if min_day_rate is not None:
        query = query.filter(CharterListing.day_rate >= min_day_rate)
    if max_day_rate is not None:
        query = query.filter(
            or_(CharterListing.day_rate == None, CharterListing.day_rate <= max_day_rate)
        )
    if min_week_rate is not None:
        query = query.filter(CharterListing.week_rate >= min_week_rate)
    if max_week_rate is not None:
        query = query.filter(
            or_(CharterListing.week_rate == None, CharterListing.week_rate <= max_week_rate)
        )
    if features:
        for feature in features.split(","):
            feature = feature.strip()
            if feature:
                query = query.filter(
                    CharterListing.amenities.cast(String).ilike(f"%{feature}%")
                )
    if max_min_days is not None:
        query = query.filter(
            or_(
                CharterListing.min_charter_days == None,
                CharterListing.min_charter_days <= max_min_days,
            )
        )

    # Phase 2: hide listings with conflicting availability blocks when dates are provided.
    if start_date and end_date:
        conflict_ids = (
            db.query(CharterAvailabilityBlock.charter_id)
            .filter(
                CharterAvailabilityBlock.start_date <= end_date,
                CharterAvailabilityBlock.end_date >= start_date,
                CharterAvailabilityBlock.status.in_(["booked", "hold", "option", "maintenance", "owner_use"]),
            )
            .distinct()
            .subquery()
        )
        query = query.filter(~CharterListing.id.in_(conflict_ids))

    total = query.count()
    charters = query.order_by(CharterListing.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "results": [_serialize(c) for c in charters],
    }


@router.get("/my")
def my_charters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Charter listings owned by, or assigned to, the current user — mirrors
    /listings/my-listings' team-inclusive scoping for dealer/admin accounts."""
    if current_user.user_type in ("dealer", "admin"):
        team_ids = [u.id for u in db.query(User).filter(User.parent_dealer_id == current_user.id).all()]
        owner_ids = [current_user.id] + team_ids
        query = db.query(CharterListing).filter(
            or_(
                CharterListing.user_id.in_(owner_ids),
                CharterListing.assigned_salesman_id.in_(owner_ids),
            ),
            CharterListing.deleted_at.is_(None),
        )
    else:
        query = db.query(CharterListing).filter(
            or_(
                CharterListing.user_id == current_user.id,
                CharterListing.assigned_salesman_id == current_user.id,
            ),
            CharterListing.deleted_at.is_(None),
        )
    charters = query.order_by(CharterListing.created_at.desc()).all()
    return [_serialize(c) for c in charters]


@router.get("/recently-deleted")
def get_recently_deleted_charters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trash view for charter listings, mirroring /listings/recently-deleted."""
    is_admin = _is_admin(current_user)
    query = db.query(CharterListing).filter(CharterListing.deleted_at.isnot(None))
    if not is_admin:
        team_ids = [u.id for u in db.query(User).filter(User.parent_dealer_id == current_user.id).all()]
        owner_ids = [current_user.id] + team_ids
        query = query.filter(
            or_(
                CharterListing.user_id.in_(owner_ids),
                CharterListing.assigned_salesman_id.in_(owner_ids),
            )
        )
    charters = query.order_by(CharterListing.deleted_at.desc()).all()
    return [_serialize(c) for c in charters]


@router.post("/{charter_id}/restore")
def restore_charter(
    charter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")
    if not charter.deleted_at:
        return {"success": True, "message": "Charter is not deleted"}
    charter.deleted_at = None
    charter.status = "draft"
    db.commit()
    return {"success": True}


@router.get("/admin/all")
def admin_list_all_charters(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    # Deleted charters live in the trash view (/charter/recently-deleted), not here.
    query = db.query(CharterListing).filter(CharterListing.deleted_at.is_(None))
    if q:
        q_like = f"%{q}%"
        query = query.filter(
            or_(
                CharterListing.title.ilike(q_like),
                CharterListing.vessel_name.ilike(q_like),
                CharterListing.charter_company_name.ilike(q_like),
            )
        )
    total = query.count()
    results = query.order_by(CharterListing.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "results": [_serialize(c) for c in results],
    }


class BulkCharterStatusUpdate(BaseModel):
    charter_ids: List[int]
    status: str


class BulkCharterIds(BaseModel):
    charter_ids: List[int]


@router.post("/admin/bulk-status")
def bulk_update_charter_status(
    body: BulkCharterStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update status on many charters in one transaction, mirroring
    routes_admin.py's bulk_update_scraped_listing_status for for-sale listings."""
    if body.status not in {"active", "draft", "inactive"}:
        raise HTTPException(status_code=400, detail="Invalid status value")
    if not body.charter_ids:
        return {"success": True, "updated": 0}
    if len(body.charter_ids) > 2000:
        raise HTTPException(status_code=400, detail="Too many charter IDs (max 2000 per request)")

    # Don't trust the client's id list wholesale — only touch charters this
    # user is actually allowed to manage (same scoping as every other
    # single-charter mutation endpoint).
    charters = (
        db.query(CharterListing)
        .filter(CharterListing.id.in_(body.charter_ids), CharterListing.deleted_at.is_(None))
        .all()
    )
    allowed_ids = [c.id for c in charters if _can_manage_charter(c, current_user, db)]
    if not allowed_ids:
        return {"success": True, "updated": 0}

    updated = (
        db.query(CharterListing)
        .filter(CharterListing.id.in_(allowed_ids))
        .update({"status": body.status, "updated_at": datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return {"success": True, "updated": updated}


@router.post("/admin/bulk-delete")
def bulk_delete_charters(
    body: BulkCharterIds,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete many charters at once — same trash/restore semantics as
    the single-charter DELETE endpoint (status='deleted' + deleted_at)."""
    if not body.charter_ids:
        return {"success": True, "deleted": 0}
    if len(body.charter_ids) > 2000:
        raise HTTPException(status_code=400, detail="Too many charter IDs (max 2000 per request)")

    charters = (
        db.query(CharterListing)
        .filter(CharterListing.id.in_(body.charter_ids), CharterListing.deleted_at.is_(None))
        .all()
    )
    allowed = [c for c in charters if _can_manage_charter(c, current_user, db)]
    now = datetime.utcnow()
    for c in allowed:
        c.status = "deleted"
        c.deleted_at = now
    db.commit()
    return {"success": True, "deleted": len(allowed)}


# ---------------------------------------------------------------------------
# CSV import / export — registered before the "/{charter_id}" routes below so
# the static "/import" and "/export" paths aren't swallowed by the dynamic one.
# ---------------------------------------------------------------------------

CSV_COLUMNS = [
    "id", "user_id", "title", "vessel_name", "make", "model", "year", "boat_type", "hull_material",
    "length_feet", "beam_feet", "draft_feet", "cabins", "berths", "heads", "max_guests",
    "crew_included", "crew_count", "home_port_city", "home_port_state", "home_port_country",
    "operating_regions", "day_rate", "half_day_rate", "week_rate", "currency",
    "min_charter_days", "max_charter_days", "apa_percentage", "security_deposit",
    "amenities", "included_items", "excluded_items", "description",
    "charter_company_name", "charter_company_email", "charter_company_phone",
    "charter_company_website", "booking_url", "status",
]

# Columns that are stored as JSON lists — comma-separated in the CSV
_LIST_COLUMNS = {"amenities", "included_items", "excluded_items"}
_INT_COLUMNS = {"year", "cabins", "berths", "heads", "max_guests", "crew_count", "min_charter_days", "max_charter_days"}
_FLOAT_COLUMNS = {"length_feet", "beam_feet", "draft_feet", "day_rate", "half_day_rate", "week_rate", "apa_percentage", "security_deposit"}
_BOOL_COLUMNS = {"crew_included"}


@router.post("/import")
def import_charters(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk import charter listings from CSV. Include 'id' to update an existing listing."""
    content = file.file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(StringIO(text))

    created = 0
    updated = 0
    errors: list = []
    is_admin = _is_admin(current_user)

    for row_index, row in enumerate(reader, start=2):
        try:
            title = (row.get("title") or "").strip()
            vessel_name = (row.get("vessel_name") or title).strip()
            if not title or not vessel_name:
                errors.append(f"Row {row_index}: title and vessel_name are required")
                continue

            payload: Dict = {"title": title, "vessel_name": vessel_name}
            for col in CSV_COLUMNS:
                if col in ("id", "user_id", "title", "vessel_name"):
                    continue
                raw_val = row.get(col)
                if raw_val is None or raw_val.strip() == "":
                    continue
                val = raw_val.strip()
                if col in _LIST_COLUMNS:
                    payload[col] = [v.strip() for v in val.split(",") if v.strip()]
                elif col in _INT_COLUMNS:
                    payload[col] = int(float(val))
                elif col in _FLOAT_COLUMNS:
                    payload[col] = float(val)
                elif col in _BOOL_COLUMNS:
                    payload[col] = val.lower() in ("1", "true", "yes", "y")
                else:
                    payload[col] = val

            # Explicit ownership column — only admins may set/reassign it; a
            # non-admin dealer importing their own CSV always owns the rows
            # they create, regardless of what (if anything) is in this column.
            owner_id_raw = (row.get("user_id") or "").strip()
            explicit_owner_id: Optional[int] = None
            if owner_id_raw and is_admin:
                if not db.query(User.id).filter(User.id == int(owner_id_raw)).first():
                    errors.append(f"Row {row_index}: user_id {owner_id_raw} does not exist")
                    continue
                explicit_owner_id = int(owner_id_raw)

            charter_id_raw = (row.get("id") or "").strip()
            charter = None
            if charter_id_raw:
                charter = db.query(CharterListing).filter(CharterListing.id == int(charter_id_raw)).first()
                if charter and not _can_manage_charter(charter, current_user, db):
                    errors.append(f"Row {row_index}: not authorised to update charter id {charter_id_raw}")
                    continue

            if charter:
                for key, val in payload.items():
                    setattr(charter, key, val)
                if explicit_owner_id is not None:
                    charter.user_id = explicit_owner_id
                db.commit()
                updated += 1
            else:
                slug = _make_unique_slug(vessel_name or title, db)
                # Admins importing on behalf of a dealer must say so explicitly via
                # the user_id column — leaving a row unowned (rather than silently
                # attributing it to the admin's own account) matches how the
                # Master Ocean sync and other unassigned-import paths behave, and
                # keeps the listing's company card from showing the admin's own
                # profile instead of the real broker's.
                owner_id = explicit_owner_id if explicit_owner_id is not None else (None if is_admin else current_user.id)
                charter = CharterListing(user_id=owner_id, slug=slug, status=payload.pop("status", "draft"), **payload)
                db.add(charter)
                db.commit()
                created += 1

        except Exception as exc:
            db.rollback()
            errors.append(f"Row {row_index}: {str(exc)}")

    return {"success": True, "created": created, "updated": updated, "errors": errors}


@router.get("/export")
def export_charters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export charter listings to CSV. Admins get all listings; dealers get their team's."""
    is_admin = _is_admin(current_user)
    query = db.query(CharterListing)
    if not is_admin:
        team_ids = [u.id for u in db.query(User).filter(User.parent_dealer_id == current_user.id).all()]
        owner_ids = [current_user.id] + team_ids
        query = query.filter(
            or_(
                CharterListing.user_id.in_(owner_ids),
                CharterListing.assigned_salesman_id.in_(owner_ids),
            )
        )
    charters = query.all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)
    for c in charters:
        row = []
        for col in CSV_COLUMNS:
            val = getattr(c, col, None)
            if col in _LIST_COLUMNS and isinstance(val, list):
                val = ", ".join(val)
            row.append(val)
        writer.writerow(row)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=charter-listings-export.csv"},
    )


@router.get("/{charter_id}")
def get_charter(charter_id: int, db: Session = Depends(get_db)):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter or charter.deleted_at is not None or charter.status == "inactive":
        raise HTTPException(status_code=404, detail="Charter listing not found")
    return {
        **_with_company_fallback(_serialize(charter), charter, db),
        "availability_blocks": [_serialize_block(b) for b in charter.availability_blocks],
        "seasonal_rates": [_serialize_rate(r) for r in charter.seasonal_rates],
        "hourly_rates": [_serialize_hourly_rate(r) for r in charter.hourly_rates],
    }


@router.get("/{charter_id}/availability")
def get_charter_availability(charter_id: int, db: Session = Depends(get_db)):
    blocks = (
        db.query(CharterAvailabilityBlock)
        .filter(CharterAvailabilityBlock.charter_id == charter_id)
        .order_by(CharterAvailabilityBlock.start_date.asc())
        .all()
    )
    return [_serialize_block(b) for b in blocks]


@router.post("/{charter_id}/availability")
def create_charter_availability_block(
    charter_id: int,
    data: AvailabilityBlockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Charter listing not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

    conflict = (
        db.query(CharterAvailabilityBlock.id)
        .filter(
            CharterAvailabilityBlock.charter_id == charter_id,
            CharterAvailabilityBlock.start_date <= data.end_date,
            CharterAvailabilityBlock.end_date >= data.start_date,
            CharterAvailabilityBlock.status.in_(["booked", "hold", "option", "maintenance", "owner_use"]),
        )
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail="Availability conflict")

    block = CharterAvailabilityBlock(
        charter_id=charter_id,
        start_date=data.start_date,
        end_date=data.end_date,
        status=data.status,
        source=data.source,
        notes=data.notes,
        external_ref=data.external_ref,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return _serialize_block(block)


@router.delete("/{charter_id}/availability/{block_id}")
def delete_charter_availability_block(
    charter_id: int,
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    block = db.query(CharterAvailabilityBlock).filter(
        CharterAvailabilityBlock.id == block_id,
        CharterAvailabilityBlock.charter_id == charter_id,
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="Availability block not found")
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")
    db.delete(block)
    db.commit()
    return {"success": True}


@router.get("/{charter_id}/seasonal-rates")
def get_charter_seasonal_rates(charter_id: int, db: Session = Depends(get_db)):
    rates = (
        db.query(CharterSeasonalRate)
        .filter(CharterSeasonalRate.charter_id == charter_id)
        .order_by(CharterSeasonalRate.start_date.asc().nullsfirst(), CharterSeasonalRate.season_name.asc())
        .all()
    )
    return [_serialize_rate(r) for r in rates]


@router.post("/{charter_id}/seasonal-rates")
def create_charter_seasonal_rate(
    charter_id: int,
    data: SeasonalRateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Charter listing not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")
    rate = CharterSeasonalRate(
        charter_id=charter_id,
        season_name=data.season_name,
        start_date=data.start_date,
        end_date=data.end_date,
        day_rate=data.day_rate,
        half_day_rate=data.half_day_rate,
        week_rate=data.week_rate,
        currency=data.currency or "USD",
        min_charter_days=data.min_charter_days,
        notes=data.notes,
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return _serialize_rate(rate)


@router.delete("/{charter_id}/seasonal-rates/{rate_id}")
def delete_charter_seasonal_rate(
    charter_id: int,
    rate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rate = db.query(CharterSeasonalRate).filter(
        CharterSeasonalRate.id == rate_id,
        CharterSeasonalRate.charter_id == charter_id,
    ).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Seasonal rate not found")

    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Charter listing not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")

    db.delete(rate)
    db.commit()
    return {"success": True}


@router.get("/{charter_id}/hourly-rates")
def get_charter_hourly_rates(charter_id: int, db: Session = Depends(get_db)):
    rates = (
        db.query(CharterHourlyRate)
        .filter(CharterHourlyRate.charter_id == charter_id)
        .order_by(CharterHourlyRate.hours.asc())
        .all()
    )
    return [_serialize_hourly_rate(r) for r in rates]


@router.post("/{charter_id}/hourly-rates")
def create_charter_hourly_rate(
    charter_id: int,
    data: HourlyRateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Charter listing not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")
    rate = CharterHourlyRate(
        charter_id=charter_id,
        hours=data.hours,
        price=data.price,
        label=data.label,
        notes=data.notes,
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return _serialize_hourly_rate(rate)


@router.delete("/{charter_id}/hourly-rates/{rate_id}")
def delete_charter_hourly_rate(
    charter_id: int,
    rate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rate = db.query(CharterHourlyRate).filter(
        CharterHourlyRate.id == rate_id,
        CharterHourlyRate.charter_id == charter_id,
    ).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Hourly rate not found")

    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Charter listing not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")

    db.delete(rate)
    db.commit()
    return {"success": True}


@router.post("/inquiry")
def submit_inquiry(data: CharterInquiryRequest, db: Session = Depends(get_db)):
    """Forward charter inquiry to the charter company and confirm to the inquirer."""
    charter = db.query(CharterListing).filter(CharterListing.id == data.charter_id).first()
    vessel_name = charter.title if charter else f"Charter #{data.charter_id}"

    dates_line = ""
    if data.start_date or data.end_date:
        dates_line = f"<p><strong>Desired Dates:</strong> {data.start_date or '—'} → {data.end_date or '—'}</p>"
    guests_line = f"<p><strong>Guests:</strong> {data.guests}</p>" if data.guests else ""
    phone_line = f"<p><strong>Phone:</strong> {data.phone}</p>" if data.phone else ""

    inquiry_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;">
        <div style="background:#10214F;padding:28px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">YachtVersal</h1>
            <p style="color:#01BBDC;margin:6px 0 0;font-size:14px;">Charter Inquiry</p>
        </div>
        <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <h2 style="color:#10214F;margin:0 0 8px;">New Inquiry — {vessel_name}</h2>
            <p><strong>From:</strong> {data.name}</p>
            <p><strong>Email:</strong> <a href="mailto:{data.email}" style="color:#01BBDC;">{data.email}</a></p>
            {phone_line}
            {guests_line}
            {dates_line}
            <hr style="border-color:#e5e7eb;margin:20px 0;" />
            <h3 style="color:#10214F;margin:0 0 8px;">Message</h3>
            <p style="white-space:pre-wrap;color:#374151;">{data.message}</p>
            <hr style="border-color:#e5e7eb;margin:20px 0;" />
            <p style="color:#6b7280;font-size:12px;">Submitted via YachtVersal. Reply to this email to respond to {data.name}.</p>
        </div>
    </div>
    """

    confirmation_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;">
        <div style="background:#10214F;padding:28px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">YachtVersal</h1>
        </div>
        <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <h2 style="color:#10214F;">Thanks for your inquiry, {data.name.split()[0]}!</h2>
            <p style="color:#374151;">Your request for <strong>{vessel_name}</strong> has been received. The charter company will be in touch with you shortly.</p>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">Questions? Reach us at <a href="mailto:{CHARTER_INQUIRY_EMAIL}" style="color:#01BBDC;">{CHARTER_INQUIRY_EMAIL}</a>.</p>
        </div>
    </div>
    """

    recipient = (
        charter.charter_company_email
        if charter and charter.charter_company_email
        else CHARTER_INQUIRY_EMAIL
    )
    try:
        from app.services.email_service import email_service
        email_service.send_email(
            to_email=recipient,
            subject=f"[Charter Inquiry] {vessel_name} — {data.name}",
            html_content=inquiry_html,
            reply_to=str(data.email),
        )
        if recipient != CHARTER_INQUIRY_EMAIL:
            email_service.send_email(
                to_email=CHARTER_INQUIRY_EMAIL,
                subject=f"[Charter Inquiry] {vessel_name} — {data.name}",
                html_content=inquiry_html,
                reply_to=str(data.email),
            )
    except Exception as e:
        logger.error(f"Charter inquiry: failed to send notification: {e}")

    try:
        from app.services.email_service import email_service
        email_service.send_email(
            to_email=str(data.email),
            subject=f"Charter inquiry received — {vessel_name}",
            html_content=confirmation_html,
        )
    except Exception as e:
        logger.warning(f"Charter inquiry: failed to send confirmation to {data.email}: {e}")

    return {"success": True}


# ---------------------------------------------------------------------------
# Authenticated CRUD
# ---------------------------------------------------------------------------

@router.post("")
def create_charter(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = payload.get("title", "").strip()
    vessel_name = payload.get("vessel_name", title).strip()
    if not title or not vessel_name:
        raise HTTPException(status_code=400, detail="title and vessel_name are required")

    is_admin = _is_admin(current_user)

    # Charter listings are a broker (dealer) feature bundled into the same
    # account/subscription as for-sale listings — no separate charter paywall
    # yet. Mirrors the for-sale gating in routes_listings.py:create_listing:
    # role gate is a hard block, payment gate is a soft downgrade to "draft"
    # so unpaid accounts can still create but not go public.
    user_type = (current_user.user_type or "").lower()
    permissions = current_user.permissions or {}

    has_create_permission = bool(permissions.get("can_create_listings"))
    is_dealer = user_type == "dealer"

    if not (is_admin or has_create_permission or is_dealer):
        raise HTTPException(status_code=403, detail="Charter listing creation requires a broker account")

    if not (is_admin or has_create_permission or user_has_paid(current_user)):
        payload["status"] = "draft"

    slug = _make_unique_slug(vessel_name or title, db)

    # Admins may attribute the listing to a different dealer account (e.g. when
    # manually entering or scraping a charter for a specific brokerage) — for
    # everyone else, ownership is always the creating user.
    owner_id = current_user.id
    if is_admin and payload.get("user_id"):
        owner_id = int(payload["user_id"])

    if "charter_company_phone" in payload:
        payload["charter_company_phone"] = normalize_phone(payload["charter_company_phone"])

    allowed_keys = {col.name for col in CharterListing.__table__.columns}
    charter = CharterListing(
        user_id=owner_id,
        slug=slug,
        **{k: v for k, v in payload.items() if k in allowed_keys and k not in ("id", "slug", "user_id", "created_at", "updated_at", "deleted_at", "images")},
    )
    db.add(charter)
    db.flush()  # need charter.id to attach media below

    # Scraped/manually-entered charters arrive with a flat list of raw image
    # URLs (payload["images"]) rather than going through the media library —
    # convert them into real MediaFile/ListingMediaAttachment rows up front
    # so every charter photo gets alt text and a rehosted URL from the moment
    # it's created, exactly like the automated for-sale scraper does for
    # ListingImage rows, instead of leaving charter.images as a flat
    # alt-text-less array pointing at the source site indefinitely.
    scraped_images = payload.get("images") or []
    if scraped_images:
        from app.services.scraper import _rehost_image
        from app.services.alt_text import generate_charter_image_alt_text

        for position, img in enumerate(scraped_images):
            img_url = img if isinstance(img, str) else (img.get("url") if isinstance(img, dict) else None)
            if not img_url:
                continue
            hosted_url = _rehost_image(img_url)
            media = MediaFile(
                user_id=owner_id,
                filename=os.path.basename(urlparse(hosted_url).path) or f"charter-{charter.id}-{position}.jpg",
                url=hosted_url,
                file_type="image",
                file_size_mb=0.0,
                alt_text=generate_charter_image_alt_text(charter, position),
            )
            db.add(media)
            db.flush()
            db.add(ListingMediaAttachment(
                charter_listing_id=charter.id,
                media_id=media.id,
                display_order=position,
                is_primary=(position == 0),
            ))

    db.commit()
    db.refresh(charter)
    return _serialize(charter)


@router.put("/{charter_id}")
def update_charter(
    charter_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")

    is_admin = _is_admin(current_user)
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")

    allowed_keys = {col.name for col in CharterListing.__table__.columns}
    exclude = {"id", "slug", "created_at", "updated_at", "deleted_at"}
    if not is_admin:
        exclude.add("user_id")  # only admins may reassign ownership
    for key, val in payload.items():
        if key in allowed_keys and key not in exclude:
            if key == "charter_company_phone":
                val = normalize_phone(val)
            setattr(charter, key, val)

    db.commit()
    db.refresh(charter)
    return _serialize(charter)


# ---------------------------------------------------------------------------
# Media gallery — same MediaFile / ListingMediaAttachment system for-sale
# listings use, instead of the flat `images` JSON array. Mirrors the
# equivalent endpoints in routes_listings.py exactly (attach/reorder/
# set-primary/delete), scoped by charter_listing_id instead of listing_id.
# The legacy `images` array is still read as a fallback for charters that
# haven't been migrated to attachments yet (see _serialize()/migration script).
# ---------------------------------------------------------------------------

class CharterMediaAttachRequest(BaseModel):
    media_ids: List[int]
    # Admins managing a charter on behalf of a dealer (e.g. a scraped draft)
    # pass this so attachment is scoped to that dealer's own media org,
    # instead of silently falling back to the admin's own org.
    as_dealer_id: Optional[int] = None


class CharterMediaReorderRequest(BaseModel):
    attachments: List[dict]


@router.get("/{charter_id}/media")
def get_charter_media(
    charter_id: int,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")

    # Active/published charters stay public (the public listing page renders
    # this gallery unauthenticated) — anything not yet active (draft,
    # awaiting_review, inactive) is only visible to whoever can manage it, so
    # one broker's unpublished draft can't be browsed by guessing its ID.
    if (charter.status or "").lower() != "active":
        if not current_user or not _can_manage_charter(charter, current_user, db):
            raise HTTPException(status_code=404, detail="Not found")

    items = []
    attachments = (
        db.query(ListingMediaAttachment, MediaFile)
        .join(MediaFile, ListingMediaAttachment.media_id == MediaFile.id)
        .filter(
            ListingMediaAttachment.charter_listing_id == charter_id,
            MediaFile.deleted_at.is_(None),
        )
        .order_by(ListingMediaAttachment.is_primary.desc(), ListingMediaAttachment.display_order)
        .all()
    )

    if attachments:
        for attachment, mf in attachments:
            items.append({
                "id": mf.id,
                "url": mf.url,
                "thumbnail_url": mf.thumbnail_url,
                "file_type": mf.file_type,
                "is_primary": attachment.is_primary,
                "display_order": attachment.display_order,
                "caption": attachment.caption or mf.caption,
                "width": mf.width,
                "height": mf.height,
                "alt_text": mf.alt_text,
            })
        items = sorted(items, key=lambda it: (0 if it.get("is_primary") else 1, it.get("display_order") or 0))
    else:
        # Legacy fallback: the flat images JSON array (scraped/manually-entered charters)
        for idx, img in enumerate(charter.images or []):
            url = img if isinstance(img, str) else (img.get("url") if isinstance(img, dict) else None)
            if not url:
                continue
            items.append({
                "id": None, "url": url, "thumbnail_url": None, "file_type": "image",
                "is_primary": idx == 0, "display_order": idx, "caption": None,
                "width": None, "height": None, "alt_text": None,
            })

    return {"charter_id": charter_id, "media": items, "total": len(items)}


@router.post("/{charter_id}/media/attach")
def attach_charter_media(
    charter_id: int,
    payload: CharterMediaAttachRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace charter media attachments with the provided media IDs (ordered)."""
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")

    media_ids = [mid for mid in payload.media_ids if isinstance(mid, int)]

    # Once the media library is used, the legacy flat array is superseded —
    # clear it so get_charter_media() doesn't fall back to stale URLs.
    charter.images = []

    db.query(ListingMediaAttachment).filter(ListingMediaAttachment.charter_listing_id == charter_id).delete()

    if not media_ids:
        db.commit()
        return {"success": True, "attached": 0}

    media_files = db.query(MediaFile).filter(MediaFile.id.in_(media_ids), MediaFile.deleted_at.is_(None)).all()
    media_by_id = {m.id: m for m in media_files}

    # Which media org this attach call is allowed to pull from. Admins default
    # to their own org — cross-org attachment only happens if they explicitly
    # declare which dealer they're acting for (matches the picker's
    # as_dealer_id), so an admin can never silently attach one broker's media
    # to a different broker's listing.
    scope_user = current_user
    if _is_admin(current_user) and payload.as_dealer_id is not None:
        target = db.query(User).filter(User.id == payload.as_dealer_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Target broker not found")
        scope_user = target
    allowed_ids = org_media_ids(scope_user, db)

    from app.services.alt_text import generate_charter_image_alt_text

    display_order = 0
    attached = 0
    for media_id in media_ids:
        mf = media_by_id.get(media_id)
        if not mf:
            continue
        if mf.user_id not in allowed_ids:
            continue
        # A photo uploaded straight into the media library (not via scraping)
        # has no listing context to generate alt text from at upload time —
        # backfill it here, now that we know which charter it's joining.
        if mf.file_type == "image" and not (mf.alt_text or "").strip():
            mf.alt_text = generate_charter_image_alt_text(charter, display_order)
        db.add(ListingMediaAttachment(
            charter_listing_id=charter_id,
            media_id=media_id,
            display_order=display_order,
            is_primary=(attached == 0),
            caption=mf.caption,
        ))
        display_order += 1
        attached += 1

    db.commit()
    return {"success": True, "attached": attached}


@router.post("/{charter_id}/media/reorder")
def reorder_charter_media(
    charter_id: int,
    payload: CharterMediaReorderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")

    ids = [a["id"] for a in payload.attachments if "id" in a]
    attachments = db.query(ListingMediaAttachment).filter(
        ListingMediaAttachment.charter_listing_id == charter_id,
        ListingMediaAttachment.id.in_(ids),
    ).all()
    att_by_id = {a.id: a for a in attachments}
    for idx, att in enumerate(payload.attachments):
        obj = att_by_id.get(att["id"])
        if obj:
            obj.display_order = att.get("display_order", idx)
            obj.is_primary = bool(att.get("is_primary", False))
    db.commit()
    return {"success": True, "updated": len(attachments)}


@router.post("/{charter_id}/media/{media_id}/set-primary")
def set_primary_charter_image(
    charter_id: int,
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")

    attachments = db.query(ListingMediaAttachment).filter(ListingMediaAttachment.charter_listing_id == charter_id).all()
    if not attachments:
        raise HTTPException(status_code=404, detail="No media attachments on this charter")
    for att in attachments:
        att.is_primary = att.media_id == media_id
    db.commit()
    return {"success": True}


@router.delete("/{charter_id}/media/{media_id}")
def delete_charter_media(
    charter_id: int,
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a single attachment (media_id = MediaFile.id) and auto-promote
    the next image to primary if the deleted one was the cover."""
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")
    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")

    target = db.query(ListingMediaAttachment).filter(
        ListingMediaAttachment.charter_listing_id == charter_id,
        ListingMediaAttachment.media_id == media_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Attachment not found")

    was_primary = target.is_primary
    db.delete(target)
    db.flush()

    if was_primary:
        next_att = (
            db.query(ListingMediaAttachment)
            .filter(ListingMediaAttachment.charter_listing_id == charter_id)
            .order_by(ListingMediaAttachment.display_order)
            .first()
        )
        if next_att:
            next_att.is_primary = True

    db.commit()
    return {"success": True}


@router.delete("/{charter_id}")
def delete_charter(
    charter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")

    if not _can_manage_charter(charter, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorised")

    # Soft delete — moves the listing to the trash view (/charter/recently-deleted)
    # instead of just flipping status, which was indistinguishable from a
    # deliberately paused ("inactive") listing and had no restore/purge path.
    charter.status = "deleted"
    charter.deleted_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "Charter moved to Recently Deleted"}


@router.delete("/admin/{charter_id}")
def admin_hard_delete(
    charter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(charter)
    db.commit()
    return {"success": True}
