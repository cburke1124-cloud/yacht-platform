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
from typing import Optional, Any, List
from urllib.parse import urlparse
import os
import re
import json
import threading

import requests

from app.db.session import get_db
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
    prompt = f"""Extract yacht listing fields from this text and return JSON only.
Text:
{text[:12000]}

Fields: title, make, model, year, price, length_feet, beam_feet, draft_feet,
cabins, berths, heads, engine_count, engine_hours,
fuel_type, fuel_capacity_gallons, water_capacity_gallons, max_speed_knots, cruising_speed_knots,
city, state, country, hull_material, hull_type, feature_bullets (array), features (string)"""
    try:
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": 1200,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=25,
        )
        if not response.ok:
            return None
        payload = response.json()
        content = payload.get("content", [])
        if not content:
            return None
        text_blob = re.sub(r"^```json\s*|\s*```$", "", content[0].get("text", "").strip())
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
    result = scraper.scrape_single_listing(data.url)
    if "error" in result:
        return {"success": False, "error": result["error"]}
    return {"success": True, "data": result}


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



