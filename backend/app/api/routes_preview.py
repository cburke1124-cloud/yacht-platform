"""
Preview Listing routes — staff-only create/manage, public view by share token.

POST   /preview/listings               — create a preview listing (admin or sales rep)
GET    /preview/listings               — list all preview listings (admin or sales rep)
PUT    /preview/listings/{id}          — update a preview listing
DELETE /preview/listings/{id}          — delete a preview listing
GET    /preview/listings/view/{token}  — public view by share token (no auth)
POST   /preview/listings/{token}/track — anonymous CTA click tracking (no auth)
POST   /preview/listings/scrape        — scrape a URL and return fields (no DB write)
"""

import uuid
import re
import json
import os
from datetime import datetime, timezone
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
from app.models.partner_growth import AffiliateAccount

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


def _serialize(pl: PreviewListing, db: Session = None) -> dict:
    # Look up the creator's affiliate code so the frontend can append ?ref= to CTAs
    creator_affiliate_code = None
    if db and pl.created_by:
        af = db.query(AffiliateAccount).filter(
            AffiliateAccount.user_id == pl.created_by,
            AffiliateAccount.account_type == "sales_rep",
            AffiliateAccount.active == True,
        ).first()
        creator_affiliate_code = af.code if af else None

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
        "creator_affiliate_code": creator_affiliate_code,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@router.post("")
@router.post("/")
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
    return {"success": True, "preview": _serialize(pl, db)}


@router.get("")
@router.get("/")
def list_preview_listings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_staff(current_user)
    rows = db.query(PreviewListing).filter(PreviewListing.is_active == True).order_by(PreviewListing.created_at.desc()).all()
    return {"previews": [_serialize(r, db) for r in rows]}


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
    return {"success": True, "preview": _serialize(pl, db)}


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
    return _serialize(pl, db)


class TrackEventRequest(BaseModel):
    event: str


@router.post("/view/{token}/track", status_code=204)
def track_preview_cta(
    token: str,
    body: TrackEventRequest,
    db: Session = Depends(get_db),
):
    """Anonymous CTA click tracking — records event + timestamp in additional_specs."""
    pl = db.query(PreviewListing).filter(
        PreviewListing.share_token == token,
        PreviewListing.is_active == True,
    ).first()
    if not pl:
        return  # Silently ignore — don't expose 404 to anonymous callers
    specs = dict(pl.additional_specs or {})
    events = specs.setdefault("cta_clicks", [])
    events.append({
        "event": body.event[:100],  # cap length
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    from sqlalchemy.orm.attributes import flag_modified
    pl.additional_specs = specs
    flag_modified(pl, "additional_specs")
    db.commit()


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
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
                "Referer": "https://www.google.com/",
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
    hostname = parsed_url.netloc.lower().removeprefix("www.")

    def make_absolute(href: str) -> str:
        if not href or href.startswith("data:"):
            return ""
        if href.startswith("//"):
            return "https:" + href
        if href.startswith("http"):
            return href
        return urljoin(base_origin + parsed_url.path, href)

    def is_image_url(u: str) -> bool:
        return bool(re.search(r'\.(jpg|jpeg|png|webp)(\?[^"\']*)?$', u, re.IGNORECASE))

    # ── Brokerage name from domain ─────────────────────────────────────────
    # e.g. "unitedyacht.com" → "United Yacht", "yachtworld.com" → "YachtWorld"
    domain_name = re.sub(r'\.(com|net|org|co\.uk|io|us|ca)$', '', hostname, flags=re.IGNORECASE)
    domain_name = re.sub(r'[-_]', ' ', domain_name).strip().title()
    site_brokerage_name = domain_name or None

    # ── Extract meta / OG tags ─────────────────────────────────────────────
    og_title = og_image = og_price = og_description = None
    meta_site_name = None
    for m in re.finditer(r'<meta[^>]+>', raw_html, re.IGNORECASE | re.DOTALL):
        tag = m.group(0)
        prop_m = re.search(r'(?:property|name)=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        content_m = re.search(r'content=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        if not prop_m or not content_m:
            continue
        prop = prop_m.group(1).lower()
        val = content_m.group(1).strip()
        if prop == "og:image" and not og_image:
            og_image = make_absolute(val)
        elif prop == "og:title" and not og_title:
            og_title = val
        elif prop in ("og:description", "description") and not og_description:
            og_description = val
        elif prop in ("og:price:amount", "product:price:amount") and not og_price:
            og_price = val
        elif prop == "og:site_name" and not meta_site_name:
            meta_site_name = val.strip()

    # og:site_name beats domain derivation
    if meta_site_name:
        site_brokerage_name = meta_site_name

    # ── JSON-LD structured data ────────────────────────────────────────────
    jsonld_objects: list = []
    jsonld_text = ""
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        raw_html, re.IGNORECASE | re.DOTALL
    ):
        blob = m.group(1).strip()
        jsonld_text += " " + blob
        try:
            obj = json.loads(blob)
            if isinstance(obj, list):
                jsonld_objects.extend(obj)
            else:
                jsonld_objects.append(obj)
        except Exception:
            pass

    # ── Extract broker/agent info from JSON-LD ─────────────────────────────
    ld_seller_name = ld_seller_email = ld_seller_phone = None
    ld_brokerage_name = ld_brokerage_logo = ld_brokerage_website = None

    def _walk_ld(obj, depth=0):
        nonlocal ld_seller_name, ld_seller_email, ld_seller_phone
        nonlocal ld_brokerage_name, ld_brokerage_logo, ld_brokerage_website
        if depth > 5 or not isinstance(obj, dict):
            return
        t = obj.get("@type", "")
        if isinstance(t, list):
            t = " ".join(t)
        t = t.lower()
        is_person = "person" in t or "agent" in t or "broker" in t
        is_org = "organization" in t or "realestate" in t or "localbusiness" in t
        name = obj.get("name") or obj.get("legalName")
        email = obj.get("email")
        phone = obj.get("telephone") or obj.get("phone")
        logo = obj.get("logo")
        if isinstance(logo, dict):
            logo = logo.get("url") or logo.get("contentUrl")
        website = obj.get("url") or obj.get("sameAs")
        if isinstance(website, list):
            website = next((w for w in website if isinstance(w, str) and w.startswith("http")), None)
        if is_person and name and not ld_seller_name:
            ld_seller_name = name
        if email and not ld_seller_email:
            ld_seller_email = email
        if phone and not ld_seller_phone:
            ld_seller_phone = phone
        if is_org and name and not ld_brokerage_name:
            ld_brokerage_name = name
            ld_brokerage_logo = logo or ld_brokerage_logo
            ld_brokerage_website = website or ld_brokerage_website
        for v in obj.values():
            if isinstance(v, dict):
                _walk_ld(v, depth + 1)
            elif isinstance(v, list):
                for item in v:
                    _walk_ld(item, depth + 1)

    for ld_obj in jsonld_objects:
        _walk_ld(ld_obj)

    # ── Extract broker/contact from raw HTML patterns ──────────────────────
    html_seller_name = html_seller_email = html_seller_phone = None
    html_brokerage_logo = None

    # mailto: links
    email_m = re.search(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', raw_html, re.IGNORECASE)
    if email_m:
        html_seller_email = email_m.group(1)

    # tel: links
    tel_m = re.search(r'tel:([\+0-9\s\-\(\)\.]{7,20})', raw_html, re.IGNORECASE)
    if tel_m:
        html_seller_phone = tel_m.group(1).strip()

    # Agent/broker name patterns in plain text vicinity of "agent", "broker", "contact", "listed by"
    agent_block = re.search(
        r'(?:listed\s+by|listing\s+agent|contact|broker|agent|sales\s+rep)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
        raw_html, re.IGNORECASE
    )
    if agent_block:
        name_candidate = re.sub(r'<[^>]+>', '', agent_block.group(1)).strip()
        if 2 <= len(name_candidate.split()) <= 4:
            html_seller_name = name_candidate

    # Site logo — look for <img> near header/logo/brand with class or id containing "logo"
    logo_m = re.search(
        r'<img[^>]+(?:class|id)=["\'][^"\']*logo[^"\']*["\'][^>]*(?:src|data-src)=["\']([^"\']+)["\']|'
        r'<img[^>]+(?:src|data-src)=["\']([^"\']+)["\'][^>]*(?:class|id)=["\'][^"\']*logo[^"\']*["\']',
        raw_html, re.IGNORECASE | re.DOTALL
    )
    if logo_m:
        raw_logo = logo_m.group(1) or logo_m.group(2)
        if raw_logo:
            html_brokerage_logo = make_absolute(raw_logo)

    # ── Merge broker/brokerage: JSON-LD > HTML patterns > None ────────────
    final_seller_name     = ld_seller_name or html_seller_name
    final_seller_email    = ld_seller_email or html_seller_email
    final_seller_phone    = ld_seller_phone or html_seller_phone
    final_brokerage_name  = ld_brokerage_name or site_brokerage_name
    final_brokerage_logo  = ld_brokerage_logo or html_brokerage_logo
    final_brokerage_website = ld_brokerage_website or base_origin

    # ── Image extraction ───────────────────────────────────────────────────
    LOGO_SKIP = re.compile(
        r'logo|icon|avatar|sprite|\.gif$|tracking|pixel|1x1|blank|'
        r'/nav|/menu|/button|/bg[-_]|/background|/social|/share|/arrow|'
        r'/chevron|/star|/rating|/loading|/spinner|/close|/search|/badge|'
        r'/seal|/cert|/header|/footer|thumbnail.*\d{1,2}x\d{1,2}|'
        r'width=\d{1,2}&|_\d{1,2}x\d{1,2}\.',
        re.IGNORECASE
    )

    seen_urls: set = set()
    gallery_images: list = []   # highest priority — explicit gallery/lightbox refs
    regular_images: list = []   # fallback img src tags
    srcset_images: list = []    # srcset fallback

    def add_img(url_str: str, bucket: list):
        abs_u = make_absolute(url_str)
        if not abs_u or not is_image_url(abs_u):
            return
        # Normalise — strip query params for dedup but keep the full URL
        norm = re.sub(r'\?.*$', '', abs_u)
        if norm in seen_urls:
            return
        seen_urls.add(norm)
        bucket.append(abs_u)

    # Priority 0: OG image
    if og_image and is_image_url(og_image) and not LOGO_SKIP.search(og_image):
        add_img(og_image, gallery_images)

    # Priority 1: <a href="...jpg"> anchors — these are almost always full-size
    for a_m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>', raw_html, re.IGNORECASE):
        href = a_m.group(1).strip()
        if is_image_url(href) and not LOGO_SKIP.search(href):
            add_img(href, gallery_images)

    # Priority 2: data-fancybox / data-lightbox / data-photoswipe / data-gallery
    # href or data-src on the same element
    for attr_m in re.finditer(
        r'<(?:a|div|figure|li)[^>]+(?:data-fancybox|data-lightbox|data-photoswipe|data-gallery)[^>]*>',
        raw_html, re.IGNORECASE | re.DOTALL
    ):
        tag = attr_m.group(0)
        for attr in ["data-full", "data-zoom", "data-original", "data-src", "href", "src"]:
            vm = re.search(rf'\b{attr}=["\']([^"\']+)["\']', tag, re.IGNORECASE)
            if vm and is_image_url(vm.group(1)) and not LOGO_SKIP.search(vm.group(1)):
                add_img(vm.group(1), gallery_images)
                break

    # Priority 3: <img> tags with gallery-hinting class names or data attributes
    GALLERY_CLASS = re.compile(r'gallery|carousel|slider|photo|listing[-_]img|boat[-_]img|yacht[-_]img|main[-_]img|feature', re.IGNORECASE)
    for img_tag in re.finditer(r'<img[^>]+>', raw_html, re.IGNORECASE | re.DOTALL):
        tag = img_tag.group(0)

        # Check class for gallery hint
        class_m = re.search(r'\bclass=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        is_gallery_hint = bool(class_m and GALLERY_CLASS.search(class_m.group(1)))

        img_url = None
        for attr in ["data-original", "data-zoom-image", "data-full", "data-large",
                     "data-lazy-src", "data-src", "src"]:
            vm = re.search(rf'\b{attr}=["\']([^"\']*\.(?:jpg|jpeg|png|webp)[^"\']*)["\']', tag, re.IGNORECASE)
            if vm and vm.group(1) and not vm.group(1).startswith("data:"):
                img_url = vm.group(1).strip()
                break

        if not img_url or LOGO_SKIP.search(img_url):
            continue

        # Skip explicitly tiny declared dimensions
        w_m = re.search(r'\bwidth=["\']?(\d+)', tag, re.IGNORECASE)
        h_m = re.search(r'\bheight=["\']?(\d+)', tag, re.IGNORECASE)
        if w_m and int(w_m.group(1)) < 120:
            continue
        if h_m and int(h_m.group(1)) < 120:
            continue

        bucket = gallery_images if is_gallery_hint else regular_images
        add_img(img_url, bucket)

    # Priority 4: srcset — highest-res entry
    for srcset_m in re.finditer(r'srcset=["\']([^"\']+)["\']', raw_html, re.IGNORECASE):
        parts = [p.strip() for p in srcset_m.group(1).split(",") if p.strip()]
        if parts:
            best = parts[-1].split()[0]
            if not LOGO_SKIP.search(best):
                add_img(best, srcset_images)

    # Combine buckets (gallery first)
    all_images = (gallery_images + regular_images + srcset_images)[:20]
    images = [{"url": u, "is_primary": i == 0} for i, u in enumerate(all_images)]

    # ── Plain text for field extraction ───────────────────────────────────
    text = re.sub(r"<script[^>]*>.*?</script>", " ", raw_html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    for entity, char in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')]:
        text = text.replace(entity, char)
    text = re.sub(r"&#\d+;", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()

    if jsonld_text:
        text = jsonld_text + " " + text

    # ── Field extraction ───────────────────────────────────────────────────
    extracted = _claude_extract(text) or _fallback_parse(text)

    # Merge OG/meta hints for missing fields
    if og_price and not extracted.get("price"):
        extracted["price"] = _to_float(re.sub(r"[^\d.]", "", og_price))
    if og_title and not extracted.get("title"):
        extracted["title"] = og_title
    if og_description and not extracted.get("description"):
        extracted["description"] = og_description

    # Merge broker/brokerage (only fill if not already extracted by Claude)
    if not extracted.get("seller_name"):
        extracted["seller_name"] = final_seller_name
    if not extracted.get("seller_email"):
        extracted["seller_email"] = final_seller_email
    if not extracted.get("seller_phone"):
        extracted["seller_phone"] = final_seller_phone
    if not extracted.get("brokerage_name"):
        extracted["brokerage_name"] = final_brokerage_name
    if not extracted.get("brokerage_logo_url"):
        extracted["brokerage_logo_url"] = final_brokerage_logo
    if not extracted.get("brokerage_website"):
        extracted["brokerage_website"] = final_brokerage_website

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
description (first 2000 chars of main description text),
seller_name (individual broker/agent full name, or null),
seller_email (broker contact email, or null),
seller_phone (broker contact phone, or null),
brokerage_name (company/brokerage name, or null),
brokerage_website (brokerage website URL, or null).
"""
    try:
        response = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-3-5-sonnet-20241022", "max_tokens": 4096,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=40,
        )
        if not response.ok:
            import sys
            print(f"[preview scraper] Claude API error {response.status_code}: {response.text[:300]}", file=sys.stderr)
            return None
        content = response.json().get("content", [])
        if not content:
            return None
        blob = re.sub(r"^```json\s*|\s*```$", "", content[0].get("text", "").strip())
        parsed = json.loads(blob)
        return parsed if isinstance(parsed, dict) else None
    except Exception as exc:
        import sys
        print(f"[preview scraper] _claude_extract exception: {exc}", file=sys.stderr)
        return None
