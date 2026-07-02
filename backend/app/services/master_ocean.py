"""
Master Ocean REST API integration.

Syncs yachts from Master Ocean into the platform as CharterListing or Listing
records depending on the yacht's listingType ("Charter" vs "Sale").

Job configuration (stored in ScraperJob.site_template):
  {
    "api_type": "master_ocean",
    "api_key": "YOUR_API_KEY",
    "sync_types": ["Charter", "Sale"]   # optional, defaults to both
  }

The ScraperJob.broker_url should be set to "https://master-ocean.com" or any
placeholder — it is not used for HTML scraping in this path.
"""

import logging
import requests
from datetime import datetime
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

_BASE_URL = "https://master-ocean.com"
_METERS_TO_FEET = 3.28084
_LITERS_TO_GALLONS = 0.264172


# ---------------------------------------------------------------------------
# Boat type normalization
# ---------------------------------------------------------------------------
_BOAT_TYPE_MAP: Dict[str, str] = {
    "motor yacht": "Motor Yacht",
    "motor-yacht": "Motor Yacht",
    "motoryacht": "Motor Yacht",
    "sailing yacht": "Sailing Yacht",
    "sailing": "Sailing Yacht",
    "sailboat": "Sailing Yacht",
    "catamaran": "Catamaran",
    "sailing catamaran": "Catamaran",
    "power catamaran": "Catamaran",
    "center console": "Center Console",
    "sport fisher": "Sport Fisher",
    "sport fisherman": "Sport Fisher",
    "sportfisher": "Sport Fisher",
    "trawler": "Trawler",
    "express cruiser": "Express Cruiser",
    "mega yacht": "Mega Yacht",
    "superyacht": "Mega Yacht",
    "super yacht": "Mega Yacht",
    "gulet": "Motor Yacht",
}


def _normalize_boat_type(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    return _BOAT_TYPE_MAP.get(raw.strip().lower(), raw.strip())


def _m_to_ft(meters: Optional[float]) -> Optional[float]:
    if meters is None:
        return None
    try:
        return round(float(meters) * _METERS_TO_FEET, 2)
    except (TypeError, ValueError):
        return None


def _liters_to_gal(liters: Optional[float]) -> Optional[float]:
    if liters is None:
        return None
    try:
        return round(float(liters) * _LITERS_TO_GALLONS, 2)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------

class MasterOceanClient:
    def __init__(self, api_key: str):
        self._headers = {
            "x-api-key": api_key,
            "Accept": "application/json",
            "User-Agent": "YachtPlatform/1.0",
        }

    def get_yachts(
        self,
        listing_type: str = "Charter",
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict]:
        """Fetch one page of yachts from the list endpoint."""
        url = f"{_BASE_URL}/api/public/yachts"
        params = {"for": listing_type, "limit": limit, "offset": offset}
        try:
            resp = requests.get(url, headers=self._headers, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get("data") or data.get("yachts") or data.get("items") or []
            return []
        except Exception as exc:
            logger.error(f"MasterOcean get_yachts({listing_type}, offset={offset}): {exc}")
            return []

    def get_yacht_detail(self, yacht_id: Any) -> Optional[Dict]:
        """Fetch full detail for a single yacht (extra fields only available here)."""
        url = f"{_BASE_URL}/api/public/yachts/{yacht_id}"
        try:
            resp = requests.get(url, headers=self._headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.warning(f"MasterOcean get_yacht_detail({yacht_id}): {exc}")
            return None

    def paginate_all(self, listing_type: str, page_size: int = 50) -> List[Dict]:
        """Return every yacht of a given listing_type, paginating automatically."""
        results: List[Dict] = []
        offset = 0
        while True:
            page = self.get_yachts(listing_type, limit=page_size, offset=offset)
            if not page:
                break
            results.extend(page)
            if len(page) < page_size:
                break
            offset += page_size
        logger.info(f"MasterOcean paginate_all({listing_type}): fetched {len(results)} yachts")
        return results


# ---------------------------------------------------------------------------
# Field mapping
# ---------------------------------------------------------------------------

def _map_charter(basic: Dict, detail: Optional[Dict]) -> Dict:
    """Map Master Ocean API fields → CharterListing field dict."""
    d = detail or {}

    # Merge basic + detail, with detail winning on overlap
    merged = {**basic, **d}

    # Images: list of URL strings or dicts with a url key
    raw_images = merged.get("images") or []
    images: List[str] = []
    for img in raw_images:
        if isinstance(img, str):
            images.append(img)
        elif isinstance(img, dict):
            src = img.get("url") or img.get("src") or img.get("original") or ""
            if src:
                images.append(src)

    # Features / amenities
    basic_features: List[str] = [f for f in (merged.get("features") or []) if isinstance(f, str)]
    equipment: List[str] = [f for f in (d.get("equipmentFeatures") or []) if isinstance(f, str)]
    amenities = list(dict.fromkeys(basic_features + equipment))  # dedup preserving order

    # Description: combine description + additionalNotes
    description_parts = [merged.get("description") or ""]
    extra_notes = d.get("additionalNotes") or ""
    if extra_notes and extra_notes not in description_parts[0]:
        description_parts.append(extra_notes)
    description = "\n\n".join(p for p in description_parts if p).strip() or None

    # Rates
    price = merged.get("price")
    price_unit = (merged.get("priceUnit") or "").lower()
    day_rate = float(price) if price and price_unit == "day" else None
    week_rate = float(price) if price and price_unit == "week" else None

    # Location
    country_raw = merged.get("country") or ""
    # Normalize common abbreviations
    _COUNTRY_ABBR = {"US": "United States", "USA": "United States", "UK": "United Kingdom"}
    country = _COUNTRY_ABBR.get(country_raw.upper(), country_raw) if country_raw else None

    return {
        "vessel_name": (merged.get("name") or "").strip() or None,
        "make": (merged.get("make") or "").strip() or None,
        "model": (merged.get("model") or "").strip() or None,
        "year": _safe_int(merged.get("year")),
        "boat_type": _normalize_boat_type(merged.get("type")),
        "length_feet": _m_to_ft(merged.get("length")),
        "beam_feet": _m_to_ft(merged.get("beam")),
        "draft_feet": _m_to_ft(d.get("draught")),
        "cabins": _safe_int(merged.get("cabins")),
        "max_guests": _safe_int(merged.get("guests")),
        "crew_count": _safe_int(d.get("maxCrew") or merged.get("crew")),
        "crew_included": True,
        "engine_make": (d.get("engine") or "").strip() or None,
        "day_rate": day_rate,
        "week_rate": week_rate,
        "currency": (merged.get("currency") or "USD").upper(),
        "home_port": (merged.get("homePort") or "").strip() or None,
        "home_port_country": country,
        "home_port_state": (merged.get("region") or "").strip() or None,
        "description": description,
        "amenities": amenities or [],
        "images": images,
        "status": "active" if str(merged.get("status", "active")).lower() in ("active", "available", "1", "true") else "inactive",
    }


def _map_sale(basic: Dict, detail: Optional[Dict]) -> Dict:
    """Map Master Ocean API fields → Listing (sale) field dict."""
    d = detail or {}
    merged = {**basic, **d}

    raw_images = merged.get("images") or []
    images: List[str] = []
    for img in raw_images:
        if isinstance(img, str):
            images.append(img)
        elif isinstance(img, dict):
            src = img.get("url") or img.get("src") or img.get("original") or ""
            if src:
                images.append(src)

    features_list: List[str] = [f for f in (merged.get("features") or []) if isinstance(f, str)]
    features_text = ", ".join(features_list) if features_list else None

    description_parts = [merged.get("description") or ""]
    extra_notes = d.get("additionalNotes") or ""
    if extra_notes and extra_notes not in description_parts[0]:
        description_parts.append(extra_notes)
    description = "\n\n".join(p for p in description_parts if p).strip() or None

    country_raw = merged.get("country") or ""
    _COUNTRY_ABBR = {"US": "United States", "USA": "United States", "UK": "United Kingdom"}
    country = _COUNTRY_ABBR.get(country_raw.upper(), country_raw) if country_raw else None

    make = (merged.get("make") or "").strip() or None
    model = (merged.get("model") or "").strip() or None
    year = _safe_int(merged.get("year"))
    name = (merged.get("name") or "").strip()

    title = name or " ".join(filter(None, [str(year) if year else None, make, model])) or "Yacht"

    return {
        "title": title,
        "make": make,
        "model": model,
        "year": year,
        "boat_type": _normalize_boat_type(merged.get("type")),
        "price": _safe_float(merged.get("price")),
        "currency": (merged.get("currency") or "USD").upper(),
        "length_feet": _m_to_ft(merged.get("length")),
        "beam_feet": _m_to_ft(merged.get("beam")),
        "draft_feet": _m_to_ft(d.get("draught")),
        "cabins": _safe_int(merged.get("cabins")),
        "max_speed_knots": None,
        "fuel_capacity_gallons": _liters_to_gal(d.get("fuelCapacity")),
        "engine_count": None,
        "city": (merged.get("homePort") or "").strip() or None,
        "country": country,
        "state": (merged.get("region") or "").strip() or None,
        "description": description,
        "features": features_text,
        "feature_bullets": features_list[:8] if features_list else None,
        "images": images,
        "condition": "used",
    }


def _safe_int(val) -> Optional[int]:
    try:
        return int(val) if val is not None else None
    except (TypeError, ValueError):
        return None


def _safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Sync runner — called from run_scraper_job when api_type == "master_ocean"
# ---------------------------------------------------------------------------

def run_master_ocean_sync(job_id: int, job, template: Dict, db) -> Dict:
    """
    Full sync of Master Ocean inventory into the platform.
    Handles both Charter and Sale listing types.
    Returns a stats dict matching run_scraper_job's format.
    """
    from app.models.charter import CharterListing
    from app.models.listing import Listing, ListingImage
    from app.models.misc import ScrapedListing
    from app.services.scraper import _generate_bin, _apply_scraped_data
    from types import SimpleNamespace
    import re

    api_key = template.get("api_key", "")
    if not api_key:
        logger.error(f"[Job {job_id}] MasterOcean: no api_key in site_template")
        return {"error": "No api_key configured in site_template"}

    sync_types: List[str] = template.get("sync_types") or ["Charter", "Sale"]
    client = MasterOceanClient(api_key)

    stats = {"found": 0, "created": 0, "updated": 0, "archived": 0, "errors": 0}
    run_log: List[Dict] = []

    # Track external IDs seen this run (for archiving disappeared yachts)
    seen_source_urls: set = set()

    for listing_type in sync_types:
        if listing_type not in ("Charter", "Sale", "Event"):
            continue

        yachts = client.paginate_all(listing_type)
        stats["found"] += len(yachts)
        job.listings_found = stats["found"]
        db.commit()

        for yacht in yachts:
            yacht_id = yacht.get("id") or yacht.get("uuid")
            if not yacht_id:
                stats["errors"] += 1
                continue

            source_url = f"masterocean://{listing_type.lower()}/{yacht_id}"
            seen_source_urls.add(source_url)

            try:
                # Fetch detail for extra fields
                detail = client.get_yacht_detail(yacht_id)

                if listing_type == "Charter":
                    _sync_charter(
                        job_id, job, yacht, detail, source_url, db, stats, run_log
                    )
                elif listing_type == "Sale":
                    _sync_sale(
                        job_id, job, yacht, detail, source_url, db, stats, run_log
                    )
            except Exception as exc:
                stats["errors"] += 1
                run_log.append({"url": source_url, "outcome": "error", "error": str(exc)})
                logger.error(f"[Job {job_id}] MasterOcean error syncing {source_url}: {exc}")

    # Archive listings that were not seen in this run
    stats["archived"] += _archive_disappeared(job_id, seen_source_urls, db)

    stats["log"] = run_log
    return stats


def _sync_charter(job_id, job, basic: Dict, detail: Optional[Dict], source_url: str, db, stats, run_log):
    from app.models.charter import CharterListing
    from app.models.misc import ScrapedListing

    mapped = _map_charter(basic, detail)
    vessel_name = mapped.get("vessel_name") or f"Yacht {basic.get('id')}"

    # Build title
    parts = [str(mapped["year"]) if mapped.get("year") else None,
             mapped.get("make"), mapped.get("model") or vessel_name]
    title = " ".join(p for p in parts if p) or vessel_name

    # Look up existing by source_url in ScrapedListing
    existing_scraped = (
        db.query(ScrapedListing)
        .filter(ScrapedListing.job_id == job_id, ScrapedListing.source_url == source_url)
        .first()
    )

    if existing_scraped and existing_scraped.listing_id:
        # Update existing CharterListing
        charter = db.query(CharterListing).filter(CharterListing.id == existing_scraped.listing_id).first()
        if charter:
            _apply_charter_fields(charter, title, vessel_name, mapped)
            existing_scraped.last_seen = datetime.utcnow()
            existing_scraped.still_active = True
            db.commit()
            stats["updated"] += 1
            run_log.append({"url": source_url, "outcome": "updated"})
            return

    # Create new CharterListing
    slug = _make_charter_slug(vessel_name, db)
    charter = CharterListing(slug=slug)
    _apply_charter_fields(charter, title, vessel_name, mapped)
    db.add(charter)
    db.flush()

    scraped = ScrapedListing(
        job_id=job_id,
        listing_id=charter.id,  # reusing listing_id to point to charter
        source_url=source_url,
    )
    db.add(scraped)
    db.commit()
    stats["created"] += 1
    run_log.append({"url": source_url, "outcome": "created"})


def _apply_charter_fields(charter: "CharterListing", title: str, vessel_name: str, mapped: Dict):
    charter.title = title
    charter.vessel_name = vessel_name
    for field in (
        "make", "model", "year", "boat_type", "length_feet", "beam_feet", "draft_feet",
        "cabins", "max_guests", "crew_count", "crew_included", "engine_make",
        "day_rate", "week_rate", "currency", "home_port", "home_port_country",
        "home_port_state", "description", "amenities", "images",
    ):
        val = mapped.get(field)
        if val is not None:
            setattr(charter, field, val)
    status = mapped.get("status", "active")
    charter.status = status if status in ("active", "inactive", "draft") else "active"


def _sync_sale(job_id, job, basic: Dict, detail: Optional[Dict], source_url: str, db, stats, run_log):
    from app.models.listing import Listing, ListingImage
    from app.models.misc import ScrapedListing
    from app.services.scraper import _generate_bin, _apply_scraped_data
    from types import SimpleNamespace

    mapped = _map_sale(basic, detail)
    if not mapped.get("title"):
        stats["errors"] += 1
        return

    existing_scraped = (
        db.query(ScrapedListing)
        .filter(ScrapedListing.job_id == job_id, ScrapedListing.source_url == source_url)
        .first()
    )

    if existing_scraped and existing_scraped.listing_id:
        listing = db.query(Listing).filter(Listing.id == existing_scraped.listing_id).first()
        if listing and listing.deleted_at is None:
            job_like = SimpleNamespace(dealer_id=job.dealer_id, salesman_id=job.salesman_id)
            _apply_scraped_data(listing, mapped, job_like)
            existing_scraped.last_seen = datetime.utcnow()
            existing_scraped.still_active = True
            db.commit()
            stats["updated"] += 1
            run_log.append({"url": source_url, "outcome": "updated"})
            return

    job_like = SimpleNamespace(dealer_id=job.dealer_id, salesman_id=job.salesman_id)
    listing = Listing(
        user_id=job.dealer_id,
        assigned_salesman_id=job.salesman_id,
        source="scraped",
        source_url=source_url,
        status="awaiting_review",
        bin=_generate_bin(db),
        condition="used",
    )
    _apply_scraped_data(listing, mapped, job_like)
    db.add(listing)
    db.flush()

    for img_url in (mapped.get("images") or []):
        db.add(ListingImage(listing_id=listing.id, url=img_url))

    scraped = ScrapedListing(
        job_id=job_id,
        listing_id=listing.id,
        source_url=source_url,
    )
    db.add(scraped)
    db.commit()
    stats["created"] += 1
    run_log.append({"url": source_url, "outcome": "created"})


def _archive_disappeared(job_id: int, seen_source_urls: set, db) -> int:
    """Mark ScrapedListings (and their Listings) as removed if not seen this run."""
    from app.models.listing import Listing
    from app.models.misc import ScrapedListing

    all_scraped = (
        db.query(ScrapedListing)
        .filter(ScrapedListing.job_id == job_id, ScrapedListing.still_active == True)
        .all()
    )
    archived = 0
    for row in all_scraped:
        if row.source_url not in seen_source_urls:
            row.still_active = False
            if row.listing_id:
                listing = db.query(Listing).filter(Listing.id == row.listing_id).first()
                if listing and listing.deleted_at is None:
                    listing.deleted_at = datetime.utcnow()
            archived += 1
    if archived:
        db.commit()
    return archived


def _make_charter_slug(vessel_name: str, db) -> str:
    """Generate a unique slug for a CharterListing."""
    from app.models.charter import CharterListing
    import re

    base = re.sub(r"[^a-z0-9]+", "-", vessel_name.lower()).strip("-")[:80] or "charter"
    slug = base
    counter = 1
    while db.query(CharterListing).filter(CharterListing.slug == slug).first():
        slug = f"{base}-{counter}"
        counter += 1
    return slug
