"""
Scraped listing image alt_text smoke test. Hits the real app + dev database
(matching the pattern in test_listings_ownership.py) — creates a throwaway
user/listing/image and cleans them up afterward.
"""
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.listing import Listing, ListingImage
from app.services.scraper import _generate_image_alt_text


def _unique_email() -> str:
    return f"pytest-alt-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def cleanup():
    emails = []
    listing_ids = []
    yield {"emails": emails, "listing_ids": listing_ids}
    db = SessionLocal()
    try:
        for listing_id in listing_ids:
            listing = db.query(Listing).filter(Listing.id == listing_id).first()
            if listing:
                db.delete(listing)
        db.commit()
        for email in emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.delete(user)
        db.commit()
    finally:
        db.close()


def test_generate_image_alt_text_uses_year_make_model_and_position():
    listing = Listing(year=2019, make="Sea Ray", model="Sundancer 320", title="Fallback Title")
    assert _generate_image_alt_text(listing, 0) == "2019 Sea Ray Sundancer 320 for sale — photo 1"
    assert _generate_image_alt_text(listing, 4) == "2019 Sea Ray Sundancer 320 for sale — photo 5"


def test_generate_image_alt_text_falls_back_to_title_when_fields_missing():
    listing = Listing(title="Mystery Yacht")
    assert _generate_image_alt_text(listing, 0) == "Mystery Yacht for sale — photo 1"


def test_media_endpoint_returns_stored_alt_text(client, cleanup):
    email = _unique_email()
    cleanup["emails"].append(email)
    reg_res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123",
            "first_name": "Test",
            "last_name": "User",
            "user_type": "user",
            "agree_terms": True,
            "agree_communications": True,
        },
    )
    assert reg_res.status_code == 200

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        listing = Listing(
            user_id=user.id,
            created_by_user_id=user.id,
            title="Pytest Alt Text Listing",
            bin=uuid.uuid4().hex[:12].upper(),
            status="active",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        listing_id = listing.id
        cleanup["listing_ids"].append(listing_id)

        db.add(ListingImage(
            listing_id=listing_id,
            url="https://example.com/photo.jpg",
            display_order=0,
            alt_text=_generate_image_alt_text(listing, 0),
        ))
        db.commit()
    finally:
        db.close()

    res = client.get(f"/api/listings/{listing_id}/media")
    assert res.status_code == 200
    media = res.json()["media"]
    assert len(media) == 1
    assert media[0]["alt_text"] == "Pytest Alt Text Listing for sale — photo 1"
