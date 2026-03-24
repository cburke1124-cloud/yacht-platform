from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import os

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.models.guest_broker import GuestBroker
from app.exceptions import ResourceNotFoundException, AuthorizationException

router = APIRouter()


# ===========================
# LISTING CONTACT INFO
# ===========================

@router.get("/listings/{listing_id}/contact-info")
def get_listing_contact_info(
    listing_id: int,
    db: Session = Depends(get_db)
):
    """
    Get dealer and salesman contact information for a listing.
    Shows both the dealership and the specific salesman assigned to the listing.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Get the salesman assigned to this listing (or creator if not assigned)
    salesman_id = listing.assigned_salesman_id if listing.assigned_salesman_id else listing.user_id
    salesman = db.query(User).filter(User.id == salesman_id).first()
    
    if not salesman:
        raise ResourceNotFoundException("Salesman", salesman_id)
    
    # Get the dealer (either the salesman's parent dealer or the salesman themselves if they are the dealer)
    dealer_id = salesman.parent_dealer_id if salesman.parent_dealer_id else salesman.id
    dealer = db.query(User).filter(User.id == dealer_id).first()
    dealer_profile = db.query(DealerProfile).filter(DealerProfile.user_id == dealer_id).first()
    
    # Build dealer info
    dealer_info = {
        "id": dealer.id,
        "company_name": dealer_profile.company_name if dealer_profile else dealer.company_name,
        "logo_url": dealer_profile.logo_url if dealer_profile else None,
        "email": dealer_profile.email if dealer_profile else dealer.email,
        "phone": dealer_profile.phone if dealer_profile else dealer.phone,
        "city": dealer_profile.city if dealer_profile else None,
        "state": dealer_profile.state if dealer_profile else None,
        "slug": dealer_profile.slug if dealer_profile else None
    }
    
    # Build salesman info (only if different from dealer)
    salesman_info = None
    if salesman.id != dealer_id:
        salesman_info = {
            "id": salesman.id,
            "first_name": salesman.first_name,
            "last_name": salesman.last_name,
            "email": salesman.email,
            "phone": salesman.phone,
            "photo_url": salesman.photo_url,
            "title": salesman.title,
            "bio": salesman.bio
        }
    
    return {
        "dealer": dealer_info,
        "salesman": salesman_info
    }


# ===========================
# ASSIGN SALESMAN TO LISTING
# ===========================

@router.put("/listings/{listing_id}/assign-salesman")
def assign_salesman_to_listing(
    listing_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Assign a team member (salesman) to a listing.
    Only the dealer/owner can assign salesmen.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Check authorization - must be the listing owner or dealer
    if listing.user_id != current_user.id:
        # Check if current user is the parent dealer
        listing_owner = db.query(User).filter(User.id == listing.user_id).first()
        if not listing_owner or listing_owner.parent_dealer_id != current_user.id:
            raise AuthorizationException("You don't have permission to assign salesmen to this listing")
    
    salesman_id = data.get("salesman_id")
    guest_salesman_id = data.get("guest_salesman_id")

    if not salesman_id and not guest_salesman_id:
        # Unassign both
        listing.assigned_salesman_id = None
        listing.guest_salesman_id = None
        db.commit()
        return {"success": True, "message": "Salesman unassigned"}

    if guest_salesman_id:
        # Assign to a guest broker (no account needed)
        guest = db.query(GuestBroker).filter(GuestBroker.id == guest_salesman_id).first()
        if not guest:
            raise ResourceNotFoundException("GuestBroker", guest_salesman_id)
        # Verify the guest broker belongs to this dealer
        dealer_id = current_user.id if current_user.user_type in ("dealer", "admin") else current_user.parent_dealer_id
        if guest.dealer_id != dealer_id:
            raise AuthorizationException("This guest broker is not part of your team")
        listing.guest_salesman_id = guest_salesman_id
        listing.assigned_salesman_id = None  # clear account-based assignment
        db.commit()
        return {
            "success": True,
            "assigned_to": {
                "id": guest.id,
                "name": f"{guest.first_name} {guest.last_name}".strip(),
                "email": guest.email,
                "is_guest": True,
            }
        }

    if not salesman_id:
        listing.assigned_salesman_id = None
        listing.guest_salesman_id = None
        db.commit()
        return {"success": True, "message": "Salesman unassigned"}
    
    # Verify the salesman is a team member
    salesman = db.query(User).filter(User.id == salesman_id).first()
    if not salesman:
        raise ResourceNotFoundException("Salesman", salesman_id)
    
    # Verify the salesman belongs to this dealer
    if salesman.parent_dealer_id != current_user.id and salesman.id != current_user.id:
        raise AuthorizationException("This salesman is not part of your team")
    
    listing.assigned_salesman_id = salesman_id
    listing.guest_salesman_id = None  # clear guest assignment
    db.commit()
    
    return {
        "success": True,
        "assigned_to": {
            "id": salesman.id,
            "name": f"{salesman.first_name} {salesman.last_name}",
            "email": salesman.email
        }
    }


@router.patch("/listings/{listing_id}/assign-salesman")
def assign_salesman_to_listing_patch(
    listing_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """PATCH alias for listing salesman assignment used by older dashboards."""
    return assign_salesman_to_listing(
        listing_id=listing_id,
        data=data,
        current_user=current_user,
        db=db,
    )


@router.get("/listings/{listing_id}/available-salesmen")
def get_available_salesmen(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of team members that can be assigned to a listing.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Get all team members for this dealer
    team_members = db.query(User).filter(
        User.parent_dealer_id == current_user.id,
        User.active == True
    ).all()
    
    # Include the dealer themselves
    salesmen = [
        {
            "id": current_user.id,
            "name": f"{current_user.first_name} {current_user.last_name}" if current_user.first_name else current_user.email,
            "email": current_user.email,
            "title": current_user.title,
            "is_dealer": True
        }
    ]
    
    # Add team members
    for member in team_members:
        salesmen.append({
            "id": member.id,
            "name": f"{member.first_name} {member.last_name}" if member.first_name else member.email,
            "email": member.email,
            "title": member.title,
            "is_dealer": False
        })
    
    return salesmen


# ===========================
# SALESMAN PROFILE
# ===========================

@router.get("/salesman-profile")
def get_salesman_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's salesman profile."""
    social_links = getattr(current_user, 'social_links', None) or {}
    return {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "photo_url": current_user.profile_photo_url,
        "title": current_user.title,
        "bio": current_user.bio,
        "user_type": current_user.user_type,
        "parent_dealer_id": current_user.parent_dealer_id,
        "public_profile": current_user.public_profile or False,
        "instagram_url": social_links.get("instagram_url", ""),
        "linkedin_url": social_links.get("linkedin_url", ""),
        "facebook_url": social_links.get("facebook_url", ""),
        "website": social_links.get("website", ""),
    }


@router.put("/salesman-profile")
def update_salesman_profile(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update salesman profile information."""
    
    # Update fields
    if "first_name" in data:
        current_user.first_name = data["first_name"]
    if "last_name" in data:
        current_user.last_name = data["last_name"]
    if "email" in data:
        # Check if email is already taken
        existing = db.query(User).filter(
            User.email == data["email"],
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = data["email"]
    if "phone" in data:
        current_user.phone = data["phone"]
    if "photo_url" in data:
        current_user.profile_photo_url = data["photo_url"]
    if "title" in data:
        current_user.title = data["title"]
    if "bio" in data:
        current_user.bio = data["bio"]
    if "public_profile" in data:
        current_user.public_profile = bool(data["public_profile"])
    # Social links stored in JSON column
    social_keys = ("instagram_url", "linkedin_url", "facebook_url", "website")
    if any(k in data for k in social_keys):
        existing = dict(getattr(current_user, 'social_links', None) or {})
        for k in social_keys:
            if k in data:
                existing[k] = data[k] or ""
        current_user.social_links = existing
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "success": True,
        "profile": {
            "id": current_user.id,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "email": current_user.email,
            "phone": current_user.phone,
            "photo_url": current_user.profile_photo_url,
            "title": current_user.title,
            "bio": current_user.bio
        }
    }


# ===========================
# PUBLIC SALESMAN PROFILE
# ===========================

@router.get("/salesmen/{user_id}")
def get_public_salesman_profile(user_id: int, db: Session = Depends(get_db)):
    """Public salesman profile — no auth required."""
    salesman = db.query(User).filter(
        User.id == user_id,
        User.active == True,
        User.deleted_at == None,
    ).first()
    # Allow team members always; allow dealers only if they opted in to a public profile
    if not salesman:
        raise HTTPException(status_code=404, detail="Salesman not found")
    if salesman.user_type not in ("team_member",) and not (
        salesman.user_type == "dealer" and salesman.public_profile
    ):
        raise HTTPException(status_code=404, detail="Salesman not found")

    # Fetch parent dealer info — if the salesman IS the dealer, use their own profile
    dealer_info = None
    dealer_id = salesman.parent_dealer_id if salesman.parent_dealer_id else (salesman.id if salesman.user_type == "dealer" else None)
    if dealer_id:
        dealer = db.query(User).filter(User.id == dealer_id).first()
        dealer_profile = (
            db.query(DealerProfile).filter(DealerProfile.user_id == dealer.id).first()
            if dealer else None
        )
        if dealer:
            dealer_info = {
                "id": dealer.id,
                "name": (dealer_profile.company_name if dealer_profile else None) or dealer.company_name or f"{dealer.first_name or ''} {dealer.last_name or ''}".strip(),
                "slug": dealer_profile.slug if dealer_profile else None,
                "logo_url": dealer_profile.logo_url if dealer_profile else None,
            }

    # Fetch active listings owned by this salesman
    listings = (
        db.query(Listing)
        .filter(Listing.user_id == salesman.id, Listing.status == "active")
        .order_by(Listing.created_at.desc())
        .limit(24)
        .all()
    )

    social_links = getattr(salesman, 'social_links', None) or {}

    return {
        "salesman": {
            "id": salesman.id,
            "name": f"{salesman.first_name or ''} {salesman.last_name or ''}".strip() or salesman.email,
            "title": salesman.title or "Sales Representative",
            "bio": salesman.bio,
            "email": salesman.email,
            "phone": salesman.phone,
            "photo_url": salesman.profile_photo_url,
            "instagram_url": social_links.get("instagram_url", ""),
            "linkedin_url": social_links.get("linkedin_url", ""),
            "facebook_url": social_links.get("facebook_url", ""),
            "website": social_links.get("website", ""),
            "dealer": dealer_info,
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
                "status": l.status,
                "images": [{"url": img.url} for img in l.images[:1]] if l.images else [],
            }
            for l in listings
        ],
    }


# ===========================
# DEALER PROFILE
# ===========================

@router.get("/dealer-profile")
def get_dealer_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's dealer profile."""
    
    if current_user.user_type != "dealer":
        raise AuthorizationException("Only dealers can access dealer profiles")
    
    profile = db.query(DealerProfile).filter(
        DealerProfile.user_id == current_user.id
    ).first()
    
    if not profile:
        # Create a basic profile if it doesn't exist
        profile = DealerProfile(
            user_id=current_user.id,
            name=f"{current_user.first_name} {current_user.last_name}" if current_user.first_name else "",
            company_name=current_user.company_name or "",
            email=current_user.email,
            phone=current_user.phone,
            slug=f"dealer-{current_user.id}",  # Generate a basic slug
            country="USA"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "slug": profile.slug,
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
        "cobrokering_enabled": profile.cobrokering_enabled if profile.cobrokering_enabled is not None else True,
        "show_team_on_profile": profile.show_team_on_profile or False,
    }


@router.put("/dealer-profile")
def update_dealer_profile(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update dealer profile information."""
    
    if current_user.user_type != "dealer":
        raise AuthorizationException("Only dealers can update dealer profiles")
    
    profile = db.query(DealerProfile).filter(
        DealerProfile.user_id == current_user.id
    ).first()
    
    if not profile:
        # Create new profile
        profile = DealerProfile(
            user_id=current_user.id,
            slug=data.get("slug") or f"dealer-{current_user.id}"
        )
        db.add(profile)
    
    # Update fields
    if "name" in data:
        profile.name = data["name"]
    if "company_name" in data:
        profile.company_name = data["company_name"]
        # Also update user's company_name
        current_user.company_name = data["company_name"]
    if "email" in data:
        profile.email = data["email"]
    if "phone" in data:
        profile.phone = data["phone"]
    if "address" in data:
        profile.address = data["address"]
    if "city" in data:
        profile.city = data["city"]
    if "state" in data:
        profile.state = data["state"]
    if "country" in data:
        profile.country = data["country"]
    if "zip_code" in data:
        profile.zip_code = data["zip_code"]
    if "website" in data:
        profile.website = data["website"]
    if "description" in data:
        profile.description = data["description"]
    if "logo_url" in data:
        profile.logo_url = data["logo_url"]
    if "banner_url" in data:
        profile.banner_url = data["banner_url"]
    if "facebook_url" in data:
        profile.facebook_url = data["facebook_url"]
    if "instagram_url" in data:
        profile.instagram_url = data["instagram_url"]
    if "twitter_url" in data:
        profile.twitter_url = data["twitter_url"]
    if "linkedin_url" in data:
        profile.linkedin_url = data["linkedin_url"]
    if "cobrokering_enabled" in data:
        profile.cobrokering_enabled = bool(data["cobrokering_enabled"])
    if "show_team_on_profile" in data:
        profile.show_team_on_profile = bool(data["show_team_on_profile"])

    db.commit()
    db.refresh(profile)
    
    return {
        "success": True,
        "message": "Dealer profile updated successfully"
    }


# ===========================
# GOOGLE MAPS API KEY
# ===========================

@router.get("/config/maps-api-key")
def get_maps_api_key():
    """
    Get Google Maps API key from environment.
    This keeps the API key secure on the backend.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Google Maps API key not configured"
        )
    
    return {"api_key": api_key}