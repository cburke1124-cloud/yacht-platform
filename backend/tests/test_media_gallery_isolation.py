"""
Cross-broker media gallery isolation. Hits the real app + dev database —
creates its throwaway users/media/charters once for the module and cleans
up at the end.

Covers the fix for: an admin managing a scraped charter listing draft on
behalf of one broker was seeing/uploading into whichever media pool the
*admin's own* login happened to be scoped to, mixing photos across
unrelated brokers. Also covers the two related gaps found alongside it:
GET .../media having no auth at all, and attach endpoints trusting bare
`user_id == current_user.id` (bypassed entirely for admins) instead of
org-wide scoping.

Users are created directly in the DB (not via /auth/register) and tokens
are minted directly with create_access_token — /auth/register is
rate-limited per-process (see test_unpaid_broker_listing_gate.py's docstring
for the same constraint) and every other test file in the suite also
registers accounts, so going through the real endpoint here made this file's
setup flaky when run as part of the full suite.
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
from app.models.media import MediaFile
from app.models.charter import CharterListing


def _unique_email() -> str:
    return f"pytest-{uuid.uuid4().hex[:10]}@example.com"


def _make_user(email: str, user_type: str = "dealer") -> tuple[int, str]:
    """Create a user directly in the DB and mint a token for them, mirroring
    what /auth/register does, without going through that rate-limited route."""
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=get_password_hash("TestPass123"),
            first_name="Test",
            last_name="Broker",
            user_type=user_type,
            company_name="Pytest Brokerage",
            subscription_tier="free",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(
            data={"sub": user.email},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return user.id, token
    finally:
        db.close()


@pytest.fixture(scope="module")
def accounts():
    """Three shared accounts (broker A, broker B, admin) for the whole module."""
    broker_a_email = _unique_email()
    broker_b_email = _unique_email()
    admin_email = _unique_email()

    a_client, b_client, admin_client, anon_client = (
        TestClient(app), TestClient(app), TestClient(app), TestClient(app)
    )
    broker_a_id, a_token = _make_user(broker_a_email)
    broker_b_id, b_token = _make_user(broker_b_email)
    _admin_id, admin_token = _make_user(admin_email, user_type="admin")

    state = {
        "a_client": a_client, "b_client": b_client,
        "admin_client": admin_client, "anon_client": anon_client,
        "a_headers": {"Authorization": f"Bearer {a_token}"},
        "b_headers": {"Authorization": f"Bearer {b_token}"},
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "broker_a_email": broker_a_email, "broker_b_email": broker_b_email,
        "admin_email": admin_email,
        "broker_a_id": broker_a_id, "broker_b_id": broker_b_id,
        "media_ids": [], "charter_ids": [],
    }
    yield state

    db = SessionLocal()
    try:
        for charter_id in state["charter_ids"]:
            c = db.query(CharterListing).filter(CharterListing.id == charter_id).first()
            if c:
                db.delete(c)
        db.commit()
        for media_id in state["media_ids"]:
            m = db.query(MediaFile).filter(MediaFile.id == media_id).first()
            if m:
                db.delete(m)
        db.commit()
        for email in (broker_a_email, broker_b_email, admin_email):
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.delete(u)
        db.commit()
    finally:
        db.close()


def _make_media_for(user_id: int, filename: str) -> int:
    db = SessionLocal()
    try:
        media = MediaFile(
            user_id=user_id,
            filename=filename,
            url=f"https://example.com/{filename}",
            file_type="image",
            file_size_mb=0.1,
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        return media.id
    finally:
        db.close()


def _make_charter_for(user_id: int, status: str = "draft") -> int:
    db = SessionLocal()
    try:
        charter = CharterListing(
            user_id=user_id,
            title="Pytest Charter",
            vessel_name="Pytest Vessel",
            slug=f"pytest-charter-{uuid.uuid4().hex[:10]}",
            status=status,
        )
        db.add(charter)
        db.commit()
        db.refresh(charter)
        return charter.id
    finally:
        db.close()


def test_admin_as_dealer_id_scopes_my_media_to_that_dealer(accounts):
    media_a_id = _make_media_for(accounts["broker_a_id"], "brokerA-test.jpg")
    accounts["media_ids"].append(media_a_id)

    admin_client = accounts["admin_client"]
    admin_headers = accounts["admin_headers"]

    # Admin browsing "as" broker A sees broker A's media.
    res = admin_client.get(
        f"/api/media/my-media?as_dealer_id={accounts['broker_a_id']}", headers=admin_headers
    )
    assert res.status_code == 200, res.text
    ids = [m["id"] for m in res.json()["media"]]
    assert media_a_id in ids

    # Admin browsing "as" broker B does NOT see broker A's media.
    res = admin_client.get(
        f"/api/media/my-media?as_dealer_id={accounts['broker_b_id']}", headers=admin_headers
    )
    assert res.status_code == 200, res.text
    ids = [m["id"] for m in res.json()["media"]]
    assert media_a_id not in ids

    # Admin with no override sees only their own (empty) library, not broker A's.
    res = admin_client.get("/api/media/my-media", headers=admin_headers)
    assert res.status_code == 200, res.text
    ids = [m["id"] for m in res.json()["media"]]
    assert media_a_id not in ids


def test_non_admin_cannot_use_as_dealer_id_override(accounts):
    res = accounts["a_client"].get(
        f"/api/media/my-media?as_dealer_id={accounts['broker_b_id']}",
        headers=accounts["a_headers"],
    )
    assert res.status_code == 403


def test_attach_charter_media_scoped_to_org_not_bare_user_id(accounts):
    media_a_id = _make_media_for(accounts["broker_a_id"], "brokerA-charter.jpg")
    accounts["media_ids"].append(media_a_id)
    charter_b_id = _make_charter_for(accounts["broker_b_id"], status="draft")
    accounts["charter_ids"].append(charter_b_id)

    admin_client = accounts["admin_client"]
    admin_headers = accounts["admin_headers"]

    # Admin attaches broker A's media to broker B's charter with NO
    # as_dealer_id override — must be silently skipped, not attached, since
    # the admin's own org doesn't include broker A's media.
    res = admin_client.post(
        f"/api/charter/{charter_b_id}/media/attach",
        json={"media_ids": [media_a_id]},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["attached"] == 0

    res = admin_client.get(f"/api/charter/{charter_b_id}/media", headers=admin_headers)
    assert res.status_code == 200
    assert all(m["id"] != media_a_id for m in res.json()["media"])


def test_get_charter_media_gated_for_draft_public_for_active(accounts):
    draft_charter_id = _make_charter_for(accounts["broker_a_id"], status="draft")
    accounts["charter_ids"].append(draft_charter_id)
    active_charter_id = _make_charter_for(accounts["broker_a_id"], status="active")
    accounts["charter_ids"].append(active_charter_id)

    anon_client = accounts["anon_client"]

    # Logged out: draft is hidden, active is public.
    res = anon_client.get(f"/api/charter/{draft_charter_id}/media")
    assert res.status_code == 404
    res = anon_client.get(f"/api/charter/{active_charter_id}/media")
    assert res.status_code == 200

    # Unrelated broker B: draft still hidden.
    res = accounts["b_client"].get(
        f"/api/charter/{draft_charter_id}/media", headers=accounts["b_headers"]
    )
    assert res.status_code == 404

    # Owner broker A: draft is visible to them.
    res = accounts["a_client"].get(
        f"/api/charter/{draft_charter_id}/media", headers=accounts["a_headers"]
    )
    assert res.status_code == 200
