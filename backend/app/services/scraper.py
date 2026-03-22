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

from app.models.listing import Listing, ListingImage
from app.models.misc import ScraperJob, ScrapedListing
from app.db.session import get_db

logger = logging.getLogger(__name__)


class OptimizedYachtScraper:
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
                "Chrome/120.0 Safari/537.36"
            )
        }

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

    # ---------------------------------------------------------
    # BASIC FETCHING
    # ---------------------------------------------------------
    def fetch_page(self, url: str, timeout: int = 10) -> Optional[str]:
        try:
            response = requests.get(url, headers=self.headers, timeout=timeout)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.warning(f"fetch_page failed for {url}: {e}")
            return None

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
        ]

        # Keywords in a path that suggest an inventory index page worth crawling deeper
        inventory_keywords = [
            "/inventory", "/listings", "/boats", "/yachts", "/search", "/page",
            "/fleet", "/available", "/for-sale", "/vessels", "/buy",
            "/powerboats", "/sailboats", "/catamarans", "/motor-yachts",
            "/our-boats", "/our-yachts", "/center-console", "/express-cruiser",
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

            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if skip_re.search(href):
                    continue

                absolute = urljoin(base_domain, href) if not href.startswith("http") else href
                abs_clean = absolute.split("#")[0].split("?")[0]

                if urlparse(abs_clean).netloc != parsed_base.netloc:
                    continue
                if abs_clean in visited_pages:
                    continue

                path = urlparse(abs_clean).path

                if looks_like_listing(abs_clean):
                    listing_urls.add(abs_clean)
                    found_listing_link = True
                elif abs_clean not in ever_queued:
                    if is_inventory_page(path.lower()):
                        queue.append((abs_clean, False))
                        ever_queued.add(abs_clean)
                    elif from_start and not self._NON_LISTING_PATHS.search(path):
                        # On the homepage, follow ALL internal sub-page links that aren't
                        # obviously non-listing pages (contact/about/etc).
                        # This handles sites where listings are at non-standard URL shapes.
                        queue.append((abs_clean, False))
                        ever_queued.add(abs_clean)

            # Content-sniff fallback: if we visited a page that was linked from the
            # homepage and it has no conventional listing sub-links, check if the page
            # itself looks like a single vessel detail page (small brokers often do this).
            if not from_start and not found_listing_link and clean_url != site_url:
                text = self.clean_html(html)
                if self._looks_like_single_listing(text, self.extract_price_from_text):
                    listing_urls.add(clean_url)

        return list(listing_urls)

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
            return yacht_data
        except Exception as e:
            logger.warning(f"AI extraction failed for {url}: {e}")
            return partial_data or {}

    # ---------------------------------------------------------
    # IMAGE EXTRACTION
    # ---------------------------------------------------------
    def extract_images(self, html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, "html.parser")
        images = []
        skip_keywords = ["logo", "icon", "avatar", "banner", "/ad", "spacer", "pixel", "tracking"]
        for img in soup.find_all("img"):
            src = (
                img.get("src") or img.get("data-src") or img.get("data-lazy-src")
                or img.get("data-original") or img.get("data-image") or img.get("data-full")
            )
            if not src and img.get("srcset"):
                candidates = [s.strip().split()[0] for s in img["srcset"].split(",") if s.strip()]
                src = candidates[-1] if candidates else None
            alt_text = (img.get("alt") or "").lower()
            if src and not any(kw in src.lower() for kw in skip_keywords) and not any(kw in alt_text for kw in skip_keywords):
                absolute = urljoin(base_url, src)
                if absolute.startswith("http") and any(
                    absolute.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]
                ):
                    images.append(absolute)
        return list(dict.fromkeys(images))[:15]

    # ---------------------------------------------------------
    # SCRAPE A SINGLE LISTING URL â†’ raw data dict
    # ---------------------------------------------------------
    def scrape_single_listing(self, url: str) -> Dict:
        html = self.fetch_page(url)
        if not html:
            return {"error": "Failed to load page"}

        structured = self.try_structured_extraction(html, url)
        # Parse spec tables + Elementor divs + map location from raw HTML
        html_specs = self.parse_spec_tables(html)
        text = self.clean_html(html)
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

                if existing_scraped and existing_scraped.listing_id:
                    # Update existing listing
                    listing = db.query(Listing).filter(Listing.id == existing_scraped.listing_id).first()
                    if listing:
                        _apply_scraped_data(listing, raw, job)
                        # Respect manual broker changes: only restore to active if the scraper
                        # previously auto-archived it (disappeared from site), not if the broker
                        # intentionally set it to "draft" to hide it.
                        if listing.status != "draft":
                            listing.status = "active"
                        existing_scraped.last_seen = datetime.utcnow()
                        existing_scraped.still_active = True
                        stats["updated"] += 1
                else:
                    # Create new listing — start as draft so broker can review before publishing
                    listing = Listing(
                        user_id=job.dealer_id,
                        created_by_user_id=job.created_by_id or job.dealer_id,
                        assigned_salesman_id=job.salesman_id,
                        source="scraped",
                        source_url=url,
                        status="draft",
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
                  "hull_material", "hull_type", "fuel_type", "city", "state", "country",
                  "currency"]
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

    # Always keep dealer / salesman linkage
    listing.user_id = job.dealer_id
    if job.salesman_id:
        listing.assigned_salesman_id = job.salesman_id


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
