from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, EmailStr
from typing import Optional
import re
import logging
import os

from app.db.session import get_db
from app.models.charter import CharterListing
from app.api.deps import get_current_user, get_optional_user
from app.models.user import User

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
    max_min_days: Optional[int] = Query(None),
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
    if max_min_days is not None:
        query = query.filter(
            or_(
                CharterListing.min_charter_days == None,
                CharterListing.min_charter_days <= max_min_days,
            )
        )

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


@router.get("/admin/all")
def admin_list_all_charters(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin only")
    query = db.query(CharterListing)
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


@router.get("/{charter_id}")
def get_charter(charter_id: int, db: Session = Depends(get_db)):
    charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
    if not charter or charter.status == "inactive":
        raise HTTPException(status_code=404, detail="Charter listing not found")
    return _serialize(charter)


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
