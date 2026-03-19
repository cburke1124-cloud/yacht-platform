from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import requests

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.listing import Listing
from app.models.misc import CurrencyRate
from app.exceptions import (
    ValidationException,
    AuthorizationException,
    ResourceNotFoundException,
    ExternalServiceException
)
from app.services.permissions import has_permission, Permission

router = APIRouter()


# ============= BULK ACTIONS =============

@router.post("/listings/bulk-delete")
def bulk_delete_listings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete multiple listings at once."""
    listing_ids = data.get("ids") or data.get("listing_ids") or []
    permanent = data.get("permanent", False)
    
    if not listing_ids:
        raise ValidationException("No listing IDs provided")
    
    # Get listings and verify ownership
    listings = db.query(Listing).filter(Listing.id.in_(listing_ids)).all()
    
    for listing in listings:
        # Check authorization
        if listing.user_id != current_user.id:
            if not has_permission(current_user, Permission.DELETE_ANY_LISTING):
                raise AuthorizationException(f"Not authorized to delete listing {listing.id}")
    
    if permanent:
        for listing in listings:
            db.delete(listing)
    else:
        for listing in listings:
            listing.status = "archived"
            listing.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "deleted_count": len(listings),
        "message": f"{'Permanently deleted' if permanent else 'Archived'} {len(listings)} listings"
    }


@router.put("/listings/bulk-status")
def bulk_update_listing_status(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update status for multiple listings."""
    listing_ids = data.get("ids") or data.get("listing_ids") or []
    new_status = data.get("status")
    
    if not listing_ids:
        raise ValidationException("No listing IDs provided")
    
    if not new_status:
        raise ValidationException("Status is required")
    
    valid_statuses = ["active", "draft", "pending", "sold", "archived"]
    if new_status not in valid_statuses:
        raise ValidationException(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    # Get listings and verify ownership
    listings = db.query(Listing).filter(Listing.id.in_(listing_ids)).all()
    
    for listing in listings:
        # Check authorization
        if listing.user_id != current_user.id:
            if not has_permission(current_user, Permission.EDIT_ANY_LISTING):
                raise AuthorizationException(f"Not authorized to edit listing {listing.id}")
        
        listing.status = new_status
        listing.updated_at = datetime.utcnow()
        
        # Set published_at if activating
        if new_status == "active" and not listing.published_at:
            listing.published_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "updated_count": len(listings),
        "message": f"Updated {len(listings)} listings to '{new_status}'"
    }


@router.post("/listings/bulk-update-status")
def bulk_update_listing_status_legacy(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Legacy alias for bulk status updates used by older dashboards."""
    return bulk_update_listing_status(data=data, current_user=current_user, db=db)


@router.put("/listings/bulk-feature")
def bulk_feature_listings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Feature multiple listings (requires payment for each)."""
    listing_ids = data.get("ids", [])
    plan = data.get("plan", "7day")
    
    if not listing_ids:
        raise ValidationException("No listing IDs provided")
    
    # This would normally integrate with your payment system
    # For now, just return info about what would be charged
    
    from app.constants import FEATURED_PLANS
    
    if plan not in FEATURED_PLANS:
        raise ValidationException("Invalid plan")
    
    plan_details = FEATURED_PLANS[plan]
    total_cost = plan_details["price"] * len(listing_ids)
    
    return {
        "success": False,
        "requires_payment": True,
        "listing_count": len(listing_ids),
        "plan": plan,
        "cost_per_listing": plan_details["price"],
        "total_cost": total_cost,
        "message": f"Featuring {len(listing_ids)} listings would cost ${total_cost}. Please process payment to continue."
    }


@router.put("/listings/bulk-archive")
def bulk_archive_listings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Archive multiple listings."""
    listing_ids = data.get("ids", [])
    
    if not listing_ids:
        raise ValidationException("No listing IDs provided")
    
    listings = db.query(Listing).filter(Listing.id.in_(listing_ids)).all()
    
    for listing in listings:
        if listing.user_id != current_user.id:
            if not has_permission(current_user, Permission.DELETE_ANY_LISTING):
                continue
        
        listing.status = "archived"
        listing.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "archived_count": len(listings),
        "message": f"Archived {len(listings)} listings"
    }


# ============= CURRENCY RATES =============

@router.get("/currencies/rates")
def get_currency_rates(db: Session = Depends(get_db)):
    """Get latest currency exchange rates."""
    # Check if we have recent rates (less than 24 hours old)
    latest = db.query(CurrencyRate).order_by(
        CurrencyRate.updated_at.desc()
    ).first()
    
    if latest and (datetime.utcnow() - latest.updated_at).total_seconds() < 86400:
        # Return cached rates
        all_rates = db.query(CurrencyRate).all()
        return {
            "base": "USD",
            "rates": {rate.target_currency: rate.rate for rate in all_rates},
            "updated_at": latest.updated_at.isoformat()
        }
    
    # Fetch new rates from API
    try:
        # Using exchangerate-api.com (free tier)
        # You can also use: openexchangerates.org, fixer.io, etc.
        response = requests.get(
            "https://api.exchangerate-api.com/v4/latest/USD",
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            rates = data.get("rates", {})
            
            # Update database
            for currency_code, rate in rates.items():
                existing = db.query(CurrencyRate).filter(
                    CurrencyRate.target_currency == currency_code
                ).first()
                
                if existing:
                    existing.rate = rate
                    existing.updated_at = datetime.utcnow()
                else:
                    new_rate = CurrencyRate(
                        target_currency=currency_code,
                        rate=rate
                    )
                    db.add(new_rate)
            
            db.commit()
            
            return {
                "base": "USD",
                "rates": rates,
                "updated_at": datetime.utcnow().isoformat()
            }
        else:
            raise ExternalServiceException("Failed to fetch exchange rates")
            
    except requests.RequestException as e:
        # If API fails, return cached rates or defaults
        all_rates = db.query(CurrencyRate).all()
        if all_rates:
            return {
                "base": "USD",
                "rates": {rate.target_currency: rate.rate for rate in all_rates},
                "updated_at": all_rates[0].updated_at.isoformat() if all_rates else None,
                "warning": "Using cached rates due to API error"
            }
        
        # Return default rates as fallback
        return {
            "base": "USD",
            "rates": {
                "EUR": 0.92,
                "GBP": 0.79,
                "CAD": 1.36,
                "AUD": 1.52,
                "JPY": 149.50,
                "CNY": 7.24,
                "CHF": 0.88,
                "SEK": 10.35,
                "NZD": 1.63,
                "MXN": 17.08,
                "SGD": 1.34,
                "HKD": 7.83,
                "NOK": 10.67,
                "KRW": 1315.50,
                "TRY": 32.15,
                "INR": 83.12,
                "BRL": 4.97,
                "ZAR": 18.23
            },
            "updated_at": datetime.utcnow().isoformat(),
            "warning": "Using default rates"
        }


@router.get("/currencies/convert")
def convert_currency(
    amount: float,
    from_currency: str = "USD",
    to_currency: str = "EUR",
    db: Session = Depends(get_db)
):
    """Convert an amount from one currency to another."""
    if from_currency == to_currency:
        return {
            "amount": amount,
            "from_currency": from_currency,
            "to_currency": to_currency,
            "converted_amount": amount,
            "rate": 1.0
        }
    
    # Get rates
    from_rate = 1.0
    to_rate = 1.0
    
    if from_currency != "USD":
        rate_obj = db.query(CurrencyRate).filter(
            CurrencyRate.target_currency == from_currency
        ).first()
        if rate_obj:
            from_rate = rate_obj.rate
    
    if to_currency != "USD":
        rate_obj = db.query(CurrencyRate).filter(
            CurrencyRate.target_currency == to_currency
        ).first()
        if rate_obj:
            to_rate = rate_obj.rate
    
    # Convert to USD first, then to target currency
    usd_amount = amount / from_rate
    converted_amount = usd_amount * to_rate
    
    return {
        "amount": amount,
        "from_currency": from_currency,
        "to_currency": to_currency,
        "converted_amount": round(converted_amount, 2),
        "rate": to_rate / from_rate
    }


# ============= SAVED SEARCHES & PRICE ALERTS =============

@router.get("/saved-listings")
def get_saved_listings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's saved listings."""
    from app.models.listing import SavedListing
    
    saved = db.query(SavedListing).filter(
        SavedListing.user_id == current_user.id
    ).all()
    
    return [
        {
            "id": s.id,
            "listing_id": s.listing_id,
            "notes": s.notes,
            "created_at": s.created_at.isoformat(),
            "listing": {
                "id": s.listing.id,
                "title": s.listing.title,
                "price": s.listing.price,
                "year": s.listing.year,
                "length_feet": s.listing.length_feet,
                "city": s.listing.city,
                "state": s.listing.state,
                "images": [img.url for img in s.listing.images[:1]]
            } if s.listing else None
        }
        for s in saved
    ]


@router.post("/saved-listings")
def save_listing(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a listing for the current user."""
    from app.models.listing import SavedListing

    listing_id = data.get("listing_id")
    if not listing_id:
        raise ValidationException("Missing required field: listing_id")

    # Verify listing exists
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    # Idempotent: return existing if already saved
    existing = db.query(SavedListing).filter(
        SavedListing.user_id == current_user.id,
        SavedListing.listing_id == listing_id
    ).first()
    if existing:
        return {"success": True, "saved_id": existing.id, "already_saved": True}

    saved = SavedListing(
        user_id=current_user.id,
        listing_id=listing_id,
        notes=data.get("notes"),
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)

    return {"success": True, "saved_id": saved.id}


@router.delete("/saved-listings/{saved_id}")
def remove_saved_listing(
    saved_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a saved listing."""
    from app.models.listing import SavedListing
    
    saved = db.query(SavedListing).filter(
        SavedListing.id == saved_id,
        SavedListing.user_id == current_user.id
    ).first()
    
    if not saved:
        raise ResourceNotFoundException("Saved listing", saved_id)
    
    db.delete(saved)
    db.commit()
    
    return {"success": True}


@router.get("/price-alerts")
def get_price_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's price alerts."""
    from app.models.listing import PriceAlert
    
    alerts = db.query(PriceAlert).filter(
        PriceAlert.user_id == current_user.id
    ).all()
    
    return [
        {
            "id": a.id,
            "listing_id": a.listing_id,
            "target_price": a.target_price,
            "original_price": a.original_price,
            "triggered": a.triggered,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
            "active": a.active,
            "created_at": a.created_at.isoformat(),
            "listing": {
                "title": a.listing.title,
                "price": a.listing.price
            } if a.listing else None
        }
        for a in alerts
    ]


@router.post("/price-alerts")
def create_price_alert(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a price alert."""
    from app.models.listing import PriceAlert
    
    required = ["listing_id", "target_price"]
    for field in required:
        if field not in data:
            raise ValidationException(f"Missing required field: {field}")
    
    # Verify listing exists
    listing = db.query(Listing).filter(Listing.id == data["listing_id"]).first()
    if not listing:
        raise ResourceNotFoundException("Listing", data["listing_id"])
    
    alert = PriceAlert(
        user_id=current_user.id,
        listing_id=data["listing_id"],
        target_price=data["target_price"],
        original_price=data.get("original_price", listing.price),
        active=True
    )
    
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    return {"success": True, "alert_id": alert.id}


@router.delete("/price-alerts/{alert_id}")
def delete_price_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a price alert."""
    from app.models.listing import PriceAlert
    
    alert = db.query(PriceAlert).filter(
        PriceAlert.id == alert_id,
        PriceAlert.user_id == current_user.id
    ).first()
    
    if not alert:
        raise ResourceNotFoundException("Price alert", alert_id)
    
    db.delete(alert)
    db.commit()
    
    return {"success": True}


@router.get("/search-alerts")
def get_search_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's saved search alerts."""
    from app.models.listing import SearchAlert
    
    alerts = db.query(SearchAlert).filter(
        SearchAlert.user_id == current_user.id
    ).all()
    
    return [
        {
            "id": a.id,
            "name": a.name,
            "search_criteria": a.search_criteria,
            "frequency": a.frequency,
            "last_sent": a.last_sent.isoformat() if a.last_sent else None,
            "active": a.active,
            "created_at": a.created_at.isoformat()
        }
        for a in alerts
    ]


@router.post("/search-alerts")
def create_search_alert(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a saved search alert."""
    from app.models.listing import SearchAlert

    name = data.get("name") or "My Search Alert"
    # Frontend sends { name, filters }, store filters as search_criteria
    search_criteria = data.get("filters") or data.get("search_criteria") or {}
    frequency = data.get("frequency", "daily")

    alert = SearchAlert(
        user_id=current_user.id,
        name=name,
        search_criteria=search_criteria,
        frequency=frequency,
        active=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {"success": True, "alert_id": alert.id}


@router.patch("/search-alerts/{alert_id}")
def update_search_alert(
    alert_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update (e.g. toggle active) a search alert."""
    from app.models.listing import SearchAlert

    alert = db.query(SearchAlert).filter(
        SearchAlert.id == alert_id,
        SearchAlert.user_id == current_user.id
    ).first()

    if not alert:
        raise ResourceNotFoundException("Search alert", alert_id)

    if "active" in data:
        alert.active = data["active"]
    if "frequency" in data:
        alert.frequency = data["frequency"]

    db.commit()
    return {"success": True}


@router.delete("/search-alerts/{alert_id}")
def delete_search_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a search alert."""
    from app.models.listing import SearchAlert
    
    alert = db.query(SearchAlert).filter(
        SearchAlert.id == alert_id,
        SearchAlert.user_id == current_user.id
    ).first()
    
    if not alert:
        raise ResourceNotFoundException("Search alert", alert_id)
    
    db.delete(alert)
    db.commit()
    
    return {"success": True}
