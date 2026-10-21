"""Admin/sales-granted free trials and the reminder emails around them.

A trial lets a broker or private seller have live listings without paying
(see billing_status.in_active_trial). run_trial_reminders() is called by the
scheduler: it emails before the trial ends, flips expired trials off, and
sends a couple of win-back emails afterwards. Which emails have gone out is
tracked per user in permissions["trial_reminders_sent"] so a run is idempotent.
"""
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.billing_status import user_has_actually_paid
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

PRE_EXPIRY_DAYS = (7, 3, 1)   # reminders this many days before the end
POST_EXPIRY_DAYS = (1, 7)     # win-back emails this many days after it
MAX_TRIAL_DAYS = 365


def _perms(user: User) -> dict:
    """permissions is a JSON column but has been stored as a JSON string in places."""
    perms = user.permissions
    if isinstance(perms, str):
        try:
            perms = json.loads(perms)
        except Exception:
            perms = {}
    return dict(perms or {})


def apply_trial(user: User, days: int) -> None:
    """Start/extend a trial of `days` from now, or end it when days <= 0.

    Resets the reminder history so the new period gets its own reminders.
    """
    days = int(days)
    if days > MAX_TRIAL_DAYS:
        raise ValueError(f"Trial cannot exceed {MAX_TRIAL_DAYS} days")
    perms = _perms(user)
    if days > 0:
        perms.pop("trial_reminders_sent", None)  # new period, fresh reminders
        user.trial_active = True
        user.trial_end_date = datetime.utcnow() + timedelta(days=days)
    else:
        # Ended on purpose by staff — don't send win-back emails for it.
        perms["trial_reminders_sent"] = [f"pre{d}" for d in PRE_EXPIRY_DAYS] + [f"post{d}" for d in POST_EXPIRY_DAYS]
        user.trial_active = False
        user.trial_end_date = datetime.utcnow()
    user.permissions = perms


def _send(user: User, kind: str, days: int) -> bool:
    name = user.first_name or None
    try:
        return bool(email_service.send_trial_reminder_email(
            to_email=user.email,
            kind=kind,
            days=days,
            trial_end_date=user.trial_end_date.strftime("%B %d, %Y").replace(" 0", " "),
            user_name=name,
        ))
    except Exception:
        logger.exception("Trial reminder email failed for user %s", user.id)
        return False


def run_trial_reminders(db: Session) -> dict:
    now = datetime.utcnow()
    sent = expired = 0
    candidates = db.query(User).filter(
        User.trial_end_date.isnot(None),
        User.user_type.in_(["dealer", "private"]),
        User.active == True,
        User.is_demo != True,
        # Stop chasing people a month after their trial lapsed.
        User.trial_end_date > now - timedelta(days=30),
    ).all()

    for user in candidates:
        if user_has_actually_paid(user):
            continue
        perms = _perms(user)
        done = list(perms.get("trial_reminders_sent") or [])
        remaining = user.trial_end_date - now
        new_key = None

        if remaining.total_seconds() > 0:
            if not user.trial_active:
                continue  # trial was ended manually
            # The tightest window we're in; skip the wider ones (a 3-day
            # trial shouldn't get a "7 days left" email on day one).
            bucket = next((d for d in sorted(PRE_EXPIRY_DAYS) if remaining <= timedelta(days=d)), None)
            if bucket is not None:
                wider = [f"pre{d}" for d in PRE_EXPIRY_DAYS if d > bucket]
                if f"pre{bucket}" not in done:
                    days_left = max(1, -(-int(remaining.total_seconds()) // 86400))
                    if _send(user, "pre", days_left):
                        sent += 1
                        new_key = [f"pre{bucket}"] + wider
        else:
            if user.trial_active:
                user.trial_active = False  # lapsed — listings are already hidden by date
                expired += 1
            elapsed = now - user.trial_end_date
            due = [d for d in POST_EXPIRY_DAYS if elapsed >= timedelta(days=d) and f"post{d}" not in done]
            if due:
                if _send(user, "post", elapsed.days):
                    sent += 1
                    new_key = [f"post{d}" for d in due]

        if new_key:
            perms["trial_reminders_sent"] = done + [k for k in new_key if k not in done]
            user.permissions = perms
        db.commit()

    return {"sent": sent, "expired": expired, "checked": len(candidates)}
