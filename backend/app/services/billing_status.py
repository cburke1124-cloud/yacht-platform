"""Single source of truth for "has this account actually paid" checks.

subscription_tier alone is not reliable: sales-rep/admin manual broker
creation (routes_sales.py:register_broker_for_sales_rep,
routes_admin.py's admin broker-creation endpoint) sets subscription_tier
directly without ever touching Stripe. subscription_start_date is only
ever set by a confirmed Stripe webhook or /payments/confirm-session call,
so it's the only signal that can't be faked by manual account creation.
"""
from datetime import datetime

from sqlalchemy import and_, or_

PAID_TIERS = {
    "basic", "plus", "pro", "premium",
    "private_basic", "private_plus", "private_pro",
}


def in_active_trial(user) -> bool:
    """True while an admin/sales-rep-granted (or Stripe) trial hasn't run out.

    Judged by trial_end_date, not just the trial_active flag, so a trial lapses
    on time even if the reminder job hasn't flipped the flag yet.
    """
    if user is None or not getattr(user, "trial_active", False):
        return False
    end = getattr(user, "trial_end_date", None)
    return bool(end) and end > datetime.utcnow()


def user_has_actually_paid(user) -> bool:
    """Confirmed Stripe payment on file, or comped — a trial does NOT count."""
    if user is None:
        return False
    return bool(getattr(user, "always_free", False)) or bool(getattr(user, "subscription_start_date", None))


def user_has_paid(user) -> bool:
    """True if this account may have live listings: paid, comped, or mid-trial.

    (Name kept for the many existing call sites; trials grant the same access
    as payment until they expire.)
    """
    return user_has_actually_paid(user) or in_active_trial(user)


def paid_owner_filter():
    """SQLAlchemy filter expression for queries joined against User (e.g. Listing.owner)."""
    from app.models.user import User
    return or_(
        User.always_free == True,
        User.subscription_start_date.isnot(None),
        and_(User.trial_active == True, User.trial_end_date > datetime.utcnow()),
    )
