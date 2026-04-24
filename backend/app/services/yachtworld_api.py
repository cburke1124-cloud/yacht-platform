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
import time
from datetime import datetime, timedelta
from typing import Dict, Optional

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

import requests

from app.db.session import SessionLocal
from app.models.listing import Listing, ListingImage
from app.models.misc import YachtworldSyncJob
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


# ---------------------------------------------------------------------------
# Geocoding helpers (Nominatim / OpenStreetMap — no API key required)
# ---------------------------------------------------------------------------

# Per-process cache so the same zip/coords are never looked up twice
_geo_cache: Dict[str, dict] = {}
_geo_last_call: float = 0.0
_GEO_USER_AGENT = "yacht-platform-sync/1.0 (contact@yachtplatform.com)"
_GEO_TIMEOUT    = 6   # seconds


def _geo_sleep():
    """Enforce Nominatim's 1-request-per-second policy."""
    global _geo_last_call
    elapsed = time.monotonic() - _geo_last_call
    if elapsed < 1.1:
        time.sleep(1.1 - elapsed)
    _geo_last_call = time.monotonic()


def _parse_nominatim_address(addr: dict) -> dict:
    """Extract city/state/country from a Nominatim address dict."""
    city = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("hamlet")
        or addr.get("municipality")
        or addr.get("county")
    )
    state   = addr.get("state") or addr.get("province") or addr.get("region")
    country = (addr.get("country_code") or "").upper() or addr.get("country") or None
    return {
        "city":    city or None,
        "state":   state or None,
        "country": country or None,
    }


def _geocode_zip(zip_code: str) -> dict:
    """Resolve city/state/country from a postal code via Nominatim.
    Returns {} on any error."""
    key = f"zip:{zip_code}"
    if key in _geo_cache:
        return _geo_cache[key]
    try:
        _geo_sleep()
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"postalcode": zip_code, "format": "json", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": _GEO_USER_AGENT},
            timeout=_GEO_TIMEOUT,
        )
        data = resp.json()
        if data:
            result = _parse_nominatim_address(data[0].get("address", {}))
            _geo_cache[key] = result
            return result
    except Exception:
        pass
    _geo_cache[key] = {}
    return {}


def _geocode_latlon(lat: float, lon: float) -> dict:
    """Reverse-geocode lat/lon → city/state/country via Nominatim.
    Returns {} on any error."""
    key = f"ll:{round(lat, 3)},{round(lon, 3)}"
    if key in _geo_cache:
        return _geo_cache[key]
    try:
        _geo_sleep()
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lon, "format": "json"},
            headers={"User-Agent": _GEO_USER_AGENT},
            timeout=_GEO_TIMEOUT,
        )
        data = resp.json()
        if "address" in data:
            result = _parse_nominatim_address(data["address"])
            _geo_cache[key] = result
            return result
    except Exception:
        pass
    _geo_cache[key] = {}
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
    # BoatName is a vessel custom name (e.g. "Sir Banyan") — NOT a listing title.
    # Keep it for last-resort fallback only.
    boat_name = str(g("BoatName", "listing_title") or "").strip() or None

    # -- Title ----------------------------------------------------------------
    # Always synthesize from year + make + model. BoatName is only used when
    # all three are missing (e.g. a listing with no make/model fields at all).
    if make and model:
        title = f"{year or ''} {make} {model}".strip()
    elif make:
        title = f"{year or ''} {make}".strip()
    elif model:
        title = f"{year or ''} {model}".strip()
    else:
        title = boat_name or None  # absolute last resort

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
    zip_code= str(loc_node.get("BoatZipCode")     or loc_node.get("PostalCode") or loc_node.get("zip") or g("BoatZipCode", "PostalCode", "zip_code") or "").strip() or None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    try:
        v = loc_node.get("Latitude") or loc_node.get("lat") or g("Latitude", "lat")
        latitude = float(v) if v is not None else None
    except (TypeError, ValueError):
        pass
    try:
        v = loc_node.get("Longitude") or loc_node.get("lng") or loc_node.get("lon") or g("Longitude", "lng", "lon")
        longitude = float(v) if v is not None else None
    except (TypeError, ValueError):
        pass

    # -- Fill missing city/state/country from zip or lat/lon via Nominatim ---
    if not (city and state and country):
        geo: dict = {}
        if zip_code:
            geo = _geocode_zip(zip_code)
        if not geo and latitude is not None and longitude is not None:
            geo = _geocode_latlon(latitude, longitude)
        if geo:
            city    = city    or geo.get("city")
            state   = state   or geo.get("state")
            country = country or geo.get("country")

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

    # -- Previous owners ------------------------------------------------------
    previous_owners: Optional[int] = None
    try:
        v = g("PreviousOwners", "NumberOfOwners", "previous_owners", "numOwners")
        previous_owners = int(v) if v is not None else None
    except (TypeError, ValueError):
        pass

    # -- Draft ----------------------------------------------------------------
    draft_node = _parse_nested(g("Draft", "draft"))
    if draft_node:
        dft = draft_node.get("Feet") or draft_node.get("ft") or draft_node.get("feet")
        dm  = draft_node.get("Meters") or draft_node.get("m")
        if dft:
            draft_feet = _yw_to_feet(dft, "feet")
        elif dm:
            draft_feet = _yw_to_feet(dm, "m")

    # -- Cabins / berths / heads / hull ---------------------------------------
    cabins_raw = g("Cabins", "cabins", "Staterooms", "staterooms")
    try:
        cabins = int(cabins_raw) if cabins_raw is not None else None
    except (TypeError, ValueError):
        cabins = None

    berths_raw = g("Berths", "berths", "NumberOfBerths", "SleepingCapacity", "sleeping_capacity")
    try:
        berths = int(berths_raw) if berths_raw is not None else None
    except (TypeError, ValueError):
        berths = None

    heads_raw = g("Heads", "heads", "NumberOfHeads", "Bathrooms", "bathrooms")
    try:
        heads = int(heads_raw) if heads_raw is not None else None
    except (TypeError, ValueError):
        heads = None

    hull_material = str(g("HullMaterial", "hullMaterial", "hull_material", "hull") or "").strip() or None
    hull_type     = str(g("HullType", "hullType", "hull_type", "DesignerOrHullType") or "").strip() or None
    fuel_type     = str(g("FuelType", "fuelType", "fuel_type", "fuel") or "").strip() or None

    # -- Speeds ---------------------------------------------------------------
    max_speed: Optional[float] = None
    cruise_speed: Optional[float] = None
    try:
        v = g("MaxSpeed", "maxSpeed", "max_speed", "TopSpeed")
        max_speed = float(v) if v is not None else None
    except (TypeError, ValueError):
        pass
    try:
        v = g("CruisingSpeed", "cruisingSpeed", "cruising_speed", "CruiseSpeed")
        cruise_speed = float(v) if v is not None else None
    except (TypeError, ValueError):
        pass

    # -- Fuel / water capacity ------------------------------------------------
    fuel_cap: Optional[float] = None
    water_cap: Optional[float] = None
    fc_node = _parse_nested(g("FuelCapacity", "fuelCapacity", "fuel_capacity"))
    if fc_node:
        gal = fc_node.get("Gallons") or fc_node.get("gallons") or fc_node.get("gal")
        lit = fc_node.get("Liters") or fc_node.get("liters") or fc_node.get("ltr")
        if gal:
            try: fuel_cap = float(gal)
            except (TypeError, ValueError): pass
        elif lit:
            try: fuel_cap = round(float(lit) * 0.264172, 1)
            except (TypeError, ValueError): pass
    if fuel_cap is None:
        try:
            v = g("FuelCapacityGallons", "fuel_capacity_gallons")
            fuel_cap = float(v) if v is not None else None
        except (TypeError, ValueError):
            pass

    wc_node = _parse_nested(g("WaterCapacity", "waterCapacity", "water_capacity"))
    if wc_node:
        gal = wc_node.get("Gallons") or wc_node.get("gallons") or wc_node.get("gal")
        lit = wc_node.get("Liters") or wc_node.get("liters") or wc_node.get("ltr")
        if gal:
            try: water_cap = float(gal)
            except (TypeError, ValueError): pass
        elif lit:
            try: water_cap = round(float(lit) * 0.264172, 1)
            except (TypeError, ValueError): pass
    if water_cap is None:
        try:
            v = g("WaterCapacityGallons", "water_capacity_gallons")
            water_cap = float(v) if v is not None else None
        except (TypeError, ValueError):
            pass

    # -- Detailed engines (additional_engines JSON) ---------------------------
    additional_engines: list = []
    if isinstance(engines_raw, list):
        for eng in engines_raw:
            if not isinstance(eng, dict):
                continue
            def _ef(*keys):
                for k in keys:
                    v = eng.get(k)
                    if v is not None and v != "":
                        return v
                return None
            entry: dict = {}
            if _ef("Make", "make"):         entry["make"]         = str(_ef("Make", "make"))
            if _ef("Model", "model"):       entry["model"]        = str(_ef("Model", "model"))
            if _ef("Year", "year"):
                try: entry["year"] = int(_ef("Year", "year"))
                except (TypeError, ValueError): pass
            for hp_key in ("HorsePower", "horsePower", "HP", "hp", "TotalHP", "totalHP"):
                if _ef(hp_key):
                    try: entry["horsepower"] = float(_ef(hp_key)); break
                    except (TypeError, ValueError): pass
            for hr_key in ("Hours", "hours", "EngineHours", "engineHours"):
                if _ef(hr_key):
                    try: entry["hours"] = float(_ef(hr_key)); break
                    except (TypeError, ValueError): pass
            if _ef("Fuel", "fuel", "FuelType", "fuelType"):
                entry["fuel"] = str(_ef("Fuel", "fuel", "FuelType", "fuelType"))
            if _ef("Type", "type", "EngineType", "engineType"):
                entry["type"] = str(_ef("Type", "type", "EngineType", "engineType"))
            if _ef("Drive", "drive", "DriveType", "driveType"):
                entry["drive"] = str(_ef("Drive", "drive", "DriveType", "driveType"))
            if _ef("StrokesNumber", "strokes"):
                try: entry["strokes"] = int(_ef("StrokesNumber", "strokes"))
                except (TypeError, ValueError): pass
            if entry:
                additional_engines.append(entry)

    # -- Generators -----------------------------------------------------------
    generators: list = []
    gens_raw = g("Generators", "generators", "Generator", "generator") or []
    if isinstance(gens_raw, dict):
        gens_raw = [gens_raw]
    if isinstance(gens_raw, list):
        for gen in gens_raw:
            if not isinstance(gen, dict):
                continue
            def _gf(*keys):
                for k in keys:
                    v = gen.get(k)
                    if v is not None and v != "":
                        return v
                return None
            entry = {}
            if _gf("Make", "make"):   entry["make"]  = str(_gf("Make", "make"))
            if _gf("Model", "model"): entry["model"] = str(_gf("Model", "model"))
            if _gf("Year", "year"):
                try: entry["year"] = int(_gf("Year", "year"))
                except (TypeError, ValueError): pass
            for kw_key in ("Kilowatts", "kilowatts", "KW", "kw", "Watts", "watts"):
                if _gf(kw_key):
                    try: entry["kilowatts"] = float(_gf(kw_key)); break
                    except (TypeError, ValueError): pass
            for hr_key in ("Hours", "hours", "GeneratorHours"):
                if _gf(hr_key):
                    try: entry["hours"] = float(_gf(hr_key)); break
                    except (TypeError, ValueError): pass
            if entry:
                generators.append(entry)

    # -- Features / amenities -------------------------------------------------
    feature_bullets: list = []
    feats_raw = g("Features", "features", "Amenities", "amenities", "Equipment", "equipment") or []
    if isinstance(feats_raw, list):
        for f_item in feats_raw:
            if isinstance(f_item, str) and f_item.strip():
                feature_bullets.append(f_item.strip())
            elif isinstance(f_item, dict):
                label = (f_item.get("Feature") or f_item.get("Name") or
                         f_item.get("name") or f_item.get("label") or
                         f_item.get("value") or "")
                if label:
                    feature_bullets.append(str(label).strip())

    # -- Description (try several common field names AND nested nodes) --------
    import re as _re, html as _html

    def _coerce_desc(val):
        """Handle both string and list values (Boats Group returns lists)."""
        if isinstance(val, list):
            # Join all non-empty items — each item is typically one HTML paragraph
            return " ".join(str(s) for s in val if s).strip()
        return str(val).strip() if val else ""

    # 1. Try direct top-level keys — Boats Group API uses GeneralBoatDescription
    _raw_desc = g(
        "GeneralBoatDescription",
        "Description", "HtmlDescription", "BoatDescription", "ListingDescription",
        "DescriptionText", "description", "comments", "Comments",
        "Remarks", "remarks", "body", "content", "overview", "Overview",
    )
    description = _coerce_desc(_raw_desc) or None

    # 2. If still empty, look inside common nested containers
    if not description:
        for container_key in ("BoatDetails", "ListingDetails", "Details", "BoatContent", "Content"):
            node = _parse_nested(rec.get(container_key))
            if node:
                desc_val = (
                    node.get("GeneralBoatDescription") or
                    node.get("Description") or node.get("HtmlDescription")
                    or node.get("BoatDescription") or node.get("description")
                    or node.get("comments") or node.get("Remarks")
                )
                if desc_val:
                    description = _coerce_desc(desc_val) or None
                    break

    # 3. Strip HTML tags to get plain text
    if description and "<" in description:
        description = _re.sub(r"<br\s*/?>", "\n", description, flags=_re.IGNORECASE)
        description = _re.sub(r"</p>", "\n\n", description, flags=_re.IGNORECASE)
        description = _re.sub(r"<[^>]+>", "", description)
        description = _html.unescape(description).strip() or None

    # 4. Last-resort: scan every value (string OR list) in the record
    if not description:
        _best = ""
        def _scan_val(v):
            nonlocal _best
            # Handle list — join items first
            if isinstance(v, list):
                v = " ".join(str(s) for s in v if s)
            if isinstance(v, str) and len(v) > len(_best) and len(v) > 80:
                _best = v
        for _v in rec.values():
            _scan_val(_v)
            if isinstance(_v, dict):
                for _vv in _v.values():
                    _scan_val(_vv)
        if _best:
            if "<" in _best:
                _best = _re.sub(r"<br\s*/?>", "\n", _best, flags=_re.IGNORECASE)
                _best = _re.sub(r"</p>", "\n\n", _best, flags=_re.IGNORECASE)
                _best = _re.sub(r"<[^>]+>", "", _best)
                _best = _html.unescape(_best).strip()
            description = _best or None

    return {
        "_yw_id":                 external_id,
        "title":                  title,
        "make":                   make,
        "model":                  model,
        "year":                   year,
        "price":                  price,
        "currency":               currency,
        "condition":              condition,
        "length_feet":            length_feet,
        "beam_feet":              beam_feet,
        "draft_feet":             draft_feet,
        "boat_type":              boat_type,
        "hull_material":          hull_material,
        "hull_type":              hull_type,
        "city":                   city,
        "state":                  state,
        "country":                country,
        "zip_code":               zip_code,
        "latitude":               latitude,
        "longitude":              longitude,
        "description":            description,
        "images":                 images,
        "fuel_type":              fuel_type,
        "cabins":                 cabins,
        "berths":                 berths,
        "heads":                  heads,
        "engine_count":           engine_count,
        "engine_hours":           engine_hours,
        "max_speed_knots":        max_speed,
        "cruising_speed_knots":   cruise_speed,
        "fuel_capacity_gallons":  fuel_cap,
        "water_capacity_gallons": water_cap,
        "additional_engines":     additional_engines,
        "generators":             generators,
        "feature_bullets":        feature_bullets,
        "previous_owners":        previous_owners,
        "is_sold":                is_sold,
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


def _save_failure(db, job, job_id: int, err_msg: str, run_log: list) -> None:
    """
    Persist a failed-job status to the DB.  Handles the case where the current
    session is already broken (mid-transaction error) by rolling back first,
    and falling back to a brand-new session if that still doesn't work.
    """
    def _do_save(session, j):
        j.status = "failed"
        j.last_error = err_msg
        j.completed_at = datetime.utcnow()
        j.last_run_log = list(run_log)
        session.commit()

    # First attempt: rollback any pending transaction then commit on current session
    try:
        db.rollback()
        _do_save(db, job)
        return
    except Exception:
        pass

    # Second attempt: open a fresh session entirely
    try:
        from app.db.session import SessionLocal
        _fresh = SessionLocal()
        try:
            fresh_job = _fresh.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
            if fresh_job:
                _do_save(_fresh, fresh_job)
        finally:
            _fresh.close()
    except Exception as fe:
        logger.error(f"[YWJob {job_id}] _save_failure gave up: {fe}")


# ---------------------------------------------------------------------------
# IYBA XML Feed helpers
# ---------------------------------------------------------------------------

def _iyba_text(elem, *tags) -> str:
    """
    Return the stripped text of the first matching child element,
    trying each tag in order.  Returns '' if none found.
    Handles both direct children and nested paths like 'Location/City'.
    """
    for tag in tags:
        parts = tag.split("/")
        node = elem
        for part in parts:
            if node is None:
                break
            node = node.find(part)
        if node is not None and node.text:
            return node.text.strip()
    return ""


def _iyba_float(elem, *tags) -> Optional[float]:
    raw = _iyba_text(elem, *tags)
    if not raw:
        return None
    # Strip currency symbols, commas, units like 'ft', 'm', etc.
    cleaned = raw.replace(",", "").split()[0] if raw else ""
    try:
        return float(cleaned)
    except (TypeError, ValueError):
        return None


def _iyba_int(elem, *tags) -> Optional[int]:
    v = _iyba_float(elem, *tags)
    return int(v) if v is not None else None


def _map_iyba_record(listing_elem) -> dict:
    """
    Map a single <Listing> element from an IYBA v3 XML feed to our internal
    normalised data dict (same shape as _map_yw_record output).

    IYBA XML field names vary slightly between brokerages; we try multiple
    common variants for each field.
    """
    g = _iyba_text  # shorthand

    # -- Identity -------------------------------------------------------------
    external_id = (
        g(listing_elem, "MlsNumber", "MLS_Number", "ListingID", "listing_id", "ID")
    )

    # -- Year / Make / Model --------------------------------------------------
    year_raw = g(listing_elem, "Year", "ModelYear", "model_year")
    try:
        year = int(year_raw) if year_raw else None
    except (TypeError, ValueError):
        year = None

    make  = g(listing_elem, "Make", "Manufacturer", "MakeString") or None
    model = g(listing_elem, "Model", "ModelName") or None

    if make and model:
        title = f"{year or ''} {make} {model}".strip()
    elif make:
        title = f"{year or ''} {make}".strip()
    elif model:
        title = f"{year or ''} {model}".strip()
    else:
        title = g(listing_elem, "BoatName", "VesselName", "Title") or None

    # -- Price ----------------------------------------------------------------
    price_raw = g(listing_elem, "Price", "AskingPrice", "ListingPrice")
    currency  = g(listing_elem, "Currency", "CurrencyCode") or "USD"
    price: Optional[float] = None
    try:
        price = float(str(price_raw).replace(",", "").strip()) if price_raw else None
    except (TypeError, ValueError):
        pass

    # -- Status ---------------------------------------------------------------
    status_raw = g(listing_elem, "Status", "SalesStatus", "ListingStatus").lower()
    is_sold = "sold" in status_raw or "under contract" in status_raw or "pending" in status_raw
    condition_raw = g(listing_elem, "Condition", "BoatCondition", "SaleClassCode").lower()
    condition = "new" if condition_raw in ("new", "n") else "used"

    # -- Location -------------------------------------------------------------
    city    = g(listing_elem, "Location/City", "City",  "BoatCity") or None
    state   = g(listing_elem, "Location/State", "State", "BoatState", "StateCode") or None
    country = g(listing_elem, "Location/Country", "Country", "BoatCountry") or None
    zip_code = g(listing_elem, "Location/Zip", "Location/PostalCode", "Zip", "PostalCode", "ZipCode") or None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    try:
        v = g(listing_elem, "Location/Latitude", "Latitude")
        latitude = float(v) if v else None
    except (TypeError, ValueError):
        pass
    try:
        v = g(listing_elem, "Location/Longitude", "Longitude")
        longitude = float(v) if v else None
    except (TypeError, ValueError):
        pass

    # Geocode if location is still incomplete
    if not (city and state and country):
        geo: dict = {}
        if zip_code:
            geo = _geocode_zip(zip_code)
        if not geo and latitude is not None and longitude is not None:
            geo = _geocode_latlon(latitude, longitude)
        if geo:
            city    = city    or geo.get("city")
            state   = state   or geo.get("state")
            country = country or geo.get("country")

    # -- Boat type ------------------------------------------------------------
    boat_type = g(listing_elem, "BoatType", "Category", "Type", "VesselType") or None

    # -- Dimensions -----------------------------------------------------------
    length_feet  = _iyba_float(listing_elem, "LengthFeet", "LenghtFeet", "Length", "LOA")
    if length_feet is None:
        # Some feeds give length in meters
        len_m = _iyba_float(listing_elem, "LengthMeters", "LengthM")
        if len_m:
            length_feet = round(len_m * 3.28084, 2)
    beam_feet  = _iyba_float(listing_elem, "BeamFeet", "Beam")
    if beam_feet is None:
        bm = _iyba_float(listing_elem, "BeamMeters")
        if bm:
            beam_feet = round(bm * 3.28084, 2)
    draft_feet = _iyba_float(listing_elem, "DraftFeet", "Draft")
    if draft_feet is None:
        dm = _iyba_float(listing_elem, "DraftMeters")
        if dm:
            draft_feet = round(dm * 3.28084, 2)

    # -- Engine / technical ---------------------------------------------------
    engine_hours  = _iyba_float(listing_elem, "EngineHours", "Hours", "TotalEngineHours")
    engine_count  = _iyba_int(listing_elem,   "NumberOfEngines", "EngineCount", "Engines")
    hull_material = g(listing_elem, "HullMaterial", "Hull", "HullType") or None
    hull_type     = g(listing_elem, "DesignerOrHullType", "HullDesign") or None
    fuel_type     = g(listing_elem, "FuelType", "Fuel") or None
    cabins        = _iyba_int(listing_elem, "Cabins", "Staterooms", "Cabins")
    heads         = _iyba_int(listing_elem, "Heads", "Bathrooms")
    berths        = _iyba_int(listing_elem, "Berths", "Sleeping")

    # -- Description ----------------------------------------------------------
    description = (
        g(listing_elem, "Description", "Comments", "Remarks", "Overview", "Notes")
        or None
    )

    # -- Images ---------------------------------------------------------------
    images: list[str] = []
    # <Photos><Photo>url</Photo></Photos>
    photos_node = listing_elem.find("Photos")
    if photos_node is not None:
        for photo in photos_node.findall("Photo"):
            url = (photo.text or "").strip()
            if url.startswith("http"):
                images.append(url)
    # Fallback: <Images><Image><Url>url</Url></Image></Images>
    if not images:
        images_node = listing_elem.find("Images")
        if images_node is not None:
            for img in images_node:
                url = (
                    (img.find("Url") or img.find("URL") or img.find("Uri") or img).text or ""
                ).strip()
                if url.startswith("http"):
                    images.append(url)
    # Some feeds put a single <PhotoUrl> or <PrimaryPhoto>
    if not images:
        for tag in ("PhotoUrl", "PrimaryPhoto", "MainPhoto", "ImageUrl"):
            v = g(listing_elem, tag)
            if v and v.startswith("http"):
                images.append(v)
                break

    return {
        "_yw_id":                 external_id,
        "title":                  title,
        "year":                   year,
        "make":                   make,
        "model":                  model,
        "price":                  price,
        "currency":               currency,
        "condition":              condition,
        "boat_type":              boat_type,
        "length_feet":            length_feet,
        "beam_feet":              beam_feet,
        "draft_feet":             draft_feet,
        "hull_material":          hull_material,
        "hull_type":              hull_type,
        "city":                   city,
        "state":                  state,
        "country":                country,
        "zip_code":               zip_code,
        "latitude":               latitude,
        "longitude":              longitude,
        "description":            description,
        "images":                 images,
        "fuel_type":              fuel_type,
        "cabins":                 cabins,
        "berths":                 berths,
        "heads":                  heads,
        "engine_count":           engine_count,
        "engine_hours":           engine_hours,
        "is_sold":                is_sold,
    }


def _sync_iyba_feed(job, db, run_log: list, stats: dict, seen_source_urls: set) -> None:
    """
    Fetch and process an IYBA XML feed URL.  Modifies run_log, stats, and
    seen_source_urls in-place.  Raises on unrecoverable errors.

    The feed URL is stored in job.api_endpoint.  No API key is required.
    """
    import xml.etree.ElementTree as ET

    job_id = job.id
    feed_url = (job.api_endpoint or "").strip()

    def _log(level: str, msg: str):
        entry = {"t": _ts(), "level": level, "msg": msg}
        run_log.append(entry)
        log_fn = logger.error if level == "error" else (logger.warning if level == "warn" else logger.info)
        log_fn(f"[IYBAJob {job_id}] {msg}")

    proxy_url = os.getenv("SCRAPER_PROXY_URL", "").strip()
    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None

    _log("info", f"Fetching IYBA XML feed: {feed_url}" + (f" via {_mask_proxy(proxy_url)}" if proxy_url else " (direct)"))

    try:
        resp = requests.get(
            feed_url,
            headers={"User-Agent": "YachtVersal/1.0"},
            timeout=60,
            verify=False,
            proxies=proxies,
        )
        resp.raise_for_status()
    except Exception as exc:
        raise RuntimeError(f"IYBA feed fetch failed: {exc}") from exc

    _log("info", f"Downloaded {len(resp.content):,} bytes — parsing XML…")

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError as exc:
        raise RuntimeError(f"IYBA XML parse error: {exc}") from exc

    # Support both <YachtListing><Listing> and <Listings><Listing> roots
    listing_elems = root.findall(".//Listing")
    if not listing_elems:
        listing_elems = list(root)

    _log("info", f"Found {len(listing_elems)} listing elements in feed")

    for elem in listing_elems:
        raw = _map_iyba_record(elem)
        external_id = raw.pop("_yw_id", "")
        raw["_yw_ext_id"] = external_id

        source_url = f"{feed_url}#id={external_id}" if external_id else None
        if not source_url:
            stats["errors"] += 1
            _log("error", f"No listing ID found in element — skipping")
            continue

        seen_source_urls.add(source_url)
        is_sold = bool(raw.get("is_sold"))

        try:
            existing = (
                db.query(Listing)
                .filter(
                    Listing.user_id == job.dealer_id,
                    Listing.source_url == source_url,
                    Listing.deleted_at.is_(None),
                )
                .first()
            )

            def _apply_json_fields(lst):
                if raw.get("condition"):
                    lst.condition = raw["condition"]
                if raw.get("zip_code"):
                    lst.zip_code = raw["zip_code"]
                if raw.get("latitude") is not None:
                    lst.latitude = raw["latitude"]
                if raw.get("longitude") is not None:
                    lst.longitude = raw["longitude"]
                if raw.get("_yw_ext_id"):
                    lst.external_id = raw["_yw_ext_id"]

            if existing:
                _apply_scraped_data(existing, raw, job)
                _apply_json_fields(existing)
                if is_sold:
                    existing.status = "sold"
                elif existing.status not in ("draft", "awaiting_review"):
                    existing.status = "active"
                if raw.get("images"):
                    db.query(ListingImage).filter(ListingImage.listing_id == existing.id).delete()
                    for img_url in raw["images"]:
                        db.add(ListingImage(listing_id=existing.id, url=img_url))
                stats["updated"] += 1
                run_log.append({"url": source_url, "outcome": "sold" if is_sold else "updated",
                                "listing_id": existing.id, "title": existing.title})
            else:
                listing = Listing(
                    user_id=job.dealer_id,
                    assigned_salesman_id=job.salesman_id,
                    source="scraped",
                    source_url=source_url,
                    status="awaiting_review" if not is_sold else "sold",
                    condition=raw.get("condition") or "used",
                )
                try:
                    listing.bin = _generate_yw_bin(db)
                except Exception:
                    pass
                _apply_scraped_data(listing, raw, job)
                _apply_json_fields(listing)
                db.add(listing)
                db.flush()
                for img_url in raw.get("images", []):
                    db.add(ListingImage(listing_id=listing.id, url=img_url))
                stats["created"] += 1
                run_log.append({"url": source_url, "outcome": "created",
                                "listing_id": listing.id, "title": listing.title})
            db.commit()
        except Exception as rec_exc:
            try:
                db.rollback()
            except Exception:
                pass
            stats["errors"] += 1
            _log("error", f"Failed to save record {source_url}: {rec_exc}")

        stats["found"] += 1
        job.listings_found = stats["found"]
        db.commit()

    # Flush progress
    job.last_run_log = list(run_log)
    db.commit()


# ---------------------------------------------------------------------------
# Main sync function
# ---------------------------------------------------------------------------

def sync_yachtworld_job(job_id: int, db) -> Dict:
    """
    Sync a YachtworldSyncJob.  Dispatches to the appropriate handler based on
    job.feed_type:

      'boats_group' (default) — Boats Group / YachtWorld REST API (JSON, paginated)
      'iyba'                  — IYBA XML feed URL (no API key required)

    Listing upsert uses the same ScrapedListing / Listing mechanism as the
    HTML scraper for consistency and archive detection.
    """
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

    feed_type = (job.feed_type or "boats_group").lower()

    # -----------------------------------------------------------------------
    # IYBA XML feed path
    # -----------------------------------------------------------------------
    if feed_type == "iyba":
        _log("info", f"Feed type: IYBA XML — endpoint: {job.api_endpoint}")
        job.last_run_log = list(run_log)
        db.commit()
        try:
            _sync_iyba_feed(job, db, run_log, stats, seen_source_urls)

            # Archive listings from this feed that are no longer present
            feed_url = (job.api_endpoint or "").strip()
            prev_active = (
                db.query(Listing)
                .filter(
                    Listing.user_id == job.dealer_id,
                    Listing.source == "scraped",
                    Listing.source_url.like(f"{feed_url}%"),
                    Listing.status == "active",
                    Listing.deleted_at.is_(None),
                )
                .all()
            )
            for lst in prev_active:
                if lst.source_url not in seen_source_urls:
                    lst.status = "archived"
                    stats["archived"] += 1
                    run_log.append({"url": lst.source_url, "outcome": "archived", "listing_id": lst.id})

            summary = (f"IYBA sync complete — found={stats['found']} "
                       f"created={stats['created']} updated={stats['updated']} "
                       f"archived={stats['archived']} errors={stats['errors']}")
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
            logger.error(f"[YWJob {job_id}] IYBA sync failed: {exc}")
            try:
                _log("error", f"Unexpected error: {err_msg}")
            except Exception:
                pass
            _save_failure(db, job, job_id, err_msg, run_log)
            return {"success": False, "error": err_msg}

    # -----------------------------------------------------------------------
    # Boats Group / YachtWorld REST API path (default)
    # -----------------------------------------------------------------------
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
                _save_failure(db, job, job_id, err_msg, run_log)
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

            # Diagnostic: log all top-level keys from the first record of the first
            # page so we can verify which fields the API is actually returning.
            if page_num == 1 and records:
                _first_rec = records[0]
                _first_keys = sorted(_first_rec.keys())
                # Check every known description key variant
                _desc_candidates = {
                    k: _first_rec[k] for k in _first_rec
                    if any(s in k.lower() for s in ("desc", "comment", "remark", "body", "content", "overview", "note", "text"))
                }
                _log("info", f"API record keys (first record): {_first_keys}")
                _log("info", f"Description-like keys in first record: {list(_desc_candidates.keys())}")
                if _desc_candidates:
                    for _dk, _dv in list(_desc_candidates.items())[:5]:
                        _log("info", f"  [{_dk}] = {str(_dv)[:300]}")
                else:
                    _log("warn", "No description-like keys found in first record — dumping all string values > 80 chars:")
                    for _k, _v in list(_first_rec.items())[:40]:
                        if isinstance(_v, str) and len(_v) > 80:
                            _log("info", f"  [{_k}] = {_v[:300]}")
                        elif isinstance(_v, dict):
                            for _sk, _sv in list(_v.items())[:10]:
                                if isinstance(_sv, str) and len(_sv) > 80:
                                    _log("info", f"  [{_k}.{_sk}] = {_sv[:300]}")
                # Also log the first record's mapped output so we can see what _map_yw_record extracted
                _mapped_sample = _map_yw_record(_first_rec)
                _log("info", f"After mapping — description={repr(_mapped_sample.get('description', '__MISSING__'))[:200]}")

            for rec in records:
                raw = _map_yw_record(rec)
                external_id = raw.pop("_yw_id", "")
                raw["_yw_ext_id"] = external_id  # keep for _apply_json_fields

                source_url = f"{base_url}?id={external_id}" if external_id else None
                if not source_url:
                    stats["errors"] += 1
                    _log("error", f"No listing ID found in record — keys: {list(rec.keys())[:15]}")
                    continue

                seen_source_urls.add(source_url)
                is_sold = bool(raw.get("is_sold"))

                try:
                    existing = (
                        db.query(Listing)
                        .filter(
                            Listing.user_id == job.dealer_id,
                            Listing.source_url == source_url,
                            Listing.deleted_at.is_(None),
                        )
                        .first()
                    )

                    def _apply_json_fields(lst):
                        """Apply fields not handled by _apply_scraped_data."""
                        if raw.get("additional_engines"):
                            lst.additional_engines = raw["additional_engines"]
                        if raw.get("generators"):
                            lst.generators = raw["generators"]
                        # Scalar fields _apply_scraped_data doesn't cover
                        if raw.get("condition"):
                            lst.condition = raw["condition"]
                        if raw.get("zip_code"):
                            lst.zip_code = raw["zip_code"]
                        if raw.get("latitude") is not None:
                            lst.latitude = raw["latitude"]
                        if raw.get("longitude") is not None:
                            lst.longitude = raw["longitude"]
                        if raw.get("previous_owners") is not None:
                            lst.previous_owners = raw["previous_owners"]
                        # Store DocumentID in external_id for deduplication / reference
                        if raw.get("_yw_ext_id"):
                            lst.external_id = raw["_yw_ext_id"]

                    if existing:
                        _apply_scraped_data(existing, raw, job)
                        _apply_json_fields(existing)
                        if is_sold:
                            existing.status = "sold"
                        elif existing.status not in ("draft", "awaiting_review"):
                            existing.status = "active"
                        if raw.get("images"):
                            db.query(ListingImage).filter(ListingImage.listing_id == existing.id).delete()
                            for img_url in raw["images"]:
                                db.add(ListingImage(listing_id=existing.id, url=img_url))
                        stats["updated"] += 1
                        run_log.append({"url": source_url, "outcome": "sold" if is_sold else "updated",
                                        "listing_id": existing.id, "title": existing.title})
                    else:
                        listing = Listing(
                            user_id=job.dealer_id,
                            assigned_salesman_id=job.salesman_id,
                            source="scraped",
                            source_url=source_url,
                            status="awaiting_review" if not is_sold else "sold",
                            condition=raw.get("condition") or "used",
                        )
                        try:
                            listing.bin = _generate_yw_bin(db)
                        except Exception:
                            pass
                        _apply_scraped_data(listing, raw, job)
                        _apply_json_fields(listing)
                        db.add(listing)
                        db.flush()
                        for img_url in raw.get("images", []):
                            db.add(ListingImage(listing_id=listing.id, url=img_url))
                        stats["created"] += 1
                        run_log.append({"url": source_url, "outcome": "created",
                                        "listing_id": listing.id, "title": listing.title})
                    db.commit()
                except Exception as rec_exc:
                    # Roll back this record's changes and continue with the next one.
                    # Without rollback here, SQLAlchemy marks the session as broken
                    # and every subsequent db call in this thread fails.
                    try:
                        db.rollback()
                    except Exception:
                        pass
                    stats["errors"] += 1
                    err_detail = f"{source_url}: {rec_exc}"
                    _log("error", f"Failed to save record ({err_detail})")
                    logger.error(f"[YWJob {job_id}] Record save error: {rec_exc}")

            # Flush progress log to DB after each page so the UI can display it
            job.last_run_log = list(run_log)
            db.commit()

            if len(records) < ROWS:
                break
            offset += ROWS

        # Archive listings from previous runs no longer in the feed:
        # find all active listings for this dealer whose source_url comes from this endpoint
        prev_active = (
            db.query(Listing)
            .filter(
                Listing.user_id == job.dealer_id,
                Listing.source == "scraped",
                Listing.source_url.like(f"{base_url}%"),
                Listing.status == "active",
                Listing.deleted_at.is_(None),
            )
            .all()
        )
        for lst in prev_active:
            if lst.source_url not in seen_source_urls:
                lst.status = "archived"
                stats["archived"] += 1
                run_log.append({"url": lst.source_url, "outcome": "archived", "listing_id": lst.id})

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
        logger.error(f"[YWJob {job_id}] Sync failed: {exc}")
        try:
            _log("error", f"Unexpected error: {err_msg}")
        except Exception:
            pass
        _save_failure(db, job, job_id, err_msg, run_log)
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
