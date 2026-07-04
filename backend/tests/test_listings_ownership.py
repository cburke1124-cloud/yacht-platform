"""
IDOR / ownership and admin-gating smoke tests. Hits the real app + dev
database — each test creates and cleans up its own throwaway users/listings.
"""
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.listing import Listing


def _unique_email() -> str:
    return f"pytest-{uuid.uuid4().hex[:10]}@example.com"


def _register(client: TestClient, email: str, user_type: str = "user"):
    return client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123",
            "first_name": "Test",
            "last_name": "User",
            "user_type": user_type,
            "agree_terms": True,
            "agree_communications": True,
        },
    )


@pytest.fixture
def owner_client():
    return TestClient(app)


@pytest.fixture
def other_client():
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


def _make_listing_for(email: str) -> int:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        listing = Listing(
            user_id=user.id,
            created_by_user_id=user.id,
            title="Pytest Test Listing",
            bin=uuid.uuid4().hex[:12].upper(),
            status="active",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        return listing.id
    finally:
        db.close()


def test_non_owner_cannot_update_listing(owner_client, other_client, cleanup):
    owner_email = _unique_email()
    other_email = _unique_email()
    cleanup["emails"] += [owner_email, other_email]

    _register(owner_client, owner_email)
    _register(other_client, other_email)

    listing_id = _make_listing_for(owner_email)
    cleanup["listing_ids"].append(listing_id)

    res = other_client.put(f"/api/listings/{listing_id}", json={"title": "Hijacked title"})
    assert res.status_code in (401, 403)


def test_non_owner_cannot_delete_listing(owner_client, other_client, cleanup):
    owner_email = _unique_email()
    other_email = _unique_email()
    cleanup["emails"] += [owner_email, other_email]

    _register(owner_client, owner_email)
    _register(other_client, other_email)

    listing_id = _make_listing_for(owner_email)
    cleanup["listing_ids"].append(listing_id)

    res = other_client.delete(f"/api/listings/{listing_id}")
    assert res.status_code in (401, 403)

    # Confirm it's still there
    db = SessionLocal()
    try:
        assert db.query(Listing).filter(Listing.id == listing_id).first() is not None
    finally:
        db.close()


def test_owner_can_update_own_listing(owner_client, cleanup):
    owner_email = _unique_email()
    cleanup["emails"].append(owner_email)
    _register(owner_client, owner_email)

    listing_id = _make_listing_for(owner_email)
    cleanup["listing_ids"].append(listing_id)

    res = owner_client.put(f"/api/listings/{listing_id}", json={"title": "Updated by owner"})
    assert res.status_code == 200


def test_admin_endpoint_rejects_non_admin(other_client, cleanup):
    email = _unique_email()
    cleanup["emails"].append(email)
    _register(other_client, email)

    res = other_client.get("/api/admin/users")
    assert res.status_code == 403
