"""
Auth flow smoke tests: register/login/me/logout, and the 2FA verification
lockout. Hits the real app + dev database (matching the manual verification
pattern used during development) — each test creates and cleans up its own
throwaway user, and uses its own TestClient so cookie state never leaks
between tests.
"""
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.dealer import TwoFactorCode


def _unique_email() -> str:
    return f"pytest-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def cleanup_users():
    emails = []
    yield emails
    db = SessionLocal()
    try:
        for email in emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.query(TwoFactorCode).filter(TwoFactorCode.user_id == user.id).delete()
                db.delete(user)
        db.commit()
    finally:
        db.close()


def _register(client: TestClient, email: str, password: str = "TestPass123"):
    return client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": "User",
            "user_type": "user",
            "agree_terms": True,
            "agree_communications": True,
        },
    )


def test_register_sets_httponly_cookie(client, cleanup_users):
    email = _unique_email()
    cleanup_users.append(email)

    res = _register(client, email)
    assert res.status_code == 200
    assert "access_token" in res.json()
    assert "access_token" in res.cookies
    # httpOnly cookies aren't exposed to JS, but the Set-Cookie header is
    # still visible here — confirm the flag is actually set.
    assert "HttpOnly" in res.headers.get("set-cookie", "")


def test_me_works_via_cookie_alone(client, cleanup_users):
    email = _unique_email()
    cleanup_users.append(email)
    _register(client, email)

    # TestClient persists cookies across requests on the same client instance.
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == email


def test_logout_clears_cookie_and_revokes_session(client, cleanup_users):
    email = _unique_email()
    cleanup_users.append(email)
    _register(client, email)

    assert client.get("/api/auth/me").status_code == 200

    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    assert client.get("/api/auth/me").status_code == 401


def test_login_wrong_password_fails(client, cleanup_users):
    email = _unique_email()
    cleanup_users.append(email)
    _register(client, email)
    client.post("/api/auth/logout")

    res = client.post("/api/auth/login", json={"email": email, "password": "wrong-password"})
    assert res.status_code == 401


def test_2fa_verification_locks_out_after_five_failed_attempts(client, cleanup_users):
    email = _unique_email()
    cleanup_users.append(email)
    _register(client, email)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user.two_factor_enabled = True
        db.add(TwoFactorCode(
            user_id=user.id,
            code="123456",
            expires_at=datetime.utcnow() + timedelta(minutes=10),
        ))
        db.commit()
    finally:
        db.close()

    for _ in range(5):
        res = client.post("/api/auth/2fa/verify-code", json={"email": email, "code": "000000"})
        assert res.status_code == 401

    # 6th attempt is locked out even though we haven't tried the real code yet
    locked_res = client.post("/api/auth/2fa/verify-code", json={"email": email, "code": "000000"})
    assert locked_res.status_code == 401
    assert "Too many failed attempts" in locked_res.json().get("error", "")
