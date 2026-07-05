"""
/listings/locations aggregation endpoint smoke test. Hits the real app +
dev database — creates its own throwaway user/listings and cleans them up.
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
    return f"pytest-loc-{uuid.uuid4().hex[:10]}@example.com"


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


def _make_active_listing(user_id: int, country: str, state: str | None, city: str) -> int:
    db = SessionLocal()
    try:
        listing = Listing(
            user_id=user_id,
            created_by_user_id=user_id,
            title="Pytest Location Listing",
            bin=uuid.uuid4().hex[:12].upper(),
            status="active",
            country=country,
            state=state,
            city=city,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        return listing.id
    finally:
        db.close()


# Use a distinctive, unlikely-to-collide city/state/country so this test's
# counts aren't polluted by real data.
_TEST_COUNTRY = "Pytest Testland"
_TEST_STATE = "Pytest State"
_TEST_CITY = "Pytest City"


def test_location_appears_once_threshold_met(client, cleanup):
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
        # /listings/locations applies the same visibility rule as the main
        # GET /listings endpoint (paid tier or always_free) — set it here so
        # this test's seeded listings actually count.
        user.always_free = True
        db.commit()
        user_id = user.id
    finally:
        db.close()

    # Below threshold (min_count=3): only 2 listings.
    for _ in range(2):
        cleanup["listing_ids"].append(_make_active_listing(user_id, _TEST_COUNTRY, _TEST_STATE, _TEST_CITY))

    res = client.get("/api/listings/locations?min_count=3")
    assert res.status_code == 200
    locations = res.json()["locations"]
    city_paths = [loc["path"] for loc in locations if loc["type"] == "city"]
    country_slug = "pytest-testland"
    state_slug = "pytest-state"
    city_slug = "pytest-city"
    assert [country_slug, state_slug, city_slug] not in city_paths

    # Cross the threshold with a 3rd listing.
    cleanup["listing_ids"].append(_make_active_listing(user_id, _TEST_COUNTRY, _TEST_STATE, _TEST_CITY))

    res = client.get("/api/listings/locations?min_count=3")
    assert res.status_code == 200
    data = res.json()["locations"]

    city_node = next((loc for loc in data if loc["path"] == [country_slug, state_slug, city_slug]), None)
    assert city_node is not None
    assert city_node["count"] == 3
    assert city_node["label"] == f"{_TEST_CITY}, {_TEST_STATE}"
    assert city_node["filters"] == {"country": _TEST_COUNTRY, "city": _TEST_CITY, "state": _TEST_STATE}
    assert city_node["parentPath"] == [country_slug, state_slug]

    state_node = next((loc for loc in data if loc["path"] == [country_slug, state_slug]), None)
    assert state_node is not None
    assert state_node["type"] == "state"
    assert state_node["count"] == 3

    country_node = next((loc for loc in data if loc["path"] == [country_slug]), None)
    assert country_node is not None
    assert country_node["type"] == "country"
    assert country_node["count"] == 3


def test_location_without_state_uses_two_segment_path(client, cleanup):
    email = _unique_email()
    cleanup["emails"].append(email)
    client.post(
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
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        # /listings/locations applies the same visibility rule as the main
        # GET /listings endpoint (paid tier or always_free) — set it here so
        # this test's seeded listings actually count.
        user.always_free = True
        db.commit()
        user_id = user.id
    finally:
        db.close()

    for _ in range(3):
        cleanup["listing_ids"].append(_make_active_listing(user_id, "Pytest No-State Land", None, "Pytest Capital"))

    res = client.get("/api/listings/locations?min_count=3")
    assert res.status_code == 200
    locations = res.json()["locations"]
    city_node = next(
        (loc for loc in locations if loc["path"] == ["pytest-no-state-land", "pytest-capital"]),
        None,
    )
    assert city_node is not None
    assert city_node["label"] == "Pytest Capital"
    assert city_node["filters"] == {"country": "Pytest No-State Land", "city": "Pytest Capital"}
    assert city_node["parentPath"] == ["pytest-no-state-land"]
