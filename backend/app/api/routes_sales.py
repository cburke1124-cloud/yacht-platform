
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import secrets

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.listing import Listing
from app.models.charter import CharterListing
from app.models.dealer import DealerProfile
from app.models.partner_growth import AffiliateAccount, PartnerDeal, ReferralSignup, PartnerOffer
from app.models.documentation import Documentation
from app.exceptions import AuthorizationException, ResourceNotFoundException, ValidationException
from app.security.auth import get_password_hash, pwd_context
from app.services.email_service import email_service
from app.utils.slug import create_slug
from app.utils.phone import normalize_phone
from app.utils.sales_rep import sales_rep_manages_user
from app.utils.revalidate import trigger_revalidation
from app.services.api_key_service import generate_api_key_for_dealer
from app.services.demo_fixtures import create_demo_account_for_owner
from app.models.misc import SiteSettings
from app.api.routes_listings import _get_primary_images_for_listings

router = APIRouter()

# Broker/dealer pricing pivoted to a single flat one-time setup fee (see
# SIGNUP_FEE in frontend/app/register/page.tsx and SETUP_FEE_PRICE_ID /
# mode="payment" in routes_payments.py) — brokers no longer choose between
# tiered monthly plans with different feature limits; every broker gets
# full platform access for one $199 payment. basic/plus below are kept
# only so historical dealer records that still reference those tier
# strings don't break, not because they're purchasable plans anymore.
BROKER_SETUP_FEE = 199.0
PRIVATE_SETUP_FEE = 149.0  # the one real private-seller plan: $149 one-time

TIER_PRICES = {
    "free": 0.0,
    "trial": 0.0,
    "basic": 199.0,   # legacy tier string — no longer sold, kept for historical records
    "plus": 299.0,    # legacy tier string — no longer sold, kept for historical records
    "premium": 499.0, # legacy tier string — no longer sold, kept for historical records
    "pro": BROKER_SETUP_FEE,  # the one real broker plan: $199 one-time
    "ultimate": 0.0,  # Custom/enterprise pricing — managed manually
    "private_active": 149.0,  # the one real private-seller plan: $149 one-time
    "private_basic": 9.0,   # legacy tier string — no longer sold, kept for historical records
    "private_plus": 19.0,   # legacy tier string — no longer sold, kept for historical records
    "private_pro": 39.0,    # legacy tier string — no longer sold, kept for historical records
}


_DEFAULT_BROKER_TIERS = {
    "basic":    {"name": "Basic",    "price": 199,  "listings": 25,     "images_per_listing": 15,     "videos_per_listing": 1,      "features": ["25 active listings", "15 images per listing", "1 video per listing", "Enhanced search visibility", "Priority email support", "Analytics dashboard"],                                                              "trial_days": 14, "active": False},
    "plus":     {"name": "Plus",     "price": 299,  "listings": 75,     "images_per_listing": 30,     "videos_per_listing": 3,      "features": ["75 active listings", "30 images per listing", "3 videos per listing", "Priority search placement", "Featured broker badge", "Priority support", "Advanced analytics"],                                       "trial_days": 14, "active": False},
    "pro":      {"name": "Full Access", "price": BROKER_SETUP_FEE, "listings": 999999, "images_per_listing": 999999, "videos_per_listing": 999999, "features": ["Unlimited active listings", "Unlimited photos & videos per listing", "Full buyer messaging & inquiry management", "AI-powered search placement", "Broker profile page with team roster", "Analytics dashboard", "Data feed sync & bulk import tools", "Co-brokering network access"], "trial_days": 0, "active": True, "one_time": True},
    "ultimate": {"name": "Ultimate", "price": 0,   "listings": 999999, "images_per_listing": 999999, "videos_per_listing": 999999, "features": ["Everything in Full Access", "White-glove onboarding", "Dedicated account manager", "Custom API integrations", "Negotiated enterprise pricing"], "trial_days": 0, "active": True, "is_custom_pricing": True, "one_time": True},
}


def _generate_ref_code() -> str:
    return f"YV{secrets.token_hex(4).upper()}"


def _ensure_sales_rep_affiliate_account(sales_rep: User, db: Session, created_by: int | None = None) -> AffiliateAccount:
    """Ensure the sales rep has an affiliate account (used for referrals). Does not commit."""
    account = db.query(AffiliateAccount).filter(
        AffiliateAccount.user_id == sales_rep.id,
        AffiliateAccount.account_type == "sales_rep",
    ).first()

    if account:
        return account

    code = _generate_ref_code()
    while db.query(AffiliateAccount).filter(AffiliateAccount.code == code).first():
        code = _generate_ref_code()

    account = AffiliateAccount(
        name=f"{sales_rep.first_name or ''} {sales_rep.last_name or ''}".strip() or sales_rep.email,
        email=sales_rep.email,
        code=code,
        account_type="sales_rep",
        user_id=sales_rep.id,
        commission_rate=sales_rep.commission_rate or 10.0,
        active=True,
        created_by=created_by or sales_rep.id,
    )
    db.add(account)
    return account


@router.get("/analytics")
def get_sales_rep_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get outreach/referral analytics with dealer details.

    Also usable by admins doing occasional outreach — the underlying
    AffiliateAccount/ReferralSignup tracking is generic per-user and
    already works for any caller; this endpoint was just gated to
    "salesman" only, so admins had no equivalent metrics view even after
    generating their own affiliate link.
    """
    if current_user.user_type not in ("salesman", "admin"):
        raise AuthorizationException("Sales rep or admin access required")

    affiliate_account = _ensure_sales_rep_affiliate_account(current_user, db)

    referrals = db.query(ReferralSignup).filter(
        ReferralSignup.sales_rep_id == current_user.id
    ).all()

    referred_user_ids = {r.dealer_user_id for r in referrals}

    assigned_users = db.query(User).filter(
        User.assigned_sales_rep_id == current_user.id
    ).all()

    user_map = {u.id: u for u in assigned_users}
    if referred_user_ids:
        extra_users = db.query(User).filter(User.id.in_(list(referred_user_ids))).all()
        for u in extra_users:
            user_map[u.id] = u

    all_referred_users = list(user_map.values())
    # Brokers are commission-recurring (monthly subscription); private sellers
    # pay a flat one-time fee, so they're tallied separately below.
    dealers = [u for u in all_referred_users if (u.user_type or "").lower() == "dealer"]
    private_seller_users = [u for u in all_referred_users if (u.user_type or "").lower() == "private"]

    referral_map = {r.dealer_user_id: r for r in referrals}
    active_dealers_list = [d for d in dealers if d.active]

    monthly_revenue = 0.0
    monthly_commission = 0.0
    for dealer in active_dealers_list:
        # subscription_start_date is only ever set by a confirmed Stripe
        # webhook/session-confirm — never by manual sales-rep/admin broker
        # creation. Skip dealers who haven't actually paid so commission
        # isn't accrued on accounts that were signed up but never billed.
        if not dealer.subscription_start_date:
            continue
        referral = referral_map.get(dealer.id)
        base_price = float(TIER_PRICES.get(dealer.subscription_tier, 0.0))
        effective_price = float(referral.effective_monthly_price) if referral and referral.effective_monthly_price is not None else base_price
        commission_rate = float(referral.commission_rate) if referral and referral.commission_rate is not None else float(current_user.commission_rate or 10.0)
        monthly_revenue += effective_price
        monthly_commission += effective_price * (commission_rate / 100.0)

    # Build detailed dealer stats
    dealer_stats = []
    for dealer in dealers:
        # Count listings for this dealer
        listing_count = db.query(Listing).filter(
            Listing.user_id == dealer.id
        ).count()

        active_listings = db.query(Listing).filter(
            Listing.user_id == dealer.id,
            Listing.status == "active"
        ).count()

        # Sum views and inquiries
        stats = db.query(
            func.sum(Listing.views).label('total_views'),
            func.sum(Listing.inquiries).label('total_inquiries')
        ).filter(
            Listing.user_id == dealer.id
        ).first()

        # Charter listings were previously omitted entirely — a dealer selling
        # exclusively via charters showed 0 listings/views/inquiries here.
        # CharterListing has no views/inquiries columns yet, so only counts add.
        charter_base = db.query(CharterListing).filter(
            CharterListing.user_id == dealer.id, CharterListing.deleted_at.is_(None)
        )
        charter_count = charter_base.count()
        active_charter_count = charter_base.filter(CharterListing.status == "active").count()

        dealer_stats.append({
            "dealer_id": dealer.id,
            "dealer_name": f"{dealer.first_name} {dealer.last_name}",
            "company_name": dealer.company_name,
            "email": dealer.email,
            "subscription_tier": dealer.subscription_tier,
            "total_listings": listing_count + charter_count,
            "active_listings": active_listings + active_charter_count,
            "total_for_sale_listings": listing_count,
            "total_charter_listings": charter_count,
            "total_views": stats.total_views or 0,
            "total_inquiries": stats.total_inquiries or 0,
            "joined_date": dealer.created_at.isoformat() if dealer.created_at else None,
            "active": dealer.active,
            "effective_monthly_price": float(referral_map[dealer.id].effective_monthly_price) if dealer.id in referral_map and referral_map[dealer.id].effective_monthly_price is not None else float(TIER_PRICES.get(dealer.subscription_tier, 0.0)),
            "commission_rate": float(referral_map[dealer.id].commission_rate) if dealer.id in referral_map and referral_map[dealer.id].commission_rate is not None else float(current_user.commission_rate or 10.0),
            "referred": dealer.id in referral_map,
            "paid": bool(dealer.subscription_start_date),
        })

    # Private-seller referrals earn a one-time commission on the flat $149
    # fee rather than a recurring monthly commission.
    private_seller_stats = []
    private_seller_commission_total = 0.0
    for seller in private_seller_users:
        referral = referral_map.get(seller.id)
        commission_rate = float(referral.commission_rate) if referral and referral.commission_rate is not None else float(current_user.commission_rate or 10.0)
        paid = bool(seller.subscription_start_date)
        one_time_commission = (PRIVATE_SETUP_FEE * (commission_rate / 100.0)) if paid else 0.0
        if paid:
            private_seller_commission_total += one_time_commission

        listing_count = db.query(Listing).filter(Listing.user_id == seller.id).count()

        private_seller_stats.append({
            "user_id": seller.id,
            "name": f"{seller.first_name} {seller.last_name}",
            "email": seller.email,
            "total_listings": listing_count,
            "joined_date": seller.created_at.isoformat() if seller.created_at else None,
            "active": seller.active,
            "one_time_fee": PRIVATE_SETUP_FEE,
            "commission_rate": commission_rate,
            "one_time_commission": one_time_commission,
            "referred": seller.id in referral_map,
            "paid": paid,
        })

    return {
        "total_dealers": len(dealers),
        "active_dealers": len(active_dealers_list),
        "monthly_revenue": monthly_revenue,
        "monthly_commission": monthly_commission,
        "dealers": dealer_stats,
        "total_private_referrals": len(private_seller_users),
        "private_seller_commission_total": private_seller_commission_total,
        "private_sellers": private_seller_stats,
        "affiliate": {
            "code": affiliate_account.code,
            "referral_link": f"/register?user_type=dealer&ref={affiliate_account.code}",
            "private_referral_link": f"/register?user_type=private&ref={affiliate_account.code}",
            "commission_rate": float(affiliate_account.commission_rate or current_user.commission_rate or 10.0),
            "referred_signups": len(referrals),
        }
    }


def _get_managed_account_or_403(user_id: int, current_user: User, db: Session) -> User:
    """Shared guard for the /dealers/{user_id}... management endpoints below:
    caller must be a sales rep, and the target account must be one they
    personally referred (per sales_rep_manages_user), and must be a
    dealer or private-seller account."""
    if current_user.user_type != "salesman":
        raise AuthorizationException("Sales rep access required")
    if not sales_rep_manages_user(current_user.id, user_id, db):
        raise AuthorizationException("You can only manage accounts you referred")
    target = db.query(User).filter(
        User.id == user_id, User.user_type.in_(["dealer", "private"])
    ).first()
    if not target:
        raise ResourceNotFoundException("Account", user_id)
    return target


@router.get("/dealers/{user_id}")
def get_managed_account(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Read-only account summary for a dealer/private-seller this rep
    referred. verified/active/subscription_tier are included for display
    only — they're not editable via the PUT below."""
    target = _get_managed_account_or_403(user_id, current_user, db)
    return {
        "id": target.id,
        "user_type": target.user_type,
        "first_name": target.first_name,
        "last_name": target.last_name,
        "email": target.email,
        "phone": target.phone,
        "company_name": target.company_name,
        "verified": target.verified,
        "active": target.active,
        "subscription_tier": target.subscription_tier,
        "created_at": target.created_at.isoformat() if target.created_at else None,
    }


@router.put("/dealers/{user_id}")
def update_managed_account(
    user_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update basic User-row fields for a referred dealer/private seller.

    verified/active/subscription_tier are deliberately NOT in the allowlist
    — those stay admin-only trust/billing flags. If a caller includes them
    in the request body they're silently ignored, matching the equivalent
    admin endpoint's "only touch allowlisted fields" behavior.
    """
    target = _get_managed_account_or_403(user_id, current_user, db)

    updatable = ["first_name", "last_name", "phone"]
    if target.user_type == "dealer":
        updatable.append("company_name")

    for field in updatable:
        if field in data:
            value = normalize_phone(data[field]) if field == "phone" else data[field]
            setattr(target, field, value)

    db.commit()
    db.refresh(target)
    return {"success": True, "id": target.id}


@router.get("/dealers/{user_id}/profile")
def get_managed_account_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mirrors GET /admin/dealers/{id}/profile. Always returns {} for
    private sellers (they never have a DealerProfile row) — expected, not
    an error; the frontend should not call this for user_type == 'private'."""
    _get_managed_account_or_403(user_id, current_user, db)

    profile = db.query(DealerProfile).filter(DealerProfile.user_id == user_id).first()
    if not profile:
        return {}
    return {
        "id": profile.id,
        "name": profile.name,
        "company_name": profile.company_name,
        "email": profile.email,
        "phone": profile.phone,
        "address": profile.address,
        "city": profile.city,
        "state": profile.state,
        "country": profile.country,
        "zip_code": profile.zip_code,
        "website": profile.website,
        "description": profile.description,
        "logo_url": profile.logo_url,
        "banner_url": profile.banner_url,
        "facebook_url": profile.facebook_url,
        "instagram_url": profile.instagram_url,
        "twitter_url": profile.twitter_url,
        "linkedin_url": profile.linkedin_url,
        "primary_color": profile.primary_color,
        "about_section": profile.about_section,
        "meta_title": profile.meta_title,
        "meta_description": profile.meta_description,
        "cobrokering_enabled": profile.cobrokering_enabled,
        "show_team_on_profile": profile.show_team_on_profile,
        "verified": profile.verified,
        "active": profile.active,
    }


@router.put("/dealers/{user_id}/profile")
def update_managed_account_profile(
    user_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mirrors PUT /admin/dealers/{id}/profile, minus verified/active in the
    allowlist (admin-only trust flags). 404s if there's no DealerProfile row
    — always true for private sellers; the frontend must not call this for
    them."""
    _get_managed_account_or_403(user_id, current_user, db)

    profile = db.query(DealerProfile).filter(DealerProfile.user_id == user_id).first()
    if not profile:
        raise ResourceNotFoundException("Broker profile", user_id)

    updatable = [
        "name", "company_name", "email", "phone",
        "address", "city", "state", "country", "zip_code",
        "website", "description", "logo_url", "banner_url",
        "facebook_url", "instagram_url", "twitter_url", "linkedin_url",
        "primary_color", "about_section", "meta_title", "meta_description",
        "cobrokering_enabled", "show_team_on_profile",
    ]
    for field in updatable:
        if field in data:
            value = normalize_phone(data[field]) if field == "phone" else data[field]
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    if profile.slug:
        trigger_revalidation([f"/dealers/{profile.slug}"])

    return {"success": True}


@router.get("/dealers/{user_id}/listings")
def get_managed_account_listings(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Listing rows (not just aggregate counts) for a referred dealer/
    private seller, for the sales-rep management page's listings table."""
    _get_managed_account_or_403(user_id, current_user, db)

    listings = (
        db.query(Listing)
        .filter(Listing.user_id == user_id, Listing.deleted_at.is_(None))
        .order_by(Listing.created_at.desc())
        .all()
    )
    image_map = _get_primary_images_for_listings(db, [l.id for l in listings])

    return {
        "listings": [
            {
                "id": l.id,
                "title": l.title,
                "status": l.status,
                "price": l.price,
                "currency": l.currency,
                "views": l.views,
                "inquiries": l.inquiries,
                "created_at": l.created_at.isoformat() if l.created_at else None,
                "updated_at": l.updated_at.isoformat() if l.updated_at else None,
                "primary_image": (image_map.get(l.id) or [{}])[0].get("url"),
            }
            for l in listings
        ]
    }


@router.get("/referral-info")
def get_referral_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_type != "salesman":
        raise AuthorizationException("Sales rep access required")

    affiliate_account = _ensure_sales_rep_affiliate_account(current_user, db)
    referral_count = db.query(ReferralSignup).filter(
        ReferralSignup.sales_rep_id == current_user.id
    ).count()

    return {
        "code": affiliate_account.code,
        "referral_link": f"/register?user_type=dealer&ref={affiliate_account.code}",
        "private_referral_link": f"/register?user_type=private&ref={affiliate_account.code}",
        "commission_rate": float(affiliate_account.commission_rate or current_user.commission_rate or 10.0),
        "referred_signups": referral_count,
    }


@router.get("/deals")
def list_sales_rep_deals(
    sales_rep_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List deals for a sales rep. Admins must specify sales_rep_id; reps use their own."""
    if current_user.user_type == "salesman":
        target_rep = current_user
    elif current_user.user_type == "admin":
        if not sales_rep_id:
            raise ValidationException("sales_rep_id is required for admin access")
        target_rep = db.query(User).filter(
            User.id == sales_rep_id,
            User.user_type == "salesman",
        ).first()
        if not target_rep:
            raise ResourceNotFoundException("Sales rep", sales_rep_id)
    else:
        raise AuthorizationException("Sales rep access required")

    deals = db.query(PartnerDeal).filter(
        PartnerDeal.owner_sales_rep_id == target_rep.id
    ).order_by(PartnerDeal.created_at.desc()).all()

    usage_counts = {
        deal_id: count
        for deal_id, count in db.query(
            ReferralSignup.deal_id,
            func.count(ReferralSignup.id),
        ).filter(
            ReferralSignup.sales_rep_id == target_rep.id,
            ReferralSignup.deal_id.isnot(None),
        ).group_by(ReferralSignup.deal_id).all()
    }

    return [{
        "id": deal.id,
        "name": deal.name,
        "code": deal.code,
        "target_email": deal.target_email,
        "free_days": deal.free_days,
        "discount_type": deal.discount_type,
        "discount_value": deal.discount_value,
        "fixed_monthly_price": deal.fixed_monthly_price,
        "term_months": deal.term_months,
        "lifetime": deal.lifetime,
        "active": deal.active,
        "start_date": deal.start_date.isoformat() if deal.start_date else None,
        "end_date": deal.end_date.isoformat() if deal.end_date else None,
        "created_at": deal.created_at.isoformat() if deal.created_at else None,
        "notes": deal.notes,
        "usage_count": usage_counts.get(deal.id, 0),
    } for deal in deals]


@router.post("/deals")
def create_sales_rep_deal(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a deal for a sales rep. Admins must supply sales_rep_id."""
    if current_user.user_type == "salesman":
        target_rep = current_user
    elif current_user.user_type == "admin":
        sales_rep_id = data.get("sales_rep_id")
        if not sales_rep_id:
            raise ValidationException("sales_rep_id is required for admin access")
        target_rep = db.query(User).filter(
            User.id == int(sales_rep_id),
            User.user_type == "salesman",
        ).first()
        if not target_rep:
            raise ResourceNotFoundException("Sales rep", sales_rep_id)
    else:
        raise AuthorizationException("Sales rep access required")

    name = (data.get("name") or "").strip()
    if not name:
        raise ValidationException("Deal name is required")

    code = (data.get("code") or "").strip().upper() or f"DEAL{secrets.token_hex(3).upper()}"
    while db.query(PartnerDeal).filter(PartnerDeal.code == code).first():
        code = f"DEAL{secrets.token_hex(3).upper()}"

    end_date = None
    if data.get("end_date"):
        end_date = datetime.fromisoformat(data["end_date"])

    deal = PartnerDeal(
        name=name,
        code=code,
        created_by=current_user.id,
        owner_sales_rep_id=target_rep.id,
        target_email=(data.get("target_email") or None),
        free_days=int(data.get("free_days") or 0),
        discount_type=(data.get("discount_type") or None),
        discount_value=float(data["discount_value"]) if data.get("discount_value") not in [None, ""] else None,
        fixed_monthly_price=float(data["fixed_monthly_price"]) if data.get("fixed_monthly_price") not in [None, ""] else None,
        term_months=int(data["term_months"]) if data.get("term_months") not in [None, ""] else None,
        lifetime=bool(data.get("lifetime", False)),
        notes=data.get("notes"),
        active=bool(data.get("active", True)),
        end_date=end_date,
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)

    return {
        "id": deal.id,
        "code": deal.code,
        "message": "Deal created",
    }


@router.get("/offers")
def get_offers_sales_rep(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all active promotional offers for sales reps to share."""
    if current_user.user_type not in ("salesman", "admin"):
        raise AuthorizationException("Sales rep or admin access required")

    offers = (
        db.query(PartnerOffer)
        .filter(PartnerOffer.active == True)
        .order_by(PartnerOffer.sort_order, PartnerOffer.created_at)
        .all()
    )
    return [
        {
            "id": o.id,
            "name": o.name,
            "description": o.description,
            "terms_summary": o.terms_summary,
            "coupon_id": o.coupon_id,
            "stripe_payment_link_url": o.stripe_payment_link_url,
            "tier": o.tier,
            "sort_order": o.sort_order,
        }
        for o in offers
    ]


@router.get("/{sales_rep_id}/profile")
def get_sales_rep_profile(
    sales_rep_id: int,
    db: Session = Depends(get_db)
):
    """Get public profile for a sales rep."""
    # Get the sales rep
    sales_rep = db.query(User).filter(
        User.id == sales_rep_id,
        User.active == True
    ).first()
    
    if not sales_rep:
        raise ResourceNotFoundException("Sales representative", sales_rep_id)
    
    # Check if they're a team member (has parent dealer)
    if not sales_rep.parent_dealer_id:
        raise ResourceNotFoundException("Sales representative", sales_rep_id)
    
    # Get parent dealer info
    dealer = db.query(User).filter(User.id == sales_rep.parent_dealer_id).first()
    dealer_profile = None
    if dealer:
        dealer_profile = db.query(DealerProfile).filter(
            DealerProfile.user_id == dealer.id
        ).first()
    
    # Get their listings
    listings = db.query(Listing).filter(
        Listing.user_id == sales_rep_id,
        Listing.status == "active"
    ).order_by(Listing.created_at.desc()).limit(12).all()
    
    # Get stats
    listing_stats = db.query(
        func.count(Listing.id).label('total'),
        func.count(Listing.id).filter(Listing.status == 'sold').label('sold')
    ).filter(Listing.user_id == sales_rep_id).first()
    
    return {
        "id": sales_rep.id,
        "first_name": sales_rep.first_name,
        "last_name": sales_rep.last_name,
        "email": sales_rep.email,
        "phone": sales_rep.phone,
        "photo_url": getattr(sales_rep, 'photo_url', None),
        "bio": getattr(sales_rep, 'bio', None),
        "role": getattr(sales_rep, 'role', 'Sales Representative'),
        "dealer_company": dealer.company_name if dealer else None,
        "dealer_slug": dealer_profile.slug if dealer_profile else None,
        "city": getattr(sales_rep, 'city', None),
        "state": getattr(sales_rep, 'state', None),
        "joined_date": sales_rep.created_at.isoformat() if sales_rep.created_at else None,
        "stats": {
            "total_listings": listing_stats.total or 0,
            "total_sales": listing_stats.sold or 0
        },
        "listings": [
            {
                "id": l.id,
                "title": l.title,
                "price": l.price,
                "currency": l.currency or "USD",
                "year": l.year,
                "make": l.make,
                "model": l.model,
                "length_feet": l.length_feet,
                "city": l.city,
                "state": l.state,
                "condition": l.condition,
                "featured": getattr(l, 'featured', False),
                "images": [img.url for img in l.images[:1]] if l.images else []
            }
            for l in listings
        ]
    }


@router.get("/docs")
def get_sales_rep_docs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get documentation pages visible to sales reps (audience = 'sales_rep' or 'all')."""
    if current_user.user_type not in ("salesman", "admin"):
        raise AuthorizationException("Sales rep access required")

    docs = (
        db.query(Documentation)
        .filter(
            Documentation.published == True,
            Documentation.audience.in_(["sales_rep", "all"])
        )
        .order_by(Documentation.category, Documentation.order)
        .all()
    )

    return [
        {
            "id": doc.id,
            "slug": doc.slug,
            "title": doc.title,
            "description": doc.description,
            "category": doc.category,
            "content": doc.content,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        }
        for doc in docs
    ]


@router.get("/demo-account")
def get_my_demo_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the demo account for the authenticated sales rep."""
    if current_user.user_type not in ("salesman", "admin"):
        raise AuthorizationException("Sales rep access required")

    demo = db.query(User).filter(
        User.demo_owner_sales_rep_id == current_user.id,
        User.deleted_at.is_(None),
        User.is_demo == True,
    ).first()

    if not demo:
        return {"exists": False}

    listing_count = db.query(func.count(Listing.id)).filter(Listing.user_id == demo.id).scalar() or 0

    return {
        "exists": True,
        "id": demo.id,
        "email": demo.email,
        "company_name": demo.company_name,
        "listings": listing_count,
    }


@router.post("/demo-account")
def create_my_demo_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Self-service: let a sales rep provision their own demo account."""
    if current_user.user_type != "salesman":
        raise AuthorizationException("Sales rep access required")

    existing_demo = db.query(User).filter(
        User.demo_owner_sales_rep_id == current_user.id,
        User.is_demo == True,
        User.deleted_at.is_(None),
    ).first()

    if existing_demo:
        raise ValidationException(f"You already have a demo account (ID: {existing_demo.id})")

    try:
        result = create_demo_account_for_owner(db, owner=current_user, created_by_user_id=current_user.id)
        db.commit()
    except Exception as e:
        db.rollback()
        raise ValidationException(f"Failed to create demo account: {str(e)}")

    demo_user = result["demo_user"]
    listing_count = result["listings_created"]

    return {
        "exists": True,
        "id": demo_user.id,
        "email": demo_user.email,
        "company_name": demo_user.company_name,
        "listings": listing_count,
    }


# --------------------------------------------------------------------------- #
# Register Broker (Sales-Rep initiated)
# --------------------------------------------------------------------------- #

@router.post("/register-broker")
def register_broker_for_sales_rep(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allow a sales rep to manually register a new broker/dealer account."""
    if current_user.user_type not in ("salesman", "admin"):
        raise AuthorizationException("Sales rep access required")

    # Admins can target a specific sales rep; sales reps default to self
    target_sales_rep: User | None = None
    if current_user.user_type == "salesman":
        target_sales_rep = current_user
    else:
        sales_rep_id = data.get("sales_rep_id")
        if sales_rep_id:
            target_sales_rep = db.query(User).filter(
                User.id == int(sales_rep_id),
                User.user_type == "salesman",
            ).first()
            if not target_sales_rep:
                raise ResourceNotFoundException("Sales rep", sales_rep_id)

    # --- validate required fields ---------------------------------------- #
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise ValidationException("Email is required")

    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    company_name = (data.get("company_name") or "").strip()
    phone = normalize_phone(data.get("phone"))
    tier = (data.get("subscription_tier") or "basic").strip().lower()
    always_free = bool(data.get("always_free", False))

    if tier not in TIER_PRICES:
        raise ValidationException(f"Invalid subscription tier: {tier}")

    # Check duplicate email
    existing = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )
    if existing:
        raise ValidationException("A user with this email already exists")

    # --- user data ------------------------------------------------------- #
    # Generate a locked placeholder hash — the broker sets their real password
    # via the emailed setup link.  We bypass the strength validator because
    # this value is never exposed to anyone.
    _placeholder = secrets.token_urlsafe(64)
    hashed = pwd_context.hash(_placeholder)
    set_pw_token = secrets.token_urlsafe(32)

    # Calculate custom/effective price (allow on any tier; required for Ultimate)
    custom_price = None
    effective_price = 0.0 if always_free else float(TIER_PRICES.get(tier, 0.0))
    if data.get("custom_price") is not None and not always_free:
        try:
            val = float(data["custom_price"])
            if val >= 0:
                custom_price = val
                effective_price = val
        except (ValueError, TypeError):
            pass

    if tier == "ultimate" and custom_price is None and not always_free:
        raise ValidationException("Ultimate tier requires a custom price")

    # --- deal / discount (free trial days + %/$ discount) ----------------- #
    # Parsed here (before the user/referral are created) because both the
    # trial fields on `new_user` and `effective_price` used for the referral's
    # commission basis depend on these values. Previously this block ran
    # *after* the user and referral were already committed, computed an
    # unused `has_deal` flag, and never touched trial_active/trial_end_date
    # or effective_price at all — a sales rep could apply a deal with "14
    # free trial days + 20% off" in the UI, see a success response, and the
    # broker's account would be created with no trial and full price.
    free_days = None
    if not always_free:
        try:
            free_days = int(data.get("free_days")) if data.get("free_days") not in (None, "") else None
        except (ValueError, TypeError):
            free_days = None

    discount_type = data.get("discount_type") or None
    discount_value = None
    if not always_free:
        try:
            discount_value = float(data.get("discount_value")) if data.get("discount_value") not in (None, "") else None
        except (ValueError, TypeError):
            discount_value = None

    if discount_value and discount_value > 0:
        if discount_type == "percentage":
            effective_price = round(max(0.0, effective_price * (1 - min(discount_value, 100.0) / 100.0)), 2)
        elif discount_type == "amount":
            effective_price = round(max(0.0, effective_price - discount_value), 2)

    trial_active = bool(free_days and free_days > 0)
    trial_end_date = (datetime.utcnow() + timedelta(days=free_days)) if trial_active else None

    new_user = User(
        email=email,
        password_hash=hashed,
        first_name=first_name or None,
        last_name=last_name or None,
        phone=phone or None,
        user_type="dealer",
        company_name=company_name or None,
        subscription_tier=tier,
        custom_subscription_price=None if always_free else custom_price,
        always_free=always_free,
        verification_token=set_pw_token,
        assigned_sales_rep_id=target_sales_rep.id if target_sales_rep else None,
        active=True,
        verified=False,
        trial_active=trial_active,
        trial_end_date=trial_end_date,
    )
    db.add(new_user)
    db.flush()  # get new_user.id

    # --- create dealer profile ------------------------------------------- #
    slug = create_slug(company_name or f"{first_name} {last_name}".strip() or email.split("@")[0], db, DealerProfile)
    profile = DealerProfile(
        user_id=new_user.id,
        name=f"{first_name} {last_name}".strip() or company_name or email.split("@")[0],
        company_name=company_name or None,
        email=email,
        phone=phone or None,
        slug=slug,
    )
    db.add(profile)

    # --- generate API key ------------------------------------------------ #
    try:
        generate_api_key_for_dealer(new_user, db)
    except Exception:
        pass  # non-critical

    # --- create referral signup ------------------------------------------ #
    affiliate_account = None
    if target_sales_rep:
        affiliate_account = _ensure_sales_rep_affiliate_account(
            target_sales_rep, db, created_by=current_user.id
        )
        commission_rate = float(target_sales_rep.commission_rate or 10.0)

        referral = ReferralSignup(
            dealer_user_id=new_user.id,
            source_type="sales_rep_manual",
            sales_rep_id=target_sales_rep.id,
            affiliate_account_id=affiliate_account.id,
            referral_code_used=affiliate_account.code,
            effective_monthly_price=effective_price,
            commission_rate=commission_rate,
        )
        db.add(referral)

    db.commit()
    db.refresh(new_user)

    # Send password-setup email so the broker can log in
    import logging as _logging
    display_name = first_name or company_name or email.split("@")[0]
    set_pw_url = f"{email_service.base_url}/set-password?token={set_pw_token}"
    try:
        email_service.send_password_set_email(email, display_name, set_pw_url)
        email_sent = True
    except Exception as _exc:
        _logging.warning(f"Failed to send password setup email to {email}: {_exc}")
        email_sent = False

    return {
        "message": "Broker registered successfully",
        "dealer_id": new_user.id,
        "email": new_user.email,
        "company_name": new_user.company_name,
        "subscription_tier": new_user.subscription_tier,
        "password_setup_email_sent": email_sent,
        "slug": slug,
        "always_free": new_user.always_free,
        "assigned_sales_rep_id": new_user.assigned_sales_rep_id,
        "trial_active": new_user.trial_active,
        "trial_end_date": new_user.trial_end_date.isoformat() if new_user.trial_end_date else None,
        "effective_monthly_price": effective_price,
    }


# --------------------------------------------------------------------------- #
# Broker Tiers (read-only for sales reps)
# --------------------------------------------------------------------------- #

@router.get("/broker-tiers")
def get_broker_tiers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get broker subscription tiers with features and pricing.

    Only returns tiers marked active — brokers now pay a single flat
    one-time setup fee (see BROKER_SETUP_FEE) rather than choosing between
    tiered monthly plans, so the deprecated basic/plus tiers are excluded
    here even if a saved admin config still has them flagged active from
    before that pivot.
    """
    if current_user.user_type not in ("salesman", "admin"):
        raise AuthorizationException("Sales rep access required")

    # Merge saved config (if admin has customised) with defaults
    site = db.query(SiteSettings).first()
    saved = {}
    if site and site.subscription_config:
        saved = site.subscription_config.get("broker_tiers", {})

    merged = {**_DEFAULT_BROKER_TIERS, **saved}
    active_only = {k: v for k, v in merged.items() if v.get("active", True)}
    return {"tiers": active_only}
