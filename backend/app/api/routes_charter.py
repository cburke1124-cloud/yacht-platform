from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
import re

from app.db.session import get_db
from app.models.charter import CharterListing
from app.api.deps import get_current_user, get_optional_user
from app.models.user import User

router = APIRouter()


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


def _serialize(c: CharterListing) -> dict:
    return {
        "id": c.id,
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
        "home_port": c.home_port,
        "home_port_city": c.home_port_city,
        "home_port_state": c.home_port_state,
        "home_port_country": c.home_port_country,
        "operating_regions": c.operating_regions,
        "day_rate": c.day_rate,
        "half_day_rate": c.half_day_rate,
        "week_rate": c.week_rate,
        "currency": c.currency or "USD",
        "min_charter_days": c.min_charter_days,
        "max_charter_days": c.max_charter_days,
        "description": c.description,
        "amenities": c.amenities or [],
        "images": c.images or [],
        "booking_url": c.booking_url,
        "charter_company_name": c.charter_company_name,
        "charter_company_slug": c.charter_company_slug,
        "charter_company_email": c.charter_company_email,
        "charter_company_phone": c.charter_company_phone,
        "charter_company_website": c.charter_company_website,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@router.get("")
def list_charters(
    q: Optional[str] = Query(None),
    boat_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    crew_included: Optional[bool] = Query(None),
    min_guests: Optional[int] = Query(None),
    min_length: Optional[float] = Query(None),
    max_length: Optional[float] = Query(None),
    max_day_rate: Optional[float] = Query(None),
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
    if boat_type:
        query = query.filter(CharterListing.boat_type.ilike(f"%{boat_type}%"))
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
    if crew_included is not None:
        query = query.filter(CharterListing.crew_included == crew_included)
    if min_guests is not None:
        query = query.filter(CharterListing.max_guests >= min_guests)
    if min_length is not None:
        query = query.filter(CharterListing.length_feet >= min_length)
    if max_length is not None:
        query = query.filter(CharterListing.length_feet <= max_length)
    if max_day_rate is not None:
        query = query.filter(CharterListing.day_rate <= max_day_rate)

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
    charters = (
        db.query(CharterListing)
        .filter(CharterListing.user_id == current_user.id)
        .order_by(CharterListing.created_at.desc())
        .all()
    )
    return [_serialize(c) for c in charters]


@router.get("/{charter_id}")
def get_charter(charter_id: int, db: Session = Depends(get_db)):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter or charter.status == "inactive":
        raise HTTPException(status_code=404, detail="Charter listing not found")
    return _serialize(charter)


@router.post("/inquiry")
def submit_inquiry(payload: dict, db: Session = Depends(get_db)):
    """Accept inquiry submissions — currently a no-op stub that returns 200.
    Hook into notification/email system as needed."""
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

    slug = _make_unique_slug(vessel_name or title, db)

    charter = CharterListing(
        user_id=current_user.id,
        slug=slug,
        **{k: v for k, v in payload.items() if k not in ("slug",) and hasattr(CharterListing, k)},
    )
    db.add(charter)
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

    is_admin = getattr(current_user, "is_admin", False)
    if charter.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised")

    for key, val in payload.items():
        if key not in ("id", "slug", "user_id", "created_at") and hasattr(CharterListing, key):
            setattr(charter, key, val)

    db.commit()
    db.refresh(charter)
    return _serialize(charter)


@router.delete("/{charter_id}")
def delete_charter(
    charter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")

    is_admin = getattr(current_user, "is_admin", False)
    if charter.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised")

    # Soft delete
    charter.status = "inactive"
    db.commit()
    return {"success": True}


@router.delete("/admin/{charter_id}")
def admin_hard_delete(
    charter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin only")
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(charter)
    db.commit()
    return {"success": True}
