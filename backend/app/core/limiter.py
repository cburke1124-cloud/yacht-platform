"""
Central rate-limiter instance used by auth routes and any other
routes that need per-endpoint limits beyond the global anti-scraping
middleware.

Import `limiter` here — never instantiate a second one.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    # Reasonable safe global defaults — per-route decorators override these
    default_limits=["300/hour", "30/minute"],
)
