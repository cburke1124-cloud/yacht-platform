"""
Optimized Yacht Scraper - Hybrid AI + Traditional Extraction
- Uses AI only when necessary
- Structured extraction first (CSS selectors, regex)
- AI fallback only for missing critical fields
- Full job-based sync: discover â†’ scrape â†’ create/update â†’ archive disappeared
"""

import anthropic
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
import os as _os
import random
import time
import traceback
from bs4 import BeautifulSoup
import json
import re
from typing import Optional, Dict, List, Tuple, Any
from urllib.parse import urljoin, urlparse, unquote
from datetime import datetime, timedelta
import logging


class _AnthropicCreditsExhausted(Exception):
    """Raised when the Anthropic API rejects a request due to billing/credit exhaustion.
    Caught by run_scraper_job to immediately pause the job rather than wasting further
    API calls that will all fail for the same reason."""

# Optional proxy for sites that IP-block cloud provider ranges (e.g. Render/AWS).
# Set SCRAPER_PROXY_URL to route fetch_page and headless requests through a
# residential/rotating proxy — e.g. an HTTP proxy from ScraperAPI, BrightData, etc.
# Format: http://user:pass@host:port  OR  socks5://user:pass@host:port
# If unset, direct connections are used (works for most sites).
_SCRAPER_PROXY_URL: str = _os.getenv('SCRAPER_PROXY_URL', '')

# curl-cffi: Chrome TLS impersonation for Cloudflare-protected sites.
# CF Bot Management detects Python requests by its TLS ClientHello (JA3 fingerprint),
# which differs from Chrome's BoringSSL, and sends TCP RST during the TLS handshake.
# curl-cffi uses a custom libcurl build with Chrome's exact TLS fingerprint.
try:
    from curl_cffi.requests import Session as _CurlSession
    _CURL_CFFI_AVAILABLE = True
except Exception:
    _CurlSession = None
    _CURL_CFFI_AVAILABLE = False

# Playwright: Headless browser for AJAX-heavy sites (subprocess-based; see fetch_page_headless).
# We only check that the package is importable here — we never call sync_playwright()
# in the main process because FastAPI's threadpool runs inside an asyncio loop.
try:
    import playwright as _pw_pkg  # noqa: F401 — presence check only
    _PLAYWRIGHT_AVAILABLE = True
except Exception:
    _PLAYWRIGHT_AVAILABLE = False

import hashlib
import bleach

from app.models.listing import Listing, ListingImage
from app.models.misc import ScraperJob, ScrapedListing, RawScrapedPage, FieldSynonym, BoatModelSpecs
from app.models.user import User
from app.models.guest_broker import GuestBroker
from app.db.session import get_db, SessionLocal
from app.services.media_storage import store_media_bytes
from app.services.geocoding import geocode_location
from sqlalchemy import func

logger = logging.getLogger(__name__)

# Maximum number of images/videos stored per listing.
# Some charter/superyacht listings legitimately include 100+ media items.
_MAX_IMAGES_PER_LISTING = 300


# ── Field synonym cache ────────────────────────────────────────────────────────
# Loaded once per scraper job from the field_synonyms DB table.
# Maps lowercase-stripped raw label text → canonical DB field name.
# If the DB is empty or unavailable, falls back to the hardcoded LABEL_MAP
# inside parse_spec_tables (existing behaviour is fully preserved).
def _load_synonym_cache(db) -> Dict[str, str]:
    """Load all FieldSynonym rows into a plain dict for O(1) lookups."""
    try:
        rows = db.query(FieldSynonym.raw_term, FieldSynonym.canonical_field).all()
        return {row.raw_term: row.canonical_field for row in rows}
    except Exception as exc:
        logger.warning(f"_load_synonym_cache: could not load field synonyms: {exc}")
        return {}


def _apply_boat_specs_lookup(data: Dict, db) -> None:
    """
    Look up BoatModelSpecs by make/model/year and fill in any blank fields.
    Only fills fields that are None/missing — scraped values always win.
    Modifies `data` in place.
    """
    make  = (data.get("make")  or "").strip()
    model = (data.get("model") or "").strip()
    year  = data.get("year")
    if not make or not model:
        return
    try:
        from app.api.routes_scraper import _find_boat_specs
        spec = _find_boat_specs(db, make, model, int(year) if year else None)
    except Exception as exc:
        logger.debug(f"_apply_boat_specs_lookup: lookup failed for {make}/{model}: {exc}")
        return
    if not spec:
        return

    # Cross-check against a length_feet the page itself already gave us before
    # trusting this spec-DB match. _find_boat_specs does an exact (if
    # case-insensitive) make+model match, but the make/model that got us here
    # can still be wrong (mis-parsed title, hallucinated by the AI fallback) and
    # happen to collide with a real, unrelated boat's spec row. A backfilled
    # length that's wildly different from what the listing itself reported is a
    # strong signal of exactly that — skip the whole backfill rather than
    # overwrite/contradict data the page actually gave us with a different
    # boat's specs (which would look "more complete" and score higher
    # confidence despite being wrong).
    _known_length = data.get("length_feet")
    if _known_length and spec.length_feet:
        try:
            _delta = abs(float(spec.length_feet) - float(_known_length)) / float(_known_length)
            if _delta > 0.25:
                logger.warning(
                    f"boat_specs_lookup: skipping backfill for {make} {model} {year or ''} — "
                    f"DB length_feet={spec.length_feet} disagrees with scraped length_feet="
                    f"{_known_length} by {_delta:.0%}, likely a wrong make/model match"
                )
                return
        except (TypeError, ValueError):
            pass

    _FILLABLE = [
        ("boat_type",     spec.boat_type),
        ("length_feet",   spec.length_feet),
        ("beam_feet",     spec.beam_feet),
        ("draft_feet",    spec.draft_feet),
        ("hull_material", spec.hull_material),
        ("hull_type",     spec.hull_type),
        ("fuel_capacity_gallons",  spec.fuel_capacity_gallons),
        ("water_capacity_gallons", spec.water_capacity_gallons),
        ("cabins",               spec.cabins),
        ("berths",               spec.berths),
        ("heads",                spec.heads),
        ("max_speed_knots",      spec.max_speed_knots),
        ("cruising_speed_knots", spec.cruising_speed_knots),
    ]
    filled = []
    for field, value in _FILLABLE:
        if value is not None and not data.get(field):
            data[field] = value
            filled.append(field)
    if filled:
        logger.info(f"boat_specs_lookup: filled {filled} from DB for {make} {model} {year or ''}")


def _compute_confidence(data: Dict) -> float:
    """
    Score how complete a merged extraction result is.
    Returns 0.0–1.0.  Listings scoring < 0.4 are flagged 'failed' and do not
    automatically create a Listing record (they land in raw_scraped_pages only).
    """
    score = 0.0
    if data.get("title"):        score += 0.15
    if data.get("price"):        score += 0.15
    if data.get("make"):         score += 0.10
    if data.get("model"):        score += 0.05
    if data.get("year"):         score += 0.10
    if data.get("length_feet"):  score += 0.10
    if data.get("country"):      score += 0.10
    if data.get("city"):         score += 0.05
    desc = data.get("description") or ""
    if len(str(desc)) > 50:      score += 0.10
    if data.get("images"):       score += 0.10
    return round(min(score, 1.0), 3)


class OptimizedYachtScraper:

    # ── Location normalization tables ─────────────────────────────────────────
    _COUNTRY_ALIASES: Dict[str, str] = {
        "usa": "United States", "us": "United States",
        "u.s.a.": "United States", "u.s.": "United States",
        "united states of america": "United States",
        "uk": "United Kingdom", "great britain": "United Kingdom", "gb": "United Kingdom",
        "uae": "United Arab Emirates",
        "trinidad": "Trinidad and Tobago",
        "st martin": "St. Martin", "saint martin": "St. Martin",
        "st lucia": "St. Lucia", "saint lucia": "St. Lucia",
        "st kitts": "St. Kitts and Nevis", "saint kitts": "St. Kitts and Nevis",
        "st vincent": "St. Vincent and the Grenadines",
        "antigua": "Antigua and Barbuda",
        "bvi": "British Virgin Islands", "british vi": "British Virgin Islands",
        "usvi": "US Virgin Islands", "us vi": "US Virgin Islands",
        "turks & caicos": "Turks and Caicos", "t&c": "Turks and Caicos",
        "curacao": "Curacao", "curaçao": "Curacao",
        "reunion": "Réunion",
        "tahiti": "French Polynesia",
    }

    _US_STATE_ABBR: Dict[str, str] = {
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
        "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
        "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
        "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
        "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
        "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
        "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
        "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
        "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
        "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
        "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
        "PR": "Puerto Rico", "VI": "US Virgin Islands", "GU": "Guam",
        "AS": "American Samoa", "MP": "Northern Mariana Islands",
    }

    _CA_PROVINCE_ABBR: Dict[str, str] = {
        "AB": "Alberta", "BC": "British Columbia", "MB": "Manitoba",
        "NB": "New Brunswick", "NL": "Newfoundland and Labrador",
        "NT": "Northwest Territories", "NS": "Nova Scotia", "NU": "Nunavut",
        "ON": "Ontario", "PE": "Prince Edward Island", "QC": "Quebec",
        "SK": "Saskatchewan", "YT": "Yukon",
    }

    # Canonical country names matching the frontend COUNTRIES list
    _KNOWN_COUNTRIES: frozenset = frozenset({
        "United States", "Canada", "Mexico", "Bahamas", "Bermuda",
        "Cayman Islands", "British Virgin Islands", "US Virgin Islands",
        "Puerto Rico", "Barbados", "Trinidad and Tobago", "Aruba", "Curacao",
        "Antigua and Barbuda", "St. Martin", "Martinique", "Guadeloupe",
        "St. Lucia", "Grenada", "St. Kitts and Nevis", "St. Vincent and the Grenadines",
        "Turks and Caicos", "Jamaica", "Dominican Republic", "Haiti", "Cuba",
        "Belize", "Guatemala", "Honduras", "Panama", "Colombia", "Venezuela",
        "Guyana", "Suriname", "Brazil", "Uruguay", "Argentina", "Chile",
        "Peru", "Ecuador", "United Kingdom", "Ireland", "France", "Spain",
        "Portugal", "Italy", "Greece", "Croatia", "Montenegro", "Albania",
        "Slovenia", "Malta", "Cyprus", "Monaco", "Corsica", "Sardinia",
        "Sicily", "Netherlands", "Belgium", "Germany", "Denmark", "Sweden",
        "Norway", "Finland", "Estonia", "Latvia", "Lithuania", "Poland",
        "Switzerland", "Austria", "Turkey", "Israel", "Lebanon", "Egypt",
        "Libya", "Tunisia", "Algeria", "Morocco", "United Arab Emirates",
        "Oman", "Qatar", "Bahrain", "Kuwait", "Saudi Arabia", "Yemen",
        "Maldives", "India", "Sri Lanka", "Thailand", "Malaysia", "Singapore",
        "Indonesia", "Philippines", "Vietnam", "Cambodia", "Myanmar", "Brunei",
        "Hong Kong", "Japan", "Taiwan", "South Korea", "China", "Australia",
        "New Zealand", "Fiji", "Vanuatu", "Tonga", "Samoa", "French Polynesia",
        "New Caledonia", "Papua New Guinea", "South Africa", "Mozambique",
        "Tanzania", "Kenya", "Seychelles", "Mauritius", "Réunion", "Madagascar",
        "Namibia", "Nigeria", "Ghana", "Senegal", "Ivory Coast",
    })

    @classmethod
    def normalize_location(
        cls,
        city: Optional[str],
        state: Optional[str],
        country: Optional[str],
    ) -> tuple:
        """
        Normalize and infer city / state / country from partial or raw scraped data.
        - Expands state/province abbreviations to full names
        - Resolves country aliases to canonical names (e.g. 'USA' → 'United States')
        - When 'state' is actually a country name (e.g. 'Bermuda'), promotes it
        - Infers missing country from known state/province
        Returns (city, state, country) — any may be None if not determinable.
        """
        # ── normalize country ────────────────────────────────────────────────
        if country:
            key = country.strip().lower().rstrip('.')
            country = cls._COUNTRY_ALIASES.get(key, country.strip())
            # Snap to canonical casing
            c_low = country.lower()
            for known in cls._KNOWN_COUNTRIES:
                if known.lower() == c_low:
                    country = known
                    break

        # ── normalize state ──────────────────────────────────────────────────
        if state:
            s = state.strip()
            s_up = s.upper()
            if s_up in cls._US_STATE_ABBR:
                state = cls._US_STATE_ABBR[s_up]
                if not country:
                    country = "United States"
            elif s_up in cls._CA_PROVINCE_ABBR:
                state = cls._CA_PROVINCE_ABBR[s_up]
                if not country:
                    country = "Canada"
            else:
                # Check if "state" is really a country name
                s_low = s.lower()
                matched_country = None
                for known in cls._KNOWN_COUNTRIES:
                    if known.lower() == s_low:
                        matched_country = known
                        break
                if matched_country:
                    if not country:
                        country = matched_country
                    state = None  # was country, not a sub-national region
                else:
                    # Check if it's a full US state or Canadian province name
                    all_us = set(cls._US_STATE_ABBR.values())
                    all_ca = set(cls._CA_PROVINCE_ABBR.values())
                    if s in all_us and not country:
                        country = "United States"
                    elif s in all_ca and not country:
                        country = "Canada"

        # ── city = country? (only city provided, e.g. city="Bermuda") ────────
        if city and not country and not state:
            c_low = city.lower()
            for known in cls._KNOWN_COUNTRIES:
                if known.lower() == c_low:
                    country = known
                    city = None
                    break

        return city or None, state or None, country or None

    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        if api_key:
            self.client = anthropic.Anthropic(api_key=api_key)
        else:
            self.client = None

        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        # Persistent session — carries cookies across requests within one scrape job
        # (e.g. sites that set a session cookie on the first page load).
        self._session = requests.Session()
        self._session.headers.update(self.headers)
        # curl_cffi session for CF-protected sites — produces a Chrome TLS fingerprint
        # so Cloudflare's bot detection passes the TLS handshake rather than sending TCP RST.
        self._curl_session = _CurlSession(impersonate="chrome124") if _CURL_CFFI_AVAILABLE else None
        # Playwright headless browser for AJAX-heavy sites
        # Initialized lazily on first use, shared across all requests in one job
        self._playwright = None
        self._browser = None
        self._context = None
        # URL → (post_type, wp_post_id) populated by _discover_from_wp_rest.
        # On CF-protected WP sites the ?id= URL parameter is a CUSTOM/EXTERNAL ID
        # (e.g. from a boat-listing plugin), not the WP post ID. We must use the
        # WP post ID returned by the REST API to fetch individual listing content.
        self._wp_rest_id_map: Dict[str, Tuple[str, str]] = {}
        # Cache for sites that serve all listing data via a custom JSON API (e.g.
        # Squarespace sites backed by a Cloudflare Worker proxy like yachtzero.com).
        # Populated by _discover_from_json_proxy().
        # Maps synthetic_url → pre-built listing data dict.
        self._json_api_cache: Dict[str, Dict] = {}
        # Tracks consecutive blocked/rate-limited fetches (403/429/TCP-RST/etc.)
        # within this scraper instance's lifetime (one job run). Reset to 0 on
        # any successful fetch. run_scraper_job uses this to short-circuit a job
        # once it's clear every remaining URL will fail the same way, instead of
        # burning through the whole discovered list on guaranteed failures.
        self._consecutive_blocks = 0
        # Set to a human-readable reason the first time SCRAPER_PROXY_URL
        # rejects a request with an auth/subscription-style error (401/403
        # from ScraperAPI) — as opposed to the *site* blocking us, which is
        # the normal/expected case the proxy exists to route around. Surfaced
        # in job.last_error so an expired proxy subscription shows up in the
        # admin Scraper tab instead of looking identical to "site is blocking
        # us" and requiring a full re-investigation every time it recurs.
        self._proxy_auth_failed: Optional[str] = None
        # Job-level wall-clock budget for headless-browser fetches, shared
        # across discovery's pagination-following AND each listing's per-URL
        # headless fallback in the same run. Once exhausted, fetch_page_headless
        # stops spawning new subprocesses and falls straight back to the
        # static fetcher for the rest of this job — a pure safety net against
        # a broken/looping site turning one job into an unbounded hang, not a
        # normal-case limit. Set generously: a broker with hundreds/thousands
        # of listings on a site that needs the slow render-proxy fallback for
        # nearly everything (observed: bviyachtsales.com, ~60-70s/page) is
        # expected to need real time — the goal is getting a large broker's
        # full inventory live within hours, not truncating it to fit an
        # arbitrary clock and needing days of repeated partial runs to
        # eventually cover it all.
        self._headless_time_budget_seconds = 2 * 60 * 60
        self._headless_time_used_seconds = 0.0

        # Known site patterns for fast structured extraction
        self.site_patterns = {
            "yachtworld.com": {
                "title": {"class": "boat-title"},
                "price": {"class": "price"},
                "specs": {"class": "specs-list"},
            },
            "boattrader.com": {
                "title": {"class": "listing-title"},
                "price": {"data-price": True},
            },
        }

    # URL patterns that carry a unique-ID query param — must preserve the full URL
    _ID_QUERY_PARAM_RE = re.compile(
        r"[?&](?:id|listing_id|boat_id|vessel_id|yacht_id|property_id|item_id)=\d+",
        re.IGNORECASE,
    )

    # CSS class that marks a listing card as sold/unavailable
    _SOLD_CARD_CLASSES = frozenset({"sold", "off-market", "under-contract", "pending", "unavailable"})

    # ---------------------------------------------------------
    # BASIC FETCHING
    # ---------------------------------------------------------

    # Error signatures that indicate a network-level IP block rather than an
    # application-layer rejection.  When these appear, retrying via proxy is
    # the only option; retrying directly will always fail.
    _BLOCKED_ERRORS = (
        'Connection reset by peer',
        'ConnectionReset',
        'ERR_CONNECTION_RESET',
        'Connection refused',
        '104',  # ECONNRESET errno on Linux
        'curl: (16)',   # HTTP/2 framing error — site doesn't support HTTP/2
        'CURLE_HTTP2', # same, alternate representation
        'curl: (28)',   # Connection timed out — Render IP may be blocked/rate-limited
        'CURLE_OPERATION_TIMEDOUT',  # same, alternate representation
        'curl: (35)',   # SSL connect error (IP-level block)
        'curl: (56)',   # Recv failure — connection reset during transfer
        '403',          # HTTP 403 Forbidden — IP/bot block (e.g. myyachtsforsale.com)
        '429',          # HTTP 429 Too Many Requests — rate-limited, retry via proxy
    )

    def _is_blocked_error(self, exc: Exception) -> bool:
        s = str(exc)
        # Also catch requests.exceptions.Timeout directly (plain requests library)
        try:
            import requests as _req
            if isinstance(exc, _req.exceptions.Timeout):
                return True
        except Exception:
            pass
        return any(sig in s for sig in self._BLOCKED_ERRORS)

    _MAX_TRANSIENT_RETRIES = 2  # total attempts for a non-blocked transient failure
    _RETRY_BACKOFF_SECONDS = 1.5

    def _fetch_page_once(self, url: str, timeout: int) -> "requests.Response":
        """Single fetch attempt — raises on any failure. Split out of fetch_page
        so the retry loop can wrap it without duplicating the curl-cffi/HTTP-1.1
        fallback logic."""
        if self._curl_session is not None:
            try:
                resp = self._curl_session.get(url, timeout=timeout, allow_redirects=True)
            except Exception as curl_exc:
                # curl: (16) = HTTP/2 framing error — site only supports HTTP/1.1.
                # Retry the same URL with HTTP/1.1 forced before giving up.
                if 'curl: (16)' in str(curl_exc) or 'CURLE_HTTP2' in str(curl_exc):
                    logger.info(f"fetch_page: HTTP/2 error for {url}, retrying with HTTP/1.1")
                    resp = self._curl_session.get(
                        url, timeout=timeout, allow_redirects=True,
                        http_version=1,  # force HTTP/1.1
                    )
                else:
                    raise
        else:
            resp = self._session.get(url, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        return resp

    def fetch_page(self, url: str, timeout: int = 15) -> Optional[str]:
        """Fetch a page. Uses curl-cffi Chrome TLS impersonation when installed,
        so Cloudflare's JA3 fingerprint check passes. Falls back to plain requests.

        A transient failure (dropped connection, momentary 503/timeout — anything
        NOT recognized as a block) gets a couple of quick retries with a short
        backoff before giving up, instead of permanently dropping that listing
        for the whole run on a single blip.

        If the failure IS recognized as a block (TCP RST, 403/429, HTTP/2 framing
        error, etc.), retrying the same direct connection is pointless — it fails
        via SCRAPER_PROXY_URL when configured, and either way increments
        self._consecutive_blocks so the job loop can detect "we're being blocked,
        not just missing pages" and short-circuit instead of guaranteeing failure
        on every remaining URL.
        """
        last_exc: Optional[Exception] = None
        for attempt in range(1, self._MAX_TRANSIENT_RETRIES + 1):
            try:
                resp = self._fetch_page_once(url, timeout)
                self._consecutive_blocks = 0
                return resp.text
            except Exception as exc:
                last_exc = exc
                if self._is_blocked_error(exc):
                    self._consecutive_blocks += 1
                    if _SCRAPER_PROXY_URL:
                        logger.info(f"fetch_page: direct connection blocked for {url}, retrying via proxy")
                        proxied = self._proxy_fetch(url, timeout)
                        if proxied is not None:
                            self._consecutive_blocks = 0
                        return proxied
                    logger.warning(f"fetch_page: blocked fetching {url} (no proxy configured): {exc}")
                    return None
                # Transient, non-blocked failure — short backoff, try again.
                if attempt < self._MAX_TRANSIENT_RETRIES:
                    logger.info(
                        f"fetch_page: transient error for {url} "
                        f"(attempt {attempt}/{self._MAX_TRANSIENT_RETRIES}): {exc} — retrying"
                    )
                    time.sleep(self._RETRY_BACKOFF_SECONDS)
                    continue
        logger.warning(f"fetch_page failed for {url} after {self._MAX_TRANSIENT_RETRIES} attempts: {last_exc}")
        return None

    def _proxy_fetch(self, url: str, timeout: int = 15, render: bool = False) -> Optional[str]:
        """Fetch via proxy.  For ScraperAPI we call their direct REST API
        (api.scraperapi.com?api_key=...&url=...) instead of routing through the
        CONNECT tunnel — this avoids SSL cert-chain verification failures on
        sites that don't send their full intermediate-CA certificate chain.
        Pass render=True to enable ScraperAPI's JS-rendering (managed Chrome)."""
        if not _SCRAPER_PROXY_URL:
            return None
        try:
            parsed_proxy = urlparse(_SCRAPER_PROXY_URL)
            # ── ScraperAPI direct API ────────────────────────────────────────
            if 'scraperapi.com' in (parsed_proxy.hostname or ''):
                api_key = parsed_proxy.password or ''
                if not api_key:
                    logger.warning("ScraperAPI proxy URL is missing the API key (password field)")
                    return None
                from urllib.parse import quote as _q
                api_endpoint = (
                    f"https://api.scraperapi.com"
                    f"?api_key={api_key}"
                    f"&url={_q(url, safe='')}"
                )
                if render:
                    api_endpoint += "&render=true"
                resp = requests.get(api_endpoint, headers=self.headers, timeout=timeout + 20)
                if resp.status_code in (401, 403):
                    # ScraperAPI's own auth/subscription failure, not the target
                    # site blocking us — distinguish so this doesn't just read as
                    # "site is blocking us" on every subsequent job run.
                    self._proxy_auth_failed = (
                        f"ScraperAPI rejected the request with {resp.status_code} — "
                        f"check that SCRAPER_PROXY_URL's API key is valid and the "
                        f"subscription is active: {resp.text[:200]}"
                    )
                    logger.error(f"_proxy_fetch: {self._proxy_auth_failed}")
                    return None
                resp.raise_for_status()
                return resp.text
            # ── Generic HTTP/SOCKS proxy — CONNECT tunnel ────────────────────
            proxies = {'http': _SCRAPER_PROXY_URL, 'https': _SCRAPER_PROXY_URL}
            resp = requests.get(
                url, headers=self.headers, proxies=proxies,
                timeout=timeout, allow_redirects=True, verify=False,
            )
            resp.raise_for_status()
            return resp.text
        except Exception as proxy_exc:
            logger.warning(f"fetch_page proxy also failed for {url}: {proxy_exc}")
            return None

    # ------------------------------------------------------------------ #
    # Subprocess-based headless fetch                                      #
    # ------------------------------------------------------------------ #
    # We intentionally avoid using sync_playwright() in the main process  #
    # because FastAPI's sync route handlers run inside a threadpool that  #
    # is attached to a running asyncio event loop, causing "Sync API       #
    # inside the asyncio loop" errors.                                    #
    #                                                                      #
    # Playwright browser binaries installed at build time do NOT persist  #
    # to the Render runtime container (build and runtime filesystems are  #
    # separate).  The subprocess therefore self-heals on first use:       #
    #   - Detects missing binary (chromium-headless-shell)                #
    #   - Runs `playwright install chromium-headless-shell` WITHOUT       #
    #     --with-deps (no sudo/root needed — headless-shell is            #
    #     self-contained)                                                 #
    #   - Retries the launch                                              #
    # The binary is cached in ~/.cache/ms-playwright/ for subsequent     #
    # calls within the same Render deployment.                           #
    # ------------------------------------------------------------------ #

    # Inline Python script executed by the subprocess.
    _HEADLESS_SCRIPT = """\
import sys, json, subprocess as _sp, os as _os
from playwright.sync_api import sync_playwright

url = sys.argv[1]
wait_sel = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "__none__" else None
timeout_ms = int(sys.argv[3]) * 1000 if len(sys.argv) > 3 else 30000
proxy_url = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "__none__" else None

def _launch(p):
    proxy_settings = {"server": proxy_url} if proxy_url else None
    for attempt in range(2):
        try:
            return p.chromium.launch(
                headless=True,
                proxy=proxy_settings,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                ],
            )
        except Exception as e:
            if attempt == 0 and ("Executable doesn't exist" in str(e) or "executable" in str(e).lower()):
                # Binary not present — install without --with-deps (no sudo needed)
                r = _sp.run(
                    [sys.executable, "-m", "playwright", "install", "chromium-headless-shell"],
                    capture_output=True, text=True, timeout=300,
                )
                if r.returncode != 0:
                    raise RuntimeError(f"install failed: {r.stderr[-400:]}")
                continue  # retry launch
            raise

try:
    with sync_playwright() as p:
        browser = _launch(p)
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
            },
        )
        page = ctx.new_page()
        # Remove navigator.webdriver flag to avoid bot detection
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        # Catch goto timeout but still grab whatever the browser loaded
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        except Exception:
            pass  # may have loaded partially — try to get content anyway
        if wait_sel:
            try:
                page.wait_for_selector(wait_sel, timeout=5000)
            except Exception:
                pass
        try:
            page.wait_for_load_state("networkidle", timeout=25000)
        except Exception:
            pass
        # Scroll to bottom to trigger lazy-loaded listing cards, then wait for them
        try:
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(2000)
        except Exception:
            pass
        try:
            html = page.content()
        except Exception:
            html = ""
        browser.close()
    if html:
        print(json.dumps({"ok": True, "html": html}))
    else:
        print(json.dumps({"ok": False, "error": "empty page content after goto"}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
"""

    def _init_browser(self):
        """No-op: headless fetching is now subprocess-based (see fetch_page_headless)."""
        pass

    def _cleanup_browser(self):
        """No-op: each subprocess-based fetch is self-contained."""
        pass

    def fetch_page_headless(self, url: str, wait_selector: Optional[str] = None, timeout: int = 30) -> Optional[str]:
        """Fetch a page using a headless Chromium subprocess.

        Spawns a fresh Python process with no asyncio loop so sync_playwright()
        works regardless of the calling context (FastAPI threadpool, etc.).
        On first use after a fresh deploy the subprocess self-installs the
        Playwright chromium-headless-shell binary (~120 MB, ~2 min one-time).
        Falls back to static fetch if Playwright is unavailable or fails.
        """
        if not _PLAYWRIGHT_AVAILABLE:
            logger.debug("Playwright not available, falling back to fetch_page()")
            return self.fetch_page(url)

        if self._headless_time_used_seconds >= self._headless_time_budget_seconds:
            logger.warning(
                f"fetch_page_headless: job's headless time budget "
                f"({self._headless_time_budget_seconds}s) exhausted — falling back to "
                f"static fetch for {url} instead of spawning another subprocess"
            )
            return self.fetch_page(url)

        import subprocess, json as _json, sys as _sys, tempfile, os

        _headless_started_at = time.monotonic()
        try:
            try:
                # Write the inline script to a temp file to avoid shell-quoting issues
                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=".py", delete=False, encoding="utf-8"
                ) as tf:
                    tf.write(self._HEADLESS_SCRIPT)
                    script_path = tf.name

                # On a fresh deploy the first call may trigger a ~2 min self-install;
                # allow up to 360 s total (300 s install + 60 s page fetch overhead).
                effective_timeout = max(timeout + 15, 360)
                try:
                    result = subprocess.run(
                        [
                            _sys.executable, script_path,
                            url,
                            wait_selector or "__none__",
                            str(timeout),
                            _SCRAPER_PROXY_URL or "__none__",
                        ],
                        capture_output=True, text=True, timeout=effective_timeout,
                    )
                finally:
                    try:
                        os.unlink(script_path)
                    except OSError:
                        pass

                stdout = result.stdout.strip()
                if not stdout:
                    logger.warning(f"fetch_page_headless: empty output for {url}; stderr={result.stderr[-300:]}")
                    return self._scraperapi_render_fallback(url) if _SCRAPER_PROXY_URL else self.fetch_page(url)

                data = _json.loads(stdout)
                if data.get("ok"):
                    return data["html"]
                else:
                    logger.warning(f"fetch_page_headless subprocess error for {url}: {data.get('error')}")
                    return self._scraperapi_render_fallback(url) if _SCRAPER_PROXY_URL else self.fetch_page(url)

            except subprocess.TimeoutExpired:
                logger.warning(f"fetch_page_headless timed out for {url}")
                return self._scraperapi_render_fallback(url) if _SCRAPER_PROXY_URL else self.fetch_page(url)
            except Exception as exc:
                logger.warning(f"fetch_page_headless failed for {url}: {exc}")
                return self._scraperapi_render_fallback(url) if _SCRAPER_PROXY_URL else self.fetch_page(url)
        finally:
            # Count time toward the job's headless budget regardless of outcome
            # (success, timeout, or error) — a page that keeps timing out should
            # count against the budget just as much as a slow-but-successful one.
            self._headless_time_used_seconds += time.monotonic() - _headless_started_at

    def _scraperapi_render_fallback(self, url: str) -> Optional[str]:
        """Use ScraperAPI's managed Chrome rendering as a fallback when the local
        headless browser fails (empty content, timeout, or bot detection).
        ScraperAPI render=true runs a real Chrome instance on their end, bypassing
        bot detection that blocks our Playwright subprocess."""
        logger.info(f"fetch_page_headless: falling back to ScraperAPI render=true for {url}")
        result = self._proxy_fetch(url, timeout=60, render=True)
        if result:
            return result
        # Last resort: static fetch
        logger.warning(f"ScraperAPI render fallback also failed for {url}, trying static fetch")
        return self.fetch_page(url)

    def check_listing_still_live(self, url: str) -> Tuple[bool, str]:
        """Fast, no-AI check to see if a listing is still active."""
        try:
            response = requests.head(url, headers=self.headers, timeout=5, allow_redirects=True)

            if response.status_code == 404:
                return False, "404 Not Found"
            if response.status_code >= 500:
                return False, f"Server Error {response.status_code}"

            if response.status_code == 200:
                html = self.fetch_page(url)
                if not html:
                    return False, "Failed to load page"

                html_lower = html.lower()
                sold_patterns = [
                    "sold", "no longer available", "listing removed",
                    "expired listing", "unavailable", "off market",
                    "pending sale", "under contract",
                ]
                for pattern in sold_patterns:
                    if pattern in html_lower:
                        return False, f"Marked as: {pattern}"

                if "price" not in html_lower and "yacht" not in html_lower and "boat" not in html_lower:
                    return False, "Listing content missing"

                return True, "Active"

            return False, f"Unexpected status {response.status_code}"
        except Exception as e:
            return False, f"Error: {str(e)}"

    # URL patterns that carry a unique-ID query param — must preserve the full URL
    _ID_QUERY_PARAM_RE = re.compile(
        r"[?&](?:id|listing_id|boat_id|vessel_id|yacht_id|property_id|item_id)=\d+",
        re.IGNORECASE,
    )

    # CSS class (full or partial) that marks a listing card as sold/unavailable
    _SOLD_CARD_CLASSES = {"sold", "off-market", "under-contract", "pending", "unavailable"}


    # ---------------------------------------------------------
    # ---------------------------------------------------------
    # INVENTORY DISCOVERY - find all listing URLs on a broker site
    # ---------------------------------------------------------

    # Paths that are definitely NOT listings (contact / about / admin etc.)
    _NON_LISTING_PATHS = re.compile(
        r"/(about|contact|team|staff|news|blog|press|careers|privacy|terms|faq|"
        r"services|newsletter|testimonials|financing|insurance|sitemap|login|"
        r"register|account|cart|checkout|wp-admin|wp-login|wp-json|feed|rss)(/?$|/)",
        re.IGNORECASE,
    )

    def _looks_like_single_listing(self, text: str, extract_price_fn=None) -> bool:
        """Returns True only if the page has a numeric price AND enough vessel-specific signals."""
        # Require a real dollar amount — prevents marketing pages that mention "price" in prose
        if extract_price_fn and not extract_price_fn(text):
            return False
        lower = text.lower()
        signals = [
            "length", "year", "make", "model", "beam", "draft",
            "loa", "inquire", "contact broker", "request info", "engine",
            "fuel", "cabin", "berth", "stateroom", "vessel", "hull",
            "horsepower", "knots", "marina", "tender", "saloon", "salon",
        ]
        return sum(1 for s in signals if s in lower) >= 2

    # ---------------------------------------------------------
    # TEMPLATE-GUIDED HELPERS
    # ---------------------------------------------------------
    def _discover_with_template(self, site_url: str, template: Dict) -> List[str]:
        """
        Use admin-configured CSS selectors to discover listing URLs.
        Follows pagination via next_page_selector (up to 500 pages).
        Returns an empty list if no links are found, so the caller can fall
        back to heuristic discovery.
        """
        link_selector = template.get('listing_link_selector', '').strip()
        next_page_selector = template.get('next_page_selector', '').strip()
        if not link_selector:
            return []

        parsed = urlparse(site_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        found: List[str] = []
        seen_urls: set = set()
        current_url = site_url

        for _page_num in range(1, 501):
            html = self.fetch_page(current_url)
            if not html:
                break
            soup = BeautifulSoup(html, 'html.parser')
            page_had_links = False
            for el in soup.select(link_selector):
                href = el.get('href') or el.get('data-href') or ''
                href = href.split('#')[0].strip()
                if not href:
                    continue
                if href.startswith('/'):
                    href = base + href
                elif not href.startswith('http'):
                    href = site_url.rstrip('/') + '/' + href.lstrip('/')
                if href and href not in seen_urls:
                    # Skip self-referential links back to the inventory page being crawled
                    _href_path = href.split('?')[0].rstrip('/')
                    if _href_path == site_url.rstrip('/'):
                        continue
                    seen_urls.add(href)
                    found.append(href)
                    page_had_links = True
            if not next_page_selector or not page_had_links:
                break
            next_el = soup.select_one(next_page_selector)
            if not next_el:
                break
            next_href = (next_el.get('href') or '').split('#')[0].strip()
            if not next_href:
                break
            if next_href.startswith('/'):
                next_href = base + next_href
            elif not next_href.startswith('http'):
                next_href = site_url.rstrip('/') + '/' + next_href.lstrip('/')
            if next_href in seen_urls or next_href == current_url:
                break
            current_url = next_href
            seen_urls.add(current_url)

        return found

    def _apply_template_selectors(self, data: Dict, soup, template: Dict) -> None:
        """
        Override auto-detected fields using admin-configured CSS selectors.
        Called after standard extraction — template values WIN over heuristics.
        """
        _field_map = [
            ('title',         'title_selector'),
            ('price',         'price_selector'),
            ('description',   'description_selector'),
            ('year',          'year_selector'),
            ('make',          'make_selector'),
            ('model',         'model_selector'),
            ('length_feet',   'length_selector'),
            ('location',      'location_selector'),
            ('broker_email',  'broker_email_selector'),
            ('broker_phone',  'broker_phone_selector'),
            ('hull_material', 'hull_material_selector'),
            ('fuel_type',     'fuel_type_selector'),
            ('hours',         'hours_selector'),
            ('condition',     'condition_selector'),
        ]
        for field, key in _field_map:
            sel = template.get(key, '').strip()
            if not sel:
                continue
            el = soup.select_one(sel)
            if el:
                text = el.get_text(' ', strip=True)
                if text:
                    data[field] = text

        # Images — if selector is present, replace auto-extracted list
        img_sel = template.get('images_selector', '').strip()
        if img_sel:
            tmpl_imgs = []
            _css_url_re_t = re.compile(
                r'url\(["\']?(https?://[^"\')\s]+\.(?:jpg|jpeg|png|webp))["\']?\)',
                re.IGNORECASE,
            )
            for el in soup.select(img_sel):
                src = (el.get('src') or el.get('data-src') or
                       el.get('data-lazy-src') or el.get('data-original') or '')
                if not src:
                    # Fall back to CSS background-image in inline style attribute
                    # (used by Terraglio-style page builders that set gallery images
                    # via JS-applied style="" rather than <img src="">).
                    style = el.get('style', '')
                    if style:
                        m = _css_url_re_t.search(style)
                        if m:
                            src = m.group(1)
                if src and src.startswith('http'):
                    tmpl_imgs.append(src)
            if tmpl_imgs:
                data['images'] = tmpl_imgs[:_MAX_IMAGES_PER_LISTING]

        # Agent name
        agent_name_sel = template.get('agent_name_selector', '').strip()
        if agent_name_sel:
            el = soup.select_one(agent_name_sel)
            if el:
                name = el.get_text(' ', strip=True)
                if name:
                    data['detected_agent_name'] = name

        # Agent photo
        agent_photo_sel = template.get('agent_photo_selector', '').strip()
        if agent_photo_sel:
            el = soup.select_one(agent_photo_sel)
            if el:
                src = (el.get('src') or el.get('data-src') or '')
                if src:
                    data['detected_agent_photo'] = src

        # ── Named sections — dynamic, each section is auto-parsed ──────────────
        # Template format: sections = [{name: "Propulsion", selector: ".prop-specs"}, ...]
        # Each section is parsed with 3 strategies (dt/dd, table, sibling pairs) unless
        # it looks like a bullet list — then all li/p/span text items are collected.
        # Results land in additional_specs[section_name] for database storage and in
        # _tmpl_sections for the live test endpoint response.
        tmpl_sections_out: Dict[str, Any] = {}
        for sec_def in (template.get('sections') or []):
            sec_name = (sec_def.get('name') or '').strip()
            sec_sel  = (sec_def.get('selector') or '').strip()
            if not sec_name or not sec_sel:
                continue
            section = soup.select_one(sec_sel)
            if not section:
                continue
            # Detect whether it's primarily a bullet list (no dt/td structure)
            has_list_items = bool(section.find('li'))
            has_pairs = bool(section.find('dt') or section.find('th'))
            if has_list_items and not has_pairs:
                # Bullet-list section: collect all li/p/span text items
                seen_f: set = set()
                feature_items: List[str] = []
                for child in section.find_all(['li', 'p', 'span']):
                    text = child.get_text(' ', strip=True)
                    if text and 2 < len(text) < 250 and text not in seen_f:
                        seen_f.add(text)
                        feature_items.append(text)
                if feature_items:
                    existing = data.get('additional_specs') or {}
                    if not isinstance(existing, dict):
                        existing = {}
                    existing[sec_name] = feature_items
                    data['additional_specs'] = existing
                    tmpl_sections_out[sec_name] = feature_items
            else:
                # Key/value section: try dt/dd → table rows → sibling pairs
                parsed_kv: Dict[str, str] = {}
                for dt in section.find_all('dt'):
                    dd = dt.find_next_sibling('dd')
                    if dd:
                        k = dt.get_text(' ', strip=True)
                        v = dd.get_text(' ', strip=True)
                        if k and v:
                            parsed_kv[k] = v
                if not parsed_kv:
                    for tr in section.find_all('tr'):
                        cells = tr.find_all(['th', 'td'])
                        if len(cells) >= 2:
                            k = cells[0].get_text(' ', strip=True)
                            v = cells[1].get_text(' ', strip=True)
                            if k and v:
                                parsed_kv[k] = v
                if not parsed_kv:
                    for row in section.find_all(True, recursive=False):
                        children = [c for c in row.find_all(True, recursive=False)]
                        if len(children) >= 2:
                            k = children[0].get_text(' ', strip=True)
                            v = children[1].get_text(' ', strip=True)
                            if k and v and len(k) < 80 and k != v:
                                parsed_kv[k] = v
                if parsed_kv:
                    existing = data.get('additional_specs') or {}
                    if not isinstance(existing, dict):
                        existing = {}
                    existing[sec_name] = parsed_kv
                    data['additional_specs'] = existing
                    tmpl_sections_out[sec_name] = parsed_kv
        if tmpl_sections_out:
            data['_tmpl_sections'] = tmpl_sections_out  # exposed for test endpoint

    def _apply_template_field_rules(self, data: Dict, raw_text: str, template: Dict) -> None:
        """
        Apply per-broker field teaching rules stored in the site template:

        label_map  — dict of {raw_label_text: canonical_field}
                     Supplements the global FieldSynonym table for labels that
                     are unique to this broker's spec tables.
                     e.g. {"Asking Price (CAD)": "price", "LOA (Feet)": "length_feet"}

        field_rules — list of extraction rules applied against the page's raw text.
                     Each rule: {"field": str, "pattern": str, "type": "text"|"number"|"int"}
                     e.g. {"field": "engine_hours", "pattern": "Engine Hours:\\s*([\\d,]+)", "type": "int"}

        Rules only WIN if they produce a non-empty value AND the field is currently
        empty — CSS selectors (in _apply_template_selectors) take highest priority,
        so we only fill gaps here.
        """
        # ── label_map: normalize spec table labels scraped into additional_specs ──
        label_map: Dict[str, str] = template.get("label_map") or {}
        if label_map:
            # Walk through additional_specs sections and re-map any matching labels
            additional = data.get("additional_specs") or {}
            for _sec_name, _sec_data in list((additional if isinstance(additional, dict) else {}).items()):
                if not isinstance(_sec_data, dict):
                    continue
                for raw_label, raw_val in list(_sec_data.items()):
                    canon = label_map.get(raw_label) or label_map.get(raw_label.lower())
                    if canon and not data.get(canon):
                        try:
                            if canon in ("price", "length_feet", "beam_feet", "draft_feet",
                                         "engine_hours", "fuel_capacity_gallons",
                                         "water_capacity_gallons", "max_speed_knots",
                                         "cruising_speed_knots"):
                                cleaned = re.sub(r"[^\d.]", "", str(raw_val))
                                data[canon] = float(cleaned) if cleaned else None
                            elif canon in ("year", "cabins", "berths", "heads", "engine_count"):
                                cleaned = re.sub(r"[^\d]", "", str(raw_val))
                                data[canon] = int(cleaned) if cleaned else None
                            else:
                                data[canon] = str(raw_val).strip()
                        except (ValueError, TypeError):
                            data[canon] = str(raw_val).strip()

        # ── field_rules: regex extraction from raw text ───────────────────────
        field_rules: list = template.get("field_rules") or []
        for rule in field_rules:
            if not isinstance(rule, dict):
                continue
            field = rule.get("field", "").strip()
            pattern = rule.get("pattern", "").strip()
            _type = rule.get("type", "text")
            if not field or not pattern:
                continue
            if data.get(field):          # already filled — don't overwrite
                continue
            try:
                m = re.search(pattern, raw_text, re.IGNORECASE | re.DOTALL)
                if m:
                    raw_val = m.group(1).strip() if m.lastindex else m.group(0).strip()
                    if _type in ("number", "float"):
                        cleaned = re.sub(r"[^\d.]", "", raw_val)
                        data[field] = float(cleaned) if cleaned else None
                    elif _type in ("int", "integer"):
                        cleaned = re.sub(r"[^\d]", "", raw_val)
                        data[field] = int(cleaned) if cleaned else None
                    else:
                        data[field] = raw_val
            except re.error:
                pass  # bad pattern — skip silently

    @staticmethod
    def _is_pagination_link(href: str, base_url: str) -> bool:
        """Detect pagination links (page=X, /page/X, rel=next, etc.) — shared by
        the static BFS crawl and the headless-browser discovery fallback, since
        both need to recognize the same pagination shapes."""
        # Check for explicit page/paging parameters
        if re.search(r'[?&](?:page|paged|p)=\d+', href, re.IGNORECASE):
            return True
        # Check for /page/X/ pattern (common in WordPress). Allows an optional
        # trailing query string after the page segment (e.g. bviyachtsales.com
        # emits "/yachts/page/2/?exclude_sold=1") — a bare end-of-string anchor
        # would miss that and silently cap discovery at page 1.
        if re.search(r'/page/\d+/?(?:[?&]|$)', href, re.IGNORECASE):
            return True
        # Check for ?offset=X or ?start=X patterns
        if re.search(r'[?&](?:offset|start|skip)=\d+', href, re.IGNORECASE):
            return True
        # Yacht broker CMS pattern: ?SERVICE=YACHTS&TG_KE_PRODUCT_STATS=<obfuscated hex>
        # Used by sites like rickobeyyachtsales.com for paginating their inventory.
        if 'TG_KE_PRODUCT_STATS=' in href or 'SERVICE=YACHTS' in href or 'SERVICE=YACHTWORLD' in href:
            return True
        return False

    def find_listing_urls(self, site_url: str, max_pages: int = 100, template: Optional[Dict] = None) -> List[str]:
        """
        Crawl a broker site and return a de-duped list of individual listing URLs.
        Handles both conventional /listings/ sub-directories AND sites that put
        listings directly on the homepage or use non-standard URL structures.
        If `template` contains a `listing_link_selector`, that is tried first.
        """
        parsed_base = urlparse(site_url)
        base_domain = f"{parsed_base.scheme}://{parsed_base.netloc}"
        # start_path is the URL path of the seed URL (e.g. "/yacht-condition/used").
        # When it's non-root we restrict the broad "follow everything" expansion so that

        # Detect whether the seed URL contains non-pagination filter params (e.g. agent=, category=).
        # When true, WP REST fallback is skipped because it can't honour per-agent/category filters
        # and would return listings from ALL brokers on a multi-broker platform.
        _seed_qs = parsed_base.query  # raw query string from the seed URL
        _PAGINATION_PARAMS = re.compile(
            r'^(?:page|paged|offset|start|skip|sort|ordr|order|per_page|limit)$',
            re.IGNORECASE,
        )
        _has_filter_params = False
        if _seed_qs:
            for _qp in _seed_qs.split('&'):
                _key = _qp.split('=')[0]
                if _key and not _PAGINATION_PARAMS.match(_key):
                    _has_filter_params = True
                    break
        # Filter params from the seed URL that must be appended to pagination links
        # so they don't lose the agent/category filter when following page 2, 3 etc.
        _seed_filter_params = _seed_qs if _has_filter_params else ''
        # starting from /used doesn't accidentally crawl /new, /charter, or the full site.
        start_path = parsed_base.path.rstrip('/')
        is_root_start = start_path in ('', '/')

        # ══ FAST PROBES — run BEFORE crawling to avoid false-positive contamination ══
        # Method 1: Custom JSON proxy API (Squarespace + CF Worker, e.g. yachtzero.com)
        # Always runs even when a template is set — this populates _json_api_cache so that
        # scrape_single_listing() can use pre-built data regardless of how URLs were found.
        _json_proxy_urls = self._discover_from_json_proxy(base_domain, site_url)
        if _json_proxy_urls:
            if not (template and template.get('listing_link_selector')):
                logger.info(f"JSON proxy found {len(_json_proxy_urls)} listings; skipping crawl")
                return list(_json_proxy_urls)
            logger.info(f"JSON proxy cache populated ({len(_json_proxy_urls)} entries); template controls URL discovery")

        # ── TEMPLATE-GUIDED DISCOVERY (if configured) ─────────────────────────
        # When an admin has explicitly configured CSS selectors for this broker,
        # use them as the primary discovery method — far more reliable and precise
        # than any heuristic.  Falls back to auto-detection if selectors find nothing.
        if template and template.get('listing_link_selector'):
            logger.info(f"[Template] Trying listing_link_selector: {template['listing_link_selector']}")
            tmpl_urls = self._discover_with_template(site_url, template)
            if tmpl_urls:
                logger.info(f"[Template] Found {len(tmpl_urls)} listing URLs; skipping heuristic discovery")
                return tmpl_urls
            logger.warning("[Template] listing_link_selector matched no links; falling back to auto-detection")

        # Method 2: WordPress REST API early probe
        # A lightweight pre-check (`/wp-json/`) tells us instantly if this is a WP site.
        # If yes, run _discover_from_wp_rest NOW so BFS false-positives can't block it.
        _wp_rest_tried = False
        try:
            _wpc = requests.get(
                f"{base_domain}/wp-json/",
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
                timeout=4,
            )
            if _wpc.status_code == 200 and "json" in _wpc.headers.get("content-type", ""):
                _wp_rest_tried = True
                _wp_early_urls = self._discover_from_wp_rest(base_domain)
                if _wp_early_urls:
                    logger.info(f"WP REST early probe found {len(_wp_early_urls)} listings; skipping crawl")
                    return list(_wp_early_urls)
        except Exception:
            pass

        visited_pages: set = set()
        listing_urls: set = set()
        ever_queued: set = set()  # tracks ALL URLs ever added to queue — prevents re-queuing
        # Queue entries are (url, from_start_page)
        queue: List[tuple] = [(site_url, True)]
        ever_queued.add(site_url)

        # URL path patterns that strongly indicate a single listing detail page
        listing_path_patterns = [
            r"/listing[s]?/",
            r"/boat[s]?/",
            r"/yacht[s]?/",
            r"/vessel[s]?/",
            r"/sale[s]?/",
            r"/for-sale/",
            r"/available/[^/]+",
            r"/detail[s]?/",
            r"/view/",
            r"/fleet/[^/]+",
            r"/inventory/[^/]+/?$",
            r"/motor.?yacht[s]?/",
            r"/sail.?boat[s]?/",
            r"/sailing[s]?/[^/]+",
            r"/catamaran[s]?/",
            r"/powerboat[s]?/",
            r"/\d{4,}/",
            r"-for-sale",
            r"-yacht$",
            r"-boat$",
            r"-sales/",          # e.g. /yacht-sales/year-make-model
            r"-prk/",            # yacht broker CMS individual listing pages (e.g. rickobeyyachtsales.com)
            r"second-hand",      # e.g. /en/second-hand-boats-offers/boat-slug/ (totnautic.com)
            r"/our-boats/[^/]+/?$",   # e.g. /our-boats/boat-slug/ (tot-nautic.com EN inventory)
            r"/our-yachts/[^/]+/?$",
        ]

        # Keywords in a path that suggest an inventory index page worth crawling deeper
        inventory_keywords = [
            "/inventory", "/listings", "/boats", "/yachts", "/search", "/page",
            "/fleet", "/available", "/for-sale", "/vessels", "/buy",
            "/powerboats", "/sailboats", "/catamarans", "/motor-yachts",
            "/our-boats", "/our-yachts", "/center-console", "/express-cruiser",
            "/yacht-condition", "/boat-condition", "/vessel-condition",  # e.g. /yacht-condition/used
        ]

        skip_re = re.compile(
            r"\.(css|js|jpg|jpeg|png|gif|svg|pdf|xml|ico|woff2?|ttf|map)($|\?)"
            r"|^mailto:|^tel:|javascript:",
            re.IGNORECASE,
        )

        def looks_like_listing(url: str) -> bool:
            return any(re.search(p, url, re.IGNORECASE) for p in listing_path_patterns)

        def is_inventory_page(path: str) -> bool:
            return any(kw in path for kw in inventory_keywords)

        is_pagination_link = self._is_pagination_link

        pages_crawled = 0
        while queue and pages_crawled < max_pages:
            page_url, from_start = queue.pop(0)
            url_no_frag = page_url.split("#")[0]           # full URL, fragment stripped
            clean_url = url_no_frag.split("?")[0].rstrip("/")  # path only
            # Normalize http -> https to avoid double-visiting the same page
            if clean_url.startswith("http://"):
                clean_url = "https://" + clean_url[7:]
                url_no_frag = "https://" + url_no_frag[7:]
            # For URLs with query params (paginated pages like ?page=2 or ?SERVICE=YACHTS&...),
            # use the FULL URL as the dedup key so each paginated page is visited separately.
            # For plain path URLs, the path-only clean_url is the stable identity.
            dedup_key = url_no_frag if "?" in url_no_frag else clean_url
            if dedup_key in visited_pages:
                continue
            visited_pages.add(dedup_key)
            pages_crawled += 1

            html = self.fetch_page(url_no_frag)  # fetch with full URL so paginated pages work
            if not html:
                continue

            soup = BeautifulSoup(html, "html.parser")
            found_listing_link = False
            # current_page_path is used by the post-loop pagination check;
            # must be defined here so it's always set even if the loop finds no links.
            current_page_path = urlparse(clean_url).path

            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if skip_re.search(href):
                    continue

                absolute = urljoin(base_domain, href) if not href.startswith("http") else href
                # Preserve query params for URLs that use ?id=N style identification
                # (e.g. yachtsvancouver.com/yacht-details?id=2829623).
                # Without this, all such listings collapse to one deduplicated URL.
                abs_no_query = absolute.split("#")[0].split("?")[0]
                abs_with_query = absolute.split("#")[0]  # keep query, strip fragment only
                has_id_param = bool(self._ID_QUERY_PARAM_RE.search(abs_with_query))
                abs_clean = abs_with_query if has_id_param else abs_no_query

                if urlparse(abs_no_query).netloc != parsed_base.netloc:
                    continue
                if abs_clean in visited_pages:
                    continue

                path = urlparse(abs_no_query).path

                if has_id_param or looks_like_listing(abs_no_query):
                    listing_urls.add(abs_clean)
                    found_listing_link = True
                elif abs_clean not in ever_queued:
                    if is_inventory_page(path.lower()):
                        queue.append((abs_clean, False))
                        ever_queued.add(abs_clean)
                    elif from_start and not self._NON_LISTING_PATHS.search(path):
                        # For root-domain starts: follow all internal non-admin links.
                        # This handles brokers where listings live at non-standard URL paths.
                        # For sub-page starts (e.g. /yacht-condition/used): stay within the
                        # same path scope so we don't accidentally crawl /new or /charter
                        # sections and inflate the listing count.
                        path_in_scope = is_root_start or path.lower().startswith(start_path.lower())
                        if path_in_scope:
                            queue.append((abs_clean, False))
                            ever_queued.add(abs_clean)

            # ── Pagination detection: add pagination links to queue if on inventory page ──
            # Fires when we're on a known inventory/listing index page, OR when listing
            # links were found on the current page (handles non-standard index pages like
            # /Featured-Yachts-Available-Now-srk/ on custom yacht-broker CMSes).
            if found_listing_link or is_inventory_page(current_page_path.lower()):
                for a in soup.find_all("a", href=True):
                    href = a["href"].strip()
                    if skip_re.search(href):
                        continue
                    absolute = urljoin(base_domain, href) if not href.startswith("http") else href
                    abs_no_query = absolute.split("#")[0].split("?")[0]
                    abs_with_query = absolute.split("#")[0]
                    abs_clean = abs_with_query
                    
                    if urlparse(abs_no_query).netloc != parsed_base.netloc:
                        continue
                    if abs_clean in visited_pages or abs_clean in ever_queued:
                        continue
                    
                    if is_pagination_link(href, base_domain):
                        # Preserve seed filter params (e.g. ?agent=X) on pagination links
                        # so page 2, 3 etc. still return the same filtered results.
                        if _seed_filter_params and '?' not in abs_clean:
                            abs_clean = f"{abs_clean}?{_seed_filter_params}"
                        elif _seed_filter_params and '?' in abs_clean:
                            # Merge: add filter params that aren't already present
                            existing_keys = {p.split('=')[0] for p in abs_clean.split('?', 1)[1].split('&')}
                            for _fp in _seed_filter_params.split('&'):
                                _fk = _fp.split('=')[0]
                                if _fk and _fk not in existing_keys:
                                    abs_clean += f'&{_fp}'
                        if abs_clean not in ever_queued:
                            queue.append((abs_clean, False))
                            ever_queued.add(abs_clean)

            # Vessel-card direct extraction: for CMSes that render all listings as
            # card elements on one page using ?id=N hrefs. Skips sold/unavailable cards.
            for card in soup.find_all("div", class_=lambda c: c and "vessel-card" in " ".join(c)):
                card_classes = set(card.get("class") or [])
                if card_classes & self._SOLD_CARD_CLASSES:
                    continue  # skip sold / off-market cards
                for a in card.find_all("a", href=True):
                    href = a["href"].strip()
                    if not href or skip_re.search(href):
                        continue
                    absolute_href = urljoin(base_domain, href) if not href.startswith("http") else href
                    abs_href = absolute_href.split("#")[0]  # preserve query params
                    if urlparse(abs_href.split("?")[0]).netloc != parsed_base.netloc:
                        continue
                    listing_urls.add(abs_href)
                    found_listing_link = True

            # Content-sniff fallback: if we visited a page that was linked from the
            # homepage and it has no conventional listing sub-links, check if the page
            # itself looks like a single vessel detail page (small brokers often do this).
            if not from_start and not found_listing_link and clean_url != site_url:
                text = self.clean_html(html)
                if self._looks_like_single_listing(text, self.extract_price_from_text):
                    listing_urls.add(clean_url)

        # ── Headless browser retry for AJAX-heavy sites ──────────────────────
        # Run BEFORE WP REST / sitemap so a JS-rendered inventory page gets a
        # real render pass first. Fires when static BFS found fewer than 5 URLs.
        if _PLAYWRIGHT_AVAILABLE and len(listing_urls) < 5:
            # Prefer remaining queue items; fall back to the original start URL
            # so we always have at least one inventory page to render.
            headless_targets = list(queue) if queue else []
            # Also include visited inventory-like pages (e.g. the start URL)
            for vp in list(visited_pages)[:10]:
                vp_path = urlparse(vp).path
                if is_inventory_page(vp_path.lower()):
                    if not any(vp == t[0] for t in headless_targets):
                        headless_targets.append((vp, False))
            if not headless_targets:
                headless_targets = [(site_url, True)]
            logger.info(f"Static crawl found {len(listing_urls)} listings; retrying with headless browser")
            headless_urls = self._discover_with_headless(base_domain, headless_targets, inventory_keywords, listing_path_patterns, seed_filter_params=_seed_filter_params)
            if headless_urls:
                listing_urls.update(headless_urls)
                logger.info(f"Headless browser added {len(headless_urls)} listings, total now: {len(listing_urls)}")

        # ── WP REST API discovery — skip if already tried in the fast probe above ────
        # JSON endpoints are typically NOT behind CF HTML challenges, making this
        # the most reliable discovery method for WP-based broker sites.
        # EXCEPTION: skip when the seed URL has filter params (e.g. ?agent=X) because
        # WP REST has no concept of per-agent filtering and would return ALL listings
        # from multi-broker platforms, ignoring the intended filter.
        if not listing_urls and not _wp_rest_tried and not _has_filter_params:
            listing_urls = self._discover_from_wp_rest(base_domain)

        # ── Sitemap fallback ──────────────────────────────────────────────────
        if not listing_urls:
            listing_urls = self._discover_from_sitemap(base_domain, listing_path_patterns)

        # Strip the inventory seed URL itself from the discovered set.
        # The seed URL's path often matches listing path patterns (e.g. /listings/)
        # causing it to be added spuriously during BFS or content-sniff passes.
        _site_stripped = site_url.rstrip('/')
        listing_urls -= {site_url, _site_stripped, _site_stripped + '/'}

        return list(listing_urls)

    # ------------------------------------------------------------------
    # JSON PROXY API DISCOVERY
    # ------------------------------------------------------------------
    def _discover_from_json_proxy(self, base_domain: str, site_url: str) -> set:
        """Detect a custom JSON proxy API baked into the page's JavaScript
        (pattern: ``var PROXY = "https://..."``), fetch it, and build pre-cached
        listing data for every item.  Returns a set of synthetic fragment URLs.

        This handles sites like yachtzero.com which use a Squarespace front-end
        backed by a Cloudflare Worker that proxies a YachtWay / YachtWay-style API.
        """
        found: set = set()
        try:
            html = self.fetch_page(site_url)
            if not html:
                return found

            # Look for: var PROXY = "https://some-cloudflare-worker.workers.dev"
            proxy_match = re.search(
                r'var\s+PROXY\s*=\s*["\']([^"\'\']+)["\']',
                html,
            )
            if not proxy_match:
                return found

            proxy_url = proxy_match.group(1).strip()
            logger.info(f"JSON proxy API detected: {proxy_url}")

            resp = requests.get(
                proxy_url,
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=15,
            )
            if not resp.ok:
                logger.warning(f"JSON proxy API returned {resp.status_code}: {proxy_url}")
                return found

            data = resp.json()
            items = data if isinstance(data, list) else data.get("data", [])
            if not isinstance(items, list):
                return found

            logger.info(f"JSON proxy API returned {len(items)} listings")

            for item in items:
                if not isinstance(item, dict):
                    continue
                uid = item.get("id") or item.get("uuid")
                if not uid:
                    continue

                # Build a stable synthetic URL so the ORM can track this listing.
                synthetic_url = f"{site_url}#listing-id={uid}"

                # --- Map JSON fields → scraper data dict ---
                make = item.get("make") or ""
                model = item.get("model") or ""
                year = item.get("year")
                title = " ".join(filter(None, [str(year) if year else "", make, model])).strip()

                price_obj = item.get("price") or {}
                price_val = price_obj.get("value") if isinstance(price_obj, dict) else None
                currency = price_obj.get("currency", "USD") if isinstance(price_obj, dict) else "USD"

                loc = item.get("location") or {}
                city = loc.get("city")
                state = loc.get("state")
                country_raw = loc.get("country")
                # Normalize ISO-2 country codes
                if country_raw and len(country_raw) == 2:
                    country_raw = self.normalize_location(None, None, country_raw)[2] or country_raw

                engines_obj = item.get("engines") or {}
                fuel_type = (engines_obj.get("fuelType") or "").capitalize() or None
                engine_count = len(engines_obj.get("engines") or []) or None
                # Average engine hours across all engines
                hours_list = [
                    e.get("engineHours")
                    for e in (engines_obj.get("engines") or [])
                    if isinstance(e, dict) and e.get("engineHours")
                ]
                engine_hours = (sum(hours_list) / len(hours_list)) if hours_list else None

                features_list = item.get("features") or []
                features_text = ", ".join(features_list) if features_list else None

                image_url = item.get("imageUrl")
                images = [image_url] if image_url else []

                listing_data: Dict = {
                    "title": title or None,
                    "make": make or None,
                    "model": model or None,
                    "year": int(year) if year else None,
                    "price": float(price_val) if price_val else None,
                    "currency": currency,
                    "length_feet": float(item["lengthOverall"]) if item.get("lengthOverall") else None,
                    "max_speed_knots": float(item["topSpeed"]) if item.get("topSpeed") else None,
                    "cabins": int(item["cabins"]) if item.get("cabins") else None,
                    "fuel_type": fuel_type,
                    "engine_count": engine_count,
                    "engine_hours": engine_hours,
                    "city": city,
                    "state": state,
                    "country": country_raw,
                    "features": features_text,
                    "feature_bullets": features_list or None,
                    "images": images,
                    "detected_agent_name": item.get("offeredBy"),
                }

                self._json_api_cache[synthetic_url] = listing_data
                found.add(synthetic_url)

        except Exception as exc:
            logger.warning(f"_discover_from_json_proxy failed for {site_url}: {exc}")

        return found

    def _discover_from_wp_rest(self, base_domain: str) -> set:
        """
        Query the WordPress REST API to discover all listing URLs.
        First auto-discovers registered custom post types via /wp-json/wp/v2/types
        (finds the actual rest_base slug, e.g. "sale" on taityachts.net), then falls
        back to a hardcoded list of common slugs if discovery returns nothing.
        """
        found: set = set()
        _api_hdrs = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

        # ── Step 1: auto-discover post types via /wp-json/wp/v2/types ────────
        # Built-in WP types and known non-listing plugin types to skip
        _BUILTIN_WP = {
            'post', 'page', 'attachment', 'nav_menu_item', 'revision',
            'wp_block', 'wp_template', 'wp_template_part', 'wp_global_styles',
            'wp_navigation', 'wp_font_family', 'wp_font_face',
        }
        _NON_LISTING_REST_BASES = {
            'posts', 'pages', 'menu-items', 'blocks', 'templates', 'template-parts',
            'global-styles', 'navigation', 'font-families', 'kadence_form',
            'kadence_navigation', 'kadence_header', 'kadence_lottie', 'kadence_vector',
            'gp_elements', 'gp_font', 'widgetopts_snippet', 'guest_book_entry',
            'charter',  # charter yachts, not for-sale listings
        }
        discovered_bases: list = []
        try:
            r = requests.get(
                f"{base_domain}/wp-json/wp/v2/types",
                headers=_api_hdrs, timeout=10,
            )
            if r.ok:
                types_data = r.json()
                if isinstance(types_data, dict):
                    for type_slug, type_info in types_data.items():
                        if type_slug in _BUILTIN_WP or not isinstance(type_info, dict):
                            continue
                        rest_base = type_info.get('rest_base', '')
                        # Skip complex REST base patterns and known non-listing types
                        if rest_base and '(?P<' not in rest_base and rest_base not in _NON_LISTING_REST_BASES:
                            discovered_bases.append(rest_base)
                            logger.info(f"WP REST type discovered: {type_slug} → rest_base={rest_base}")
        except Exception:
            pass

        # ── Step 2: hardcoded fallback slugs (used if discovery finds nothing) ─
        _HARDCODED = [
            'listings', 'boats', 'yachts', 'vessels', 'motorboats', 'sailboats',
            'sale',           # taityachts.net (post type slug: sale, rest_base: sale)
            'yacht-sales', 'yacht_sales', 'boat-listings',
            'product', 'property',
        ]
        # Merge: discovered bases first, then hardcoded ones not already present
        all_rest_bases = discovered_bases + [t for t in _HARDCODED if t not in discovered_bases]

        for post_type in all_rest_bases:
            page = 1
            while page <= 5:  # up to 500 items per post type
                try:
                    r = requests.get(
                        f"{base_domain}/wp-json/wp/v2/{post_type}",
                        params={"per_page": 100, "page": page, "_fields": "id,link"},
                        headers=_api_hdrs, timeout=10,
                    )
                    if not r.ok:
                        break
                    items = r.json()
                    if not isinstance(items, list) or not items:
                        break
                    for item in items:
                        if isinstance(item, dict) and item.get('link') and item.get('id'):
                            norm_url = item['link'].rstrip('/')
                            found.add(norm_url)
                            # Cache (post_type, wp_post_id) so scrape_single_listing
                            # can fetch by the real WP ID, not the custom ?id= param.
                            self._wp_rest_id_map[norm_url] = (post_type, str(item['id']))
                    if len(items) < 100:
                        break
                    page += 1
                except Exception:
                    break
        return found

    def _discover_from_sitemap(self, base_domain: str, listing_path_patterns: list) -> set:
        """Return a set of listing URLs parsed from sitemap.xml / sitemap_index.xml."""
        found: set = set()
        visited_sitemaps: set = set()

        def _parse(sm_url: str):
            if sm_url in visited_sitemaps or len(visited_sitemaps) > 10:
                return
            visited_sitemaps.add(sm_url)
            try:
                xml_text = self.fetch_page(sm_url, timeout=15)
                if not xml_text:
                    return
                for loc_m in re.finditer(r'<loc>\s*(https?://[^\s<]+)\s*</loc>', xml_text):
                    loc = loc_m.group(1).strip()
                    if loc.lower().endswith('.xml'):
                        _parse(loc)  # recurse into sub-sitemaps / sitemap-index entries
                    else:
                        has_id = bool(self._ID_QUERY_PARAM_RE.search(loc))
                        if has_id or any(re.search(p, loc, re.IGNORECASE) for p in listing_path_patterns):
                            found.add(loc)
            except Exception:
                pass

        for path in ('/sitemap.xml', '/sitemap_index.xml'):
            _parse(f"{base_domain}{path}")
            if found:
                break  # stop after first successful sitemap
        return found

    # Headless rendering is a slow, subprocess-based fallback — cap how many
    # pages a single stubborn/JS-only site can force us to render per run.
    # Raised well past what a normal broker needs so a large inventory
    # (hundreds/thousands of listings across many pages) isn't truncated —
    # this is a runaway-pagination safety net, not a "normal site" limit.
    _HEADLESS_MAX_PAGES = 500
    # Discovery is bounded by IDLE time, not total elapsed time: as long as
    # new listings/pages keep turning up, keep going — a large broker on a
    # slow/proxy-dependent site legitimately needs a long time to fully
    # discover, and cutting it off on a fixed clock (the previous approach)
    # meant repeated partial runs that never converged on full coverage
    # without days of accumulation. Only give up once discovery has gone
    # quiet — no new listing or pagination target found — for this long.
    _HEADLESS_DISCOVERY_IDLE_TIMEOUT_SECONDS = 180
    # Absolute last-resort ceiling regardless of progress, purely against a
    # pathological site (e.g. a "next page" link that loops forever) — high
    # enough to never bind on a real broker, however large.
    _HEADLESS_DISCOVERY_MAX_TOTAL_SECONDS = 3 * 60 * 60

    def _discover_with_headless(self, base_domain: str, inventory_pages: List[Tuple[str, bool]],
                                inventory_keywords: List[str], listing_path_patterns: List[str],
                                seed_filter_params: str = '') -> set:
        """Retry discovery using headless browser for AJAX-heavy sites.
        Fetches known inventory pages with JavaScript executed and extracts listings.

        Also follows pagination discovered in the *rendered* HTML — a site whose
        static fetch gets blocked (so the static BFS crawl never sees real
        pagination links) but whose headless render succeeds still has multiple
        pages of inventory beyond whichever single page seeded this call.
        Without this, only page 1's listings were ever found (see the
        bviyachtsales.com case: static fetch blocked, headless rendered page 1
        fine, but pages 2-6 — reachable via plain `/page/N/` links once JS
        runs — were never visited)."""
        if not _PLAYWRIGHT_AVAILABLE or not inventory_pages:
            return set()

        found: set = set()
        parsed_base = urlparse(base_domain)
        skip_re = re.compile(
            r"\.(css|js|jpg|jpeg|png|gif|svg|pdf|xml|ico|woff2?|ttf|map)($|\?)"
            r"|^mailto:|^tel:|javascript:",
            re.IGNORECASE,
        )

        queue: List[str] = []
        visited: set = set()
        for page_url, _ in inventory_pages[:5]:
            if urlparse(page_url).netloc == parsed_base.netloc and page_url not in queue:
                queue.append(page_url)

        try:
            self._init_browser()
            # Note: _init_browser is a no-op; headless fetching is subprocess-based.
            # fetch_page_headless() handles everything — just call it directly.

            pages_rendered = 0
            discovery_started_at = time.monotonic()
            last_progress_at = discovery_started_at
            prev_progress_count = 0  # len(found) + len(queue) — grows on any new listing OR pagination target
            while queue and pages_rendered < self._HEADLESS_MAX_PAGES:
                now = time.monotonic()
                idle_for = now - last_progress_at
                total_elapsed = now - discovery_started_at
                if idle_for >= self._HEADLESS_DISCOVERY_IDLE_TIMEOUT_SECONDS:
                    logger.warning(
                        f"Headless discovery: gone {idle_for:.0f}s with no new listings/pages found "
                        f"(after {pages_rendered} page(s), {len(found)} listings, {total_elapsed:.0f}s total) "
                        f"— stopping, {len(queue)} page(s) left unvisited"
                    )
                    break
                if total_elapsed >= self._HEADLESS_DISCOVERY_MAX_TOTAL_SECONDS:
                    logger.warning(
                        f"Headless discovery: hit the {self._HEADLESS_DISCOVERY_MAX_TOTAL_SECONDS}s absolute "
                        f"ceiling despite still making progress (after {pages_rendered} page(s), {len(found)} "
                        f"listings) — stopping, {len(queue)} page(s) left unvisited"
                    )
                    break
                page_url = queue.pop(0)
                if page_url in visited:
                    continue
                visited.add(page_url)
                if pages_rendered > 0:
                    # Same reasoning as the jittered delay between listing
                    # fetches in run_scraper_job: rendering pages back-to-back
                    # with zero delay reads as bot traffic to a WAF and risks
                    # getting the platform blocked harder than a single slow
                    # page ever would.
                    time.sleep(random.uniform(0.6, 1.4))
                pages_rendered += 1

                html = self.fetch_page_headless(page_url, timeout=30)
                if not html:
                    continue

                logger.info(f"Headless: fetched {page_url}")

                soup = BeautifulSoup(html, "html.parser")

                # Extract listing links from rendered content
                for a in soup.find_all("a", href=True):
                    href = a["href"].strip()
                    if skip_re.search(href):
                        continue

                    absolute = urljoin(base_domain, href) if not href.startswith("http") else href
                    abs_no_query = absolute.split("#")[0].split("?")[0]
                    abs_with_query = absolute.split("#")[0]
                    has_id_param = bool(self._ID_QUERY_PARAM_RE.search(abs_with_query))
                    abs_clean = abs_with_query if has_id_param else abs_no_query

                    if urlparse(abs_no_query).netloc != parsed_base.netloc:
                        continue

                    # Check pagination FIRST — a page-2+ link's path often still
                    # contains the inventory segment (e.g. "/yachts/page/2/"
                    # contains "/yachts/"), so it can spuriously match a listing
                    # pattern too. Checking listing patterns first would treat it
                    # as a bogus "listing" and never queue it, capping discovery
                    # at whatever page seeded this call — exactly what happened
                    # before this ordering fix. Classification must not depend on
                    # visited/queued state, or an already-seen pagination link
                    # would fall through to the listing check below instead of
                    # being correctly ignored.
                    if self._is_pagination_link(href, base_domain):
                        # Use abs_with_query, not abs_clean — a pagination link's
                        # own query string (e.g. bviyachtsales.com's own
                        # "?exclude_sold=1") is part of how that site scopes its
                        # pagination and must be preserved, same as an ID param;
                        # abs_clean only special-cases ID-style params and would
                        # otherwise silently drop it.
                        if abs_with_query not in visited and abs_with_query not in queue:
                            # Preserve seed filter params (e.g. ?agent=X) the same
                            # way the static crawl does, so page 2, 3... don't
                            # silently widen the scrape beyond this job's config.
                            target = abs_with_query
                            if seed_filter_params and '?' not in target:
                                target = f"{target}?{seed_filter_params}"
                            elif seed_filter_params and '?' in target:
                                existing_keys = {p.split('=')[0] for p in target.split('?', 1)[1].split('&')}
                                for _fp in seed_filter_params.split('&'):
                                    _fk = _fp.split('=')[0]
                                    if _fk and _fk not in existing_keys:
                                        target += f'&{_fp}'
                            if target not in visited and target not in queue:
                                queue.append(target)
                    elif any(re.search(p, abs_no_query, re.IGNORECASE) for p in listing_path_patterns):
                        found.add(abs_clean)

                # Also check for vessel-card elements
                for card in soup.find_all("div", class_=lambda c: c and "vessel-card" in " ".join(c)):
                    card_classes = set(card.get("class") or [])
                    if card_classes & self._SOLD_CARD_CLASSES:
                        continue

                    for a in card.find_all("a", href=True):
                        href = a["href"].strip()
                        if not href or skip_re.search(href):
                            continue
                        absolute_href = urljoin(base_domain, href) if not href.startswith("http") else href
                        abs_card_no_query = absolute_href.split("#")[0].split("?")[0]
                        abs_card_with_query = absolute_href.split("#")[0]
                        has_card_id = bool(self._ID_QUERY_PARAM_RE.search(abs_card_with_query))
                        abs_card_clean = abs_card_with_query if has_card_id else abs_card_no_query
                        if urlparse(abs_card_no_query).netloc != parsed_base.netloc:
                            continue
                        # Only add if it looks like a real listing (same check as main loop)
                        if has_card_id or any(re.search(p, abs_card_no_query, re.IGNORECASE) for p in listing_path_patterns):
                            found.add(abs_card_clean)

                # Progress = new listings found OR new pages queued this iteration
                # (even a page that itself yielded nothing new but successfully
                # rendered doesn't reset the idle clock — genuine forward motion
                # is what earns more time, not just "a page loaded").
                current_progress_count = len(found) + len(queue)
                if current_progress_count > prev_progress_count:
                    last_progress_at = time.monotonic()
                    prev_progress_count = current_progress_count

            logger.info(f"Headless browser discovery found {len(found)} listings across {pages_rendered} page(s)")

        except Exception as exc:
            logger.warning(f"Headless browser discovery failed: {exc}")
        finally:
            self._cleanup_browser()

        return found

    # ---------------------------------------------------------
    # STRUCTURED EXTRACTION
    # ---------------------------------------------------------
    def try_structured_extraction(self, html: str, url: str) -> Optional[Dict]:
        soup = BeautifulSoup(html, "html.parser")
        domain = urlparse(url).netloc
        for pattern_domain, selectors in self.site_patterns.items():
            if pattern_domain in domain:
                data = {}
                for field, selector in selectors.items():
                    element = soup.find(**selector)
                    if element:
                        data[field] = element.get_text(strip=True)
                if data:
                    return data
        return None

    # ---------------------------------------------------------
    # REGEX EXTRACTION
    # ---------------------------------------------------------
    def extract_price_from_text(self, text: str) -> Optional[float]:
        """Extract a price value from text. Returns just the numeric value for backwards-compat.
        For full (price, currency) use extract_price_with_currency."""
        result = self.extract_price_with_currency(text)
        return result[0] if result else None

    def extract_price_with_currency(self, text: str) -> Optional[tuple]:
        """Return (price_float, currency_str) or None if no price found.

        Detects:
          USD  — $ / US$ / USD
          CAD  — C$ / CA$ / CAD / CDN$ / Can$
          EUR  — € / EUR
          GBP  — £ / GBP
          AUD  — A$ / AUD
          NZD  — NZ$ / NZD

        When only a bare "$" is found, the page text is scanned for CAD/AUD/NZD
        context (e.g. "CAD", "Canadian", "C$" / "AUD", "Australian" / "NZD",
        "New Zealand") so that non-US "$" sites — Canadian, Australian, or NZ
        brokers — that display prices as "$1,250,000" with no explicit currency
        symbol are correctly tagged instead of only Canadian sites getting this
        treatment and Australian/NZ sites silently defaulting to USD.
        """
        # Detect the page's dominant non-USD "$" currency, if any, so a bare "$"
        # can be tagged correctly instead of defaulting to USD. Checked in this
        # order since a page is realistically only ever one of these.
        cad_context = bool(re.search(
            r'\bCAD\b|\bC\$\b|\bCDN\$\b|\bCanadian\s+dollar|\bprix\s+en\s+CAD',
            text, re.IGNORECASE
        ))
        aud_context = bool(re.search(
            r'\bAUD\b|\bA\$\b|\bAustralian\s+dollar', text, re.IGNORECASE
        ))
        nzd_context = bool(re.search(
            r'\bNZD\b|\bNZ\$\b|\bNew\s+Zealand\s+dollar', text, re.IGNORECASE
        ))
        if cad_context:
            bare_dollar_currency = "CAD"
        elif aud_context:
            bare_dollar_currency = "AUD"
        elif nzd_context:
            bare_dollar_currency = "NZD"
        else:
            bare_dollar_currency = "USD"

        # Each pattern: (regex, currency_code)
        # Ordered most-specific first so "C$" is tried before bare "$"
        patterns = [
            # CAD explicit labels
            (r"(?:C\$|CA\$|CDN\$|Can\$|CAD)\s*(\d[\d,.\s]*)", "CAD"),
            # USD explicit labels
            (r"(?:US\$|USD)\s*(\d[\d,.\s]*)", "USD"),
            # AUD explicit labels
            (r"(?:A\$|AUD)\s*(\d[\d,.\s]*)", "AUD"),
            # NZD explicit labels
            (r"(?:NZ\$|NZD)\s*(\d[\d,.\s]*)", "NZD"),
            # EUR — also handle trailing symbol (e.g. "33.000€", "45.000 €").
            # NB: \b must only follow the alphabetic code — after "€" (a non-word
            # char) a word boundary never matches before space/EOL, which silently
            # broke trailing-symbol extraction for the exact case it was added for.
            (r"(?:€|EUR)\s*(\d[\d,.\s]*)", "EUR"),
            (r"(\d[\d,.\s]*)\s*(?:€|EUR\b)", "EUR"),
            # GBP — also handle trailing symbol
            (r"(?:£|GBP)\s*(\d[\d,.\s]*)", "GBP"),
            (r"(\d[\d,.\s]*)\s*(?:£|GBP\b)", "GBP"),
            # Trailing currency label: "150,000 CAD", "150,000 USD", "150,000 EUR"
            (r"(\d[\d,.\s]+)\s*\b(CAD|USD|EUR|GBP|AUD|NZD)\b", None),
            # Bare $ — ambiguous; tagged per page-wide context detected above
            (r"\$\s*(\d[\d,.\s]*)", bare_dollar_currency),
        ]
        def _scan(segment: str) -> Optional[tuple]:
            for pat, currency in patterns:
                m = re.search(pat, segment, re.IGNORECASE)
                if not m:
                    continue
                if currency is None:
                    # Trailing-label pattern — group 1 is digits, group 2 is currency
                    raw_num = m.group(1)
                    currency = m.group(2).upper()
                else:
                    raw_num = m.group(1)
                # Normalise European number formatting where "." is the thousands separator
                # and "," is the decimal separator (e.g. "45.000" = 45 000, "145.000,50" = 145 000.50).
                # Rule: if the string contains "," after a ".", it's European (comma = decimal).
                # Also: if the number ends with exactly ".XXX" (3 digits) and has no comma at all,
                # assume the dot is a thousands separator (covers "45.000€" → 45000).
                cleaned = raw_num.strip()
                if re.search(r'\.[0-9]{3}', cleaned) and ',' not in cleaned:
                    # European thousands-dot(s): remove all dots → integer
                    cleaned = cleaned.replace('.', '').replace(' ', '')
                elif ',' in cleaned and '.' in cleaned and cleaned.index('.') < cleaned.index(','):
                    # European: "145.000,50" → "145000.50"
                    cleaned = cleaned.replace('.', '').replace(',', '.').replace(' ', '')
                else:
                    cleaned = re.sub(r'[,\s]', '', cleaned)
                cleaned = cleaned.rstrip('.')
                try:
                    val = float(cleaned)
                    if val < 1000:  # sanity — no yacht for under $1000
                        continue
                    return val, currency
                except ValueError:
                    continue
            return None

        # Reduced/superseded-price framing ("Reduced from $650,000 to $549,000",
        # "Was $650,000 Now $549,000") has no single "price" label attached to
        # the CURRENT figure, so the generic label scan below would either miss
        # it or (worse) grab the old, higher number if it happens to sit near a
        # "price" label elsewhere on the page. Handle these phrasings first,
        # scanning only the text *after* "to"/"now" for the current price.
        for reduced_match in re.finditer(
            r"(?:reduced|was)\b.{0,80}?\b(?:to|now)\b\s*[:\-]?\s?(.{0,60})",
            text, re.IGNORECASE,
        ):
            # Scan only the captured group (text *after* "to"/"now") — the full
            # match span still contains the old/higher price before "to", which
            # would otherwise win by appearing earlier in the segment.
            hit = _scan(reduced_match.group(1))
            if hit:
                return hit

        # Prefer a number sitting next to a label that specifically indicates the
        # CURRENT asking price over a generic/possibly-stale one. "List price" /
        # "original price" / "msrp" can refer to a superseded figure on listings
        # that also show a lower current price elsewhere — try the strong labels
        # first so a later "asking price" doesn't lose to an earlier "list price".
        strong_labels = r"(?:(?:asking|reduced|sale|current)\s+price|reduced\s+to|prezzo|prix|preis)"
        for label_match in re.finditer(
            strong_labels + r"\s*[:\-]?\s?.{0,60}",
            text, re.IGNORECASE,
        ):
            hit = _scan(label_match.group(0))
            if hit:
                return hit

        # Fall back to generic/weak labels (may occasionally be a stale price on
        # a page that doesn't use any of the strong labels above, but a plausible
        # match beats none).
        for label_match in re.finditer(
            r"(?:list\s+price|original\s+price|msrp|price)\s*[:\-]?\s?.{0,60}",
            text, re.IGNORECASE,
        ):
            hit = _scan(label_match.group(0))
            if hit:
                return hit

        return _scan(text)

    def extract_specs_from_text(self, text: str) -> Dict:
        specs = {}
        # Also matches meters ("18.5m", "18,50 m", "18.5 meters") so a European
        # site's LOA doesn't get silently treated as feet — see
        # _parse_measurement_to_feet.
        length_match = re.search(
            r"(\d+(?:[.,]\d+)?)\s*(ft|feet|foot|'|m\b|meters?|metres?)",
            text, re.IGNORECASE,
        )
        if length_match:
            converted = self._parse_measurement_to_feet(length_match.group(0))
            if converted is not None:
                specs["length_feet"] = converted
        # Prefer labeled year (Year: 1996 OR 1996\nYear) over bare year in title
        year_labeled = re.search(
            r"year\s*[:\-]?\s*(19\d{2}|20\d{2})"      # Label: Value
            r"|(19\d{2}|20\d{2})\s+year",              # Value Label (Elementor style)
            text, re.IGNORECASE
        )
        year_bare = re.search(r"(19\d{2}|20\d{2})", text)
        if year_labeled:
            y = year_labeled.group(1) or year_labeled.group(2)
            specs["year"] = int(y)
        elif year_bare:
            specs["year"] = int(year_bare.group(1))
        cabin_match = re.search(r"(\d+)\s*[-\s]*cabin", text, re.IGNORECASE)
        if cabin_match:
            specs["cabins"] = int(cabin_match.group(1))
        # Engine hours: "Hours: 900", "900\nHours", "900 hours"
        hours_match = re.search(
            r"(?:engine\s+)?hours?\s*[:\-]?\s*(\d[\d,]*)\b"
            r"|(\d[\d,]*)\s+hours?\b",
            text, re.IGNORECASE
        )
        if hours_match:
            raw_hr = (hours_match.group(1) or hours_match.group(2)).replace(",", "")
            try:
                specs["engine_hours"] = float(raw_hr)
            except ValueError:
                pass
        # Engine count
        if re.search(r"twin\s+engine|two\s+(inboard|outboard|engine)", text, re.IGNORECASE):
            specs["engine_count"] = 2
        elif re.search(r"triple\s+engine|three\s+(inboard|outboard|engine)", text, re.IGNORECASE):
            specs["engine_count"] = 3
        elif re.search(r"single\s+engine|one\s+(inboard|outboard|engine)", text, re.IGNORECASE):
            specs["engine_count"] = 1
        # "two [Make]" engines pattern (e.g. "two Crusader 390 inboard engines")
        two_eng = re.search(r"\btwo\b.{0,30}engines?\b", text, re.IGNORECASE)
        if two_eng and not specs.get("engine_count"):
            specs["engine_count"] = 2
        # Location: "City, ST 12345" or "City, State" zip-optional
        loc_match = re.search(r"\b([A-Z][a-zA-Z\s]{2,25}),\s*([A-Z]{2})\s*(?:\d{5})?", text)
        if loc_match:
            specs["city"] = loc_match.group(1).strip()
            specs["state"] = loc_match.group(2).strip()
        return specs

    def extract_description_from_text(self, text: str) -> Optional[str]:
        """Extract the main description block from the clean text."""
        # Look for content block after a 'Description(s)' or international equivalent heading
        desc_match = re.search(
            r"(?:descriptions?|descrizione|descrizione\s+imbarcazione|details?|overview|about\s+this\s+(?:vessel|yacht|boat))\s*\n"
            r"(.+?)(?:\n(?:features?|caratteristiche|contact|gallery|images?|photos?|"
            r"location|map|specifications?|details|amenities|utilities|equipments?|"
            r"dotazioni|specifiche|contatt)\s*\n|\Z)",
            text, re.IGNORECASE | re.DOTALL
        )
        if desc_match:
            desc = desc_match.group(1).strip()
            # Remove very short lines that are just UI labels / navigation
            lines = [l.strip() for l in desc.splitlines() if len(l.strip()) > 20]
            desc = " ".join(lines)
            if len(desc) > 50:
                return desc
        # Fallback 1: first big paragraph (>100 chars) that isn't a nav/price line
        for para in re.split(r"\n{2,}", text):
            para = para.strip()
            if (len(para) > 100
                    and not re.match(r"^[\$\d\d]", para)
                    and not re.search(r"(cookie|privacy|copyright|all rights)", para, re.I)):
                return para
        # Fallback 2: collect consecutive non-spec lines (handles short-line layouts)
        lines_all = [l.strip() for l in text.splitlines()]
        prose_buffer: list[str] = []
        _spec_re = re.compile(r"^[\$\d€£]|^\w[\w\s]{0,25}:\s+\S|^(year|make|model|length|beam|draft|price|engine|fuel|hull|cabin)", re.I)
        for line in lines_all:
            if len(line) > 30 and not _spec_re.match(line):
                prose_buffer.append(line)
                if len(" ".join(prose_buffer)) > 120:
                    candidate = " ".join(prose_buffer)
                    if not re.search(r"(cookie|privacy|copyright|all rights)", candidate, re.I):
                        return candidate
            else:
                if len(" ".join(prose_buffer)) > 120:
                    candidate = " ".join(prose_buffer)
                    if not re.search(r"(cookie|privacy|copyright|all rights)", candidate, re.I):
                        return candidate
                prose_buffer = []
        return None

    # ---------------------------------------------------------
    # HTML SPEC TABLE PARSER
    # ---------------------------------------------------------
    _METERS_TO_FEET = 3.28084
    _LENGTH_LIKE_KEYS = {"length_feet", "beam_feet", "draft_feet"}

    def _parse_measurement_to_feet(self, raw: str) -> Optional[float]:
        """Parse a length/beam/draft value that might be given in feet OR
        meters and return it normalized to feet. European broker sites
        commonly give LOA/beam/draft in meters (e.g. "18,50 m", "5.2m") with
        no other unit anywhere on the page — blindly stripping the unit and
        keeping the raw number (the old behavior) turns an 18.5m/~60ft yacht
        into an "18 foot" listing. If no unit is present at all, feet is
        assumed (unchanged default), since that's the common case for this
        scraper's mostly US/UK-listed inventory."""
        if not raw:
            return None
        s = raw.strip()
        # "18.5m" has no word boundary between the digit and "m" (both are \w),
        # so \bm\b alone misses the common no-space short form — match a digit
        # directly followed by "m" (not "mm"/"max"/etc.) as well as the spelled-
        # out "meters"/"metres".
        is_meters = bool(
            re.search(r"\d\s*m(?![a-zA-Z])", s, re.IGNORECASE)
            or re.search(r"meters?\b|metres?\b", s, re.IGNORECASE)
        ) and not re.search(r"\bft\b|\bfeet\b|\bfoot\b|'", s, re.IGNORECASE)
        num_match = re.search(r"(\d+(?:[.,]\d+)?)", s)
        if not num_match:
            return None
        num_str = num_match.group(1)
        # European decimal-comma ("18,50") vs. thousands-comma with no decimal
        # ("1,850" — not expected for a length/beam/draft but handled safely).
        if "," in num_str and "." not in num_str:
            num_str = num_str.replace(",", ".")
        else:
            num_str = num_str.replace(",", "")
        try:
            val = float(num_str)
        except ValueError:
            return None
        if is_meters:
            val = round(val * self._METERS_TO_FEET, 2)
        return val

    def _normalize_spec_values(self, raw: Dict[str, str]) -> Dict:
        """Convert a {canonical_field: raw_string} dict — sourced from either
        the hardcoded LABEL_MAP below or the DB-driven FieldSynonym overlay in
        _parse_spec_tables_with_synonyms — into typed values, including
        unit-aware meters-to-feet conversion for length/beam/draft. Shared so
        synonym-matched values get the same typing/conversion as the hardcoded
        path instead of being passed through as raw, un-typed strings."""
        specs: Dict = {}
        int_keys = {"year", "cabins", "berths", "heads", "engine_count"}
        float_keys = {"length_feet", "beam_feet", "draft_feet", "engine_hours",
                      "max_speed_knots", "cruising_speed_knots"}
        str_keys = {"make", "model", "fuel_type", "hull_material", "hull_type",
                    "boat_type", "condition", "city", "state", "country"}

        for k, v in raw.items():
            if k in self._LENGTH_LIKE_KEYS:
                converted = self._parse_measurement_to_feet(v)
                if converted is not None:
                    specs[k] = converted
                continue
            # Strip units: "75 ft" -> "75", "900 hrs" -> "900"
            num_str = re.sub(r"[^\d.]", "", v.split()[0]) if v else ""
            if k in int_keys:
                try:
                    specs[k] = int(float(num_str))
                except (ValueError, IndexError):
                    pass
            elif k in float_keys:
                try:
                    specs[k] = float(num_str)
                except (ValueError, IndexError):
                    pass
            elif k in str_keys:
                specs[k] = v
            # "horsepower" isn't a DB field but include for AI context
            elif k == "horsepower":
                specs["horsepower_hint"] = v
            # Pass through h1 title and map-derived location
            elif k in ("_h1_title", "city", "state", "country"):
                specs[k] = v

        return specs

    def parse_spec_tables(self, html: str) -> Dict:
        """
        Extract labelled spec data from HTML tables, definition lists,
        and 'Label: Value' list items before text cleaning strips structure.
        Works well with WordPress/Elementor listing pages.
        """
        soup = BeautifulSoup(html, "html.parser")
        raw: Dict[str, str] = {}

        # Mapping of common label variants → our field names
        LABEL_MAP = {
            "year": "year", "make": "make", "manufacturer": "make",
            "model": "model", "length": "length_feet", "loa": "length_feet",
            "length overall": "length_feet", "beam": "beam_feet",
            "draft": "draft_feet", "draft max": "draft_feet",
            "hours": "engine_hours", "engine hours": "engine_hours",
            "hour meter": "engine_hours",
            "cabins": "cabins", "staterooms": "cabins",
            "berths": "berths", "sleeps": "berths", "guests": "berths",
            "heads": "heads", "bathrooms": "heads",
            "fuel type": "fuel_type", "fuel": "fuel_type",
            "hull material": "hull_material", "hull": "hull_material",
            "hull type": "hull_type", "hull form": "hull_type",
            "max speed": "max_speed_knots", "maximum speed": "max_speed_knots",
            "cruise speed": "cruising_speed_knots", "cruising speed": "cruising_speed_knots",
            "engines": "engine_count", "engine count": "engine_count",
            "type": "boat_type", "boat type": "boat_type", "vessel type": "boat_type",
            "condition": "condition",
            "city": "city", "state": "state", "country": "country",
            "horsepower": "horsepower",  # store raw for context even if not a DB field
        }

        def _set(label: str, value: str):
            key = LABEL_MAP.get(label.strip().lower())
            if key and value.strip():
                raw[key] = value.strip()

        # 1. <table> with th/td or td/td rows
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all(["th", "td"])
                if len(cells) == 2:
                    _set(cells[0].get_text(strip=True), cells[1].get_text(strip=True))

        # 2. <dl><dt>label</dt><dd>value</dd></dl>
        for dl in soup.find_all("dl"):
            dts = dl.find_all("dt")
            dds = dl.find_all("dd")
            for dt, dd in zip(dts, dds):
                _set(dt.get_text(strip=True), dd.get_text(strip=True))

        # 3. <li>Label: Value</li> or <li><strong>Label</strong>Value</li>
        for li in soup.find_all("li"):
            li_text = li.get_text(strip=True)
            if ":" in li_text:
                parts = li_text.split(":", 1)
                if len(parts[0]) < 40:  # labels are short
                    _set(parts[0], parts[1])

        # 4. Elementor / page-builder VALUE-before-LABEL div pattern
        #    e.g. <div>1996</div><div>Year</div> or "750HP" / "Horsepower"
        KNOWN_LABELS = {
            "year", "length", "loa", "beam", "draft", "hours", "hour meter",
            "engine hours", "horsepower", "hp", "cabins", "staterooms", "berths",
            "sleeps", "heads", "bathrooms", "make", "manufacturer", "model",
            "fuel type", "fuel", "hull material", "hull", "hull type",
            "max speed", "cruise speed", "cruising speed", "type", "boat type",
            "vessel type", "condition", "engines", "engine count",
        }
        val_label_pat = re.compile(
            r"^([\d,./]+(?:\s*(?:ft|'|\"|\"|HP|kts|knots|gal|nm|mph))?)?\s*"
            r"(Year|Length|LOA|Beam|Draft|Hours?|Hour\s*Meter|Engine\s*Hours?|"
            r"Horsepower|HP|Cabins?|Staterooms?|Berths?|Sleeps?|Heads?|Bathrooms?|"
            r"Make|Manufacturer|Model|Fuel\s*Type|Fuel|Hull\s*Material|Hull\s*Type|"
            r"Max\s*Speed|Cruise\s*Speed|Cruising\s*Speed|Type|Boat\s*Type|Vessel\s*Type|"
            r"Condition|Engines?|Engine\s*Count)\s*$",
            re.IGNORECASE
        )
        for tag in soup.find_all(["div", "span", "p", "td", "li"]):
            # Only look at leaf-like elements (text content, few children)
            direct_text = " ".join(tag.get_text(" ").split())
            if len(direct_text) < 60 and direct_text:
                m = val_label_pat.match(direct_text)
                if m:
                    val_part = (m.group(1) or "").strip()
                    lbl_part = (m.group(2) or "").strip()
                    if val_part and lbl_part:
                        _set(lbl_part, val_part)

        # 5. Title from headings — prefer a heading whose text looks like a boat listing
        #    title (contains a year or feet/metres measurement) over generic site names
        #    (e.g. "Rick Obey Yacht Sales").  Checks h1 first; if h1 doesn't match the
        #    boat-title heuristic, falls through to h2 as a fallback.
        _BOAT_TITLE_RE = re.compile(
            r"(\d{1,4}['\"]?\s*(19|20)\d{2}|(19|20)\d{2}\s*[-\u2013]?\s*\w|\b\d{2,3}\s*ft\b)",
            re.IGNORECASE,
        )
        _best_heading: str | None = None
        for _htag in ("h1", "h2"):
            _h = soup.find(_htag)
            if _h:
                _ht = _h.get_text(strip=True)
                if _ht:
                    if _best_heading is None:
                        _best_heading = _ht  # h1 is always the default
                    if _BOAT_TITLE_RE.search(_ht):
                        _best_heading = _ht  # switch to whichever heading looks like a boat
                        break
        if _best_heading:
            raw["_h1_title"] = _best_heading

        # 6. Location from Google Maps iframe q= parameter
        from urllib.parse import unquote, urlparse, parse_qs
        for iframe in soup.find_all("iframe"):
            src = iframe.get("src", "")
            if "maps.google.com" in src or "google.com/maps" in src:
                qs = parse_qs(urlparse(src).query)
                q = unquote(qs.get("q", [""])[0])
                if q:
                    parts = [p.strip() for p in q.split(",") if p.strip()]
                    if parts and not raw.get("city"):
                        raw["city"] = parts[0].title()
                    if len(parts) >= 2 and not raw.get("state"):
                        raw["state"] = re.sub(r"\s+\d{5}.*", "", parts[1]).strip()
                    if len(parts) >= 3 and not raw.get("country"):
                        raw["country"] = parts[2].strip()
                break

        # Convert numeric fields (unit-aware for length/beam/draft — see
        # _normalize_spec_values / _parse_measurement_to_feet)
        return self._normalize_spec_values(raw)

    # ---------------------------------------------------------
    # CLEAN HTML
    # ---------------------------------------------------------
    _RELATED_LISTINGS_PATTERN = re.compile(
        r"related|similar[-_]?(?:listing|boat|yacht)|you[-_]?may[-_]?also|also[-_]?view|"
        r"recommend|cross-?sell|more[-_]?listings|other[-_]?boats",
        re.I,
    )

    def clean_html(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "iframe", "head"]):
            tag.decompose()
        # Strip "related/similar listings" sidebars — these commonly show another
        # boat's price/specs sitting earlier in the DOM than this listing's own
        # price, which the regex-based price/spec extraction below would
        # otherwise grab first (see extract_price_with_currency).
        for tag in soup.find_all(class_=self._RELATED_LISTINGS_PATTERN) + soup.find_all(id=self._RELATED_LISTINGS_PATTERN):
            try:
                tag.decompose()
            except Exception:
                pass
        text = soup.get_text(separator="\n")
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        return "\n".join(chunk for chunk in chunks if chunk)

    # ---------------------------------------------------------
    # AGENT / SALESMAN DETECTION
    # ---------------------------------------------------------
    def detect_agent_name(self, html: str, text: str) -> Optional[str]:
        """Try to extract the listing agent/salesman name from the page."""
        soup = BeautifulSoup(html, "html.parser")

        # Regex patterns against visible text
        patterns = [
            r"(?:listed\s+by|contact\s+agent|your\s+broker|broker\s*[:\-]|agent\s*[:\-]|salesperson\s*[:\-]|presented\s+by|listed\s+with|contact\s*[:\-])\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                candidate = match.group(1).strip()
                blocked = {"the broker", "our team", "our staff", "a broker", "an agent"}
                if len(candidate) > 3 and candidate.lower() not in blocked:
                    return candidate

        # CSS class heuristics
        agent_classes = re.compile(
            r"\b(agent|broker|salesperson|contact.name|agent.name|listing.agent|sales.agent)\b",
            re.I
        )
        for tag in soup.find_all(["div", "span", "p", "h3", "h4", "strong"]):
            cls = " ".join(tag.get("class", []))
            if agent_classes.search(cls):
                name_text = tag.get_text(strip=True)
                words = name_text.split()
                if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
                    return name_text

        return None

    def detect_agent_photo(self, html: str, agent_name: Optional[str]) -> Optional[str]:
        """Try to find the listing agent's headshot URL on the page.

        Looks for <img> tags:
        1. Inside DOM elements whose class names suggest agent/broker/contact
        2. Near (sibling/parent) the element that contains the agent name text
        3. With alt text matching the agent name
        """
        if not html:
            return None
        soup = BeautifulSoup(html, "html.parser")
        agent_classes = re.compile(
            r"\b(agent|broker|salesperson|contact.name|agent.name|listing.agent|sales.agent|staff|team.member)\b",
            re.I,
        )
        img_ext_re = re.compile(r'\.(jpg|jpeg|png|webp|avif)(\?.*)?$', re.IGNORECASE)

        def _valid_img(src: str) -> Optional[str]:
            if not src or src.startswith('data:'):
                return None
            if not img_ext_re.search(src.split('?')[0]):
                return None
            _SOCIAL_MEDIA_RE = re.compile(
                r'facebook\.|instagram\.|twitter\.|linkedin\.|youtube\.|tiktok\.|'
                r'logo|icon|banner|favicon|placeholder|no.image|no_image',
                re.IGNORECASE,
            )
            if _SOCIAL_MEDIA_RE.search(src):
                return None
            return src

        # Strategy 1: img inside an agent-class container
        for tag in soup.find_all(True):
            cls = " ".join(tag.get("class", []))
            if agent_classes.search(cls):
                for img in tag.find_all("img"):
                    src = img.get("src") or img.get("data-src") or ""
                    result = _valid_img(src)
                    if result:
                        return result

        # Strategy 2: img with alt text matching agent name
        if agent_name:
            name_lower = agent_name.lower()
            for img in soup.find_all("img"):
                alt = (img.get("alt") or "").lower()
                if name_lower in alt or alt in name_lower:
                    src = img.get("src") or img.get("data-src") or ""
                    result = _valid_img(src)
                    if result:
                        return result

        return None

    # ---------------------------------------------------------
    # AI EXTRACTION
    # ---------------------------------------------------------
    def scrape_with_ai(self, content: str, url: str, partial_data: Dict = None) -> Dict:
        if not self.client:
            return partial_data or {}
        try:
            from app.services.prompt_store import get_prompt
            if partial_data and len(partial_data) > 5:
                instructions = get_prompt("partial")
                prompt = (
                    f"Fill in as many missing fields as possible for this yacht listing.\n"
                    f"Existing data: {json.dumps(partial_data)}\n\n"
                    f"URL: {url}\n"
                    f"Content: {content[:8000]}\n\n"
                    f"{instructions}"
                )
            else:
                instructions = get_prompt("full")
                prompt = f"{instructions}\n\nURL: {url}\nContent: {content[:12000]}"

            message = self.client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            response_text = message.content[0].text
            response_text = re.sub(r"```json\s*|\s*```", "", response_text).strip()
            # AI sometimes appends explanatory text after the JSON object.
            # Extract just the first valid JSON object to avoid "Extra data" errors.
            _json_match = re.search(r'\{[\s\S]*\}', response_text)
            if _json_match:
                response_text = _json_match.group(0)
            yacht_data = json.loads(response_text)
            if partial_data:
                # AI fills gaps only — deterministic extraction (JSON-LD, spec
                # tables, labeled regex) must not be overwritten by model output,
                # which works from truncated text and can hallucinate. Exceptions:
                # location fields (the regex source is the flakiest extractor we
                # have) and description (AI reliably finds prose the regex misses).
                _ai_may_override = {"city", "state", "country", "description"}
                deterministic = {
                    k: v for k, v in partial_data.items()
                    if v not in (None, "", []) and k not in _ai_may_override
                }
                yacht_data = {**partial_data, **yacht_data, **deterministic}
            # Normalize location from AI output
            nc, ns, nco = self.normalize_location(
                yacht_data.get("city"), yacht_data.get("state"), yacht_data.get("country")
            )
            if nc  is not None: yacht_data["city"]    = nc
            if ns  is not None: yacht_data["state"]   = ns
            elif "state"   in yacht_data: yacht_data.pop("state", None)
            if nco is not None: yacht_data["country"] = nco
            return yacht_data
        except Exception as e:
            # ── Anthropic billing / credit exhaustion ─────────────────────────
            # The SDK raises APIStatusError (HTTP 402/529) when credits run out or
            # the account is suspended.  Re-raise as our sentinel so run_scraper_job
            # can pause the job immediately instead of looping through 50 more URLs.
            _es = str(e).lower()
            if isinstance(e, anthropic.APIStatusError) and (
                e.status_code in (402, 529)
                or "credit" in _es
                or "billing" in _es
                or "payment" in _es
                or "insufficient" in _es
            ):
                raise _AnthropicCreditsExhausted(
                    f"Anthropic API credits exhausted (HTTP {getattr(e, 'status_code', '?')}): {e}"
                ) from e
            logger.warning(f"AI extraction failed for {url}: {e}")
            return partial_data or {}

    # ---------------------------------------------------------
    # IMAGE EXTRACTION
    # ---------------------------------------------------------
    def extract_images(self, html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, "html.parser")

        # Remove sections that are structurally "related / featured" listings shown
        # below the main listing — they contain gallery images from OTHER boats.
        # Use compound patterns to avoid nuking gallery containers that happen to
        # have short words like "featured" in their own class (e.g. X-Theme page builders).
        _related_re = re.compile(
            r'related[-_]listing|related[-_]yacht|related[-_]boat|similar[-_]listing|'
            r'similar[-_]yacht|similar[-_]boat|'
            r'featured[-_]listing|featured[-_]yacht|featured[-_]boat|'
            r'more[-_]listing|other[-_]listing|recommended[-_]listing|'
            r'footer|sidebar[-_]widget|newsletter|testimonial[-_]section|'
            # Broker/agent "contact card" widgets (headshot + name/title) — not
            # part of the vessel's own gallery, but nothing in the URL-based
            # skip_re below catches an arbitrarily-named uploaded headshot file.
            r'contact[-_]?details|contact[-_]?card|team[-_]?member|'
            r'staff[-_]?card|agent[-_]?card|broker[-_]?card|salesperson[-_]?card',
            re.IGNORECASE,
        )
        # Company/site logo images can't always be caught by filename or alt
        # text — a logo uploaded as e.g. "IMG_1637.png" with alt="yachts" (seen
        # on bviyachtsales.com) matches neither the skip_re path check below
        # nor the alt-text check in the <img> loop. The one reliable signal is
        # structural: it sits inside a container actually classed/id'd as the
        # logo (e.g. "header-logo"), regardless of the file's own name. \blogo\b
        # is word-bounded so it won't false-positive on something like
        # "catalogo" that merely contains the substring.
        #
        # A theme's logo is also commonly duplicated in the page — once in the
        # visible header, once inside a mobile off-canvas/slide-out menu (e.g.
        # X-Theme's "x-off-canvas-content" wrapper) — and since images are
        # deduped by URL, stripping only the header copy still lets the
        # off-canvas copy's URL through. Strip that navigational chrome too;
        # unlike a generic "image appears more than once" heuristic (which
        # would risk stripping a real photo legitimately reused between a
        # slider and its thumbnail strip), this stays scoped to structural
        # non-content containers the same way the logo/related-listings
        # patterns above already do.
        _logo_container_re = re.compile(r'\blogo\b|off.?canvas|mobile[-_]?(?:menu|nav)', re.IGNORECASE)
        for _tag in soup.find_all(True):
            _attrs = _tag.attrs or {}
            _cls = ' '.join(_attrs.get('class', []))
            _id  = _attrs.get('id', '')
            if _related_re.search(_cls) or _related_re.search(_id) or _logo_container_re.search(_cls) or _logo_container_re.search(_id):
                _tag.decompose()

        # Also strip sections that are introduced by a heading whose *text* labels
        # them as a "similar / featured / you may also like" boat list.
        # This catches sites whose CSS class names don't match the patterns above
        # (e.g. a plain class="featured" section on Terraglio-style sites).
        _hdg_text_re = re.compile(
            r'featured\s+(?:vessel|yacht|boat|listing|unit)|'
            r'similar\s+(?:vessel|yacht|boat|listing)|'
            r'you\s+may\s+(?:also\s+)?like|'
            r'other\s+(?:available|listing|yacht|boat)|'
            r'more\s+(?:listing|yacht|boat|vessel)|'
            r'explore\s+more|also\s+available',
            re.IGNORECASE,
        )
        for _hdg in soup.find_all(['h2', 'h3', 'h4', 'h5']):
            if _hdg_text_re.search(_hdg.get_text(strip=True)):
                # The heading is often wrapped in its own thin container, with the
                # actual gallery/card grid living a level or two further up the
                # tree (a sibling of that thin wrapper) rather than directly after
                # it in document order. Walk up until we reach a container that
                # actually holds images/links, then remove that whole container —
                # this naturally captures the heading and its gallery together
                # regardless of how deep the heading itself is nested.
                _ancestor = (
                    _hdg.find_parent(['section', 'div', 'article', 'aside'])
                    or _hdg.parent
                )
                _hops = 0
                while _ancestor and not _ancestor.find_all(['img', 'a']) and _hops < 4:
                    _wider = _ancestor.find_parent(['section', 'div', 'article', 'aside'])
                    if not _wider:
                        break
                    _ancestor = _wider
                    _hops += 1
                if _ancestor:
                    try:
                        _ancestor.decompose()
                    except Exception:
                        pass
                break  # only strip the first match — avoid over-stripping

        seen: set = set()
        images: List[str] = []
        skip_re = re.compile(
            r'logo|icon|avatar|banner|/ad|spacer|pixel|tracking|'
            r'x-out|xout|spinner|placeholder|no.image|no_image|'
            r'/ui/|/icons?/|/buttons?/|'
            # People / agent / headshot patterns
            r'headshot|portrait|/agents?/|/brokers?/|/staff/|/team-member|/salesperson|'
            # Logo color-variant files (e.g. Company-Name-White.png, Brand-Dark.svg)
            r'(?:White|Dark|Black|Light|Color|Grey|Gray)\.(?:png|svg)|'
            # Social media & review/social-proof platform names in URL path or filename
            r'facebook|instagram|twitter|linkedin|youtube|tiktok|snapchat|'
            r'pinterest|whatsapp|reddit|vimeo|tumblr|signal|telegram|'
            r'social|share-btn|share_btn|'
            # Review / social-proof platform icons (e.g. /feedbacks/yelp.png)
            r'yelp|tripadvisor|trustpilot|google.review|/feedbacks/',
            re.IGNORECASE,
        )
        img_ext_re = re.compile(r'\.(jpg|jpeg|png|webp|avif)(\?.*)?$', re.IGNORECASE)

        def _add(url_str: str):
            if not url_str or url_str.startswith('data:'):
                return
            absolute = urljoin(base_url, url_str) if not url_str.startswith('http') else url_str
            if not absolute.startswith('http'):
                return
            base_path = absolute.split('?')[0]
            # Extension may be in the query string (e.g. /kpreview?FILE=gallery/boat.jpg)
            if not img_ext_re.search(base_path) and not img_ext_re.search(absolute):
                return
            # For normal URLs deduplicate on path; for query-string image URLs use full URL
            norm = base_path if img_ext_re.search(base_path) else absolute
            if norm in seen or skip_re.search(base_path):
                return
            seen.add(norm)
            images.append(absolute)

        # Priority 1: <a href="...jpg"> gallery anchors (full-size links)
        for a in soup.find_all('a', href=True):
            _add(a['href'].strip())

        # Priority 2: elements with data-fancybox / data-lightbox / data-gallery attrs
        for elem in soup.find_all(attrs={}):
            for attr in ('data-fancybox', 'data-lightbox', 'data-photoswipe', 'data-gallery'):
                if elem.get(attr) is not None:
                    for src_attr in ('href', 'data-src', 'data-full', 'data-zoom', 'src'):
                        val = elem.get(src_attr, '')
                        if val:
                            _add(val.strip())
                            break

        # Compile once outside the loop
        _social_alt_re = re.compile(
            r'facebook|instagram|twitter|linkedin|youtube|tiktok|snapchat|'
            r'pinterest|whatsapp|reddit|vimeo|tumblr|yelp|tripadvisor|trustpilot',
            re.IGNORECASE,
        )

        # Priority 3: <img> tags (with lazy-load data attrs)
        for img in soup.find_all('img'):
            src = (
                img.get('data-original') or img.get('data-zoom-image') or
                img.get('data-full') or img.get('data-large') or
                img.get('data-lazy-src') or img.get('data-src') or img.get('src')
            )
            if not src and img.get('srcset'):
                candidates = [s.strip().split()[0] for s in img['srcset'].split(',') if s.strip()]
                src = candidates[-1] if candidates else None
            alt_text = (img.get('alt') or '').lower()
            # Skip small square-cropped images — these are profile/headshot photos,
            # not boat gallery images (e.g. width="240" height="240")
            _w_attr, _h_attr = img.get('width', ''), img.get('height', '')
            try:
                _is_small_square = (_w_attr and _h_attr
                                    and int(float(_w_attr)) == int(float(_h_attr))
                                    and int(float(_w_attr)) <= 600)
            except (ValueError, TypeError):
                _is_small_square = False
            if src and not _is_small_square and 'logo' not in alt_text and 'icon' not in alt_text and not _social_alt_re.search(alt_text) and not src.startswith('data:'):
                _add(src.strip())

        # Priority 4: inline style attributes — CSS url() values, e.g. background-image
        # and CSS custom properties like --tco-dcab-0: url(...) used by page builders.
        _css_url_re = re.compile(r'url\(["\']?(https?://[^"\')\s]+\.(?:jpg|jpeg|png|webp))["\']?\)', re.IGNORECASE)
        for tag in soup.find_all(style=True):
            for m in _css_url_re.finditer(tag['style']):
                _add(m.group(1))

        # Priority 4b: embedded <style> blocks — catches page builders that emit
        # background-image rules in a <style> tag instead of inline style attrs.
        for _style_tag in soup.find_all('style'):
            _style_text = _style_tag.get_text() or ''
            for m in _css_url_re.finditer(_style_text):
                _add(m.group(1))

        # Priority 5: embedded JS blobs — scan script tags for image URL arrays
        _js_img_re = re.compile(r'["\']((https?://[^"\'\s]+\.(?:jpg|jpeg|png|webp))["\'])', re.IGNORECASE)
        for script in soup.find_all('script'):
            if script.get('type', '').lower() == 'application/ld+json':
                continue
            blob = script.get_text() or ''
            if 'photo' not in blob.lower() and 'image' not in blob.lower() and 'gallery' not in blob.lower():
                continue
            for m in _js_img_re.finditer(blob):
                _add(m.group(1))

        return images[:_MAX_IMAGES_PER_LISTING]

    # ---------------------------------------------------------
    # STAGED PIPELINE HELPERS (used by run_scraper_job)
    # ---------------------------------------------------------

    def _fetch_listing_html(self, url: str, template=None):
        """
        Stage 1 (Intake): fetch raw HTML for a listing URL.
        Returns (html, wp_extra_text, wp_images) -- all pure network I/O, no DB.
        Duplicates the fetch logic from _scrape_single_listing_inner so the staged
        pipeline and single-test path stay in sync.
        """
        if url in self._json_api_cache:
            cached = self._json_api_cache[url]
            pseudo_html = "<html><body>" + json.dumps(cached) + "</body></html>"
            return pseudo_html, "", []

        _wp_extra_text = ""
        _wp_images = []
        _parsed_url = urlparse(url)
        _base = f"{_parsed_url.scheme}://{_parsed_url.netloc}"
        _api_hdrs = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

        _wp_cached = self._wp_rest_id_map.get(url.rstrip("/"))
        if not _wp_cached and _parsed_url.query:
            _qs = dict(pair.split("=", 1) for pair in _parsed_url.query.split("&") if "=" in pair)
            if any(k in _qs for k in ("id", "boat_id", "listing_id", "yacht_id", "vessel_id")):
                for _pt in ("listings", "boats", "yachts", "vessels", "motorboats", "sailboats"):
                    try:
                        _sr = requests.get(
                            f"{_base}/wp-json/wp/v2/{_pt}",
                            params={"per_page": 100, "page": 1, "_fields": "id,link"},
                            headers=_api_hdrs, timeout=10,
                        )
                        if not _sr.ok:
                            continue
                        _items = _sr.json()
                        if not isinstance(_items, list):
                            continue
                        for _item in _items:
                            if isinstance(_item, dict) and _item.get("id") and _item.get("link"):
                                _norm = _item["link"].rstrip("/")
                                self._wp_rest_id_map[_norm] = (_pt, str(_item["id"]))
                        _wp_cached = self._wp_rest_id_map.get(url.rstrip("/"))
                        if _wp_cached:
                            break
                    except Exception:
                        continue

        if _wp_cached:
            _pt, _wp_id = _wp_cached
            try:
                _r = requests.get(
                    f"{_base}/wp-json/wp/v2/{_pt}/{_wp_id}",
                    params={"_embed": "1"},
                    headers=_api_hdrs, timeout=10,
                )
                if _r.ok and "json" in _r.headers.get("content-type", ""):
                    _wp = _r.json()
                    _rendered = (_wp.get("content") or {}).get("rendered") or ""
                    if _rendered:
                        _wp_extra_text = BeautifulSoup(_rendered, "html.parser").get_text(" ", strip=True)[:4000]
                    for _k in ("title", "acf", "meta", "custom_fields"):
                        _v = _wp.get(_k)
                        if isinstance(_v, dict):
                            _wp_extra_text += " " + json.dumps(_v)[:2000]
                        elif isinstance(_v, str):
                            _wp_extra_text += " " + _v[:500]
                    _embedded = _wp.get("_embedded") or {}
                    for _ml in (_embedded.get("wp:featuredmedia") or [], _embedded.get("wp:attachment") or []):
                        for _media in (_ml if isinstance(_ml, list) else [_ml]):
                            for _sk in ("full", "large", "medium_large", "source_url"):
                                _sz = (_media.get("media_details") or {}).get("sizes") or {}
                                _iu = (_sz.get(_sk) or {}).get("source_url") or _media.get("source_url")
                                if _iu:
                                    _wp_images.append(_iu)
                                    break
            except Exception:
                pass

        html = self.fetch_page(url)
        if _PLAYWRIGHT_AVAILABLE and (not html or len(html) < 5000):
            headless_html = self.fetch_page_headless(url)
            if headless_html and len(headless_html) > len(html or ""):
                html = headless_html

        # Both the static and headless attempts (each already with their own
        # proxy/render fallback) can still come up empty on a site whose
        # blocking is intermittent rather than absolute — observed on
        # bviyachtsales.com: a real page with full content, but our fetch got
        # nothing, purely by bad luck on that attempt. Without a retry, that
        # listing is stuck permanently blank (skip_reason="low_confidence")
        # until the next scheduled run, up to days later. One retry after a
        # short backoff is cheap insurance against a transient miss.
        if not html:
            time.sleep(random.uniform(2.0, 4.0))
            html = self.fetch_page(url)
            if _PLAYWRIGHT_AVAILABLE and (not html or len(html) < 5000):
                headless_html = self.fetch_page_headless(url)
                if headless_html and len(headless_html) > len(html or ""):
                    html = headless_html
            if html:
                logger.info(f"_fetch_listing_html: retry succeeded for {url} after initial fetch came back empty")

        return (html or ""), _wp_extra_text, _wp_images

    def _needs_ai_check(self, partial: dict) -> bool:
        """Return True if structured extraction left critical fields incomplete."""
        return (
            not partial.get("title")
            or not partial.get("make")
            or not partial.get("model")
            or not partial.get("description")
            or not partial.get("city")
            or not partial.get("country")
            or not partial.get("length_feet")
            or not partial.get("year")
        )

    def _parse_spec_tables_with_synonyms(self, html: str, synonym_cache: dict) -> dict:
        """
        Like parse_spec_tables() but overlays the DB synonym cache so admin-added
        term aliases are picked up without a code deploy.
        Synonym cache keys are lowercase-stripped label text; values are canonical
        field names (e.g. "loa" -> "length_feet").
        """
        base = self.parse_spec_tables(html)
        if not synonym_cache:
            return base

        soup = BeautifulSoup(html, "html.parser")
        extra = {}

        def _try(label, value):
            key = synonym_cache.get(label.strip().lower())
            if key and value.strip():
                extra[key] = value.strip()

        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all(["th", "td"])
                if len(cells) == 2:
                    _try(cells[0].get_text(strip=True), cells[1].get_text(strip=True))

        for dl in soup.find_all("dl"):
            for dt, dd in zip(dl.find_all("dt"), dl.find_all("dd")):
                _try(dt.get_text(strip=True), dd.get_text(strip=True))

        for li in soup.find_all("li"):
            li_text = li.get_text(strip=True)
            if ":" in li_text:
                parts = li_text.split(":", 1)
                if len(parts[0]) < 40:
                    _try(parts[0], parts[1])

        # synonym overlay wins over base hardcoded map for any shared key.
        # Type/convert `extra` the same way as the base LABEL_MAP path (unit-
        # aware for length/beam/draft) — previously this passed raw strings
        # straight through untyped, which silently failed downstream float()
        # casts (losing the data) and had no meters-to-feet conversion at all.
        extra_typed = self._normalize_spec_values(extra)
        return {**base, **extra_typed}

    # ---------------------------------------------------------
    # SCRAPE A SINGLE LISTING URL - raw data dict
    # ---------------------------------------------------------
    def scrape_single_listing(self, url: str, template: Optional[Dict] = None) -> Dict:
        try:
            return self._scrape_single_listing_inner(url, template=template)
        except Exception as _outer_exc:
            logger.error(
                f"scrape_single_listing: unhandled exception for {url}: {_outer_exc}\n"
                + traceback.format_exc()
            )
            return {"error": str(_outer_exc)}

    def _scrape_single_listing_inner(self, url: str, template: Optional[Dict] = None) -> Dict:
        # ── JSON proxy API cache — pre-built data, no fetch needed ──────────────
        # Populated by _discover_from_json_proxy() for sites whose entire inventory
        # is served by a custom JSON API (e.g. yachtzero.com / Squarespace + CF Worker).
        if url in self._json_api_cache:
            logger.info(f"scrape_single_listing: returning pre-cached JSON API data for {url}")
            return self._json_api_cache[url]

        # ── WP REST API FIRST — must run before fetch_page ────────────────────────
        # JSON endpoints bypass Cloudflare HTML challenges. This must happen
        # BEFORE fetch_page so data is available if HTML is blocked by CF.
        _wp_extra_text = ""
        _wp_images: List[str] = []
        _parsed_url = urlparse(url)
        _base = f"{_parsed_url.scheme}://{_parsed_url.netloc}"
        _api_hdrs = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

        # Look up the real WP post ID from the discovery cache (populated by
        # _discover_from_wp_rest during broker inventory scan). On CF-protected
        # WP sites the ?id= URL param is a CUSTOM field value, NOT the WP post ID.
        _wp_cached = self._wp_rest_id_map.get(url.rstrip('/'))

        # If not in cache (e.g. direct Single Listing test with no prior discovery),
        # try to find the WP post ID by scanning the REST listing pages.
        if not _wp_cached and _parsed_url.query:
            _qs = dict(pair.split('=', 1) for pair in _parsed_url.query.split('&') if '=' in pair)
            if any(k in _qs for k in ('id', 'boat_id', 'listing_id', 'yacht_id', 'vessel_id')):
                for _pt in ('listings', 'boats', 'yachts', 'vessels', 'motorboats', 'sailboats'):
                    try:
                        _sr = requests.get(
                            f"{_base}/wp-json/wp/v2/{_pt}",
                            params={"per_page": 100, "page": 1, "_fields": "id,link"},
                            headers=_api_hdrs, timeout=10,
                        )
                        if not _sr.ok:
                            continue
                        _items = _sr.json()
                        if not isinstance(_items, list):
                            continue
                        for _item in _items:
                            if isinstance(_item, dict) and _item.get('id') and _item.get('link'):
                                _norm = _item['link'].rstrip('/')
                                self._wp_rest_id_map[_norm] = (_pt, str(_item['id']))
                        _wp_cached = self._wp_rest_id_map.get(url.rstrip('/'))
                        if _wp_cached:
                            break
                    except Exception:
                        continue

        # Fetch full listing data from WP REST using the exact WP post ID.
        if _wp_cached:
            _pt, _wp_id = _wp_cached
            try:
                _r = requests.get(
                    f"{_base}/wp-json/wp/v2/{_pt}/{_wp_id}",
                    params={"_embed": "1"},
                    headers=_api_hdrs, timeout=10,
                )
                if _r.ok and 'json' in _r.headers.get('content-type', ''):
                    _wp = _r.json()
                    _rendered = (_wp.get('content') or {}).get('rendered') or ''
                    if _rendered:
                        _wp_extra_text = BeautifulSoup(_rendered, 'html.parser').get_text(' ', strip=True)[:4000]
                    for _k in ('title', 'acf', 'meta', 'custom_fields'):
                        _v = _wp.get(_k)
                        if isinstance(_v, dict):
                            _wp_extra_text += ' ' + json.dumps(_v)[:2000]
                        elif isinstance(_v, str):
                            _wp_extra_text += ' ' + _v[:500]
                    _embedded = _wp.get('_embedded') or {}
                    for _ml in (_embedded.get('wp:featuredmedia') or [], _embedded.get('wp:attachment') or []):
                        for _media in (_ml if isinstance(_ml, list) else [_ml]):
                            for _sk in ('full', 'large', 'medium_large', 'source_url'):
                                _sz = (_media.get('media_details') or {}).get('sizes') or {}
                                _iu = (_sz.get(_sk) or {}).get('source_url') or _media.get('source_url')
                                if _iu:
                                    _wp_images.append(_iu)
                                    break
            except Exception:
                pass

        # ── Fetch HTML (may fail on CF-protected pages; WP REST data is sufficient fallback)
        html = self.fetch_page(url)
        # If page is sparse (JS-rendered shell or CF challenge, typically < 5 KB),
        # retry with headless browser to get fully-rendered content.
        if _PLAYWRIGHT_AVAILABLE and (not html or len(html) < 5000):
            logger.info(f"scrape_single_listing: sparse/missing HTML for {url}, retrying headless")
            headless_html = self.fetch_page_headless(url)
            if headless_html and len(headless_html) > len(html or ""):
                html = headless_html
        if not html and not _wp_extra_text:
            return {"error": "Failed to load page"}
        html = html or ""  # allow processing when only WP REST data is available

        structured = self.try_structured_extraction(html, url)
        # Parse spec tables + Elementor divs + map location from raw HTML
        html_specs = self.parse_spec_tables(html)
        text = self.clean_html(html)
        if _wp_extra_text:
            text = _wp_extra_text + "\n\n" + text
        regex_specs = self.extract_specs_from_text(text)
        price_result = self.extract_price_with_currency(text)
        if price_result:
            regex_specs["price"] = price_result[0]
            regex_specs["currency"] = price_result[1]

        # Merge: regex first, html_specs override, structured last (most authoritative)
        partial = {**regex_specs, **html_specs, **(structured or {})}

        # Promote h1 title and map-derived location INTO standard field names
        if not partial.get("title") and partial.get("_h1_title"):
            partial["title"] = partial.pop("_h1_title")
        else:
            partial.pop("_h1_title", None)

        # Extract description deterministically from clean text (works without AI)
        if not partial.get("description"):
            det_desc = self.extract_description_from_text(text)
            if det_desc:
                partial["description"] = det_desc

        # Try to derive make/model from title "YEAR MAKE MODEL" pattern
        if partial.get("title") and not partial.get("make"):
            title_parts = partial["title"].split()
            if len(title_parts) >= 3 and re.match(r"(19|20)\d{2}", title_parts[0]):
                partial["make"] = title_parts[1]
                partial["model"] = " ".join(title_parts[2:])
            elif len(title_parts) >= 2 and re.match(r"(19|20)\d{2}", title_parts[0]):
                partial["make"] = title_parts[1]

        # Normalize location fields so AI context includes clean values
        norm_city, norm_state, norm_country = self.normalize_location(
            partial.get("city"), partial.get("state"), partial.get("country")
        )
        if norm_city   is not None: partial["city"]    = norm_city
        if norm_state  is not None: partial["state"]   = norm_state
        elif "state"   in partial:  partial.pop("state", None)
        if norm_country is not None: partial["country"] = norm_country

        # Call AI when any critical field is missing — including location, length, and year,
        # which are commonly embedded in prose descriptions rather than structured fields.
        _missing_structured = (
            not partial.get("city")
            or not partial.get("country")
            or not partial.get("length_feet")
            or not partial.get("year")
        )
        needs_ai = (
            not partial.get("title")
            or not partial.get("make")
            or not partial.get("model")
            or not partial.get("description")
            or _missing_structured
        )
        if needs_ai:
            yacht_data = self.scrape_with_ai(text, url, partial)
        else:
            yacht_data = partial

        # Title fallback: use the HTML <title> tag if AI didn't return one
        if not yacht_data.get("title"):
            soup_title = BeautifulSoup(html, "html.parser").find("title")
            if soup_title:
                raw_title = soup_title.get_text(strip=True)
                _title_boat_re = re.compile(
                    r"(\d{1,4}['’\"']?\s*(19|20)\d{2}|(19|20)\d{2}\s*[-\u2013]?\s*\w|\b\d{2,3}\s*ft\b)",
                    re.IGNORECASE,
                )
                for sep in [" - ", " | ", " — ", " :: "]:
                    if sep in raw_title:
                        parts = [p.strip() for p in raw_title.split(sep)]
                        boat_part = next((p for p in parts if _title_boat_re.search(p)), None)
                        raw_title = boat_part if boat_part else parts[0]
                        break
                if len(raw_title) > 3:
                    yacht_data["title"] = raw_title

        # Sanitize final title — strip site-name prefixes (e.g. "Rick Obey Yacht Sales - 58' 2005 ...").
        # If the title contains a separator and one segment looks like a boat listing, use that segment.
        if yacht_data.get("title"):
            _title_boat_re = re.compile(
                r"(\d{1,4}['’\"']?\s*(19|20)\d{2}|(19|20)\d{2}\s*[-\u2013]?\s*\w|\b\d{2,3}\s*ft\b)",
                re.IGNORECASE,
            )
            _t = yacht_data["title"]
            for _sep in [" - ", " | ", " — ", " :: "]:
                if _sep in _t:
                    _parts = [p.strip() for p in _t.split(_sep)]
                    _boat = next((p for p in _parts if _title_boat_re.search(p)), None)
                    if _boat and _boat != _t:
                        yacht_data["title"] = _boat
                    break

        # Reconstruct title as 'YEAR MAKE MODEL' whenever we have make/model data.
        # Length is displayed separately on listing cards, so it is excluded from title.
        _t_year  = yacht_data.get('year')
        _t_make  = yacht_data.get('make')
        _t_model = yacht_data.get('model')
        if _t_make or _t_model:
            _rebuilt = ' '.join(filter(None, [
                str(_t_year) if _t_year else '',
                _t_make or '',
                _t_model or '',
            ])).strip()
            if _rebuilt:
                yacht_data['title'] = _rebuilt

        # Description fallback: if AI still didn't return one, use deterministic extract
        if not yacht_data.get("description") and partial.get("description"):
            yacht_data["description"] = partial["description"]

        # ── Field sanity bounds ──────────────────────────────────────────────
        # Regex extraction can grab a bare year from prose ("founded in 1985")
        # or a length that's actually a beam/road-frontage figure. Reject values
        # that are physically implausible for a yacht listing rather than
        # storing them.
        _this_year = datetime.now().year
        _y = yacht_data.get("year")
        if _y is not None:
            try:
                if not (1900 <= int(_y) <= _this_year + 2):
                    yacht_data.pop("year", None)
            except (TypeError, ValueError):
                yacht_data.pop("year", None)
        _lf = yacht_data.get("length_feet")
        if _lf is not None:
            try:
                if not (8 <= float(_lf) <= 600):
                    yacht_data.pop("length_feet", None)
            except (TypeError, ValueError):
                yacht_data.pop("length_feet", None)

        # Extend the same physically-implausible-value rejection to every other
        # numeric field the AI fallback (or a regex misfire) can populate. Before
        # this, only year/length_feet were bounds-checked, so a hallucinated
        # `cabins: 40` or an implausible price could reach the confidence score
        # (which is purely presence-based) with no backstop at all, then sail
        # straight past the auto-create threshold looking "complete".
        _NUMERIC_BOUNDS = {
            "price": (1000, 100_000_000),
            "cabins": (0, 20),
            "berths": (0, 40),
            "heads": (0, 20),
            "beam_feet": (3, 100),
            "draft_feet": (0.5, 40),
            "max_speed_knots": (0, 100),
            "cruising_speed_knots": (0, 100),
            "engine_hours": (0, 50_000),
        }
        for _field, (_lo, _hi) in _NUMERIC_BOUNDS.items():
            _v = yacht_data.get(_field)
            if _v is None:
                continue
            try:
                if not (_lo <= float(_v) <= _hi):
                    yacht_data.pop(_field, None)
            except (TypeError, ValueError):
                yacht_data.pop(_field, None)

        # Cross-field plausibility: a price that individually passes the bounds
        # above can still be wildly wrong for this boat's size (e.g. a stray
        # "$549" instead of "$549,000" reads as a legitimate >= $1000 price on
        # its own). Reject prices outside a sane $/ft range rather than trusting
        # any in-range number just because a length is also present.
        _price = yacht_data.get("price")
        _length_for_price_check = yacht_data.get("length_feet")
        if _price is not None and _length_for_price_check:
            try:
                _price_per_ft = float(_price) / float(_length_for_price_check)
                if not (300 <= _price_per_ft <= 500_000):
                    yacht_data.pop("price", None)
            except (TypeError, ValueError, ZeroDivisionError):
                pass

        images = self.extract_images(html, url)

        # ── Headless image rescue ─────────────────────────────────────────────
        # If static fetch produced no images but the page has real content, the
        # gallery is almost certainly JS-rendered (e.g. CSS background-images set
        # by a slider script).  Re-fetch with a headless browser so those
        # style attributes are populated, then re-extract.  Also updates `html`
        # for downstream agent / sold detection which benefits from the richer DOM.
        if not images and html and len(html) > 3000 and _PLAYWRIGHT_AVAILABLE:
            logger.info(
                f"scrape_single_listing: no images in static HTML for {url} "
                f"({len(html):,} chars) — retrying with headless browser"
            )
            _hl_html = self.fetch_page_headless(url)
            if _hl_html and len(_hl_html) > len(html):
                logger.info(
                    f"scrape_single_listing: headless returned {len(_hl_html):,} chars "
                    f"(static was {len(html):,}), re-extracting images"
                )
                html = _hl_html  # update for downstream agent / sold detection
                images = self.extract_images(_hl_html, url)
                logger.info(
                    f"scrape_single_listing: headless rescued {len(images)} images for {url}"
                )

        # Prepend WP REST images — more reliable on JS-rendered / CF-blocked pages
        if _wp_images:
            _seen_norms = {u.split('?')[0] for u in images}
            for _wu in _wp_images:
                if _wu.split('?')[0] not in _seen_norms:
                    images.insert(0, _wu)
                    _seen_norms.add(_wu.split('?')[0])
        images = images[:_MAX_IMAGES_PER_LISTING]
        yacht_data.update({
            "source_url": url,
            "source": "scraped",
            "images": images,
            "scraped_at": datetime.utcnow().isoformat(),
        })

        # Surface agent/salesman name for manual assignment
        detected_agent = self.detect_agent_name(html, text)
        if not detected_agent and yacht_data.get("agent_name"):
            detected_agent = yacht_data.pop("agent_name")
        elif "agent_name" in yacht_data:
            yacht_data.pop("agent_name")
        if detected_agent:
            yacht_data["detected_agent_name"] = detected_agent
            # Also try to grab the agent's headshot while we have the HTML
            agent_photo = self.detect_agent_photo(html, detected_agent)
            if agent_photo:
                yacht_data["detected_agent_photo"] = agent_photo
                # Remove agent headshot from listing images — it was caught by extract_images
                # as well and must not show as a boat photo.
                _ap_norms = {agent_photo, agent_photo.split('?')[0]}
                yacht_data["images"] = [
                    i for i in yacht_data.get("images", [])
                    if i not in _ap_norms and i.split('?')[0] not in _ap_norms
                ]

        # ── TEMPLATE OVERRIDES (highest priority) ──────────────────────────
        # Apply any admin-configured CSS selectors — these win over all heuristics.
        if template:
            _tmpl_soup = BeautifulSoup(html, 'html.parser')
            self._apply_template_selectors(yacht_data, _tmpl_soup, template)
            self._apply_template_field_rules(yacht_data, text, template)

        # ── Sold / unavailable detection ──────────────────────────────────────
        # Flag listings whose page indicates they are sold so run_scraper_job can
        # store them with status="sold" rather than status="awaiting_review".
        if html and not yacht_data.get("is_sold"):
            _check_soup = BeautifulSoup(html, "html.parser")

            # 0. Template-configured sold banner selector (highest priority, site-specific)
            if template and template.get("sold_banner_selector"):
                _sold_banner_sel = template["sold_banner_selector"].strip()
                try:
                    if _check_soup.select_one(_sold_banner_sel):
                        yacht_data["is_sold"] = True
                        logger.info(f"scrape_single_listing: sold_banner_selector '{_sold_banner_sel}' matched at {url}")
                except Exception:
                    pass

            # 1. Any element whose class list contains a sold-status token.
            # Guard: skip elements inside <a> tags — those are sold overlays on listing
            # thumbnails in related/similar sections, NOT the primary status indicator.
            _sold_class_re = re.compile(
                r'^(?:sold|is-sold|sold-badge|sold-overlay|sold-ribbon|listing-sold|'
                r'badge-sold|status-sold|vessel-sold|yacht-sold|label-sold|tag-sold|'
                r'unavailable-banner)$',
                re.IGNORECASE,
            )
            if not yacht_data.get("is_sold"):
                for _el in _check_soup.find_all(class_=_sold_class_re):
                    if not _el.find_parent('a'):
                        yacht_data["is_sold"] = True
                        logger.info(f"scrape_single_listing: sold class '{_el.get('class')}' detected at {url}")
                        break

            # 2. A standalone element that reads exactly "SOLD" (or equivalent).
            # Guard: skip elements inside <a> tags (thumbnail sold overlays in sidebars).
            if not yacht_data.get("is_sold"):
                for _el in _check_soup.find_all(['span', 'div', 'p', 'strong', 'h1', 'h2', 'h3', 'li']):
                    if _el.find_parent('a'):
                        continue  # sold overlay on a clickable listing thumbnail — ignore
                    _t = _el.get_text(strip=True).upper()
                    if _t in ('SOLD', 'SOLD!', 'VENDU', 'VENDIDO', 'SOLD OUT'):
                        yacht_data["is_sold"] = True
                        logger.info(f"scrape_single_listing: sold element text '{_t}' at {url}")
                        break
            # 3. Specific sold phrases anywhere in the first 3 000 chars of visible text
            if not yacht_data.get("is_sold"):
                _vis = _check_soup.get_text(" ", strip=True)[:3000].lower()
                _sold_phrases = (
                    "this vessel has been sold",
                    "this boat has been sold",
                    "this yacht has been sold",
                    "no longer for sale",
                    "listing is no longer available",
                    "this listing has been sold",
                    "has been sold",
                    "vessel is sold",
                    "yacht is sold",
                    "boat is sold",
                )
                if any(_ph in _vis for _ph in _sold_phrases):
                    yacht_data["is_sold"] = True
                    logger.info(f"scrape_single_listing: sold phrase detected at {url}")

        return yacht_data


# ---------------------------------------------------------
# FULL JOB SYNC â€” run a configured ScraperJob end-to-end
# ---------------------------------------------------------
def _generate_bin(db) -> str:
    """Generate a unique BIN (Boat Identification Number) for the listing."""
    import random
    import string
    while True:
        bin_val = "YV-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        exists = db.query(Listing).filter(Listing.bin == bin_val).first()
        if not exists:
            return bin_val


def _is_already_hosted(img_url: str) -> bool:
    """True if img_url already points at our own storage (local /uploads/
    path, or the configured S3/R2 public base URL) — re-downloading and
    re-uploading it again on every subsequent sync would be pure waste."""
    if not img_url:
        return True
    if img_url.startswith("/uploads/"):
        return True
    from app.services.media_storage import S3_PUBLIC_BASE_URL
    if S3_PUBLIC_BASE_URL and img_url.startswith(S3_PUBLIC_BASE_URL):
        return True
    return False


def _rehost_image(img_url: str) -> str:
    """Download a scraped image and re-upload it to our own storage.

    Returns the new hosted URL on success, or the original URL on any failure
    so the listing always gets a valid image URL.

    This must run on EVERY scraped image, not just ones from known
    syndication CDNs (YachtWorld/BoatsGroup) — the original implementation
    only rehosted images matching that narrow whitelist, so images hosted
    directly on an individual broker's own site (the common case for the
    general HTML scraper) were stored as raw hotlinked URLs. The moment that
    broker's own website went down, got redesigned, or the listing was
    removed, those URLs 404'd and the images vanished from our own listing
    pages too, even though the listing data itself was still fine.

    Tries plain `requests` first, then falls back to the curl-cffi Chrome TLS
    impersonation session (when installed) — the same one used for the HTML
    fetch itself. Image CDNs on Cloudflare-protected sites can TCP-RST a plain
    `requests` call exactly like the HTML page would, even when the HTML fetch
    succeeded (different origin/CDN), so this was previously the weakest link
    in an otherwise-successful scrape: the listing would come through with
    good data but broken/missing images.
    """
    if _is_already_hosted(img_url):
        return img_url

    _headers = {"User-Agent": "Mozilla/5.0"}
    resp = None
    try:
        resp = requests.get(img_url, timeout=20, headers=_headers)
        if resp.status_code == 200 and resp.content:
            pass
        else:
            resp = None
    except Exception as exc:
        logger.info(f"_rehost_image: plain requests failed for {img_url}: {exc} — trying curl-cffi")
        resp = None

    if resp is None and _CURL_CFFI_AVAILABLE:
        try:
            with _CurlSession(impersonate="chrome124") as curl_sess:
                curl_resp = curl_sess.get(img_url, timeout=20, headers=_headers)
            if curl_resp.status_code == 200 and curl_resp.content:
                resp = curl_resp
        except Exception as exc:
            logger.warning(f"_rehost_image: curl-cffi fallback also failed for {img_url}: {exc}")

    if resp is None:
        return img_url

    try:
        content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
        # Derive a safe filename from the URL
        from uuid import uuid4
        ext = img_url.rsplit(".", 1)[-1].split("?")[0].lower()[:5]
        if ext not in ("jpg", "jpeg", "png", "webp"):
            ext = "jpg"
        filename = f"scraped/{uuid4().hex}.{ext}"
        new_url = store_media_bytes(filename, resp.content, content_type)
        logger.info(f"_rehost_image: re-hosted {img_url} → {new_url}")
        return new_url
    except Exception as exc:
        logger.warning(f"_rehost_image: failed to re-host {img_url}: {exc}")
        return img_url


# ─── Main scraper job dispatcher ─────────────────────────────────────────────

def run_scraper_job(job_id: int, db) -> Dict:
    """
    Full sync for a ScraperJob:
      1. Discover all listing URLs on broker_url
      2. For each URL: create new Listing or update existing
      3. Archive Listings whose URL was not seen this run
      4. Update job stats and schedule next run
    Returns a summary dict.
    """
    import os

    # Atomically claim the job: an UPDATE...WHERE status != 'running' only affects a
    # row if it isn't already running, and Postgres row-level locking serializes
    # concurrent UPDATEs on the same row — so if the scheduler's 30-min tick and an
    # admin's manual "Run Now" race each other (or the endpoint is double-clicked),
    # only one caller's update actually flips the status; the loser sees rowcount==0
    # and returns without scraping, instead of both starting a duplicate run.
    claimed = (
        db.query(ScraperJob)
        .filter(ScraperJob.id == job_id, ScraperJob.status != "running")
        .update(
            {"status": "running", "started_at": datetime.utcnow(), "last_error": None},
            synchronize_session=False,
        )
    )
    db.commit()
    if not claimed:
        existing = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
        if not existing:
            return {"error": f"Job {job_id} not found"}
        logger.warning(f"[Job {job_id}] Skipping run — already running (claimed by a concurrent trigger)")
        return {"success": False, "error": "Job is already running", "job_id": job_id}

    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        return {"error": f"Job {job_id} not found"}

    # ── Master Ocean REST API path ────────────────────────────────────────────
    _template = job.site_template or {}
    if _template.get("api_type") == "master_ocean":
        from app.services.master_ocean import run_master_ocean_sync
        try:
            mo_stats = run_master_ocean_sync(job_id, job, _template, db)
            job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
            if not job:
                return mo_stats
            if "error" in mo_stats:
                job.status = "failed"
                job.last_error = mo_stats["error"]
            else:
                job.status = "completed"
                job.listings_found = mo_stats.get("found", 0)
                job.listings_created = mo_stats.get("created", 0)
                job.listings_updated = mo_stats.get("updated", 0)
                job.listings_removed = mo_stats.get("archived", 0)
                job.last_run_log = mo_stats.get("log", [])
                job.total_runs = (job.total_runs or 0) + 1
                job.last_run_at = datetime.utcnow()
                # NOTE: `timedelta` is already imported at module level — a local
                # `from datetime import timedelta` used to live here, which made
                # Python treat `timedelta` as a local name for this ENTIRE
                # function (a name assigned/imported anywhere in a function body
                # is local throughout it), causing UnboundLocalError at Step 4's
                # `job.next_run_at = ... + timedelta(...)` below on every normal
                # (non-Master-Ocean) job run, since that local import never
                # executed for them. Caught by test_scraper_reliability_fixes.py.
                job.next_run_at = datetime.utcnow() + timedelta(hours=int(job.schedule_hours or 24))
            job.completed_at = datetime.utcnow()
            db.commit()
        except Exception as exc:
            logger.exception(f"[Job {job_id}] Master Ocean sync failed: {exc}")
            job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.last_error = str(exc)
                job.completed_at = datetime.utcnow()
                db.commit()
        _mo_result = locals().get('mo_stats') or {"error": locals().get('exc', 'unknown error')}
        return _mo_result
    # ─────────────────────────────────────────────────────────────────────────

    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
    scraper = OptimizedYachtScraper(api_key=api_key)

    stats = {"found": 0, "created": 0, "updated": 0, "archived": 0, "errors": 0}
    run_log: list = []  # per-URL outcomes — stored in job.last_run_log at end of run

    try:
        # -- Step 1: discover listing URLs --
        _template = job.site_template or None
        # Resuming a previously-paused run: pick up the URLs it hadn't gotten
        # to yet instead of rediscovering (which, on a slow/blocked site, can
        # itself take minutes) and reprocessing everything from scratch.
        # Archival is skipped for a resumed run below — pending_urls is only
        # the tail of the original discovery, not the full set, so "not in
        # this run" can't be trusted to mean "no longer listed".
        _is_resumed_run = bool(job.pending_urls)
        if _is_resumed_run:
            discovered_urls = list(job.pending_urls)
            job.pending_urls = None
            logger.info(f"[Job {job_id}] Resuming paused run with {len(discovered_urls)} URL(s) left")
        else:
            if _template:
                logger.info(f"[Job {job_id}] Using site template with selectors: {list(_template.keys())}")
            logger.info(f"[Job {job_id}] Discovering listings at {job.broker_url}")
            discovered_urls = scraper.find_listing_urls(job.broker_url, template=_template)
        stats["found"] = len(discovered_urls)
        # Flush found count immediately so the frontend sees it while listing scraping runs
        job.listings_found = stats["found"]
        db.commit()
        logger.info(f"[Job {job_id}] Found {len(discovered_urls)} listing URLs")

        discovered_url_set = set(discovered_urls)

                # Load the field synonym cache once so all URLs use the same lookup table.
        synonym_cache = _load_synonym_cache(db)

        # -- Step 2: staged pipeline -- fetch > normalize > AI > validate > upsert --
        _BLOCK_SHORT_CIRCUIT_THRESHOLD = 5
        _MIN_FETCH_DELAY_SECONDS = 0.6
        _MAX_FETCH_DELAY_SECONDS = 1.4
        _paused_mid_run = False
        for _url_index, url in enumerate(discovered_urls):
            if job is not None and job.pause_requested:
                # Cooperative pause — checked between URLs rather than able to
                # interrupt one already in flight, so it takes effect within
                # one URL's processing time, not instantly. Save whatever's
                # left so the next run resumes here instead of starting over.
                remaining = discovered_urls[_url_index:]
                logger.info(f"[Job {job_id}] Pause requested — stopping with {len(remaining)} URL(s) left to resume from")
                job.pending_urls = remaining
                job.pause_requested = False
                _paused_mid_run = True
                break
            if _url_index > 0:
                # Small jittered delay between listing fetches — hammering a
                # broker site back-to-back with zero delay risks getting the
                # platform's egress IP rate-limited or outright blocked, which
                # would break not just this run but every future scrape of that
                # site until a proxy is configured.
                time.sleep(random.uniform(_MIN_FETCH_DELAY_SECONDS, _MAX_FETCH_DELAY_SECONDS))
            if scraper._consecutive_blocks >= _BLOCK_SHORT_CIRCUIT_THRESHOLD:
                # We're being blocked (403/429/TCP-RST/etc.), not just missing
                # pages — every remaining URL would fail the same way. Stop
                # burning through the list; the per-URL errors already logged
                # make it clear a proxy is needed, and this leaves the rest of
                # the job's listings untouched (not archived) for the next run.
                remaining = len(discovered_urls) - len(run_log)
                logger.warning(
                    f"[Job {job_id}] {scraper._consecutive_blocks} consecutive blocked fetches — "
                    f"stopping early with {remaining} URL(s) unprocessed this run (likely needs a proxy)"
                )
                run_log.append({
                    "outcome": "job_short_circuited_blocked",
                    "consecutive_blocks": scraper._consecutive_blocks,
                    "urls_remaining": remaining,
                })
                stats["blocked_short_circuit"] = True
                break
            try:
                # Look up any existing rows BEFORE releasing the DB connection.
                _existing_scraped_id = (
                    db.query(ScrapedListing.id)
                    .filter(ScrapedListing.job_id == job_id, ScrapedListing.source_url == url)
                    .scalar()
                )
                _existing_raw_id = (
                    db.query(RawScrapedPage.id)
                    .filter(RawScrapedPage.job_id == job_id, RawScrapedPage.source_url == url)
                    .scalar()
                )

                # Stage 1: Intake -- fetch HTML (release DB during slow network call)
                db.commit()
                db.close()

                try:
                    html, wp_extra_text, wp_images = scraper._fetch_listing_html(url, template=_template)
                except Exception as _fetch_exc:
                    db = SessionLocal()
                    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
                    stats["errors"] += 1
                    run_log.append({"url": url, "outcome": "error", "error": f"fetch failed: {_fetch_exc}"})
                    logger.error(f"[Job {job_id}] Fetch failed for {url}: {_fetch_exc}")
                    continue

                db = SessionLocal()
                job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()

                content_hash = hashlib.sha256((html or "").encode("utf-8", errors="replace")).hexdigest()[:32]

                existing_raw = (
                    db.query(RawScrapedPage).filter(RawScrapedPage.id == _existing_raw_id).first()
                ) if _existing_raw_id else None

                # Skip re-processing unchanged listings (saves AI credits on re-runs)
                if (
                    existing_raw
                    and existing_raw.content_hash == content_hash
                    and existing_raw.stage == "validated"
                    and existing_raw.merged_data
                ):
                    raw = existing_raw.merged_data
                    logger.info(f"[Job {job_id}] Skipping unchanged page (hash match): {url}")
                else:
                    if existing_raw:
                        raw_page = existing_raw
                    else:
                        raw_page = RawScrapedPage(job_id=job_id, source_url=url)
                        db.add(raw_page)

                    raw_page.raw_html = html
                    raw_page.raw_text = scraper.clean_html(html) if html else ""
                    raw_page.wp_extra_text = wp_extra_text or None
                    raw_page.content_hash = content_hash
                    raw_page.stage = "intake"
                    raw_page.fetched_at = datetime.utcnow()
                    raw_page.updated_at = datetime.utcnow()
                    db.commit()

                    # Stage 2: Normalize (structured extraction, no network)
                    raw_text = raw_page.raw_text or ""
                    if wp_extra_text:
                        raw_text = wp_extra_text + "\n\n" + raw_text

                    structured = scraper.try_structured_extraction(html, url)
                    html_specs = scraper._parse_spec_tables_with_synonyms(html, synonym_cache)
                    regex_specs = scraper.extract_specs_from_text(raw_text)
                    price_result = scraper.extract_price_with_currency(raw_text)
                    if price_result:
                        regex_specs["price"] = price_result[0]
                        regex_specs["currency"] = price_result[1]

                    partial = {**regex_specs, **html_specs, **(structured or {})}

                    if not partial.get("title") and partial.get("_h1_title"):
                        partial["title"] = partial.pop("_h1_title")
                    else:
                        partial.pop("_h1_title", None)

                    if not partial.get("description"):
                        det_desc = scraper.extract_description_from_text(raw_text)
                        if det_desc:
                            partial["description"] = det_desc

                    if partial.get("title") and not partial.get("make"):
                        title_parts = partial["title"].split()
                        if len(title_parts) >= 3 and re.match(r"(19|20)\d{2}", title_parts[0]):
                            partial["make"] = title_parts[1]
                            partial["model"] = " ".join(title_parts[2:])
                        elif len(title_parts) >= 2 and re.match(r"(19|20)\d{2}", title_parts[0]):
                            partial["make"] = title_parts[1]

                    norm_city, norm_state, norm_country = OptimizedYachtScraper.normalize_location(
                        partial.get("city"), partial.get("state"), partial.get("country")
                    )
                    if norm_city is not None:
                        partial["city"] = norm_city
                    if norm_state is not None:
                        partial["state"] = norm_state
                    elif "state" in partial:
                        partial.pop("state", None)
                    if norm_country is not None:
                        partial["country"] = norm_country

                    images = scraper.extract_images(html, url)
                    if not images and html and len(html) > 3000 and _PLAYWRIGHT_AVAILABLE:
                        _hl_html = scraper.fetch_page_headless(url)
                        if _hl_html and len(_hl_html) > len(html):
                            html = _hl_html
                            images = scraper.extract_images(_hl_html, url)
                    if wp_images:
                        _seen_norms = {u.split("?")[0] for u in images}
                        for _wu in wp_images:
                            if _wu.split("?")[0] not in _seen_norms:
                                images.insert(0, _wu)
                                _seen_norms.add(_wu.split("?")[0])
                    partial["images"] = images[:_MAX_IMAGES_PER_LISTING]

                    detected_agent = scraper.detect_agent_name(html, raw_text)
                    if not detected_agent and partial.get("agent_name"):
                        detected_agent = partial.pop("agent_name")
                    else:
                        partial.pop("agent_name", None)
                    if detected_agent:
                        partial["detected_agent_name"] = detected_agent
                        agent_photo = scraper.detect_agent_photo(html, detected_agent)
                        if agent_photo:
                            partial["detected_agent_photo"] = agent_photo
                            _ap_norms = {agent_photo, agent_photo.split("?")[0]}
                            partial["images"] = [
                                i for i in partial.get("images", [])
                                if i not in _ap_norms and i.split("?")[0] not in _ap_norms
                            ]

                    partial.update({"source_url": url, "source": "scraped",
                                    "scraped_at": datetime.utcnow().isoformat()})
                    raw_page.normalized_data = partial
                    raw_page.stage = "normalized"
                    raw_page.normalized_at = datetime.utcnow()
                    db.commit()

                    # Stage 3: AI Parse (only when critical fields are still missing,
                    # and only when this job hasn't been configured to skip AI —
                    # e.g. to verify deterministic extraction is coming through
                    # correctly on a fresh broker before spending AI credits on it).
                    ai_used = False
                    _ai_enabled = (_template or {}).get("ai_enabled", True)
                    if _ai_enabled and scraper._needs_ai_check(partial):
                        _raw_page_id = raw_page.id   # capture before closing session
                        db.close()
                        try:
                            yacht_data = scraper.scrape_with_ai(raw_text, url, partial)
                        except _AnthropicCreditsExhausted:
                            raise
                        except Exception as _ai_exc:
                            logger.warning(f"[Job {job_id}] AI parse failed for {url}: {_ai_exc}")
                            yacht_data = partial
                        db = SessionLocal()
                        job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
                        raw_page = db.query(RawScrapedPage).filter(RawScrapedPage.id == _raw_page_id).first()
                        ai_used = True
                        raw_page.ai_data = yacht_data
                        raw_page.ai_used = True
                        raw_page.stage = "ai_parsed"
                        raw_page.ai_parsed_at = datetime.utcnow()
                        db.commit()
                    else:
                        yacht_data = partial

                    # Apply template selector overrides (highest priority)
                    if _template:
                        _tmpl_soup = BeautifulSoup(html or "", "html.parser")
                        scraper._apply_template_selectors(yacht_data, _tmpl_soup, _template)
                        scraper._apply_template_field_rules(yacht_data, raw_text, _template)

                    # Title cleanup
                    _title_boat_re = re.compile(
                        r"(\d{1,4}\s*(19|20)\d{2}|(19|20)\d{2}\s*[-\u2013]?\s*\w|\b\d{2,3}\s*ft\b)",
                        re.IGNORECASE,
                    )
                    if not yacht_data.get("title"):
                        soup_title = BeautifulSoup(html or "", "html.parser").find("title")
                        if soup_title:
                            raw_title = soup_title.get_text(strip=True)
                            for sep in [" - ", " | ", " \u2014 ", " :: "]:
                                if sep in raw_title:
                                    parts = [p.strip() for p in raw_title.split(sep)]
                                    boat_part = next((p for p in parts if _title_boat_re.search(p)), None)
                                    raw_title = boat_part if boat_part else parts[0]
                                    break
                            if len(raw_title) > 3:
                                yacht_data["title"] = raw_title
                    if yacht_data.get("title"):
                        _t = yacht_data["title"]
                        for _sep in [" - ", " | ", " \u2014 ", " :: "]:
                            if _sep in _t:
                                _parts = [p.strip() for p in _t.split(_sep)]
                                _boat = next((p for p in _parts if _title_boat_re.search(p)), None)
                                if _boat and _boat != _t:
                                    yacht_data["title"] = _boat
                                break
                    if not yacht_data.get("description") and partial.get("description"):
                        yacht_data["description"] = partial["description"]

                    # Sold detection
                    if html and not yacht_data.get("is_sold"):
                        _check_soup = BeautifulSoup(html, "html.parser")
                        if _template and _template.get("sold_banner_selector"):
                            try:
                                if _check_soup.select_one(_template["sold_banner_selector"].strip()):
                                    yacht_data["is_sold"] = True
                            except Exception:
                                pass
                        if not yacht_data.get("is_sold"):
                            _sold_cls = re.compile(
                                r"^(?:sold|is-sold|sold-badge|sold-overlay|sold-ribbon"
                                r"|listing-sold|badge-sold|status-sold|vessel-sold"
                                r"|yacht-sold|label-sold|tag-sold|unavailable-banner)$",
                                re.IGNORECASE,
                            )
                            for _el in _check_soup.find_all(class_=_sold_cls):
                                if not _el.find_parent("a"):
                                    yacht_data["is_sold"] = True
                                    break

                    # Stage 4: Validate
                    # Synthesize title if still missing but we have make/model
                    if not yacht_data.get("title") and (yacht_data.get("make") or yacht_data.get("model")):
                        _t_parts: list = []
                        if yacht_data.get("year"):
                            _t_parts.append(str(int(yacht_data["year"])))
                        if yacht_data.get("make"):
                            _t_parts.append(str(yacht_data["make"]).strip())
                        _t_model = str(yacht_data.get("model", "")).strip()
                        if _t_model:
                            _t_parts.append(_t_model)
                        _t_length = yacht_data.get("length_feet")
                        if _t_length:
                            _t_len_int = str(int(float(_t_length)))
                            if _t_len_int not in _t_model:
                                _t_parts.append(f"{_t_len_int}ft")
                        if _t_parts:
                            yacht_data["title"] = " ".join(_t_parts)

                    # Fill blank spec fields from the boat model database
                    _apply_boat_specs_lookup(yacht_data, db)

                    confidence = _compute_confidence(yacht_data)
                    skip_reason = None
                    if not yacht_data.get("title") and confidence < 0.2:
                        skip_reason = "low_confidence"
                    elif not html or len(html) < 500:
                        skip_reason = "too_small"

                    raw_page.merged_data = yacht_data
                    raw_page.confidence_score = confidence
                    raw_page.skip_reason = skip_reason
                    raw_page.stage = "failed" if skip_reason else "validated"
                    raw_page.validated_at = datetime.utcnow()
                    db.commit()

                    _needs_manual_review = None
                    if skip_reason:
                        # Don't just discard this — without a persisted record there's
                        # no way to know which listings on the source site never made
                        # it into inventory, or to find them again to complete by hand.
                        # Capture whatever was extracted (even just the URL) as an
                        # awaiting_review stub flagged for manual review instead. The
                        # URL-slug fallback title (only applied below if the listing
                        # still has none after _apply_scraped_data) is deliberately NOT
                        # injected into yacht_data here — this same code path also
                        # handles re-fetching an already-live listing, and overwriting
                        # its real title with a rough slug guess on a transient re-fetch
                        # miss would be worse than just leaving the good data alone.
                        stats["captured_low_confidence"] = stats.get("captured_low_confidence", 0) + 1
                        _needs_manual_review = {
                            "reason": skip_reason,
                            "confidence": confidence,
                            "detected_at": datetime.utcnow().isoformat(),
                        }
                        logger.info(f"[Job {job_id}] Captured as needs-review stub: {url}: {skip_reason} (confidence={confidence})")

                    raw = yacht_data

                    def _apply_review_flag(lst: "Listing") -> None:
                        """Stamp/clear the needs_manual_review marker in
                        additional_specs, and backfill a URL-slug-derived title
                        only if the listing still has none after _apply_scraped_data
                        (which never overwrites an existing field with a blank)."""
                        _specs = dict(lst.additional_specs or {})
                        if _needs_manual_review:
                            _specs["needs_manual_review"] = _needs_manual_review
                            if not lst.title:
                                lst.title = _title_from_url_slug(url)
                        elif "needs_manual_review" in _specs:
                            del _specs["needs_manual_review"]  # this run succeeded — clear a stale flag from an earlier one
                        lst.additional_specs = _specs

                existing_scraped = (
                    db.query(ScrapedListing)
                    .filter(ScrapedListing.id == _existing_scraped_id)
                    .first()
                ) if _existing_scraped_id else None

                if "error" in raw:
                    stats["errors"] += 1
                    run_log.append({"url": url, "outcome": "error", "error": raw.get("error", "unknown error")})
                    continue

                # Sold listings — import but flag with status="sold" so they
                # appear in the admin review queue under the Sold tab, not in awaiting_review.
                _is_sold = raw.get("is_sold", False)
                if _is_sold:
                    logger.info(f"[Job {job_id}] Sold listing detected, importing as sold: {url}")

                # Try to match the detected agent name against the dealer's salespeople
                detected_name = raw.get("detected_agent_name")
                detected_photo = raw.get("detected_agent_photo")
                matched_salesman_id = job.salesman_id  # default to job-level assignment
                matched_guest_id: Optional[int] = None
                if detected_name and not job.salesman_id:
                    detected_lower = detected_name.lower()
                    # Fix: team members use user_type="team_member", not "salesman"
                    salespeople = (
                        db.query(User)
                        .filter(
                            User.parent_dealer_id == job.dealer_id,
                            User.user_type.in_(["team_member", "salesman"]),
                            User.active == True,
                        )
                        .all()
                    )
                    for sp in salespeople:
                        full_name = f"{sp.first_name or ''} {sp.last_name or ''}".strip().lower()
                        if full_name and (full_name in detected_lower or detected_lower in full_name):
                            matched_salesman_id = sp.id
                            break

                    # No real account match — auto-create or reuse a GuestBroker
                    if not matched_salesman_id:
                        name_parts = detected_name.strip().split()
                        first = name_parts[0] if name_parts else detected_name
                        last = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
                        existing_guest = (
                            db.query(GuestBroker)
                            .filter(
                                GuestBroker.dealer_id == job.dealer_id,
                                GuestBroker.first_name == first,
                                GuestBroker.last_name == last,
                            )
                            .first()
                        )
                        if existing_guest:
                            matched_guest_id = existing_guest.id
                            # Update photo if we found one and they don't have one yet
                            if detected_photo and not existing_guest.photo_url:
                                existing_guest.photo_url = detected_photo
                        else:
                            new_guest = GuestBroker(
                                dealer_id=job.dealer_id,
                                first_name=first,
                                last_name=last,
                                photo_url=detected_photo,
                                source="scraper",
                            )
                            db.add(new_guest)
                            db.flush()
                            matched_guest_id = new_guest.id
                            job.team_members_imported = (job.team_members_imported or 0) + 1
                            logger.info(f"[Job {job.id}] Auto-created GuestBroker #{new_guest.id}: {detected_name}")

                if existing_scraped and existing_scraped.listing_id:
                    # Update existing listing
                    listing = db.query(Listing).filter(Listing.id == existing_scraped.listing_id).first()
                    if listing:
                        _apply_scraped_data(listing, raw, job)
                        _apply_review_flag(listing)
                        # Restore guest_salesman_id if we matched/created one
                        if matched_guest_id and not listing.assigned_salesman_id:
                            listing.guest_salesman_id = matched_guest_id
                        # Respect manual broker changes: only restore to active if the scraper
                        # previously auto-archived it (disappeared from site), not if the broker
                        # intentionally set it to "draft" to hide it.
                        if _is_sold:
                            listing.status = "sold"
                        elif listing.status not in ("draft", "awaiting_review"):
                            listing.status = "active"
                        existing_scraped.last_seen = datetime.utcnow()
                        existing_scraped.still_active = True
                        stats["updated"] += 1
                        run_log.append({"url": url, "outcome": "sold" if _is_sold else "updated", "listing_id": listing.id, "title": listing.title, "needs_manual_review": bool(_needs_manual_review)})
                else:
                    # Guard against duplicate listings: if a Listing with this source_url
                    # already exists for this dealer, re-link it instead of creating a duplicate.
                    # This covers two scenarios:
                    #   A) ScrapedListing record was lost (e.g. prior rolled-back run) — true orphan
                    #   B) A different job previously scraped the same site — cross-job re-link
                    _orphaned_listing = (
                        db.query(Listing)
                        .filter(
                            Listing.user_id == job.dealer_id,
                            Listing.source_url == url,
                            Listing.deleted_at == None,  # never re-link soft-deleted listings
                        )
                        .first()
                    )
                    if _orphaned_listing:
                        # Determine if this is a cross-job re-link (other job already has
                        # a ScrapedListing for this URL) vs a true orphan (no record at all).
                        _prior_scraped = (
                            db.query(ScrapedListing.id)
                            .filter(ScrapedListing.source_url == url, ScrapedListing.listing_id == _orphaned_listing.id)
                            .scalar()
                        )
                        listing = _orphaned_listing
                        _apply_scraped_data(listing, raw, job)
                        _apply_review_flag(listing)
                        if _is_sold:
                            listing.status = "sold"
                        elif listing.status not in ("draft", "awaiting_review"):
                            listing.status = "active"
                        scraped_record = ScrapedListing(
                            job_id=job_id,
                            listing_id=listing.id,
                            source_url=url,
                            last_seen=datetime.utcnow(),
                            still_active=True,
                        )
                        db.add(scraped_record)
                        stats["updated"] += 1
                        run_log.append({"url": url, "outcome": "sold" if _is_sold else "updated", "listing_id": listing.id, "title": listing.title, "needs_manual_review": bool(_needs_manual_review)})
                        if _prior_scraped:
                            logger.info(f"[Job {job_id}] Linked listing #{listing.id} from prior job for {url}")
                        else:
                            logger.info(f"[Job {job_id}] Recovered orphaned listing #{listing.id} for {url}")
                    else:
                        # Create new listing — placed in awaiting_review so admin can review before publishing
                        listing = Listing(
                            user_id=job.dealer_id,
                            created_by_user_id=job.created_by_id or job.dealer_id,
                            assigned_salesman_id=matched_salesman_id,
                            guest_salesman_id=matched_guest_id,
                            source="scraped",
                            source_url=url,
                            status="sold" if _is_sold else "awaiting_review",
                            bin=_generate_bin(db),
                            condition="used",
                        )
                        _apply_scraped_data(listing, raw, job)
                        _apply_review_flag(listing)
                        db.add(listing)
                        db.flush()  # get listing.id

                        # Create images — filter out social media assets and tiny non-boat images.
                        # Every scraped image is downloaded and re-hosted on our own storage
                        # (not just known syndicator CDNs) so a listing's photos don't vanish
                        # the moment the broker's own site goes down or changes its URLs.
                        _SKIP_IMAGE_RE = re.compile(
                            r'facebook\.|instagram\.|twitter\.|linkedin\.|youtube\.|tiktok\.|'
                            r'logo|icon|favicon|avatar|banner|social|share|'
                            r'placeholder|no.image|no_image|spinner|pixel|tracking',
                            re.IGNORECASE,
                        )
                        photo_position = 0
                        for img_url in raw.get("images", [])[:_MAX_IMAGES_PER_LISTING]:
                            if _SKIP_IMAGE_RE.search(img_url):
                                continue
                            img_url = _rehost_image(img_url)
                            db.add(ListingImage(
                                listing_id=listing.id,
                                url=img_url,
                                display_order=photo_position,
                                alt_text=_generate_image_alt_text(listing, photo_position),
                            ))
                            photo_position += 1

                        # Track in ScrapedListing
                        scraped_record = ScrapedListing(
                            job_id=job_id,
                            listing_id=listing.id,
                            source_url=url,
                            last_seen=datetime.utcnow(),
                            still_active=True,
                        )
                        db.add(scraped_record)
                        stats["created"] += 1
                        run_log.append({"url": url, "outcome": "sold" if _is_sold else "created", "listing_id": listing.id, "title": listing.title, "needs_manual_review": bool(_needs_manual_review)})

                # Flush live stats to DB every 5 listings so frontend polling sees progress
                if (stats["created"] + stats["updated"] + stats["errors"]) % 5 == 0:
                    job.listings_found = stats["found"]
                    job.listings_created = stats["created"]
                    job.listings_updated = stats["updated"]
                    db.commit()

            except Exception as e:
                logger.error(f"[Job {job_id}] Error processing {url}: {e}")
                stats["errors"] += 1
                run_log.append({"url": url, "outcome": "error", "error": str(e)[:300]})
                # ── Anthropic credit exhaustion — pause job immediately ────────
                # Re-raise so the outer try/except can disable the job and stop
                # iterating (every subsequent URL would fail for the same reason).
                if isinstance(e, _AnthropicCreditsExhausted):
                    raise
                # Ensure the session is in a clean, usable state for the next iteration.
                # (The connection is already closed if the error happened before re-acquire.)
                try:
                    db.rollback()
                except Exception:
                    pass
                try:
                    db.close()
                except Exception:
                    pass
                db = SessionLocal()
                job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
                if not job:
                    logger.error(f"[Job {job_id}] Job disappeared from DB after error recovery; aborting")
                    break

        # -- Step 3: archive listings that disappeared --
        # NOTE: archival is a soft status flip (Listing.status = "archived"), never a
        # delete — a listing that comes back on a later scrape can be reactivated.
        # Skipped entirely for a paused-mid-run or resumed-from-pause run: in
        # both cases discovered_url_set isn't the full picture (a fresh,
        # complete discovery pass didn't run, or didn't finish), so "not seen
        # this run" can't be trusted to mean "no longer listed". The next
        # fully-fresh run reconciles this normally.
        if _paused_mid_run or _is_resumed_run:
            logger.info(f"[Job {job_id}] Skipping archival — {'paused mid-run' if _paused_mid_run else 'resumed from a pause'}, discovery wasn't a complete fresh pass")
            run_log.append({"outcome": "archival_skipped_paused_or_resumed"})
            stats["archival_skipped"] = True
        else:
            previously_active = (
                db.query(ScrapedListing)
                .filter(ScrapedListing.job_id == job_id, ScrapedListing.still_active == True)
                .all()
            )
            would_archive = [r for r in previously_active if r.source_url not in discovered_url_set]

            # Safety threshold: a broken pagination selector, a JS-render failure, or a
            # transient block can make discovery return far fewer URLs than the site
            # actually has. Without a guard here, that single bad crawl would archive
            # nearly a dealer's entire live inventory. If this run's discovery looks
            # suspicious relative to what we've tracked before, skip archival entirely
            # this run — listings stay active/untouched until a healthy crawl confirms
            # they're really gone.
            previously_tracked_count = len(previously_active)
            drop_ratio = (len(would_archive) / previously_tracked_count) if previously_tracked_count else 0.0
            archival_suspicious = (
                (len(discovered_urls) == 0 and previously_tracked_count > 0)
                or (previously_tracked_count >= 5 and drop_ratio > 0.5)
            )

            if archival_suspicious:
                logger.warning(
                    f"[Job {job_id}] Skipping archival — discovery found {len(discovered_urls)} URLs this run "
                    f"and would archive {len(would_archive)}/{previously_tracked_count} previously-tracked "
                    f"listings ({drop_ratio:.0%}), over the safety threshold. Treating this run's discovery as "
                    f"unreliable rather than archiving live inventory."
                )
                run_log.append({
                    "outcome": "archival_skipped_suspicious_drop",
                    "discovered": len(discovered_urls),
                    "previously_tracked": previously_tracked_count,
                    "would_have_archived": len(would_archive),
                })
                stats["archival_skipped"] = True
            else:
                for scraped_record in would_archive:
                    scraped_record.still_active = False
                    if scraped_record.listing_id:
                        listing = db.query(Listing).filter(Listing.id == scraped_record.listing_id).first()
                        if listing and listing.status == "active":
                            listing.status = "archived"
                            stats["archived"] += 1
                            run_log.append({"url": scraped_record.source_url, "outcome": "archived", "listing_id": scraped_record.listing_id})
                            logger.info(f"[Job {job_id}] Archived listing #{listing.id} â€” no longer on broker site")

        # -- Step 4: update job record --
        job.status = "paused" if _paused_mid_run else "completed"
        job.completed_at = datetime.utcnow()
        job.last_run_at = datetime.utcnow()
        job.listings_found = stats["found"]
        job.listings_created = stats["created"]
        job.listings_updated = stats["updated"]
        job.listings_removed = stats["archived"]
        job.total_runs = (job.total_runs or 0) + 1
        job.next_run_at = datetime.utcnow() + timedelta(hours=int(job.schedule_hours or 24))
        job.last_run_log = run_log
        # A "completed" run that quietly found nothing because the proxy
        # itself is broken (expired subscription, bad key) deserves a visible
        # error, distinct from job.status — status reflects "did the run
        # crash", not "did the proxy actually work".
        if scraper._proxy_auth_failed:
            job.last_error = scraper._proxy_auth_failed
        db.commit()

        # Diagnostic: verify what actually landed in the DB for this dealer
        _status_counts = {}
        for row in (
            db.query(Listing.status, func.count(Listing.id))
            .filter(Listing.user_id == job.dealer_id, Listing.source == "scraped", Listing.deleted_at == None)
            .group_by(Listing.status)
            .all()
        ):
            _status_counts[row[0]] = row[1]
        logger.info(f"[Job {job_id}] Sync complete: {stats} | DB scraped listings by status: {_status_counts}")
        return {"success": True, "job_id": job_id, **stats}

    except _AnthropicCreditsExhausted as e:
        # Disable the job so the scheduler doesn't retry it every hour and
        # keep burning time until the billing issue is resolved manually.
        job.status = "paused"
        job.enabled = False
        job.last_error = (
            "Anthropic API credits exhausted — job paused. "
            "Top up your Anthropic balance and re-enable this job to resume. "
            f"Detail: {e}"
        )
        job.completed_at = datetime.utcnow()
        job.last_run_log = run_log
        db.commit()
        logger.error(f"[Job {job_id}] Paused: Anthropic credits exhausted. Job disabled until re-enabled.")
        return {"success": False, "error": "Anthropic credits exhausted — job paused"}

    except Exception as e:
        job.status = "failed"
        job.last_error = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()
        logger.error(f"[Job {job_id}] Job failed: {e}")
        return {"success": False, "error": str(e)}


# Scraped listing content originates from untrusted external broker sites, so
# it's sanitized here at ingestion — not just at render time — since the raw
# value also gets served back out through the API and admin tools.
_RICH_TEXT_ALLOWED_TAGS = ["b", "strong", "i", "em", "p", "br", "ul", "ol", "li", "a"]
_RICH_TEXT_ALLOWED_ATTRS = {"a": ["href", "title"]}


def _sanitize_plain_text(value: str) -> str:
    """Strip all HTML, leaving plain text only — for short identifier-like fields."""
    return bleach.clean(value, tags=[], attributes={}, strip=True).strip()


def _sanitize_rich_text(value: str) -> str:
    """Allow a small safe-tag allowlist — for long free-text fields like descriptions."""
    return bleach.clean(value, tags=_RICH_TEXT_ALLOWED_TAGS, attributes=_RICH_TEXT_ALLOWED_ATTRS, strip=True).strip()


def _generate_image_alt_text(listing: Listing, photo_position: int) -> str:
    """Descriptive alt text for a scraped photo, from the listing's own fields plus its
    position in the gallery — scraped source sites rarely provide usable alt text.

    Thin wrapper around app.services.alt_text, the single source of truth
    shared with the charter/manual-scrape/backfill paths — kept here too
    since it's part of this module's public surface (imported directly by
    tests and other scraper internals)."""
    from app.services.alt_text import generate_listing_image_alt_text
    return generate_listing_image_alt_text(listing, photo_position)


# Physically-implausible-value bounds, applied in _apply_scraped_data — the
# single write path shared by the HTML scraper, the YachtWorld/IYBA API sync,
# and the Master Ocean API sync. Previously bounds-checking only happened
# inside the HTML scraper's own extraction function (scrape_single_listing),
# so a bad value straight from a "trusted" API feed (a broker's data-entry
# error, a placeholder/test record, a schema quirk) had no backstop at all
# before landing in the DB. year's upper bound is computed at call time since
# it depends on the current date.
_NUMERIC_FIELD_BOUNDS = {
    "price": (1000, 100_000_000),
    "length_feet": (8, 600),
    "beam_feet": (3, 100),
    "draft_feet": (0.5, 40),
    "cabins": (0, 20),
    "berths": (0, 40),
    "heads": (0, 20),
    "max_speed_knots": (0, 100),
    "cruising_speed_knots": (0, 100),
    "engine_hours": (0, 50_000),
}


def _title_from_url_slug(url: str) -> str:
    """Fallback title derived from a listing URL's slug when extraction found
    nothing usable — e.g. ".../yacht/2826902/1980-Kelsall-47-47-TripleJack"
    -> "1980 Kelsall 47 47 TripleJack". Not meant to be a polished title;
    just enough for an admin reviewing the low-confidence queue to recognize
    which boat this is without clicking through to the source page."""
    path = urlparse(url).path
    segments = [s for s in path.split('/') if s]
    if not segments:
        return "Unnamed listing (needs review)"
    slug = unquote(segments[-1])
    # A purely-numeric trailing segment (e.g. a listing ID with no slug after
    # it) isn't useful on its own — prefer the more descriptive segment
    # before it, if there is one.
    if slug.isdigit() and len(segments) >= 2:
        slug = unquote(segments[-2])
    title = re.sub(r'[-_]+', ' ', slug).strip()
    return title or "Unnamed listing (needs review)"


def _apply_scraped_data(listing: Listing, raw: Dict, job: ScraperJob):
    """Copy scraped fields onto a Listing object, preserving manually-set overrides."""
    str_fields = ["title", "make", "model", "boat_type",
                  "hull_material", "hull_type", "fuel_type", "currency"]
    # Text fields stored without length limit
    text_fields = ["description", "features"]
    float_fields = ["price", "length_feet", "beam_feet", "draft_feet",
                    "max_speed_knots", "cruising_speed_knots",
                    "fuel_capacity_gallons", "water_capacity_gallons",
                    "engine_hours"]
    int_fields = ["year", "cabins", "berths", "heads", "engine_count"]

    for f in str_fields:
        if raw.get(f):
            value = str(raw[f])[:500] if isinstance(raw[f], str) else str(raw[f])
            setattr(listing, f, _sanitize_plain_text(value))
    for f in text_fields:
        if raw.get(f):
            setattr(listing, f, _sanitize_rich_text(str(raw[f])))
    # Store feature_bullets as JSON array if provided
    if raw.get("feature_bullets") and isinstance(raw["feature_bullets"], list):
        listing.feature_bullets = [
            _sanitize_plain_text(str(item)) if isinstance(item, str) else item
            for item in raw["feature_bullets"]
        ]
    _PRICE_SWING_REVIEW_THRESHOLD = 0.8  # an 80%+ single-scrape price swing gets flagged, not silently applied
    for f in float_fields:
        if raw.get(f) is None:
            continue
        try:
            v = float(raw[f])
        except (ValueError, TypeError):
            continue
        # Price of exactly 0 means unknown — store as None (exempt from bounds below)
        if f == 'price' and v == 0:
            listing.price = None
            continue
        _bounds = _NUMERIC_FIELD_BOUNDS.get(f)
        if _bounds and not (_bounds[0] <= v <= _bounds[1]):
            logger.info(
                f"_apply_scraped_data: rejecting implausible {f}={v} for listing "
                f"#{listing.id or '(new)'} (expected {_bounds[0]}-{_bounds[1]})"
            )
            continue
        if f == 'price' and listing.price and listing.price > 0:
            # Guard against a single bad scrape/feed record (a superseded/
            # related-listing price the regex grabbed, a decimal-place slip,
            # etc.) silently clobbering a previously-good price. A swing this
            # large in one sync cycle is far more likely to be an extraction
            # error than a real price change, so keep the existing price and
            # flag it for admin review instead of overwriting.
            swing = abs(v - listing.price) / listing.price
            if swing > _PRICE_SWING_REVIEW_THRESHOLD:
                specs = dict(listing.additional_specs or {})
                specs["price_review_pending"] = {
                    "current_price": listing.price,
                    "scraped_price": v,
                    "detected_at": datetime.utcnow().isoformat(),
                }
                listing.additional_specs = specs
                logger.warning(
                    f"_apply_scraped_data: listing #{listing.id} price swing "
                    f"{listing.price} -> {v} ({swing:.0%}) exceeds review threshold — "
                    f"keeping existing price, flagged for admin review"
                )
            else:
                setattr(listing, f, v)
        else:
            setattr(listing, f, v)
    _this_year = datetime.now().year
    for f in int_fields:
        if raw.get(f) is None:
            continue
        try:
            v = int(raw[f])
        except (ValueError, TypeError):
            continue
        if f == 'year':
            if not (1900 <= v <= _this_year + 2):
                logger.info(f"_apply_scraped_data: rejecting implausible year={v} for listing #{listing.id or '(new)'}")
                continue
        else:
            _bounds = _NUMERIC_FIELD_BOUNDS.get(f)
            if _bounds and not (_bounds[0] <= v <= _bounds[1]):
                logger.info(
                    f"_apply_scraped_data: rejecting implausible {f}={v} for listing "
                    f"#{listing.id or '(new)'} (expected {_bounds[0]}-{_bounds[1]})"
                )
                continue
        setattr(listing, f, v)

    # Normalize and infer location fields
    _prior_city, _prior_state, _prior_country = listing.city, listing.state, listing.country
    city, state, country = OptimizedYachtScraper.normalize_location(
        raw.get("city"), raw.get("state"), raw.get("country")
    )
    if city is not None:
        listing.city = city
    if state is not None:
        listing.state = state
    elif raw.get("state") is not None:
        listing.state = None  # explicitly cleared (was actually a country)
    if country is not None:
        listing.country = country

    # Re-geocode when the location actually changed, or when it hasn't been
    # geocoded yet at all (covers the backfill case: existing listings with a
    # location but no coordinates get geocoded the next time this job touches
    # them). Skipped otherwise so a routine re-sync of an unchanged listing
    # doesn't burn a geocoding API call every cycle.
    if (
        listing.city != _prior_city or listing.state != _prior_state or listing.country != _prior_country
        or listing.latitude is None or listing.longitude is None
    ):
        listing.latitude, listing.longitude = geocode_location(
            listing.city, listing.state, listing.country, listing.zip_code
        )

    # Always keep dealer / salesman linkage
    listing.user_id = job.dealer_id
    listing.source = "scraped"  # ensure legacy listings created before source field are corrected
    if job.salesman_id:
        listing.assigned_salesman_id = job.salesman_id

    # Persist the raw detected agent name into additional_specs for admin review UI
    if raw.get("detected_agent_name"):
        specs = dict(listing.additional_specs or {})
        specs["detected_agent_name"] = raw["detected_agent_name"]
        listing.additional_specs = specs


# ---------------------------------------------------------
# SCHEDULER HOOK â€” called periodically to run due jobs
# ---------------------------------------------------------

# A job stuck "running" longer than this is treated as crashed, not active.
# Kept in sync with routes_scraper.py's manual "Run Now" endpoint, which has
# its own copy of this same recovery logic for the same reason.
#
# Must stay comfortably above the longest a legitimate run can now take:
# discovery's idle-timeout-based pagination loop plus per-listing headless
# fallback share a 2-hour budget (see OptimizedYachtScraper.__init__), and
# large brokers are expected to genuinely use a good chunk of that. A tighter
# value here would make the scheduler kill and restart a run that's still
# actively working, not actually stuck.
STALE_RUNNING_MINUTES = 240


def run_due_scraper_jobs(db) -> int:
    """Find all enabled jobs that are due and run them. Returns count of jobs triggered.

    Jobs stuck in status="running" past STALE_RUNNING_MINUTES (process crashed
    or the server restarted mid-run) are reset here too — without this, a
    crashed job would be silently excluded from every future scheduler tick
    forever, since the query below filters on status != "running" and nothing
    else would ever flip it back. Previously only the manual "Run Now" endpoint
    had this recovery, which only helped if an admin happened to notice.
    """
    now = datetime.utcnow()
    stale_cutoff = now - timedelta(minutes=STALE_RUNNING_MINUTES)
    stuck_jobs = (
        db.query(ScraperJob)
        .filter(
            ScraperJob.status == "running",
            ScraperJob.started_at != None,
            ScraperJob.started_at < stale_cutoff,
        )
        .all()
    )
    for job in stuck_jobs:
        logger.warning(
            f"[Scheduler] Job #{job.id} stuck 'running' since {job.started_at} "
            f"(> {STALE_RUNNING_MINUTES}m) — resetting so it can be scheduled again"
        )
        job.status = "failed"
        job.last_error = f"Previous run appears to have crashed (stuck in 'running' since {job.started_at.isoformat()})"
        job.completed_at = now
    if stuck_jobs:
        db.commit()

    due_jobs = (
        db.query(ScraperJob)
        .filter(
            ScraperJob.enabled == True,
            ScraperJob.status != "running",
            (ScraperJob.next_run_at == None) | (ScraperJob.next_run_at <= now),
        )
        .all()
    )
    count = 0
    for job in due_jobs:
        try:
            logger.info(f"[Scheduler] Running due scraper job #{job.id} ({job.site_name or job.broker_url})")
            run_scraper_job(job.id, db)
            count += 1
        except Exception as e:
            logger.error(f"[Scheduler] Error running job #{job.id}: {e}")
    return count


# ---------------------------------------------------------
# ORPHAN RECONCILIATION — safety net for listings with no owning ScraperJob
# ---------------------------------------------------------
# One-off import paths (admin "Manual Import" tool, broker self-submission via
# /broker/import-request) create a Listing + ScrapedListing with job_id=None,
# by design — there's no recurring job to attach them to. But that also means
# no job's normal archival pass ever re-checks them: run_scraper_job's and
# run_master_ocean_sync's archival both scope to ScrapedListing.job_id == job_id,
# so a job_id=None row is invisible to every job's "did this disappear?" check
# forever. If the source later sells or delists it, it just stays "active" on
# our side indefinitely. This sweeps those orphans on a schedule instead.
def reconcile_orphaned_scraped_listings(db, max_checks: int = 200) -> Dict:
    orphaned = (
        db.query(ScrapedListing)
        .filter(ScrapedListing.job_id.is_(None), ScrapedListing.still_active == True)
        .limit(max_checks)
        .all()
    )
    scraper = OptimizedYachtScraper()
    checked = 0
    archived = 0
    for row in orphaned:
        checked += 1
        listing = db.query(Listing).filter(Listing.id == row.listing_id).first() if row.listing_id else None
        if not listing or listing.deleted_at is not None or listing.status != "active":
            # No longer our concern to keep re-checking (already resolved by
            # some other path) — stop tracking so future sweeps skip it.
            row.still_active = False
        else:
            is_live, reason = scraper.check_listing_still_live(listing.source_url)
            if is_live:
                row.last_seen = datetime.utcnow()
            else:
                listing.status = "archived"
                row.still_active = False
                archived += 1
                logger.info(f"[Reconcile] Archived orphaned listing #{listing.id} ({listing.source_url}): {reason}")
            time.sleep(0.6)  # be polite to source sites
        if checked % 25 == 0:
            db.commit()
    db.commit()
    logger.info(f"[Reconcile] Checked {checked} orphaned scraped listing(s), archived {archived}")
    return {"checked": checked, "archived": archived}
