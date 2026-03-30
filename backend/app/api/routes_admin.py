from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from typing import Optional
import secrets
import sys
import platform
import os
import time
import logging
import uuid
import time
import stripe

from app.core.logging import memory_log_handler

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.models.media import MediaFile, MediaFolder, ListingMediaAttachment
from app.models.partner_growth import AffiliateAccount, ReferralSignup
from app.models.partner_growth import PartnerDeal
from app.models.misc import SiteSettings
from app.exceptions import (
    AuthorizationException,
    ValidationException,
    ResourceNotFoundException
)
from app.services.media_storage import get_storage_health, run_storage_test
from app.services.clamav_service import health_check as clamav_health_check
from app.security.auth import get_password_hash
from app.services.email_service import email_service
from app.services.demo_fixtures import get_demo_listing_data
from app.models.documentation import Documentation
from app.services.default_documentation import get_default_doc_by_slug

router = APIRouter()
ps_start_time = time.time()


def _generate_ref_code() -> str:
    return f"YV{secrets.token_hex(4).upper()}"


def _ensure_sales_rep_affiliate_account(sales_rep: User, db: Session, created_by: Optional[int] = None) -> AffiliateAccount:
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
        created_by=created_by,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def require_admin(current_user: User = Depends(get_current_user)):
    """Dependency to require admin access."""
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    return current_user


# --------------------------------------------------------------------------- #
# System health & info (used by admin dashboard)
# --------------------------------------------------------------------------- #

_ENV_KEYS = [
    "DATABASE_URL",
    "SECRET_KEY",
    "SENDGRID_API_KEY",
    "CLAUDE_API_KEY",
    "S3_BUCKET",
    "S3_ENDPOINT_URL",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "MEDIA_STORAGE_BACKEND",
    "FRONTEND_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_BASIC",
    "STRIPE_PRICE_PREMIUM",
    "GOOGLE_MAPS_API_KEY",
    "HCAPTCHA_SECRET",
    "HCAPTCHA_SITEKEY",
    "AUTO_CREATE_TABLES",
    "ENABLE_CLAMAV",
    "FROM_EMAIL",
]


@router.get("/system/health")
def system_health(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Environment variable presence
    env_vars = {k: ("set" if os.getenv(k) else "missing") for k in _ENV_KEYS}

    # Database connectivity + lightweight counts
    db_status = {"status": "ok"}
    table_counts = {"status": "ok", "counts": {}}
    try:
        db.execute(text("SELECT 1"))
        table_counts["counts"] = {
            "users": db.query(User).count(),
            "listings": db.query(Listing).count(),
            "dealer_profiles": db.query(DealerProfile).count(),
        }
    except Exception as e:
        db.rollback()
        db_status = {"status": "error", "message": str(e)}
        table_counts = {"status": "error"}

    # Storage health (best-effort)
    storage = {"status": "unknown"}
    try:
        storage = get_storage_health()
    except Exception:
        pass

    # Scheduler / email metadata (minimal)
    scheduler = {"status": "unknown", "jobs": None}
    email_status = {
        "status": "set" if os.getenv("SENDGRID_API_KEY") else "missing",
        "provider": "sendgrid",
    }

    # ClamAV (best-effort)
    clamav = {"status": "unknown"}
    try:
        clamav = clamav_health_check()
    except Exception:
        pass

    return {
        "database": db_status,
        "table_counts": table_counts,
        "storage": storage,
        "scheduler": scheduler,
        "email": email_status,
        "clamav": clamav,
        "env_vars": env_vars,
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.post("/system/test-email")
def test_email(
    data: dict,
    current_user: User = Depends(require_admin),
):
    """
    Admin-only: send a test email to verify SendGrid configuration.
    Body: { "to": "recipient@example.com" }
    """
    to = (data.get("to") or "").strip()
    if not to:
        return {"success": False, "error": "Missing 'to' field"}

    from app.services.email_service import email_service

    diag = {
        "api_key_set": bool(email_service.api_key),
        "api_key_prefix": (email_service.api_key or "")[:7] + "..." if email_service.api_key else None,
        "from_email": email_service.from_email,
        "base_url": email_service.base_url,
    }

    try:
        result = email_service.send_email(
            to_email=to,
            subject="YachtVersal Test Email",
            html_content="<h2>It works!</h2><p>This is a test email from your YachtVersal backend.</p>",
        )
        return {"success": True, "send_result": result, "diagnostics": diag}
    except Exception as e:
        return {"success": False, "error": str(e), "diagnostics": diag}


@router.get("/system/info")
def system_info(current_user: User = Depends(require_admin)):
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    log_file_path = os.path.join(base_dir, "logs", "yachtversal.log")
    log_file = {
        "path": log_file_path,
        "exists": os.path.isfile(log_file_path),
    }
    if log_file["exists"]:
        log_file["size_bytes"] = os.path.getsize(log_file_path)

    return {
        "pid": os.getpid(),
        "platform": platform.platform(),
        "python_version": sys.version,
        "uptime_seconds": time.time() - ps_start_time,
        "uptime_human": f"{round((time.time() - ps_start_time)/3600, 2)}h",
        "log_buffer_entries": getattr(memory_log_handler, "buffer_size", len(getattr(memory_log_handler, "records", []))),
        "log_file": log_file,
    }


@router.get("/storage/health")
def storage_health(
    current_user: User = Depends(require_admin),
):
    return get_storage_health()


@router.post("/storage/health/test")
def storage_health_test(
    current_user: User = Depends(require_admin),
):
    try:
        return run_storage_test()
    except Exception as e:
        return {
            "success": False,
            "message": f"Storage test failed: {str(e)}",
        }

# ============= Commission Management =============

@router.put("/sales-reps/{rep_id}/commission")
def update_sales_rep_commission(
    rep_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a sales rep's commission rate (admin only)."""
    sales_rep = db.query(User).filter(
        User.id == rep_id,
        User.user_type == "salesman"
    ).first()
    
    if not sales_rep:
        raise ResourceNotFoundException("Sales rep", rep_id)
    
    new_rate = data.get("commission_rate")
    if new_rate is None or new_rate < 0 or new_rate > 100:
        raise ValidationException("Commission rate must be between 0 and 100")
    
    # Log the change in history
    from app.models.misc import CommissionRateHistory
    
    old_rate = sales_rep.commission_rate or 10.0
    
    history = CommissionRateHistory(
        sales_rep_id=rep_id,
        old_rate=old_rate,
        new_rate=new_rate,
        reason=data.get("reason", "Rate adjustment"),
        changed_by_user_id=current_user.id
    )
    db.add(history)
    
    # Update the rate
    sales_rep.commission_rate = new_rate

    affiliate_account = db.query(AffiliateAccount).filter(
        AffiliateAccount.user_id == sales_rep.id,
        AffiliateAccount.account_type == "sales_rep",
    ).first()
    if affiliate_account:
        affiliate_account.commission_rate = float(new_rate)
    
    db.commit()
    db.refresh(sales_rep)
    
    return {
        "success": True,
        "sales_rep_id": rep_id,
        "old_rate": float(old_rate),
        "new_rate": float(new_rate)
    }


@router.get("/sales-reps/{rep_id}/commission-history")
def get_commission_history(
    rep_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get commission rate change history for a sales rep."""
    from app.models.misc import CommissionRateHistory
    
    history = db.query(CommissionRateHistory).filter(
        CommissionRateHistory.sales_rep_id == rep_id
    ).order_by(CommissionRateHistory.changed_at.desc()).all()
    
    return [
        {
            "old_rate": float(h.old_rate),
            "new_rate": float(h.new_rate),
            "reason": h.reason,
            "changed_at": h.changed_at.isoformat(),
            "changed_by": h.changed_by_user_id
        }
        for h in history
    ]

# ============= USERS MANAGEMENT =============

@router.get("/users")
def get_all_users(
    skip: int = 0,
    limit: int = 100,
    user_type: Optional[str] = None,
    search: Optional[str] = None,
    subscription_status: Optional[str] = None,  # active, lapsed, trial, never_paid, always_free
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all users with filtering."""
    _PAID_TIERS = ["basic", "plus", "pro", "premium", "private_basic", "private_plus", "private_pro"]

    query = db.query(User)

    if user_type:
        query = query.filter(User.user_type == user_type)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_pattern)) |
            (User.first_name.ilike(search_pattern)) |
            (User.last_name.ilike(search_pattern)) |
            (User.company_name.ilike(search_pattern))
        )

    if subscription_status == "active":
        query = query.filter(User.subscription_tier.in_(_PAID_TIERS), User.always_free != True)
    elif subscription_status == "lapsed":
        # Had a Stripe subscription but tier is now free → payment lapsed / cancelled
        query = query.filter(
            User.stripe_subscription_id.isnot(None),
            ~User.subscription_tier.in_(_PAID_TIERS),
            User.always_free != True,
        )
    elif subscription_status == "trial":
        query = query.filter(User.trial_active == True)
    elif subscription_status == "never_paid":
        # Dealer/private with no Stripe customer at all, not active, not trial
        query = query.filter(
            User.user_type.in_(["dealer", "private"]),
            User.stripe_customer_id.is_(None),
            User.trial_active != True,
            ~User.subscription_tier.in_(_PAID_TIERS),
        )
    elif subscription_status == "always_free":
        query = query.filter(User.always_free == True)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "company_name": u.company_name,
                "user_type": u.user_type,
                "subscription_tier": u.subscription_tier,
                "stripe_customer_id": u.stripe_customer_id,
                "stripe_subscription_id": u.stripe_subscription_id,
                "always_free": u.always_free,
                "active": u.active,
                "trial_active": u.trial_active,
                "trial_end_date": u.trial_end_date.isoformat() if u.trial_end_date else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.get("/users/{user_id}")
def get_user_details(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get detailed user information."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    # Get dealer profile if exists
    dealer_profile = db.query(DealerProfile).filter(
        DealerProfile.user_id == user_id
    ).first()
    
    # Get listing stats
    listing_stats = db.query(
        func.count(Listing.id).label('total'),
        func.count(Listing.id).filter(Listing.status == 'active').label('active'),
        func.sum(Listing.views).label('total_views'),
        func.sum(Listing.inquiries).label('total_inquiries')
    ).filter(Listing.user_id == user_id).first()
    
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "company_name": user.company_name,
        "user_type": user.user_type,
        "subscription_tier": user.subscription_tier,
        "active": user.active,
        "trial_active": user.trial_active,
        "trial_end_date": user.trial_end_date.isoformat() if user.trial_end_date else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "dealer_profile": {
            "slug": dealer_profile.slug,
            "logo_url": dealer_profile.logo_url,
            "website": dealer_profile.website,
            "description": dealer_profile.description
        } if dealer_profile else None,
        "listing_stats": {
            "total_listings": listing_stats.total or 0,
            "active_listings": listing_stats.active or 0,
            "total_views": listing_stats.total_views or 0,
            "total_inquiries": listing_stats.total_inquiries or 0
        }
    }


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update user details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    updatable_fields = [
        'first_name', 'last_name', 'phone', 'company_name',
        'user_type', 'subscription_tier', 'active', 'trial_active'
    ]
    
    for field in updatable_fields:
        if field in data:
            setattr(user, field, data[field])
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return {"success": True, "user": {
        "id": user.id,
        "email": user.email,
        "user_type": user.user_type,
        "subscription_tier": user.subscription_tier
    }}


@router.post("/users/{user_id}/sync-stripe")
def sync_user_stripe(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Pull the user's current Stripe subscription state and update the DB.
    Use this to fix users whose subscription_tier is wrong after a payment.
    """
    from app.core.config import settings
    from app.services.stripe_service import STRIPE_PRICES_REVERSE

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)

    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    updated = {}

    # Sync via stripe_subscription_id if we have one
    if user.stripe_subscription_id:
        try:
            sub = stripe.Subscription.retrieve(user.stripe_subscription_id)
            if sub.status in ("active", "trialing"):
                price_id = sub["items"]["data"][0]["price"]["id"]
                tier = STRIPE_PRICES_REVERSE.get(price_id)
                if tier and user.subscription_tier != tier:
                    user.subscription_tier = tier
                    updated["subscription_tier"] = tier
                if sub.status == "trialing" and sub.trial_end:
                    user.trial_active = True
                    user.trial_end_date = datetime.utcfromtimestamp(sub.trial_end)
                    updated["trial_active"] = True
            elif sub.status in ("past_due", "unpaid", "incomplete_expired", "canceled"):
                user.subscription_tier = "free"
                updated["subscription_tier"] = "free"
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    # Also try looking up by customer_id for latest subscription if none stored
    elif user.stripe_customer_id:
        try:
            subs = stripe.Subscription.list(customer=user.stripe_customer_id, status="active", limit=1)
            if subs.data:
                sub = subs.data[0]
                user.stripe_subscription_id = sub.id
                price_id = sub["items"]["data"][0]["price"]["id"]
                tier = STRIPE_PRICES_REVERSE.get(price_id)
                if tier:
                    user.subscription_tier = tier
                    updated["subscription_tier"] = tier
                updated["stripe_subscription_id"] = sub.id
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=502, detail=f"Stripe error: {e}")
    else:
        raise HTTPException(status_code=400, detail="User has no Stripe customer or subscription ID")

    db.commit()
    return {
        "success": True,
        "updated": updated,
        "user": {
            "id": user.id,
            "email": user.email,
            "subscription_tier": user.subscription_tier,
            "stripe_subscription_id": user.stripe_subscription_id,
        },
    }


@router.patch("/users/{user_id}/email")
def change_user_email(
    user_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: change a user's email address."""
    new_email = (data.get("email") or "").strip().lower()
    if not new_email or "@" not in new_email:
        raise ValidationException("A valid email address is required")

    # Check uniqueness
    existing = db.query(User).filter(User.email == new_email, User.id != user_id).first()
    if existing:
        raise ValidationException("That email address is already in use")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)

    old_email = user.email
    user.email = new_email
    user.updated_at = datetime.utcnow()
    db.commit()

    logging.info("Admin %s changed user %s email: %s → %s", current_user.email, user_id, old_email, new_email)
    return {"success": True, "email": new_email}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    permanent: bool = False,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete or deactivate a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    if permanent:
        # Delete user and all their listings
        db.query(Listing).filter(Listing.user_id == user_id).delete()
        db.delete(user)
        message = "User permanently deleted"
    else:
        # Just deactivate
        user.active = False
        message = "User deactivated"
    
    db.commit()
    return {"success": True, "message": message}


# ============= DEALERS MANAGEMENT =============

@router.get("/dealers")
def get_all_dealers(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    subscription_status: Optional[str] = None,  # active, lapsed, trial, never_paid, always_free
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all dealers with their stats."""
    _PAID_TIERS = ["basic", "plus", "pro", "premium", "private_basic", "private_plus", "private_pro"]

    query = db.query(User).filter(User.user_type == "dealer")

    if search:
        sp = f"%{search}%"
        query = query.filter(
            (User.email.ilike(sp)) |
            (User.first_name.ilike(sp)) |
            (User.last_name.ilike(sp)) |
            (User.company_name.ilike(sp))
        )

    if subscription_status == "active":
        query = query.filter(User.subscription_tier.in_(_PAID_TIERS), User.always_free != True)
    elif subscription_status == "lapsed":
        query = query.filter(
            User.stripe_subscription_id.isnot(None),
            ~User.subscription_tier.in_(_PAID_TIERS),
            User.always_free != True,
        )
    elif subscription_status == "trial":
        query = query.filter(User.trial_active == True)
    elif subscription_status == "never_paid":
        query = query.filter(
            User.stripe_customer_id.is_(None),
            User.trial_active != True,
            ~User.subscription_tier.in_(_PAID_TIERS),
        )
    elif subscription_status == "always_free":
        query = query.filter(User.always_free == True)

    total = query.count()
    dealers = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    dealer_list = []
    for dealer in dealers:
        listing_count = db.query(Listing).filter(Listing.user_id == dealer.id).count()
        active_listings = db.query(Listing).filter(
            Listing.user_id == dealer.id, Listing.status == "active"
        ).count()

        dealer_list.append({
            "id": dealer.id,
            "name": f"{dealer.first_name or ''} {dealer.last_name or ''}".strip() or dealer.email,
            "email": dealer.email,
            "first_name": dealer.first_name,
            "last_name": dealer.last_name,
            "phone": dealer.phone,
            "company_name": dealer.company_name,
            "subscription_tier": dealer.subscription_tier,
            "stripe_customer_id": dealer.stripe_customer_id,
            "stripe_subscription_id": dealer.stripe_subscription_id,
            "always_free": dealer.always_free,
            "trial_active": dealer.trial_active,
            "trial_end_date": dealer.trial_end_date.isoformat() if dealer.trial_end_date else None,
            "verified": dealer.verified,
            "active": dealer.active,
            "total_listings": listing_count,
            "active_listings": active_listings,
            "created_at": dealer.created_at.isoformat() if dealer.created_at else None,
            "assigned_sales_rep_id": dealer.assigned_sales_rep_id,
            "subscription_monthly_price": dealer.subscription_monthly_price,
            "custom_subscription_price": dealer.custom_subscription_price,
            "trial_active": dealer.trial_active,
            "always_free": dealer.always_free,
        })

    return {"total": total, "dealers": dealer_list}


@router.post("/dealers")
def create_dealer(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new dealer account and send a password-setup email."""
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise ValidationException("Email is required")

    # Check for duplicate
    if db.query(User).filter(User.email == email).first():
        raise ValidationException("A user with that email already exists")

    # Split name into first/last
    raw_name = (data.get("name") or "").strip()
    parts = raw_name.split(" ", 1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""

    # Generate a one-time setup token stored in verification_token
    setup_token = secrets.token_urlsafe(32)
    # Unusable random password — dealer cannot log in until they set their own
    dummy_hash = get_password_hash(secrets.token_urlsafe(32))

    dealer = User(
        email=email,
        password_hash=dummy_hash,
        first_name=first_name,
        last_name=last_name,
        phone=data.get("phone"),
        company_name=data.get("company_name"),
        user_type="dealer",
        subscription_tier="free",
        verified=bool(data.get("verified", False)),
        active=bool(data.get("active", True)),
        verification_token=setup_token,
        email_verified=False,
    )
    db.add(dealer)
    db.commit()
    db.refresh(dealer)

    # Send password-setup email
    base_url = __import__("os").getenv("BASE_URL", "https://yachtversal.com")
    setup_link = f"{base_url}/set-password?token={setup_token}"
    display_name = raw_name or email
    html = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(to right,#0f4c81,#1a6fad);padding:30px;text-align:center">
        <h1 style="color:white;margin:0">Welcome to YachtVersal</h1>
      </div>
      <div style="padding:30px;background:#f9fafb">
        <h2 style="color:#1f2937">Hi {display_name},</h2>
        <p style="color:#4b5563">Your dealer account has been created. Click the button below to set up your password and access your dashboard.</p>
        <div style="text-align:center;margin:30px 0">
          <a href="{setup_link}" style="background:#0f4c81;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
            Set Up My Password
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px">This link expires in 72&nbsp;hours. If you did not expect this email, you can ignore it.</p>
      </div>
    </body></html>
    """
    try:
        email_service.send_email(
            to_email=email,
            subject="Set up your YachtVersal dealer account",
            html_content=html,
        )
        email_sent = True
    except Exception:
        email_sent = False

    return {
        "success": True,
        "id": dealer.id,
        "email": dealer.email,
        "name": f"{dealer.first_name or ''} {dealer.last_name or ''}".strip(),
        "email_sent": email_sent,
        "message": "Dealer created. A password-setup email has been sent." if email_sent else "Dealer created. Email could not be sent — check SendGrid configuration.",
    }


@router.put("/dealers/{dealer_id}")
def update_dealer(
    dealer_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update dealer fields (verified, active, name, company, etc.)."""
    dealer = db.query(User).filter(User.id == dealer_id, User.user_type == "dealer").first()
    if not dealer:
        raise ResourceNotFoundException("Dealer", dealer_id)

    updatable = ["first_name", "last_name", "phone", "company_name",
                 "verified", "active", "subscription_tier"]
    for field in updatable:
        if field in data:
            setattr(dealer, field, data[field])

    db.commit()
    db.refresh(dealer)
    return {"success": True, "id": dealer.id, "verified": dealer.verified, "active": dealer.active}


@router.delete("/dealers/{dealer_id}")
def delete_dealer(
    dealer_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Permanently delete a dealer and their listings."""
    dealer = db.query(User).filter(User.id == dealer_id, User.user_type == "dealer").first()
    if not dealer:
        raise ResourceNotFoundException("Dealer", dealer_id)

    db.query(Listing).filter(Listing.user_id == dealer_id).delete()
    db.delete(dealer)
    db.commit()
    return {"success": True, "message": "Dealer deleted"}


@router.get("/dealers/{dealer_id}/team")
def get_dealer_team(
    dealer_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return all team members (salesman + sub-accounts) whose parent_dealer_id = dealer_id."""
    dealer = db.query(User).filter(User.id == dealer_id).first()
    if not dealer:
        raise ResourceNotFoundException("Dealer", dealer_id)

    members = (
        db.query(User)
        .filter(User.parent_dealer_id == dealer_id)
        .order_by(User.created_at)
        .all()
    )

    return {
        "dealer_id": dealer_id,
        "team": [
            {
                "id": m.id,
                "email": m.email,
                "first_name": m.first_name,
                "last_name": m.last_name,
                "phone": m.phone,
                "user_type": m.user_type,
                "role": m.role,
                "active": m.active,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in members
        ],
    }


# ============= MEDIA MANAGEMENT =============

@router.get("/media/stats")
def get_media_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get media storage statistics."""
    from app.models.media import MediaFile, MediaFolder

    # Total files and storage
    total_stats = db.query(
        func.count(MediaFile.id).label('total_files'),
        func.sum(MediaFile.file_size_mb).label('total_size_mb')
    ).filter(MediaFile.deleted_at == None).first()

    # Stats by file type
    image_stats = db.query(
        func.count(MediaFile.id).label('count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).filter(
        MediaFile.file_type == 'image',
        MediaFile.deleted_at == None
    ).first()

    video_stats = db.query(
        func.count(MediaFile.id).label('count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).filter(
        MediaFile.file_type == 'video',
        MediaFile.deleted_at == None
    ).first()
    
    pdf_stats = db.query(
        func.count(MediaFile.id).label('count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).filter(
        MediaFile.file_type == 'pdf',
        MediaFile.deleted_at == None
    ).first()
    
    # Storage by dealer
    dealer_storage = db.query(
        User.id.label('dealer_id'),
        User.company_name.label('dealer_name'),
        User.subscription_tier.label('tier'),
        func.count(MediaFile.id).label('file_count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).join(MediaFile, MediaFile.user_id == User.id).filter(
        User.user_type == 'dealer',
        MediaFile.deleted_at == None
    ).group_by(User.id).order_by(func.sum(MediaFile.file_size_mb).desc()).limit(20).all()
    
    # Orphaned files (not associated with any listing)
    orphaned_count = db.query(func.count(MediaFile.id)).filter(
        MediaFile.deleted_at == None
    ).outerjoin(
        ListingMediaAttachment,
        MediaFile.id == ListingMediaAttachment.media_id
    ).filter(
        ListingMediaAttachment.id == None
    ).scalar()
    
    # Large files (over 10MB)
    large_files_count = db.query(func.count(MediaFile.id)).filter(
        MediaFile.file_size_mb > 10,
        MediaFile.deleted_at == None
    ).scalar()
    
    return {
        "total_files": total_stats.total_files or 0,
        "total_size_gb": (total_stats.total_size_mb or 0) / 1024,
        "by_type": {
            "images": {
                "count": image_stats.count or 0,
                "size_gb": (image_stats.size_mb or 0) / 1024
            },
            "videos": {
                "count": video_stats.count or 0,
                "size_gb": (video_stats.size_mb or 0) / 1024
            },
            "pdfs": {
                "count": pdf_stats.count or 0,
                "size_gb": (pdf_stats.size_mb or 0) / 1024
            }
        },
        "by_dealer": [
            {
                "dealer_id": d.dealer_id,
                "dealer_name": d.dealer_name or "Unknown",
                "file_count": d.file_count,
                "size_gb": (d.size_mb or 0) / 1024,
                "tier": d.tier or "free"
            }
            for d in dealer_storage
        ],
        "orphaned_files": orphaned_count or 0,
        "large_files": large_files_count or 0
    }


@router.get("/media")
def get_all_media(
    skip: int = 0,
    limit: int = 50,
    file_type: Optional[str] = None,
    owner_id: Optional[int] = None,  # ← Keep parameter name for API
    search: Optional[str] = None,
    sort: str = "date",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all media files with filtering."""
    from app.models.media import MediaFile
    
    query = db.query(MediaFile).join(
        User, MediaFile.user_id == User.id  # ✅ CHANGED: uploaded_by_user_id → user_id
    ).filter(
        MediaFile.deleted_at == None
    )
    
    if file_type and file_type != 'all':
        query = query.filter(MediaFile.file_type == file_type)
    
    if owner_id:
        query = query.filter(MediaFile.user_id == owner_id)  # ✅ CHANGED
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (MediaFile.filename.ilike(search_pattern)) |
            (User.company_name.ilike(search_pattern))
        )
    
    # Sorting
    if sort == "size":
        query = query.order_by(MediaFile.file_size_mb.desc())
    elif sort == "usage":
        query = query.order_by(MediaFile.usage_count.desc())
    else:  # date
        query = query.order_by(MediaFile.created_at.desc())
    
    total = query.count()
    media_files = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "media": [
            {
                "id": m.id,
                "filename": m.filename,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "file_type": m.file_type,
                "file_size_mb": round(m.file_size_mb, 2) if m.file_size_mb else 0,
                "owner_id": m.user_id,  # ✅ CHANGED: Keep key name for API compatibility
                "owner_name": f"{m.user.first_name} {m.user.last_name}" if m.user else "Unknown",  # ✅ CHANGED: owner → user
                "owner_company": m.user.company_name if m.user else "N/A",  # ✅ CHANGED: owner → user
                "owner_type": m.user.user_type if m.user else "unknown",  # ✅ CHANGED: owner → user
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "used_in_listings": m.usage_count or 0,
                "views": m.view_count or 0
            }
            for m in media_files
        ]
    }
    
    # Sorting
    if sort == "size":
        query = query.order_by(MediaFile.file_size_mb.desc())
    elif sort == "usage":
        query = query.order_by(MediaFile.usage_count.desc())
    else:  # date
        query = query.order_by(MediaFile.created_at.desc())
    
    total = query.count()
    media_files = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "media": [
            {
                "id": m.id,
                "filename": m.filename,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "file_type": m.file_type,
                "file_size_mb": round(m.file_size_mb, 2) if m.file_size_mb else 0,
                "owner_id": m.user_id,
                "owner_name": f"{m.owner.first_name} {m.owner.last_name}" if m.owner else "Unknown",
                "owner_company": m.owner.company_name if m.owner else "N/A",
                "owner_type": m.owner.user_type if m.owner else "unknown",
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "used_in_listings": m.usage_count or 0,
                "views": m.view_count or 0
            }
            for m in media_files
        ]
    }


@router.delete("/media/bulk-delete")
def bulk_delete_media(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete multiple media files."""
    from app.models.media import MediaFile
    
    media_ids = data.get("media_ids", [])
    if not media_ids:
        raise ValidationException("No media IDs provided")
    
    # Soft delete
    deleted = db.query(MediaFile).filter(
        MediaFile.id.in_(media_ids)
    ).update(
        {"deleted_at": datetime.utcnow()},
        synchronize_session=False
    )
    db.commit()
    
    return {"success": True, "deleted": deleted}


@router.delete("/media/cleanup-orphaned")
def cleanup_orphaned_media(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete all orphaned media files."""
    from app.models.media import MediaFile, ListingMediaAttachment
    
    # Find orphaned media (not attached to any listing)
    orphaned_query = db.query(MediaFile).outerjoin(
        ListingMediaAttachment,
        MediaFile.id == ListingMediaAttachment.media_id
    ).filter(
        ListingMediaAttachment.id == None,
        MediaFile.deleted_at == None
    )
    
    count = orphaned_query.count()
    
    # Soft delete them
    orphaned_query.update(
        {"deleted_at": datetime.utcnow()},
        synchronize_session=False
    )
    db.commit()
    
    return {"success": True, "count": count}
    
    # ============= MEDIA MANAGEMENT (ADMIN) =============

@router.get("/media/stats")
def get_all_media_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get platform-wide media statistics"""
    from app.models.media import MediaFile
    
    # Total stats
    total_stats = db.query(
        func.count(MediaFile.id).label('total_files'),
        func.sum(MediaFile.file_size_mb).label('total_size_mb')
    ).filter(MediaFile.deleted_at == None).first()
    
    # By type
    type_stats = {}
    for file_type in ['image', 'video', 'pdf']:
        stats = db.query(
            func.count(MediaFile.id).label('count'),
            func.sum(MediaFile.file_size_mb).label('size_mb')
        ).filter(
            MediaFile.file_type == file_type,
            MediaFile.deleted_at == None
        ).first()
        
        type_stats[f"{file_type}s"] = {
            "count": stats.count or 0,
            "size_gb": (stats.size_mb or 0) / 1024
        }
    
    # By dealer
    dealer_stats = db.query(
        User.id.label('dealer_id'),
        User.company_name.label('dealer_name'),
        User.subscription_tier.label('tier'),
        func.count(MediaFile.id).label('file_count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).join(MediaFile, MediaFile.user_id == User.id).filter(
        User.user_type == 'dealer',
        MediaFile.deleted_at == None
    ).group_by(User.id).order_by(func.sum(MediaFile.file_size_mb).desc()).limit(20).all()
    
    # Orphaned files
    orphaned = db.query(func.count(MediaFile.id)).filter(
        MediaFile.listing_id == None,
        MediaFile.blog_post_id == None,
        MediaFile.deleted_at == None
    ).scalar()
    
    # Large files
    large_files = db.query(func.count(MediaFile.id)).filter(
        MediaFile.file_size_mb > 10,
        MediaFile.deleted_at == None
    ).scalar()
    
    return {
        "total_files": total_stats.total_files or 0,
        "total_size_gb": (total_stats.total_size_mb or 0) / 1024,
        "by_type": type_stats,
        "by_dealer": [
            {
                "dealer_id": d.dealer_id,
                "dealer_name": d.dealer_name or "Unknown",
                "file_count": d.file_count,
                "size_gb": (d.size_mb or 0) / 1024,
                "tier": d.tier or "free"
            }
            for d in dealer_stats
        ],
        "orphaned_files": orphaned or 0,
        "large_files": large_files or 0
    }


@router.get("/media")  # This appears twice - fix both!
def get_all_media(
    skip: int = 0,
    limit: int = 50,
    file_type: Optional[str] = None,
    owner_id: Optional[int] = None,
    search: Optional[str] = None,
    sort: str = "date",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all media files (admin only)"""
    from app.models.media import MediaFile
    
    query = db.query(MediaFile).join(User, MediaFile.user_id == User.id).filter(  # ✅ CHANGED
        MediaFile.deleted_at == None
    )
    
    if file_type and file_type != 'all':
        query = query.filter(MediaFile.file_type == file_type)
    
    if owner_id:
        query = query.filter(MediaFile.user_id == owner_id)  # ✅ CHANGED
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (MediaFile.filename.ilike(search_pattern)) |
            (User.company_name.ilike(search_pattern))
        )
    
    # Sorting
    if sort == "size":
        query = query.order_by(MediaFile.file_size_mb.desc())
    elif sort == "usage":
        query = query.order_by(MediaFile.listing_id.desc().nullslast())
    else:
        query = query.order_by(MediaFile.created_at.desc())
    
    total = query.count()
    media_files = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "media": [
            {
                "id": m.id,
                "filename": m.filename,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "file_type": m.file_type,
                "file_size_mb": round(m.file_size_mb, 2) if m.file_size_mb else 0,
                "owner_id": m.user_id,  # ✅ Keep API key name
                "owner_name": f"{m.user.first_name} {m.user.last_name}" if m.user else "Unknown",  # ✅ CHANGED
                "owner_company": m.user.company_name if m.user else "N/A",  # ✅ CHANGED
                "owner_type": m.user.user_type if m.user else "unknown",  # ✅ CHANGED
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "used_in_listings": 1 if m.listing_id else 0,
                "views": m.views or 0
            }
            for m in media_files
        ]
    }


# ============= SALES REPS MANAGEMENT =============

@router.get("/sales-reps")
def get_all_sales_reps(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all sales reps with their assigned dealers and revenue."""
    sales_reps = db.query(User).filter(
        User.user_type == "salesman"
    ).all()
    
    tier_prices = {
        "free": 0.0,
        "trial": 0.0,
        "basic": 29.0,
        "plus": 59.0,
        "premium": 99.0,
        "pro": 99.0,
        "private_basic": 9.0,
        "private_plus": 19.0,
        "private_pro": 39.0,
    }
    
    result = []
    for rep in sales_reps:
        affiliate_account = _ensure_sales_rep_affiliate_account(rep, db, current_user.id)

        # Get assigned dealers
        assigned_dealers = db.query(User).filter(
            User.assigned_sales_rep_id == rep.id
        ).all()

        referral_signups = db.query(ReferralSignup).filter(
            ReferralSignup.sales_rep_id == rep.id
        ).all()

        referral_dealer_ids = {r.dealer_user_id for r in referral_signups}
        referred_dealers = []
        if referral_dealer_ids:
            referred_dealers = db.query(User).filter(User.id.in_(list(referral_dealer_ids))).all()

        dealers_by_id = {d.id: d for d in assigned_dealers}
        for dealer in referred_dealers:
            dealers_by_id[dealer.id] = dealer

        all_dealers = list(dealers_by_id.values())
        
        assigned_count = len(all_dealers)
        
        # Calculate revenue from active dealers (prefer tracked effective price)
        referral_map = {r.dealer_user_id: r for r in referral_signups}
        active_dealers = [d for d in all_dealers if d.active]
        total_revenue = 0.0
        monthly_commission = 0.0
        for dealer in active_dealers:
            signup = referral_map.get(dealer.id)
            effective_price = float(signup.effective_monthly_price) if signup and signup.effective_monthly_price is not None else float(tier_prices.get(dealer.subscription_tier, 0.0))
            commission_rate = float(signup.commission_rate) if signup and signup.commission_rate is not None else float(rep.commission_rate or affiliate_account.commission_rate or 10.0)
            total_revenue += effective_price
            monthly_commission += effective_price * (commission_rate / 100.0)
        
        commission_rate = float(rep.commission_rate or affiliate_account.commission_rate or 10.0)
        
        result.append({
            "id": rep.id,
            "name": f"{rep.first_name} {rep.last_name}",  # Changed from separate fields
            "email": rep.email,
            "dealer_count": assigned_count,
            "active_dealers": len(active_dealers),
            "total_revenue": total_revenue,
            "monthly_commission": monthly_commission,
            "commission_rate": float(commission_rate),
            "referral_code": affiliate_account.code,
            "referral_link": f"/register?user_type=dealer&ref={affiliate_account.code}",
            "referred_signups": len(referral_signups),
        })
    
    return result


@router.post("/sales-reps")
def create_sales_rep(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new sales rep."""
    from app.security.auth import get_password_hash
    
    required = ["email", "password", "first_name", "last_name"]
    for field in required:
        if field not in data:
            raise ValidationException(f"Missing required field: {field}")
    
    # Check if email exists
    existing = db.query(User).filter(User.email == data["email"]).first()
    if existing:
        raise ValidationException("Email already registered")
    
    sales_rep = User(
        email=data["email"],
        password_hash=get_password_hash(data["password"]),
        first_name=data["first_name"],
        last_name=data["last_name"],
        phone=data.get("phone"),
        user_type="salesman",
        commission_rate=float(data.get("commission_rate", 10.0)),
        active=True
    )
    
    db.add(sales_rep)
    db.commit()
    db.refresh(sales_rep)

    affiliate_account = _ensure_sales_rep_affiliate_account(sales_rep, db, current_user.id)
    
    return {
        "success": True,
        "sales_rep_id": sales_rep.id,
        "email": sales_rep.email,
        "referral_code": affiliate_account.code,
        "referral_link": f"/register?user_type=dealer&ref={affiliate_account.code}",
    }


@router.post("/assign-sales-rep")
def assign_sales_rep(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    dealer_id = data.get("dealer_id")
    sales_rep_id = data.get("sales_rep_id")

    if not dealer_id or not sales_rep_id:
        raise ValidationException("dealer_id and sales_rep_id are required")

    dealer = db.query(User).filter(
        User.id == dealer_id,
        User.user_type == "dealer"
    ).first()
    if not dealer:
        raise ResourceNotFoundException("Dealer", dealer_id)

    sales_rep = db.query(User).filter(
        User.id == sales_rep_id,
        User.user_type == "salesman"
    ).first()
    if not sales_rep:
        raise ResourceNotFoundException("Sales rep", sales_rep_id)

    dealer.assigned_sales_rep_id = sales_rep.id
    db.commit()

    return {
        "success": True,
        "dealer_id": dealer.id,
        "sales_rep_id": sales_rep.id,
    }


@router.get("/affiliates")
def get_affiliates(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    accounts = db.query(AffiliateAccount).order_by(AffiliateAccount.created_at.desc()).all()
    return [
        {
            "id": account.id,
            "name": account.name,
            "email": account.email,
            "code": account.code,
            "account_type": account.account_type,
            "user_id": account.user_id,
            "commission_rate": float(account.commission_rate or 10.0),
            "active": bool(account.active),
            "created_at": account.created_at.isoformat() if account.created_at else None,
            "referral_link": f"/register?user_type=dealer&ref={account.code}",
        }
        for account in accounts
    ]


@router.post("/affiliates")
def create_affiliate(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    name = (data.get("name") or "").strip()
    if not name:
        raise ValidationException("Affiliate name is required")

    requested_code = (data.get("code") or "").strip().upper()
    code = requested_code or _generate_ref_code()
    while db.query(AffiliateAccount).filter(AffiliateAccount.code == code).first():
        code = _generate_ref_code()

    account = AffiliateAccount(
        name=name,
        email=data.get("email"),
        code=code,
        account_type=data.get("account_type", "affiliate"),
        commission_rate=float(data.get("commission_rate", 10.0)),
        active=bool(data.get("active", True)),
        created_by=current_user.id,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    return {
        "id": account.id,
        "code": account.code,
        "referral_link": f"/register?user_type=dealer&ref={account.code}",
        "message": "Affiliate account created",
    }


@router.put("/affiliates/{affiliate_id}")
def update_affiliate(
    affiliate_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    account = db.query(AffiliateAccount).filter(AffiliateAccount.id == affiliate_id).first()
    if not account:
        raise ResourceNotFoundException("Affiliate account", affiliate_id)

    if "name" in data:
        account.name = data["name"]
    if "email" in data:
        account.email = data["email"]
    if "commission_rate" in data:
        account.commission_rate = float(data["commission_rate"])
    if "active" in data:
        account.active = bool(data["active"])

    db.commit()
    db.refresh(account)

    return {
        "success": True,
        "id": account.id,
        "code": account.code,
        "referral_link": f"/register?user_type=dealer&ref={account.code}",
    }


@router.get("/deal-performance")
def get_deal_performance(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    deals = db.query(PartnerDeal).order_by(PartnerDeal.created_at.desc()).all()

    referrals = db.query(ReferralSignup).all()
    referrals_by_deal = {}
    for referral in referrals:
        if referral.deal_id is None:
            continue
        referrals_by_deal.setdefault(referral.deal_id, []).append(referral)

    rep_summary = {}
    affiliate_summary = {}
    deal_rows = []

    for deal in deals:
        linked_referrals = referrals_by_deal.get(deal.id, [])
        signup_count = len(linked_referrals)

        dealer_ids = [r.dealer_user_id for r in linked_referrals]
        dealers = []
        if dealer_ids:
            dealers = db.query(User).filter(User.id.in_(dealer_ids)).all()
        dealer_map = {dealer.id: dealer for dealer in dealers}

        active_paid_count = 0
        monthly_revenue = 0.0
        monthly_commission = 0.0

        for referral in linked_referrals:
            dealer = dealer_map.get(referral.dealer_user_id)
            if not dealer or not dealer.active:
                continue

            effective_price = float(referral.effective_monthly_price or 0.0)
            commission_rate = float(referral.commission_rate or 10.0)

            # Treat non-trial/non-free dealers with positive effective price as paid.
            if effective_price > 0 and dealer.subscription_tier not in ["free", "trial"]:
                active_paid_count += 1

            monthly_revenue += effective_price
            monthly_commission += effective_price * (commission_rate / 100.0)

            if referral.sales_rep_id:
                rep_row = rep_summary.setdefault(referral.sales_rep_id, {
                    "sales_rep_id": referral.sales_rep_id,
                    "sales_rep_name": None,
                    "signup_count": 0,
                    "active_paid_accounts": 0,
                    "monthly_revenue": 0.0,
                    "monthly_commission": 0.0,
                })
                rep_row["signup_count"] += 1
                if effective_price > 0 and dealer.subscription_tier not in ["free", "trial"]:
                    rep_row["active_paid_accounts"] += 1
                rep_row["monthly_revenue"] += effective_price
                rep_row["monthly_commission"] += effective_price * (commission_rate / 100.0)

            if referral.affiliate_account_id:
                affiliate_row = affiliate_summary.setdefault(referral.affiliate_account_id, {
                    "affiliate_account_id": referral.affiliate_account_id,
                    "affiliate_name": None,
                    "code": None,
                    "signup_count": 0,
                    "active_paid_accounts": 0,
                    "monthly_revenue": 0.0,
                    "monthly_commission": 0.0,
                })
                affiliate_row["signup_count"] += 1
                if effective_price > 0 and dealer.subscription_tier not in ["free", "trial"]:
                    affiliate_row["active_paid_accounts"] += 1
                affiliate_row["monthly_revenue"] += effective_price
                affiliate_row["monthly_commission"] += effective_price * (commission_rate / 100.0)

        owner_sales_rep_name = None
        if deal.owner_sales_rep_id:
            sales_rep = db.query(User).filter(User.id == deal.owner_sales_rep_id).first()
            if sales_rep:
                owner_sales_rep_name = f"{sales_rep.first_name or ''} {sales_rep.last_name or ''}".strip() or sales_rep.email

        affiliate_name = None
        affiliate_code = None
        if deal.affiliate_account_id:
            account = db.query(AffiliateAccount).filter(AffiliateAccount.id == deal.affiliate_account_id).first()
            if account:
                affiliate_name = account.name
                affiliate_code = account.code

        deal_rows.append({
            "deal_id": deal.id,
            "crm_sync_key": f"deal:{deal.id}",
            "name": deal.name,
            "code": deal.code,
            "target_email": deal.target_email,
            "owner_sales_rep_id": deal.owner_sales_rep_id,
            "owner_sales_rep_name": owner_sales_rep_name,
            "affiliate_account_id": deal.affiliate_account_id,
            "affiliate_name": affiliate_name,
            "affiliate_code": affiliate_code,
            "signup_count": signup_count,
            "active_paid_accounts": active_paid_count,
            "monthly_revenue": monthly_revenue,
            "monthly_commission": monthly_commission,
            "free_days": deal.free_days,
            "discount_type": deal.discount_type,
            "discount_value": deal.discount_value,
            "fixed_monthly_price": deal.fixed_monthly_price,
            "term_months": deal.term_months,
            "lifetime": bool(deal.lifetime),
            "active": bool(deal.active),
            "created_at": deal.created_at.isoformat() if deal.created_at else None,
        })

    # Resolve display names for summaries
    if rep_summary:
        rep_ids = list(rep_summary.keys())
        reps = db.query(User).filter(User.id.in_(rep_ids)).all()
        rep_map = {rep.id: rep for rep in reps}
        for rep_id, row in rep_summary.items():
            rep = rep_map.get(rep_id)
            if rep:
                row["sales_rep_name"] = f"{rep.first_name or ''} {rep.last_name or ''}".strip() or rep.email

    if affiliate_summary:
        affiliate_ids = list(affiliate_summary.keys())
        accounts = db.query(AffiliateAccount).filter(AffiliateAccount.id.in_(affiliate_ids)).all()
        account_map = {account.id: account for account in accounts}
        for account_id, row in affiliate_summary.items():
            account = account_map.get(account_id)
            if account:
                row["affiliate_name"] = account.name
                row["code"] = account.code

    return {
        "deals": deal_rows,
        "summary_by_sales_rep": list(rep_summary.values()),
        "summary_by_affiliate": list(affiliate_summary.values()),
        "generated_at": datetime.utcnow().isoformat(),
    }


# ============= SETTINGS MANAGEMENT =============

_DEFAULT_BROKER_TIERS = {
    "basic": {"name": "Basic", "price": 29, "listings": 25, "images_per_listing": 15, "videos_per_listing": 1, "features": ["25 active listings", "15 images per listing", "1 video per listing", "Enhanced search visibility", "Priority email support", "Analytics dashboard"], "trial_days": 14, "active": True},
    "plus":  {"name": "Plus",  "price": 59, "listings": 75, "images_per_listing": 30, "videos_per_listing": 3, "features": ["75 active listings", "30 images per listing", "3 videos per listing", "Priority search placement", "Featured broker badge", "Priority support", "Advanced analytics"], "trial_days": 14, "active": True},
    "pro":   {"name": "Pro",   "price": 99, "listings": 999999, "images_per_listing": 50, "videos_per_listing": 5, "features": ["Unlimited listings", "50 images per listing", "5 videos per listing", "Top search placement", "Featured broker badge", "Dedicated account manager", "Advanced analytics", "AI scraper tools"], "trial_days": 30, "active": True},
    "ultimate": {"name": "Ultimate", "price": 0, "listings": 999999, "images_per_listing": 999999, "videos_per_listing": 999999, "features": ["Unlimited listings", "Unlimited images & video", "White-glove onboarding", "Dedicated account manager", "Custom API integrations", "Branded micro-site", "Premium search placement", "Co-brokering network access"], "trial_days": 0, "active": True, "is_custom_pricing": True},
}

_DEFAULT_PRIVATE_TIERS = {
    "private_basic": {"name": "Basic", "price": 9, "listings": 1, "images_per_listing": 20, "videos_per_listing": 1, "features": ["1 active listing", "20 photos per listing", "1 video per listing", "Standard search visibility", "Direct buyer messaging", "Email support"], "trial_days": 7, "active": True},
    "private_plus": {"name": "Plus", "price": 19, "listings": 3, "images_per_listing": 35, "videos_per_listing": 1, "features": ["3 active listings", "35 photos per listing", "1 video per listing", "Priority search placement", "Direct buyer messaging", "Listing analytics", "Email support"], "trial_days": 7, "active": True},
    "private_pro": {"name": "Pro", "price": 39, "listings": 10, "images_per_listing": 50, "videos_per_listing": 3, "features": ["10 active listings", "50 photos per listing", "3 videos per listing", "Top search placement", "Featured badge", "Priority support", "Social media promotion"], "trial_days": 14, "active": True},
}


def _get_or_create_settings(db: Session) -> SiteSettings:
    settings = db.query(SiteSettings).first()
    if not settings:
        settings = SiteSettings(subscription_config={})
        db.add(settings)
        db.commit()
    return settings

@router.get("/settings")
def get_settings(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get platform settings."""
    # For now, return default settings
    # You can create a Settings model later if needed
    return {
        "site_name": "YachtVersal",
        "support_email": "support@yachtversal.com",
        "featured_listing_enabled": True,
        "require_approval": False,
        "max_images_per_listing": 20,
        "default_currency": "USD",
        "allowed_currencies": ["USD", "EUR", "GBP", "CAD", "AUD"],
        "maintenance_mode": False
    }


@router.put("/settings")
def update_settings(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update platform settings."""
    # Store settings in database or config file
    # For now, just return success
    return {"success": True, "message": "Settings updated"}


@router.get("/subscription-config")
def get_subscription_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get broker subscription tier configuration."""
    settings = _get_or_create_settings(db)
    config = settings.subscription_config or {}
    tiers = config.get("broker_tiers", _DEFAULT_BROKER_TIERS)
    return {"tiers": tiers}


@router.put("/subscription-config")
def update_subscription_config(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update broker subscription configuration."""
    settings = _get_or_create_settings(db)
    config = dict(settings.subscription_config or {})
    config["broker_tiers"] = data.get("tiers", data)
    settings.subscription_config = config
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(settings, "subscription_config")
    db.commit()
    return {"success": True, "message": "Broker subscription config updated"}


@router.get("/subscription-config/private")
def get_private_subscription_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get private seller subscription tier configuration."""
    settings = _get_or_create_settings(db)
    config = settings.subscription_config or {}
    tiers = config.get("private_tiers", _DEFAULT_PRIVATE_TIERS)
    return {"tiers": tiers}


@router.put("/subscription-config/private")
def update_private_subscription_config(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update private seller subscription configuration."""
    settings = _get_or_create_settings(db)
    config = dict(settings.subscription_config or {})
    config["private_tiers"] = data.get("tiers", data)
    settings.subscription_config = config
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(settings, "subscription_config")
    db.commit()
    return {"success": True, "message": "Private subscription config updated"}


# ============= DASHBOARD STATS =============

@router.get("/stats")
def get_admin_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get admin dashboard statistics."""
    
    # User stats
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.active == True).count()
    total_dealers = db.query(User).filter(User.user_type == "dealer").count()
    active_dealers = db.query(User).filter(
        User.user_type == "dealer",
        User.active == True
    ).count()
    
    # Listing stats
    total_listings = db.query(Listing).count()
    active_listings = db.query(Listing).filter(Listing.status == "active").count()
    pending_listings = db.query(Listing).filter(Listing.status == "pending").count()
    
    # Revenue calculation (simple)
    tier_prices = {"free": 0, "basic": 29, "premium": 99, "trial": 0}
    monthly_revenue = sum(
        tier_prices.get(u.subscription_tier, 0)
        for u in db.query(User).filter(User.active == True).all()
    )
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "dealers": total_dealers,
            "active_dealers": active_dealers
        },
        "listings": {
            "total": total_listings,
            "active": active_listings,
            "pending": pending_listings
        },
        "revenue": {
            "monthly": monthly_revenue,
            "annual": monthly_revenue * 12
        }
    }


# ============= SYSTEM / DIAGNOSTICS =============

_app_start_time = time.time()


@router.get("/logs")
def get_logs(
    level: str = Query(default="ALL", description="Filter by level: ALL DEBUG INFO WARNING ERROR CRITICAL"),
    search: str = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    current_user: User = Depends(require_admin),
):
    """Return recent in-memory log records."""
    records = memory_log_handler.get_records(level=level, search=search, limit=limit)
    return {
        "count": len(records),
        "total_in_buffer": memory_log_handler.entry_count,
        "records": records,
    }


@router.post("/logs/clear")
def clear_logs(current_user: User = Depends(require_admin)):
    """Clear the in-memory log buffer."""
    before = memory_log_handler.entry_count
    memory_log_handler.clear()
    return {"cleared": before, "message": "Log buffer cleared"}


@router.post("/logs/test")
def test_logging(current_user: User = Depends(require_admin)):
    """Write one test entry at every log level — useful to verify logging is wired up."""
    logger = logging.getLogger("yachtversal")
    logger.debug("[ADMIN TEST] Debug-level test entry")
    logger.info("[ADMIN TEST] Info-level test entry")
    logger.warning("[ADMIN TEST] Warning-level test entry")
    logger.error("[ADMIN TEST] Error-level test entry")
    return {"message": "Test log entries written at DEBUG / INFO / WARNING / ERROR"}


@router.get("/system/health")
def system_health(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Run a suite of health checks and return status for each subsystem."""
    results = {}

    # Database connectivity
    try:
        db.execute(text("SELECT 1"))
        results["database"] = {"status": "ok", "message": "Connection successful"}
    except Exception as exc:
        results["database"] = {"status": "error", "message": str(exc)}

    # Database table row counts
    try:
        table_counts = {
            "users": db.query(User).count(),
            "listings": db.query(Listing).count(),
            "media_files": db.query(MediaFile).count(),
        }
        results["table_counts"] = {"status": "ok", "counts": table_counts}
    except Exception as exc:
        results["table_counts"] = {"status": "error", "message": str(exc)}

    # Storage health (re-uses existing helper)
    try:
        storage = get_storage_health()
        results["storage"] = storage
    except Exception as exc:
        results["storage"] = {"status": "error", "message": str(exc)}

    # Environment variable presence check
    env_vars = [
        "DATABASE_URL",
        "SECRET_KEY",
        "SENDGRID_API_KEY",
        "CLAUDE_API_KEY",
        "S3_BUCKET",
        "S3_ENDPOINT_URL",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "MEDIA_STORAGE_BACKEND",
        "FRONTEND_URL",
        "STRIPE_SECRET_KEY",
        "STRIPE_PUBLISHABLE_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_BASIC",
        "STRIPE_PRICE_PREMIUM",
        "GOOGLE_MAPS_API_KEY",
        "HCAPTCHA_SECRET",
        "HCAPTCHA_SITEKEY",
        "AUTO_CREATE_TABLES",
    ]
    env_status = {
        v: ("set" if os.environ.get(v) else "missing") for v in env_vars
    }
    results["env_vars"] = env_status

    # Scheduler — check if APScheduler is running
    try:
        from app.scheduler import scheduler as apscheduler
        if apscheduler is not None:
            results["scheduler"] = {
                "status": "ok" if apscheduler.running else "stopped",
                "jobs": len(apscheduler.get_jobs()),
            }
        else:
            results["scheduler"] = {"status": "stopped", "jobs": 0}
    except Exception as exc:
        results["scheduler"] = {"status": "error", "message": str(exc)}

    # Email service
    sendgrid_key = os.environ.get("SENDGRID_API_KEY", "")
    results["email"] = {
        "status": "ok" if sendgrid_key else "missing_key",
        "provider": "SendGrid",
    }

    results["generated_at"] = datetime.utcnow().isoformat()
    return results


@router.get("/system/info")
def system_info(current_user: User = Depends(require_admin)):
    """Return runtime environment information."""
    uptime_seconds = int(time.time() - _app_start_time)
    hours, remainder = divmod(uptime_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_str = f"{hours}h {minutes}m {seconds}s"

    log_file_info = {"path": "logs/yachtversal.log", "size_bytes": None, "exists": False}
    try:
        import pathlib
        lf = pathlib.Path("logs/yachtversal.log")
        if lf.exists():
            log_file_info["exists"] = True
            log_file_info["size_bytes"] = lf.stat().st_size
    except Exception:
        pass

    return {
        "python_version": sys.version,
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "uptime_seconds": uptime_seconds,
        "uptime_human": uptime_str,
        "log_buffer_entries": memory_log_handler.entry_count,
        "log_file": log_file_info,
        "pid": os.getpid(),
    }

# ============= ACCOUNT RECOVERY & SOFT DELETE =============

@router.get("/users/recovery/pending")
def get_deleted_users_pending_recovery(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Get all users pending recovery (soft-deleted within recovery period).
    """
    now = datetime.utcnow()
    
    # Find deleted users within recovery deadline
    deleted_users = db.query(User).filter(
        User.deleted_at.isnot(None),
        User.recovery_deadline > now  # Not yet expired
    ).order_by(User.deleted_at.desc()).all()
    
    result = []
    for user in deleted_users:
        days_remaining = (user.recovery_deadline - now).days
        
        # Get listing count
        listing_count = db.query(Listing).filter(Listing.user_id == user.id).count()
        
        result.append({
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "company_name": user.company_name,
            "user_type": user.user_type,
            "deleted_at": user.deleted_at.isoformat(),
            "recovery_deadline": user.recovery_deadline.isoformat(),
            "days_remaining": days_remaining,
            "listings": listing_count,
        })
    
    return {
        "total": len(result),
        "users": result
    }


@router.post("/users/{user_id}/recover")
def admin_recover_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint to restore a deleted user account.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    if not user.deleted_at:
        raise ValidationException("User account is not deleted")
    
    now = datetime.utcnow()
    if user.recovery_deadline and now > user.recovery_deadline:
        raise ValidationException("Recovery period has expired. This account cannot be restored.")
    
    # Restore the account
    user.deleted_at = None
    user.recovery_deadline = None
    db.commit()
    
    return {
        "success": True,
        "message": f"User {user.email} has been restored",
        "user_id": user.id,
        "email": user.email
    }


@router.post("/users/{user_id}/permanent-delete")
def admin_permanently_delete_user(
    user_id: int,
    data: dict = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint to permanently delete a user after recovery period expires.
    This will hard-delete the user and all associated data.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    if not user.deleted_at:
        raise ValidationException("User is not deleted")
    
    # Check if recovery period has expired
    now = datetime.utcnow()
    if user.recovery_deadline and now <= user.recovery_deadline:
        days_remaining = (user.recovery_deadline - now).days
        raise ValidationException(
            f"Cannot permanently delete: recovery period expires in {days_remaining} days. "
            "Pass force=true in request body to override."
        )
    
    # Optional force parameter for immediate deletion
    force = (data or {}).get("force", False) if data else False
    if not force and user.recovery_deadline and now <= user.recovery_deadline:
        raise ValidationException("Recovery period not expired. Pass force=true to override safety check.")
    
    # Delete all user data
    email = user.email
    
    # Delete listings
    db.query(Listing).filter(Listing.user_id == user_id).delete()
    
    # Delete user record
    db.delete(user)
    db.commit()
    
    return {
        "success": True,
        "message": f"User {email} permanently deleted with all associated data",
    }


@router.get("/users/{user_id}/deletion-status")
def get_user_deletion_status_admin(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint to check deletion status of any user.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    if not user.deleted_at:
        return {
            "user_id": user.id,
            "email": user.email,
            "status": "active",
            "message": "Account is active"
        }
    
    now = datetime.utcnow()
    is_expired = user.recovery_deadline and now > user.recovery_deadline
    days_remaining = (user.recovery_deadline - now).days if user.recovery_deadline and not is_expired else 0
    
    return {
        "user_id": user.id,
        "email": user.email,
        "status": "deleted_expired" if is_expired else "deleted_recoverable",
        "deleted_at": user.deleted_at.isoformat(),
        "recovery_deadline": user.recovery_deadline.isoformat() if user.recovery_deadline else None,
        "days_remaining": max(days_remaining, 0),
        "can_restore": not is_expired,
        "can_permanently_delete": is_expired
    }


# ============= DOCUMENTATION MANAGEMENT =============

@router.post("/docs/init-defaults")
def initialize_default_docs(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Initialize default documentation (demo guide, sales guide).
    Safe to call multiple times - will skip existing docs.
    """
    from app.services.default_documentation import DEFAULT_DOCS
    
    created = []
    skipped = []
    
    for doc_data in DEFAULT_DOCS:
        existing = db.query(Documentation).filter(
            Documentation.slug == doc_data["slug"]
        ).first()
        
        if existing:
            skipped.append(doc_data["slug"])
            continue
        
        doc = Documentation(
            slug=doc_data["slug"],
            title=doc_data["title"],
            description=doc_data["description"],
            category=doc_data["category"],
            audience=doc_data["audience"],
            order=doc_data["order"],
            content=doc_data["content"],
            published=True,
            updated_by_user_id=current_user.id,
        )
        db.add(doc)
        created.append(doc_data["slug"])
    
    db.commit()
    
    return {
        "success": True,
        "created": created,
        "skipped": skipped,
        "message": f"Initialized {len(created)} default documentation(s)"
    }


@router.post("/docs")
def create_documentation(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new documentation page."""
    slug = (data.get("slug") or "").strip().lower().replace(" ", "-")
    if not slug:
        raise ValidationException("slug is required")
    
    # Check for duplicate slug
    existing = db.query(Documentation).filter(Documentation.slug == slug).first()
    if existing:
        raise ValidationException("Documentation with this slug already exists")
    
    doc = Documentation(
        slug=slug,
        title=data.get("title", "Untitled").strip(),
        description=data.get("description", "").strip(),
        category=data.get("category", "general"),
        audience=data.get("audience", "all"),
        order=int(data.get("order", 0)),
        content=data.get("content", ""),
        published=bool(data.get("published", True)),
        updated_by_user_id=current_user.id,
    )
    
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    return {
        "success": True,
        "id": doc.id,
        "slug": doc.slug,
        "title": doc.title,
        "message": "Documentation created"
    }


@router.get("/docs")
def list_documentation(
    category: Optional[str] = None,
    audience: Optional[str] = None,
    published_only: bool = True,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all documentation pages (admin view)."""
    query = db.query(Documentation)
    
    if published_only:
        query = query.filter(Documentation.published == True)
    
    if category:
        query = query.filter(Documentation.category == category)
    
    if audience:
        query = query.filter(Documentation.audience == audience)
    
    docs = query.order_by(Documentation.category, Documentation.order).all()
    
    return {
        "total": len(docs),
        "docs": [
            {
                "id": doc.id,
                "slug": doc.slug,
                "title": doc.title,
                "description": doc.description,
                "category": doc.category,
                "audience": doc.audience,
                "order": doc.order,
                "published": doc.published,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            }
            for doc in docs
        ]
    }


@router.get("/docs/{slug}")
def get_documentation_admin(
    slug: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get a specific documentation page (admin view with full content)."""
    doc = db.query(Documentation).filter(Documentation.slug == slug).first()
    
    if not doc:
        raise ResourceNotFoundException("Documentation", slug)
    
    return {
        "id": doc.id,
        "slug": doc.slug,
        "title": doc.title,
        "description": doc.description,
        "category": doc.category,
        "audience": doc.audience,
        "order": doc.order,
        "content": doc.content,
        "published": doc.published,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        "updated_by_user_id": doc.updated_by_user_id,
    }


@router.put("/docs/{slug}")
def update_documentation(
    slug: str,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update a documentation page."""
    doc = db.query(Documentation).filter(Documentation.slug == slug).first()
    
    if not doc:
        raise ResourceNotFoundException("Documentation", slug)
    
    # Update fields
    if "title" in data:
        doc.title = data["title"].strip()
    if "description" in data:
        doc.description = data["description"].strip()
    if "content" in data:
        doc.content = data["content"]
    if "category" in data:
        doc.category = data["category"]
    if "audience" in data:
        doc.audience = data["audience"]
    if "order" in data:
        doc.order = int(data["order"])
    if "published" in data:
        doc.published = bool(data["published"])
    
    doc.updated_by_user_id = current_user.id
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    
    return {
        "success": True,
        "slug": doc.slug,
        "title": doc.title,
        "message": "Documentation updated"
    }


@router.delete("/docs/{slug}")
def delete_documentation(
    slug: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a documentation page."""
    doc = db.query(Documentation).filter(Documentation.slug == slug).first()
    
    if not doc:
        raise ResourceNotFoundException("Documentation", slug)
    
    db.delete(doc)
    db.commit()
    
    return {
        "success": True,
        "message": "Documentation deleted"
    }


# ============= Demo Account Management =============

@router.post("/demo-account/create")
def create_demo_account(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a demo account for a sales rep or admin.
    - Auto-populate with 8 sample yacht listings
    - Generate unique credentials
    """
    try:
        sales_rep_id = data.get("sales_rep_id")
        
        # Determine if this is for a sales rep or admin
        if sales_rep_id:
            owner_id = sales_rep_id
            
            # Verify sales rep exists
            owner = db.query(User).filter(
                User.id == owner_id,
                User.user_type == "salesman",
                User.deleted_at.is_(None)
            ).first()
            
            if not owner:
                raise ResourceNotFoundException("Sales representative", owner_id)
        else:
            # Creating demo for the admin themselves
            owner_id = current_user.id
            owner = current_user
        
        # Check if demo already exists for this owner
        existing_demo = db.query(User).filter(
            User.demo_owner_sales_rep_id == owner_id,
            User.is_demo == True,
            User.deleted_at.is_(None)
        ).first()
        
        if existing_demo:
            raise ValidationException(f"This user already has a demo account (ID: {existing_demo.id})")
        
        # Generate credentials
        demo_email = f"demo-{owner_id}-{secrets.token_hex(4)}@yachtversal.demo"
        temp_password = secrets.token_urlsafe(16)
        hashed_password = get_password_hash(temp_password)
        
        # Create demo user account
        demo_user = User(
            email=demo_email,
            password_hash=hashed_password,
            first_name="Demo",
            last_name=f"- {owner.first_name or 'Account'}",
            user_type="dealer",
            company_name=f"[DEMO] {owner.first_name or 'Demo'}'s Demo Dealership",
            subscription_tier="premium",
            is_demo=True,
            demo_owner_sales_rep_id=owner_id,
            active=True,
            verified=True,
            email_verified=True,
        )
        db.add(demo_user)
        db.flush()
        
        # Create dealer profile
        profile = DealerProfile(
            user_id=demo_user.id,
            name=demo_user.company_name,
            company_name=demo_user.company_name,
            slug=f"demo-{owner_id}-{secrets.token_hex(3)}",
            email=demo_email,
        )
        db.add(profile)
        db.flush()
        
        # Create sample listings
        demo_listings = get_demo_listing_data()
        listings_created = 0
        now = datetime.utcnow()
        
        for idx, listing_data in enumerate(demo_listings):
            try:
                bin_id = f"DEMO{uuid.uuid4().hex[:12].upper()}"
                location = listing_data.get("location", "Miami, Florida")
                location_parts = location.split(",")
                city = location_parts[0].strip() if location_parts else "Miami"
                state = location_parts[1].strip() if len(location_parts) > 1 else "FL"
                
                is_featured = listing_data.get("featured", False)
                listing_status = listing_data.get("status", "active")
                is_recently_deleted = listing_data.get("recently_deleted", False)

                listing = Listing(
                    user_id=demo_user.id,
                    created_by_user_id=current_user.id,
                    title=listing_data.get("title", "Sample Yacht"),
                    description=listing_data.get("description", ""),
                    make=listing_data.get("make", ""),
                    model=listing_data.get("model", ""),
                    year=listing_data.get("year", 2023),
                    price=listing_data.get("price", 1000000),
                    currency="USD",
                    bin=bin_id,
                    length_feet=listing_data.get("length_feet", 50),
                    beam_feet=listing_data.get("beam_feet", 15),
                    draft_feet=listing_data.get("draft_feet", 4),
                    boat_type=listing_data.get("boat_type", "motor_yacht"),
                    cabins=listing_data.get("num_cabins", 3),
                    heads=listing_data.get("num_heads", 2),
                    fuel_capacity_gallons=listing_data.get("fuel_capacity_gallons", 2000),
                    water_capacity_gallons=listing_data.get("water_capacity_gallons", 1000),
                    city=city,
                    state=state,
                    country="USA",
                    fuel_type=listing_data.get("fuel_type", "diesel"),
                    condition=listing_data.get("condition", "Excellent"),
                    feature_bullets=listing_data.get("features", []),
                    status=listing_status,
                    featured=is_featured,
                    featured_until=now + timedelta(days=90) if is_featured else None,
                    views=listing_data.get("views", 0),
                    inquiries=listing_data.get("inquiries", 0),
                    # Soft-delete listings flagged recently_deleted so the
                    # Recently Deleted tab is populated on a fresh demo.
                    # Use staggered ages so countdown numbers vary.
                    deleted_at=now - timedelta(days=3 + idx * 2) if is_recently_deleted else None,
                )
                db.add(listing)
                listings_created += 1
            except Exception as e:
                # Log but continue creating other listings
                print(f"Error creating listing: {str(e)}")
                continue
        
        db.commit()
        db.refresh(demo_user)
        
        return {
            "success": True,
            "demo_account": {
                "id": demo_user.id,
                "email": demo_email,
                "password": temp_password,
                "first_name": demo_user.first_name,
                "last_name": demo_user.last_name,
                "company_name": demo_user.company_name,
                "is_demo": demo_user.is_demo,
            },
            "owner_id": owner_id,
            "owner_type": "sales_rep" if sales_rep_id else "admin",
            "listings_created": listings_created,
            "message": f"Demo account created with {listings_created} sample listings.",
            "note": "This is a test account. Save the password securely as it is provided here.",
        }
    except Exception as e:
        db.rollback()
        raise ValidationException(f"Failed to create demo account: {str(e)}")


@router.get("/demo-accounts")
def list_all_demo_accounts(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get all demo accounts with their details."""
    demo_accounts = db.query(User).filter(
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).all()
    
    result = []
    for demo in demo_accounts:
        listing_count = db.query(func.count(Listing.id)).filter(
            Listing.user_id == demo.id
        ).scalar() or 0
        
        sales_rep = None
        if demo.demo_owner_sales_rep_id:
            sr = db.query(User).filter(User.id == demo.demo_owner_sales_rep_id).first()
            if sr:
                sales_rep = f"{sr.first_name} {sr.last_name}".strip()
        
        result.append({
            "id": demo.id,
            "email": demo.email,
            "company_name": demo.company_name,
            "sales_rep_id": demo.demo_owner_sales_rep_id,
            "sales_rep_name": sales_rep,
            "listings": listing_count,
            "created_at": demo.created_at.isoformat() if demo.created_at else None,
        })
    
    return {
        "total": len(result),
        "demo_accounts": result,
    }


@router.get("/demo-account/{user_id}")
def get_demo_account_for_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get demo account info for a specific user (admin or sales rep)."""
    demo = db.query(User).filter(
        User.demo_owner_sales_rep_id == user_id,
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).first()
    
    if not demo:
        raise ResourceNotFoundException("Demo account for user", user_id)
    
    listing_count = db.query(func.count(Listing.id)).filter(
        Listing.user_id == demo.id
    ).scalar() or 0
    
    return {
        "id": demo.id,
        "email": demo.email,
        "company_name": demo.company_name,
        "owner_id": user_id,
        "listings": listing_count,
        "created_at": demo.created_at.isoformat() if demo.created_at else None,
    }


@router.post("/demo-account/{demo_account_id}/reset")
def reset_demo_account(
    demo_account_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reset a demo account to pristine state.
    - Clear all messages and conversations
    - Restore original sample listings
    """
    try:
        demo_user = db.query(User).filter(
            User.id == demo_account_id,
            User.is_demo == True,
            User.deleted_at.is_(None)
        ).first()
        
        if not demo_user:
            raise ResourceNotFoundException("Demo account", demo_account_id)
        
        # Delete all existing listings
        db.query(Listing).filter(Listing.user_id == demo_account_id).delete()
        
        # Recreate sample listings
        demo_listing_data = get_demo_listing_data()
        listings_restored = 0
        
        now = datetime.utcnow()
        for idx, listing_data in enumerate(demo_listing_data):
            try:
                bin_id = f"DEMO{uuid.uuid4().hex[:12].upper()}"
                location = listing_data.get("location", "Miami, Florida")
                location_parts = location.split(",")
                city = location_parts[0].strip() if location_parts else "Miami"
                state = location_parts[1].strip() if len(location_parts) > 1 else "FL"

                is_featured = listing_data.get("featured", False)
                listing_status = listing_data.get("status", "active")
                is_recently_deleted = listing_data.get("recently_deleted", False)

                listing = Listing(
                    user_id=demo_user.id,
                    created_by_user_id=current_user.id,
                    title=listing_data.get("title", "Sample Yacht"),
                    description=listing_data.get("description", ""),
                    make=listing_data.get("make", ""),
                    model=listing_data.get("model", ""),
                    year=listing_data.get("year", 2023),
                    price=listing_data.get("price", 1000000),
                    currency="USD",
                    bin=bin_id,
                    length_feet=listing_data.get("length_feet", 50),
                    beam_feet=listing_data.get("beam_feet", 15),
                    draft_feet=listing_data.get("draft_feet", 4),
                    boat_type=listing_data.get("boat_type", "motor_yacht"),
                    cabins=listing_data.get("num_cabins", 3),
                    heads=listing_data.get("num_heads", 2),
                    fuel_capacity_gallons=listing_data.get("fuel_capacity_gallons", 2000),
                    water_capacity_gallons=listing_data.get("water_capacity_gallons", 1000),
                    city=city,
                    state=state,
                    country="USA",
                    fuel_type=listing_data.get("fuel_type", "diesel"),
                    condition=listing_data.get("condition", "Excellent"),
                    feature_bullets=listing_data.get("features", []),
                    status=listing_status,
                    featured=is_featured,
                    featured_until=now + timedelta(days=90) if is_featured else None,
                    views=listing_data.get("views", 0),
                    inquiries=listing_data.get("inquiries", 0),
                    deleted_at=now - timedelta(days=3 + idx * 2) if is_recently_deleted else None,
                )
                db.add(listing)
                listings_restored += 1
            except Exception as e:
                print(f"Error creating listing during reset: {str(e)}")
                continue
        
        db.commit()
        
        return {
            "success": True,
            "demo_account_id": demo_account_id,
            "email": demo_user.email,
            "listings_restored": listings_restored,
            "message": "Demo account reset to pristine state",
        }
    except Exception as e:
        db.rollback()
        raise ValidationException(f"Failed to reset demo account: {str(e)}")


@router.delete("/demo-account/{demo_account_id}")
def delete_demo_account(
    demo_account_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a demo account and all associated data."""
    demo_user = db.query(User).filter(
        User.id == demo_account_id,
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).first()
    
    if not demo_user:
        raise ResourceNotFoundException("Demo account", demo_account_id)
    
    # Soft delete the account
    demo_user.deleted_at = datetime.utcnow()
    
    # Delete all listings associated with the demo account
    db.query(Listing).filter(Listing.user_id == demo_account_id).delete()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Demo account deleted",
        "demo_account_id": demo_account_id,
    }


# ============= DEAL MANAGEMENT =============

@router.get("/deals")
def get_all_deals_admin(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all partner/sales deals."""
    deals = db.query(PartnerDeal).order_by(PartnerDeal.created_at.desc()).all()
    
    # Get usage counts
    usage_counts = {}
    usage_results = db.query(
        ReferralSignup.deal_id,
        func.count(ReferralSignup.id)
    ).group_by(ReferralSignup.deal_id).all()
    
    for deal_id, count in usage_results:
        if deal_id:
            usage_counts[deal_id] = count

    return [
        {
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
            "owner_sales_rep_id": deal.owner_sales_rep_id,
            "affiliate_account_id": deal.affiliate_account_id,
            "start_date": deal.start_date.isoformat() if deal.start_date else None,
            "end_date": deal.end_date.isoformat() if deal.end_date else None,
            "created_at": deal.created_at.isoformat() if deal.created_at else None,
            "notes": deal.notes,
            "usage_count": usage_counts.get(deal.id, 0)
        }
        for deal in deals
    ]


@router.post("/deals")
def create_deal_admin(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new promotional deal."""
    
    name = (data.get("name") or "").strip()
    if not name:
        raise ValidationException("Deal name is required")
        
    # Validation for owner (sales rep or affiliate)
    owner_sales_rep_id = data.get("owner_sales_rep_id")
    affiliate_account_id = data.get("affiliate_account_id")
    
    if owner_sales_rep_id and affiliate_account_id:
        raise ValidationException("Cannot assign both sales rep and affiliate account")
    
    if owner_sales_rep_id:
        # Check sales rep exists
        rep = db.query(User).filter(User.id == owner_sales_rep_id, User.user_type == "salesman").first()
        if not rep:
            raise ValidationException(f"Sales rep {owner_sales_rep_id} not found")
            
    if affiliate_account_id:
        # Check affiliate exists
        aff = db.query(AffiliateAccount).filter(AffiliateAccount.id == affiliate_account_id).first()
        if not aff:
            raise ValidationException(f"Affiliate account {affiliate_account_id} not found")

    # Generate unique code if not provided
    created_code = (data.get("code") or "").strip().upper()
    if not created_code:
        created_code = f"DEAL{secrets.token_hex(3).upper()}"
    else:
        # Ensure code uniqueness
        existing = db.query(PartnerDeal).filter(PartnerDeal.code == created_code).first()
        if existing:
             # Retry generation once if auto-generated, else fail
             if not data.get("code"):
                 created_code = f"DEAL{secrets.token_hex(3).upper()}"
             else:
                 raise ValidationException(f"Deal code '{created_code}' already exists")
    
    end_date = None
    if data.get("end_date"):
        try:
            end_date = datetime.fromisoformat(data["end_date"].replace('Z', '+00:00'))
        except ValueError:
            pass

    deal = PartnerDeal(
        name=name,
        code=created_code,
        created_by=current_user.id,
        owner_sales_rep_id=owner_sales_rep_id,
        affiliate_account_id=affiliate_account_id,
        target_email=(data.get("target_email") or None),
        free_days=int(data.get("free_days") or 0),
        discount_type=(data.get("discount_type") or None),
        discount_value=float(data["discount_value"]) if data.get("discount_value") not in [None, ""] else None,
        fixed_monthly_price=float(data["fixed_monthly_price"]) if data.get("fixed_monthly_price") not in [None, ""] else None,
        term_months=int(data["term_months"]) if data.get("term_months") not in [None, ""] else None,
        lifetime=bool(data.get("lifetime", False)),
        notes=data.get("notes"),
        active=bool(data.get("active", True)),
        end_date=end_date
    )
    
    db.add(deal)
    db.commit()
    db.refresh(deal)
    
    return {
        "success": True,
        "id": deal.id,
        "code": deal.code,
        "message": "Deal created successfully"
    }


@router.put("/deals/{deal_id}")
def update_deal_admin(
    deal_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update an existing deal."""
    deal = db.query(PartnerDeal).filter(PartnerDeal.id == deal_id).first()
    if not deal:
        raise ResourceNotFoundException("Deal", deal_id)
        
    # Valid fields to update
    fields = [
        "name", "target_email", "free_days", "discount_type", "discount_value",
        "fixed_monthly_price", "term_months", "lifetime", "notes", "active",
        "owner_sales_rep_id", "affiliate_account_id"
    ]
    
    for field in fields:
        if field in data:
            val = data[field]
            # Type conversion where needed
            if field in ["free_days", "term_months"] and val is not None:
                try:
                    val = int(val)
                except (ValueError, TypeError):
                    pass
            elif field in ["discount_value", "fixed_monthly_price"] and val is not None:
                try:
                    val = float(val)
                except (ValueError, TypeError):
                    pass
            setattr(deal, field, val)
            
    if "end_date" in data:
        if data["end_date"]:
            try:
                deal.end_date = datetime.fromisoformat(data["end_date"].replace('Z', '+00:00'))
            except ValueError:
                pass
        else:
            deal.end_date = None

    db.commit()
    db.refresh(deal)
    
    return {"success": True, "deal_id": deal.id, "message": "Deal updated"}


@router.post("/register-broker")
def register_broker_admin(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Manually register a broker/dealer account (Admin).
    Optional: Assign to sales rep or set custom pricing.
    """
    from app.utils.slug import create_slug
    from app.services.api_key_service import generate_api_key_for_dealer
    from app.security.auth import get_password_hash
    from app.security.auth import pwd_context
    from app.services.email_service import email_service
    # 1. Basic validation
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise ValidationException("Email is required")

    # Check existence
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValidationException("A user with this email already exists")

    # 2. Extract fields
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    company_name = (data.get("company_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    tier = (data.get("subscription_tier") or "basic").strip().lower()
    sales_rep_id = data.get("sales_rep_id")
    
    # Custom pricing (Admin Power)
    # Allows setting a custom fixed price for ANY tier, but primarily for "Ultimate" or special deals
    custom_price = None
    if data.get("custom_price") is not None:
        try:
            val = float(data["custom_price"])
            if val >= 0:
                custom_price = val
        except (ValueError, TypeError):
            pass

    # 3. Create User — password set by broker via emailed setup link
    _placeholder = secrets.token_urlsafe(64)
    hashed_pw = pwd_context.hash(_placeholder)
    set_pw_token = secrets.token_urlsafe(32)
    
    # Only assign sales rep if valid ID provided
    assigned_rep_id = None
    commission_pct = 10.0 # Default
    aff_account = None
    
    if sales_rep_id:
        rep = db.query(User).filter(User.id == sales_rep_id, User.user_type == "salesman").first()
        if rep:
            assigned_rep_id = rep.id
            commission_pct = float(rep.commission_rate or 10.0)
            
            # Find rep's affiliate code
            aff_account = db.query(AffiliateAccount).filter(
                AffiliateAccount.user_id == assigned_rep_id,
                AffiliateAccount.account_type == "sales_rep"
            ).first()

    new_user = User(
        email=email,
        password_hash=hashed_pw,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        company_name=company_name,
        user_type="dealer",
        subscription_tier=tier,
        custom_subscription_price=custom_price,
        assigned_sales_rep_id=assigned_rep_id,
        verification_token=set_pw_token,
        active=True,
        verified=True,  # Admins auto-verify
        email_verified=True, # Admins auto-verify
    )
    
    db.add(new_user)
    db.flush()
    
    # 4. Create Profile
    slug_base = company_name or f"{first_name} {last_name}".strip() or email.split("@")[0]
    slug = create_slug(slug_base, db, DealerProfile)
    
    profile = DealerProfile(
        user_id=new_user.id,
        name=slug_base,
        company_name=company_name or None,
        email=email,
        phone=phone or None,
        slug=slug
    )
    db.add(profile)
    
    # 5. Generate API Key
    try:
        generate_api_key_for_dealer(new_user, db)
    except Exception:
        pass

    # 6. Create Referral Record if Rep Assigned
    if assigned_rep_id:
        # Determine effective price for commission calculation
        # If custom price is set, use that. Else standard tier price.
        tier_price = 0.0
        if tier == "basic": tier_price = 199.0
        elif tier == "plus": tier_price = 299.0
        elif tier == "premium" or tier == "pro": tier_price = 499.0
        
        eff_price = custom_price if custom_price is not None else tier_price
        
        referral = ReferralSignup(
            dealer_user_id=new_user.id,
            source_type="admin_manual",
            sales_rep_id=assigned_rep_id,
            affiliate_account_id=aff_account.id if aff_account else None,
            referral_code_used=aff_account.code if aff_account else "ADMIN_ASSIGN",
            effective_monthly_price=eff_price,
            commission_rate=commission_pct
        )
        db.add(referral)
    
    db.commit()
    
    # Send password-setup email
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
        "success": True,
        "message": "Broker registered successfully",
        "user_id": new_user.id,
        "email": new_user.email,
        "password_setup_email_sent": email_sent,
        "login_url": "/login"
    }


# ============= SUBSCRIPTION TIER CONFIGURATION =============

@router.get("/subscription-config")
def get_subscription_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get current subscription tier configuration."""
    site = db.query(SiteSettings).first()
    if not site or not site.subscription_config:
        # Return merged defaults
        return {
            "broker_tiers": _DEFAULT_BROKER_TIERS,
        }
    
    config = site.subscription_config
    broker_tiers = {**_DEFAULT_BROKER_TIERS, **config.get("broker_tiers", {})}
    
    return {
        "broker_tiers": broker_tiers,
    }


@router.put("/subscription-config")
def update_subscription_config(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update subscription tier configuration."""
    site = db.query(SiteSettings).first()
    if not site:
        site = SiteSettings()
        db.add(site)
    
    if not site.subscription_config:
        site.subscription_config = {}
    
    # Update broker tiers if provided
    if "broker_tiers" in data:
        site.subscription_config["broker_tiers"] = data["broker_tiers"]
    
    db.commit()
    db.refresh(site)
    
    broker_tiers = {**_DEFAULT_BROKER_TIERS, **site.subscription_config.get("broker_tiers", {})}
    
    return {
        "success": True,
        "message": "Subscription configuration updated",
        "broker_tiers": broker_tiers,
    }


# ── Resend / regenerate broker setup link ─────────────────────────────────────

@router.post("/broker/{user_id}/resend-setup")
def resend_broker_setup_email(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Regenerate a password-setup token for a broker and re-send the setup email.
    Also returns the setup URL so the admin can share it manually if email
    delivery is not working.
    """
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")

    broker = db.query(User).filter(User.id == user_id, User.user_type == "dealer").first()
    if not broker:
        raise ResourceNotFoundException("Broker", user_id)

    # Regenerate token
    new_token = secrets.token_urlsafe(32)
    broker.verification_token = new_token
    db.commit()

    setup_url = f"{email_service.base_url}/set-password?token={new_token}"

    # Attempt to email — non-fatal if it fails
    email_sent = False
    display_name = broker.first_name or broker.company_name or broker.email.split("@")[0]
    try:
        email_service.send_password_set_email(broker.email, display_name, setup_url)
        email_sent = True
    except Exception as exc:
        import logging as _log
        _log.warning("resend_broker_setup: email failed for %s: %s", broker.email, exc)

    return {
        "success": True,
        "email_sent": email_sent,
        "setup_url": setup_url,
        "message": (
            "Setup email sent successfully."
            if email_sent
            else "Email delivery failed — copy the setup_url and send it manually."
        ),
    }


# ---------------------------------------------------------------------------
# Manual subscription tier override (support tool — bypasses Stripe)
# ---------------------------------------------------------------------------

VALID_TIERS = {"free", "basic", "plus", "pro", "ultimate"}


@router.post("/admin/users/{user_id}/set-tier")
def admin_set_user_tier(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Manually override a user's subscription tier without going through Stripe.
    Use this to fix billing issues, grant comps, or unblock users on launch day.

    Body: { "tier": "basic" | "plus" | "pro" | "ultimate" | "free", "note": "optional reason" }
    """
    new_tier = (body.get("tier") or "").strip().lower()
    if new_tier not in VALID_TIERS:
        raise ValidationException(f"Invalid tier '{new_tier}'. Must be one of: {', '.join(sorted(VALID_TIERS))}")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise ResourceNotFoundException(f"User {user_id} not found")

    old_tier = target.subscription_tier
    target.subscription_tier = new_tier
    db.commit()

    logger.info(
        "Admin %s manually set user %s (%s) tier: %s → %s. Note: %s",
        current_user.email,
        target.id,
        target.email,
        old_tier,
        new_tier,
        body.get("note", ""),
    )

    return {
        "success": True,
        "user_id": target.id,
        "email": target.email,
        "old_tier": old_tier,
        "new_tier": new_tier,
    }