"""
Unified AI search (buy vs charter intent) smoke tests. Hits the real app +
dev database + real Claude API (CLAUDE_API_KEY is configured in this env) —
creates its own throwaway user/listing/charter and cleans them up.
"""
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.listing import Listing
from app.models.charter import CharterListing


def _unique_email() -> str:
    return f"pytest-aismart-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def cleanup():
    emails = []
    listing_ids = []
    charter_ids = []
    yield {"emails": emails, "listing_ids": listing_ids, "charter_ids": charter_ids}
    db = SessionLocal()
    try:
        for charter_id in charter_ids:
            c = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
            if c:
                db.delete(c)
        db.commit()
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


def test_baseline_ai_endpoints_still_work(client, cleanup):
    """/ai and /ai/search (legacy, untouched) must keep responding with the
    original shape after this change — no fields removed, no signature change."""
    res = client.post("/api/ai", json={"query": "fishing boat under $500k in Florida", "max_results": 5})
    assert res.status_code == 200
    data = res.json()
    assert "query" in data
    assert "understood_criteria" in data
    assert "results" in data
    assert "intent" not in data  # legacy endpoint never had this field — confirms untouched

    res2 = client.get("/api/ai/search", params={"query": "fishing boat under $500k in Florida"})
    assert res2.status_code == 200
    assert "results" in res2.json()


def test_smart_search_classifies_for_sale_intent(client, cleanup):
    email = _unique_email()
    cleanup["emails"].append(email)
    reg_res = client.post(
        "/api/auth/register",
        json={
            "email": email, "password": "TestPass123", "first_name": "Test", "last_name": "User",
            "user_type": "user", "agree_terms": True, "agree_communications": True,
        },
    )
    assert reg_res.status_code == 200
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user.always_free = True
        db.commit()
        listing = Listing(
            user_id=user.id, created_by_user_id=user.id, title="Pytest AI Smart Search Sea Ray",
            bin=uuid.uuid4().hex[:12].upper(), status="active", condition="used",
            make="Sea Ray", model="Sundancer 320", year=2019, price=225000,
            boat_type="Motor Yacht", country="United States", state="Florida", city="Miami",
            created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        cleanup["listing_ids"].append(listing.id)
    finally:
        db.close()

    res = client.post("/api/ai/smart-search", json={"query": "Sea Ray motor yacht for sale under $300k in Florida", "max_results": 5})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "for_sale"
    assert all("listing" in r for r in data["results"])


def test_smart_search_classifies_charter_intent(client, cleanup):
    email = _unique_email()
    cleanup["emails"].append(email)
    client.post(
        "/api/auth/register",
        json={
            "email": email, "password": "TestPass123", "first_name": "Test", "last_name": "User",
            "user_type": "user", "agree_terms": True, "agree_communications": True,
        },
    )
    db = SessionLocal()
    try:
        user_id = db.query(User).filter(User.email == email).first().id
        charter = CharterListing(
            user_id=user_id, title="Pytest Charter Catamaran BVI", vessel_name="Pytest Vessel",
            slug=f"pytest-charter-{uuid.uuid4().hex[:8]}", make="Lagoon", model="450", year=2020,
            boat_type="Catamaran", cabins=4, max_guests=8, crew_included=True,
            home_port_city="Road Town", home_port_country="British Virgin Islands",
            operating_regions="BVI, Caribbean", day_rate=None, week_rate=45000, currency="USD",
            min_charter_days=7, status="active",
            created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        db.add(charter)
        db.commit()
        db.refresh(charter)
        cleanup["charter_ids"].append(charter.id)
    finally:
        db.close()

    res = client.post(
        "/api/ai/smart-search",
        json={"query": "crewed catamaran charter in the BVI for 8 people, a week, under $50k", "max_results": 5},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "charter"
    assert all("charter" in r for r in data["results"])
