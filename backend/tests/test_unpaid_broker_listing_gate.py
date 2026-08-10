"""
Listing creation should never be blocked purely by payment status — only
publication should be gated. This covers the fix where subscription_tier
text (which a sales-rep/admin can set directly without any Stripe payment)
was being trusted as "has paid", both for the hard creation block and for
public-visibility filtering. The real signal is subscription_start_date,
only ever set by a confirmed Stripe webhook/session-confirm.

Uses a single registered account across all three scenarios (mutating its
paid status in the DB between listing-creation calls) rather than
registering three separate accounts, since /auth/register is rate-limited
per-process and this file already runs alongside other test files that
also register accounts.
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


@pytest.fixture
def client():
    return TestClient(app)


def test_listing_creation_gated_on_real_payment_not_tier_text(client):
    email = _unique_email()
    db = SessionLocal()
    listing_ids: list[int] = []
    try:
        res = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": "TestPass123",
                "first_name": "Test",
                "last_name": "Dealer",
                "user_type": "dealer",
                "company_name": "Pytest Brokerage",
                "phone": "+15555550100",
                "agree_terms": True,
                "agree_communications": True,
            },
        )
        assert res.status_code == 200, res.text
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Freshly self-registered broker, no Stripe checkout yet:
        # subscription_tier stays "free", subscription_start_date is null.
        # Creation must succeed but be forced to draft.
        res = client.post(
            "/api/listings/",
            json={"title": "Pytest Unpaid Listing", "bin": "", "status": "active"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        listing_ids.append(body["id"])
        assert body["status"] == "draft"

        # 2. Sales-rep/admin manually created broker: subscription_tier is set
        # directly to a paid-looking value with no real Stripe payment
        # (subscription_start_date stays null). Must still be forced to draft
        # despite the paid-looking tier.
        user = db.query(User).filter(User.email == email).first()
        user.subscription_tier = "pro"
        db.commit()

        res = client.post(
            "/api/listings/",
            json={"title": "Pytest Fake-Paid Listing", "bin": "", "status": "active"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        listing_ids.append(body["id"])
        assert body["status"] == "draft"

        # 3. A real confirmed payment (subscription_start_date set) — now the
        # listing can actually go active.
        user.subscription_start_date = datetime.utcnow()
        db.commit()

        res = client.post(
            "/api/listings/",
            json={"title": "Pytest Paid Listing", "bin": "", "status": "active"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        listing_ids.append(body["id"])
        assert body["status"] == "active"
    finally:
        for listing_id in listing_ids:
            listing = db.query(Listing).filter(Listing.id == listing_id).first()
            if listing:
                db.delete(listing)
        db.commit()
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.delete(user)
        db.commit()
        db.close()
