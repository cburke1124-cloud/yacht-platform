"""Admin/sales-granted trials: access while active, reminder cadence, win-back."""
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.main import app  # noqa: F401  (registers every model for the mapper)
from app.db.session import SessionLocal
from app.models.user import User
from app.services.billing_status import user_has_paid
from app.services import trials


@pytest.fixture
def db():
    s = SessionLocal()
    created = []
    s.created = created
    yield s
    for uid in created:
        u = s.query(User).filter(User.id == uid).first()
        if u:
            s.delete(u)
    s.commit()
    s.close()


def _user(db, **kw):
    u = User(
        email=f"pytest-trial-{uuid.uuid4().hex[:10]}@example.com",
        password_hash="x", first_name="T", last_name="U",
        user_type="private", subscription_tier="free", active=True, **kw,
    )
    db.add(u)
    db.commit()
    db.created.append(u.id)
    return u


def _run(db):
    with patch.object(trials.email_service, "send_trial_reminder_email", return_value=True) as m:
        trials.run_trial_reminders(db)
    return m


def test_trial_grants_access_until_it_expires(db):
    u = _user(db)
    assert not user_has_paid(u)
    trials.apply_trial(u, 14)
    assert user_has_paid(u)
    u.trial_end_date = datetime.utcnow() - timedelta(hours=1)
    assert not user_has_paid(u)


def test_pre_expiry_reminder_sent_once(db):
    u = _user(db)
    trials.apply_trial(u, 14)
    u.trial_end_date = datetime.utcnow() + timedelta(days=2, hours=1)
    db.commit()
    m = _run(db)
    assert m.call_count == 1 and m.call_args.kwargs["kind"] == "pre"
    assert _run(db).call_count == 0  # idempotent


def test_short_trial_skips_wider_reminders(db):
    u = _user(db)
    trials.apply_trial(u, 2)
    db.commit()
    m = _run(db)
    # 2 days left falls in the 3-day window only — never a "7 days" email
    assert m.call_count == 1 and m.call_args.kwargs["days"] <= 3


def test_expired_trial_gets_two_winback_emails_and_goes_inactive(db):
    u = _user(db)
    trials.apply_trial(u, 7)
    u.trial_end_date = datetime.utcnow() - timedelta(days=1, hours=1)
    db.commit()
    assert _run(db).call_count == 1
    db.refresh(u)
    assert u.trial_active is False
    assert _run(db).call_count == 0
    u.trial_end_date = datetime.utcnow() - timedelta(days=8)
    db.commit()
    m = _run(db)
    assert m.call_count == 1 and m.call_args.kwargs["kind"] == "post"
    assert _run(db).call_count == 0


def test_paid_user_gets_no_reminders(db):
    u = _user(db, subscription_start_date=datetime.utcnow())
    trials.apply_trial(u, 1)
    assert _run(db).call_count == 0


def test_manually_ended_trial_sends_no_winback(db):
    u = _user(db)
    trials.apply_trial(u, 5)
    trials.apply_trial(u, 0)
    db.commit()
    u.trial_end_date = datetime.utcnow() - timedelta(days=8)
    db.commit()
    assert _run(db).call_count == 0
    assert not user_has_paid(u)


def test_start_trial_endpoint_requires_staff():
    from fastapi.testclient import TestClient
    r = TestClient(app).post("/api/auth/start-trial", json={"email": "x@example.com", "password": "TestPass123"})
    assert r.status_code in (401, 403)
