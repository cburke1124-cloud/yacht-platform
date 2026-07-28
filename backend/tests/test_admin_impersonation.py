"""
Admin "View As": POST /admin/users/{id}/impersonate mints a session for the
target account so support can see exactly what a dealer sees without
needing their password (prompted by a case where a shared password didn't
work). POST /admin/impersonate/exit restores the admin's own session.
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
from app.models.dealer import ActivityLog


def _unique_email(prefix: str) -> str:
    return f"pytest-imp-{prefix}-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def admin_and_dealer():
    admin_email = _unique_email("admin")
    dealer_email = _unique_email("dealer")
    other_email = _unique_email("other")
    db = SessionLocal()
    try:
        admin = User(
            email=admin_email, password_hash=get_password_hash("TestPass123"),
            first_name="Admin", last_name="User", user_type="admin",
        )
        dealer = User(
            email=dealer_email, password_hash=get_password_hash("TestPass123"),
            first_name="Jeremy", last_name="Broker", user_type="dealer",
            company_name="Tot Nautic", subscription_tier="free",
        )
        other_admin = User(
            email=other_email, password_hash=get_password_hash("TestPass123"),
            first_name="Other", last_name="Admin", user_type="admin",
        )
        db.add_all([admin, dealer, other_admin])
        db.commit()
        db.refresh(admin); db.refresh(dealer); db.refresh(other_admin)

        admin_token = create_access_token(
            data={"sub": admin.email}, expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        dealer_token = create_access_token(
            data={"sub": dealer.email}, expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        state = {
            "client": TestClient(app),
            "admin_id": admin.id, "admin_email": admin.email, "admin_token": admin_token,
            "dealer_id": dealer.id, "dealer_email": dealer.email, "dealer_token": dealer_token,
            "other_admin_id": other_admin.id,
        }
        yield state
    finally:
        db2 = SessionLocal()
        try:
            ids = [state["admin_id"], state["dealer_id"], state["other_admin_id"]]
            db2.query(ActivityLog).filter(ActivityLog.user_id.in_(ids)).delete(synchronize_session=False)
            db2.query(User).filter(User.id.in_(ids)).delete(synchronize_session=False)
            db2.commit()
        finally:
            db2.close()
        db.close()


def test_admin_can_view_as_dealer(admin_and_dealer):
    s = admin_and_dealer
    res = s["client"].post(
        f"/api/admin/users/{s['dealer_id']}/impersonate",
        headers={"Authorization": f"Bearer {s['admin_token']}"},
    )
    assert res.status_code == 200, res.text
    imp_token = res.json()["access_token"]

    me = s["client"].get("/api/auth/me", headers={"Authorization": f"Bearer {imp_token}"})
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["id"] == s["dealer_id"]
    assert body["impersonator"]["email"] == s["admin_email"]

    db = SessionLocal()
    try:
        log = db.query(ActivityLog).filter(
            ActivityLog.user_id == s["dealer_id"], ActivityLog.action == "admin_impersonation_start"
        ).first()
        assert log is not None
        assert log.details["admin_id"] == s["admin_id"]
    finally:
        db.close()


def test_non_admin_cannot_impersonate(admin_and_dealer):
    s = admin_and_dealer
    res = s["client"].post(
        f"/api/admin/users/{s['admin_id']}/impersonate",
        headers={"Authorization": f"Bearer {s['dealer_token']}"},
    )
    assert res.status_code in (401, 403), res.text


def test_cannot_impersonate_another_admin(admin_and_dealer):
    s = admin_and_dealer
    res = s["client"].post(
        f"/api/admin/users/{s['other_admin_id']}/impersonate",
        headers={"Authorization": f"Bearer {s['admin_token']}"},
    )
    assert res.status_code == 403, res.text


def test_exit_restores_admin_session(admin_and_dealer):
    s = admin_and_dealer
    start = s["client"].post(
        f"/api/admin/users/{s['dealer_id']}/impersonate",
        headers={"Authorization": f"Bearer {s['admin_token']}"},
    )
    imp_token = start.json()["access_token"]

    exit_res = s["client"].post(
        "/api/admin/impersonate/exit",
        headers={"Authorization": f"Bearer {imp_token}"},
    )
    assert exit_res.status_code == 200, exit_res.text
    restored_token = exit_res.json()["access_token"]

    me = s["client"].get("/api/auth/me", headers={"Authorization": f"Bearer {restored_token}"})
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["id"] == s["admin_id"]
    assert body["impersonator"] is None

    db = SessionLocal()
    try:
        log = db.query(ActivityLog).filter(
            ActivityLog.user_id == s["dealer_id"], ActivityLog.action == "admin_impersonation_end"
        ).first()
        assert log is not None
    finally:
        db.close()


def test_exit_without_active_impersonation_is_rejected(admin_and_dealer):
    s = admin_and_dealer
    res = s["client"].post(
        "/api/admin/impersonate/exit",
        headers={"Authorization": f"Bearer {s['admin_token']}"},
    )
    assert res.status_code == 400, res.text
