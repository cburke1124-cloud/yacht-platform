"""
Standalone YachtWorld / Boats Group REST API feed service.

This module runs COMPLETELY INDEPENDENTLY of the HTML scraper system.
It manages its own YachtworldSyncJob records and has NO dependency on
ScraperJob or any HTML-scraping code paths.

SECURITY: All HTTP requests to the Boats Group API MUST go through the
configured proxy (SCRAPER_PROXY_URL). A ValueError is raised at startup
of any sync if the proxy is not set.
"""
from __future__ import annotations

import logging
import os
import random
import string
from datetime import datetime, timedelta
from typing import Dict, Optional

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

import requests

from app.db.session import SessionLocal
from app.models.listing import Listing, ListingImage
from app.models.misc import ScrapedListing, YachtworldSyncJob
from app.services.scraper import _apply_scraped_data

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _yw_get(d, *keys, default=None):
    """Safely traverse a nested dict with multiple possible key paths.
    Each element in *keys may be a string key or a list of fallback keys."""
    for key in keys:
        if d is None:
            return default
        if isinstance(key, list):
            for k in key:
                v = d.get(k) if isinstance(d, dict) else None
                if v is not None:
                    d = v
                    break
            else:
                return default
        else:
            d = d.get(key) if isinstance(d, dict) else None
    return d if d is not None else default


def _yw_to_feet(value, unit: str) -> Optional[float]:
    """Convert a length value to decimal feet."""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    unit = (unit or "").lower().strip()
    if unit in ("m", "meter", "meters", "metre", "metres"):
        return round(v * 3.28084, 2)
    return v  # assume feet


def _parse_price_string(val) -> tuple:
    """Parse Boats Group price strings like '559900.00 USD' → (559900.0, 'USD')."""
    if val is None:
        return None, "USD"
    if isinstance(val, (int, float)):
        return float(val), "USD"
    s = str(val).strip()
    parts = s.split()
    currency = "USD"
    if len(parts) == 2 and parts[1].isalpha() and len(parts[1]) == 3:
        currency = parts[1].upper()
        s = parts[0]
    elif len(parts) == 1:
        pass
    try:
        return float(s.replace(",", "")), currency
    except (TypeError, ValueError):
        return None, currency


def _parse_nested(val):
    """
    The Boats Group API sometimes returns nested objects as Python dicts,
    sometimes as stringified dicts (when truncated in logs).  Always return
    the actual dict when available.
    """
    if isinstance(val, dict):
        return val
    return {}


def _map_yw_record(rec: dict) -> dict:
    """
    Map a single Boats Group / boats.com API record to our internal
    normalized data dict.

    Actual field names observed from the API (DocumentID, MakeString, etc.)
    are tried first; generic fallbacks follow for forward-compatibility.
    """
    def g(*keys, default=None):
        for k in keys:
            v = rec.get(k)
            if v is not None and v != "":
                return v
        return default

    # -- Identity -------------------------------------------------------------
    external_id = str(g("DocumentID", "id", "listingId", "listing_id") or "")

    # -- Year / Make / Model --------------------------------------------------
    year_raw = g("ModelYear", "year", "modelYear", "model_year")
    try:
        year = int(str(year_raw).strip()) if year_raw else None
    except (TypeError, ValueError):
        year = None

    make = str(g("MakeString", "MakeStringExact", "make", "manufacturer") or "").strip() or None
    model = str(g("Model", "ModelExact", "model") or "").strip() or None
    boat_name = str(g("BoatName", "name", "title", "listing_title") or "").strip() or None

    # -- Title ----------------------------------------------------------------
    # Prefer BoatName if it looks like a real title; otherwise synthesize
    title = boat_name or None
    if not title and make and model:
        title = f"{year or ''} {make} {model}".strip()
    elif not title and make:
        title = f"{year or ''} {make}".strip()

    # -- Price / Currency -----------------------------------------------------
    price, currency = _parse_price_string(g("Price", "OriginalPrice", "price"))

    # -- Condition (SaleClassCode: N=new, U=used) ------------------------------
    sale_class = str(g("SaleClassCode", "condition", "boatCondition") or "").upper()
    condition = "new" if sale_class in ("N", "NEW") else "used"

    # -- Status ----------------------------------------------------------------
    status_str = str(g("SalesStatus", "status", "listingStatus") or "").lower()
    is_sold = "sold" in status_str

    # -- Location (BoatLocation is a nested dict) ------------------------------
    loc_node = _parse_nested(g("BoatLocation", "location", "Location"))
    city    = str(loc_node.get("BoatCityName")    or loc_node.get("city")    or g("BoatCityNameNoCaseAlnumOnly") or "").strip() or None
    state   = str(loc_node.get("BoatStateCode")   or loc_node.get("state")   or "").strip() or None
    country = str(loc_node.get("BoatCountryID")   or loc_node.get("country") or "").strip() or None

    # -- Boat type ---------------------------------------------------------------
    cat_code = str(g("BoatCategoryCode", "type", "boatType", "boat_type", "category") or "").strip()
    # Map Boats Group category codes to our labels where known
    _CAT_MAP = {
        "PWC": "Personal Watercraft", "PA": "Motor Yacht", "DP": "Motor Yacht",
        "SE": "Motor Yacht", "SP": "Sport Boat", "FB": "Sport Fisher",
        "SL": "Sailing Yacht", "SC": "Sailing Yacht", "CT": "Catamaran",
        "TR": "Trawler", "HB": "Trawler", "MH": "Mega Yacht",
        "CC": "Center Console", "BI": "Inflatable", "SK": "Skiff",
        "WK": "Trawler",
    }
    boat_type = _CAT_MAP.get(cat_code.upper(), cat_code) or None

    # -- Dimensions -----------------------------------------------------------
    length_feet: Optional[float] = None
    len_node = _parse_nested(g("Length", "length", "loa", "LOA"))
    if len_node:
        ft_val = len_node.get("Feet") or len_node.get("ft") or len_node.get("feet")
        m_val  = len_node.get("Meters") or len_node.get("m") or len_node.get("meter")
        if ft_val:
            length_feet = _yw_to_feet(ft_val, "feet")
        elif m_val:
            length_feet = _yw_to_feet(m_val, "m")
    # fallback: flat numeric fields
    if length_feet is None:
        for k in ("LengthFt", "LOAFeet", "length_ft"):
            v = rec.get(k)
            if v:
                length_feet = _yw_to_feet(v, "feet")
                break

    beam_feet: Optional[float] = None
    beam_node = _parse_nested(g("Beam", "beam"))
    if beam_node:
        bft = beam_node.get("Feet") or beam_node.get("ft") or beam_node.get("feet")
        bm  = beam_node.get("Meters") or beam_node.get("m")
        if bft:
            beam_feet = _yw_to_feet(bft, "feet")
        elif bm:
            beam_feet = _yw_to_feet(bm, "m")

    draft_feet: Optional[float] = None

    # -- Description ----------------------------------------------------------
    description = str(g("Description", "description", "comments") or "").strip() or None

    # -- Images ---------------------------------------------------------------
    images: list[str] = []
    images_raw = g("Images", "images", "photos", "media") or []
    if isinstance(images_raw, list):
        for img in images_raw:
            if isinstance(img, dict):
                url = (img.get("Uri") or img.get("url") or img.get("uri")
                       or img.get("src") or img.get("large") or img.get("full"))
                if url:
                    images.append(str(url))
            elif isinstance(img, str) and img.startswith("http"):
                images.append(img)

    # -- Engine ---------------------------------------------------------------
    engine_count: Optional[int] = None
    engine_hours: Optional[float] = None
    n_eng = g("NumberOfEngines", "engine_count")
    try:
        engine_count = int(n_eng) if n_eng else None
    except (TypeError, ValueError):
        pass
    engines_raw = g("Engines", "engines", "engine")
    if isinstance(engines_raw, list) and engines_raw:
        engine_count = engine_count or len(engines_raw)
        hrs_raw = _yw_get(engines_raw[0], ["Hours", "hours", "engineHours"])
        try:
            engine_hours = float(hrs_raw) if hrs_raw else None
        except (TypeError, ValueError):
            pass

    # -- Cabins / hull --------------------------------------------------------
    cabins_raw = g("Cabins", "cabins", "Staterooms", "staterooms")
    try:
        cabins = int(cabins_raw) if cabins_raw is not None else None
    except (TypeError, ValueError):
        cabins = None

    hull_material = str(g("HullMaterial", "hullMaterial", "hull_material", "hull") or "").strip() or None
    fuel_type     = str(g("FuelType", "fuelType", "fuel_type", "fuel") or "").strip() or None

    return {
        "_yw_id":       external_id,
        "title":        title,
        "make":         make,
        "model":        model,
        "year":         year,
        "price":        price,
        "currency":     currency,
        "condition":    condition,
        "length_feet":  length_feet,
        "beam_feet":    beam_feet,
        "draft_feet":   draft_feet,
        "boat_type":    boat_type,
        "hull_material":hull_material,
        "city":         city,
        "state":        state,
        "country":      country,
        "description":  description,
        "images":       images,
        "fuel_type":    fuel_type,
        "cabins":       cabins,
        "engine_count": engine_count,
        "engine_hours": engine_hours,
        "is_sold":      is_sold,
    }


def _generate_yw_bin(db) -> str:
    """Generate a unique BIN (Boat Identification Number) for a new listing."""
    while True:
        bin_val = "YV-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        if not db.query(Listing).filter(Listing.bin == bin_val).first():
            return bin_val


def _mask_key(api_key: str) -> str:
    """Return a partially masked API key safe to store in logs."""
    if not api_key:
        return "(empty)"
    return api_key[:6] + "***"


def _mask_proxy(proxy_url: str) -> str:
    """Strip credentials from a proxy URL for safe logging."""
    try:
        from urllib.parse import urlparse, urlunparse
        p = urlparse(proxy_url)
        # Replace userinfo with placeholder if present
        masked = p._replace(netloc=f"{p.hostname}:{p.port}" if p.port else p.hostname or "")
        return urlunparse(masked)
    except Exception:
        return "(proxy)"


def _ts() -> str:
    return datetime.utcnow().strftime("%H:%M:%S.%f")[:-3]


# ---------------------------------------------------------------------------
# Main sync function
# ---------------------------------------------------------------------------

def sync_yachtworld_job(job_id: int, db) -> Dict:
    """
    Sync a YachtworldSyncJob against the Boats Group / YachtWorld REST API.

    PROXY REQUIREMENT: SCRAPER_PROXY_URL env var MUST be set.
    All HTTP requests will be routed through the proxy. If the variable is
    not configured this function raises ValueError immediately — YachtWorld
    API calls must never bypass the proxy.

    Pagination: rows=100, offset incremented until records list is empty.
    Listing upsert uses the same ScrapedListing / Listing mechanism as the
    HTML scraper for consistency and archive detection.
    """
    # The Boats Group REST API uses key-based auth and does not need a proxy.
    # Using a proxy (e.g. ScraperAPI) causes 403s because their IP ranges are
    # blocked by the API. We make direct HTTPS calls with verify=False to
    # handle intermediate cert issues in some hosting environments.
    proxies = None

    job: Optional[YachtworldSyncJob] = (
        db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
    )
    if not job:
        return {"error": f"YachtworldSyncJob {job_id} not found"}

    job.status = "running"
    job.started_at = datetime.utcnow()
    job.last_error = None
    job.last_run_log = None
    db.commit()

    stats = {"found": 0, "created": 0, "updated": 0, "archived": 0, "errors": 0}
    run_log: list = []
    seen_source_urls: set = set()

    def _log(level: str, msg: str, **extra):
        entry = {"t": _ts(), "level": level, "msg": msg, **extra}
        run_log.append(entry)
        log_fn = logger.error if level == "error" else (logger.warning if level == "warn" else logger.info)
        log_fn(f"[YWJob {job_id}] {msg}")

    ROWS = 100
    req_headers = {
        "Accept": "application/vnd.dmm-v1+json",
        "User-Agent": "YachtVersal/1.0",
    }
    # Split any query string already embedded in the stored endpoint URL so
    # we never send duplicate parameters (e.g. ?key= appearing twice).
    from urllib.parse import urlsplit, parse_qs, urlencode, urlunsplit
    _raw_endpoint = (job.api_endpoint or "").rstrip("/")
    _split = urlsplit(_raw_endpoint)
    _existing_params = {k: v[0] for k, v in parse_qs(_split.query).items()}
    base_url = urlunsplit((_split.scheme, _split.netloc, _split.path, "", ""))

    # api_key: prefer the job's dedicated api_key field; fall back to whatever
    # was embedded in the endpoint URL under "key".
    api_key = job.api_key or _existing_params.get("key", "")

    _log("info", f"Starting sync — endpoint: {base_url}  key: {_mask_key(api_key)}  (direct, no proxy)")
    # Flush the starting log entry so the log panel shows something immediately
    job.last_run_log = list(run_log)
    db.commit()

    MAX_PAGES = 100  # safety cap: 100 pages × 100 rows = 10,000 listings max
    first_page_ids: set = set()    # detect stuck pagination (API ignores offset)

    try:
        offset = 0
        page_num = 0
        while True:
            if page_num >= MAX_PAGES:
                _log("warn", f"Reached page limit ({MAX_PAGES} pages). Stopping pagination to prevent runaway loop.")
                break
            page_num += 1

            # Start from any params already in the endpoint URL, then add/override pagination params
            params = {**_existing_params, "key": api_key, "rows": ROWS, "offset": offset}
            import time as _time
            t0 = _time.monotonic()
            try:
                resp = requests.get(
                    base_url,
                    params=params,
                    headers=req_headers,
                    proxies=proxies,
                    timeout=30,
                    verify=False,
                )
                elapsed_ms = int((_time.monotonic() - t0) * 1000)
                resp.raise_for_status()
                payload = resp.json()
                _log("info", f"Page {page_num} (offset={offset}) — HTTP {resp.status_code} in {elapsed_ms}ms")
            except Exception as exc:
                elapsed_ms = int((_time.monotonic() - t0) * 1000)
                err_msg = str(exc)
                _log("error", f"HTTP fetch failed at offset={offset} after {elapsed_ms}ms: {err_msg}")
                logger.error(f"[YWJob {job_id}] API fetch error at offset={offset}: {exc}")
                job.status = "failed"
                job.last_error = err_msg
                job.last_run_log = list(run_log)
                job.completed_at = datetime.utcnow()
                db.commit()
                return {"success": False, "error": err_msg}

            records = (
                _yw_get(payload, "search", "records")
                or _yw_get(payload, "results")
                or _yw_get(payload, "listings")
                or (payload if isinstance(payload, list) else [])
            )
            if not isinstance(records, list) or not records:
                _log("info", f"No more records at offset={offset} — pagination complete")
                break

            # Detect stuck pagination: if page 2+ has the same IDs as page 1, the API
            # is ignoring offset and we would loop forever.
            page_ids = {str(rec.get("DocumentID") or rec.get("id") or rec.get("listingId") or "") for rec in records}
            page_ids.discard("")
            if page_num == 1:
                first_page_ids = page_ids
            elif page_ids and page_ids == first_page_ids:
                _log("warn", f"Page {page_num} returned identical IDs to page 1 — API does not support offset pagination. Stopping.")
                break

            _log("info", f"Processing {len(records)} records from offset={offset}")
            stats["found"] += len(records)
            job.listings_found = stats["found"]
            db.commit()

            for rec in records:
                raw = _map_yw_record(rec)
                external_id = raw.pop("_yw_id", "")

                source_url = f"{base_url}?id={external_id}" if external_id else None
                if not source_url:
                    stats["errors"] += 1
                    _log("error", f"No listing ID found in record — keys: {list(rec.keys())[:15]}")
                    continue

                seen_source_urls.add(source_url)
                is_sold = bool(raw.get("is_sold"))

                existing_scraped = (
                    db.query(ScrapedListing)
                    .filter(
                        ScrapedListing.job_id == job_id,
                        ScrapedListing.source_url == source_url,
                    )
                    .first()
                )

                if existing_scraped and existing_scraped.listing_id:
                    listing = db.query(Listing).filter(Listing.id == existing_scraped.listing_id).first()
                    if listing:
                        _apply_scraped_data(listing, raw, job)
                        if is_sold:
                            listing.status = "sold"
                        elif listing.status not in ("draft", "awaiting_review"):
                            listing.status = "active"
                        if raw.get("images"):
                            db.query(ListingImage).filter(ListingImage.listing_id == listing.id).delete()
                            for img_url in raw["images"]:
                                db.add(ListingImage(listing_id=listing.id, url=img_url))
                        existing_scraped.last_seen = datetime.utcnow()
                        existing_scraped.still_active = True
                        stats["updated"] += 1
                        run_log.append({"url": source_url, "outcome": "sold" if is_sold else "updated",
                                        "listing_id": listing.id, "title": listing.title})
                else:
                    orphan = (
                        db.query(Listing)
                        .filter(
                            Listing.user_id == job.dealer_id,
                            Listing.source_url == source_url,
                            Listing.deleted_at.is_(None),
                        )
                        .first()
                    )
                    if orphan:
                        _apply_scraped_data(orphan, raw, job)
                        if is_sold:
                            orphan.status = "sold"
                        elif orphan.status not in ("draft", "awaiting_review"):
                            orphan.status = "active"
                        if existing_scraped:
                            existing_scraped.listing_id = orphan.id
                            existing_scraped.last_seen = datetime.utcnow()
                            existing_scraped.still_active = True
                        else:
                            db.add(ScrapedListing(
                                job_id=job_id,
                                listing_id=orphan.id,
                                source_url=source_url,
                                last_seen=datetime.utcnow(),
                                still_active=True,
                            ))
                        stats["updated"] += 1
                        run_log.append({"url": source_url, "outcome": "updated",
                                        "listing_id": orphan.id, "title": orphan.title})
                    else:
                        listing = Listing(
                            user_id=job.dealer_id,
                            assigned_salesman_id=job.salesman_id,
                            source="scraped",
                            source_url=source_url,
                            status="awaiting_review" if not is_sold else "sold",
                            condition="used",
                        )
                        try:
                            listing.bin = _generate_yw_bin(db)
                        except Exception:
                            pass
                        _apply_scraped_data(listing, raw, job)
                        db.add(listing)
                        db.flush()
                        for img_url in raw.get("images", []):
                            db.add(ListingImage(listing_id=listing.id, url=img_url))
                        db.add(ScrapedListing(
                            job_id=job_id,
                            listing_id=listing.id,
                            source_url=source_url,
                            last_seen=datetime.utcnow(),
                            still_active=True,
                        ))
                        stats["created"] += 1
                        run_log.append({"url": source_url, "outcome": "created",
                                        "listing_id": listing.id, "title": listing.title})
                db.commit()

            # Flush progress log to DB after each page so the UI can display it
            job.last_run_log = list(run_log)
            db.commit()

            if len(records) < ROWS:
                break
            offset += ROWS

        # Archive listings from previous runs no longer in the feed
        previously_active = (
            db.query(ScrapedListing)
            .filter(ScrapedListing.job_id == job_id, ScrapedListing.still_active == True)
            .all()
        )
        for scraped_record in previously_active:
            if scraped_record.source_url not in seen_source_urls:
                scraped_record.still_active = False
                if scraped_record.listing_id:
                    listing = db.query(Listing).filter(Listing.id == scraped_record.listing_id).first()
                    if listing and listing.status == "active":
                        listing.status = "archived"
                        stats["archived"] += 1
                        run_log.append({"url": scraped_record.source_url, "outcome": "archived",
                                        "listing_id": scraped_record.listing_id})

        summary = f"Sync complete — found={stats['found']} created={stats['created']} updated={stats['updated']} archived={stats['archived']} errors={stats['errors']}"
        _log("info", summary)
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.last_run_at = datetime.utcnow()
        job.listings_found = stats["found"]
        job.listings_created = stats["created"]
        job.listings_updated = stats["updated"]
        job.listings_removed = stats["archived"]
        job.total_runs = (job.total_runs or 0) + 1
        job.next_run_at = datetime.utcnow() + timedelta(hours=int(job.schedule_hours or 24))
        job.last_run_log = run_log
        db.commit()

        logger.info(f"[YWJob {job_id}] {summary}")
        return {"success": True, "job_id": job_id, **stats}

    except Exception as exc:
        err_msg = str(exc)
        try:
            _log("error", f"Unexpected error: {err_msg}")
        except Exception:
            pass
        job.status = "failed"
        job.last_error = err_msg
        job.completed_at = datetime.utcnow()
        job.last_run_log = run_log
        db.commit()
        logger.error(f"[YWJob {job_id}] Sync failed: {exc}")
        return {"success": False, "error": err_msg}


# ---------------------------------------------------------------------------
# Scheduler hook
# ---------------------------------------------------------------------------

def run_due_yachtworld_jobs(db) -> int:
    """Find all enabled YW feed jobs that are due and run them synchronously."""
    now = datetime.utcnow()
    due_jobs = (
        db.query(YachtworldSyncJob)
        .filter(
            YachtworldSyncJob.enabled == True,
            YachtworldSyncJob.status != "running",
            (YachtworldSyncJob.next_run_at == None)
            | (YachtworldSyncJob.next_run_at <= now),
        )
        .all()
    )
    count = 0
    for job in due_jobs:
        try:
            logger.info(f"[YW Scheduler] Running due job #{job.id} ({job.site_name})")
            sync_yachtworld_job(job.id, db)
            count += 1
        except Exception as exc:
            logger.error(f"[YW Scheduler] Error running job #{job.id}: {exc}")
    return count
