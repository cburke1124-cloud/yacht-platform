"""Marketing-agent integration: approval webhook + key-gated feed.

Database-free on purpose (mocks only), so it is safe to run against any
environment. It covers the parts that can break the admin flow or leak data:
signing, the no-op-when-unconfigured guarantee, never raising into the admin
request, firing only on a false->true approval, and the feed's key gate.
"""
import hashlib
import hmac
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api import routes_admin
from app.main import app
from app.services import marketing_webhook as mw

URL = "https://agent.example.test/webhooks/yachtversal"
SECRET = "test-webhook-secret"


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("MARKETING_WEBHOOK_URL", URL)
    monkeypatch.setenv("MARKETING_WEBHOOK_SECRET", SECRET)


def _dealer(**overrides):
    base = dict(id=7, first_name="Ada", last_name="Lovelace", company_name="Lovelace Yachts", verified=False, active=True)
    base.update(overrides)
    return SimpleNamespace(**base)


def test_sign_matches_reference_hmac():
    ts, body = "1700000000", '{"a":1}'
    expected = "sha256=" + hmac.new(SECRET.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    assert mw.sign(SECRET, ts, body) == expected


def test_notify_is_noop_when_unconfigured(monkeypatch):
    monkeypatch.delenv("MARKETING_WEBHOOK_URL", raising=False)
    monkeypatch.delenv("MARKETING_WEBHOOK_SECRET", raising=False)
    with patch.object(mw.threading, "Thread") as thread:
        mw.notify_broker_approved(None, _dealer())
    thread.assert_not_called()


def test_notify_is_noop_when_only_one_setting_present(monkeypatch):
    monkeypatch.setenv("MARKETING_WEBHOOK_URL", URL)
    monkeypatch.delenv("MARKETING_WEBHOOK_SECRET", raising=False)
    with patch.object(mw.threading, "Thread") as thread:
        mw.notify_broker_approved(None, _dealer())
    thread.assert_not_called()


def test_notify_queues_delivery_with_broker_payload(configured):
    profile = SimpleNamespace(company_name="Lovelace Yachts LLC", slug="lovelace-yachts", city="Miami", state="FL", country="USA")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = profile
    with patch.object(mw.threading, "Thread") as thread:
        mw.notify_broker_approved(db, _dealer())
    thread.return_value.start.assert_called_once()
    url, secret, payload = thread.call_args.kwargs["args"]
    assert (url, secret) == (URL, SECRET)
    assert payload["event"] == "broker.approved"
    assert payload["broker"] == {
        "id": 7,
        "company_name": "Lovelace Yachts LLC",
        "name": "Ada Lovelace",
        "slug": "lovelace-yachts",
        "city": "Miami",
        "state": "FL",
        "country": "USA",
    }


def test_notify_never_raises_into_the_admin_request(configured):
    db = MagicMock()
    db.query.side_effect = RuntimeError("db exploded")
    mw.notify_broker_approved(db, _dealer())  # must not raise


def test_deliver_sends_body_with_matching_signature():
    with patch.object(mw.requests, "post") as post:
        post.return_value.status_code = 200
        mw._deliver(URL, SECRET, {"event": "broker.approved"})
    kwargs = post.call_args.kwargs
    body = kwargs["data"].decode("utf-8")
    ts = kwargs["headers"]["X-Webhook-Timestamp"]
    assert kwargs["headers"]["X-Webhook-Signature"] == mw.sign(SECRET, ts, body)
    assert kwargs["timeout"] == mw._TIMEOUT_SECONDS


def test_deliver_swallows_network_errors():
    with patch.object(mw.requests, "post", side_effect=ConnectionError("down")):
        mw._deliver(URL, SECRET, {"event": "broker.approved"})  # must not raise


def _update_dealer(dealer, data):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = dealer
    db.query.return_value.filter.return_value.scalar.return_value = "some-slug"
    with patch.object(routes_admin, "notify_broker_approved") as notify, patch.object(routes_admin, "trigger_revalidation"):
        routes_admin.update_dealer(dealer.id, data, current_user=None, db=db)
    return notify


def test_admin_approval_fires_webhook_on_false_to_true():
    notify = _update_dealer(_dealer(verified=False), {"verified": True})
    notify.assert_called_once()


def test_admin_update_does_not_refire_when_already_verified():
    notify = _update_dealer(_dealer(verified=True), {"verified": True})
    notify.assert_not_called()


def test_admin_unverifying_does_not_fire():
    notify = _update_dealer(_dealer(verified=True), {"verified": False})
    notify.assert_not_called()


def test_admin_unrelated_edit_does_not_fire():
    notify = _update_dealer(_dealer(verified=False), {"company_name": "Renamed"})
    notify.assert_not_called()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.parametrize("path", ["/api/marketing/listings", "/api/marketing/brokers"])
def test_feed_unavailable_until_key_configured(client, monkeypatch, path):
    monkeypatch.delenv("MARKETING_FEED_KEY", raising=False)
    assert client.get(path, headers={"X-Marketing-Key": "anything"}).status_code == 503


@pytest.mark.parametrize("path", ["/api/marketing/listings", "/api/marketing/brokers"])
def test_feed_rejects_missing_or_wrong_key(client, monkeypatch, path):
    monkeypatch.setenv("MARKETING_FEED_KEY", "right-key")
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"X-Marketing-Key": "wrong-key"}).status_code == 401
