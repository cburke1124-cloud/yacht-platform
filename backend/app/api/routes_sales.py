
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import secrets

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.listing import Listing
from app.models.dealer import DealerProfile
from app.models.partner_growth import AffiliateAccount, PartnerDeal, ReferralSignup, PartnerOffer
from app.models.documentation import Documentation
from app.exceptions import AuthorizationException, ResourceNotFoundException, ValidationException
from app.security.auth import get_password_hash, pwd_context
from app.services.email_service import email_service
from app.utils.slug import create_slug
from app.services.api_key_service import generate_api_key_for_dealer
from app.models.misc import SiteSettings

router = APIRouter()

TIER_PRICES = {
    "free": 0.0,
    "trial": 0.0,
    "basic": 199.0,
    "plus": 299.0,
    "premium": 499.0,
    "pro": 499.0,
    "ultimate": 0.0,  # Custom/enterprise pricing — managed manually
    "private_basic": 9.0,
    "private_plus": 19.0,
    "private_pro": 39.0,
}


_DEFAULT_BROKER_TIERS = {
    "basic":    {"name": "Basic",    "price": 199,  "listings": 25,     "images_per_listing": 15,     "videos_per_listing": 1,      "features": ["25 active listings", "15 images per listing", "1 video per listing", "Enhanced search visibility", "Priority email support", "Analytics dashboard"],                                                              "trial_days": 14, "active": True},
    "plus":     {"name": "Plus",     "price": 299,  "listings": 75,     "images_per_listing": 30,     "videos_per_listing": 3,      "features": ["75 active listings", "30 images per listing", "3 videos per listing", "Priority search placement", "Featured broker badge", "Priority support", "Advanced analytics"],                                       "trial_days": 14, "active": True},
    "pro":      {"name": "Pro",      "price": 499,  "listings": 999999, "images_per_listing": 50,     "videos_per_listing": 5,      "features": ["Unlimited listings", "50 images per listing", "5 videos per listing", "Top search placement", "Featured broker badge", "Dedicated account manager", "Advanced analytics", "AI scraper tools"],            "trial_days": 30, "active": True},
    "ultimate": {"name": "Ultimate", "price": 0,   "listings": 999999, "images_per_listing": 999999, "videos_per_listing": 999999, "features": ["Unlimited listings", "Unlimited images & video", "White-glove onboarding", "Dedicated account manager", "Custom API integrations", "Premium search placement"], "trial_days": 0, "active": True, "is_custom_pricing": True},
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
    """Get sales rep analytics with dealer details."""
    if current_user.user_type != "salesman":
        raise AuthorizationException("Sales rep access required")

    affiliate_account = _ensure_sales_rep_affiliate_account(current_user, db)

    referrals = db.query(ReferralSignup).filter(
        ReferralSignup.sales_rep_id == current_user.id
    ).all()

    referred_dealer_ids = {r.dealer_user_id for r in referrals}

    assigned_dealers = db.query(User).filter(
        User.assigned_sales_rep_id == current_user.id
    ).all()

    dealer_map = {d.id: d for d in assigned_dealers}
    if referred_dealer_ids:
        extra_dealers = db.query(User).filter(User.id.in_(list(referred_dealer_ids))).all()
        for dealer in extra_dealers:
            dealer_map[dealer.id] = dealer

    dealers = list(dealer_map.values())

    referral_map = {r.dealer_user_id: r for r in referrals}
    active_dealers_list = [d for d in dealers if d.active]

    monthly_revenue = 0.0
    monthly_commission = 0.0
    for dealer in active_dealers_list:
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
        
        dealer_stats.append({
            "dealer_id": dealer.id,
            "dealer_name": f"{dealer.first_name} {dealer.last_name}",
            "company_name": dealer.company_name,
            "email": dealer.email,
            "subscription_tier": dealer.subscription_tier,
            "total_listings": listing_count,
            "active_listings": active_listings,
            "total_views": stats.total_views or 0,
            "total_inquiries": stats.total_inquiries or 0,
            "joined_date": dealer.created_at.isoformat() if dealer.created_at else None,
            "active": dealer.active,
            "effective_monthly_price": float(referral_map[dealer.id].effective_monthly_price) if dealer.id in referral_map and referral_map[dealer.id].effective_monthly_price is not None else float(TIER_PRICES.get(dealer.subscription_tier, 0.0)),
            "commission_rate": float(referral_map[dealer.id].commission_rate) if dealer.id in referral_map and referral_map[dealer.id].commission_rate is not None else float(current_user.commission_rate or 10.0),
            "referred": dealer.id in referral_map,
        })

    return {
        "total_dealers": len(dealers),
        "active_dealers": len(active_dealers_list),
        "monthly_revenue": monthly_revenue,
        "monthly_commission": monthly_commission,
        "dealers": dealer_stats,
        "affiliate": {
            "code": affiliate_account.code,
            "referral_link": f"/register?user_type=dealer&ref={affiliate_account.code}",
            "commission_rate": float(affiliate_account.commission_rate or current_user.commission_rate or 10.0),
            "referred_signups": len(referrals),
        }
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
    phone = (data.get("phone") or "").strip()
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

    # Optional deal/trial settings -> create promotional offer for this dealer
    free_days = None
    try:
        free_days = int(data.get("free_days")) if data.get("free_days") not in [None, ""] else None
    except (ValueError, TypeError):
        free_days = None

    discount_type = (data.get("discount_type") or None)
    discount_value = None
    try:
        discount_value = float(data.get("discount_value")) if data.get("discount_value") not in [None, ""] else None
    except (ValueError, TypeError):
        discount_value = None

    has_deal = False if always_free else ((free_days and free_days > 0) or discount_value not in [None, ""])
    # TODO: Create promotional offer model if needed
    # if has_deal:
    #     offer = PromotionalOffer(...)
    #     db.add(offer)

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
    }


# --------------------------------------------------------------------------- #
# Broker Tiers (read-only for sales reps)
# --------------------------------------------------------------------------- #

@router.get("/broker-tiers")
def get_broker_tiers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get broker subscription tiers with features and pricing."""
    if current_user.user_type not in ("salesman", "admin"):
        raise AuthorizationException("Sales rep access required")

    # Merge saved config (if admin has customised) with defaults
    site = db.query(SiteSettings).first()
    saved = {}
    if site and site.subscription_config:
        saved = site.subscription_config.get("broker_tiers", {})

    merged = {**_DEFAULT_BROKER_TIERS, **saved}
    return {"tiers": merged}
