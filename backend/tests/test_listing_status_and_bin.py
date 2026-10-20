"""
Listing BIN duplicate handling and the owner-facing status change flow.

Covers: an owner re-submitting the same BIN (e.g. autosave created a draft,
then the final submit POSTs again) gets an actionable 409 naming their own
listing; BIN matching ignores case/spaces/dashes; a blank BIN on update never
wipes the stored one; and the status endpoint works for the owner of an unpaid
account (who must still be able to open their own listing).
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.listing import Listing


def _unique_email() -> str:
    return f"pytest-{uuid.uuid4().hex[:10]}@example.com"


def _register(client: TestClient, email: str, user_type: str):
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123",
            "first_name": "Test",
            "last_name": "Seller",
            "user_type": user_type,
            "phone": "+15555550100",
            "agree_terms": True,
            "agree_communications": True,
        },
    )
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def cleanup():
    emails: list[str] = []
    yield emails
    db = SessionLocal()
    try:
        for email in emails:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                continue
            for listing in db.query(Listing).filter(Listing.user_id == user.id).all():
                db.delete(listing)
            db.delete(user)
        db.commit()
    finally:
        db.close()


def test_duplicate_bin_is_actionable_and_normalized(client, cleanup):
    email = _unique_email()
    cleanup.append(email)
    headers = _register(client, email, "private")
    bin_value = f"US-{uuid.uuid4().hex[:8].upper()}K617"

    res = client.post("/api/listings/", json={"title": "My Boat", "bin": bin_value}, headers=headers)
    assert res.status_code == 200, res.text
    listing_id = res.json()["id"]

    # Same BIN again, differently formatted -> 409 that points at the user's own listing.
    sloppy = " " + bin_value.lower().replace("-", " ") + " "
    res = client.post("/api/listings/", json={"title": "My Boat 2", "bin": sloppy}, headers=headers)
    assert res.status_code == 409
    assert "already have a listing" in res.json()["detail"]
    assert "My Boat" in res.json()["detail"]

    # Re-saving the listing with its own BIN is not a conflict.
    res = client.put(f"/api/listings/{listing_id}", json={"bin": bin_value}, headers=headers)
    assert res.status_code == 200, res.text

    # A blank BIN on update must not wipe the stored one.
    res = client.put(f"/api/listings/{listing_id}", json={"title": "Renamed", "bin": ""}, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["bin"] == bin_value


def test_owner_can_change_status_of_unpaid_listing(client, cleanup):
    owner_email, other_email = _unique_email(), _unique_email()
    cleanup.extend([owner_email, other_email])
    owner = _register(client, owner_email, "private")
    other_client = TestClient(app)  # separate client: a client keeps its login cookie
    other = _register(other_client, other_email, "private")

    res = client.post(
        "/api/listings/",
        json={"title": "Status Boat", "bin": f"ST{uuid.uuid4().hex[:10].upper()}"},
        headers=owner,
    )
    assert res.status_code == 200, res.text
    listing_id = res.json()["id"]
    assert res.json()["status"] == "draft"

    # The owner can open their own listing even though the account hasn't paid,
    # and is told they can manage it. Anonymous visitors still get a 404.
    res = client.get(f"/api/listings/{listing_id}", headers=owner)
    assert res.status_code == 200, res.text
    assert res.json()["can_manage"] is True
    assert TestClient(app).get(f"/api/listings/{listing_id}").status_code == 404

    # Another seller cannot change the status.
    res = other_client.patch(f"/api/listings/{listing_id}/status", json={"status": "active"}, headers=other)
    assert res.status_code == 403

    # Invalid statuses are rejected.
    res = client.patch(f"/api/listings/{listing_id}/status", json={"status": "bogus"}, headers=owner)
    assert res.status_code == 400

    # Publishing works, and warns that an unpaid account's listing stays hidden.
    res = client.patch(f"/api/listings/{listing_id}/status", json={"status": "active"}, headers=owner)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "active"
    assert res.json()["public_visible"] is False
    assert "subscription" in res.json()["warning"]

    res = client.patch(f"/api/listings/{listing_id}/status", json={"status": "draft"}, headers=owner)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "draft"
    assert "warning" not in res.json()
