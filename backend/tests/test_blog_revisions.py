"""
Blog block-editor content storage + revision history smoke tests. Hits the
real app + dev database (matching the pattern in test_auth.py) — creates its
own throwaway editor user and blog post, and cleans both up afterward.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.blog import BlogPost, BlogPostRevision


def _unique_email() -> str:
    return f"pytest-blog-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def editor_client():
    client = TestClient(app)
    email = _unique_email()
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123",
            "first_name": "Blog",
            "last_name": "Editor",
            "user_type": "user",
            "agree_terms": True,
            "agree_communications": True,
        },
    )
    assert res.status_code == 200

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user.user_type = "editor"
        db.commit()
    finally:
        db.close()

    yield client

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            post_ids = [p.id for p in db.query(BlogPost).filter(BlogPost.author_id == user.id).all()]
            if post_ids:
                db.query(BlogPostRevision).filter(BlogPostRevision.post_id.in_(post_ids)).delete(synchronize_session=False)
                db.query(BlogPost).filter(BlogPost.id.in_(post_ids)).delete(synchronize_session=False)
            db.delete(user)
            db.commit()
    finally:
        db.close()


def test_create_post_with_content_html_derives_plain_text_and_sanitizes(editor_client):
    res = editor_client.post(
        "/api/admin/blog/posts",
        json={
            "title": "Block editor smoke test post",
            "content": "fallback plain text (ignored when content_html is set)",
            "content_blocks": '[{"type":"paragraph","content":"Hello world"}]',
            "content_html": "<p>Hello <script>alert(1)</script>world</p>",
            "status": "draft",
        },
    )
    assert res.status_code == 200
    post_id = res.json()["post_id"]

    get_res = editor_client.get(f"/api/blog/posts/{res.json()['slug']}")
    assert get_res.status_code == 200
    data = get_res.json()

    # The script tag itself must be stripped (no executable markup survives);
    # bleach intentionally leaves inert leftover text rather than the tag.
    assert "<script>" not in data["content_html"]
    assert "</script>" not in data["content_html"]
    assert "Hello" in data["content_html"] and "world" in data["content_html"]
    assert "Hello" in data["content"] and "world" in data["content"]
    assert data["content_blocks"] == '[{"type":"paragraph","content":"Hello world"}]'


def test_update_triggers_revision_and_restore_reverts_content(editor_client):
    create_res = editor_client.post(
        "/api/admin/blog/posts",
        json={
            "title": "Revision smoke test post",
            "content": "",
            "content_html": "<p>Version one</p>",
            "status": "draft",
        },
    )
    assert create_res.status_code == 200
    post_id = create_res.json()["post_id"]
    slug = create_res.json()["slug"]

    # Update #1: touches content -> should snapshot pre-update state as a revision.
    update_res = editor_client.put(
        f"/api/admin/blog/posts/{post_id}",
        json={"content_html": "<p>Version two</p>"},
    )
    assert update_res.status_code == 200

    revisions_res = editor_client.get(f"/api/admin/blog/posts/{post_id}/revisions")
    assert revisions_res.status_code == 200
    revisions = revisions_res.json()
    assert len(revisions) == 1

    detail_res = editor_client.get(f"/api/admin/blog/posts/{post_id}/revisions/{revisions[0]['id']}")
    assert detail_res.status_code == 200
    assert "Version one" in detail_res.json()["content_html"]

    # Confirm the post now reflects the second version.
    post_res = editor_client.get(f"/api/blog/posts/{slug}")
    assert "Version two" in post_res.json()["content_html"]

    # Restore back to the first revision.
    restore_res = editor_client.post(
        f"/api/admin/blog/posts/{post_id}/revisions/{revisions[0]['id']}/restore"
    )
    assert restore_res.status_code == 200

    restored_post_res = editor_client.get(f"/api/blog/posts/{slug}")
    assert "Version one" in restored_post_res.json()["content_html"]

    # Restoring itself snapshots the pre-restore state, so there should now be 2 revisions.
    revisions_after_restore = editor_client.get(f"/api/admin/blog/posts/{post_id}/revisions").json()
    assert len(revisions_after_restore) == 2


def test_toggling_unrelated_field_does_not_create_revision(editor_client):
    create_res = editor_client.post(
        "/api/admin/blog/posts",
        json={
            "title": "No-revision-spam smoke test post",
            "content": "plain text content",
            "status": "draft",
        },
    )
    post_id = create_res.json()["post_id"]

    update_res = editor_client.put(
        f"/api/admin/blog/posts/{post_id}",
        json={"featured": True},
    )
    assert update_res.status_code == 200

    revisions_res = editor_client.get(f"/api/admin/blog/posts/{post_id}/revisions")
    assert revisions_res.json() == []
