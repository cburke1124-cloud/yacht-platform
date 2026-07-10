"""
Media library folders end-to-end: create, list (with correct file counts),
move a file into one, and the org-scoping/as_dealer_id override that mirrors
the rest of routes_media.py. The frontend gallery previously mocked all of
this out entirely — these hit the real endpoints it now calls.
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
from app.models.media import MediaFile, MediaFolder


def _unique_email() -> str:
    return f"pytest-folders-{uuid.uuid4().hex[:10]}@example.com"


def _make_user(email: str, user_type: str = "dealer") -> tuple[int, str]:
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
def dealer():
    email = _unique_email()
    user_id, token = _make_user(email)
    state = {
        "user_id": user_id, "client": TestClient(app),
        "headers": {"Authorization": f"Bearer {token}"},
        "folder_ids": [], "media_ids": [],
    }
    yield state

    db = SessionLocal()
    try:
        for mid in state["media_ids"]:
            m = db.query(MediaFile).filter(MediaFile.id == mid).first()
            if m:
                db.delete(m)
        db.commit()
        for fid in state["folder_ids"]:
            f = db.query(MediaFolder).filter(MediaFolder.id == fid).first()
            if f:
                db.delete(f)
        db.commit()
        u = db.query(User).filter(User.email == email).first()
        if u:
            db.delete(u)
        db.commit()
    finally:
        db.close()


def _make_media(user_id: int, filename: str) -> int:
    db = SessionLocal()
    try:
        media = MediaFile(
            user_id=user_id, filename=filename, url=f"https://example.com/{filename}",
            file_type="image", file_size_mb=0.1,
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        return media.id
    finally:
        db.close()


def test_create_list_and_move_into_folder(dealer):
    client, headers = dealer["client"], dealer["headers"]

    res = client.post("/api/media/folders", params={"name": "Engine Room"}, headers=headers)
    assert res.status_code == 200, res.text
    folder = res.json()
    assert folder["name"] == "Engine Room"
    assert folder["file_count"] == 0
    dealer["folder_ids"].append(folder["id"])

    res = client.get("/api/media/folders", headers=headers)
    assert res.status_code == 200
    names = [f["name"] for f in res.json()["folders"]]
    assert "Engine Room" in names

    media_id = _make_media(dealer["user_id"], "engine.jpg")
    dealer["media_ids"].append(media_id)

    res = client.patch(f"/api/media/{media_id}/folder", params={"folder_id": folder["id"]}, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["folder_id"] == folder["id"]

    res = client.get("/api/media/folders", headers=headers)
    updated = next(f for f in res.json()["folders"] if f["id"] == folder["id"])
    assert updated["file_count"] == 1

    res = client.get("/api/media/my-media", params={"folder_id": folder["id"]}, headers=headers)
    assert res.status_code == 200
    ids = [m["id"] for m in res.json()["media"]]
    assert media_id in ids

    # Move back to root.
    res = client.patch(f"/api/media/{media_id}/folder", headers=headers)
    assert res.status_code == 200
    assert res.json()["folder_id"] is None


def test_move_to_folder_allows_team_member_uploads(dealer):
    """The endpoint previously required MediaFile.user_id == current_user.id
    exactly — a team member's own upload couldn't be filed into a folder by
    anyone including the dealer who owns the org. Verify org-scoping now."""
    sub_email = _unique_email()
    db = SessionLocal()
    try:
        sub_user = User(
            email=sub_email,
            password_hash=get_password_hash("TestPass123"),
            first_name="Team", last_name="Member",
            user_type="dealer", parent_dealer_id=dealer["user_id"],
        )
        db.add(sub_user)
        db.commit()
        db.refresh(sub_user)
        sub_user_id = sub_user.id
    finally:
        db.close()

    media_id = _make_media(sub_user_id, "team-member-photo.jpg")

    folder_res = dealer["client"].post(
        "/api/media/folders", params={"name": "Team Folder"}, headers=dealer["headers"]
    )
    folder_id = folder_res.json()["id"]
    dealer["folder_ids"].append(folder_id)

    try:
        # Dealer (org root) moves the team member's photo — should succeed.
        res = dealer["client"].patch(
            f"/api/media/{media_id}/folder", params={"folder_id": folder_id}, headers=dealer["headers"]
        )
        assert res.status_code == 200, res.text
    finally:
        # Clean up locally (not via dealer["media_ids"]/module teardown) since
        # the sub-user must be deleted here too, before the module-level
        # teardown tries to delete the main dealer it points its
        # parent_dealer_id at.
        db = SessionLocal()
        try:
            db.query(MediaFile).filter(MediaFile.id == media_id).delete()
            db.commit()
            db.query(User).filter(User.id == sub_user_id).delete()
            db.commit()
        finally:
            db.close()


def test_non_admin_cannot_create_folder_as_another_dealer(dealer):
    other_email = _unique_email()
    _, other_token = _make_user(other_email)
    res = dealer["client"].post(
        "/api/media/folders",
        params={"name": "Should Fail", "as_dealer_id": dealer["user_id"]},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res.status_code == 403

    db = SessionLocal()
    try:
        db.query(User).filter(User.email == other_email).delete()
        db.commit()
    finally:
        db.close()
