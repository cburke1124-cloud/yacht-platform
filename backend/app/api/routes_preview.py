"""
Preview Listing routes — staff-only create/manage, public view by share token.

POST   /preview/listings               — create a preview listing (admin or sales rep)
GET    /preview/listings               — list all preview listings (admin or sales rep)
PUT    /preview/listings/{id}          — update a preview listing
DELETE /preview/listings/{id}          — delete a preview listing
GET    /preview/listings/view/{token}  — public view by share token (no auth)
POST   /preview/listings/scrape        — scrape a URL and return fields (no DB write)
"""

import uuid
import re
import json
import os
from typing import Optional, List
from datetime import datetime

import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.preview_listing import PreviewListing

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────

class PreviewListingCreate(BaseModel):
    title: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    price: Optional[float] = None
    currency: Optional[str] = "USD"
    length_feet: Optional[float] = None
    beam_feet: Optional[float] = None
    draft_feet: Optional[float] = None
    boat_type: Optional[str] = None
    hull_material: Optional[str] = None
    hull_type: Optional[str] = None
    condition: Optional[str] = None
    engine_count: Optional[int] = None
    engine_hours: Optional[float] = None
    fuel_type: Optional[str] = None
    max_speed_knots: Optional[float] = None
    cruising_speed_knots: Optional[float] = None
    cabins: Optional[int] = None
    berths: Optional[int] = None
    heads: Optional[int] = None
    fuel_capacity_gallons: Optional[float] = None
    water_capacity_gallons: Optional[float] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None
    feature_bullets: Optional[List[str]] = None
    additional_specs: Optional[dict] = None
    seller_name: Optional[str] = None
    seller_email: Optional[str] = None
    seller_phone: Optional[str] = None
    brokerage_name: Optional[str] = None
    brokerage_logo_url: Optional[str] = None
    brokerage_website: Optional[str] = None
    images: Optional[List[dict]] = None
    source_url: Optional[str] = None
    internal_note: Optional[str] = None


class PreviewListingUpdate(PreviewListingCreate):
    pass


class ScrapeRequest(BaseModel):
    url: str


# ──────────────────────────────────────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────────────────────────────────────

def _require_staff(user: User):
    if user.user_type not in ("admin", "sales_rep"):
        raise HTTPException(status_code=403, detail="Staff access required")


def _serialize(pl: PreviewListing) -> dict:
    return {
        "id": pl.id,
        "share_token": pl.share_token,
        "created_by": pl.created_by,
        "created_at": pl.created_at.isoformat() if pl.created_at else None,
        "updated_at": pl.updated_at.isoformat() if pl.updated_at else None,
        "title": pl.title,
        "make": pl.make,
        "model": pl.model,
        "year": pl.year,
        "price": pl.price,
        "currency": pl.currency,
        "length_feet": pl.length_feet,
        "beam_feet": pl.beam_feet,
        "draft_feet": pl.draft_feet,
        "boat_type": pl.boat_type,
        "hull_material": pl.hull_material,
        "hull_type": pl.hull_type,
        "condition": pl.condition,
        "engine_count": pl.engine_count,
        "engine_hours": pl.engine_hours,
        "fuel_type": pl.fuel_type,
        "max_speed_knots": pl.max_speed_knots,
        "cruising_speed_knots": pl.cruising_speed_knots,
        "cabins": pl.cabins,
        "berths": pl.berths,
        "heads": pl.heads,
        "fuel_capacity_gallons": pl.fuel_capacity_gallons,
        "water_capacity_gallons": pl.water_capacity_gallons,
        "city": pl.city,
        "state": pl.state,
        "country": pl.country,
        "description": pl.description,
        "feature_bullets": pl.feature_bullets or [],
        "additional_specs": pl.additional_specs or {},
        "seller_name": pl.seller_name,
        "seller_email": pl.seller_email,
        "seller_phone": pl.seller_phone,
        "brokerage_name": pl.brokerage_name,
        "brokerage_logo_url": pl.brokerage_logo_url,
        "brokerage_website": pl.brokerage_website,
        "images": pl.images or [],
        "source_url": pl.source_url,
        "internal_note": pl.internal_note,
        "is_active": pl.is_active,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@router.post("")
def create_preview_listing(
    body: PreviewListingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_staff(current_user)
    token = str(uuid.uuid4()).replace("-", "")[:32]
    pl = PreviewListing(
        share_token=token,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **{k: v for k, v in body.dict().items() if v is not None or k in ("feature_bullets", "images", "additional_specs")},
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return {"success": True, "preview": _serialize(pl)}


@router.get("")
def list_preview_listings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_staff(current_user)
    rows = db.query(PreviewListing).filter(PreviewListing.is_active == True).order_by(PreviewListing.created_at.desc()).all()
    return {"previews": [_serialize(r) for r in rows]}


@router.put("/{preview_id}")
def update_preview_listing(
    preview_id: int,
    body: PreviewListingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_staff(current_user)
    pl = db.query(PreviewListing).filter(PreviewListing.id == preview_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Preview listing not found")
    for field, value in body.dict(exclude_unset=True).items():
        setattr(pl, field, value)
    pl.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pl)
    return {"success": True, "preview": _serialize(pl)}


@router.delete("/{preview_id}")
def delete_preview_listing(
    preview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_staff(current_user)
    pl = db.query(PreviewListing).filter(PreviewListing.id == preview_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Preview listing not found")
    db.delete(pl)
    db.commit()
    return {"success": True}


@router.get("/view/{token}")
def get_preview_by_token(
    token: str,
    db: Session = Depends(get_db),
):
    """Public endpoint — returns listing data for the share link page."""
    pl = db.query(PreviewListing).filter(
        PreviewListing.share_token == token,
        PreviewListing.is_active == True,
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Preview not found or expired")
    return _serialize(pl)


@router.post("/scrape")
def scrape_preview(
    body: ScrapeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scrape a URL and return parsed fields — no DB write."""
    _require_staff(current_user)

    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    # Fetch page HTML
    try:
        resp = http_requests.get(
            url,
            timeout=25,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
            },
            allow_redirects=True,
        )
        resp.raise_for_status()
        raw_html = resp.text
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {exc}")

    from urllib.parse import urlparse, urljoin
    parsed_url = urlparse(url)
    base_origin = f"{parsed_url.scheme}://{parsed_url.netloc}"

    def make_absolute(img_url: str) -> str:
        if not img_url or img_url.startswith("data:"):
            return ""
        if img_url.startswith("//"):
            return "https:" + img_url
        if img_url.startswith("http"):
            return img_url
        return urljoin(base_origin, img_url)

    # ── Extract structured data BEFORE stripping HTML ──────────────────────

    # Open Graph tags (title, image, price)
    og_title = None
    og_image = None
    og_price = None
    for m in re.finditer(r'<meta[^>]+>', raw_html, re.IGNORECASE | re.DOTALL):
        tag = m.group(0)
        prop_m = re.search(r'(?:property|name)=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        content_m = re.search(r'content=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        if not prop_m or not content_m:
            continue
        prop = prop_m.group(1).lower()
        val = content_m.group(1)
        if prop == "og:image" and not og_image:
            og_image = make_absolute(val)
        elif prop == "og:title" and not og_title:
            og_title = val
        elif prop in ("og:price:amount", "product:price:amount") and not og_price:
            og_price = val

    # JSON-LD structured data
    jsonld_text = ""
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', raw_html, re.IGNORECASE | re.DOTALL):
        jsonld_text += " " + m.group(1)

    # ── Image extraction with smart filtering ─────────────────────────────

    LOGO_SKIP = re.compile(
        r'logo|icon|avatar|placeholder|sprite|banner|\.gif|tracking|pixel|1x1|blank|'
        r'header|footer|nav-|menu|button|bg-|background|social|share|arrow|chevron|'
        r'star|rating|loading|spinner|close|search|badge|seal|cert',
        re.IGNORECASE
    )
    MIN_DIM = 150  # skip images explicitly declared smaller than this

    seen_urls: set = set()
    candidate_images: list = []

    # Priority 1: OG image
    if og_image and og_image not in seen_urls and not LOGO_SKIP.search(og_image):
        seen_urls.add(og_image)
        candidate_images.append(og_image)

    # Priority 2: Full <img> tag analysis
    for img_tag in re.finditer(r'<img[^>]+>', raw_html, re.IGNORECASE | re.DOTALL):
        tag = img_tag.group(0)

        # Try best-quality src attributes in order
        img_url = None
        for attr in ["data-original", "data-zoom-image", "data-full", "data-large",
                     "data-lazy-src", "data-src", "src"]:
            m = re.search(rf'\b{attr}=["\']([^"\']+)["\']', tag, re.IGNORECASE)
            if m and m.group(1) and not m.group(1).startswith("data:"):
                candidate = m.group(1).strip()
                if re.search(r'\.(jpg|jpeg|png|webp)(\?|$)', candidate, re.IGNORECASE):
                    img_url = candidate
                    break

        if not img_url:
            continue

        # Skip obvious logos/icons by URL pattern
        if LOGO_SKIP.search(img_url):
            continue

        # Skip explicitly small images
        w_m = re.search(r'\bwidth=["\']?(\d+)', tag, re.IGNORECASE)
        h_m = re.search(r'\bheight=["\']?(\d+)', tag, re.IGNORECASE)
        if w_m and int(w_m.group(1)) < MIN_DIM:
            continue
        if h_m and int(h_m.group(1)) < MIN_DIM:
            continue

        abs_url = make_absolute(img_url)
        if not abs_url or abs_url in seen_urls:
            continue
        seen_urls.add(abs_url)
        candidate_images.append(abs_url)

    # Priority 3: srcset (high-res variants)
    for srcset_m in re.finditer(r'srcset=["\']([^"\']+)["\']', raw_html, re.IGNORECASE):
        # Take the last (highest-res) entry in the srcset
        parts = [p.strip() for p in srcset_m.group(1).split(",") if p.strip()]
        if parts:
            best = parts[-1].split()[0]
            abs_url = make_absolute(best)
            if abs_url and abs_url not in seen_urls and not LOGO_SKIP.search(abs_url):
                if re.search(r'\.(jpg|jpeg|png|webp)(\?|$)', abs_url, re.IGNORECASE):
                    seen_urls.add(abs_url)
                    candidate_images.append(abs_url)

    images = [{"url": u, "is_primary": i == 0} for i, u in enumerate(candidate_images[:20])]

    # ── Build plain text for extraction ───────────────────────────────────

    text = re.sub(r"<script[^>]*>.*?</script>", " ", raw_html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&#\d+;", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()

    # Prepend JSON-LD text for better extraction context
    if jsonld_text:
        text = jsonld_text + " " + text

    # Try Claude extraction first
    extracted = _claude_extract(text)
    if not extracted:
        extracted = _fallback_parse(text)

    # Merge OG hints for fields that weren't found
    if og_price and not extracted.get("price"):
        extracted["price"] = _to_float(re.sub(r"[^\d.]", "", og_price))
    if og_title and not extracted.get("title"):
        extracted["title"] = og_title

    extracted["images"] = images
    extracted["source_url"] = url
    return {"success": True, "data": extracted}


# ──────────────────────────────────────────────────────────────────────────────
# Extraction helpers (duplicated/adapted from routes_scraper.py)
# ──────────────────────────────────────────────────────────────────────────────

def _to_float(value):
    if not value:
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except Exception:
        return None


def _to_int(value):
    n = _to_float(value)
    return int(n) if n is not None else None


def _first(patterns, text, flags=re.IGNORECASE):
    for pattern in patterns:
        m = re.search(pattern, text, flags)
        if m and m.group(1):
            return m.group(1).strip()
    return None


def _fallback_parse(text: str) -> dict:
    lines = [l.strip() for l in text.replace("\r", "").split("\n") if l.strip()]
    # Prefer year that appears near a label; avoid copyright noise
    year = _first([
        r'(?:year|built|model\s+year)\s*[:\-]?\s*(19[5-9]\d|20[0-2]\d)',
        r'\b(19[5-9]\d|20[0-2]\d)\b(?!\s*(?:united|yachts|sales|©|copyright))',
    ], text)
    price = _first([
        r'(?:asking\s*price|price|list\s*price)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d+)?)',
        r'\$\s*([\d,]+(?:\.\d+)?)',
    ], text)
    length = _first([r"(?:loa|length(?:\s+overall)?)\s*[:\-]?\s*([\d.]+)", r"\b([\d.]+)\s*(?:ft|feet|')"], text)
    make = _first([
        r"\b(Azimut|Beneteau|Bertram|Boston\s*Whaler|Cabo|Carver|Chris-Craft|Ferretti|Formula|"
        r"Hatteras|Jeanneau|Leopard|Meridian|Monterey|Nordhavn|Oceanco|Pershing|Princess|"
        r"Regal|Riva|Sanlorenzo|Sea\s*Ray|Sunseeker|Tiara|Viking|Yellowfin)\b"
    ], text)
    cabins = _first([r"cabins?\s*[:\-]?\s*(\d+)"], text)
    berths = _first([r"(?:berths?|sleeps?)\s*[:\-]?\s*(\d+)"], text)
    heads = _first([r"heads?\s*[:\-]?\s*(\d+)"], text)
    fuel_cap = _first([r"fuel\s*(?:capacity|cap\.?)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)"], text)
    water_cap = _first([r"water\s*(?:capacity|cap\.?)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)"], text)
    beam = _first([r"beam\s*[:\-]?\s*([\d.]+)"], text)
    location_raw = _first([
        r'(?:location|located\s+in|homeport)\s*[:\-]?\s*([^\n<|]{3,50})',
    ], text)
    city = state = country = None
    if location_raw:
        parts = [p.strip() for p in location_raw.split(",") if p.strip()]
        city = parts[0] if parts else None
        state = parts[1] if len(parts) > 1 else None
        country = parts[2] if len(parts) > 2 else None
    bullets = [re.sub(r"^[-•*]\s+", "", l).strip() for l in lines if re.match(r"^[-•*]\s+", l)]
    return {
        "title": lines[0] if lines else None,
        "make": make, "year": _to_int(year), "price": _to_float(price),
        "length_feet": _to_float(length), "beam_feet": _to_float(beam),
        "cabins": _to_int(cabins), "berths": _to_int(berths), "heads": _to_int(heads),
        "fuel_capacity_gallons": _to_float(fuel_cap),
        "water_capacity_gallons": _to_float(water_cap),
        "city": city, "state": state, "country": country,
        "description": text[:3000],
        "feature_bullets": bullets[:8] if bullets else [],
    }


def _claude_extract(text: str):
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return None
    prompt = f"""Extract yacht listing fields from the text below and return a single JSON object — no markdown, no explanation, only raw JSON.

Text:
{text[:12000]}

Return exactly these fields (use null for unknowns):
title, make, model, year (int), price (number), length_feet (number), beam_feet (number),
draft_feet (number), cabins (int), berths (int), heads (int), engine_count (int),
engine_hours (number), fuel_type, fuel_capacity_gallons (number), water_capacity_gallons (number),
max_speed_knots (number), cruising_speed_knots (number), city, state, country,
boat_type (one of: "Motor Yacht","Sailing Yacht","Catamaran","Center Console","Sport Fisher","Trawler","Express Cruiser","Mega Yacht","Pontoon","Bowrider","Convertible","Pilothouse" or null),
hull_material (one of: "Fiberglass","Aluminum","Steel","Wood","Composite","Carbon Fiber" or null),
hull_type (one of: "Monohull","Catamaran","Trimaran","Planing","Displacement","Semi-Displacement" or null),
condition ("new" or "used" or null),
feature_bullets (array of up to 8 short strings),
description (first 2000 chars of main description text).
"""
    try:
        response = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": 4096,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=25,
        )
        if not response.ok:
            return None
        content = response.json().get("content", [])
        if not content:
            return None
        blob = re.sub(r"^```json\s*|\s*```$", "", content[0].get("text", "").strip())
        parsed = json.loads(blob)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None
