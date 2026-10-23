"""Admins can create a listing owned by a broker / private seller."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.security.auth import create_access_token
from app.db.session import SessionLocal
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.models.partner_growth import AffiliateAccount, ReferralSignup
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
    ids = [u.id for u in users]
    db.expire_all()
    # Sales-rep signups leave referral / affiliate / profile rows and an
    # assigned_sales_rep_id pointing at the rep — clear those before the users.
    db.query(ReferralSignup).filter(
        (ReferralSignup.dealer_user_id.in_(ids)) | (ReferralSignup.sales_rep_id.in_(ids))
    ).delete(synchronize_session=False)
    db.query(User).filter(User.assigned_sales_rep_id.in_(ids)).update({"assigned_sales_rep_id": None}, synchronize_session=False)
    db.query(DealerProfile).filter(DealerProfile.user_id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    db.query(ReferralSignup).filter(
        ReferralSignup.affiliate_account_id.in_(db.query(AffiliateAccount.id).filter(AffiliateAccount.user_id.in_(ids)))
    ).delete(synchronize_session=False)
    db.query(AffiliateAccount).filter(AffiliateAccount.user_id.in_(ids)).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_(ids)).delete(synchronize_session=False)
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


def test_password_setup_link_works_without_email(ctx):
    db, users, listings = ctx
    admin, seller = _mk(db, "admin"), _mk(db, "private")
    users.extend([admin, seller])
    c = TestClient(app)
    r = c.post(f"/api/admin/users/{seller.id}/password-setup-link", headers=_hdr(admin))
    assert r.status_code == 200, r.text
    url = r.json()["setup_url"]
    token = url.split("token=")[1]
    r = c.post("/api/auth/set-password", json={"token": token, "password": "BrandNewPass123"})
    assert r.status_code == 200, r.text
    db.expire_all()
    assert db.query(User).filter(User.id == seller.id).first().email_verified is True
    # not available to non-admins
    r = c.post(f"/api/admin/users/{admin.id}/password-setup-link", headers=_hdr(seller))
    assert r.status_code in (401, 403)


def test_sales_rep_login_link_only_before_password_is_set(ctx):
    db, users, listings = ctx
    rep = _mk(db, "salesman")
    users.append(rep)
    c = TestClient(app)
    email = f"pytest-rep-reg-{uuid.uuid4().hex[:8]}@example.com"
    r = c.post("/api/sales-rep/register-broker", json={"email": email, "first_name": "R", "user_type": "private"}, headers=_hdr(rep))
    assert r.status_code == 200, r.text
    new_id = r.json()["dealer_id"]
    created = db.query(User).filter(User.id == new_id).first()
    users.append(created)

    r = c.post(f"/api/sales-rep/dealers/{new_id}/login-link", headers=_hdr(rep))
    assert r.status_code == 200, r.text
    token = r.json()["setup_url"].split("token=")[1]
    assert c.post("/api/auth/set-password", json={"token": token, "password": "BrandNewPass123"}).status_code == 200

    # Once they've set a password the rep can no longer hand out a link
    r = c.post(f"/api/sales-rep/dealers/{new_id}/login-link", headers=_hdr(rep))
    assert r.status_code in (401, 403), r.text
