"""
Pay-first registration: verifies that no User row is created for a
dealer/private-seller signup until Stripe confirms payment, and that
finalize_registration (and the webhook's equivalent path) creates the
account exactly once. Stripe calls are mocked — no network access.
"""
import uuid
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.misc import PendingRegistration


def _unique_email() -> str:
    return f"pytest-pending-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def cleanup(client):
    emails = []
    yield emails
    db = SessionLocal()
    try:
        for email in emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.delete(user)
            db.query(PendingRegistration).filter(PendingRegistration.email == email).delete()
        db.commit()
    finally:
        db.close()


def _start_checkout(client: TestClient, email: str, user_type: str = "private"):
    return client.post(
        "/api/payments/start-registration-checkout",
        json={
            "email": email,
            "password": "TestPass123",
            "first_name": "Test",
            "last_name": "Seller",
            "phone": "5555550100",
            "user_type": user_type,
            "agree_terms": True,
            "agree_communications": True,
            "return_url": "http://localhost:3000/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}",
        },
    )


def test_start_checkout_creates_no_user_row(client, cleanup):
    email = _unique_email()
    cleanup.append(email)

    fake_session = SimpleNamespace(id="cs_test_fake123", client_secret="cs_test_fake123_secret")
    with patch("app.api.routes_payments.stripe.checkout.Session.create", return_value=fake_session):
        res = _start_checkout(client, email)

    assert res.status_code == 200
    body = res.json()
    assert body["client_secret"] == "cs_test_fake123_secret"
    assert body["session_id"] == "cs_test_fake123"

    db = SessionLocal()
    try:
        assert db.query(User).filter(User.email == email).first() is None
        pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
        assert pending is not None
        assert pending.stripe_checkout_session_id == "cs_test_fake123"
        assert pending.password_hash != "TestPass123"  # never stored in plaintext
    finally:
        db.close()


def test_finalize_registration_creates_user_after_payment(client, cleanup):
    email = _unique_email()
    cleanup.append(email)

    fake_create = SimpleNamespace(id="cs_test_fake456", client_secret="cs_test_fake456_secret")
    with patch("app.api.routes_payments.stripe.checkout.Session.create", return_value=fake_create):
        res = _start_checkout(client, email, user_type="private")
    session_id = res.json()["session_id"]

    db = SessionLocal()
    pending_id = db.query(PendingRegistration).filter(PendingRegistration.email == email).first().id
    db.close()

    fake_paid_session = SimpleNamespace(
        payment_status="paid",
        customer="cus_test_fake",
        metadata={"pending_registration_id": str(pending_id), "subscription_tier": "private_active"},
    )
    with patch("app.api.routes_payments.stripe.checkout.Session.retrieve", return_value=fake_paid_session):
        finalize_res = client.post("/api/payments/finalize-registration", json={"session_id": session_id})

    assert finalize_res.status_code == 200
    body = finalize_res.json()
    assert body["access_token"]
    assert body["subscription_tier"] == "private_active"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.subscription_tier == "private_active"
        assert user.subscription_start_date is not None
        assert user.stripe_customer_id == "cus_test_fake"
    finally:
        db.close()

    # Idempotent: calling finalize again (e.g. webhook racing the frontend)
    # must not create a second user or error out.
    with patch("app.api.routes_payments.stripe.checkout.Session.retrieve", return_value=fake_paid_session):
        second_res = client.post("/api/payments/finalize-registration", json={"session_id": session_id})
    assert second_res.status_code == 200

    db = SessionLocal()
    try:
        count = db.query(User).filter(User.email == email).count()
        assert count == 1
    finally:
        db.close()


def test_finalize_registration_rejects_unpaid_session(client, cleanup):
    email = _unique_email()
    cleanup.append(email)

    fake_create = SimpleNamespace(id="cs_test_fake789", client_secret="cs_test_fake789_secret")
    with patch("app.api.routes_payments.stripe.checkout.Session.create", return_value=fake_create):
        res = _start_checkout(client, email)
    session_id = res.json()["session_id"]

    fake_unpaid_session = SimpleNamespace(payment_status="unpaid", customer=None, metadata={})
    with patch("app.api.routes_payments.stripe.checkout.Session.retrieve", return_value=fake_unpaid_session):
        finalize_res = client.post("/api/payments/finalize-registration", json={"session_id": session_id})

    assert finalize_res.status_code == 402

    db = SessionLocal()
    try:
        assert db.query(User).filter(User.email == email).first() is None
    finally:
        db.close()
