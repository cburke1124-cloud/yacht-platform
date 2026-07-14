"""
POST /media/{id}/replace — used by the crop/rotate "Edit" action on an
already-uploaded photo. Verifies the MediaFile id stays stable (so existing
attachments elsewhere keep working) while the url/dimensions actually change,
and that it's org-scoped like every other media endpoint.
"""
import io
import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.core.config import settings
from app.security.auth import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.user import User
from app.models.media import MediaFile


def _unique_email() -> str:
    return f"pytest-replace-{uuid.uuid4().hex[:10]}@example.com"


def _make_user(email: str, user_type: str = "dealer") -> tuple[int, str]:
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=get_password_hash("TestPass123"),
            first_name="Test",
            last_name="Broker",
            user_type=user_type,
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


def _png_bytes(size=(40, 30), color=(255, 0, 0)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def dealer():
    email = _unique_email()
    user_id, token = _make_user(email)
    state = {
        "user_id": user_id, "client": TestClient(app),
        "headers": {"Authorization": f"Bearer {token}"},
        "media_ids": [],
    }
    yield state

    db = SessionLocal()
    try:
        for mid in state["media_ids"]:
            m = db.query(MediaFile).filter(MediaFile.id == mid).first()
            if m:
                db.delete(m)
        db.commit()
        u = db.query(User).filter(User.email == email).first()
        if u:
            db.delete(u)
        db.commit()
    finally:
        db.close()


def test_replace_keeps_id_but_changes_content(dealer):
    client, headers = dealer["client"], dealer["headers"]

    upload_res = client.post(
        "/api/media/upload",
        files={"file": ("original.png", _png_bytes((40, 30)), "image/png")},
        headers=headers,
    )
    assert upload_res.status_code == 200, upload_res.text
    media = upload_res.json()["media"]
    media_id = media["id"]
    original_url = media["url"]
    dealer["media_ids"].append(media_id)

    replace_res = client.post(
        f"/api/media/{media_id}/replace",
        files={"file": ("edited.png", _png_bytes((20, 20)), "image/png")},
        headers=headers,
    )
    assert replace_res.status_code == 200, replace_res.text
    replaced = replace_res.json()["media"]

    assert replaced["id"] == media_id  # same id — existing attachments unaffected
    assert replaced["url"] != original_url  # content actually changed
    assert replaced["width"] == 20 and replaced["height"] == 20

    list_res = client.get("/api/media/my-media", headers=headers)
    ids = [m["id"] for m in list_res.json()["media"]]
    assert ids.count(media_id) == 1  # no duplicate row created


def test_replace_rejects_non_owner(dealer):
    other_email = _unique_email()
    _, other_token = _make_user(other_email)

    upload_res = dealer["client"].post(
        "/api/media/upload",
        files={"file": ("mine.png", _png_bytes(), "image/png")},
        headers=dealer["headers"],
    )
    media_id = upload_res.json()["media"]["id"]
    dealer["media_ids"].append(media_id)

    res = dealer["client"].post(
        f"/api/media/{media_id}/replace",
        files={"file": ("hijack.png", _png_bytes(), "image/png")},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res.status_code == 404

    db = SessionLocal()
    try:
        db.query(User).filter(User.email == other_email).delete()
        db.commit()
    finally:
        db.close()


def test_replace_admin_requires_as_dealer_id_to_cross_org(dealer):
    """An admin editing a dealer's existing photo (e.g. from the dealer
    management screen) must declare as_dealer_id — same rule as upload/attach
    — a blanket "admin can replace any media" bypass would reintroduce the
    cross-broker leakage this session's earlier fix closed."""
    admin_email = _unique_email()
    admin_id, admin_token = _make_user(admin_email, user_type="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    upload_res = dealer["client"].post(
        "/api/media/upload",
        files={"file": ("dealer-logo.png", _png_bytes(), "image/png")},
        headers=dealer["headers"],
    )
    media_id = upload_res.json()["media"]["id"]
    dealer["media_ids"].append(media_id)

    # Admin with no as_dealer_id — scoped to their own (empty) org, not the dealer's.
    res = dealer["client"].post(
        f"/api/media/{media_id}/replace",
        files={"file": ("hijack.png", _png_bytes(), "image/png")},
        headers=admin_headers,
    )
    assert res.status_code == 404

    # Admin explicitly declares which dealer they're acting for — succeeds.
    res = dealer["client"].post(
        f"/api/media/{media_id}/replace",
        data={"as_dealer_id": str(dealer["user_id"])},
        files={"file": ("edited-logo.png", _png_bytes((15, 15)), "image/png")},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["media"]["id"] == media_id

    db = SessionLocal()
    try:
        db.query(User).filter(User.id == admin_id).delete()
        db.commit()
    finally:
        db.close()
