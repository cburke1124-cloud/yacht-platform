from datetime import datetime, timedelta
import secrets
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError
from sqlalchemy import func, text

from app.db.session import get_db
from app.api.deps import get_current_user
from app.security.auth import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User, UserPreferences
from app.models.dealer import DealerProfile, EmailVerification
from app.models.listing import Listing
from app.models.partner_growth import AffiliateAccount, PartnerDeal, ReferralSignup
from app.exceptions import (
    ValidationException,
    AuthenticationException,
    AuthorizationException,
    BusinessLogicException,
)
from app.services.email_service import email_service
from app.utils.slug import create_slug
from app.core.config import settings
from app.schemas.auth import UserRegister, UserLogin, Token, TrialStart, TrialConvert

# Import API key service
from app.services.api_key_service import generate_api_key_for_dealer

router = APIRouter()
logger = logging.getLogger(__name__)

TIER_PRICES = {
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


def _is_deal_active(deal: PartnerDeal) -> bool:
    now = datetime.utcnow()
    if not deal.active:
        return False
    if deal.start_date and deal.start_date > now:
        return False
    if deal.end_date and deal.end_date < now:
        return False
    return True


def _apply_deal_price(base_price: float, deal: PartnerDeal) -> float:
    if deal.fixed_monthly_price is not None:
        return max(float(deal.fixed_monthly_price), 0.0)

    if deal.discount_type == "percentage" and deal.discount_value is not None:
        return max(base_price * (1.0 - (float(deal.discount_value) / 100.0)), 0.0)

    if deal.discount_type == "fixed" and deal.discount_value is not None:
        return max(base_price - float(deal.discount_value), 0.0)

    return base_price


@router.post("/register", response_model=Token)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    if not user_data.agree_terms:
        raise ValidationException("You must agree to the Terms and Privacy Policy")
    if not user_data.agree_communications:
        raise ValidationException("You must agree to receive account communications")

    try:
        existing_user = db.query(User).filter(User.email == user_data.email).first()
    except ProgrammingError:
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR"))
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_verification_token ON users (verification_token)"))
        db.commit()
        existing_user = db.query(User).filter(User.email == user_data.email).first()

    if existing_user:
        raise ValidationException("Email already registered")

    affiliate_account = None
    if user_data.referral_code:
        affiliate_account = db.query(AffiliateAccount).filter(
            func.lower(AffiliateAccount.code) == user_data.referral_code.strip().lower(),
            AffiliateAccount.active == True,
        ).first()
        if not affiliate_account:
            raise ValidationException("Invalid referral code")

    partner_deal = None
    if user_data.deal_code:
        partner_deal = db.query(PartnerDeal).filter(
            func.lower(PartnerDeal.code) == user_data.deal_code.strip().lower(),
        ).first()
        if not partner_deal or not _is_deal_active(partner_deal):
            raise ValidationException("Invalid or inactive deal code")

    if not partner_deal:
        targeted_email_deal = db.query(PartnerDeal).filter(
            func.lower(PartnerDeal.target_email) == user_data.email.strip().lower(),
            PartnerDeal.active == True,
        ).order_by(PartnerDeal.created_at.desc()).first()
        if targeted_email_deal and _is_deal_active(targeted_email_deal):
            partner_deal = targeted_email_deal

    assigned_sales_rep_id = None
    if affiliate_account and affiliate_account.account_type == "sales_rep":
        assigned_sales_rep_id = affiliate_account.user_id
    elif partner_deal and partner_deal.owner_sales_rep_id:
        assigned_sales_rep_id = partner_deal.owner_sales_rep_id

    hashed_password = get_password_hash(user_data.password)

    user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        user_type=user_data.user_type,
        company_name=user_data.company_name,
        subscription_tier=user_data.subscription_tier or "free",
        assigned_sales_rep_id=assigned_sales_rep_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    effective_monthly_price = float(TIER_PRICES.get(user.subscription_tier or "free", 0.0))

    try:
        prefs = UserPreferences(user_id=user.id)
        prefs.email_marketing = bool(user_data.marketing_opt_in)
        prefs.email_new_message = True
        prefs.email_new_inquiry = True
        prefs.push_new_message = True
        prefs.push_new_inquiry = True
        prefs.app_new_message = True
        prefs.app_new_inquiry = True

        existing_permissions = user.permissions or {}

        base_monthly_price = float(TIER_PRICES.get(user.subscription_tier or "free", 0.0))
        effective_monthly_price = base_monthly_price
        free_access_until = None

        if partner_deal:
            effective_monthly_price = _apply_deal_price(base_monthly_price, partner_deal)
            if partner_deal.free_days and partner_deal.free_days > 0:
                free_access_until = (datetime.utcnow() + timedelta(days=int(partner_deal.free_days))).isoformat()

            if partner_deal.affiliate_account_id and not affiliate_account:
                affiliate_account = db.query(AffiliateAccount).filter(
                    AffiliateAccount.id == partner_deal.affiliate_account_id,
                    AffiliateAccount.active == True,
                ).first()

        existing_permissions.update({
            "agreed_terms": True,
            "agreed_communications": True,
            "marketing_opt_in": bool(user_data.marketing_opt_in),
            "consent_recorded_at": datetime.utcnow().isoformat(),
            "effective_monthly_price": effective_monthly_price,
        })

        if free_access_until:
            existing_permissions["free_access_until"] = free_access_until

        if partner_deal:
            existing_permissions["partner_deal"] = {
                "id": partner_deal.id,
                "code": partner_deal.code,
                "name": partner_deal.name,
                "term_months": partner_deal.term_months,
                "lifetime": bool(partner_deal.lifetime),
            }

        if affiliate_account:
            existing_permissions["referral_source"] = {
                "affiliate_account_id": affiliate_account.id,
                "code": affiliate_account.code,
                "account_type": affiliate_account.account_type,
            }

        user.permissions = existing_permissions

        db.add(prefs)

        if user.user_type == "dealer":
            slug = create_slug(user.company_name or user.email, db, DealerProfile)

            profile_data = {
                "user_id": user.id,
                "name": f"{user.first_name} {user.last_name}",
                "company_name": user.company_name,
                "email": user.email,
                "slug": slug,
            }

            if hasattr(DealerProfile, 'phone'):
                profile_data["phone"] = user.phone

            profile = DealerProfile(**profile_data)
            db.add(profile)

            try:
                api_key = generate_api_key_for_dealer(
                    db=db,
                    dealer_id=user.id,
                    tier=user.subscription_tier
                )

                dealer_name = user.company_name or f"{user.first_name} {user.last_name}"
                email_service.send_api_key_email(
                    to_email=user.email,
                    dealer_name=dealer_name,
                    api_key=api_key.raw_key,
                    tier=user.subscription_tier
                )
                logger.info(f"Generated and emailed API key for dealer {user.id}")

            except Exception as e:
                logger.error(f"Failed to generate/send API key for dealer {user.id}: {e}")

        if affiliate_account:
            signup = ReferralSignup(
                dealer_user_id=user.id,
                source_type="sales_rep" if affiliate_account.account_type == "sales_rep" else "affiliate",
                sales_rep_id=affiliate_account.user_id if affiliate_account.account_type == "sales_rep" else assigned_sales_rep_id,
                affiliate_account_id=affiliate_account.id,
                deal_id=partner_deal.id if partner_deal else None,
                referral_code_used=affiliate_account.code,
                effective_monthly_price=effective_monthly_price,
                commission_rate=affiliate_account.commission_rate or 10.0,
            )
            db.add(signup)

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Post-registration provisioning failed for user %s; continuing", user.id)

    token = None
    try:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=24)

        verification = EmailVerification(
            user_id=user.id,
            token=token,
            expires_at=expires_at
        )
        db.add(verification)
        db.commit()
    except Exception:
        db.rollback()
        token = None
        logger.exception("Email verification token creation failed for user %s", user.id)

    if token:
        try:
            user_name = f"{user.first_name} {user.last_name}" if user.first_name else None
            email_service.send_verification_email(
                to_email=user.email,
                token=token,
                user_name=user_name
            )
        except Exception:
            logger.exception("Verification email send failed for user %s", user.id)
    
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise AuthenticationException("Incorrect email or password")

    if not user.active:
        raise AuthorizationException("User account is inactive")

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user with permissions and role info."""
    
    permissions = current_user.permissions
    if isinstance(permissions, str):
        import json
        try:
            permissions = json.loads(permissions)
        except:
            permissions = {}
    
    if not permissions or permissions == {}:
        if current_user.user_type == "admin":
            permissions = {
                "can_create_listings": True,
                "can_manage_team": True,
                "can_view_all_listings": True,
                "can_modify_dealer_page": True,
                "can_view_analytics": True
            }
        elif current_user.user_type == "dealer" and not current_user.parent_dealer_id:
            permissions = {
                "can_create_listings": True,
                "can_manage_team": True,
                "can_view_all_listings": True,
                "can_modify_dealer_page": True,
                "can_view_analytics": True
            }
        elif current_user.user_type == "dealer" and current_user.parent_dealer_id:
            permissions = {
                "can_create_listings": True,
                "can_manage_team": False,
                "can_view_all_listings": False,
                "can_modify_dealer_page": False,
                "can_view_analytics": False
            }
        elif current_user.user_type == "salesman":
            permissions = {
                "can_create_listings": False,
                "can_manage_team": False,
                "can_view_all_listings": False,
                "can_modify_dealer_page": False,
                "can_view_analytics": True
            }
        else:
            permissions = {
                "can_create_listings": False,
                "can_manage_team": False,
                "can_view_all_listings": False,
                "can_modify_dealer_page": False,
                "can_view_analytics": False
            }
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "user_type": current_user.user_type,
        "company_name": current_user.company_name,
        "phone": current_user.phone,
        "subscription_tier": current_user.subscription_tier,
        "trial_active": current_user.trial_active,
        "trial_end_date": current_user.trial_end_date.isoformat() if current_user.trial_end_date else None,
        "parent_dealer_id": current_user.parent_dealer_id,
        "assigned_sales_rep_id": current_user.assigned_sales_rep_id,
        "permissions": permissions,
        "active": current_user.active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }


@router.post("/start-trial")
async def start_trial(data: TrialStart, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise ValidationException("Email already registered")

    trial_end = datetime.utcnow() + timedelta(days=data.trial_days)

    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        company_name=data.company_name,
        user_type="dealer",
        subscription_tier="trial",
        trial_active=True,
        trial_end_date=trial_end,
        assigned_sales_rep_id=data.sales_rep_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # ✅ GENERATE API KEY FOR TRIAL DEALERS
    try:
        api_key = generate_api_key_for_dealer(
            db=db,
            dealer_id=user.id,
            tier="trial"
        )
        
        dealer_name = user.company_name or f"{user.first_name} {user.last_name}"
        email_service.send_api_key_email(
            to_email=user.email,
            dealer_name=dealer_name,
            api_key=api_key.raw_key,
            tier="trial"
        )
        logger.info(f"Generated and emailed API key for trial dealer {user.id}")
        
    except Exception as e:
        logger.error(f"Failed to generate/send API key for trial dealer {user.id}: {e}")

    token = create_access_token(data={"sub": user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "trial_end_date": trial_end.isoformat(),
        "days_remaining": data.trial_days,
    }


@router.post("/convert-trial-to-paid")
def convert_trial(
    payment_data: TrialConvert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.trial_active:
        raise BusinessLogicException("No active trial")

    db.query(Listing).filter(
        Listing.user_id == current_user.id,
        Listing.status == "draft"
    ).update({"status": "active", "published_at": datetime.utcnow()})

    current_user.trial_active = False
    current_user.trial_converted = True
    current_user.subscription_tier = payment_data.tier
    
    # ✅ UPDATE API KEY TIER
    try:
        from app.models.api_keys import APIKey
        from app.services.api_key_service import update_api_key_tier
        
        api_key = db.query(APIKey).filter(
            APIKey.dealer_id == current_user.id,
            APIKey.key_type == "standard"
        ).first()
        
        if api_key:
            update_api_key_tier(db, api_key.id, payment_data.tier)
            logger.info(f"Updated API key tier for dealer {current_user.id} to {payment_data.tier}")
    
    except Exception as e:
        logger.error(f"Failed to update API key tier: {e}")
    
    db.commit()

    return {
        "success": True,
        "message": f"Upgraded to {payment_data.tier} plan!",
        "subscription_tier": payment_data.tier
    }