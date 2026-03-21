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
    # INVENTORY DISCOVERY â€” find all listing URLs on a broker site
    # ---------------------------------------------------------
    def find_listing_urls(self, site_url: str, max_pages: int = 20) -> List[str]:
        """
        Crawl a broker's inventory/listings page (and paginated pages)
        and return a de-duped list of individual listing URLs.
        """
        parsed_base = urlparse(site_url)
        base_domain = f"{parsed_base.scheme}://{parsed_base.netloc}"

        visited_pages: set = set()
        listing_urls: set = set()
        queue = [site_url]

        # Patterns likely to indicate a single-listing detail page (not inventory index)
        listing_path_patterns = [
            r"/listing[s]?/",
            r"/boat[s]?/",
            r"/yacht[s]?/",
            r"/vessel[s]?/",
            r"/sale[s]?/",
            r"/inventory/[^/]+/?$",
            r"/\d{4,}/",          # numeric IDs
            r"-for-sale",
        ]

        # Patterns to skip (pagination, anchors, external, assets)
        skip_patterns = [
            r"\.(css|js|jpg|jpeg|png|gif|svg|pdf|xml|ico)($|\?)",
            r"^mailto:", r"^tel:", r"javascript:",
        ]

        def looks_like_listing(href: str) -> bool:
            for p in listing_path_patterns:
                if re.search(p, href, re.IGNORECASE):
                    return True
            return False

        def should_skip(href: str) -> bool:
            for p in skip_patterns:
                if re.search(p, href, re.IGNORECASE):
                    return True
            return False

        pages_crawled = 0
        while queue and pages_crawled < max_pages:
            page_url = queue.pop(0)
            if page_url in visited_pages:
                continue
            visited_pages.add(page_url)
            pages_crawled += 1

            html = self.fetch_page(page_url)
            if not html:
                continue

            soup = BeautifulSoup(html, "html.parser")

            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if should_skip(href):
                    continue

                absolute = urljoin(base_domain, href) if not href.startswith("http") else href

                # Only follow links on the same domain
                if urlparse(absolute).netloc != parsed_base.netloc:
                    continue

                if looks_like_listing(absolute):
                    listing_urls.add(absolute.split("#")[0].split("?")[0])
                elif absolute not in visited_pages and absolute not in queue:
                    # Follow inventory/search/paginated pages
                    path = urlparse(absolute).path.lower()
                    if any(kw in path for kw in ["/inventory", "/listings", "/boats", "/yachts", "/search", "/page", "/fleet"]):
                        queue.append(absolute)

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
        year_match = re.search(r"(19\d{2}|20\d{2})", text)
        if year_match:
            specs["year"] = int(year_match.group(1))
        cabin_match = re.search(r"(\d+)\s*[-\s]*cabin", text, re.IGNORECASE)
        if cabin_match:
            specs["cabins"] = int(cabin_match.group(1))
        if re.search(r"twin\s+engine", text, re.IGNORECASE):
            specs["engine_count"] = 2
        elif re.search(r"triple\s+engine", text, re.IGNORECASE):
            specs["engine_count"] = 3
        elif re.search(r"single\s+engine", text, re.IGNORECASE):
            specs["engine_count"] = 1
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

Return ONLY JSON with yacht listing fields. Also include "agent_name" if a listing agent/salesman name is clearly present."""
            else:
                prompt = f"""Extract yacht listing data from the text below. Return ONLY a JSON object.
Include: title, make, model, year, price, currency, length_feet, beam_feet, draft_feet,
cabins, berths, heads, engine_count, engine_hours,
fuel_type, max_speed_knots, cruising_speed_knots, hull_material, hull_type,
city, state, country, description, boat_type, agent_name (the listing agent/salesman name if present).

URL: {url}
Content: {content[:12000]}"""

            message = self.client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=2000,
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
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if src and not any(skip in src.lower() for skip in ["logo", "icon", "avatar", "banner", "ad"]):
                absolute = urljoin(base_url, src)
                if absolute.startswith("http"):
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
        text = self.clean_html(html)
        regex_specs = self.extract_specs_from_text(text)
        price = self.extract_price_from_text(text)
        if price:
            regex_specs["price"] = price

        partial = {**(structured or {}), **regex_specs}
        critical = ["title", "make", "model", "price"]
        if not any(field in partial for field in critical):
            yacht_data = self.scrape_with_ai(text, url, partial)
        else:
            yacht_data = partial

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
                    # Create new listing
                    listing = Listing(
                        user_id=job.dealer_id,
                        created_by_user_id=job.created_by_id or job.dealer_id,
                        assigned_salesman_id=job.salesman_id,
                        source="scraped",
                        source_url=url,
                        status="active",
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
        job.next_run_at = datetime.utcnow() + timedelta(hours=job.schedule_hours or 24)
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
    str_fields = ["title", "make", "model", "description", "boat_type",
                  "hull_material", "hull_type", "fuel_type", "city", "state", "country",
                  "currency"]
    float_fields = ["price", "length_feet", "beam_feet", "draft_feet",
                    "max_speed_knots", "cruising_speed_knots",
                    "fuel_capacity_gallons", "water_capacity_gallons",
                    "engine_hours"]
    int_fields = ["year", "cabins", "berths", "heads", "engine_count"]

    for f in str_fields:
        if raw.get(f):
            setattr(listing, f, str(raw[f])[:500] if isinstance(raw[f], str) else str(raw[f]))
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
