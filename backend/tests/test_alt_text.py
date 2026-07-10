"""
Alt text must always be present on listing/charter photos regardless of
which path created them. Covers: the shared generator, the weekly backfill
audit, charter creation converting scraped flat images into MediaFile rows
with alt text, and attach-time backfill for media-library uploads that had
no listing context when uploaded.
"""
import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.security.auth import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.user import User
from app.models.media import MediaFile, ListingMediaAttachment
from app.models.charter import CharterListing
from app.models.listing import Listing, ListingImage
from app.services.alt_text import (
    generate_listing_image_alt_text,
    generate_charter_image_alt_text,
    backfill_missing_alt_text,
)


def _unique_email() -> str:
    return f"pytest-alt-{uuid.uuid4().hex[:10]}@example.com"


def _make_user(email: str, user_type: str = "dealer") -> tuple[int, str]:
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=get_password_hash("TestPass123"),
            first_name="Test",
            last_name="Broker",
            user_type=user_type,
            company_name="Pytest Brokerage",
            subscription_tier="free",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(
            data={"sub": user.email},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return user.id, token
    finally:
        db.close()


@pytest.fixture(scope="module")
def dealer():
    email = _unique_email()
    user_id, token = _make_user(email)
    state = {"email": email, "user_id": user_id, "client": TestClient(app), "headers": {"Authorization": f"Bearer {token}"}}
    state["charter_ids"] = []
    state["listing_ids"] = []
    state["media_ids"] = []
    yield state

    db = SessionLocal()
    try:
        # Attachments must go before their MediaFile (NOT NULL FK) and before
        # the charter/listing they belong to.
        db.query(ListingMediaAttachment).filter(
            ListingMediaAttachment.media_id.in_(state["media_ids"]) if state["media_ids"] else False
        ).delete(synchronize_session=False)
        db.commit()
        for cid in state["charter_ids"]:
            c = db.query(CharterListing).filter(CharterListing.id == cid).first()
            if c:
                db.delete(c)
        db.commit()
        for lid in state["listing_ids"]:
            l = db.query(Listing).filter(Listing.id == lid).first()
            if l:
                db.delete(l)
        db.commit()
        for mid in state["media_ids"]:
            m = db.query(MediaFile).filter(MediaFile.id == mid).first()
            if m:
                db.delete(m)
        db.commit()
        u = db.query(User).filter(User.email == email).first()
        if u:
            db.delete(u)
        db.commit()
    finally:
        db.close()


def test_generate_charter_image_alt_text_uses_year_make_model_and_position():
    charter = CharterListing(year=2021, make="Lagoon", model="52", vessel_name="Serenity Now", title="Charter listing")
    assert generate_charter_image_alt_text(charter, 0) == "2021 Lagoon 52 charter — photo 1"
    assert generate_charter_image_alt_text(charter, 2) == "2021 Lagoon 52 charter — photo 3"


def test_generate_charter_image_alt_text_falls_back_to_vessel_name():
    charter = CharterListing(vessel_name="Mystery Yacht", title="fallback title")
    assert generate_charter_image_alt_text(charter, 0) == "Mystery Yacht charter — photo 1"


def test_create_charter_with_scraped_images_gets_alt_text(dealer, monkeypatch):
    # _rehost_image does a real network fetch — stub it to just echo the URL
    # back so this test doesn't depend on external hosts being reachable.
    def _fake_rehost(url):
        return url

    monkeypatch.setattr(
        "app.services.scraper._rehost_image", _fake_rehost, raising=False
    )

    payload = {
        "title": "Pytest Scraped Charter",
        "vessel_name": "Pytest Vessel",
        "year": 2020,
        "make": "Sea Ray",
        "model": "Sundancer",
        "images": [
            "https://example.com/photo1.jpg",
            "https://example.com/photo2.jpg",
        ],
    }
    res = dealer["client"].post("/api/charter", json=payload, headers=dealer["headers"])
    assert res.status_code == 200, res.text
    charter_id = res.json()["id"]
    dealer["charter_ids"].append(charter_id)

    db = SessionLocal()
    try:
        attachments = (
            db.query(ListingMediaAttachment, MediaFile)
            .join(MediaFile, ListingMediaAttachment.media_id == MediaFile.id)
            .filter(ListingMediaAttachment.charter_listing_id == charter_id)
            .order_by(ListingMediaAttachment.display_order)
            .all()
        )
        assert len(attachments) == 2
        for _, mf in attachments:
            dealer["media_ids"].append(mf.id)
        assert attachments[0][1].alt_text == "2020 Sea Ray Sundancer charter — photo 1"
        assert attachments[1][1].alt_text == "2020 Sea Ray Sundancer charter — photo 2"

        charter = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
        assert charter.images in (None, [])
    finally:
        db.close()


def test_attach_charter_media_backfills_missing_alt_text(dealer):
    db = SessionLocal()
    try:
        media = MediaFile(
            user_id=dealer["user_id"],
            filename="no-alt-text.jpg",
            url="https://example.com/no-alt-text.jpg",
            file_type="image",
            file_size_mb=0.1,
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        media_id = media.id
    finally:
        db.close()
    dealer["media_ids"].append(media_id)

    charter_res = dealer["client"].post(
        "/api/charter",
        json={"title": "Pytest Attach Charter", "vessel_name": "Pytest Vessel 2"},
        headers=dealer["headers"],
    )
    assert charter_res.status_code == 200, charter_res.text
    charter_id = charter_res.json()["id"]
    dealer["charter_ids"].append(charter_id)

    res = dealer["client"].post(
        f"/api/charter/{charter_id}/media/attach",
        json={"media_ids": [media_id]},
        headers=dealer["headers"],
    )
    assert res.status_code == 200, res.text
    assert res.json()["attached"] == 1

    db = SessionLocal()
    try:
        mf = db.query(MediaFile).filter(MediaFile.id == media_id).first()
        assert mf.alt_text, "expected alt text to be backfilled on attach"
        assert "charter" in mf.alt_text
    finally:
        db.close()


def test_backfill_missing_alt_text_fixes_listing_images(dealer):
    db = SessionLocal()
    try:
        listing = Listing(
            user_id=dealer["user_id"],
            title="Pytest Backfill Listing",
            year=2018,
            make="Boston Whaler",
            model="320",
            bin=uuid.uuid4().hex[:12].upper(),
            status="draft",
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        listing_id = listing.id

        img = ListingImage(listing_id=listing_id, url="https://example.com/x.jpg", display_order=0)
        db.add(img)
        db.commit()
        db.refresh(img)
        img_id = img.id
    finally:
        db.close()
    dealer["listing_ids"].append(listing_id)

    db = SessionLocal()
    try:
        fixed = backfill_missing_alt_text(db)
        assert fixed >= 1
        refreshed = db.query(ListingImage).filter(ListingImage.id == img_id).first()
        assert refreshed.alt_text == "2018 Boston Whaler 320 for sale — photo 1"
    finally:
        db.close()
