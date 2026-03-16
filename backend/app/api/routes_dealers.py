from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional

from app.db.session import get_db
from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.exceptions import ResourceNotFoundException

router = APIRouter()


@router.get("/")
def get_all_dealers(
    skip: int = Query(0),
    limit: int = Query(50),
    search: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all active dealers with their profiles and stats."""
    
    # Query dealers (users with dealer type and active profiles)
    query = db.query(User, DealerProfile).join(
        DealerProfile,
        User.id == DealerProfile.user_id
    ).filter(
        User.user_type == "dealer",
        User.active == True,
        User.is_demo != True
    )
    
    # Apply filters
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.company_name.ilike(search_pattern)) |
            (DealerProfile.company_name.ilike(search_pattern)) |
            (DealerProfile.city.ilike(search_pattern))
        )
    
    if state:
        query = query.filter(DealerProfile.state.ilike(f"%{state}%"))
    
    if country:
        query = query.filter(DealerProfile.country.ilike(f"%{country}%"))
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    results = query.offset(skip).limit(limit).all()
    
    dealers = []
    for user, profile in results:
        # Get listing stats
        listing_stats = db.query(
            func.count(Listing.id).label('total'),
            func.count(case((Listing.status == 'active', 1))).label('active')
        ).filter(Listing.user_id == user.id).first()

        
        dealers.append({
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}" if user.first_name else user.email,
            "company_name": profile.company_name or user.company_name,
            "slug": profile.slug,
            "logo_url": profile.logo_url,
            "description": profile.description,
            "email": profile.email or user.email,
            "phone": profile.phone or user.phone,
            "website": profile.website,
            "address": profile.address,
            "city": profile.city,
            "state": profile.state,
            "country": profile.country,
            "postal_code": profile.postal_code,
            "total_listings": listing_stats.total or 0,
            "active_listings": listing_stats.active or 0,
            "subscription_tier": user.subscription_tier,
            "created_at": user.created_at.isoformat() if user.created_at else None
        })
    
    return {
        "total": total,
        "dealers": dealers,
        "page": skip // limit + 1,
        "limit": limit
    }


@router.get("/{slug}")
def get_dealer_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """Get dealer details by slug."""
    
    profile = db.query(DealerProfile).filter(
        DealerProfile.slug == slug
    ).first()
    
    if not profile:
        raise ResourceNotFoundException("Dealer", slug)
    
    user = db.query(User).filter(User.id == profile.user_id).first()
    
    if not user or not user.active:
        raise ResourceNotFoundException("Dealer", slug)
    
    # Get dealer's active listings
    listings = db.query(Listing).filter(
        Listing.user_id == user.id,
        Listing.status == "active"
    ).order_by(Listing.created_at.desc()).limit(12).all()
    
    # Get stats
    listing_stats = db.query(
        func.count(Listing.id).label('total'),
        func.count(Listing.id.distinct()).filter(Listing.status == 'active').label('active'),
        func.sum(Listing.views).label('total_views')
    ).filter(Listing.user_id == user.id).first()

    
    return {
        "dealer": {
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}" if user.first_name else user.email,
            "business_name": profile.company_name or user.company_name,
            "slug": profile.slug,
            "logo_url": profile.logo_url,
            "cover_image_url": profile.banner_url,
            "bio": profile.description,
            "email": profile.email or user.email,
            "phone": profile.phone or user.phone,
            "website": profile.website,
            "address": profile.address,
            "city": profile.city,
            "state": profile.state,
            "country": profile.country,
            "postal_code": profile.postal_code,
            "facebook_url": profile.facebook_url,
            "instagram_url": profile.instagram_url,
            "twitter_url": profile.twitter_url,
            "linkedin_url": profile.linkedin_url,
            "subscription_tier": user.subscription_tier,
            "is_verified": True,  # Can add verification logic later
            "is_featured": user.subscription_tier == "premium",
            "member_since": user.created_at.isoformat() if user.created_at else None,
            "active_listings": listing_stats.active or 0,
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
                "images": [{"url": img.url} for img in l.images[:1]]
            }
            for l in listings
        ]
    }


@router.get("/locations/states")
def get_dealer_states(db: Session = Depends(get_db)):
    """Get list of states where dealers are located."""
    
    states = db.query(DealerProfile.state).filter(
        DealerProfile.state.isnot(None)
    ).distinct().all()
    
    return sorted([s[0] for s in states if s[0]])


@router.get("/locations/countries")
def get_dealer_countries(db: Session = Depends(get_db)):
    """Get list of countries where dealers are located."""
    
    countries = db.query(DealerProfile.country).filter(
        DealerProfile.country.isnot(None)
    ).distinct().all()
    
    return sorted([c[0] for c in countries if c[0]])