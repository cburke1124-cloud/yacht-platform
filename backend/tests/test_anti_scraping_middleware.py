"""
AntiScrapingMiddleware previously rate-limited every IP — including allowed
search bots — before ever inspecting the user-agent, which meant a normal
Googlebot crawl burst could get 429'd. TestClient's default host
("testclient") bypasses the middleware entirely, so these tests spoof
X-Forwarded-For to get a real, non-bypassed client identity and actually
exercise the rate limiter.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _fake_ip() -> str:
    # Unique per test so request counts don't bleed across tests sharing
    # the middleware's in-memory, per-process request_counts dict.
    return f"203.0.113.{uuid.uuid4().int % 254 + 1}"


def test_googlebot_is_exempt_from_rate_limiting(client):
    ip = _fake_ip()
    headers = {
        "X-Forwarded-For": ip,
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    }
    statuses = [client.get("/api/health", headers=headers).status_code for _ in range(70)]
    assert all(s == 200 for s in statuses), statuses


def test_normal_client_still_gets_rate_limited(client):
    ip = _fake_ip()
    headers = {"X-Forwarded-For": ip, "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)"}
    statuses = [client.get("/api/health", headers=headers).status_code for _ in range(70)]
    assert 429 in statuses


def test_internal_api_secret_bypasses_all_checks(client, monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret-value")
    ip = _fake_ip()
    headers = {
        "X-Forwarded-For": ip,
        "User-Agent": "node",
        "X-Internal-Api-Key": "test-secret-value",
    }
    statuses = [client.get("/api/health", headers=headers).status_code for _ in range(70)]
    assert all(s == 200 for s in statuses), statuses


def test_wrong_internal_api_secret_is_not_trusted(client, monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret-value")
    ip = _fake_ip()
    headers = {
        "X-Forwarded-For": ip,
        "User-Agent": "node",
        "X-Internal-Api-Key": "wrong-value",
    }
    statuses = [client.get("/api/health", headers=headers).status_code for _ in range(70)]
    assert 429 in statuses
