
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import secrets

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.listing import Listing
from app.models.dealer import DealerProfile
from app.models.partner_growth import AffiliateAccount, PartnerDeal, ReferralSignup
from app.models.documentation import Documentation
from app.exceptions import AuthorizationException, ResourceNotFoundException, ValidationException

router = APIRouter()

TIER_PRICES = {
    "free": 0.0,
    "trial": 0.0,
    "basic": 29.0,
    "plus": 59.0,
    "premium": 99.0,
    "pro": 99.0,
    "ultimate": 0.0,  # Custom/enterprise pricing — managed manually
    "private_basic": 9.0,
    "private_plus": 19.0,
    "private_pro": 39.0,
}


def _generate_ref_code() -> str:
    return f"YV{secrets.token_hex(4).upper()}"


def _ensure_sales_rep_affiliate_account(current_user: User, db: Session) -> AffiliateAccount:
    account = db.query(AffiliateAccount).filter(
        AffiliateAccount.user_id == current_user.id,
        AffiliateAccount.account_type == "sales_rep",
    ).first()

    if account:
        return account

    code = _generate_ref_code()
    while db.query(AffiliateAccount).filter(AffiliateAccount.code == code).first():
        code = _generate_ref_code()

    account = AffiliateAccount(
        name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email,
        email=current_user.email,
        code=code,
        account_type="sales_rep",
        user_id=current_user.id,
        commission_rate=current_user.commission_rate or 10.0,
        active=True,
        created_by=current_user.id,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_type != "salesman":
        raise AuthorizationException("Sales rep access required")

    deals = db.query(PartnerDeal).filter(
        PartnerDeal.owner_sales_rep_id == current_user.id
    ).order_by(PartnerDeal.created_at.desc()).all()

    usage_counts = {
        deal_id: count
        for deal_id, count in db.query(
            ReferralSignup.deal_id,
            func.count(ReferralSignup.id),
        ).filter(
            ReferralSignup.sales_rep_id == current_user.id,
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
    if current_user.user_type != "salesman":
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
        owner_sales_rep_id=current_user.id,
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