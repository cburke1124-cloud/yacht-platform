import pytest

from app.core.limiter import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Tests share one process/IP identity against slowapi's rate limits
    (e.g. 5/minute on /auth/register) — reset before each test so one test's
    quota usage can't cause an unrelated test to see a spurious 429."""
    limiter.reset()
    yield


@pytest.fixture(autouse=True)
def relaxed_ai_quota(monkeypatch):
    """Guest AI quotas are tiny by design (2 free searches) and their usage
    rows persist in the dev DB, so tests that merely call AI endpoints would
    start failing after a couple of runs. Quota-specific tests lower these
    again with their own monkeypatch."""
    for name in ("AI_SEARCH_ANON_LIMIT", "AI_ANON_GLOBAL_DAILY_LIMIT", "CHATBOT_ANON_DAILY_LIMIT"):
        monkeypatch.setenv(name, "1000000")
