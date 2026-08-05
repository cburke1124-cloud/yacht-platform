"""
Sales-rep scoped account management panel: a sales rep can view/edit the
User row, DealerProfile, and Listing rows of a dealer/private-seller they
personally referred (via ReferralSignup or User.assigned_sales_rep_id), but
never verified/active/subscription_tier, and never an account they didn't
refer. See backend/app/api/routes_sales.py "dealers/{user_id}..." endpoints
and the sales-rep branch of the listing-ownership checks in
routes_listings.py.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from datetime import timedelta
from app.security.auth import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.models.partner_growth import ReferralSignup


def _unique_email(prefix: str) -> str:
    return f"pytest-srdm-{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _unique_bin() -> str:
    return uuid.uuid4().hex[:12].upper()


@pytest.fixture
def rep_and_accounts():
    db = SessionLocal()
    try:
        rep = User(
            email=_unique_email("rep"), password_hash=get_password_hash("TestPass123"),
            first_name="Bill", last_name="Rep", user_type="salesman",
        )
        dealer = User(
            email=_unique_email("dealer"), password_hash=get_password_hash("TestPass123"),
            first_name="Jane", last_name="Broker", user_type="dealer",
            company_name="ABC Yacht Brokerage", subscription_tier="free",
        )
        private_seller = User(
            email=_unique_email("private"), password_hash=get_password_hash("TestPass123"),
            first_name="Pat", last_name="Seller", user_type="private", subscription_tier="free",
        )
        other_dealer = User(
            email=_unique_email("other"), password_hash=get_password_hash("TestPass123"),
            first_name="Not", last_name="Referred", user_type="dealer",
            company_name="Unrelated Yachts", subscription_tier="free",
        )
        plain_dealer = User(
            email=_unique_email("plain"), password_hash=get_password_hash("TestPass123"),
            first_name="Plain", last_name="Caller", user_type="dealer", subscription_tier="free",
        )
        db.add_all([rep, dealer, private_seller, other_dealer, plain_dealer])
        db.commit()
        for u in (rep, dealer, private_seller, other_dealer, plain_dealer):
            db.refresh(u)

        # private_seller is linked directly via assigned_sales_rep_id (no ReferralSignup row needed).
        private_seller.assigned_sales_rep_id = rep.id
        db.commit()

        profile = DealerProfile(
            user_id=dealer.id, slug=f"abc-yacht-{uuid.uuid4().hex[:8]}",
            name="Jane Broker", company_name="ABC Yacht Brokerage",
        )
        db.add(profile)

        referral = ReferralSignup(
            dealer_user_id=dealer.id, source_type="sales_rep", sales_rep_id=rep.id,
        )
        db.add(referral)

        listing = Listing(
            user_id=dealer.id, created_by_user_id=dealer.id,
            title="42ft Sportfish", bin=_unique_bin(), price=100000.0, status="active",
        )
        db.add(listing)
        db.commit()
        db.refresh(profile)
        db.refresh(listing)

        def token_for(user: User) -> str:
            return create_access_token(
                data={"sub": user.email}, expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            )

        state = {
            "client": TestClient(app),
            "rep": rep, "rep_token": token_for(rep),
            "dealer": dealer, "dealer_token": token_for(dealer),
            "private_seller": private_seller,
            "other_dealer": other_dealer,
            "plain_dealer": plain_dealer, "plain_dealer_token": token_for(plain_dealer),
            "listing": listing,
            "profile_id": profile.id,
        }
        yield state
    finally:
        db2 = SessionLocal()
        try:
            user_ids = [
                state["rep"].id, state["dealer"].id, state["private_seller"].id,
                state["other_dealer"].id, state["plain_dealer"].id,
            ]
            db2.query(Listing).filter(Listing.user_id.in_(user_ids)).delete(synchronize_session=False)
            db2.query(ReferralSignup).filter(ReferralSignup.dealer_user_id.in_(user_ids)).delete(synchronize_session=False)
            db2.query(DealerProfile).filter(DealerProfile.user_id.in_(user_ids)).delete(synchronize_session=False)
            db2.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
            db2.commit()
        finally:
            db2.close()
        db.close()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_rep_can_view_and_edit_referred_dealer_account(rep_and_accounts):
    s = rep_and_accounts
    res = s["client"].get(f"/api/sales-rep/dealers/{s['dealer'].id}", headers=_auth(s["rep_token"]))
    assert res.status_code == 200, res.text
    assert res.json()["user_type"] == "dealer"

    res = s["client"].put(
        f"/api/sales-rep/dealers/{s['dealer'].id}",
        headers=_auth(s["rep_token"]),
        json={"first_name": "Janet", "phone": "5551234567", "company_name": "ABC Yacht Brokerage LLC"},
    )
    assert res.status_code == 200, res.text

    db = SessionLocal()
    try:
        refreshed = db.query(User).filter(User.id == s["dealer"].id).first()
        assert refreshed.first_name == "Janet"
        assert refreshed.company_name == "ABC Yacht Brokerage LLC"
    finally:
        db.close()


def test_rep_can_view_and_edit_referred_dealer_profile(rep_and_accounts):
    s = rep_and_accounts
    res = s["client"].get(f"/api/sales-rep/dealers/{s['dealer'].id}/profile", headers=_auth(s["rep_token"]))
    assert res.status_code == 200, res.text
    assert res.json()["name"] == "Jane Broker"

    res = s["client"].put(
        f"/api/sales-rep/dealers/{s['dealer'].id}/profile",
        headers=_auth(s["rep_token"]),
        json={"description": "Full-service yacht brokerage.", "website": "https://abcyachts.example.com"},
    )
    assert res.status_code == 200, res.text

    db = SessionLocal()
    try:
        profile = db.query(DealerProfile).filter(DealerProfile.user_id == s["dealer"].id).first()
        assert profile.description == "Full-service yacht brokerage."
        assert profile.website == "https://abcyachts.example.com"
    finally:
        db.close()


def test_rep_can_view_and_edit_referred_dealer_listing(rep_and_accounts):
    s = rep_and_accounts
    res = s["client"].get(f"/api/sales-rep/dealers/{s['dealer'].id}/listings", headers=_auth(s["rep_token"]))
    assert res.status_code == 200, res.text
    listing_ids = [l["id"] for l in res.json()["listings"]]
    assert s["listing"].id in listing_ids

    # Direct PUT /listings/{id} — exercises the sales-rep branch added to
    # the ownership check in routes_listings.py, not the sales-rep router.
    res = s["client"].put(
        f"/api/listings/{s['listing'].id}",
        headers=_auth(s["rep_token"]),
        json={"price": 105000.0, "status": "draft"},
    )
    assert res.status_code == 200, res.text

    db = SessionLocal()
    try:
        refreshed = db.query(Listing).filter(Listing.id == s["listing"].id).first()
        assert refreshed.price == 105000.0
        assert refreshed.status == "draft"
    finally:
        db.close()


def test_rep_cannot_manage_unreferred_dealer(rep_and_accounts):
    s = rep_and_accounts
    other_id = s["other_dealer"].id

    assert s["client"].get(f"/api/sales-rep/dealers/{other_id}", headers=_auth(s["rep_token"])).status_code == 403
    assert s["client"].put(f"/api/sales-rep/dealers/{other_id}", headers=_auth(s["rep_token"]), json={"first_name": "X"}).status_code == 403
    assert s["client"].get(f"/api/sales-rep/dealers/{other_id}/profile", headers=_auth(s["rep_token"])).status_code == 403
    assert s["client"].get(f"/api/sales-rep/dealers/{other_id}/listings", headers=_auth(s["rep_token"])).status_code == 403


def test_rep_cannot_edit_unreferred_dealers_listing(rep_and_accounts):
    s = rep_and_accounts
    db = SessionLocal()
    try:
        other_listing = Listing(
            user_id=s["other_dealer"].id, created_by_user_id=s["other_dealer"].id,
            title="Unrelated Yacht", bin=_unique_bin(), price=50000.0, status="active",
        )
        db.add(other_listing)
        db.commit()
        db.refresh(other_listing)
        other_listing_id = other_listing.id
    finally:
        db.close()

    try:
        res = s["client"].put(
            f"/api/listings/{other_listing_id}",
            headers=_auth(s["rep_token"]),
            json={"price": 1.0},
        )
        assert res.status_code == 403, res.text
    finally:
        db2 = SessionLocal()
        try:
            db2.query(Listing).filter(Listing.id == other_listing_id).delete()
            db2.commit()
        finally:
            db2.close()


def test_rep_cannot_write_privileged_account_fields(rep_and_accounts):
    s = rep_and_accounts
    db = SessionLocal()
    try:
        before = db.query(User).filter(User.id == s["dealer"].id).first()
        before_verified, before_active, before_tier = before.verified, before.active, before.subscription_tier
    finally:
        db.close()

    res = s["client"].put(
        f"/api/sales-rep/dealers/{s['dealer'].id}",
        headers=_auth(s["rep_token"]),
        json={"verified": True, "active": False, "subscription_tier": "ultimate"},
    )
    assert res.status_code == 200, res.text

    db = SessionLocal()
    try:
        after = db.query(User).filter(User.id == s["dealer"].id).first()
        assert after.verified == before_verified
        assert after.active == before_active
        assert after.subscription_tier == before_tier
    finally:
        db.close()


def test_rep_cannot_write_privileged_profile_fields(rep_and_accounts):
    s = rep_and_accounts
    db = SessionLocal()
    try:
        before = db.query(DealerProfile).filter(DealerProfile.user_id == s["dealer"].id).first()
        before_verified, before_active = before.verified, before.active
    finally:
        db.close()

    res = s["client"].put(
        f"/api/sales-rep/dealers/{s['dealer'].id}/profile",
        headers=_auth(s["rep_token"]),
        json={"verified": True, "active": False},
    )
    assert res.status_code == 200, res.text

    db = SessionLocal()
    try:
        after = db.query(DealerProfile).filter(DealerProfile.user_id == s["dealer"].id).first()
        assert after.verified == before_verified
        assert after.active == before_active
    finally:
        db.close()


def test_private_seller_profile_is_empty_and_unwritable(rep_and_accounts):
    s = rep_and_accounts
    private_id = s["private_seller"].id

    res = s["client"].get(f"/api/sales-rep/dealers/{private_id}/profile", headers=_auth(s["rep_token"]))
    assert res.status_code == 200, res.text
    assert res.json() == {}

    res = s["client"].put(
        f"/api/sales-rep/dealers/{private_id}/profile",
        headers=_auth(s["rep_token"]),
        json={"description": "should not work"},
    )
    assert res.status_code == 404, res.text


def test_rep_can_view_referred_dealers_unpaid_draft_listing(rep_and_accounts):
    """GET /listings/{id} and GET /listings/{id}/media each have their own
    admin-only bypass (separate from the ownership checks in routes_listings.py
    fixed above) that hides a listing when its owner hasn't paid, or when the
    listing isn't 'active'. A managing sales rep must be able to see through
    both, the same as an admin, or they can't open the full editor for a
    referred dealer's draft/unpaid listing."""
    s = rep_and_accounts
    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.id == s["listing"].id).first()
        listing.status = "draft"
        db.commit()
    finally:
        db.close()

    res = s["client"].get(f"/api/listings/{s['listing'].id}", headers=_auth(s["rep_token"]))
    assert res.status_code == 200, res.text

    res = s["client"].get(f"/api/listings/{s['listing'].id}/media", headers=_auth(s["rep_token"]))
    assert res.status_code == 200, res.text


def test_rep_cannot_view_unreferred_dealers_unpaid_draft_listing(rep_and_accounts):
    s = rep_and_accounts
    db = SessionLocal()
    try:
        other_listing = Listing(
            user_id=s["other_dealer"].id, created_by_user_id=s["other_dealer"].id,
            title="Unrelated Draft Yacht", bin=_unique_bin(), price=75000.0, status="draft",
        )
        db.add(other_listing)
        db.commit()
        db.refresh(other_listing)
        other_listing_id = other_listing.id
    finally:
        db.close()

    try:
        res = s["client"].get(f"/api/listings/{other_listing_id}", headers=_auth(s["rep_token"]))
        assert res.status_code == 404, res.text
        res = s["client"].get(f"/api/listings/{other_listing_id}/media", headers=_auth(s["rep_token"]))
        assert res.status_code == 404, res.text
    finally:
        db2 = SessionLocal()
        try:
            db2.query(Listing).filter(Listing.id == other_listing_id).delete()
            db2.commit()
        finally:
            db2.close()


def test_non_salesman_cannot_use_sales_rep_dealer_endpoints(rep_and_accounts):
    s = rep_and_accounts
    res = s["client"].get(
        f"/api/sales-rep/dealers/{s['dealer'].id}",
        headers=_auth(s["plain_dealer_token"]),
    )
    assert res.status_code == 403, res.text
