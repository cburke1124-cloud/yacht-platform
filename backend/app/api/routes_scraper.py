"""
Scraper management routes.

Broker-facing endpoints (require dealer/salesman auth):
  POST /scraper/dealer/preview       — validate URL + scrape single listing (no DB write)
  POST /scraper/dealer/import        — validate URL + scrape + save as draft listing

Admin-only endpoints:
  POST /scraper/parse-text           — extract fields from raw text (any auth)
  POST /scraper/single               — test-scrape a single listing URL (admin)
  POST /scraper/broker               — discover listing URLs on an inventory page (admin)
  GET  /scraper/jobs                 — list all ScraperJob records
  POST /scraper/jobs                 — create a new ScraperJob
  PUT  /scraper/jobs/{id}            — update a ScraperJob
  DELETE /scraper/jobs/{id}          — delete a ScraperJob
  POST /scraper/jobs/{id}/run        — trigger an immediate sync run
  POST /scraper/jobs/{id}/toggle     — enable / disable a job
  GET  /scraper/jobs/{id}/listings   — list ScrapedListings for a job
"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any, List, Dict
from urllib.parse import urlparse
import os
import re
import json
import logging
import threading
from datetime import datetime as _dt

import requests

from app.db.session import get_db


# ---------------------------------------------------------------------------
# Lightweight log capture — collects scraper log lines during a test request
# ---------------------------------------------------------------------------
_CAPTURE_LOGGERS = ("app.services.scraper", "urllib3.connectionpool")

class _LogCapture(logging.Handler):
    """Thread-local log capture for test endpoints."""
    def __init__(self):
        super().__init__(level=logging.DEBUG)
        self.lines: list = []
        self.setFormatter(logging.Formatter("%(message)s"))

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self.lines.append({
                "t": _dt.utcnow().strftime("%H:%M:%S.%f")[:-3],
                "level": record.levelname,
                "logger": record.name.split(".")[-1],
                "msg": self.format(record),
            })
        except Exception:
            pass

    def __enter__(self):
        for name in _CAPTURE_LOGGERS:
            logging.getLogger(name).addHandler(self)
        return self

    def __exit__(self, *_):
        for name in _CAPTURE_LOGGERS:
            logging.getLogger(name).removeHandler(self)
from app.api.deps import get_current_user
from app.models.user import User
from app.models.listing import Listing, ListingImage
from app.models.misc import ScraperJob, ScrapedListing
from app.exceptions import AuthorizationException, ValidationException

router = APIRouter()


# -----------------------------------------------------------------------
# PYDANTIC SCHEMAS
# -----------------------------------------------------------------------

class ParseTextRequest(BaseModel):
    text: str
    user_id: Optional[int] = None


class SingleScrapeRequest(BaseModel):
    url: str


class BrokerScrapeRequest(BaseModel):
    url: str
    preview_count: int = 3  # how many individual listings to test-scrape


class CreateJobRequest(BaseModel):
    dealer_id: int
    salesman_id: Optional[int] = None
    site_name: Optional[str] = None
    broker_url: str
    schedule_hours: int = 24
    notes: Optional[str] = None
    enabled: bool = True


class UpdateJobRequest(BaseModel):
    dealer_id: Optional[int] = None
    salesman_id: Optional[int] = None
    site_name: Optional[str] = None
    broker_url: Optional[str] = None
    schedule_hours: Optional[int] = None
    notes: Optional[str] = None
    enabled: Optional[bool] = None


class ImportSingleRequest(BaseModel):
    url: str
    dealer_id: int
    salesman_id: Optional[int] = None


# -----------------------------------------------------------------------
# HELPERS (kept from original parse-text implementation)
# -----------------------------------------------------------------------

def _to_float(value) -> Optional[float]:
    if not value:
        return None
    cleaned = str(value).replace(",", "").strip()
    try:
        return float(cleaned)
    except Exception:
        return None


def _to_int(value) -> Optional[int]:
    number = _to_float(value)
    return int(number) if number is not None else None


def _first(patterns: list, text: str, flags: int = re.IGNORECASE) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match and match.group(1):
            return match.group(1).strip()
    return None


def _fallback_parse(text: str) -> dict:
    lines = [line.strip() for line in text.replace("\r", "").split("\n") if line.strip()]
    year = _first([r"\b(19\d{2}|20\d{2})\b"], text)
    title = lines[0] if lines else None
    price = _first([
        r"price\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d+)?)",
        r"\$\s*([\d,]+(?:\.\d+)?)",
    ], text)
    make = _first([
        r"\b(Azimut|Beneteau|Bertram|Boston\s*Whaler|Cabo|Carver|Chris\-Craft|Ferretti|Formula|"
        r"Hatteras|Jeanneau|Leopard|Meridian|Monterey|Monte\s*Carlo|Nordhavn|Pershing|Princess|"
        r"Regal|Riva|Sanlorenzo|Sea\s*Ray|Sunseeker|Tiara|Viking|Yamaha|Yellowfin)\b"
    ], text)
    model = _first([r"model\s*[:\-]?\s*([^\n]+)"], text)
    length = _first([r"(?:loa|length(?:\s+overall)?)\s*[:\-]?\s*([\d.]+)", r"\b([\d.]+)\s*(?:ft|feet|')"], text)
    beam = _first([r"beam\s*[:\-]?\s*([\d.]+)"], text)
    draft = _first([r"draft(?:\s*(?:max|min)?)?\s*[:\-]?\s*([\d.]+)"], text)
    cabins = _first([r"cabins?\s*[:\-]?\s*(\d+)"], text)
    berths = _first([r"(?:berths?|sleeps?|guests?)\s*[:\-]?\s*(\d+)"], text)
    heads = _first([r"heads?\s*[:\-]?\s*(\d+)"], text)
    max_speed = _first([r"max\s*speed\s*[:\-]?\s*([\d.]+)"], text)
    cruise_speed = _first([r"cruis(?:e|ing)\s*speed\s*[:\-]?\s*([\d.]+)"], text)
    fuel_capacity = _first([r"fuel\s*(?:tank|capacity)?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)"], text)
    water_capacity = _first([r"(?:fresh\s*water|water\s*tank|water\s*capacity)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)"], text)
    hull_material = _first([r"hull\s*material\s*[:\-]?\s*([^\n]+)"], text)
    hull_type = _first([r"hull\s*(?:shape|type)\s*[:\-]?\s*([^\n]+)"], text)
    fuel_type = _first([r"fuel\s*type\s*[:\-]?\s*([^\n]+)"], text)
    city_state = _first([r"located\s+in\s+([^\n]+)"], text)
    city = state = country = None
    if city_state:
        parts = [p.strip() for p in city_state.split(",") if p.strip()]
        if len(parts) >= 1:
            city = parts[0]
        if len(parts) >= 2:
            state = parts[1]
        if len(parts) >= 3:
            country = parts[2]
    engine_count = None
    engine_headers = re.findall(r"engine\s*\d+", text, flags=re.IGNORECASE)
    if engine_headers:
        engine_count = len(engine_headers)
    elif re.search(r"\bquad\b", text, re.IGNORECASE):
        engine_count = 4
    elif re.search(r"\btriple\b", text, re.IGNORECASE):
        engine_count = 3
    elif re.search(r"\btwin\b", text, re.IGNORECASE):
        engine_count = 2
    elif re.search(r"\bsingle\b", text, re.IGNORECASE):
        engine_count = 1
    bullets = [re.sub(r"^[-•*]\s+", "", line).strip() for line in lines if re.match(r"^[-•*]\s+", line)]
    return {
        "title": title, "description": text, "price": _to_float(price),
        "year": _to_int(year), "make": make, "model": model,
        "length_feet": _to_float(length), "beam_feet": _to_float(beam), "draft_feet": _to_float(draft),
        "cabins": _to_int(cabins), "berths": _to_int(berths), "heads": _to_int(heads),
        "max_speed_knots": _to_float(max_speed), "cruising_speed_knots": _to_float(cruise_speed),
        "fuel_capacity_gallons": _to_float(fuel_capacity), "water_capacity_gallons": _to_float(water_capacity),
        "hull_material": hull_material, "hull_type": hull_type, "fuel_type": fuel_type,
        "engine_count": engine_count, "city": city, "state": state, "country": country,
        "feature_bullets": bullets[:8] if bullets else None, "features": text,
    }


def _claude_extract_if_available(text: str) -> Optional[dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return None
    prompt = f"""Extract yacht listing fields from the text below and return a single JSON object — no markdown, no explanation, only raw JSON.

Text:
{text[:12000]}

Return exactly these fields in this order (use null for unknowns):
- title (string)
- make (string)
- model (string)
- year (integer)
- price (number, no currency symbol)
- length_feet (number)
- beam_feet (number)
- draft_feet (number)
- cabins (integer)
- berths (integer)
- heads (integer)
- engine_count (integer — total number of main propulsion engines)
- engine_hours (number — hours on primary engine, if stated)
- fuel_type ("Diesel" | "Gasoline" | "Electric" | "Hybrid" | null)
- fuel_capacity_gallons (number)
- water_capacity_gallons (number)
- max_speed_knots (number)
- cruising_speed_knots (number)
- city (string — marina city or town; if only marina name given use nearest city)
- state (string — FIRST-LEVEL administrative region in English: for Spain use autonomous community e.g. "Andalusia" NOT province "Málaga"; for France use region e.g. "Provence-Alpes-Côte d'Azur"; for Italy use region e.g. "Liguria"; for US use state abbreviation e.g. "FL"; for Canada use province e.g. "British Columbia")
- country (string — full country name in English e.g. "Spain", "France", "United States")
- boat_type — MUST be one of exactly: "Motor Yacht", "Sailing Yacht", "Catamaran", "Center Console", "Sport Fisher", "Trawler", "Express Cruiser", "Mega Yacht", "Pontoon", "Bowrider", "Cuddy Cabin", "Walkaround", "Convertible", "Pilothouse", or null
- hull_material — MUST be one of exactly: "Fiberglass", "Aluminum", "Steel", "Wood", "Composite", "Carbon Fiber", "Ferro-Cement", or null
- hull_type — the hull SHAPE, MUST be one of exactly: "Monohull", "Catamaran", "Trimaran", "Planing", "Displacement", "Semi-Displacement", or null
- additional_engines: array of objects describing ALL main propulsion engines (one entry per engine, so twin engines = 2 entries, triple = 3, etc.). Each object: {"make": string|null, "model": string|null, "type": string|null, "horsepower": number|null, "hours": number|null, "notes": string|null}. Empty array [] only if truly no engine info at all.
- generators: array of generator objects found in the listing. Each: {{"brand": string|null, "model": string|null, "kw": number|null, "hours": number|null, "notes": string|null}}. Empty array [] if none.
- feature_bullets (array of up to 6 short feature strings, each under 80 chars)

Do NOT include a "description" or "features" field — those are handled separately.

For boat_type: infer from context — e.g. "triple Yamaha outboards" + fishing mentions = "Sport Fisher"; trawler mentions = "Trawler"; sailing/sloop/ketch = "Sailing Yacht"; catamaran = "Catamaran".
For hull_material: most production boats are Fiberglass unless text says otherwise.
For hull_type: Catamaran if catamaran, Displacement if slow trawler/sailboat, Planing if fast powerboat, Monohull if monohull sailboat, else null."""
    try:
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        text_blob = re.sub(r"^```json\s*|\s*```$", "", message.content[0].text.strip())
        parsed = json.loads(text_blob)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _require_admin(current_user: User):
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")


# -----------------------------------------------------------------------
# DOMAIN VALIDATION — broker-facing scraper safety controls
# -----------------------------------------------------------------------

# Yacht marketplace/aggregator domains brokers must NOT scrape from.
# Brokers may only pull from their own registered website.
MARKETPLACE_BLACKLIST = frozenset({
    "yachtworld.com",
    "yachtbuyer.com",
    "yachtr.com",
    "boattrader.com",
    "boats.com",
    "rightboat.com",
    "apolloduck.com",
    "ybw.com",
    "yachtcloud.com",
    "boatshop24.com",
    "theyachtmarket.com",
    "globalyachtbroker.com",
    "iboats.com",
    "yachting24.com",
})


def _extract_hostname(url: str) -> str:
    """Return the lowercase hostname with no www. prefix."""
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    host = urlparse(url).netloc.split(":")[0].lower().strip()
    if host.startswith("www."):
        host = host[4:]
    return host


def _validate_dealer_scrape_url(url: str, dealer_website: str) -> None:
    """
    Raise HTTPException if the URL is not safe for this broker to scrape:
    - Must be http/https
    - Domain must not be in MARKETPLACE_BLACKLIST
    - Domain must match or be a subdomain of the dealer's registered website
    """
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="URL is required")
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must begin with http:// or https://")

    url_host = _extract_hostname(url)
    if not url_host:
        raise HTTPException(status_code=400, detail="Could not parse a hostname from the URL")

    # Blacklist check
    for blocked in MARKETPLACE_BLACKLIST:
        if url_host == blocked or url_host.endswith("." + blocked):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Scraping is not permitted from marketplace sites ({blocked}). "
                    "Please only import listings from your own brokerage website."
                ),
            )

    # Website match check
    dealer_host = _extract_hostname(dealer_website)
    if not dealer_host:
        raise HTTPException(
            status_code=400,
            detail=(
                "Your dealer profile does not have a valid website on file. "
                "Please update your Dealer Profile before using the scraper."
            ),
        )

    if url_host != dealer_host and not url_host.endswith("." + dealer_host):
        raise HTTPException(
            status_code=403,
            detail=(
                f"The URL domain '{url_host}' does not match your registered website "
                f"'{dealer_host}'. You may only import listings from your own website."
            ),
        )


# -----------------------------------------------------------------------
# DEALER-FACING: preview + import a single listing from their own website
# -----------------------------------------------------------------------

class DealerScrapeRequest(BaseModel):
    url: str


def _get_dealer_profile(current_user: User, db: Session):
    """Return (dealer_id, DealerProfile) for the current broker/salesman."""
    from app.models.dealer import DealerProfile

    if current_user.user_type == "dealer":
        dealer_id = current_user.id
    elif current_user.user_type in ("salesman", "team_member"):
        dealer_id = current_user.parent_dealer_id
        if not dealer_id:
            raise HTTPException(status_code=400, detail="No broker account associated with this account")
    else:
        raise AuthorizationException("Broker account required")

    dp = db.query(DealerProfile).filter(DealerProfile.user_id == dealer_id).first()
    if not dp or not dp.website:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please add your brokerage website to your Dealer Profile before "
                "using the listing scraper."
            ),
        )
    return dealer_id, dp


@router.post("/scraper/dealer/preview")
def dealer_preview_listing(
    data: DealerScrapeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate a listing URL against the broker's registered website,
    scrape it, and return the extracted data — no DB write.
    """
    _, dp = _get_dealer_profile(current_user, db)
    _validate_dealer_scrape_url(data.url, dp.website)

    from app.services.scraper import OptimizedYachtScraper
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
    scraper = OptimizedYachtScraper(api_key=api_key)
    raw = scraper.scrape_single_listing(data.url.strip())

    if "error" in raw:
        raise HTTPException(status_code=422, detail=raw["error"])

    return {"success": True, "data": raw}


@router.post("/scraper/dealer/import")
def dealer_import_listing(
    data: DealerScrapeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate, scrape, and save a single listing as a draft owned by the
    current broker (or the broker the salesman belongs to).
    """
    dealer_id, dp = _get_dealer_profile(current_user, db)
    _validate_dealer_scrape_url(data.url, dp.website)

    from app.services.scraper import OptimizedYachtScraper, _generate_bin, _apply_scraped_data
    from types import SimpleNamespace

    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
    scraper = OptimizedYachtScraper(api_key=api_key)
    raw = scraper.scrape_single_listing(data.url.strip())

    if "error" in raw:
        raise HTTPException(status_code=422, detail=raw["error"])

    salesman_id = current_user.id if current_user.user_type in ("salesman", "team_member") else None
    job_like = SimpleNamespace(dealer_id=dealer_id, salesman_id=salesman_id)

    listing = Listing(
        user_id=dealer_id,
        created_by_user_id=current_user.id,
        assigned_salesman_id=salesman_id,
        source="scraped",
        source_url=data.url.strip(),
        status="needs_approval",
        bin=_generate_bin(db),
        condition="used",
    )
    _apply_scraped_data(listing, raw, job_like)
    db.add(listing)
    db.flush()

    for img_url in raw.get("images", [])[:10]:
        db.add(ListingImage(listing_id=listing.id, url=img_url))

    db.add(ScrapedListing(job_id=None, listing_id=listing.id, source_url=data.url.strip()))
    db.commit()
    db.refresh(listing)

    return {
        "success": True,
        "listing_id": listing.id,
        "title": listing.title,
        "data": raw,
    }


# Brokers submit a URL during onboarding; creates a ScraperJob for admin
# processing. The listing will appear under "Needs Approval" once processed.
# -----------------------------------------------------------------------

class BrokerImportRequest(BaseModel):
    url: str
    import_type: str = "single"  # "single" | "bulk"


@router.post("/broker/import-request")
def broker_import_request(
    data: BrokerImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow a broker to submit a URL for listing import (queued for admin processing)."""
    if current_user.user_type not in ("dealer", "admin", "team_member"):
        raise AuthorizationException("Broker account required")
    if not data.url or not data.url.strip():
        raise ValidationException("URL is required")

    if current_user.user_type == "team_member":
        import_dealer_id = current_user.parent_dealer_id or current_user.id
    else:
        import_dealer_id = current_user.id

    job = ScraperJob(
        dealer_id=import_dealer_id,
        salesman_id=current_user.id if current_user.user_type == "team_member" else None,
        created_by_id=current_user.id,
        site_name=f"Broker import: {data.url[:80]}",
        broker_url=data.url.strip(),
        schedule_hours=0,
        notes=f"Self-submitted via onboarding ({data.import_type})",
        enabled=False,
        status="idle",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"success": True, "job_id": job.id, "message": "Import request submitted. We'll process your listing(s) shortly."}


# -----------------------------------------------------------------------
# ORIGINAL: parse raw text → structured listing fields
# -----------------------------------------------------------------------

@router.post("/scraper/parse-text")
def parse_listing_text(
    data: ParseTextRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not data.text or not data.text.strip():
        return {"success": False, "message": "Text is required"}
    try:
        ai_data = _claude_extract_if_available(data.text)
    except Exception:
        ai_data = None
    fallback = _fallback_parse(data.text)
    merged = {**fallback, **(ai_data or {})}
    return {"success": True, "data": merged}


# -----------------------------------------------------------------------
# TEST: scrape a single listing URL (no DB write)
# -----------------------------------------------------------------------

@router.post("/scraper/single")
def test_scrape_single(
    data: SingleScrapeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    if not data.url:
        raise ValidationException("URL is required")
    from app.services.scraper import OptimizedYachtScraper
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
    scraper = OptimizedYachtScraper(api_key=api_key)
    with _LogCapture() as cap:
        result = scraper.scrape_single_listing(data.url)
    if "error" in result:
        return {"success": False, "error": result["error"], "logs": cap.lines}
    return {"success": True, "data": result, "logs": cap.lines}


# -----------------------------------------------------------------------
# TEST: discover listing URLs on an inventory page + preview first N
# -----------------------------------------------------------------------

@router.post("/scraper/broker")
def test_broker_inventory(
    data: BrokerScrapeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    if not data.url:
        raise ValidationException("URL is required")
    from app.services.scraper import OptimizedYachtScraper
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
    scraper = OptimizedYachtScraper(api_key=api_key)
    with _LogCapture() as cap:
        urls = scraper.find_listing_urls(data.url)
        previews = []
        for url in urls[: data.preview_count]:
            raw = scraper.scrape_single_listing(url)
            previews.append({"url": url, "data": raw if "error" not in raw else None, "error": raw.get("error")})
    return {
        "success": True,
        "total_found": len(urls),
        "all_urls": urls,
        "previews": previews,
        "logs": cap.lines,
    }


# -----------------------------------------------------------------------
# IMPORT: scrape a single URL and write it to the DB
# -----------------------------------------------------------------------

@router.post("/scraper/import-single")
def import_single_listing(
    data: ImportSingleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scrape a single listing URL and create a Listing record assigned to a dealer/salesman."""
    _require_admin(current_user)
    if not data.url:
        raise ValidationException("URL is required")

    from app.services.scraper import OptimizedYachtScraper, _generate_bin, _apply_scraped_data
    from types import SimpleNamespace

    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
    scraper = OptimizedYachtScraper(api_key=api_key)
    raw = scraper.scrape_single_listing(data.url)

    if "error" in raw:
        return {"success": False, "error": raw["error"]}

    # Check dealer exists
    dealer = db.query(User).filter(User.id == data.dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")

    # Build a job-like namespace so _apply_scraped_data can set ownership
    job_like = SimpleNamespace(dealer_id=data.dealer_id, salesman_id=data.salesman_id)

    listing = Listing(
        user_id=data.dealer_id,
        created_by_user_id=current_user.id,
        assigned_salesman_id=data.salesman_id,
        source="scraped",
        source_url=data.url,
        status="needs_approval",
        bin=_generate_bin(db),
        condition="used",
    )
    _apply_scraped_data(listing, raw, job_like)
    db.add(listing)
    db.flush()

    for img_url in raw.get("images", [])[:10]:
        db.add(ListingImage(listing_id=listing.id, url=img_url))

    scraped_record = ScrapedListing(
        job_id=None,
        listing_id=listing.id,
        source_url=data.url,
    )
    db.add(scraped_record)
    db.commit()
    db.refresh(listing)

    return {
        "success": True,
        "listing_id": listing.id,
        "title": listing.title,
        "detected_agent_name": raw.get("detected_agent_name"),
        "data": raw,
    }


# -----------------------------------------------------------------------
# ADMIN: get team members for a given dealer (for salesman assignment)
# -----------------------------------------------------------------------

@router.get("/scraper/team-members/{dealer_id}")
def get_dealer_team_members(
    dealer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    members = (
        db.query(User)
        .filter(User.parent_dealer_id == dealer_id, User.active == True)
        .all()
    )
    return {
        "success": True,
        "members": [
            {
                "id": m.id,
                "name": f"{m.first_name or ''} {m.last_name or ''}".strip() or m.email,
                "email": m.email,
                "role": m.role,
            }
            for m in members
        ],
    }


# -----------------------------------------------------------------------
# JOB MANAGEMENT
# -----------------------------------------------------------------------

def _job_to_dict(job: ScraperJob) -> dict:
    return {
        "id": job.id,
        "dealer_id": job.dealer_id,
        "salesman_id": job.salesman_id,
        "created_by_id": job.created_by_id,
        "site_name": job.site_name,
        "broker_url": job.broker_url,
        "enabled": job.enabled,
        "status": job.status,
        "schedule_hours": job.schedule_hours,
        "next_run_at": job.next_run_at.isoformat() if job.next_run_at else None,
        "last_run_at": job.last_run_at.isoformat() if job.last_run_at else None,
        "listings_found": job.listings_found,
        "listings_created": job.listings_created,
        "listings_updated": job.listings_updated,
        "listings_removed": job.listings_removed,
        "total_runs": job.total_runs,
        "last_error": job.last_error,
        "notes": job.notes,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "site_template": job.site_template or {},
    }


@router.get("/scraper/jobs")
def list_scraper_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    jobs = db.query(ScraperJob).order_by(ScraperJob.created_at.desc()).all()
    return {"success": True, "jobs": [_job_to_dict(j) for j in jobs]}


@router.post("/scraper/jobs")
def create_scraper_job(
    data: CreateJobRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    if not data.broker_url:
        raise ValidationException("broker_url is required")
    job = ScraperJob(
        dealer_id=data.dealer_id,
        salesman_id=data.salesman_id,
        created_by_id=current_user.id,
        site_name=data.site_name or data.broker_url,
        broker_url=data.broker_url,
        schedule_hours=data.schedule_hours,
        notes=data.notes,
        enabled=data.enabled,
        status="idle",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"success": True, "job": _job_to_dict(job)}


@router.put("/scraper/jobs/{job_id}")
def update_scraper_job(
    job_id: int,
    data: UpdateJobRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return {"success": True, "job": _job_to_dict(job)}


@router.delete("/scraper/jobs/{job_id}")
def delete_scraper_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Remove associated ScrapedListing records first
    db.query(ScrapedListing).filter(ScrapedListing.job_id == job_id).delete()
    db.delete(job)
    db.commit()
    return {"success": True, "message": f"Job {job_id} deleted"}


@router.post("/scraper/jobs/{job_id}/toggle")
def toggle_scraper_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.enabled = not job.enabled
    db.commit()
    db.refresh(job)
    return {"success": True, "enabled": job.enabled, "job": _job_to_dict(job)}


@router.post("/scraper/jobs/{job_id}/run")
def run_job_now(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger an immediate sync for a job in a background thread."""
    _require_admin(current_user)
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == "running":
        return {"success": False, "message": "Job is already running"}

    # Run in a background thread so the request returns immediately
    def _run():
        from app.db.session import SessionLocal
        from app.services.scraper import run_scraper_job
        bg_db = SessionLocal()
        try:
            run_scraper_job(job_id, bg_db)
        finally:
            bg_db.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"success": True, "message": f"Job {job_id} started in background"}


# -----------------------------------------------------------------------
# SITE TEMPLATE — CSS selector map for reliable per-broker scraping
# -----------------------------------------------------------------------

class SiteTemplateRequest(BaseModel):
    # Discovery selectors
    listing_link_selector: Optional[str] = None   # CSS: links to individual listings
    next_page_selector: Optional[str] = None       # CSS: "next page" pagination anchor
    # Detail-page field selectors
    title_selector: Optional[str] = None
    price_selector: Optional[str] = None
    description_selector: Optional[str] = None
    year_selector: Optional[str] = None
    make_selector: Optional[str] = None
    model_selector: Optional[str] = None
    length_selector: Optional[str] = None
    location_selector: Optional[str] = None
    images_selector: Optional[str] = None          # CSS: selects <img> tags in gallery
    agent_name_selector: Optional[str] = None
    agent_photo_selector: Optional[str] = None
    broker_email_selector: Optional[str] = None
    broker_phone_selector: Optional[str] = None
    hull_material_selector: Optional[str] = None
    fuel_type_selector: Optional[str] = None
    hours_selector: Optional[str] = None
    condition_selector: Optional[str] = None
    # Dynamic named sections — each entry auto-extracts all fields inside a container
    # [{\"name\": \"Propulsion\", \"selector\": \".prop-specs\"}, ...]
    sections: Optional[List[Dict[str, str]]] = None


@router.get("/scraper/jobs/{job_id}/template")
def get_job_template(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "template": job.site_template or {}}


@router.put("/scraper/jobs/{job_id}/template")
def save_job_template(
    job_id: int,
    data: SiteTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save (replace) the CSS selector template for a scraper job.
    Empty strings are treated as unset — only non-empty values are stored.
    """
    _require_admin(current_user)
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Strip empty strings so heuristics still kick in for unset fields
    # sections is a list — handle it separately from string fields
    template = {
        k: v for k, v in data.model_dump().items()
        if v and (isinstance(v, list) or (isinstance(v, str) and v.strip()))
    }
    job.site_template = template if template else None
    db.commit()
    db.refresh(job)
    return {"success": True, "template": job.site_template or {}}


@router.delete("/scraper/jobs/{job_id}/template")
def clear_job_template(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the selector template so the job falls back to full auto-detection."""
    _require_admin(current_user)
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.site_template = None
    db.commit()
    return {"success": True, "message": "Template cleared"}


# BOOKMARKLET — visual selector picker (served as text/javascript)
# -----------------------------------------------------------------------

@router.get("/scraper/bookmarklet.js", include_in_schema=False)
def get_bookmarklet_script(job: int = 0, name: str = "Broker"):
    """
    Returns the visual selector picker script parameterised with job ID and site name.
    Embed in a bookmark as:
      javascript:void(function(){var s=document.createElement('script');
        s.src='API_BASE/api/scraper/bookmarklet.js?job=JOB_ID&name=SITE_NAME&_='+Date.now();
        document.head.appendChild(s)}())
    """
    import html as _html
    safe_name = _html.escape(str(name)[:80]).replace('"', '\\"')
    job_id = job

    script = (
        "/* Yacht Platform Visual Selector Picker */\n"
        "(function(){\n"
        "'use strict';\n"
        f"var JOB_ID={job_id};\n"
        f'var SITE_NAME="{safe_name}";\n'
        "if(window.__ypPickerLoaded){"
        "var p=document.getElementById('__yp-sidebar');"
        "if(p)p.style.display=p.style.display==='none'?'flex':'none';"
        "return;}\n"
        "window.__ypPickerLoaded=true;\n"
        "var tmpl={},sections=[];\n"
        "var STORE_KEY='__yp_'+JOB_ID;\n"
        "try{var _sto=JSON.parse(localStorage.getItem(STORE_KEY)||'null');if(_sto){if(_sto.tmpl&&typeof _sto.tmpl==='object')Object.assign(tmpl,_sto.tmpl);if(Array.isArray(_sto.sections))sections=_sto.sections;}}catch(e){}\n"
        "function saveLocal(){try{localStorage.setItem(STORE_KEY,JSON.stringify({tmpl:tmpl,sections:sections}));}catch(e){}}\n"
        "function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');}\n"
        # --- CSS selector generator ---
        "function getSel(el){\n"
        "if(!el||el===document.body)return 'body';\n"
        "var parts=[],cur=el;\n"
        "while(cur&&cur!==document.body&&cur!==document.documentElement){\n"
        "var seg=cur.tagName.toLowerCase();\n"
        "if(cur.id&&/^[a-zA-Z][\\w-]*$/.test(cur.id)&&document.querySelectorAll('#'+cur.id).length===1){parts.unshift('#'+cur.id);break;}\n"
        "var cls=Array.from(cur.classList).filter(function(c){return c.length>2&&!/^(active|hover|focus|selected|open|js-|is-|has-|ng-)/.test(c);}).slice(0,2);\n"
        "if(cls.length)seg+='.'+cls.join('.');\n"
        "parts.unshift(seg);\n"
        "var full=parts.join(' > ');\n"
        "if(document.querySelectorAll(full).length===1)break;\n"
        "if(cur.parentElement){"
        "var idx=Array.from(cur.parentElement.children).indexOf(cur)+1;"
        "parts[0]=seg+':nth-child('+idx+')';"
        "}\n"
        "if(document.querySelectorAll(parts.join(' > ')).length===1)break;\n"
        "cur=cur.parentElement;if(parts.length>=7)break;}\n"
        "return parts.join(' > ');}\n"
        # --- Hover / pick ---
        "var hl=null,oOut='',oOff='',pick=false;\n"
        "function startPick(){pick=true;document.body.style.cursor='crosshair';setStatus('Click any element to tag it \u2014 Esc cancels');}\n"
        "function stopPick(){pick=false;document.body.style.cursor='';if(hl){hl.style.outline=oOut;hl.style.outlineOffset=oOff;hl=null;}}\n"
        "document.addEventListener('mouseover',function(e){\n"
        "if(!pick)return;\n"
        "if(e.target.closest&&(e.target.closest('#__yp-sidebar')||e.target.closest('#__yp-modal')))return;\n"
        "if(hl&&hl!==e.target){hl.style.outline=oOut;hl.style.outlineOffset=oOff;}\n"
        "hl=e.target;oOut=e.target.style.outline;oOff=e.target.style.outlineOffset;\n"
        "e.target.style.outline='2px solid #e63946';e.target.style.outlineOffset='2px';\n"
        "},true);\n"
        "document.addEventListener('click',function(e){\n"
        "if(!pick)return;\n"
        "if(e.target.closest&&(e.target.closest('#__yp-sidebar')||e.target.closest('#__yp-modal')))return;\n"
        "e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();\n"
        "var el=e.target,sel=getSel(el);stopPick();showModal(el,sel);\n"
        "},true);\n"
        "document.addEventListener('keydown',function(e){"
        "if(e.key==='Escape'){if(pick)stopPick();else closePicker();}});\n"
        # --- Field list ---
        "var FIELDS=[\n"
        "{key:'listing_link_selector',label:'Listing Links',hint:'<a> tags to individual listings on the inventory page'},\n"
        "{key:'next_page_selector',label:'Next Page Button',hint:'Pagination link to the next page of results'},\n"
        "{key:'title_selector',label:'Title',hint:'Boat name or headline'},\n"
        "{key:'price_selector',label:'Price',hint:'Asking price'},\n"
        "{key:'description_selector',label:'Description',hint:'Main description text block'},\n"
        "{key:'year_selector',label:'Year',hint:'Model year'},\n"
        "{key:'make_selector',label:'Make / Brand',hint:'Manufacturer'},\n"
        "{key:'model_selector',label:'Model',hint:'Model name'},\n"
        "{key:'length_selector',label:'Length',hint:'LOA or length value'},\n"
        "{key:'location_selector',label:'Location',hint:'Marina, port, or city'},\n"
        "{key:'images_selector',label:'Gallery Images',hint:'<img> tags inside the photo gallery'},\n"
        "{key:'agent_name_selector',label:'Agent Name',hint:'Listing agent name element'},\n"
        "{key:'agent_photo_selector',label:'Agent Photo',hint:'Agent headshot <img> element'},\n"
        "{key:'broker_email_selector',label:'Broker Email',hint:'Broker or agent email address'},\n"
        "{key:'broker_phone_selector',label:'Broker Phone',hint:'Broker or agent phone number'},\n"
        "{key:'hull_material_selector',label:'Hull Material',hint:'Hull type (fibreglass / aluminium / steel\u2026)'},\n"
        "{key:'fuel_type_selector',label:'Fuel Type',hint:'Fuel type (diesel / petrol / electric\u2026)'},\n"
        "{key:'hours_selector',label:'Engine Hours',hint:'Engine hours meter reading'},\n"
        "{key:'condition_selector',label:'Condition',hint:'New or Used designation'},\n"
        "{key:'__section',label:'+ Named Section (specs / features / propulsion\u2026)',hint:'Auto-extracts ALL fields from this container. Give it a name.',section:true},\n"
        "];\n"
        # --- Modal ---
        "var pendSel=null;\n"
        "function showModal(el,sel){\n"
        "pendSel=sel;\n"
        "var m=document.getElementById('__yp-modal');if(m)m.remove();\n"
        "m=document.createElement('div');m.id='__yp-modal';\n"
        "m.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;color:#fff;border:1px solid #334155;border-radius:12px;padding:20px;z-index:2147483647;width:400px;max-width:95vw;font-family:-apple-system,sans-serif;font-size:13px;box-shadow:0 20px 60px rgba(0,0,0,0.7);';\n"
        "var mc=document.querySelectorAll(sel).length;\n"
        "var prev=(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,70);\n"
        "m.innerHTML='<p style=\"font-size:11px;color:#94a3b8;margin:0 0 3px\">Selector:</p>'\n"
        "+'<code style=\"font-size:10px;color:#4ade80;background:#0f3460;padding:3px 7px;border-radius:4px;display:block;word-break:break-all;margin-bottom:4px\">'+esc(sel)+'</code>'\n"
        "+'<p style=\"font-size:11px;margin:0 0 12px;color:'+(mc===1?'#4ade80':'#fbbf24')+'\">Matches '+mc+' element'+(mc===1?' \u2713':' \u26a0 may be too broad')+(prev?' \u00b7 \\\"'+esc(prev.slice(0,50))+'\\\"':'')+'</p>'\n"
        "+'<p style=\"font-size:12px;font-weight:600;margin:0 0 6px\">Tag this element as:</p>'\n"
        "+'<select id=\"__yp-fsel\" style=\"width:100%;padding:8px;background:#0f3460;color:#fff;border:1px solid #1e4080;border-radius:6px;font-size:13px;margin-bottom:6px\">'\n"
        "+FIELDS.map(function(f){var done=f.section?sections.length>0:!!tmpl[f.key];return'<option value=\"'+f.key+'\">'+(done?'\u2713 ':'')+f.label+'</option>';}).join('')\n"
        "+'</select>'\n"
        "+'<div id=\"__yp-secrow\" style=\"display:none;margin-bottom:6px\">'\n"
        "+'<input id=\"__yp-secname\" placeholder=\"Name this section (e.g. Propulsion, Features, Electronics\u2026)\" style=\"width:100%;padding:8px;background:#0f3460;color:#fff;border:1px solid #1e4080;border-radius:6px;font-size:13px;box-sizing:border-box\"/>'\n"
        "+'</div>'\n"
        "+'<p id=\"__yp-hint\" style=\"font-size:11px;color:#64748b;margin:0 0 10px\"></p>'\n"
        "+'<div style=\"display:flex;gap:8px\">'\n"
        "+'<button id=\"__yp-ok\" style=\"flex:1;padding:8px;background:#e63946;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer\">Tag It</button>'\n"
        "+'<button id=\"__yp-cx\" style=\"padding:8px 14px;background:#374151;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer\">Cancel</button>'\n"
        "+'</div>';\n"
        "document.body.appendChild(m);\n"
        "var fsel=document.getElementById('__yp-fsel');\n"
        "var secrow=document.getElementById('__yp-secrow');\n"
        "var hint=document.getElementById('__yp-hint');\n"
        "function updHint(){var f=FIELDS.find(function(x){return x.key===fsel.value;});hint.textContent=f?f.hint:'';secrow.style.display=fsel.value==='__section'?'block':'none';}\n"
        "fsel.addEventListener('change',updHint);updHint();\n"
        "document.getElementById('__yp-ok').onclick=function(){\n"
        "var fk=fsel.value;\n"
        "if(fk==='__section'){\n"
        "var sn=(document.getElementById('__yp-secname').value||'').trim();\n"
        "if(!sn){document.getElementById('__yp-secname').focus();return;}\n"
        "var ei=sections.findIndex(function(s){return s.name.toLowerCase()===sn.toLowerCase();});\n"
        "if(ei>=0)sections[ei].selector=pendSel;else sections.push({name:sn,selector:pendSel});\n"
        "}else{tmpl[fk]=pendSel;}\n"
        "saveLocal();m.remove();renderList();\n"
        "var fl=FIELDS.find(function(x){return x.key===fk;});\n"
        "setStatus('\u2713 Tagged as \\\"'+(fk==='__section'?(document.getElementById('__yp-secname')||{value:'?'}).value:fl?fl.label:fk)+'\\\"');\n"
        "};\n"
        "document.getElementById('__yp-cx').onclick=function(){m.remove();};\n"
        "}\n"
        # --- Sidebar panel ---
        "function createPanel(){\n"
        "var p=document.createElement('div');p.id='__yp-sidebar';\n"
        "p.style.cssText='position:fixed;top:0;right:0;width:280px;height:100vh;background:#1a1a2e;color:#fff;z-index:2147483646;display:flex;flex-direction:column;font-family:-apple-system,sans-serif;font-size:13px;box-shadow:-4px 0 30px rgba(0,0,0,0.6);';\n"
        "p.innerHTML=\n"
        "'<div style=\"background:#16213e;padding:11px 13px;border-bottom:1px solid #0f3460;display:flex;align-items:center;gap:8px;flex-shrink:0\">'\n"
        "+'<span style=\"font-size:18px\">\u2693</span>'\n"
        "+'<div><div style=\"font-weight:700\">YP Selector Picker</div><div style=\"font-size:11px;color:#94a3b8\">'+esc(SITE_NAME)+'</div></div>'\n"
        "+'<button id=\"__yp-close\" style=\"margin-left:auto;background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;line-height:1\">\u00d7</button>'\n"
        "+'</div>'\n"
        "+'<div style=\"padding:10px 12px;border-bottom:1px solid #0f3460;flex-shrink:0\">'\n"
        "+'<button id=\"__yp-pick\" style=\"width:100%;padding:9px;background:#e63946;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer\">\U0001f3af Pick Element</button>'\n"
        "+'</div>'\n"
        "+'<div id=\"__yp-list\" style=\"flex:1;overflow-y:auto;padding:8px 10px\"></div>'\n"
        "+'<div id=\"__yp-status\" style=\"padding:6px 12px;font-size:11px;color:#94a3b8;border-top:1px solid #0f3460;flex-shrink:0\">Ready \u2014 click Pick Element to start</div>'\n"
        "+'<div style=\"padding:10px 12px;border-top:1px solid #0f3460;display:flex;gap:6px;flex-shrink:0\">'\n"
        "+'<button id=\"__yp-copy\" style=\"flex:1;padding:7px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer\">\U0001f4cb Copy JSON</button>'\n"
        "+'<button id=\"__yp-clr\" style=\"padding:7px 10px;background:#374151;color:#94a3b8;border:none;border-radius:6px;font-size:12px;cursor:pointer\">Clear</button>'\n"
        "+'</div>';\n"
        "document.body.appendChild(p);\n"
        "document.getElementById('__yp-close').onclick=closePicker;\n"
        "document.getElementById('__yp-pick').onclick=startPick;\n"
        "document.getElementById('__yp-copy').onclick=copyJSON;\n"
        "document.getElementById('__yp-clr').onclick=function(){if(confirm('Clear all?')){tmpl={};sections=[];try{localStorage.removeItem(STORE_KEY);}catch(e){}renderList();}};\n"
        "renderList();\n"
        "}\n"
        # --- Render list ---
        "function renderList(){\n"
        "var list=document.getElementById('__yp-list');if(!list)return;\n"
        "var html='',any=false;\n"
        "FIELDS.filter(function(f){return!f.section;}).forEach(function(f){\n"
        "if(!tmpl[f.key])return;any=true;\n"
        "html+='<div style=\"margin-bottom:5px;padding:6px 8px;background:#0f3460;border-radius:6px\">'\n"
        "+'<div style=\"display:flex;align-items:center\"><span style=\"font-size:11px;font-weight:600;color:#93c5fd\">'+esc(f.label)+'</span>'\n"
        "+'<button onclick=\"window.__ypD(\\''+f.key+'\\')\" style=\"margin-left:auto;background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;line-height:1\">\u00d7</button></div>'\n"
        "+'<code style=\"font-size:10px;color:#4ade80;word-break:break-all\">'+esc(tmpl[f.key])+'</code></div>';\n"
        "});\n"
        "sections.forEach(function(s,i){\n"
        "any=true;\n"
        "html+='<div style=\"margin-bottom:5px;padding:6px 8px;background:#1e1b4b;border-radius:6px\">'\n"
        "+'<div style=\"display:flex;align-items:center\"><span style=\"font-size:11px;font-weight:600;color:#c4b5fd\">\U0001f4e6 '+esc(s.name)+'</span>'\n"
        "+'<button onclick=\"window.__ypDS('+i+')\" style=\"margin-left:auto;background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;line-height:1\">\u00d7</button></div>'\n"
        "+'<code style=\"font-size:10px;color:#4ade80;word-break:break-all\">'+esc(s.selector)+'</code></div>';\n"
        "});\n"
        "if(!any)html='<p style=\"color:#4b5563;text-align:center;margin-top:20px;font-size:12px\">No selectors tagged yet.<br>Click \\\"Pick Element\\\" to start.</p>';\n"
        "list.innerHTML=html;\n"
        "}\n"
        "window.__ypD=function(k){delete tmpl[k];saveLocal();renderList();};\n"
        "window.__ypDS=function(i){sections.splice(i,1);saveLocal();renderList();};\n"
        # --- Copy JSON ---
        "function buildJSON(){var o=Object.assign({},tmpl);if(sections.length)o.sections=sections.slice();return JSON.stringify(o,null,2);}\n"
        "function copyJSON(){\n"
        "var j=buildJSON();\n"
        "if(navigator.clipboard&&navigator.clipboard.writeText){\n"
        "navigator.clipboard.writeText(j).then(function(){setStatus('\u2713 Copied! Paste it into Admin \u2192 Field Selectors \u2192 Import JSON');}).catch(function(){fb(j);});\n"
        "}else{fb(j);}\n"
        "}\n"
        "function fb(j){var t=document.createElement('textarea');t.value=j;t.style.cssText='position:fixed;left:-9999px';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();setStatus('\u2713 Copied!');}\n"
        "function setStatus(m){var e=document.getElementById('__yp-status');if(e)e.textContent=m;}\n"
        "function closePicker(){stopPick();var m=document.getElementById('__yp-modal');if(m)m.remove();var p=document.getElementById('__yp-sidebar');if(p)p.remove();window.__ypPickerLoaded=false;}\n"
        "createPanel();\n"
        "})();\n"
    )

    from fastapi.responses import Response as _Resp
    resp = _Resp(content=script, media_type="application/javascript")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Cache-Control"] = "no-cache, no-store"
    return resp


# TEMPLATE LIVE TEST — scrape a single listing URL with a given template
# -----------------------------------------------------------------------

class TemplateTestRequest(BaseModel):
    url: str
    template: dict = {}


@router.post("/scraper/test-with-template")
def test_scrape_with_template(
    data: TemplateTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Scrape a single listing URL using the provided template selectors and return
    the raw extracted fields. Used by the "Test Current Selectors" UI widget.
    """
    _require_admin(current_user)
    if not data.url or not data.url.startswith('http'):
        raise HTTPException(status_code=400, detail="A valid listing URL is required")
    import os
    from app.services.scraper import OptimizedYachtScraper
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
    scraper = OptimizedYachtScraper(api_key=api_key)
    tmpl = data.template if data.template else None
    try:
        result = scraper.scrape_single_listing(data.url, template=tmpl)
    except Exception as exc:
        logger.exception("test-with-template scrape failed: %s", exc)
        return {"success": False, "error": f"Scraper error: {exc}"}
    if result is None:
        return {"success": False, "error": "Scraper returned no data"}
    if "error" in result:
        return {"success": False, "error": result["error"]}
    return {"success": True, "data": result}


@router.get("/scraper/jobs/{job_id}/listings")
def get_job_listings(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    scraped = db.query(ScrapedListing).filter(ScrapedListing.job_id == job_id).all()
    return {
        "success": True,
        "job_id": job_id,
        "listings": [
            {
                "id": s.id,
                "listing_id": s.listing_id,
                "source_url": s.source_url,
                "still_active": s.still_active,
                "last_seen": s.last_seen.isoformat() if s.last_seen else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in scraped
        ],
    }



