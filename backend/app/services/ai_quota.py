"""
Quotas for endpoints that spend Claude tokens (AI search, chatbot).

Guests get a couple of free AI searches, then must register; registered
accounts get a generous daily allowance so nobody can burn tokens unchecked.
All limits are env-tunable. Admins are exempt.

Guests are identified by a salted IP hash *and* an optional browser-held
visitor id (X-Visitor-Id header): hitting the cap on either one blocks them,
so clearing cookies or switching networks alone doesn't reset the allowance.
A sitewide guest cap acts as a cost circuit-breaker against distributed abuse.
"""
import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.exceptions import YachtVersalException
from app.models.chatbot import AIUsageEvent
from app.models.user import User


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


class AIQuotaExceeded(YachtVersalException):
    def __init__(self, message: str, code: str):
        super().__init__(message, 429)
        # code: "signup_required" (guest hit the free cap) | "daily_limit" (account cap)
        self.details = {"code": code, "signup_required": code == "signup_required"}


def get_client_ip(request: Request) -> str:
    """Best-effort real client IP behind Render/Cloudflare. Falls back to the
    socket peer, which behind a proxy would be the proxy itself."""
    for header in ("cf-connecting-ip", "true-client-ip"):
        value = request.headers.get(header)
        if value:
            return value.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def hash_ip(ip: str) -> str:
    return hashlib.sha256(f"{settings.SECRET_KEY}:{ip}".encode()).hexdigest()


def _clean_visitor_id(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()[:64]
    return raw if raw.replace("-", "").isalnum() else None


def enforce_quota(
    request: Request,
    db: Session,
    user: Optional[User],
    kind: str = "ai_search",
    visitor_id: Optional[str] = None,
) -> Optional[int]:
    """Raise AIQuotaExceeded if the caller is over their allowance, otherwise
    record one usage event and return its id (None for exempt admins). Call
    once per token-spending request; pass the id to refund_quota() if the AI
    turned out to be unavailable so the failed attempt isn't charged."""
    if user is not None and user.user_type == "admin":
        return None

    now = datetime.utcnow()
    ip_hash = hash_ip(get_client_ip(request))
    visitor_id = _clean_visitor_id(visitor_id or request.headers.get("x-visitor-id"))
    day_ago = now - timedelta(hours=24)

    if user is not None:
        limit = (
            _int_env("AI_SEARCH_USER_DAILY_LIMIT", 25)
            if kind == "ai_search"
            else _int_env("CHATBOT_USER_DAILY_LIMIT", 150)
        )
        used = (
            db.query(func.count(AIUsageEvent.id))
            .filter(
                AIUsageEvent.kind == kind,
                AIUsageEvent.user_id == user.id,
                AIUsageEvent.created_at >= day_ago,
            )
            .scalar()
        )
        if used >= limit:
            raise AIQuotaExceeded(
                "You've reached today's AI search limit. It resets within 24 hours — "
                "you can still browse listings with the regular filters.",
                "daily_limit",
            )
    else:
        if kind == "ai_search":
            limit = _int_env("AI_SEARCH_ANON_LIMIT", 2)
            window = now - timedelta(hours=_int_env("AI_SEARCH_ANON_WINDOW_HOURS", 168))
        else:
            limit = _int_env("CHATBOT_ANON_DAILY_LIMIT", 40)
            window = day_ago

        identity = [AIUsageEvent.ip_hash == ip_hash]
        if visitor_id:
            identity.append(AIUsageEvent.visitor_id == visitor_id)
        used = (
            db.query(func.count(AIUsageEvent.id))
            .filter(
                AIUsageEvent.kind == kind,
                AIUsageEvent.user_id.is_(None),
                AIUsageEvent.created_at >= window,
                or_(*identity),
            )
            .scalar()
        )
        if used >= limit:
            if kind == "ai_search":
                raise AIQuotaExceeded(
                    "You've used your free AI searches. Create a free account to keep searching.",
                    "signup_required",
                )
            raise AIQuotaExceeded(
                "You've reached the chat limit for now. Create a free account to keep chatting.",
                "signup_required",
            )

        global_cap = _int_env("AI_ANON_GLOBAL_DAILY_LIMIT", 300)
        global_used = (
            db.query(func.count(AIUsageEvent.id))
            .filter(
                AIUsageEvent.kind == kind,
                AIUsageEvent.user_id.is_(None),
                AIUsageEvent.created_at >= day_ago,
            )
            .scalar()
        )
        if global_used >= global_cap:
            raise AIQuotaExceeded(
                "AI features are busy for guests right now. Create a free account to continue.",
                "signup_required",
            )

    event = AIUsageEvent(
        kind=kind,
        user_id=user.id if user else None,
        ip_hash=ip_hash,
        visitor_id=visitor_id,
        created_at=now,
    )
    db.add(event)
    db.commit()
    return event.id


def refund_quota(db: Session, event_id: Optional[int]) -> None:
    """Remove a usage event recorded for a request the AI couldn't serve."""
    if not event_id:
        return
    try:
        db.query(AIUsageEvent).filter(AIUsageEvent.id == event_id).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
