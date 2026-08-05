"""Shared authorization helper for the sales-rep-scoped account management
panel (routes_sales.py "dealers/{user_id}" endpoints, the sales-rep branch
of the listing-ownership checks in routes_listings.py, and the as_dealer_id
media-scope checks in routes_media.py / routes_listings.py).

Mirrors the "which accounts does this rep manage" union already computed
inline in GET /sales-rep/analytics (routes_sales.py), but as a single-target
existence check instead of loading the rep's whole referred-account set —
kept as a separate, deliberately decoupled helper so this feature can't
regress that revenue/commission-critical endpoint.
"""
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.partner_growth import ReferralSignup


def sales_rep_manages_user(sales_rep_id: int, target_user_id: int, db: Session) -> bool:
    """True if target_user_id is an account the given sales rep manages:
    either the target's User.assigned_sales_rep_id points at this rep, or
    there's a ReferralSignup row crediting this rep with the referral.
    """
    direct = db.query(User.id).filter(
        User.id == target_user_id,
        User.assigned_sales_rep_id == sales_rep_id,
    ).first()
    if direct:
        return True

    referred = db.query(ReferralSignup.id).filter(
        ReferralSignup.dealer_user_id == target_user_id,
        ReferralSignup.sales_rep_id == sales_rep_id,
    ).first()
    return referred is not None
