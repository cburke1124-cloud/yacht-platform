"""Single source of truth for "has this account actually paid" checks.

subscription_tier alone is not reliable: sales-rep/admin manual broker
creation (routes_sales.py:register_broker_for_sales_rep,
routes_admin.py's admin broker-creation endpoint) sets subscription_tier
directly without ever touching Stripe. subscription_start_date is only
ever set by a confirmed Stripe webhook or /payments/confirm-session call,
so it's the only signal that can't be faked by manual account creation.
"""
from sqlalchemy import or_

PAID_TIERS = {
    "basic", "plus", "pro", "premium",
    "private_basic", "private_plus", "private_pro",
}


def user_has_paid(user) -> bool:
    """True if this account has a confirmed Stripe payment on file, or is comped."""
    if user is None:
        return False
    return bool(getattr(user, "always_free", False)) or bool(getattr(user, "subscription_start_date", None))


def paid_owner_filter():
    """SQLAlchemy filter expression for queries joined against User (e.g. Listing.owner)."""
    from app.models.user import User
    return or_(User.always_free == True, User.subscription_start_date.isnot(None))
