"""Blog drafts created by the marketing agent.

Runs against a private in-memory SQLite database created inside this file (never the
configured database), so it is safe anywhere. Covers the properties that matter most:
the endpoint can only ever create drafts, is idempotent, keeps the editor-native block
structure, and cannot carry an outside link or script into a post.
"""
import json
from datetime import datetime

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import routes_marketing_feed as feed
from app.db.base_class import Base
from app.db.session import get_db
from app.main import app
from app.models.blog import BlogCategory, BlogPost, BlogPostTag, BlogTag, PostStatus
from app.models.user import User
from app.services import marketing_blog as mb

SITE = "https://yachtversal.com"


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(
        engine,
        tables=[User.__table__, BlogCategory.__table__, BlogTag.__table__, BlogPost.__table__, BlogPostTag.__table__],
    )
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def editor(db, monkeypatch):
    user = User(email="editor@example.test", password_hash="x", user_type="editor")
    db.add(user)
    db.commit()
    monkeypatch.setenv("MARKETING_BLOG_AUTHOR_ID", str(user.id))
    monkeypatch.setenv("BASE_URL", SITE)
    return user


def article(**overrides):
    body = {
        "title": "Welcome Harbor Point Yachts",
        "slug": "welcome-harbor-point-yachts",
        "excerpt": "A new brokerage joins YachtVersal.",
        "meta_description": "Meet Harbor Point Yachts of Newport.",
        "featured_image": "https://img.example.test/boat.jpg",
        "featured_image_alt": "2020 Grand Banks 42",
        "tags": ["broker-spotlight"],
        "blocks": [
            {"type": "heading", "level": 2, "text": "About the brokerage"},
            {"type": "paragraph", "segments": [
                {"text": "Visit "},
                {"text": "Harbor Point Yachts", "href": f"{SITE}/dealers/harbor-point-yachts"},
                {"text": " in Newport."},
            ]},
            {"type": "bullets", "items": [
                [{"text": "2020 Grand Banks 42", "href": f"{SITE}/listings/2"}, {"text": " - $415,000"}],
                [{"text": "Second boat"}],
            ]},
        ],
    }
    body.update(overrides)
    return feed.BlogDraftIn(**body)


# --- the structured article -> editor/HTML/text builders ---------------------------------------

def test_blocknote_document_keeps_headings_links_and_lists():
    blocks = article().blocks
    doc = mb.to_blocknote(blocks)
    assert [b["type"] for b in doc] == ["heading", "paragraph", "bulletListItem", "bulletListItem"]
    assert doc[0]["props"] == {"level": 2}
    link = doc[1]["content"][1]
    assert link["type"] == "link" and link["href"] == f"{SITE}/dealers/harbor-point-yachts"
    assert link["content"] == [{"type": "text", "text": "Harbor Point Yachts", "styles": {}}]


def test_html_groups_bullets_and_escapes_everything():
    blocks = article(blocks=[
        {"type": "paragraph", "segments": [{"text": "<script>alert(1)</script> & more", "href": f'{SITE}/x?a="b"'}]},
        {"type": "bullets", "items": [[{"text": "one"}], [{"text": "two"}]]},
    ]).blocks
    html = mb.to_html(blocks)
    assert "<script>" not in html and "&lt;script&gt;" in html
    assert '"b"' not in html and "&quot;b&quot;" in html
    assert html.count("<ul>") == 1 and html.count("<li>") == 2


def test_plain_text_is_readable():
    text = mb.to_plain_text(article().blocks)
    assert text.startswith("About the brokerage\n\nVisit Harbor Point Yachts in Newport.")
    assert "- 2020 Grand Banks 42 - $415,000" in text


@pytest.mark.parametrize("href", [
    "https://evil.example.test/x",
    "https://yachtversal.com.evil.test/x",   # look-alike prefix
    "http://yachtversal.com/x",              # wrong scheme
    "javascript:alert(1)",
])
def test_links_outside_the_site_are_detected(href):
    blocks = article(blocks=[{"type": "paragraph", "segments": [{"text": "x", "href": href}]}]).blocks
    assert mb.foreign_links(blocks, SITE) == [href]


def test_site_root_and_deep_links_are_allowed():
    blocks = article(blocks=[{"type": "paragraph", "segments": [
        {"text": "a", "href": SITE}, {"text": "b", "href": f"{SITE}/listings/9"}]}]).blocks
    assert mb.foreign_links(blocks, SITE) == []


# --- request validation --------------------------------------------------------------------------

@pytest.mark.parametrize("override", [
    {"slug": "Has Spaces"},
    {"slug": "ab"},
    {"featured_image": "http://insecure.example.test/a.jpg"},
    {"blocks": []},
    {"blocks": [{"type": "script", "text": "x"}]},
    {"blocks": [{"type": "heading", "level": 1, "text": "too big"}]},
    {"tags": ["t"] * 9},
])
def test_invalid_payloads_are_rejected(override):
    with pytest.raises(ValidationError):
        article(**override)


# --- creating drafts -----------------------------------------------------------------------------

def test_creates_a_draft_with_editor_native_structure(db, editor):
    result = feed.create_blog_draft(article(), db=db)
    assert result["success"] and result["existing"] is False and result["status"] == "draft"

    post = db.query(BlogPost).one()
    assert post.status == PostStatus.DRAFT and post.published_at is None and post.scheduled_for is None
    assert post.author_id == editor.id and post.featured is False
    blocks = json.loads(post.content_blocks)
    assert [b["type"] for b in blocks] == ["heading", "paragraph", "bulletListItem", "bulletListItem"]
    assert "<a href=\"https://yachtversal.com/listings/2\">" in post.content_html
    assert post.content.startswith("About the brokerage")
    assert post.reading_time_minutes >= 1
    assert post.meta_title == "Welcome Harbor Point Yachts"


def test_there_is_no_way_to_request_published(db, editor):
    payload = article()
    assert not hasattr(payload, "status") and not hasattr(payload, "published_at")
    # extra fields a caller might try to smuggle in are not accepted into the model
    smuggled = feed.BlogDraftIn(**{**payload.model_dump(), "status": "published", "published_at": "2026-01-01"})
    feed.create_blog_draft(smuggled, db=db)
    post = db.query(BlogPost).one()
    assert post.status == PostStatus.DRAFT and post.published_at is None


def test_resending_the_same_slug_changes_nothing(db, editor):
    feed.create_blog_draft(article(), db=db)
    post = db.query(BlogPost).one()
    post.title = "A reviewer edited this"
    post.status = PostStatus.PUBLISHED
    db.commit()

    again = feed.create_blog_draft(article(), db=db)
    assert again["existing"] is True and again["status"] == "published"
    assert db.query(BlogPost).count() == 1
    assert db.query(BlogPost).one().title == "A reviewer edited this"


def test_a_soft_deleted_slug_is_not_resurrected_or_duplicated(db, editor):
    feed.create_blog_draft(article(), db=db)
    post = db.query(BlogPost).one()
    post.deleted_at = datetime.utcnow()
    db.commit()
    assert feed.create_blog_draft(article(), db=db)["existing"] is True
    assert db.query(BlogPost).count() == 1


def test_outside_links_are_refused_and_nothing_is_saved(db, editor):
    bad = article(blocks=[{"type": "paragraph", "segments": [{"text": "x", "href": "https://evil.example.test"}]}])
    with pytest.raises(HTTPException) as exc:
        feed.create_blog_draft(bad, db=db)
    assert exc.value.status_code == 422
    assert db.query(BlogPost).count() == 0


def test_tags_are_normalised_deduplicated_and_reused(db, editor):
    feed.create_blog_draft(article(tags=["Broker Spotlight", "broker-spotlight", "  ", "New Arrivals"]), db=db)
    assert sorted(t.slug for t in db.query(BlogTag)) == ["broker-spotlight", "new-arrivals"]
    feed.create_blog_draft(article(slug="second-post", tags=["broker-spotlight"]), db=db)
    assert db.query(BlogTag).count() == 2  # reused, not duplicated
    assert db.query(BlogPostTag).count() == 3


def test_unknown_category_is_ignored_known_category_is_used(db, editor):
    db.add(BlogCategory(name="Brokers", slug="brokers"))
    db.commit()
    feed.create_blog_draft(article(category="does-not-exist"), db=db)
    feed.create_blog_draft(article(slug="second-post", category="brokers"), db=db)
    first, second = db.query(BlogPost).order_by(BlogPost.id).all()
    assert first.category_id is None and second.category_id is not None


@pytest.mark.parametrize("value", ["", "abc", "999999"])
def test_unconfigured_or_missing_author_is_a_503(db, monkeypatch, value):
    monkeypatch.setenv("MARKETING_BLOG_AUTHOR_ID", value)
    with pytest.raises(HTTPException) as exc:
        feed.create_blog_draft(article(), db=db)
    assert exc.value.status_code == 503 and db.query(BlogPost).count() == 0


def test_a_non_editor_author_is_refused(db, monkeypatch):
    buyer = User(email="buyer@example.test", password_hash="x", user_type="buyer")
    db.add(buyer)
    db.commit()
    monkeypatch.setenv("MARKETING_BLOG_AUTHOR_ID", str(buyer.id))
    with pytest.raises(HTTPException) as exc:
        feed.create_blog_draft(article(), db=db)
    assert exc.value.status_code == 503


# --- status lookup ------------------------------------------------------------------------------

def test_status_reports_draft_published_and_deleted(db, editor, monkeypatch):
    monkeypatch.setenv("BASE_URL", SITE)
    for slug in ("one-post", "two-post", "three-post"):
        feed.create_blog_draft(article(slug=slug), db=db)
    one, two, three = (db.query(BlogPost).filter_by(slug=s).one() for s in ("one-post", "two-post", "three-post"))
    two.status, two.published_at = PostStatus.PUBLISHED, datetime(2026, 10, 12, 9, 0)
    three.deleted_at = datetime.utcnow()
    db.commit()

    result = feed.blog_draft_status("one-post, two-post,three-post,never-created", db=db)
    by_slug = {p["slug"]: p for p in result["posts"]}
    assert set(by_slug) == {"one-post", "two-post", "three-post"}
    assert by_slug["one-post"]["status"] == "draft" and by_slug["one-post"]["published_at"] is None
    assert by_slug["two-post"]["status"] == "published" and by_slug["two-post"]["published_at"].startswith("2026-10-12")
    assert by_slug["three-post"]["status"] == "deleted"
    assert by_slug["two-post"]["url"] == f"{SITE}/blog/two-post"


# --- key gate ------------------------------------------------------------------------------------

@pytest.fixture
def http():
    app.dependency_overrides[get_db] = lambda: None  # must never be needed: the key gate runs first
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_blog_endpoints_unavailable_until_key_configured(http, monkeypatch):
    monkeypatch.delenv("MARKETING_FEED_KEY", raising=False)
    assert http.post("/api/marketing/blog-drafts", json={}).status_code == 503
    assert http.get("/api/marketing/blog-drafts/status?slugs=a").status_code == 503


def test_blog_endpoints_reject_missing_or_wrong_key(http, monkeypatch):
    monkeypatch.setenv("MARKETING_FEED_KEY", "right-key")
    for headers in ({}, {"X-Marketing-Key": "wrong"}):
        assert http.post("/api/marketing/blog-drafts", json={}, headers=headers).status_code == 401
        assert http.get("/api/marketing/blog-drafts/status?slugs=a", headers=headers).status_code == 401
