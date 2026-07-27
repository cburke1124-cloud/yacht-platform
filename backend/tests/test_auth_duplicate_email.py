"""
Login and get_current_user must never resolve to (or authenticate as) a
soft-deleted account. Before this fix, both queried `users` by email alone
(`WHERE email = :email LIMIT 1` / `.filter(User.email == email).first()`)
with no `deleted_at` filter -- a soft-deleted account whose password is
still known could log in and be treated as a fully normal active session.

Note: this repo's `users` table currently carries a legacy plain unique
index on `email` (`ix_users_email`) left over from before the soft-delete
migration (004_soft_delete_users.py), which added a *partial* unique index
`ix_users_email_active` (`WHERE deleted_at IS NULL`) specifically so a
deleted account's email could be reused by a new one. The old index was
never dropped, so two rows can't currently share an email in practice --
but the deleted_at filter added here is still correct: it's what makes
`get_current_user`/`login` behave as the partial index's presence implies
they should, and it's what would actually protect against the wrong-row
resolution once that legacy index is cleaned up.
"""
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.security.auth import get_password_hash, create_access_token
from app.core.config import settings
from datetime import timedelta


def _unique_email() -> str:
    return f"pytest-softdel-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def deleted_account():
    email = _unique_email()
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=get_password_hash("OldPass123"),
            first_name="Old", last_name="Account", user_type="dealer",
            deleted_at=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        state = {"client": TestClient(app), "email": email, "user_id": user.id}
        yield state
    finally:
        db2 = SessionLocal()
        try:
            db2.query(User).filter(User.id == state["user_id"]).delete()
            db2.commit()
        finally:
            db2.close()
        db.close()


def test_login_rejects_soft_deleted_account(deleted_account):
    s = deleted_account
    res = s["client"].post("/api/auth/login", json={"email": s["email"], "password": "OldPass123"})
    assert res.status_code in (400, 401), res.text


def test_get_current_user_rejects_soft_deleted_account(deleted_account):
    """Covers the case where a soft-deleted account somehow still holds a
    previously-issued, unexpired token (e.g. deleted seconds after a
    request went out) -- get_current_user must not honor it either."""
    s = deleted_account
    token = create_access_token(
        data={"sub": s["email"]},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    res = s["client"].get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401, res.text
