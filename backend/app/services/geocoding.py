"""
Best-effort geocoding for listing locations, via Google's Geocoding API
(reuses GOOGLE_MAPS_API_KEY, already configured server-side for the maps
endpoint in routes_profiles.py — same key as the frontend's map display).

Every failure mode (no API key, network error, no match, malformed response)
returns (None, None) rather than raising — a listing must never fail to
save just because geocoding didn't work.
"""
import logging
import os
from typing import Optional, Tuple

import requests

logger = logging.getLogger(__name__)

_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def geocode_location(
    city: Optional[str],
    state: Optional[str] = None,
    country: Optional[str] = None,
    zip_code: Optional[str] = None,
) -> Tuple[Optional[float], Optional[float]]:
    """Look up (latitude, longitude) for a location from its address parts."""
    parts = [p.strip() for p in (city, state, zip_code, country) if p and p.strip()]
    if not parts:
        return None, None

    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        logger.debug("geocode_location: GOOGLE_MAPS_API_KEY not set, skipping")
        return None, None

    address = ", ".join(parts)
    try:
        resp = requests.get(
            _GEOCODE_URL,
            params={"address": address, "key": api_key},
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning(f"geocode_location: request failed for {address!r}: {exc}")
        return None, None

    status = data.get("status")
    if status != "OK":
        # ZERO_RESULTS is routine (bad/partial address) — only log unexpected
        # statuses (REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST, etc.)
        if status != "ZERO_RESULTS":
            logger.warning(f"geocode_location: API returned {status!r} for {address!r}")
        return None, None

    results = data.get("results") or []
    if not results:
        return None, None

    location = (results[0].get("geometry") or {}).get("location") or {}
    lat, lng = location.get("lat"), location.get("lng")
    if lat is None or lng is None:
        return None, None
    return float(lat), float(lng)


def needs_geocoding(listing, new_city=None, new_state=None, new_country=None, new_zip_code=None) -> bool:
    """True if an update payload changes location fields (or the listing has
    location but no coordinates yet), so callers know whether to re-geocode
    rather than doing it unconditionally on every save."""
    if listing.latitude is None or listing.longitude is None:
        return bool((new_city or listing.city) or (new_state or listing.state) or (new_country or listing.country))
    for new_value, current_value in (
        (new_city, listing.city),
        (new_state, listing.state),
        (new_country, listing.country),
        (new_zip_code, listing.zip_code),
    ):
        if new_value is not None and new_value != current_value:
            return True
    return False
