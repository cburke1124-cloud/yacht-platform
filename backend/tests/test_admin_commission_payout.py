"""
Admin sales-rep reassignment + commission payout tracking.

Reassignment: POST /admin/assign-sales-rep now supports unassign (null
sales_rep_id), private sellers (not just dealers), and corrects unpaid
ReferralSignup attribution in place while preserving already-paid history.

Payout tracking: commission is computed fresh from ReferralSignup.payout_id
IS NULL rows every time — GET /admin/sales-reps/{id}/payout-statement
previews it, POST .../confirm-payout persists a CommissionPayout and stamps
payout_id on everything included, so the owed total starts counting from $0
again until new activity accrues. See backend/app/utils/commission_payout.py.
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
from app.models.partner_growth import ReferralSignup, AffiliateAccount
from app.models.misc import CommissionPayout


def _unique_email(prefix: str) -> str:
    return f"pytest-payout-{prefix}-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def payout_fixture():
    db = SessionLocal()
    created_user_ids = []
    created_referral_ids = []
    created_payout_ids = []
    try:
        admin = User(
            email=_unique_email("admin"), password_hash=get_password_hash("TestPass123"),
            first_name="Admin", last_name="User", user_type="admin",
        )
        rep_a = User(
            email=_unique_email("repa"), password_hash=get_password_hash("TestPass123"),
            first_name="Alice", last_name="RepA", user_type="salesman", commission_rate=10.0,
        )
        rep_b = User(
            email=_unique_email("repb"), password_hash=get_password_hash("TestPass123"),
            first_name="Bob", last_name="RepB", user_type="salesman", commission_rate=15.0,
        )
        db.add_all([admin, rep_a, rep_b])
        db.commit()
        for u in (admin, rep_a, rep_b):
            db.refresh(u)
            created_user_ids.append(u.id)

        admin_token = create_access_token(
            data={"sub": admin.email}, expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        state = {
            "client": TestClient(app),
            "db": db,
            "admin_token": admin_token,
            "rep_a": rep_a,
            "rep_b": rep_b,
            "created_user_ids": created_user_ids,
            "created_referral_ids": created_referral_ids,
            "created_payout_ids": created_payout_ids,
        }
        yield state
    finally:
        db2 = SessionLocal()
        try:
            db2.query(ReferralSignup).filter(
                ReferralSignup.dealer_user_id.in_(created_user_ids)
            ).delete(synchronize_session=False)
            db2.query(CommissionPayout).filter(
                CommissionPayout.sales_rep_id.in_(created_user_ids)
            ).delete(synchronize_session=False)
            # Reassigning to a rep with no existing referral row auto-creates
            # an AffiliateAccount for them (_ensure_sales_rep_affiliate_account)
            # — must be cleaned up before deleting the rep's User row (FK).
            db2.query(AffiliateAccount).filter(
                AffiliateAccount.user_id.in_(created_user_ids)
            ).delete(synchronize_session=False)
            db2.query(User).filter(User.id.in_(created_user_ids)).delete(synchronize_session=False)
            db2.commit()
        finally:
            db2.close()
        db.close()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _make_dealer(db, prefix="dealer", user_type="dealer", tier="pro", paid=True, assigned_rep_id=None):
    from datetime import datetime
    user = User(
        email=_unique_email(prefix), password_hash=get_password_hash("TestPass123"),
        first_name="Test", last_name=prefix.title(), user_type=user_type,
        subscription_tier=tier, active=True,
        subscription_start_date=datetime.utcnow() if paid else None,
        assigned_sales_rep_id=assigned_rep_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_reassign_moves_unpaid_referral(payout_fixture):
    s = payout_fixture
    db = s["db"]
    dealer = _make_dealer(db, "reassign1", assigned_rep_id=s["rep_a"].id)
    referral = ReferralSignup(
        dealer_user_id=dealer.id, source_type="sales_rep", sales_rep_id=s["rep_a"].id,
        effective_monthly_price=199.0, commission_rate=10.0,
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)
    s["created_user_ids"].append(dealer.id)

    res = s["client"].post(
        "/api/admin/assign-sales-rep",
        headers=_auth(s["admin_token"]),
        json={"dealer_id": dealer.id, "sales_rep_id": s["rep_b"].id},
    )
    assert res.status_code == 200, res.text
    assert res.json()["action"] == "reassigned"

    db2 = SessionLocal()
    try:
        refreshed = db2.query(ReferralSignup).filter(ReferralSignup.id == referral.id).first()
        assert refreshed.sales_rep_id == s["rep_b"].id
        assert refreshed.source_type == "admin_reassign"
        count = db2.query(ReferralSignup).filter(ReferralSignup.dealer_user_id == dealer.id).count()
        assert count == 1  # corrected in place, not duplicated
    finally:
        db2.close()


def test_reassign_after_payout_creates_fresh_row(payout_fixture):
    s = payout_fixture
    db = s["db"]
    dealer = _make_dealer(db, "reassign2", assigned_rep_id=s["rep_a"].id)

    payout = CommissionPayout(sales_rep_id=s["rep_a"].id, amount=19.9, referral_count=1)
    db.add(payout)
    db.commit()
    db.refresh(payout)
    s["created_payout_ids"].append(payout.id)

    paid_referral = ReferralSignup(
        dealer_user_id=dealer.id, source_type="sales_rep", sales_rep_id=s["rep_a"].id,
        effective_monthly_price=199.0, commission_rate=10.0, payout_id=payout.id,
    )
    db.add(paid_referral)
    db.commit()
    db.refresh(paid_referral)
    s["created_user_ids"].append(dealer.id)

    res = s["client"].post(
        "/api/admin/assign-sales-rep",
        headers=_auth(s["admin_token"]),
        json={"dealer_id": dealer.id, "sales_rep_id": s["rep_b"].id},
    )
    assert res.status_code == 200, res.text

    db2 = SessionLocal()
    try:
        original = db2.query(ReferralSignup).filter(ReferralSignup.id == paid_referral.id).first()
        assert original.sales_rep_id == s["rep_a"].id  # untouched
        assert original.payout_id == payout.id

        new_rows = db2.query(ReferralSignup).filter(
            ReferralSignup.dealer_user_id == dealer.id,
            ReferralSignup.id != paid_referral.id,
        ).all()
        assert len(new_rows) == 1
        assert new_rows[0].sales_rep_id == s["rep_b"].id
        assert new_rows[0].payout_id is None
    finally:
        db2.close()


def test_unassign_clears_pointer_leaves_referral(payout_fixture):
    s = payout_fixture
    db = s["db"]
    dealer = _make_dealer(db, "unassign1", assigned_rep_id=s["rep_a"].id)
    referral = ReferralSignup(
        dealer_user_id=dealer.id, source_type="sales_rep", sales_rep_id=s["rep_a"].id,
        effective_monthly_price=199.0, commission_rate=10.0,
    )
    db.add(referral)
    db.commit()
    s["created_user_ids"].append(dealer.id)

    res = s["client"].post(
        "/api/admin/assign-sales-rep",
        headers=_auth(s["admin_token"]),
        json={"dealer_id": dealer.id, "sales_rep_id": None},
    )
    assert res.status_code == 200, res.text
    assert res.json()["action"] == "unassigned"

    db2 = SessionLocal()
    try:
        refreshed_dealer = db2.query(User).filter(User.id == dealer.id).first()
        assert refreshed_dealer.assigned_sales_rep_id is None
        refreshed_referral = db2.query(ReferralSignup).filter(ReferralSignup.id == referral.id).first()
        assert refreshed_referral.sales_rep_id == s["rep_a"].id  # untouched
    finally:
        db2.close()


def test_reassign_accepts_private_seller(payout_fixture):
    s = payout_fixture
    db = s["db"]
    seller = _make_dealer(db, "privresassign", user_type="private", tier="private_active", assigned_rep_id=s["rep_a"].id)
    s["created_user_ids"].append(seller.id)

    res = s["client"].post(
        "/api/admin/assign-sales-rep",
        headers=_auth(s["admin_token"]),
        json={"dealer_id": seller.id, "sales_rep_id": s["rep_b"].id},
    )
    assert res.status_code == 200, res.text

    db2 = SessionLocal()
    try:
        refreshed = db2.query(User).filter(User.id == seller.id).first()
        assert refreshed.assigned_sales_rep_id == s["rep_b"].id
    finally:
        db2.close()


def test_gap_account_backfilled_and_paid(payout_fixture):
    """Account assigned to a rep with zero ReferralSignup rows ever (the
    provision_user_account gap) must still get caught by confirm-payout."""
    s = payout_fixture
    db = s["db"]
    dealer = _make_dealer(db, "gap1", tier="pro", paid=True, assigned_rep_id=s["rep_a"].id)
    s["created_user_ids"].append(dealer.id)

    res = s["client"].post(
        f"/api/admin/sales-reps/{s['rep_a'].id}/confirm-payout",
        headers=_auth(s["admin_token"]),
        json={},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    s["created_payout_ids"].append(body["payout_id"])
    assert body["total_commission_owed"] == pytest.approx(199.0 * 0.10, rel=1e-3)
    assert len(body["line_items"]) == 1
    assert body["line_items"][0]["backfilled"] is True

    db2 = SessionLocal()
    try:
        backfilled = db2.query(ReferralSignup).filter(ReferralSignup.dealer_user_id == dealer.id).first()
        assert backfilled is not None
        assert backfilled.payout_id == body["payout_id"]
    finally:
        db2.close()


def test_statement_twice_zeroes_out(payout_fixture):
    s = payout_fixture
    db = s["db"]
    dealer = _make_dealer(db, "zero1", assigned_rep_id=s["rep_a"].id)
    referral = ReferralSignup(
        dealer_user_id=dealer.id, source_type="sales_rep", sales_rep_id=s["rep_a"].id,
        effective_monthly_price=199.0, commission_rate=10.0,
    )
    db.add(referral)
    db.commit()
    s["created_user_ids"].append(dealer.id)

    res1 = s["client"].get(f"/api/admin/sales-reps/{s['rep_a'].id}/payout-statement", headers=_auth(s["admin_token"]))
    assert res1.status_code == 200
    assert res1.json()["total_commission_owed"] == pytest.approx(19.9, rel=1e-3)

    confirm = s["client"].post(f"/api/admin/sales-reps/{s['rep_a'].id}/confirm-payout", headers=_auth(s["admin_token"]), json={})
    assert confirm.status_code == 200
    s["created_payout_ids"].append(confirm.json()["payout_id"])

    res2 = s["client"].get(f"/api/admin/sales-reps/{s['rep_a'].id}/payout-statement", headers=_auth(s["admin_token"]))
    assert res2.status_code == 200
    assert res2.json()["total_commission_owed"] == 0
    assert res2.json()["line_item_count"] == 0


def test_private_sellers_included_identically(payout_fixture):
    s = payout_fixture
    db = s["db"]
    seller = _make_dealer(db, "privpayout", user_type="private", tier="private_active", assigned_rep_id=s["rep_a"].id)
    referral = ReferralSignup(
        dealer_user_id=seller.id, source_type="sales_rep", sales_rep_id=s["rep_a"].id,
        effective_monthly_price=149.0, commission_rate=10.0,
    )
    db.add(referral)
    db.commit()
    s["created_user_ids"].append(seller.id)

    res = s["client"].get(f"/api/admin/sales-reps/{s['rep_a'].id}/payout-statement", headers=_auth(s["admin_token"]))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["line_item_count"] == 1
    assert body["line_items"][0]["user_type"] == "private"
    assert body["total_commission_owed"] == pytest.approx(14.9, rel=1e-3)


def test_unpaid_customer_not_included_in_payout(payout_fixture):
    s = payout_fixture
    db = s["db"]
    dealer = _make_dealer(db, "unpaid1", paid=False, assigned_rep_id=s["rep_a"].id)
    referral = ReferralSignup(
        dealer_user_id=dealer.id, source_type="sales_rep", sales_rep_id=s["rep_a"].id,
        effective_monthly_price=199.0, commission_rate=10.0,
    )
    db.add(referral)
    db.commit()
    s["created_user_ids"].append(dealer.id)

    res = s["client"].get(f"/api/admin/sales-reps/{s['rep_a'].id}/payout-statement", headers=_auth(s["admin_token"]))
    assert res.status_code == 200
    assert res.json()["total_commission_owed"] == 0
    assert res.json()["line_item_count"] == 0

    confirm = s["client"].post(f"/api/admin/sales-reps/{s['rep_a'].id}/confirm-payout", headers=_auth(s["admin_token"]), json={})
    assert confirm.status_code == 200
    if confirm.json().get("payout_id"):
        s["created_payout_ids"].append(confirm.json()["payout_id"])

    db2 = SessionLocal()
    try:
        refreshed = db2.query(ReferralSignup).filter(ReferralSignup.id == referral.id).first()
        assert refreshed.payout_id is None  # never marked paid — customer hasn't paid yet
    finally:
        db2.close()
