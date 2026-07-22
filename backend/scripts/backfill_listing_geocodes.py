"""
One-off backfill: geocode existing listings that have a city/state/country
but no latitude/longitude yet (i.e. every listing created before geocoding
was wired up). New listings are geocoded automatically going forward
(routes_listings.py, scraper.py's _apply_scraped_data, bulk CSV import) --
this script only needs to be run once per environment to catch up existing
rows.

Usage:
    cd backend && venv/Scripts/python.exe scripts/backfill_listing_geocodes.py [--dry-run]

Requires GOOGLE_MAPS_API_KEY to be set in the environment. Rate-limited to
stay well under Google's default Geocoding API quota.
"""
import os
import sys
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: F401  (registers all SQLAlchemy models)
from app.db.session import SessionLocal
from app.models.listing import Listing
from app.services.geocoding import geocode_location

_REQUEST_DELAY_SECONDS = 0.15  # ~6 req/s, well under Google's default limits


def backfill(dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        listings = (
            db.query(Listing)
            .filter(
                Listing.latitude.is_(None),
                Listing.deleted_at.is_(None),
                (Listing.city.isnot(None)) | (Listing.state.isnot(None)) | (Listing.country.isnot(None)),
            )
            .all()
        )
        print(f"Found {len(listings)} listing(s) with a location but no coordinates.")

        geocoded, skipped = 0, 0
        for listing in listings:
            lat, lng = geocode_location(listing.city, listing.state, listing.country, listing.zip_code)
            if lat is None or lng is None:
                skipped += 1
                print(f"  #{listing.id}: no match for "
                      f"{listing.city!r}, {listing.state!r}, {listing.country!r} — skipped")
                time.sleep(_REQUEST_DELAY_SECONDS)
                continue

            geocoded += 1
            print(f"  #{listing.id}: {listing.city!r}, {listing.state!r}, {listing.country!r} -> ({lat}, {lng})")
            if not dry_run:
                listing.latitude = lat
                listing.longitude = lng

            time.sleep(_REQUEST_DELAY_SECONDS)

        if dry_run:
            print(f"\nDry run: would geocode {geocoded}, skip {skipped}. No changes written.")
        else:
            db.commit()
            print(f"\nDone: geocoded {geocoded}, skipped {skipped} (no match).")
    finally:
        db.close()


if __name__ == "__main__":
    if not os.getenv("GOOGLE_MAPS_API_KEY"):
        print("GOOGLE_MAPS_API_KEY is not set — nothing to do.")
        sys.exit(1)
    backfill(dry_run="--dry-run" in sys.argv)
