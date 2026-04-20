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


def _map_yw_record(rec: dict) -> dict:
    """
    Map a single Boats Group API record to our internal normalized data dict.
    Handles both flat and nested response formats produced by different API
    versions and vendor configurations.
    """
    g = lambda *args, **kw: _yw_get(rec, *args, **kw)  # noqa: E731

    # -- Identity -------------------------------------------------------------
    external_id = str(g(["id", "listingId", "listing_id"]) or "")

    # -- Year / Make / Model --------------------------------------------------
    year_raw = g(["year", "modelYear", "model_year"])
    try:
        year = int(year_raw) if year_raw else None
    except (TypeError, ValueError):
        year = None

    make_raw = (
        g("make")
        or g(["manufacturer", "Manufacturer"])
        or g("make", "label")
    )
    make = str(make_raw).strip() if make_raw else None

    model_raw = g("model") or g("model", "label")
    model = str(model_raw).strip() if model_raw else None

    # -- Title ----------------------------------------------------------------
    title_raw = g(["name", "title", "listing_title", "listingTitle"])
    title = str(title_raw).strip() if title_raw else None
    if not title and make and model:
        title = f"{year or ''} {make} {model}".strip()

    # -- Price / Currency -----------------------------------------------------
    price_node = g(["price", "Price"])
    if isinstance(price_node, dict):
        price_val = price_node.get("amount") or price_node.get("value") or price_node.get("list")
        currency = str(price_node.get("currency", "USD")).upper()
    else:
        price_val = price_node
        currency = str(g(["currency", "Currency"], default="USD")).upper()
    try:
        price = float(price_val) if price_val else None
    except (TypeError, ValueError):
        price = None

    # -- Condition ------------------------------------------------------------
    cond_raw = str(g(["condition", "boatCondition", "boat_condition"], default="") or "").lower()
    condition = "new" if "new" in cond_raw else "used"

    # -- Dimensions -----------------------------------------------------------
    len_node = g(["length", "Length", "loa", "LOA"])
    length_feet: Optional[float] = None
    if isinstance(len_node, dict):
        ft_val = _yw_get(len_node, "ft", "value") or _yw_get(len_node, "feet", "value")
        m_val = _yw_get(len_node, "m", "value") or _yw_get(len_node, "meter", "value")
        unit_str = _yw_get(len_node, "unit") or ("ft" if ft_val else "m")
        if ft_val:
            length_feet = _yw_to_feet(ft_val, "feet")
        elif m_val:
            length_feet = _yw_to_feet(m_val, "m")
    elif len_node is not None:
        unit_str = str(g(["lengthUnit", "length_unit", "loaUnit"], default="ft") or "ft")
        length_feet = _yw_to_feet(len_node, str(unit_str))
    if length_feet is None:
        len_str = g(["lengthString", "length_string", "loaString"])
        if len_str:
            unit_str = str(g(["lengthUnit", "length_unit"], default="ft") or "ft")
            length_feet = _yw_to_feet(len_str, str(unit_str))

    beam_node = g(["beam", "Beam"])
    beam_feet: Optional[float] = None
    if isinstance(beam_node, dict):
        bft = _yw_get(beam_node, "ft", "value") or _yw_get(beam_node, "feet", "value")
        bm = _yw_get(beam_node, "m", "value")
        if bft:
            beam_feet = _yw_to_feet(bft, "feet")
        elif bm:
            beam_feet = _yw_to_feet(bm, "m")
    elif beam_node is not None:
        beam_unit = str(g(["beamUnit", "beam_unit"], default="ft") or "ft")
        beam_feet = _yw_to_feet(
            g(["beamString", "beam_string"]), g(["beamUnit", "beam_unit"])
        )

    draft_node = g(["draft", "Draft", "maxDraft", "max_draft"])
    draft_feet: Optional[float] = None
    if isinstance(draft_node, dict):
        dft = (
            _yw_get(draft_node, "maxDraft", "ft", "value")
            or _yw_get(draft_node, "ft", "value")
            or _yw_get(draft_node, "feet", "value")
        )
        dm = _yw_get(draft_node, "m", "value")
        if dft:
            draft_feet = _yw_to_feet(dft, "feet")
        elif dm:
            draft_feet = _yw_to_feet(dm, "m")

    # -- Boat type / hull -----------------------------------------------------
    boat_type = str(g(["type", "boatType", "boat_type", "category"], default="") or "").strip() or None
    hull_material = str(g(["hullMaterial", "hull_material", "hull"], default="") or "").strip() or None
    fuel_type = str(g(["fuelType", "fuel_type", "fuel"], default="") or "").strip() or None

    # -- Location -------------------------------------------------------------
    loc_node = g(["location", "Location"])
    if isinstance(loc_node, dict):
        city = str(loc_node.get("city") or loc_node.get("locality") or "").strip() or None
        state = str(loc_node.get("state") or loc_node.get("region") or "").strip() or None
        country = str(loc_node.get("country") or loc_node.get("countryCode") or "").strip() or None
    else:
        city = str(g(["city", "City"], default="") or "").strip() or None
        state = str(g(["state", "State", "region"], default="") or "").strip() or None
        country = str(g(["country", "Country", "countryCode"], default="") or "").strip() or None

    # -- Description ----------------------------------------------------------
    description = str(g(["description", "Description", "comments"], default="") or "").strip() or None

    # -- Images ---------------------------------------------------------------
    images_raw = (
        g("images")
        or g("photos")
        or g("media")
        or []
    )
    images: list[str] = []
    for img in (images_raw if isinstance(images_raw, list) else []):
        if isinstance(img, dict):
            url = (
                img.get("url") or img.get("uri") or img.get("src")
                or img.get("large") or img.get("full") or img.get("medium")
            )
            if url:
                images.append(str(url))
        elif isinstance(img, str) and img.startswith("http"):
            images.append(img)

    # -- Engine ---------------------------------------------------------------
    engines_raw = g(["engines", "engine", "Engines"])
    engine_count: Optional[int] = None
    engine_hours: Optional[float] = None
    if isinstance(engines_raw, list) and engines_raw:
        engine_count = len(engines_raw)
        hrs_raw = _yw_get(engines_raw[0], ["hours", "engineHours", "engine_hours"])
        try:
            engine_hours = float(hrs_raw) if hrs_raw else None
        except (TypeError, ValueError):
            pass
    elif isinstance(engines_raw, dict):
        engine_count = 1
        hrs_raw = _yw_get(engines_raw, ["hours", "engineHours", "engine_hours"])
        try:
            engine_hours = float(hrs_raw) if hrs_raw else None
        except (TypeError, ValueError):
            pass

    # -- Cabins ---------------------------------------------------------------
    cabins_raw = g(["cabins", "Cabins", "staterooms"])
    try:
        cabins = int(cabins_raw) if cabins_raw is not None else None
    except (TypeError, ValueError):
        cabins = None

    # -- Sold flag ------------------------------------------------------------
    status_str = str(g(["status", "listingStatus", "listing_status"], default="") or "").lower()
    is_sold = "sold" in status_str

    return {
        "_yw_id": external_id,
        "title": title,
        "make": make,
        "model": model,
        "year": year,
        "price": price,
        "currency": currency,
        "condition": condition,
        "length_feet": length_feet,
        "beam_feet": beam_feet,
        "draft_feet": draft_feet,
        "boat_type": boat_type,
        "hull_material": hull_material,
        "city": city,
        "state": state,
        "country": country,
        "description": description,
        "images": images,
        "fuel_type": fuel_type,
        "cabins": cabins,
        "engine_count": engine_count,
        "engine_hours": engine_hours,
        "is_sold": is_sold,
    }


def _generate_yw_bin(db) -> str:
    """Generate a unique BIN (Boat Identification Number) for a new listing."""
    while True:
        bin_val = "YV-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        if not db.query(Listing).filter(Listing.bin == bin_val).first():
            return bin_val


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
    proxy_url = os.getenv("SCRAPER_PROXY_URL", "").strip()
    if not proxy_url:
        raise ValueError(
            "SCRAPER_PROXY_URL must be set. YachtWorld API calls must always "
            "route through the proxy."
        )
    proxies = {"http": proxy_url, "https": proxy_url}

    job: Optional[YachtworldSyncJob] = (
        db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
    )
    if not job:
        return {"error": f"YachtworldSyncJob {job_id} not found"}

    job.status = "running"
    job.started_at = datetime.utcnow()
    job.last_error = None
    db.commit()

    stats = {"found": 0, "created": 0, "updated": 0, "archived": 0, "errors": 0}
    run_log: list = []
    seen_source_urls: set = set()

    ROWS = 100
    headers = {
        "Accept": "application/vnd.dmm-v1+json",
        "User-Agent": "YachtVersal/1.0",
    }
    base_url = (job.api_endpoint or "").rstrip("/")
    api_key = job.api_key or ""

    try:
        offset = 0
        while True:
            params = {"key": api_key, "rows": ROWS, "offset": offset}
            try:
                resp = requests.get(
                    base_url,
                    params=params,
                    headers=headers,
                    proxies=proxies,
                    timeout=30,
                )
                resp.raise_for_status()
                payload = resp.json()
            except Exception as exc:
                logger.error(f"[YWJob {job_id}] API fetch error at offset={offset}: {exc}")
                job.status = "failed"
                job.last_error = str(exc)
                db.commit()
                return {"success": False, "error": str(exc)}

            records = (
                _yw_get(payload, "search", "records")
                or _yw_get(payload, "results")
                or _yw_get(payload, "listings")
                or (payload if isinstance(payload, list) else [])
            )
            if not isinstance(records, list) or not records:
                break

            stats["found"] += len(records)
            job.listings_found = stats["found"]
            db.commit()

            for rec in records:
                raw = _map_yw_record(rec)
                external_id = raw.pop("_yw_id", "")

                source_url = f"{base_url}?id={external_id}" if external_id else None
                if not source_url:
                    stats["errors"] += 1
                    run_log.append({"url": "", "outcome": "error", "error": "no listing id in record"})
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

        logger.info(f"[YWJob {job_id}] Sync complete: {stats}")
        return {"success": True, "job_id": job_id, **stats}

    except Exception as exc:
        job.status = "failed"
        job.last_error = str(exc)
        job.completed_at = datetime.utcnow()
        db.commit()
        logger.error(f"[YWJob {job_id}] Sync failed: {exc}")
        return {"success": False, "error": str(exc)}


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
