"""
Optimized Yacht Scraper - Hybrid AI + Traditional Extraction
- Uses AI only when necessary
- Structured extraction first (CSS selectors, regex)
- AI fallback only for missing critical fields
"""

import anthropic
import requests
from bs4 import BeautifulSoup
import json
import re
from typing import Optional, Dict, List, Tuple
from urllib.parse import urljoin, urlparse
import asyncio
from datetime import datetime

from app.models.listing import Listing
from app.db.session import get_db


class OptimizedYachtScraper:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0 Safari/537.36"
            )
        }

        # Known site patterns
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
    def fetch_page(self, url: str) -> Optional[str]:
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.text
        except Exception:
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
                    "sold",
                    "no longer available",
                    "listing removed",
                    "expired listing",
                    "unavailable",
                    "off market",
                    "pending sale",
                    "under contract",
                ]

                for pattern in sold_patterns:
                    if pattern in html_lower:
                        return False, f"Marked as: {pattern}"

                if "price" not in html_lower and "yacht" not in html_lower:
                    return False, "Listing content missing"

                return True, "Active"

            return False, f"Unexpected status {response.status_code}"

        except Exception as e:
            return False, f"Error: {str(e)}"

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
            r"[$€£¥]\s*(\d{1,3}(?:[,.\s]\d{3})*(?:[,.]?\d{2})?)",
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
    # AI EXTRACTION
    # ---------------------------------------------------------
    def scrape_with_ai(self, content: str, url: str, partial_data: Dict = None) -> Dict:
        try:
            if partial_data and len(partial_data) > 5:
                prompt = f"""Fill missing yacht data. Existing: {json.dumps(partial_data)}

URL: {url}
Content: {content[:8000]}

Return ONLY JSON."""
            else:
                prompt = f"""Extract yacht listing data. Return ONLY JSON.

URL: {url}
Content: {content[:12000]}
"""

            message = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = message.content[0].text
            response_text = re.sub(r"```json\s*|\s*```", "", response_text).strip()

            yacht_data = json.loads(response_text)

            if partial_data:
                yacht_data = {**partial_data, **yacht_data}

            return yacht_data

        except Exception:
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
    # MAIN SCRAPER
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
        needs_ai = not any(field in partial for field in critical)

        if needs_ai:
            yacht_data = self.scrape_with_ai(text, url, partial)
        else:
            yacht_data = partial

        images = self.extract_images(html, url)

        yacht_data.update(
            {
                "source_url": url,
                "source": "scraped",
                "images": images,
                "scraped_at": datetime.utcnow().isoformat(),
            }
        )

        return yacht_data


# ---------------------------------------------------------
# ASYNC SYNC CHECK (NO AI)
# ---------------------------------------------------------
async def optimized_sync_check(db):
    listings = (
        db.query(Listing)
        .filter(Listing.source == "scraped", Listing.status == "active", Listing.source_url.isnot(None))
        .all()
    )

    print(f"Checking {len(listings)} listings...")

    archived = 0
    scraper = OptimizedYachtScraper(api_key="")

    for listing in listings:
        is_live, reason = scraper.check_listing_still_live(listing.source_url)

        if not is_live:
            listing.status = "archived"
            archived += 1
            print(f"Archived #{listing.id}: {reason}")

        await asyncio.sleep(0.5)

    db.commit()
    print(f"Archived {archived} listings.")
