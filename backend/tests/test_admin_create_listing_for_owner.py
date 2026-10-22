"""Admins can create a listing owned by a broker / private seller."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.security.auth import create_access_token
from app.db.session import SessionLocal
from app.models.listing import Listing
from app.models.user import User


def _mk(db, user_type):
    u = User(email=f"pytest-own-{uuid.uuid4().hex[:10]}@example.com", password_hash="x",
             first_name="O", last_name="W", user_type=user_type, subscription_tier="free", active=True)
    db.add(u)
    db.commit()
    return u


def _hdr(u):
    return {"Authorization": f"Bearer {create_access_token(data={'sub': u.email})}"}


@pytest.fixture
def ctx():
    db = SessionLocal()
    users, listings = [], []
    yield db, users, listings
    for lid in listings:
        l = db.query(Listing).filter(Listing.id == lid).first()
        if l:
            db.delete(l)
    db.commit()
    for u in users:
        db.delete(u)
    db.commit()
    db.close()


def test_admin_creates_listing_for_private_seller(ctx):
    db, users, listings = ctx
    admin, seller, other = _mk(db, "admin"), _mk(db, "private"), _mk(db, "dealer")
    users.extend([admin, seller, other])
    c = TestClient(app)

    r = c.post("/api/listings/", json={"title": "Pytest For Seller", "bin": "", "owner_user_id": seller.id}, headers=_hdr(admin))
    assert r.status_code == 200, r.text
    listings.append(r.json()["id"])
    row = db.query(Listing).filter(Listing.id == r.json()["id"]).first()
    assert row.user_id == seller.id and row.created_by_user_id == admin.id

    # Non-admins can't create on someone else's behalf
    r = c.post("/api/listings/", json={"title": "x", "bin": "", "owner_user_id": seller.id}, headers=_hdr(other))
    assert r.status_code in (401, 403), r.text

    # Owner must be a broker / private seller
    r = c.post("/api/listings/", json={"title": "x", "bin": "", "owner_user_id": admin.id + 10**7}, headers=_hdr(admin))
    assert r.status_code in (400, 422), r.text


def test_admin_can_reassign_existing_listing(ctx):
    db, users, listings = ctx
    admin, seller = _mk(db, "admin"), _mk(db, "private")
    users.extend([admin, seller])
    c = TestClient(app)
    # Draft already exists under the admin (e.g. autosaved before an owner was picked)
    r = c.post("/api/listings/", json={"title": "Pytest Reassign", "bin": ""}, headers=_hdr(admin))
    assert r.status_code == 200, r.text
    lid = r.json()["id"]
    listings.append(lid)
    r = c.put(f"/api/listings/{lid}", json={"owner_user_id": seller.id}, headers=_hdr(admin))
    assert r.status_code == 200, r.text
    db.expire_all()
    assert db.query(Listing).filter(Listing.id == lid).first().user_id == seller.id
