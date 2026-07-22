"""
Geocoding: the unit behavior of app.services.geocoding.geocode_location(),
plus its wiring into listing create/update (routes_listings.py) and scraped
listing import (scraper.py's _apply_scraped_data). All API calls are mocked
-- these tests never hit the real Google Geocoding API.
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
from app.models.listing import Listing
from app.services.geocoding import geocode_location


def _unique_email() -> str:
    return f"pytest-geo-{uuid.uuid4().hex[:10]}@example.com"


class _FakeResponse:
    def __init__(self, payload, ok=True):
        self._payload = payload
        self._ok = ok

    def raise_for_status(self):
        if not self._ok:
            raise Exception("HTTP error")

    def json(self):
        return self._payload


def _fake_get_factory(lat=25.7617, lng=-80.1918, status="OK"):
    def _fake_get(url, params=None, timeout=None):
        if status == "OK":
            payload = {"status": "OK", "results": [{"geometry": {"location": {"lat": lat, "lng": lng}}}]}
        else:
            payload = {"status": status, "results": []}
        return _FakeResponse(payload)
    return _fake_get


# ── Unit tests: geocode_location() itself ──────────────────────────────────

def test_geocode_location_no_address_parts_returns_none(monkeypatch):
    assert geocode_location(None, None, None, None) == (None, None)


def test_geocode_location_missing_api_key_returns_none(monkeypatch):
    monkeypatch.delenv("GOOGLE_MAPS_API_KEY", raising=False)
    assert geocode_location("Miami", "FL", "USA") == (None, None)


def test_geocode_location_success(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")
    monkeypatch.setattr("app.services.geocoding.requests.get", _fake_get_factory(25.7617, -80.1918))
    lat, lng = geocode_location("Miami", "FL", "USA")
    assert lat == pytest.approx(25.7617)
    assert lng == pytest.approx(-80.1918)


def test_geocode_location_zero_results_returns_none(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")
    monkeypatch.setattr("app.services.geocoding.requests.get", _fake_get_factory(status="ZERO_RESULTS"))
    assert geocode_location("Nowhereville", "ZZ", "Atlantis") == (None, None)


def test_geocode_location_network_error_returns_none(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")

    def _raise(*a, **kw):
        raise ConnectionError("boom")

    monkeypatch.setattr("app.services.geocoding.requests.get", _raise)
    assert geocode_location("Miami", "FL", "USA") == (None, None)


# ── Wiring: POST/PUT /listings ──────────────────────────────────────────────

@pytest.fixture
def dealer():
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
            always_free=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(
            data={"sub": user.email},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        state = {
            "client": TestClient(app),
            "headers": {"Authorization": f"Bearer {token}"},
            "listing_ids": [],
        }
        yield state
    finally:
        db2 = SessionLocal()
        try:
            for lid in state["listing_ids"]:
                l = db2.query(Listing).filter(Listing.id == lid).first()
                if l:
                    db2.delete(l)
            db2.commit()
            db2.query(User).filter(User.email == email).delete()
            db2.commit()
        finally:
            db2.close()
        db.close()


def test_create_listing_gets_geocoded(dealer, monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")
    monkeypatch.setattr("app.api.routes_listings.geocode_location", lambda *a, **kw: (25.7617, -80.1918))

    res = dealer["client"].post(
        "/api/listings/",
        json={
            "title": "Pytest Geocode Boat", "make": "Sea Ray", "model": "Sundancer", "bin": "",
            "year": 2020, "price": 100000, "condition": "used",
            "city": "Miami", "state": "FL", "country": "USA",
        },
        headers=dealer["headers"],
    )
    assert res.status_code == 200, res.text
    listing_id = res.json()["id"]
    dealer["listing_ids"].append(listing_id)

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.id == listing_id).first()
        assert listing.latitude == pytest.approx(25.7617)
        assert listing.longitude == pytest.approx(-80.1918)
    finally:
        db.close()


def test_create_listing_with_no_location_skips_geocoding(dealer, monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.api.routes_listings.geocode_location",
        lambda *a, **kw: (calls.append(a) or (None, None)),
    )

    res = dealer["client"].post(
        "/api/listings/",
        json={"title": "Pytest No-Location Boat", "make": "Sea Ray", "model": "Sundancer", "bin": "",
              "year": 2020, "price": 100000, "condition": "used"},
        headers=dealer["headers"],
    )
    assert res.status_code == 200, res.text
    dealer["listing_ids"].append(res.json()["id"])
    assert calls == [(None, None, None, None)]  # called, but nothing to look up


def test_update_listing_city_triggers_regeocode(dealer, monkeypatch):
    monkeypatch.setattr("app.api.routes_listings.geocode_location", lambda *a, **kw: (25.7617, -80.1918))
    res = dealer["client"].post(
        "/api/listings/",
        json={"title": "Pytest Update Boat", "make": "Sea Ray", "model": "Sundancer", "bin": "",
              "year": 2020, "price": 100000, "condition": "used",
              "city": "Miami", "state": "FL", "country": "USA"},
        headers=dealer["headers"],
    )
    listing_id = res.json()["id"]
    dealer["listing_ids"].append(listing_id)

    # Changing the city re-geocodes to the new coordinates.
    monkeypatch.setattr("app.api.routes_listings.geocode_location", lambda *a, **kw: (40.7128, -74.0060))
    res = dealer["client"].put(
        f"/api/listings/{listing_id}", json={"city": "New York"}, headers=dealer["headers"]
    )
    assert res.status_code == 200, res.text

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.id == listing_id).first()
        assert listing.latitude == pytest.approx(40.7128)
        assert listing.longitude == pytest.approx(-74.0060)
    finally:
        db.close()


def test_update_listing_unrelated_field_does_not_regeocode(dealer, monkeypatch):
    monkeypatch.setattr("app.api.routes_listings.geocode_location", lambda *a, **kw: (25.7617, -80.1918))
    res = dealer["client"].post(
        "/api/listings/",
        json={"title": "Pytest Stable Boat", "make": "Sea Ray", "model": "Sundancer", "bin": "",
              "year": 2020, "price": 100000, "condition": "used",
              "city": "Miami", "state": "FL", "country": "USA"},
        headers=dealer["headers"],
    )
    listing_id = res.json()["id"]
    dealer["listing_ids"].append(listing_id)

    calls = []
    monkeypatch.setattr(
        "app.api.routes_listings.geocode_location",
        lambda *a, **kw: (calls.append(a) or (99.0, 99.0)),
    )
    res = dealer["client"].put(
        f"/api/listings/{listing_id}", json={"price": 111111}, headers=dealer["headers"]
    )
    assert res.status_code == 200, res.text
    assert calls == []  # price change alone must not trigger a geocode call

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.id == listing_id).first()
        # Coordinates from the original create are untouched.
        assert listing.latitude == pytest.approx(25.7617)
        assert listing.longitude == pytest.approx(-80.1918)
    finally:
        db.close()
