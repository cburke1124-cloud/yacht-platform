"""NautiX (https://nautix.nautic-network.org) XML boat-listing feed.

A broker's CRM publishes one XML file containing all of their adverts. This
module fetches it, maps each ``<advert>`` onto the same normalised dict the
other feed importers produce (see yachtworld_api._map_iyba_json_record), and
upserts the listings. It plugs into the shared feed-job machinery
(YachtworldSyncJob, feed_type="nautix") — scheduling, run logs and the
"archive anything no longer in the feed" safety check are all shared.

Photos are linked from the broker's own image server rather than downloaded:
a feed carries ~30 photos per boat and re-hosting thousands of them in one run
would exceed the job time limit. They are only rewritten when the set changes.
"""
import html as _html
import logging
import re
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

import requests

try:  # safer parsing of third-party XML when available
    from defusedxml import ElementTree as ET
except Exception:  # pragma: no cover - fall back to the stdlib parser
    import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

NAUTIX_FETCH_TIMEOUT = 120
MAX_IMAGES_PER_LISTING = 30
MAX_FEATURE_BULLETS = 15
DESCRIPTION_LANGS = ("en", "nl", "de", "fr")

_M_TO_FT = 3.28084
_L_TO_GAL = 0.264172

_COUNTRY_NAMES = {
    "NL": "Netherlands", "BE": "Belgium", "DE": "Germany", "FR": "France", "ES": "Spain",
    "IT": "Italy", "PT": "Portugal", "GB": "United Kingdom", "UK": "United Kingdom",
    "IE": "Ireland", "DK": "Denmark", "SE": "Sweden", "NO": "Norway", "FI": "Finland",
    "PL": "Poland", "GR": "Greece", "HR": "Croatia", "TR": "Turkey", "CH": "Switzerland",
    "AT": "Austria", "MT": "Malta", "CY": "Cyprus", "US": "USA", "CA": "Canada",
}

_TYPE_MAP = {
    "sail-yacht": "Sailing Yacht",
    "sail-flat": "Sailing Yacht",
    "sail-classic": "Sailing Yacht",
    "sail-daysailer": "Sailing Yacht",
    "sail-motorsailer": "Motorsailer",
    "sail-catamaran": "Catamaran",
    "power-yacht": "Motor Yacht",
    "power-houseboat": "Motor Yacht",
    "power-sloep": "Motor Yacht",
    "power-utility": "Motor Yacht",
    "power-classic": "Motor Yacht",
    "power-sport": "Motor Yacht",
    "power-hull": "Motor Yacht",
}

_HULL_MAP = {
    "grp": "Fiberglass", "fiberglass": "Fiberglass", "polyester": "Fiberglass",
    "steel": "Steel", "aluminum": "Aluminum", "aluminium": "Aluminum",
    "wood": "Wood", "carbon": "Carbon Fiber", "composite": "Composite",
}

_FUEL_MAP = {
    "diesel": "Diesel", "gasoline": "Gasoline", "petrol": "Gasoline", "gas": "Gasoline",
    "electric": "Electric", "hybrid": "Hybrid",
}

_ACRONYMS = {"vhf", "gps", "tv", "dvd", "cd", "ais", "led", "usb", "wifi", "radar", "gps"}


def _local(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def _child(el, name: str):
    """First direct child with this local name (namespace-agnostic)."""
    if el is None:
        return None
    for c in el:
        if _local(c.tag) == name:
            return c
    return None


def _children(el, name: str) -> list:
    if el is None:
        return []
    return [c for c in el if _local(c.tag) == name]


def _find(el, *path):
    for name in path:
        el = _child(el, name)
        if el is None:
            return None
    return el


def _text(el, *path) -> Optional[str]:
    node = _find(el, *path) if path else el
    if node is None or node.text is None:
        return None
    t = node.text.strip()
    return t or None


def _num(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def _int_attr(el, attr: str) -> Optional[int]:
    if el is None:
        return None
    n = _num(el.attrib.get(attr))
    return int(n) if n is not None else None


def _to_feet(el) -> Optional[float]:
    """Length element with a unit attribute (m / ft / cm) -> feet."""
    n = _num(el.text) if el is not None else None
    if n is None or n <= 0:
        return None
    unit = (el.attrib.get("unit") or "m").lower()
    if unit in ("ft", "feet"):
        return round(n, 2)
    if unit == "cm":
        n = n / 100.0
    return round(n * _M_TO_FT, 2)


def _clean_description(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    text = re.sub(r"<br\s*/?>", "\n", raw, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = _html.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text or None


def _humanize(key: str) -> str:
    words = key.replace("_", " ").split()
    return " ".join(w.upper() if w.lower() in _ACRONYMS else w.capitalize() for w in words)


def _equipment_bullets(equipment) -> list:
    """Flatten equipment_data's <group><item>true</item></group> tree into labels."""
    out: list = []
    if equipment is None:
        return out

    def walk(node):
        for c in node:
            name = _local(c.tag)
            if len(c):
                walk(c)
            elif (c.text or "").strip().lower() == "true":
                out.append(_humanize(name))
    walk(equipment)
    seen, unique = set(), []
    for item in out:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def parse_nautix_root(xml_bytes: bytes):
    root = ET.fromstring(xml_bytes)
    if _local(root.tag).lower() != "nautix":
        raise RuntimeError(f"Not a NautiX feed (root element is <{_local(root.tag)}>)")
    return root


def iter_adverts(root):
    account = _child(root, "account")
    adverts = _child(account if account is not None else root, "adverts")
    return _children(adverts, "advert")


def map_nautix_advert(advert) -> Optional[dict]:
    """Map one <advert> to our normalised listing dict, or None to skip it
    (not a boat for sale / not active)."""
    if advert.attrib.get("purpose", "sale").lower() != "sale":
        return None
    if advert.attrib.get("type", "boat").lower() != "boat":
        return None
    status = advert.attrib.get("status", "active").lower()
    is_sold = status == "sold"
    if status not in ("active", "sold"):
        return None

    external_id = advert.attrib.get("id", "").strip()
    if not external_id:
        return None

    boat = _child(advert, "boat_data")
    sale = _child(advert, "sale_data")
    ad_data = _child(advert, "advert_data")

    manufacturer = _text(boat, "manufacturer")
    model = _text(boat, "model")
    boat_name = _text(boat, "boat_name")
    year = None
    y = _num(_text(boat, "year_built"))
    if y and 1800 <= y <= 2100:
        year = int(y)

    make_for_title = manufacturer if (manufacturer or "").lower() not in ("", "custom") else None
    parts = [str(year) if year else None, make_for_title, model]
    title = " ".join(p for p in parts if p).strip() or boat_name or f"Boat {external_id}"

    # price
    price = None
    currency = "EUR"
    price_el = _child(sale, "price")
    if price_el is not None:
        currency = (price_el.attrib.get("currency") or "EUR").upper()
        if (price_el.attrib.get("type") or "fixed").lower() == "fixed":
            p = _num(price_el.text)
            price = p if p and p > 0 else None

    cls = (_text(sale, "sale_class") or "used").lower()
    condition = "new" if cls.startswith("new") else "used"

    # location
    loc = _child(sale, "location")
    city = (loc.text or "").strip() or None if loc is not None else None
    country_code = (loc.attrib.get("country") or "").strip().upper() if loc is not None else ""
    country = _COUNTRY_NAMES.get(country_code, country_code or None)

    # type / hull / fuel
    type_slug = None
    types = _child(boat, "boat_types")
    for t in _children(types, "type"):
        if t.attrib.get("primary", "").lower() == "true" or type_slug is None:
            type_slug = (t.text or "").strip().lower() or type_slug
    boat_type = _TYPE_MAP.get(type_slug or "")
    if not boat_type and type_slug:
        boat_type = "Sailing Yacht" if type_slug.startswith("sail") else "Other"

    hull_raw = (_text(boat, "hull", "material") or "").lower()
    hull_material = _HULL_MAP.get(hull_raw) or ("Other" if hull_raw else None)

    # dimensions
    dims = _child(boat, "dimensions")
    length_feet = _to_feet(_child(dims, "loa")) or _to_feet(_child(dims, "lwl"))
    beam_feet = _to_feet(_child(dims, "beam"))
    draft_feet = _to_feet(_child(dims, "draught")) or _to_feet(_child(dims, "draft"))

    # accommodation
    acc = _child(boat, "accommodation")
    cabins = _int_attr(_child(acc, "cabins"), "total")
    berths = _int_attr(_child(acc, "berths"), "total")
    heads = _int_attr(_child(acc, "toilets"), "total")

    # drive / engines
    drive = _child(boat, "drive")
    engine_count = None
    n = _num(_text(drive, "number_of_engines"))
    if n:
        engine_count = int(n)
    max_speed = _num(_text(drive, "max_speed"))
    cruise_speed = _num(_text(drive, "cruising_speed"))

    engines = _children(_child(advert, "engine_data"), "engine")
    engine_hours = None
    fuel_type = None
    additional_engines = []
    for idx, eng in enumerate(engines):
        hours = _num(_text(eng, "hours"))
        if idx == 0:
            engine_hours = hours
            fuel_raw = (_text(eng, "fuel") or "").lower()
            fuel_type = _FUEL_MAP.get(fuel_raw) or (fuel_raw.capitalize() if fuel_raw else None)
            if engine_count is None:
                engine_count = len(engines)
        else:
            power = _child(eng, "power")
            hp = _num(power.text) if power is not None else None
            if power is not None and hp and (power.attrib.get("unit") or "hp").lower() == "kw":
                hp = round(hp * 1.34102, 1)
            additional_engines.append({
                "make": _text(eng, "manufacturer"), "model": _text(eng, "model"),
                "type": _text(eng, "engine_type"), "hours": hours, "horsepower": hp, "notes": None,
            })

    # tanks
    tanks = _child(boat, "tanks")

    def tank_gallons(name):
        t = _child(tanks, name)
        if t is None:
            return None
        vol = _num(t.attrib.get("volume"))
        if not vol:
            return None
        unit = (t.attrib.get("unit") or "l").lower()
        return round(vol if unit.startswith("gal") else vol * _L_TO_GAL, 1)

    # description: prefer English, then the others in order
    desc_by_lang = {}
    for t in _children(_child(ad_data, "marketing_description"), "text"):
        desc_by_lang[(t.attrib.get("language") or "").lower()] = t.text
    description = None
    for lang in DESCRIPTION_LANGS:
        description = _clean_description(desc_by_lang.get(lang))
        if description:
            break
    if not description:
        for raw in desc_by_lang.values():
            description = _clean_description(raw)
            if description:
                break

    # photos
    images: list = []
    for img in _children(_find(advert, "media", "images"), "image"):
        url = (img.text or "").strip()
        if url.startswith("http") and url not in images:
            images.append(url)
        if len(images) >= MAX_IMAGES_PER_LISTING:
            break

    feature_bullets = _equipment_bullets(_child(advert, "equipment_data"))[:MAX_FEATURE_BULLETS]

    return {
        "_yw_id": external_id,
        "title": title,
        "make": manufacturer if make_for_title else None,
        "model": model,
        "year": year,
        "price": price,
        "currency": currency,
        "condition": condition,
        "boat_type": boat_type,
        "length_feet": length_feet,
        "beam_feet": beam_feet,
        "draft_feet": draft_feet,
        "hull_material": hull_material,
        "fuel_type": fuel_type,
        "cabins": cabins,
        "berths": berths,
        "heads": heads,
        "engine_count": engine_count,
        "engine_hours": engine_hours,
        "max_speed_knots": max_speed,
        "cruising_speed_knots": cruise_speed,
        "fuel_capacity_gallons": tank_gallons("fuel"),
        "water_capacity_gallons": tank_gallons("freshwater"),
        "city": city,
        "state": None,
        "country": country,
        "zip_code": None,
        "latitude": None,
        "longitude": None,
        "description": description,
        "images": images,
        "feature_bullets": feature_bullets,
        "additional_engines": additional_engines,
        "generators": [],
        "is_sold": is_sold,
    }


def _feed_base_url(endpoint: str) -> str:
    s = urlsplit((endpoint or "").strip())
    return urlunsplit((s.scheme, s.netloc, s.path, "", ""))


def fetch_nautix_feed(endpoint: str) -> bytes:
    resp = requests.get(
        endpoint.strip(),
        timeout=NAUTIX_FETCH_TIMEOUT,
        headers={"User-Agent": "YachtVersal/1.0 (+https://yachtversal.com)", "Accept": "application/xml,text/xml,*/*"},
    )
    resp.raise_for_status()
    if not resp.content:
        raise RuntimeError("NautiX feed returned an empty response")
    return resp.content


def sync_nautix_feed(job, db, run_log: list, stats: dict, seen_source_urls: set) -> None:
    """Fetch + upsert every advert in the feed. Same contract as _sync_iyba_feed:
    mutates run_log / stats / seen_source_urls; raises on unrecoverable errors."""
    # Imported here: yachtworld_api imports this module lazily, and these
    # helpers live next to the other feed importers.
    from app.models.listing import Listing, ListingImage
    from app.services.scraper import _apply_scraped_data
    from app.services.yachtworld_api import _generate_yw_bin, _ts

    job_id = job.id
    base_url = _feed_base_url(job.api_endpoint)

    def _log(level: str, msg: str):
        run_log.append({"t": _ts(), "level": level, "msg": msg})
        fn = logger.error if level == "error" else (logger.warning if level == "warn" else logger.info)
        fn(f"[NautiXJob {job_id}] {msg}")

    _log("info", f"Fetching NautiX feed: {base_url}")
    job.last_run_log = list(run_log)
    db.commit()

    root = parse_nautix_root(fetch_nautix_feed(job.api_endpoint))
    adverts = iter_adverts(root)
    _log("info", f"Feed contains {len(adverts)} adverts")
    if not adverts:
        raise RuntimeError("NautiX feed contains no adverts — refusing to treat that as 'everything sold'")

    skipped = 0
    for advert in adverts:
        ext_id = advert.attrib.get("id", "")
        try:
            raw = map_nautix_advert(advert)
        except Exception as exc:
            stats["errors"] += 1
            _log("error", f"Could not read advert {ext_id}: {exc}")
            continue
        if raw is None:
            skipped += 1
            continue

        external_id = raw.pop("_yw_id")
        source_url = f"{base_url}#id={external_id}"
        seen_source_urls.add(source_url)
        is_sold = bool(raw.get("is_sold"))
        new_images = raw.get("images") or []

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
            if existing:
                _apply_scraped_data(existing, raw, job)
                existing.external_id = external_id
                if is_sold:
                    existing.status = "sold"
                elif existing.status not in ("draft", "awaiting_review"):
                    existing.status = "active"
                if new_images:
                    current = [i.url for i in db.query(ListingImage).filter(ListingImage.listing_id == existing.id).all()]
                    if current != new_images:
                        db.query(ListingImage).filter(ListingImage.listing_id == existing.id).delete()
                        for url in new_images:
                            db.add(ListingImage(listing_id=existing.id, url=url))
                stats["updated"] += 1
                run_log.append({"url": source_url, "outcome": "sold" if is_sold else "updated",
                                "listing_id": existing.id, "title": existing.title})
            else:
                listing = Listing(
                    user_id=job.dealer_id,
                    assigned_salesman_id=job.salesman_id,
                    source="scraped",
                    source_url=source_url,
                    status="sold" if is_sold else "awaiting_review",
                    condition=raw.get("condition") or "used",
                )
                try:
                    listing.bin = _generate_yw_bin(db)
                except Exception:
                    pass
                _apply_scraped_data(listing, raw, job)
                listing.external_id = external_id
                db.add(listing)
                db.flush()
                for url in new_images:
                    db.add(ListingImage(listing_id=listing.id, url=url))
                stats["created"] += 1
                run_log.append({"url": source_url, "outcome": "created",
                                "listing_id": listing.id, "title": listing.title})
            db.commit()
        except Exception as exc:
            try:
                db.rollback()
            except Exception:
                pass
            stats["errors"] += 1
            _log("error", f"Failed to save advert {external_id}: {exc}")

        stats["found"] += 1
        job.listings_found = stats["found"]
        if stats["found"] % 50 == 0:
            job.last_run_log = list(run_log)
            db.commit()

    if skipped:
        _log("info", f"Skipped {skipped} adverts that are not active boats for sale")
    job.last_run_log = list(run_log)
    db.commit()
