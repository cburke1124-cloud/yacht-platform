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

# curl-cffi: Chrome TLS impersonation for Cloudflare-protected sites.
# CF Bot Management detects Python requests by its TLS ClientHello (JA3 fingerprint) and
# sends TCP RST during the TLS handshake — before any HTTP data is exchanged.
# curl-cffi uses libcurl built with Chrome's BoringSSL cipher/extension order, passing CF.
try:
    from curl_cffi.requests import Session as _PreviewCurlCffiSession
    _PREVIEW_CURL_CFFI_AVAILABLE = True
except ImportError:
    _PreviewCurlCffiSession = None
    _PREVIEW_CURL_CFFI_AVAILABLE = False

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

    # ── Parse URL params up front — needed for WP REST pre-fetch and embedded JS ─
    from urllib.parse import urlparse, urljoin, parse_qs
    parsed_url = urlparse(url)
    qs_params = parse_qs(parsed_url.query)
    base_origin = f"{parsed_url.scheme}://{parsed_url.netloc}"
    hostname = parsed_url.netloc.lower().removeprefix("www.")
    listing_id_from_qs = None
    for _k in ('id', 'boat_id', 'listing_id', 'yacht_id', 'vessel_id'):
        if _k in qs_params:
            listing_id_from_qs = qs_params[_k][0]
            break

    # ── For ?id= sites: try WP REST API FIRST ───────────────────────────────
    # JSON API endpoints bypass Cloudflare HTML challenges. This is the primary
    # data source for JS-rendered / CF-protected broker sites (e.g. yachtsvancouver.com).
    # Must happen BEFORE the HTML fetch so data is available when HTML is blocked.
    #
    # IMPORTANT: The ?id= URL parameter is a CUSTOM/EXTERNAL listing ID (e.g. from
    # a boat-listing plugin), NOT the WP post ID. We cannot use it directly with
    # /wp-json/wp/v2/{type}/{id}. Instead we must scan the WP REST listing index to
    # find the item whose 'link' matches our URL, then use its WP post ID.
    wp_api_json = None
    _api_hdrs = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    if listing_id_from_qs:
        for _post_type in ('listings', 'boats', 'yachts', 'vessels', 'motorboats', 'sailboats'):
            if wp_api_json:
                break
            try:
                # Step 1: find WP post ID by matching our URL against the listing index
                _idx = http_requests.get(
                    f"{base_origin}/wp-json/wp/v2/{_post_type}",
                    params={"per_page": 100, "page": 1, "_fields": "id,link"},
                    headers=_api_hdrs, timeout=10,
                )
                if not _idx.ok:
                    continue
                _items = _idx.json()
                if not isinstance(_items, list):
                    continue
                _wp_post_id = None
                _norm_url = url.rstrip('/')
                for _item in _items:
                    if isinstance(_item, dict) and _item.get('link', '').rstrip('/') == _norm_url:
                        _wp_post_id = _item.get('id')
                        break
                if not _wp_post_id:
                    continue
                # Step 2: fetch full listing content by WP post ID
                _ar = http_requests.get(
                    f"{base_origin}/wp-json/wp/v2/{_post_type}/{_wp_post_id}",
                    params={"_embed": "1"},
                    headers=_api_hdrs, timeout=10,
                )
                if _ar.ok and 'json' in _ar.headers.get('content-type', ''):
                    wp_api_json = _ar.json()
            except Exception:
                pass

    # ── Fetch page HTML ────────────────────────────────────────────────
    # curl-cffi impersonates Chrome's TLS fingerprint (JA3) so Cloudflare's bot
    # detection passes the handshake. Python requests uses OpenSSL which has a
    # different ClientHello signature and gets TCP RST from CF before sending HTTP.
    _html_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    raw_html = ""
    try:
        if _PREVIEW_CURL_CFFI_AVAILABLE:
            with _PreviewCurlCffiSession(impersonate="chrome124") as _cs:
                resp = _cs.get(url, timeout=20, allow_redirects=True)
        else:
            resp = http_requests.get(url, timeout=20, headers=_html_headers, allow_redirects=True)
        resp.raise_for_status()
        raw_html = resp.text
    except Exception as exc:
        if not wp_api_json:
            raise HTTPException(status_code=400, detail=f"Could not fetch URL: {exc}")
        # WP REST succeeded — continue without HTML

    # ── Sold listing detection — bail early and auto-remove from DB ───────
    if raw_html:
        _SOLD_TITLE_RE = re.compile(r'\b(?:sold|under\s+contract|sale\s+pending)\b', re.IGNORECASE)
        _SOLD_BADGE_RE = re.compile(
            r'class=["\'][^"\']*\bsold\b[^"\']*["\']|'
            r'(?:data-status|data-condition)\s*=\s*["\']sold["\']',
            re.IGNORECASE
        )
        _ptitle_m = re.search(r'<title[^>]*>([^<]+)</title>', raw_html[:3000], re.IGNORECASE)
        _ptitle = _ptitle_m.group(1) if _ptitle_m else ""
    if raw_html and (_SOLD_TITLE_RE.search(_ptitle) or _SOLD_BADGE_RE.search(raw_html[:20000])):
        existing_sold = db.query(PreviewListing).filter(
            PreviewListing.source_url == url
        ).first()
        if existing_sold:
            db.delete(existing_sold)
            db.commit()
        raise HTTPException(
            status_code=422,
            detail=(
                "This listing has been sold and was removed from your preview listings."
                if existing_sold else
                "This listing appears to be sold and is no longer available."
            ),
        )

    # ── Extract embedded JS data objects from script tags (JS-heavy / PHP-hydrated sites)
    # Uses a brace-counter to handle deeply nested structures reliably.
    embedded_json_blobs: list = []
    for script_m in re.finditer(
        r'<script(?![^>]*type=["\']text/css)[^>]*>(.*?)</script>',
        raw_html, re.DOTALL | re.IGNORECASE
    ):
        script_text = script_m.group(1).strip()
        if 'application/ld+json' in script_m.group(0) or len(script_text) < 50:
            continue
        # Find variable/property assignments whose RHS starts with { or [
        for assign_m in re.finditer(
            r'(?:window\.[\w.]+|(?:var|let|const)\s+\w+)\s*=\s*(?=[{\[])',
            script_text,
        ):
            start = assign_m.end()
            if start >= len(script_text):
                continue
            opener = script_text[start]
            closer = '}' if opener == '{' else ']'
            depth, i, in_str, str_char = 0, start, False, ''
            while i < min(start + 60000, len(script_text)):
                c = script_text[i]
                if in_str:
                    if c == '\\':
                        i += 2
                        continue
                    if c == str_char:
                        in_str = False
                elif c in ('"', "'", '`'):
                    in_str, str_char = True, c
                elif c == opener:
                    depth += 1
                elif c == closer:
                    depth -= 1
                    if depth == 0:
                        try:
                            obj = json.loads(script_text[start : i + 1])
                            if isinstance(obj, (dict, list)) and (
                                isinstance(obj, list) or len(obj) >= 3
                            ):
                                embedded_json_blobs.append(obj)
                        except Exception:
                            pass
                        break
                i += 1
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

    # Broker/agent profile photo — look for <img> near agent/broker contact sections
    html_seller_photo = None
    # Find a broker card block first, then grab the nearest img inside it
    broker_card_m = re.search(
        r'(?:<div|<section|<article)[^>]+(?:class|id)=["\'][^"\']*'
        r'(?:broker|agent|listing-agent|contact|team|staff|salesman|advisor)[^"\']*["\']'
        r'(.*?)</(?:div|section|article)>',
        raw_html, re.IGNORECASE | re.DOTALL
    )
    if broker_card_m:
        card_html = broker_card_m.group(1)
        photo_m = re.search(
            r'<img[^>]+(?:src|data-src)=["\']([^"\']+\.(?:jpg|jpeg|png|webp)(?:\?[^"\']*)?)["\']',
            card_html, re.IGNORECASE
        )
        if photo_m:
            candidate = make_absolute(photo_m.group(1))
            if candidate and not LOGO_SKIP.search(photo_m.group(1)):
                html_seller_photo = candidate
    # Fallback: look for img tags with class/id containing photo/headshot/agent/broker
    if not html_seller_photo:
        photo_tag_m = re.search(
            r'<img[^>]+(?:class|id)=["\'][^"\']*(?:headshot|portrait|agent[-_]photo|broker[-_]photo|staff[-_]photo|team[-_]photo|profile[-_]pic|profile[-_]photo)[^"\']*["\'][^>]*(?:src|data-src)=["\']([^"\']+)["\']|'
            r'<img[^>]+(?:src|data-src)=["\']([^"\']+)["\'][^>]*(?:class|id)=["\'][^"\']*(?:headshot|portrait|agent[-_]photo|broker[-_]photo|profile[-_]photo)[^"\']*["\']',
            raw_html, re.IGNORECASE | re.DOTALL
        )
        if photo_tag_m:
            raw_photo = photo_tag_m.group(1) or photo_tag_m.group(2)
            if raw_photo:
                html_seller_photo = make_absolute(raw_photo)

    # ── Merge broker/brokerage: JSON-LD > HTML patterns > None ────────────
    final_seller_name     = ld_seller_name or html_seller_name
    final_seller_email    = ld_seller_email or html_seller_email
    final_seller_phone    = ld_seller_phone or html_seller_phone
    final_brokerage_name  = ld_brokerage_name or site_brokerage_name
    final_brokerage_logo  = ld_brokerage_logo or html_brokerage_logo
    final_brokerage_website = ld_brokerage_website or base_origin
    final_seller_photo    = html_seller_photo

    # ── Image extraction ───────────────────────────────────────────────────
    LOGO_SKIP = re.compile(
        r'logo|icon|avatar|sprite|\.gif$|tracking|pixel|1x1|blank|'
        r'/nav|/menu|/button|/bg[-_]|/background|/social|/share|/arrow|'
        r'/chevron|/star|/rating|/loading|/spinner|/close|/search|/badge|'
        r'/seal|/cert|/header|/footer|thumbnail.*\d{1,2}x\d{1,2}|'
        r'width=\d{1,2}&|_\d{1,2}x\d{1,2}\.|'
        # UI chrome element filenames
        r'x-out|xout|-close|-out\b|close-|btn[-_]|[-_]btn|'
        r'hamburger|placeholder|no-image|no_image|default-image|'
        r'play-btn|pause-btn|next-btn|prev-btn|arrow-|caret-|'
        # Path-based UI suppression
        r'/assets/images/[a-z_-]+\.(png|gif)$|'
        r'/ui/|/icons?/|/buttons?/',
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

    # Priority -1: Images from embedded JS blobs and WP REST rendered HTML
    def _scan_blob_images(node, bucket):
        if isinstance(node, dict):
            for key in ('images', 'photos', 'gallery', 'media', 'pictures',
                        'slideshow', 'attachments', 'slides'):
                val = node.get(key)
                if not val:
                    continue
                items = val if isinstance(val, list) else [val]
                for item in items:
                    if isinstance(item, str) and not LOGO_SKIP.search(item):
                        add_img(item, bucket)
                    elif isinstance(item, dict):
                        for sk in ('url', 'src', 'full', 'large', 'original',
                                   'path', 'link', 'image_url', 'photo_url', 'source_url'):
                            v = item.get(sk)
                            if v and isinstance(v, str) and not LOGO_SKIP.search(v):
                                add_img(v, bucket)
                                break
        elif isinstance(node, list):
            for item in node:
                _scan_blob_images(item, bucket)

    for blob in embedded_json_blobs:
        _scan_blob_images(blob, gallery_images)

    if wp_api_json:
        _wp_rendered = (wp_api_json.get("content") or {}).get("rendered") or ""
        if _wp_rendered:
            for _wm in re.finditer(
                r'<(?:img|a)[^>]+(?:src|href)=["\']([^"\']+\.(?:jpg|jpeg|png|webp)(?:\?[^"\']*)?)["\']',
                _wp_rendered, re.IGNORECASE,
            ):
                if not LOGO_SKIP.search(_wm.group(1)):
                    add_img(make_absolute(_wm.group(1)), gallery_images)

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
    clean_text = re.sub(r"<script[^>]*>.*?</script>", " ", raw_html, flags=re.DOTALL | re.IGNORECASE)
    clean_text = re.sub(r"<style[^>]*>.*?</style>", " ", clean_text, flags=re.DOTALL | re.IGNORECASE)
    clean_text = re.sub(r"<[^>]+>", " ", clean_text)
    for entity, char in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')]:
        clean_text = clean_text.replace(entity, char)
    clean_text = re.sub(r"&#\d+;", " ", clean_text)
    clean_text = re.sub(r"\s{2,}", " ", clean_text).strip()

    # Supplement with embedded JS data and WP REST JSON for JS-heavy sites
    extra_context = ""
    for blob in embedded_json_blobs:
        try:
            extra_context += " " + json.dumps(blob)[:2000]
        except Exception:
            pass
    if wp_api_json:
        # WP REST: extract rendered content
        rendered = wp_api_json.get("content", {}).get("rendered", "") or wp_api_json.get("excerpt", {}).get("rendered", "")
        if rendered:
            rendered_clean = re.sub(r"<[^>]+>", " ", rendered)
            extra_context += " " + rendered_clean[:3000]
        extra_context += " " + json.dumps({k: v for k, v in wp_api_json.items() if k not in ('content', 'excerpt', '_links')})[:3000]

    # Give Claude the structured JSON-LD as context first, then the page text.
    # But keep clean_text separate so _fallback_parse never sees raw JSON blobs.
    claude_text = ((jsonld_text + "\n") if jsonld_text else "") + (extra_context + "\n" if extra_context else "") + "PAGE TEXT:\n" + clean_text

    # ── Field extraction ───────────────────────────────────────────────────
    extracted = _claude_extract(claude_text) or _fallback_parse(clean_text)

    # ── Sanitize: discard fields that came back as raw JSON / nav text ─────
    def _looks_like_json(v: str) -> bool:
        return bool(v and re.match(r'^\s*[\{\[]', v.strip()))
    def _looks_like_nav(v: str) -> bool:
        return bool(v and re.search(r'→|-->|Search By|For Sale|Yachts For Sale|Search Used', v))
    if _looks_like_json(extracted.get("title", "") or "") or _looks_like_nav(extracted.get("title", "") or ""):
        extracted["title"] = og_title
    if _looks_like_json(extracted.get("description", "") or "") or _looks_like_nav(extracted.get("description", "") or ""):
        extracted["description"] = og_description
    # City/state shouldn't be long sentences (nav text contamination)
    if extracted.get("city") and (len(extracted["city"]) > 60 or re.search(r'search|browse|filter|sale|price', extracted["city"], re.IGNORECASE)):
        extracted["city"] = None
    if extracted.get("state") and len(extracted["state"]) > 30:
        extracted["state"] = None

    # Merge OG/meta hints for missing fields
    if og_price and not extracted.get("price"):
        _og_val, _og_cur = _detect_currency(og_price + " " + clean_text[:500])
        extracted["price"] = _og_val or _to_float(re.sub(r"[^\d.]", "", og_price))
        if not extracted.get("currency") and _og_cur:
            extracted["currency"] = _og_cur
    # Ensure currency is always set — scan page text if not already detected
    if not extracted.get("currency"):
        _, _page_cur = _detect_currency(clean_text[:5000])
        extracted["currency"] = _page_cur  # defaults to "USD"
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

    # Store broker photo + logo in additional_specs so frontend can populate those fields
    additional = dict(extracted.get("additional_specs") or {})
    if final_seller_photo and not additional.get("seller_photo_url"):
        additional["seller_photo_url"] = final_seller_photo
    if final_brokerage_logo and not additional.get("brokerage_logo_url"):
        additional["brokerage_logo_url"] = final_brokerage_logo
    extracted["additional_specs"] = additional

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


def _detect_currency(text: str):
    """Scan text for currency indicators; return (price_float_or_None, iso_code_str)."""
    _cur_patterns = [
        (r'(?:CAD|C\$|CA\$|CDN)\s*\$?\s*([\d,]+(?:\.\d+)?)', "CAD"),
        (r'([\d,]+(?:\.\d+)?)\s*(?:CAD|CDN)\b', "CAD"),
        (r'(?:AUD|AU\$|A\$)\s*([\d,]+(?:\.\d+)?)', "AUD"),
        (r'([\d,]+(?:\.\d+)?)\s*AUD\b', "AUD"),
        (r'(?:NZD|NZ\$)\s*([\d,]+(?:\.\d+)?)', "NZD"),
        (r'([\d,]+(?:\.\d+)?)\s*NZD\b', "NZD"),
        (r'\u20ac\s*([\d,]+(?:\.\d+)?)', "EUR"),
        (r'([\d,]+(?:\.\d+)?)\s*\u20ac', "EUR"),
        (r'\bEUR\s+([\d,]+(?:\.\d+)?)', "EUR"),
        (r'\u00a3\s*([\d,]+(?:\.\d+)?)', "GBP"),
        (r'\bGBP\s+([\d,]+(?:\.\d+)?)', "GBP"),
        (r'(?:USD|US\$)\s*([\d,]+(?:\.\d+)?)', "USD"),
        (r'(?:asking\s*price|price|list\s*price)\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d+)?)', "USD"),
        (r'\$\s*([\d,]+(?:\.\d+)?)', "USD"),
        (r'(?:asking\s*price|price|list\s*price)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)', "USD"),
    ]
    for pat, cur in _cur_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            val = _to_float(re.sub(r"[^\d.]", "", m.group(1)))
            if val and val > 100:
                return val, cur
    return None, "USD"


def _fallback_parse(text: str) -> dict:
    lines = [l.strip() for l in text.replace("\r", "").split("\n") if l.strip()]
    # Prefer year that appears near a label; avoid copyright noise
    year = _first([
        r'(?:year|built|model\s+year)\s*[:\-]?\s*(19[5-9]\d|20[0-2]\d)',
        r'\b(19[5-9]\d|20[0-2]\d)\b(?!\s*(?:united|yachts|sales|©|copyright))',
    ], text)
    price, currency = _detect_currency(text[:8000])
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

    # ── Description: find the first substantial paragraph that isn't nav ──
    # Nav text hallmarks: contains "→", "-->", " | ", or is a list of short link items
    NAV_RE = re.compile(
        r'→|-->|Search By|For Sale|Boat Show|Contact Us|Privacy Policy|'
        r'Sitemap|Terms|Accessibility|Broker Portal|Finance A Boat|'
        r'Why List|What\'s My Boat Worth',
        re.IGNORECASE
    )
    description = None
    # Split on double-space chunks (post-HTML-strip paragraphs)
    chunks = re.split(r'\s{3,}', text)
    for chunk in chunks:
        chunk = chunk.strip()
        # Skip short chunks and nav-contaminated ones
        if len(chunk) < 120:
            continue
        if NAV_RE.search(chunk):
            continue
        # Must read like prose: has multiple words and a period/comma
        if not re.search(r'\w{4,}.*[.,]\s+\w', chunk):
            continue
        description = chunk[:3000]
        break
    # Absolute fallback: just anything long enough that's not pure nav
    if not description:
        for chunk in chunks:
            chunk = chunk.strip()
            if len(chunk) > 80 and not re.search(r'cookie|privacy|©|sitemap', chunk, re.IGNORECASE):
                description = chunk[:3000]
                break

    # ── Title: first line that looks like a yacht name, not nav/json ──────
    NAV_TITLE_RE = re.compile(r'→|-->|Search|Browse|Filter|Menu|Login|Sign', re.IGNORECASE)
    title = None
    for line in lines:
        if len(line) > 5 and not line.startswith("{") and not line.startswith("[") and not NAV_TITLE_RE.search(line):
            title = line[:200]
            break

    return {
        "title": title,
        "make": make, "year": _to_int(year), "price": price, "currency": currency,
        "length_feet": _to_float(length), "beam_feet": _to_float(beam),
        "cabins": _to_int(cabins), "berths": _to_int(berths), "heads": _to_int(heads),
        "fuel_capacity_gallons": _to_float(fuel_cap),
        "water_capacity_gallons": _to_float(water_cap),
        "city": city, "state": state, "country": country,
        "description": description,
        "feature_bullets": bullets[:8] if bullets else [],
    }


def _claude_extract(text: str):
    import sys
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not api_key:
        print("[preview scraper] No API key found", file=sys.stderr)
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
description (the main listing description text only, NOT navigation menus or breadcrumbs),
seller_name (individual broker/agent full name, or null),
seller_email (broker contact email, or null),
seller_phone (broker contact phone, or null),
brokerage_name (company/brokerage name, or null),
brokerage_website (brokerage website URL, or null),
currency (ISO-4217 code detected from price context — "USD", "CAD", "EUR", "GBP", "AUD", "NZD" — default "USD").
"""
    try:
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        blob = re.sub(r"^```json\s*|\s*```$", "", message.content[0].text.strip())
        parsed = json.loads(blob)
        return parsed if isinstance(parsed, dict) else None
    except Exception as exc:
        print(f"[preview scraper] _claude_extract exception: {exc}", file=sys.stderr)
        return None
