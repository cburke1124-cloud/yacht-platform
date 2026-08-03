"""On-demand Next.js ISR cache-busting.

Several public pages (dealer profile, listings) fetch with a 1-hour
`revalidate` window. Without this, an edit saved through the API — e.g. a
dealer's phone number — doesn't show up on the live site until that cache
naturally expires. This calls the frontend's `/api/revalidate` route
handler right after a relevant write so the change is visible immediately.

Best-effort only: a failure here must never break the actual save. Logged,
not raised.
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://yachtversal.com").rstrip("/")
REVALIDATE_SECRET = os.getenv("REVALIDATE_SECRET")


def trigger_revalidation(paths: list[str]) -> None:
    if not REVALIDATE_SECRET:
        logger.warning("REVALIDATE_SECRET not set — skipping cache revalidation for %s", paths)
        return
    try:
        requests.post(
            f"{FRONTEND_URL}/api/revalidate",
            json={"paths": paths},
            headers={"x-revalidate-secret": REVALIDATE_SECRET},
            timeout=3,
        )
    except Exception as exc:
        logger.warning("Cache revalidation request failed for %s: %s", paths, exc)
