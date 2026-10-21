"""Admin bridge to the marketing agent: admin-only, key stays server-side, errors are readable,
and publishing a blog draft is possible only for drafts and only for admins."""
from datetime import datetime
from types import SimpleNamespace

import pytest
import requests
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import routes_admin_marketing as bridge
from app.api.deps import get_current_user
from app.db.base_class import Base
from app.db.session import get_db
from app.main import app
from app.models.blog import BlogCategory, BlogPost, BlogPostTag, BlogTag, PostStatus
from app.models.user import User


class FakeResponse:
    def __init__(self, status=200, body=None):
        self.status_code = status
        self._body = body if body is not None else {}

    def json(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


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
def admin(db, monkeypatch):
    monkeypatch.setenv("MARKETING_AGENT_URL", "https://agent.test/")
    monkeypatch.setenv("MARKETING_AGENT_API_KEY", "agent-key")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(user_type="admin", id=1)
    yield TestClient(app)
    app.dependency_overrides.clear()


class Calls(list):
    response = FakeResponse(200, {"ok": True})

    def respond(self, response):
        self.response = response


@pytest.fixture
def calls(monkeypatch):
    seen = Calls()

    def fake_request(method, url, **kwargs):
        seen.append((method, url, kwargs))
        return seen.response

    monkeypatch.setattr(bridge.requests, "request", fake_request)
    return seen


def make_post(db, status=PostStatus.DRAFT, slug="a-post"):
    author = User(email=f"{slug}@example.test", password_hash="x", user_type="editor")
    db.add(author)
    db.commit()
    post = BlogPost(title="A post", slug=slug, content="x", status=status, author_id=author.id)
    db.add(post)
    db.commit()
    return post


def test_non_admins_are_refused(db, calls, monkeypatch):
    monkeypatch.setenv("MARKETING_AGENT_URL", "https://agent.test")
    monkeypatch.setenv("MARKETING_AGENT_API_KEY", "agent-key")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(user_type="dealer", id=2)
    try:
        c = TestClient(app)
        assert c.get("/api/admin/marketing/overview").status_code in (401, 403)
        assert c.post("/api/admin/marketing/drafts/1/publish").status_code in (401, 403)
        assert c.post("/api/admin/marketing/blog/1/publish").status_code in (401, 403)
    finally:
        app.dependency_overrides.clear()
    assert calls == []


def test_status_reports_unconfigured_without_erroring(db, monkeypatch):
    monkeypatch.delenv("MARKETING_AGENT_URL", raising=False)
    monkeypatch.delenv("MARKETING_AGENT_API_KEY", raising=False)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(user_type="admin", id=1)
    try:
        c = TestClient(app)
        assert c.get("/api/admin/marketing/status").json()["configured"] is False
        assert c.get("/api/admin/marketing/overview").status_code == 503
    finally:
        app.dependency_overrides.clear()


def test_requests_carry_the_key_server_side(admin, calls):
    assert admin.get("/api/admin/marketing/drafts?status=pending").json() == {"ok": True}
    method, url, kwargs = calls[0]
    assert (method, url) == ("GET", "https://agent.test/api/admin/drafts")
    assert kwargs["headers"]["X-Agent-Key"] == "agent-key" and kwargs["params"] == {"status": "pending"}


def test_draft_actions_are_whitelisted(admin, calls):
    assert admin.post("/api/admin/marketing/drafts/5/approve").status_code == 200
    assert calls[-1][:2] == ("POST", "https://agent.test/api/admin/drafts/5/approve")
    assert admin.post("/api/admin/marketing/drafts/5/delete").status_code == 404
    assert admin.post("/api/admin/marketing/site-posts/3/drop").status_code == 404
    assert admin.post("/api/admin/marketing/clients/1/shell").status_code == 404
    assert len(calls) == 1


def test_client_runs_are_forwarded(admin, calls):
    calls.respond(FakeResponse(202, {"started": True}))
    assert admin.post("/api/admin/marketing/clients/1/sync").json() == {"started": True}
    assert admin.post("/api/admin/marketing/clients/1/topics/run").status_code == 200
    assert [c[1] for c in calls] == ["https://agent.test/api/admin/clients/1/sync",
                                     "https://agent.test/api/admin/clients/1/topics/run"]


def test_agent_refusals_pass_through_readably(admin, calls):
    calls.respond(FakeResponse(409, {"detail": "Only an approved draft can be posted"}))
    r = admin.post("/api/admin/marketing/drafts/5/publish")
    assert r.status_code == 409 and "approved" in r.json()["detail"]


def test_bad_key_and_outage_are_setup_errors_not_leaks(admin, calls, monkeypatch):
    calls.respond(FakeResponse(401, {"detail": "Invalid agent key"}))
    r = admin.get("/api/admin/marketing/overview")
    assert r.status_code == 502 and "agent-key" not in r.text

    def boom(*a, **k):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(bridge.requests, "request", boom)
    assert admin.get("/api/admin/marketing/overview").status_code == 502


def test_publish_blog_draft(admin, db):
    post = make_post(db)
    r = admin.post(f"/api/admin/marketing/blog/{post.id}/publish")
    assert r.status_code == 200 and r.json()["slug"] == "a-post"
    db.refresh(post)
    assert post.status == PostStatus.PUBLISHED and isinstance(post.published_at, datetime)


@pytest.mark.parametrize("status", [PostStatus.PUBLISHED, PostStatus.ARCHIVED])
def test_only_drafts_can_be_published(admin, db, status):
    post = make_post(db, status=status)
    assert admin.post(f"/api/admin/marketing/blog/{post.id}/publish").status_code == 409


def test_deleted_or_missing_posts_404(admin, db):
    post = make_post(db)
    post.deleted_at = datetime.utcnow()
    db.commit()
    assert admin.post(f"/api/admin/marketing/blog/{post.id}/publish").status_code == 404
    assert admin.post("/api/admin/marketing/blog/9999/publish").status_code == 404
