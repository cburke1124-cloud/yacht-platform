"""
Optimized Yacht Scraper - Hybrid AI + Traditional Extraction
- Uses AI only when necessary
- Structured extraction first (CSS selectors, regex)
- AI fallback only for missing critical fields
- Full job-based sync: discover â†’ scrape â†’ create/update â†’ archive disappeared
"""

import anthropic
import requests
from bs4 import BeautifulSoup
import json
import re
from typing import Optional, Dict, List, Tuple
from urllib.parse import urljoin, urlparse
import asyncio
from datetime import datetime, timedelta
import logging

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

from app.models.listing import Listing, ListingImage
from app.models.misc import ScraperJob, ScrapedListing
from app.models.user import User
from app.db.session import get_db

logger = logging.getLogger(__name__)


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
    def fetch_page(self, url: str, timeout: int = 15) -> Optional[str]:
        """Fetch a page. Uses curl-cffi Chrome TLS impersonation when installed,
        so Cloudflare's JA3 fingerprint check passes. Falls back to plain requests."""
        try:
            if self._curl_session is not None:
                resp = self._curl_session.get(url, timeout=timeout, allow_redirects=True)
            else:
                resp = self._session.get(url, timeout=timeout, allow_redirects=True)
            resp.raise_for_status()
            return resp.text
        except Exception as exc:
            logger.warning(f"fetch_page failed for {url}: {exc}")
            return None

    # ------------------------------------------------------------------ #
    # Subprocess-based headless fetch                                      #
    # ------------------------------------------------------------------ #
    # We intentionally avoid using sync_playwright() / _init_browser()    #
    # inside the main process because:                                     #
    #   1. FastAPI's sync route handlers run inside a threadpool that is   #
    #      attached to a running asyncio event loop; sync_playwright()     #
    #      tries to create its own loop and raises "Sync API inside the    #
    #      asyncio loop" error.                                            #
    #   2. Runtime `playwright install --with-deps` requires sudo/root     #
    #      which is not available on Render's web service containers.      #
    #                                                                      #
    # Solution: spawn a fresh Python subprocess that has no asyncio loop,  #
    # run the entire Playwright session there, and return the HTML over    #
    # stdout.  The binary is installed at build time (`render.yaml`) so   #
    # the subprocess can launch it without any install step.              #
    # ------------------------------------------------------------------ #

    # Inline Python script executed by the subprocess.
    _HEADLESS_SCRIPT = """\
import sys, json
from playwright.sync_api import sync_playwright

url = sys.argv[1]
wait_sel = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "__none__" else None
timeout_ms = int(sys.argv[3]) * 1000 if len(sys.argv) > 3 else 30000

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ))
        page = ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        if wait_sel:
            try:
                page.wait_for_selector(wait_sel, timeout=5000)
            except Exception:
                pass
        try:
            page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass
        html = page.content()
        browser.close()
    print(json.dumps({"ok": True, "html": html}))
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
        Falls back to static fetch if Playwright is unavailable or fails.
        """
        if not _PLAYWRIGHT_AVAILABLE:
            logger.debug("Playwright not available, falling back to fetch_page()")
            return self.fetch_page(url)

        import subprocess, json as _json, sys as _sys, tempfile, os

        try:
            # Write the inline script to a temp file so we avoid shell-quoting hell
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".py", delete=False, encoding="utf-8"
            ) as tf:
                tf.write(self._HEADLESS_SCRIPT)
                script_path = tf.name

            try:
                result = subprocess.run(
                    [
                        _sys.executable, script_path,
                        url,
                        wait_selector or "__none__",
                        str(timeout),
                    ],
                    capture_output=True, text=True, timeout=timeout + 15,
                )
            finally:
                try:
                    os.unlink(script_path)
                except OSError:
                    pass

            stdout = result.stdout.strip()
            if not stdout:
                logger.warning(f"fetch_page_headless: empty output for {url}; stderr={result.stderr[-300:]}")
                return self.fetch_page(url)

            data = _json.loads(stdout)
            if data.get("ok"):
                return data["html"]
            else:
                logger.warning(f"fetch_page_headless subprocess error for {url}: {data.get('error')}")
                return self.fetch_page(url)

        except subprocess.TimeoutExpired:
            logger.warning(f"fetch_page_headless timed out for {url}")
            return self.fetch_page(url)
        except Exception as exc:
            logger.warning(f"fetch_page_headless failed for {url}: {exc}")
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

    def find_listing_urls(self, site_url: str, max_pages: int = 30) -> List[str]:
        """
        Crawl a broker site and return a de-duped list of individual listing URLs.
        Handles both conventional /listings/ sub-directories AND sites that put
        listings directly on the homepage or use non-standard URL structures.
        """
        parsed_base = urlparse(site_url)
        base_domain = f"{parsed_base.scheme}://{parsed_base.netloc}"
        # start_path is the URL path of the seed URL (e.g. "/yacht-condition/used").
        # When it's non-root we restrict the broad "follow everything" expansion so that
        # starting from /used doesn't accidentally crawl /new, /charter, or the full site.
        start_path = parsed_base.path.rstrip('/')
        is_root_start = start_path in ('', '/')

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

        def is_pagination_link(href: str, base_url: str) -> bool:
            """Detect pagination links (page=X, /page/X, rel=next, etc.)"""
            # Check for explicit page/paging parameters
            if re.search(r'[?&](?:page|paged|p)=\d+', href, re.IGNORECASE):
                return True
            # Check for /page/X/ pattern (common in WordPress)
            if re.search(r'/page/\d+/?$', href, re.IGNORECASE):
                return True
            # Check for ?offset=X or ?start=X patterns
            if re.search(r'[?&](?:offset|start|skip)=\d+', href, re.IGNORECASE):
                return True
            return False

        pages_crawled = 0
        while queue and pages_crawled < max_pages:
            page_url, from_start = queue.pop(0)
            clean_url = page_url.split("#")[0].split("?")[0].rstrip("/")
            # Normalize http -> https to avoid double-visiting the same page
            if clean_url.startswith("http://"):
                clean_url = "https://" + clean_url[7:]
            if clean_url in visited_pages:
                continue
            visited_pages.add(clean_url)
            pages_crawled += 1

            html = self.fetch_page(clean_url)
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
            if is_inventory_page(current_page_path.lower()):
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

            # Direct vessel-card extraction: handles sites (e.g. query-param CMSes) that
            # render all listings on one page as card elements with ?id=N href links.
            # Only pick up cards NOT marked as sold/unavailable.
            for card in soup.find_all("div", class_=lambda c: c and "vessel-card" in " ".join(c)):
                card_classes = set((card.get("class") or []))
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
            headless_urls = self._discover_with_headless(base_domain, headless_targets, inventory_keywords, listing_path_patterns)
            if headless_urls:
                listing_urls.update(headless_urls)
                logger.info(f"Headless browser added {len(headless_urls)} listings, total now: {len(listing_urls)}")

        # ── WP REST API discovery — works even on Cloudflare-protected WP sites ──────
        # JSON endpoints are typically NOT behind CF HTML challenges, making this
        # the most reliable discovery method for WP-based broker sites.
        if not listing_urls:
            listing_urls = self._discover_from_wp_rest(base_domain)

        # ── Sitemap fallback ──────────────────────────────────────────────────
        if not listing_urls:
            listing_urls = self._discover_from_sitemap(base_domain, listing_path_patterns)

        return list(listing_urls)

    def _discover_from_wp_rest(self, base_domain: str) -> set:
        """
        Query the WordPress REST API to discover all listing URLs.
        WP REST JSON endpoints are typically NOT behind Cloudflare HTML challenges,
        making this the most reliable discovery path for CF-protected WP broker sites.
        """
        found: set = set()
        _api_hdrs = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
        for post_type in (
            'listings', 'boats', 'yachts', 'vessels', 'motorboats', 'sailboats',
            'yacht-sales', 'yacht_sales',   # taityachts.net style
            'boat-listings', 'used-boats', 'new-boats',  # other common WP slugs
            'product', 'property',
        ):
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
                r = requests.get(
                    sm_url,
                    headers={"User-Agent": "Mozilla/5.0", "Accept": "application/xml,text/xml,*/*"},
                    timeout=10, allow_redirects=True,
                )
                if not r.ok:
                    return
                for loc_m in re.finditer(r'<loc>\s*(https?://[^\s<]+)\s*</loc>', r.text):
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

    def _discover_with_headless(self, base_domain: str, inventory_pages: List[Tuple[str, bool]], 
                                inventory_keywords: List[str], listing_path_patterns: List[str]) -> set:
        """Retry discovery using headless browser for AJAX-heavy sites.
        Fetches known inventory pages with JavaScript executed and extracts listings."""
        if not _PLAYWRIGHT_AVAILABLE or not inventory_pages:
            return set()
        
        found: set = set()
        parsed_base = urlparse(base_domain)
        skip_re = re.compile(
            r"\.(css|js|jpg|jpeg|png|gif|svg|pdf|xml|ico|woff2?|ttf|map)($|\?)"
            r"|^mailto:|^tel:|javascript:",
            re.IGNORECASE,
        )
        
        try:
            self._init_browser()
            # Note: _init_browser is a no-op; headless fetching is subprocess-based.
            # fetch_page_headless() handles everything — just call it directly.

            # Fetch up to 5 inventory pages with headless browser
            for page_url, _ in inventory_pages[:5]:
                if urlparse(page_url).netloc != parsed_base.netloc:
                    continue
                
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
                    
                    # Check if looks like listing
                    if any(re.search(p, abs_no_query, re.IGNORECASE) for p in listing_path_patterns):
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
            
            logger.info(f"Headless browser discovery found {len(found)} listings")
            
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
        patterns = [
            r"[$â‚¬Â£Â¥]\s*(\d{1,3}(?:[,.\s]\d{3})*(?:[,.]?\d{2})?)",
            r"(\d{1,3}(?:[,.\s]\d{3})*)\s*(?:USD|EUR|GBP)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                cleaned = match.group(1).replace(",", "").replace(".", "").replace(" ", "")
                try:
                    return float(cleaned)
                except ValueError:
                    continue
        return None

    def extract_specs_from_text(self, text: str) -> Dict:
        specs = {}
        length_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')", text, re.IGNORECASE)
        if length_match:
            specs["length_feet"] = float(length_match.group(1))
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
        # Look for content block after a 'Description(s)' heading
        desc_match = re.search(
            r"descriptions?\s*\n(.+?)(?:\n(?:features?|contact|gallery|images?|photos?|"
            r"location|map|specifications?|details|amenities|utilities)\s*\n|\Z)",
            text, re.IGNORECASE | re.DOTALL
        )
        if desc_match:
            desc = desc_match.group(1).strip()
            # Remove very short lines that are just UI labels / navigation
            lines = [l.strip() for l in desc.splitlines() if len(l.strip()) > 20]
            desc = " ".join(lines)
            if len(desc) > 50:
                return desc
        # Fallback: first big paragraph (>100 chars) that isn't a nav/price line
        for para in re.split(r"\n{2,}", text):
            para = para.strip()
            if (len(para) > 100
                    and not re.match(r"^[\$\d]", para)
                    and not re.search(r"(cookie|privacy|copyright|all rights)", para, re.I)):
                return para
        return None

    # ---------------------------------------------------------
    # HTML SPEC TABLE PARSER
    # ---------------------------------------------------------
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

        # 5. Title from <h1>
        h1 = soup.find("h1")
        if h1:
            raw["_h1_title"] = h1.get_text(strip=True)

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

        # Convert numeric fields
        specs: Dict = {}
        int_keys = {"year", "cabins", "berths", "heads", "engine_count"}
        float_keys = {"length_feet", "beam_feet", "draft_feet", "engine_hours",
                      "max_speed_knots", "cruising_speed_knots"}
        str_keys = {"make", "model", "fuel_type", "hull_material", "hull_type",
                    "boat_type", "condition", "city", "state", "country"}

        for k, v in raw.items():
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

    # ---------------------------------------------------------
    # CLEAN HTML
    # ---------------------------------------------------------
    def clean_html(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "iframe"]):
            tag.decompose()
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

    # ---------------------------------------------------------
    # AI EXTRACTION
    # ---------------------------------------------------------
    def scrape_with_ai(self, content: str, url: str, partial_data: Dict = None) -> Dict:
        if not self.client:
            return partial_data or {}
        try:
            if partial_data and len(partial_data) > 5:
                prompt = f"""Fill missing yacht data. Existing: {json.dumps(partial_data)}

URL: {url}
Content: {content[:8000]}

Return ONLY JSON with yacht listing fields. Also include "agent_name" if a listing agent/salesman name is clearly present.
Also extract: features (all notable features/equipment as a multi-line text block, one per line prefixed with "- "), feature_bullets (array of up to 12 short bullet-point strings).
For country: use the ACTUAL country where the vessel is located — only use "USA" if the vessel is in the United States."""
            else:
                prompt = f"""Extract yacht listing data from the text below. Return ONLY a JSON object.
Include: title, make, model, year, price, currency, length_feet, beam_feet, draft_feet,
cabins, berths, heads, engine_count, engine_hours,
fuel_type, max_speed_knots, cruising_speed_knots, hull_material, hull_type,
city, state, country, description, boat_type, agent_name (the listing agent/salesman name if present),
features (all notable features and equipment as a single multi-line text block, one feature per line prefixed with "- "),
feature_bullets (array of up to 12 short bullet-point strings highlighting the best features).

For country: use the ACTUAL country where the vessel is located. Be specific (e.g. "Bermuda", "France", "Bahamas", "Australia"). Only use "USA" if the vessel is genuinely located in the United States.

URL: {url}
Content: {content[:12000]}"""

            message = self.client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            response_text = message.content[0].text
            response_text = re.sub(r"```json\s*|\s*```", "", response_text).strip()
            yacht_data = json.loads(response_text)
            if partial_data:
                yacht_data = {**partial_data, **yacht_data}
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
            logger.warning(f"AI extraction failed for {url}: {e}")
            return partial_data or {}

    # ---------------------------------------------------------
    # IMAGE EXTRACTION
    # ---------------------------------------------------------
    def extract_images(self, html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, "html.parser")
        seen: set = set()
        images: List[str] = []
        skip_re = re.compile(
            r'logo|icon|avatar|banner|/ad|spacer|pixel|tracking|'
            r'x-out|xout|spinner|placeholder|no.image|no_image|'
            r'/ui/|/icons?/|/buttons?/',
            re.IGNORECASE,
        )
        img_ext_re = re.compile(r'\.(jpg|jpeg|png|webp)(\?.*)?$', re.IGNORECASE)

        def _add(url_str: str):
            if not url_str or url_str.startswith('data:'):
                return
            absolute = urljoin(base_url, url_str) if not url_str.startswith('http') else url_str
            if not absolute.startswith('http'):
                return
            if not img_ext_re.search(absolute.split('?')[0]):
                return
            norm = absolute.split('?')[0]
            if norm in seen or skip_re.search(norm):
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
            if src and 'logo' not in alt_text and 'icon' not in alt_text and not src.startswith('data:'):
                _add(src.strip())

        # Priority 4: embedded JS blobs — scan script tags for image URL arrays
        _js_img_re = re.compile(r'["\']((https?://[^"\'\s]+\.(?:jpg|jpeg|png|webp))["\'])', re.IGNORECASE)
        for script in soup.find_all('script'):
            if script.get('type', '').lower() == 'application/ld+json':
                continue
            blob = script.get_text() or ''
            if 'photo' not in blob.lower() and 'image' not in blob.lower() and 'gallery' not in blob.lower():
                continue
            for m in _js_img_re.finditer(blob):
                _add(m.group(1))

        return images[:20]

    # ---------------------------------------------------------
    # SCRAPE A SINGLE LISTING URL â†’ raw data dict
    # ---------------------------------------------------------
    def scrape_single_listing(self, url: str) -> Dict:
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
        price = self.extract_price_from_text(text)
        if price:
            regex_specs["price"] = price

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

        # Call AI whenever title, make/model, OR description are missing
        needs_ai = (not partial.get("title") or not partial.get("make")
                    or not partial.get("model") or not partial.get("description"))
        if needs_ai:
            yacht_data = self.scrape_with_ai(text, url, partial)
        else:
            yacht_data = partial

        # Title fallback: use the HTML <title> tag if AI didn't return one
        if not yacht_data.get("title"):
            soup_title = BeautifulSoup(html, "html.parser").find("title")
            if soup_title:
                raw_title = soup_title.get_text(strip=True)
                for sep in [" - ", " | ", " — ", " :: "]:
                    if sep in raw_title:
                        raw_title = raw_title.split(sep)[0].strip()
                        break
                if len(raw_title) > 3:
                    yacht_data["title"] = raw_title

        # Description fallback: if AI still didn't return one, use deterministic extract
        if not yacht_data.get("description") and partial.get("description"):
            yacht_data["description"] = partial["description"]

        images = self.extract_images(html, url)
        # Prepend WP REST images — more reliable on JS-rendered / CF-blocked pages
        if _wp_images:
            _seen_norms = {u.split('?')[0] for u in images}
            for _wu in _wp_images:
                if _wu.split('?')[0] not in _seen_norms:
                    images.insert(0, _wu)
                    _seen_norms.add(_wu.split('?')[0])
        images = images[:20]
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

    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        return {"error": f"Job {job_id} not found"}

    job.status = "running"
    job.started_at = datetime.utcnow()
    job.last_error = None
    db.commit()

    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
    scraper = OptimizedYachtScraper(api_key=api_key)

    stats = {"found": 0, "created": 0, "updated": 0, "archived": 0, "errors": 0}

    try:
        # -- Step 1: discover listing URLs --
        logger.info(f"[Job {job_id}] Discovering listings at {job.broker_url}")
        discovered_urls = scraper.find_listing_urls(job.broker_url)
        stats["found"] = len(discovered_urls)
        logger.info(f"[Job {job_id}] Found {len(discovered_urls)} listing URLs")

        discovered_url_set = set(discovered_urls)

        # -- Step 2: scrape each URL and upsert --
        for url in discovered_urls:
            try:
                existing_scraped = (
                    db.query(ScrapedListing)
                    .filter(ScrapedListing.job_id == job_id, ScrapedListing.source_url == url)
                    .first()
                )

                raw = scraper.scrape_single_listing(url)
                if "error" in raw:
                    stats["errors"] += 1
                    continue

                # Try to match the detected agent name against the dealer's salespeople
                detected_name = raw.get("detected_agent_name")
                matched_salesman_id = job.salesman_id  # default to job-level assignment
                if detected_name and not job.salesman_id:
                    detected_lower = detected_name.lower()
                    salespeople = (
                        db.query(User)
                        .filter(
                            User.parent_dealer_id == job.dealer_id,
                            User.user_type == "salesman",
                            User.active == True,
                        )
                        .all()
                    )
                    for sp in salespeople:
                        full_name = f"{sp.first_name or ''} {sp.last_name or ''}".strip().lower()
                        if full_name and (full_name in detected_lower or detected_lower in full_name):
                            matched_salesman_id = sp.id
                            break

                if existing_scraped and existing_scraped.listing_id:
                    # Update existing listing
                    listing = db.query(Listing).filter(Listing.id == existing_scraped.listing_id).first()
                    if listing:
                        _apply_scraped_data(listing, raw, job)
                        # Respect manual broker changes: only restore to active if the scraper
                        # previously auto-archived it (disappeared from site), not if the broker
                        # intentionally set it to "draft" to hide it.
                        if listing.status not in ("draft", "awaiting_review"):
                            listing.status = "active"
                        existing_scraped.last_seen = datetime.utcnow()
                        existing_scraped.still_active = True
                        stats["updated"] += 1
                else:
                    # Create new listing — placed in awaiting_review so admin can review before publishing
                    listing = Listing(
                        user_id=job.dealer_id,
                        created_by_user_id=job.created_by_id or job.dealer_id,
                        assigned_salesman_id=matched_salesman_id,
                        source="scraped",
                        source_url=url,
                        status="awaiting_review",
                        bin=_generate_bin(db),
                        condition="used",
                    )
                    _apply_scraped_data(listing, raw, job)
                    db.add(listing)
                    db.flush()  # get listing.id

                    # Create images
                    for img_url in raw.get("images", [])[:10]:
                        db.add(ListingImage(listing_id=listing.id, url=img_url))

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

            except Exception as e:
                logger.error(f"[Job {job_id}] Error processing {url}: {e}")
                stats["errors"] += 1

        # -- Step 3: archive listings that disappeared --
        previously_active = (
            db.query(ScrapedListing)
            .filter(ScrapedListing.job_id == job_id, ScrapedListing.still_active == True)
            .all()
        )
        for scraped_record in previously_active:
            if scraped_record.source_url not in discovered_url_set:
                scraped_record.still_active = False
                if scraped_record.listing_id:
                    listing = db.query(Listing).filter(Listing.id == scraped_record.listing_id).first()
                    if listing and listing.status == "active":
                        listing.status = "archived"
                        stats["archived"] += 1
                        logger.info(f"[Job {job_id}] Archived listing #{listing.id} â€” no longer on broker site")

        # -- Step 4: update job record --
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.last_run_at = datetime.utcnow()
        job.listings_found = stats["found"]
        job.listings_created = stats["created"]
        job.listings_updated = stats["updated"]
        job.listings_removed = stats["archived"]
        job.total_runs = (job.total_runs or 0) + 1
        job.next_run_at = datetime.utcnow() + timedelta(hours=int(job.schedule_hours or 24))
        db.commit()

        logger.info(f"[Job {job_id}] Sync complete: {stats}")
        return {"success": True, "job_id": job_id, **stats}

    except Exception as e:
        job.status = "failed"
        job.last_error = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()
        logger.error(f"[Job {job_id}] Job failed: {e}")
        return {"success": False, "error": str(e)}


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
            setattr(listing, f, str(raw[f])[:500] if isinstance(raw[f], str) else str(raw[f]))
    for f in text_fields:
        if raw.get(f):
            setattr(listing, f, str(raw[f]))
    # Store feature_bullets as JSON array if provided
    if raw.get("feature_bullets") and isinstance(raw["feature_bullets"], list):
        listing.feature_bullets = raw["feature_bullets"]
    for f in float_fields:
        if raw.get(f) is not None:
            try:
                setattr(listing, f, float(raw[f]))
            except (ValueError, TypeError):
                pass
    for f in int_fields:
        if raw.get(f) is not None:
            try:
                setattr(listing, f, int(raw[f]))
            except (ValueError, TypeError):
                pass

    # Normalize and infer location fields
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

    # Always keep dealer / salesman linkage
    listing.user_id = job.dealer_id
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
def run_due_scraper_jobs(db) -> int:
    """Find all enabled jobs that are due and run them. Returns count of jobs triggered."""
    now = datetime.utcnow()
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
# LEGACY ASYNC SYNC CHECK (kept for backward compatibility)
# ---------------------------------------------------------
async def optimized_sync_check(db):
    listings = (
        db.query(Listing)
        .filter(Listing.source == "scraped", Listing.status == "active", Listing.source_url.isnot(None))
        .all()
    )
    logger.info(f"Legacy sync check: checking {len(listings)} listings...")
    archived = 0
    scraper = OptimizedYachtScraper()
    for listing in listings:
        is_live, reason = scraper.check_listing_still_live(listing.source_url)
        if not is_live:
            listing.status = "archived"
            archived += 1
        await asyncio.sleep(0.5)
    db.commit()
    logger.info(f"Legacy sync check: archived {archived} listings.")
