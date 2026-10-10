"""Outbound webhook to the standalone marketing agent when a broker is approved.

Inert unless MARKETING_WEBHOOK_URL and MARKETING_WEBHOOK_SECRET are both set,
so deploying this changes nothing until it is configured. It never raises and
never blocks the admin request: delivery runs on a daemon thread and failures
are only logged. The agent also reconciles against the polling feed in
routes_marketing_feed.py, so one dropped webhook does not lose the event.

Signing matches the lead webhooks in routes_crm.py: HMAC-SHA256 over
"<timestamp>.<raw body>", sent as X-Webhook-Timestamp / X-Webhook-Signature.
It uses its own secret so the two integrations can be rotated independently.
"""
import hashlib
import hmac
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 5


def _config() -> Optional[tuple[str, str]]:
    url = os.getenv("MARKETING_WEBHOOK_URL", "").strip()
    secret = os.getenv("MARKETING_WEBHOOK_SECRET", "").strip()
    return (url, secret) if url and secret else None


def sign(secret: str, timestamp: str, body: str) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.{body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


def build_broker_approved_payload(dealer, profile=None) -> dict:
    name = " ".join(filter(None, [dealer.first_name, dealer.last_name])).strip()
    return {
        "event": "broker.approved",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "broker": {
            "id": dealer.id,
            "company_name": (profile.company_name if profile and profile.company_name else dealer.company_name),
            "name": name or None,
            "slug": profile.slug if profile else None,
            "city": profile.city if profile else None,
            "state": profile.state if profile else None,
            "country": profile.country if profile else None,
        },
    }


def _deliver(url: str, secret: str, payload: dict) -> None:
    try:
        body = json.dumps(payload, separators=(",", ":"))
        timestamp = str(int(time.time()))
        response = requests.post(
            url,
            data=body.encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Timestamp": timestamp,
                "X-Webhook-Signature": sign(secret, timestamp, body),
            },
            timeout=_TIMEOUT_SECONDS,
        )
        if response.status_code >= 300:
            logger.warning("Marketing webhook returned HTTP %s", response.status_code)
    except Exception:
        logger.exception("Marketing webhook delivery failed")


def notify_broker_approved(db, dealer) -> None:
    """Fire-and-forget "broker.approved" event. Safe to call from request handlers."""
    try:
        config = _config()
        if not config:
            return
        from app.models.dealer import DealerProfile

        profile = db.query(DealerProfile).filter(DealerProfile.user_id == dealer.id).first()
        payload = build_broker_approved_payload(dealer, profile)
        threading.Thread(target=_deliver, args=(*config, payload), daemon=True).start()
    except Exception:
        logger.exception("Could not queue marketing webhook")
