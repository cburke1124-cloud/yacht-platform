"""Shared commission-payout computation, used by both the read-only
statement preview and the real confirm-payout action (routes_admin.py).

Also backfills a ReferralSignup row on the fly for any dealer/private-seller
with User.assigned_sales_rep_id pointing at a rep but zero ReferralSignup
rows ever created for them — a pre-existing gap in provision_user_account
(routes_auth.py), which only creates one `if affiliate_account:`. Without
this backfill those accounts would never be markable as paid and would
silently keep re-accruing commission forever.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.partner_growth import ReferralSignup
from app.models.misc import CommissionPayout


def compute_rep_payout(
    rep: User,
    db: Session,
    current_user_id: int,
    dry_run: bool = True,
    notes: Optional[str] = None,
):
    """Compute (and optionally persist) a commission payout for a sales rep.

    dry_run=True:  nothing is added to the session / committed. Returns the
                    same shape as dry_run=False so the statement preview and
                    the confirm-payout response are structurally identical.
    dry_run=False: creates backfilled ReferralSignup rows for real, creates
                    a CommissionPayout row, and sets payout_id on every
                    ReferralSignup row included in the total. Caller must
                    still db.commit() (kept outside this function so the
                    route owns the transaction boundary, matching the
                    existing update_sales_rep_commission pattern).
    """
    from app.api.routes_sales import TIER_PRICES  # local import avoids a circular import at module load time

    line_items = []
    total = 0.0
    rows_to_mark = []
    backfill_rows = []

    # 1. Existing unpaid referral rows crediting this rep.
    unpaid_referrals = db.query(ReferralSignup).filter(
        ReferralSignup.sales_rep_id == rep.id,
        ReferralSignup.payout_id.is_(None),
    ).all()
    dealer_ids_with_referrals = {r.dealer_user_id for r in unpaid_referrals}
    referral_dealers = {}
    if dealer_ids_with_referrals:
        referral_dealers = {
            u.id: u for u in db.query(User).filter(User.id.in_(list(dealer_ids_with_referrals))).all()
        }

    for referral in unpaid_referrals:
        dealer = referral_dealers.get(referral.dealer_user_id)
        if not dealer or not dealer.active or not dealer.subscription_start_date:
            continue  # not paid by the customer yet — nothing owed, leave payout_id null for a future statement
        price = float(referral.effective_monthly_price) if referral.effective_monthly_price is not None else float(TIER_PRICES.get(dealer.subscription_tier, 0.0))
        rate = float(referral.commission_rate) if referral.commission_rate is not None else float(rep.commission_rate or 10.0)
        amount = round(price * (rate / 100.0), 2)
        line_items.append({
            "referral_signup_id": referral.id,
            "account_id": dealer.id,
            "account_name": f"{dealer.first_name or ''} {dealer.last_name or ''}".strip() or dealer.company_name or dealer.email,
            "account_email": dealer.email,
            "user_type": dealer.user_type,
            "price": price,
            "commission_rate": rate,
            "commission_amount": amount,
            "backfilled": False,
        })
        total += amount
        rows_to_mark.append(referral)

    # 2. Gap accounts: assigned_sales_rep_id points here but ZERO ReferralSignup
    #    rows exist for them at all (any rep, ever).
    assigned_users = db.query(User).filter(User.assigned_sales_rep_id == rep.id).all()
    any_referral_dealer_ids = {
        row[0] for row in db.query(ReferralSignup.dealer_user_id).filter(
            ReferralSignup.dealer_user_id.in_([u.id for u in assigned_users])
        ).all()
    } if assigned_users else set()

    for user in assigned_users:
        if user.id in any_referral_dealer_ids:
            continue  # already covered by a real (possibly already-paid) referral row
        if not user.active or not user.subscription_start_date:
            continue  # nothing owed yet; stays a "gap" account until they pay
        price = float(TIER_PRICES.get(user.subscription_tier, 0.0))
        rate = float(rep.commission_rate or 10.0)
        amount = round(price * (rate / 100.0), 2)
        if amount <= 0:
            continue
        new_referral = ReferralSignup(
            dealer_user_id=user.id,
            source_type="admin_manual",
            sales_rep_id=rep.id,
            effective_monthly_price=price,
            commission_rate=rate,
        )
        line_items.append({
            "referral_signup_id": None,  # filled in after flush if dry_run=False
            "account_id": user.id,
            "account_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.company_name or user.email,
            "account_email": user.email,
            "user_type": user.user_type,
            "price": price,
            "commission_rate": rate,
            "commission_amount": amount,
            "backfilled": True,
        })
        total += amount
        backfill_rows.append(new_referral)

    total = round(total, 2)

    result = {
        "sales_rep_id": rep.id,
        "sales_rep_name": f"{rep.first_name or ''} {rep.last_name or ''}".strip() or rep.email,
        "generated_at": datetime.utcnow().isoformat(),
        "total_commission_owed": total,
        "line_item_count": len(line_items),
        "line_items": line_items,
        "payout_id": None,
    }

    if dry_run:
        return result

    # Persist: add backfilled rows for real, flush to get their ids, create
    # the CommissionPayout, then stamp payout_id on everything included.
    for row in backfill_rows:
        db.add(row)
    db.flush()

    payout = CommissionPayout(
        sales_rep_id=rep.id,
        amount=total,
        referral_count=len(line_items),
        notes=notes,
        paid_by_user_id=current_user_id,
        paid_at=datetime.utcnow(),
    )
    db.add(payout)
    db.flush()

    for row in rows_to_mark:
        row.payout_id = payout.id
    for row in backfill_rows:
        row.payout_id = payout.id

    backfill_iter = iter(backfill_rows)
    for item in line_items:
        if item["backfilled"]:
            item["referral_signup_id"] = next(backfill_iter).id

    result["payout_id"] = payout.id
    return result
