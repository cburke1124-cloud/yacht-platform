from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta
from typing import Optional
import stripe

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.listing import Listing, FeaturedListing
from app.models.user import User
from app.models.misc import SiteSettings
from app.exceptions import (
    ValidationException,
    AuthorizationException,
    ResourceNotFoundException,
    ExternalServiceException,
)
from app.constants import FEATURED_PLANS

router = APIRouter()


DEFAULT_FEATURED_CONFIG = {
    "plans": FEATURED_PLANS,
    "algorithm": {
        "base_multiplier": 1.0,
        "demand_weight": 0.08,
        "value_weight": 0.06,
        "max_multiplier": 2.0,
    },
    "team_controls": {
        "allow_salesman_to_feature_own": True,
        "allow_salesman_to_feature_all": False,
    },
}


def _get_or_create_site_settings(db: Session) -> SiteSettings:
    settings = db.query(SiteSettings).first()
    if settings:
        return settings

    settings = SiteSettings(subscription_config={})
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def _get_featured_config(db: Session) -> dict:
    settings = _get_or_create_site_settings(db)
    config = (settings.subscription_config or {}).get("featured", {})
    return {
        "plans": config.get("plans", FEATURED_PLANS),
        "algorithm": {
            **DEFAULT_FEATURED_CONFIG["algorithm"],
            **(config.get("algorithm", {}) or {}),
        },
        "team_controls": {
            **DEFAULT_FEATURED_CONFIG["team_controls"],
            **(config.get("team_controls", {}) or {}),
        },
    }


def _save_featured_config(db: Session, config: dict) -> None:
    settings = _get_or_create_site_settings(db)
    subscription_config = settings.subscription_config or {}
    subscription_config["featured"] = config
    settings.subscription_config = subscription_config
    settings.updated_at = datetime.utcnow()
    db.commit()


def _dealer_owner_id(user: User) -> int:
    return user.parent_dealer_id or user.id


def _can_manage_listing_feature(listing: Listing, current_user: User, db: Session) -> bool:
    if current_user.user_type == "admin":
        return True

    if listing.user_id == current_user.id:
        return True

    listing_owner = db.query(User).filter(User.id == listing.user_id).first()
    if not listing_owner:
        return False

    current_dealer_id = _dealer_owner_id(current_user)
    listing_dealer_id = _dealer_owner_id(listing_owner)
    if current_dealer_id != listing_dealer_id:
        return False

    perms = current_user.permissions or {}
    if current_user.id == current_dealer_id:
        return True

    can_feature_own = bool(perms.get("can_feature_own_listings") or perms.get("can_edit_own_listings"))
    can_feature_all = bool(perms.get("can_feature_all_listings") or perms.get("can_edit_all_listings"))

    return (can_feature_own and listing.user_id == current_user.id) or can_feature_all


def _calculate_featured_quote(listing: Listing, plan: str, config: dict) -> dict:
    plans = config.get("plans", FEATURED_PLANS)
    if plan not in plans:
        raise ValidationException("Invalid featured plan")

    plan_data = plans[plan]
    algorithm = config.get("algorithm", DEFAULT_FEATURED_CONFIG["algorithm"])

    base_price = float(plan_data.get("price", 0))
    base_multiplier = float(algorithm.get("base_multiplier", 1.0))
    demand_weight = float(algorithm.get("demand_weight", 0.08))
    value_weight = float(algorithm.get("value_weight", 0.06))
    max_multiplier = max(1.0, float(algorithm.get("max_multiplier", 2.0)))

    normalized_views = min(1.0, (listing.views or 0) / 5000)
    normalized_price = min(1.0, (listing.price or 0) / 2_000_000)

    demand_multiplier = 1.0 + (normalized_views * demand_weight)
    value_multiplier = 1.0 + (normalized_price * value_weight)

    total_multiplier = min(max_multiplier, max(0.5, base_multiplier * demand_multiplier * value_multiplier))
    final_price = round(base_price * total_multiplier, 2)

    return {
        "plan": plan,
        "plan_name": plan_data.get("name", plan),
        "days": int(plan_data.get("days", 0)),
        "base_price": round(base_price, 2),
        "final_price": final_price,
        "multiplier": round(total_multiplier, 4),
        "breakdown": {
            "base_multiplier": round(base_multiplier, 4),
            "demand_multiplier": round(demand_multiplier, 4),
            "value_multiplier": round(value_multiplier, 4),
        },
    }


# ============================================================================
# PUBLIC ENDPOINTS - Homepage Featured Listings
# ============================================================================

@router.get("/featured-listings")
def get_public_featured_listings(db: Session = Depends(get_db)):
    """
    PUBLIC ENDPOINT: Get currently active featured listings for homepage carousel.
    No authentication required.
    Excludes listings from demo accounts.
    """
    
    # Get active featured listings, excluding demo accounts
    featured_items = db.query(
        FeaturedListing,
        Listing
    ).join(
        Listing, FeaturedListing.listing_id == Listing.id
    ).join(
        User, Listing.user_id == User.id
    ).filter(
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow(),
        Listing.status == "active",
        User.is_demo != True
    ).order_by(
        Listing.featured_priority.desc(),
        FeaturedListing.expires_at.desc(),
        FeaturedListing.started_at.desc()
    ).limit(10).all()  # Limit to 10 featured listings
    
    result = []
    for featured, listing in featured_items:
        # Get images
        images = [{"url": img.url} for img in listing.images[:3]]  # Get first 3 images
        
        result.append({
            "id": listing.id,
            "title": listing.title,
            "price": listing.price,
            "currency": listing.currency or "USD",
            "year": listing.year,
            "make": listing.make,
            "model": listing.model,
            "city": listing.city,
            "state": listing.state,
            "images": images,
            "featured_until": featured.expires_at.isoformat() if featured.expires_at else None,
            "featured_plan": featured.plan
        })
    
    return result


@router.post("/featured-listings/track-impression")
def track_featured_impression(data: dict, db: Session = Depends(get_db)):
    """Track when a featured listing is viewed (impression)."""
    
    listing_id = data.get("listing_id")
    if not listing_id:
        return {"success": False, "error": "listing_id required"}
    
    # Find active featured listing
    featured = db.query(FeaturedListing).filter(
        FeaturedListing.listing_id == listing_id,
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow()
    ).first()
    
    if featured:
        featured.impressions = (featured.impressions or 0) + 1
        db.commit()
        return {"success": True, "impressions": featured.impressions}
    
    return {"success": False, "error": "Featured listing not found"}


@router.post("/featured-listings/track-click")
def track_featured_click(data: dict, db: Session = Depends(get_db)):
    """Track when a featured listing is clicked."""
    
    listing_id = data.get("listing_id")
    if not listing_id:
        return {"success": False, "error": "listing_id required"}
    
    # Find active featured listing
    featured = db.query(FeaturedListing).filter(
        FeaturedListing.listing_id == listing_id,
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow()
    ).first()
    
    if featured:
        featured.clicks = (featured.clicks or 0) + 1
        db.commit()
        return {"success": True, "clicks": featured.clicks}
    
    return {"success": False, "error": "Featured listing not found"}


# ============================================================================
# DEALER ENDPOINTS - Manage Featured Listings
# ============================================================================

@router.get("/my-featured-listings")
def get_my_featured_listings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all featured listings for current dealer (including expired)."""

    dealer_id = _dealer_owner_id(current_user)

    featured_listings = db.query(
        FeaturedListing,
        Listing
    ).join(
        Listing, FeaturedListing.listing_id == Listing.id
    ).join(
        User, Listing.user_id == User.id
    ).filter(
        or_(
            User.id == dealer_id,
            User.parent_dealer_id == dealer_id,
        )
    ).order_by(
        FeaturedListing.started_at.desc()
    ).all()
    
    result = []
    for featured, listing in featured_listings:
        # Get first image
        first_image = listing.images[0].url if listing.images else None
        
        result.append({
            "id": featured.id,
            "listing_id": listing.id,
            "listing_title": listing.title,
            "listing_image": first_image,
            "plan": featured.plan,
            "price_paid": featured.price_paid,
            "started_at": featured.started_at.isoformat() if featured.started_at else None,
            "expires_at": featured.expires_at.isoformat() if featured.expires_at else None,
            "impressions": featured.impressions,
            "clicks": featured.clicks,
            "active": featured.active,
            "is_courtesy": featured.price_paid == 0
        })
    
    return result


@router.get("/featured-listings/available")
def get_available_to_feature(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get listings that are eligible to be featured (not already featured)."""
    
    dealer_id = _dealer_owner_id(current_user)
    perms = current_user.permissions or {}
    can_feature_all = current_user.user_type in {"admin", "dealer"} or bool(
        perms.get("can_feature_all_listings") or perms.get("can_edit_all_listings")
    )
    # Get IDs of currently featured listings
    featured_ids = db.query(FeaturedListing.listing_id).join(
        Listing, FeaturedListing.listing_id == Listing.id
    ).join(
        User, Listing.user_id == User.id
    ).filter(
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow(),
        or_(
            User.id == dealer_id,
            User.parent_dealer_id == dealer_id,
        )
    ).all()
    featured_ids = [f[0] for f in featured_ids]    
    
    listings_query = db.query(Listing).join(User, Listing.user_id == User.id).filter(
        Listing.status == "active",
        or_(
            User.id == dealer_id,
            User.parent_dealer_id == dealer_id,
        )
    )
    
    # Get active listings not currently featured
    if not can_feature_all:
        listings_query = listings_query.filter(Listing.user_id == current_user.id)
    
    if featured_ids:
        listings_query = listings_query.filter(~Listing.id.in_(featured_ids))
    
    listings = listings_query.all()
    
    return [
        {
            "id": l.id,
            "title": l.title,
            "price": l.price,
            "images": [img.url for img in l.images[:1]],
            "city": l.city,
            "state": l.state,
            "views": l.views or 0
        }
        for l in listings
    ]


@router.get("/featured-listings/pricing-options")
def get_featured_pricing_options(db: Session = Depends(get_db)):
    config = _get_featured_config(db)
    plans = config.get("plans", FEATURED_PLANS)
    return {
        "plans": plans,
        "algorithm": config.get("algorithm", {}),
    }


@router.get("/featured-listings/quote")
def get_featured_quote(
    listing_id: int,
    plan: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    if not _can_manage_listing_feature(listing, current_user, db):
        raise AuthorizationException("You do not have permission to feature this listing")

    config = _get_featured_config(db)
    quote = _calculate_featured_quote(listing, plan, config)
    return {
        "listing_id": listing.id,
        "listing_title": listing.title,
        **quote,
    }


@router.post("/featured-listings/purchase")
def purchase_featured_listing(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing_id = data.get("listing_id")
    plan = data.get("plan")
    payment_method_id = data.get("payment_method_id")
    courtesy = bool(data.get("courtesy", False))
    no_charge_override = bool(data.get("no_charge_override", False))

    if not listing_id or not plan:
        raise ValidationException("listing_id and plan are required")

    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    if not _can_manage_listing_feature(listing, current_user, db):
        raise AuthorizationException("You do not have permission to feature this listing")

    existing = db.query(FeaturedListing).filter(
        FeaturedListing.listing_id == listing_id,
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow()
    ).first()
    if existing:
        raise ValidationException("Listing is already actively featured")

    config = _get_featured_config(db)
    quote = _calculate_featured_quote(listing, plan, config)
    amount_due = 0.0 if courtesy or (no_charge_override and current_user.user_type == "admin") else quote["final_price"]

    payment_id = None
    payment_status = "waived" if amount_due == 0 else "uncollected"
    if amount_due > 0 and payment_method_id:
        amount = int(amount_due * 100)
        try:
            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency="usd",
                payment_method=payment_method_id,
                confirm=True,
                description=f"Feature listing: {listing.id}",
                metadata={
                    "listing_id": listing.id,
                    "user_id": current_user.id,
                    "plan": plan
                }
            )
            if intent.status != "succeeded":
                raise ExternalServiceException("Payment failed")
            payment_id = intent.id
            payment_status = "paid"
        except stripe.error.StripeError as exc:
            raise ExternalServiceException(str(exc))

    expires_at = datetime.utcnow() + timedelta(days=quote["days"])
    featured = FeaturedListing(
        listing_id=listing.id,
        user_id=_dealer_owner_id(current_user),
        plan=plan,
        price_paid=amount_due,
        expires_at=expires_at,
        stripe_payment_id=payment_id,
        active=True,
    )

    listing.featured = True
    listing.featured_until = expires_at
    listing.featured_plan = plan
    listing.featured_priority = max(1, listing.featured_priority or 0)

    db.add(featured)
    db.commit()
    db.refresh(featured)

    return {
        "success": True,
        "featured_id": featured.id,
        "listing_id": listing.id,
        "expires_at": expires_at.isoformat(),
        "amount_charged": amount_due,
        "payment_status": payment_status,
        "message": "Listing is now featured",
    }


@router.post("/featured-listings/{featured_id}/renew")
def renew_featured_listing(
    featured_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Renew an expiring featured listing."""
    
    featured = db.query(FeaturedListing).filter(FeaturedListing.id == featured_id).first()
    
    if not featured:
        raise ResourceNotFoundException("Featured listing", featured_id)

    listing = db.query(Listing).filter(Listing.id == featured.listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", featured.listing_id)
    if not _can_manage_listing_feature(listing, current_user, db):
        raise AuthorizationException("You do not have permission to renew this featured listing")
    
    plan = data.get("plan")
    payment_method_id = data.get("payment_method_id")
    
    config = _get_featured_config(db)
    plans = config.get("plans", FEATURED_PLANS)

    if plan not in plans:
        raise ValidationException("Invalid plan")

    plan_details = plans[plan]
    amount = int(plan_details["price"] * 100)
    
    try:
        # Process payment
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="usd",
            payment_method=payment_method_id,
            confirm=True,
            description=f"Renew featured listing: {featured.listing_id}",
            metadata={
                "listing_id": featured.listing_id,
                "user_id": current_user.id,
                "plan": plan
            }
        )
        
        if intent.status == "succeeded":
            # Extend expiration from current expiry or now (whichever is later)
            base_date = max(featured.expires_at, datetime.utcnow())
            new_expires_at = base_date + timedelta(days=plan_details["days"])
            
            # Update existing featured record
            featured.expires_at = new_expires_at
            featured.plan = plan
            featured.price_paid += plan_details["price"]
            featured.active = True
            featured.stripe_payment_id = intent.id
            
            # Update listing
            listing.featured = True
            listing.featured_until = new_expires_at
            listing.featured_plan = plan
            
            db.commit()
            
            return {
                "success": True,
                "message": f"Featured listing renewed for {plan_details['days']} days",
                "expires_at": new_expires_at.isoformat()
            }
        
        raise ExternalServiceException("Payment failed")
        
    except stripe.error.StripeError as e:
        raise ExternalServiceException(str(e))


# ============================================================================
# ADMIN ENDPOINTS - Platform-Wide Featured Management
# ============================================================================

@router.get("/admin/featured-listings")
def get_all_featured_listings(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all featured listings across the platform (admin only)."""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    query = db.query(
        FeaturedListing,
        Listing,
        User
    ).join(
        Listing, FeaturedListing.listing_id == Listing.id
    ).join(
        User, FeaturedListing.user_id == User.id
    )
    
    if status == "active":
        query = query.filter(
            FeaturedListing.active == True,
            FeaturedListing.expires_at > datetime.utcnow()
        )
    elif status == "expired":
        query = query.filter(
            and_(
                FeaturedListing.active == False,
                FeaturedListing.expires_at <= datetime.utcnow()
            )
        )
    
    results = query.order_by(FeaturedListing.started_at.desc()).all()
    
    featured_list = []
    for featured, listing, user in results:
        first_image = listing.images[0].url if listing.images else None
        
        featured_list.append({
            "id": featured.id,
            "listing_id": listing.id,
            "listing_title": listing.title,
            "listing_image": first_image,
            "dealer_id": user.id,
            "dealer_name": user.company_name or f"{user.first_name} {user.last_name}",
            "plan": featured.plan,
            "price_paid": featured.price_paid,
            "started_at": featured.started_at.isoformat() if featured.started_at else None,
            "expires_at": featured.expires_at.isoformat() if featured.expires_at else None,
            "impressions": featured.impressions,
            "clicks": featured.clicks,
            "active": featured.active,
            "is_courtesy": featured.price_paid == 0
        })
    
    return featured_list


@router.post("/admin/featured-listings/courtesy")
def courtesy_feature_listing(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Feature a listing for free as a courtesy (admin only)."""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    listing_id = data.get("listing_id")
    duration_days = data.get("duration_days", 30)
    
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Check if already featured
    existing = db.query(FeaturedListing).filter(
        FeaturedListing.listing_id == listing_id,
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow()
    ).first()
    
    if existing:
        raise ValidationException("Listing is already featured")
    
    # Create courtesy feature
    expires_at = datetime.utcnow() + timedelta(days=duration_days)
    
    featured = FeaturedListing(
        listing_id=listing_id,
        user_id=listing.user_id,
        plan="courtesy",
        price_paid=0,
        expires_at=expires_at,
        stripe_payment_id=None,
        active=True
    )
    
    # Update listing
    listing.featured = True
    listing.featured_until = expires_at
    listing.featured_plan = "courtesy"
    if hasattr(listing, 'featured_priority'):
        listing.featured_priority = 5
    
    db.add(featured)
    db.commit()
    db.refresh(featured)
    
    return {
        "success": True,
        "message": f"Listing featured as courtesy for {duration_days} days",
        "featured_id": featured.id,
        "expires_at": expires_at.isoformat()
    }


@router.post("/admin/featured-listings/{featured_id}/deactivate")
def admin_deactivate_featured(
    featured_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually deactivate a featured listing (admin only)."""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    featured = db.query(FeaturedListing).filter(
        FeaturedListing.id == featured_id
    ).first()
    
    if not featured:
        raise ResourceNotFoundException("Featured listing", featured_id)
    
    # Deactivate featured status
    featured.active = False
    
    # Update listing
    listing = db.query(Listing).filter(Listing.id == featured.listing_id).first()
    if listing:
        listing.featured = False
        listing.featured_until = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Featured listing deactivated"
    }


@router.get("/admin/featured-purchases")
def get_admin_featured_purchases(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")

    rows = db.query(FeaturedListing, Listing, User).join(
        Listing, FeaturedListing.listing_id == Listing.id
    ).join(
        User, Listing.user_id == User.id
    ).order_by(
        FeaturedListing.created_at.desc()
    ).limit(limit).all()

    return [
        {
            "id": featured.id,
            "listing_id": listing.id,
            "listing_title": listing.title,
            "dealer_id": dealer.id,
            "dealer_name": dealer.company_name or f"{dealer.first_name or ''} {dealer.last_name or ''}".strip() or dealer.email,
            "plan": featured.plan,
            "price_paid": float(featured.price_paid or 0),
            "created_at": featured.created_at.isoformat() if featured.created_at else None,
            "expires_at": featured.expires_at.isoformat() if featured.expires_at else None,
            "active": featured.active,
        }
        for featured, listing, dealer in rows
    ]


@router.post("/admin/featured-listings/manual-status")
def admin_manual_feature_status(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")

    listing_id = data.get("listing_id")
    make_featured = bool(data.get("featured", False))
    plan = data.get("plan", "courtesy")
    duration_days = int(data.get("duration_days", 30))

    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    active_featured = db.query(FeaturedListing).filter(
        FeaturedListing.listing_id == listing.id,
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow(),
    ).first()

    if not make_featured:
        if active_featured:
            active_featured.active = False
        listing.featured = False
        listing.featured_until = None
        listing.featured_plan = None
        listing.featured_priority = 0
        db.commit()
        return {"success": True, "message": "Listing removed from featured"}

    config = _get_featured_config(db)
    plans = config.get("plans", FEATURED_PLANS)
    if plan != "courtesy" and plan not in plans:
        raise ValidationException("Invalid plan")

    days = duration_days if duration_days > 0 else int(plans.get(plan, {}).get("days", 30))
    expires_at = datetime.utcnow() + timedelta(days=days)

    if active_featured:
        active_featured.expires_at = expires_at
        active_featured.plan = plan
        active_featured.price_paid = 0
        active_featured.active = True
    else:
        db.add(FeaturedListing(
            listing_id=listing.id,
            user_id=listing.user_id,
            plan=plan,
            price_paid=0,
            expires_at=expires_at,
            stripe_payment_id=None,
            active=True,
        ))

    listing.featured = True
    listing.featured_until = expires_at
    listing.featured_plan = plan
    listing.featured_priority = max(5, listing.featured_priority or 0)
    db.commit()

    return {
        "success": True,
        "message": "Listing marked as featured",
        "expires_at": expires_at.isoformat(),
    }


@router.get("/admin/featured-pricing")
def get_featured_pricing_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current featured pricing configuration (admin only)."""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")

    config = _get_featured_config(db)
    plans_map = config.get("plans", FEATURED_PLANS)
    plans_list = [
        {
            "plan_id": plan_id,
            "name": plan_data.get("name", plan_id),
            "days": plan_data.get("days", 0),
            "price": plan_data.get("price", 0),
            "description": plan_data.get("description", ""),
        }
        for plan_id, plan_data in plans_map.items()
    ]

    return {
        "plans": plans_map,
        "plans_list": plans_list,
        "algorithm": config.get("algorithm", {}),
        "team_controls": config.get("team_controls", {}),
    }


@router.put("/admin/featured-pricing")
def update_featured_pricing(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update featured pricing (admin only)."""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    incoming_plans = data.get("plans") or {}
    plans = {}
    if isinstance(incoming_plans, list):
        for plan_data in incoming_plans:
            plan_id = plan_data.get("plan_id")
            if plan_id:
                plans[plan_id] = {
                    "name": plan_data.get("name", plan_id),
                    "price": float(plan_data.get("price", 0)),
                    "days": int(plan_data.get("days", 0)),
                    "description": plan_data.get("description", ""),
                }
    else:
        plans = incoming_plans

    if not plans:
        raise ValidationException("At least one featured plan is required")

    for plan_id, plan_data in plans.items():
        if not all(k in plan_data for k in ["name", "price", "days"]):
            raise ValidationException(f"Invalid plan data for {plan_id}")

    config = _get_featured_config(db)
    config["plans"] = plans
    if "algorithm" in data and isinstance(data.get("algorithm"), dict):
        config["algorithm"] = {
            **config.get("algorithm", {}),
            **data.get("algorithm", {}),
        }
    if "team_controls" in data and isinstance(data.get("team_controls"), dict):
        config["team_controls"] = {
            **config.get("team_controls", {}),
            **data.get("team_controls", {}),
        }

    _save_featured_config(db, config)
    
    return {
        "success": True,
        "message": "Pricing updated successfully",
        "plans": plans,
        "algorithm": config.get("algorithm", {}),
        "team_controls": config.get("team_controls", {}),
    }


@router.get("/admin/featured-stats")
def get_admin_featured_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get platform-wide featured listing statistics (admin only)."""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    # Total revenue
    total_revenue = db.query(
        func.sum(FeaturedListing.price_paid)
    ).filter(
        FeaturedListing.price_paid > 0
    ).scalar() or 0
    
    # Active featured count
    active_count = db.query(func.count(FeaturedListing.id)).filter(
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow()
    ).scalar()
    
    # Courtesy count
    courtesy_count = db.query(func.count(FeaturedListing.id)).filter(
        FeaturedListing.active == True,
        FeaturedListing.expires_at > datetime.utcnow(),
        FeaturedListing.price_paid == 0
    ).scalar()
    
    # Total impressions & clicks
    totals = db.query(
        func.sum(FeaturedListing.impressions).label('impressions'),
        func.sum(FeaturedListing.clicks).label('clicks')
    ).first()
    
    total_impressions = totals.impressions or 0
    total_clicks = totals.clicks or 0
    avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    
    # Revenue by plan
    revenue_by_plan = db.query(
        FeaturedListing.plan,
        func.sum(FeaturedListing.price_paid).label('revenue'),
        func.count(FeaturedListing.id).label('count')
    ).filter(
        FeaturedListing.price_paid > 0
    ).group_by(FeaturedListing.plan).all()
    
    # Top performing featured listings
    top_performers = db.query(
        FeaturedListing,
        Listing
    ).join(
        Listing, FeaturedListing.listing_id == Listing.id
    ).filter(
        FeaturedListing.active == True
    ).order_by(
        FeaturedListing.clicks.desc()
    ).limit(10).all()

    total_featured_count = db.query(func.count(FeaturedListing.id)).scalar() or 0
    avg_price = (float(total_revenue) / total_featured_count) if total_featured_count > 0 else 0.0
    
    return {
        "total_revenue": float(total_revenue),
        "active_featured": active_count,
        "total_featured": total_featured_count,
        "average_price": round(avg_price, 2),
        "courtesy_featured": courtesy_count,
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "average_ctr": round(avg_ctr, 2),
        "totalRevenue": float(total_revenue),
        "activeFeatured": active_count,
        "totalFeatured": total_featured_count,
        "averagePrice": round(avg_price, 2),
        "revenue_by_plan": [
            {
                "plan": r.plan,
                "revenue": float(r.revenue),
                "count": r.count
            }
            for r in revenue_by_plan
        ],
        "top_performers": [
            {
                "listing_id": listing.id,
                "listing_title": listing.title,
                "impressions": featured.impressions,
                "clicks": featured.clicks,
                "ctr": round((featured.clicks / featured.impressions * 100) if featured.impressions > 0 else 0, 2)
            }
            for featured, listing in top_performers
        ]
    }


# ============================================================================
# BACKGROUND TASK - Expire Featured Listings
# ============================================================================

def expire_featured_listings_task(db: Session):
    """
    Background task to expire featured listings.
    Called by scheduler.
    """
    # Find expired featured listings
    expired = db.query(FeaturedListing).filter(
        FeaturedListing.active == True,
        FeaturedListing.expires_at <= datetime.utcnow()
    ).all()
    
    for featured in expired:
        featured.active = False
        
        # Update listing
        listing = db.query(Listing).filter(Listing.id == featured.listing_id).first()
        if listing:
            listing.featured = False
            listing.featured_until = None
            listing.featured_plan = None
            if hasattr(listing, 'featured_priority'):
                listing.featured_priority = 0
    
    db.commit()
    
    return {
        "expired_count": len(expired),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/admin/featured-listings/expire-check")
def manual_expire_check(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger expiration check (admin only)."""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    result = expire_featured_listings_task(db)
    
    return {
        "success": True,
        "message": f"Expired {result['expired_count']} featured listings",
        "expired_count": result["expired_count"],
        "timestamp": result["timestamp"]
    }