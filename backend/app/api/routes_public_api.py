from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.models.listing import Listing
from app.models.api_keys import APIKey, ListingAPIBlock
from app.middleware.api_auth import verify_api_key

router = APIRouter()


@router.get("/api/public/listings")
def get_listings_api(
    api_key: APIKey = Depends(verify_api_key),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    year: Optional[int] = None,
    make: Optional[str] = None
):
    """
    Public API endpoint requiring API key
    Returns active listings excluding those blocked by the dealer
    """
    
    # Check for blocked listings
    blocked = db.query(ListingAPIBlock.listing_id).filter(
        ListingAPIBlock.dealer_id == api_key.dealer_id
    ).all()
    blocked_ids = [b.listing_id for b in blocked]
    
    # Build query for active listings
    query = db.query(Listing).filter(Listing.status == "active")
    
    # Exclude blocked listings
    if blocked_ids:
        query = query.filter(~Listing.id.in_(blocked_ids))
    
    # Apply optional filters
    if min_price is not None:
        query = query.filter(Listing.price >= min_price)
    if max_price is not None:
        query = query.filter(Listing.price <= max_price)
    if year is not None:
        query = query.filter(Listing.year == year)
    if make is not None:
        query = query.filter(Listing.make.ilike(f"%{make}%"))
    
    # Apply pagination
    listings = query.offset(skip).limit(limit).all()
    
    return listings
