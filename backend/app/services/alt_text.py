"""
Shared alt-text generation for listing/charter photos.

Every image-creation path (manual upload, admin scrape-review, automated
feed sync, the media library attach flow) must end up with non-empty
alt_text — scraped source sites and manual uploads rarely provide anything
usable. generate_*_image_alt_text() is the single source of truth so a
photo's alt text is always derived the same way regardless of which path
created it; backfill_missing_alt_text() is the weekly safety net for
anything that slips through.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.listing import Listing, ListingImage
from app.models.charter import CharterListing
from app.models.media import MediaFile, ListingMediaAttachment


def _descriptor(year, make, model, fallback_name: Optional[str]) -> str:
    parts = " ".join(str(part) for part in (year, make, model) if part)
    return parts or fallback_name or "Yacht"


def listing_descriptor(listing: Listing) -> str:
    return _descriptor(listing.year, listing.make, listing.model, listing.title)


def charter_descriptor(charter: CharterListing) -> str:
    return _descriptor(charter.year, charter.make, charter.model, charter.vessel_name or charter.title)


def generate_listing_image_alt_text(listing: Listing, photo_position: int) -> str:
    return f"{listing_descriptor(listing)} for sale — photo {photo_position + 1}"


def generate_charter_image_alt_text(charter: CharterListing, photo_position: int) -> str:
    return f"{charter_descriptor(charter)} charter — photo {photo_position + 1}"


def _missing(value: Optional[str]) -> bool:
    return not value or not value.strip()


def backfill_missing_alt_text(db: Session) -> int:
    """Find every ListingImage/MediaFile attached to a listing or charter
    that's missing alt text and generate it from the owning listing/
    charter's own descriptor fields. Returns the number of images fixed."""
    fixed = 0

    # Legacy ListingImage rows (for-sale, scraped or manual).
    missing_listing_images = (
        db.query(ListingImage)
        .filter((ListingImage.alt_text.is_(None)) | (ListingImage.alt_text == ""))
        .all()
    )
    listings_cache: dict[int, Optional[Listing]] = {}
    for img in missing_listing_images:
        listing = listings_cache.get(img.listing_id)
        if listing is None and img.listing_id not in listings_cache:
            listing = db.query(Listing).filter(Listing.id == img.listing_id).first()
            listings_cache[img.listing_id] = listing
        if not listing:
            continue
        img.alt_text = generate_listing_image_alt_text(listing, img.display_order or 0)
        fixed += 1

    # MediaFile rows attached to for-sale listings via the shared media library.
    missing_listing_attachments = (
        db.query(ListingMediaAttachment, MediaFile)
        .join(MediaFile, ListingMediaAttachment.media_id == MediaFile.id)
        .filter(
            ListingMediaAttachment.listing_id.isnot(None),
            MediaFile.file_type == "image",
            (MediaFile.alt_text.is_(None)) | (MediaFile.alt_text == ""),
        )
        .all()
    )
    for attachment, mf in missing_listing_attachments:
        listing = listings_cache.get(attachment.listing_id)
        if listing is None and attachment.listing_id not in listings_cache:
            listing = db.query(Listing).filter(Listing.id == attachment.listing_id).first()
            listings_cache[attachment.listing_id] = listing
        if not listing:
            continue
        mf.alt_text = generate_listing_image_alt_text(listing, attachment.display_order or 0)
        fixed += 1

    # MediaFile rows attached to charter listings via the shared media library.
    missing_charter_attachments = (
        db.query(ListingMediaAttachment, MediaFile)
        .join(MediaFile, ListingMediaAttachment.media_id == MediaFile.id)
        .filter(
            ListingMediaAttachment.charter_listing_id.isnot(None),
            MediaFile.file_type == "image",
            (MediaFile.alt_text.is_(None)) | (MediaFile.alt_text == ""),
        )
        .all()
    )
    charters_cache: dict[int, Optional[CharterListing]] = {}
    for attachment, mf in missing_charter_attachments:
        charter = charters_cache.get(attachment.charter_listing_id)
        if charter is None and attachment.charter_listing_id not in charters_cache:
            charter = db.query(CharterListing).filter(CharterListing.id == attachment.charter_listing_id).first()
            charters_cache[attachment.charter_listing_id] = charter
        if not charter:
            continue
        mf.alt_text = generate_charter_image_alt_text(charter, attachment.display_order or 0)
        fixed += 1

    if fixed:
        db.commit()
    return fixed
