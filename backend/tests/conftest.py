import pytest

from app.core.limiter import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Tests share one process/IP identity against slowapi's rate limits
    (e.g. 5/minute on /auth/register) — reset before each test so one test's
    quota usage can't cause an unrelated test to see a spurious 429."""
    limiter.reset()
    yield
