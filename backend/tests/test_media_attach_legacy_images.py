"""
POST /listings/{id}/media/attach — regression test for a bug where the
listing-edit form sent legacy ListingImage.id values (a different ID space
than MediaFile.id) to this endpoint on every save. The endpoint always
deleted legacy ListingImage rows unconditionally before checking whether the
given IDs resolved to anything, so a scraped listing's photos were wiped on
the very first field edit, with no replacement ever attached.
"""
import io
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.core.config import settings
from app.security.auth import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.user import User
from app.models.listing import Listing, ListingImage
from app.models.media import MediaFile, ListingMediaAttachment


def _unique_email() -> str:
    return f"pytest-attach-{uuid.uuid4().hex[:10]}@example.com"


def _png_bytes(size=(40, 30), color=(255, 0, 0)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def dealer_with_scraped_listing():
    email = _unique_email()
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=get_password_hash("TestPass123"),
            first_name="Test",
            last_name="Broker",
            user_type="dealer",
            subscription_tier="free",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(
            data={"sub": user.email},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        listing = Listing(
            user_id=user.id,
            created_by_user_id=user.id,
            title="Scraped Test Listing",
            bin=uuid.uuid4().hex[:12].upper(),
            status="active",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)

        img1 = ListingImage(listing_id=listing.id, url="https://dealer.example/1.jpg", is_primary=True, display_order=0)
        img2 = ListingImage(listing_id=listing.id, url="https://dealer.example/2.jpg", is_primary=False, display_order=1)
        db.add_all([img1, img2])
        db.commit()
        db.refresh(img1)
        db.refresh(img2)

        state = {
            "client": TestClient(app),
            "headers": {"Authorization": f"Bearer {token}"},
            "listing_id": listing.id,
            "legacy_image_ids": [img1.id, img2.id],
            "media_ids": [],
        }
        yield state
    finally:
        db2 = SessionLocal()
        try:
            db2.query(ListingMediaAttachment).filter(
                ListingMediaAttachment.listing_id == state["listing_id"]
            ).delete()
            db2.query(ListingImage).filter(ListingImage.listing_id == state["listing_id"]).delete()
            for mid in state["media_ids"]:
                m = db2.query(MediaFile).filter(MediaFile.id == mid).first()
                if m:
                    db2.delete(m)
            db2.commit()
            db2.query(Listing).filter(Listing.id == state["listing_id"]).delete()
            db2.query(User).filter(User.email == email).delete()
            db2.commit()
        finally:
            db2.close()
        db.close()


def test_attach_with_legacy_image_ids_is_rejected_not_wiped(dealer_with_scraped_listing):
    """The exact bug scenario: the frontend sends ListingImage.id values
    (loaded from GET .../media before the listing was migrated) straight to
    /media/attach. These never resolve to a MediaFile, so the request must be
    rejected — and critically, the legacy photos must still be there
    afterward, not silently deleted."""
    state = dealer_with_scraped_listing
    client, headers = state["client"], state["headers"]

    res = client.post(
        f"/api/listings/{state['listing_id']}/media/attach",
        json={"media_ids": state["legacy_image_ids"]},
        headers=headers,
    )
    assert res.status_code == 400, res.text

    db = SessionLocal()
    try:
        remaining = (
            db.query(ListingImage)
            .filter(ListingImage.listing_id == state["listing_id"])
            .count()
        )
        assert remaining == 2, "legacy scraped images were wiped despite the attach request being invalid"
    finally:
        db.close()


def test_media_get_flags_legacy_vs_new_system(dealer_with_scraped_listing):
    state = dealer_with_scraped_listing
    client, headers = state["client"], state["headers"]

    res = client.get(f"/api/listings/{state['listing_id']}/media", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["using_new_media_system"] is False
    assert {m["id"] for m in body["media"]} == set(state["legacy_image_ids"])


def test_attach_real_media_supersedes_legacy_images(dealer_with_scraped_listing):
    """Once real uploaded media is attached, legacy images are correctly
    retired (superseded), and the media endpoint reports the new system."""
    state = dealer_with_scraped_listing
    client, headers = state["client"], state["headers"]

    upload_res = client.post(
        "/api/media/upload",
        files={"file": ("new.png", _png_bytes(), "image/png")},
        headers=headers,
    )
    assert upload_res.status_code == 200, upload_res.text
    media_id = upload_res.json()["media"]["id"]
    state["media_ids"].append(media_id)

    attach_res = client.post(
        f"/api/listings/{state['listing_id']}/media/attach",
        json={"media_ids": [media_id]},
        headers=headers,
    )
    assert attach_res.status_code == 200, attach_res.text
    assert attach_res.json()["attached"] == 1

    db = SessionLocal()
    try:
        remaining = (
            db.query(ListingImage)
            .filter(ListingImage.listing_id == state["listing_id"])
            .count()
        )
        assert remaining == 0
    finally:
        db.close()

    res = client.get(f"/api/listings/{state['listing_id']}/media", headers=headers)
    body = res.json()
    assert body["using_new_media_system"] is True
    assert [m["id"] for m in body["media"]] == [media_id]
