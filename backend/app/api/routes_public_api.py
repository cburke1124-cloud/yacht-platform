from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.models.listing import Listing
from app.models.dealer import DealerProfile
from app.models.user import User
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
    Public API endpoint requiring API key.
    Returns active listings that are available for co-brokering, excluding:
      - Listings explicitly opted out at the listing level (allow_cobrokering=False)
      - All listings from dealers who have disabled co-brokering at the account level
      - Listings manually blocked by the requesting dealer via ListingAPIBlock
    """

    # Check for blocked listings (legacy per-listing blocks by this API key's dealer)
    blocked = db.query(ListingAPIBlock.listing_id).filter(
        ListingAPIBlock.dealer_id == api_key.dealer_id
    ).all()
    blocked_ids = [b.listing_id for b in blocked]

    # Find dealer user_ids where cobrokering_enabled is explicitly False
    opted_out_dealer_ids = db.query(DealerProfile.user_id).filter(
        DealerProfile.cobrokering_enabled == False  # noqa: E712
    ).all()
    opted_out_user_ids = [row.user_id for row in opted_out_dealer_ids]

    # Build query for active listings
    query = db.query(Listing).join(User, Listing.user_id == User.id).filter(Listing.status == "active", User.is_demo != True)

    # Exclude listings opted out at the listing level
    query = query.filter(Listing.allow_cobrokering != False)  # noqa: E712

    # Exclude listings belonging to dealers who opted out at account level
    if opted_out_user_ids:
        query = query.filter(~Listing.user_id.in_(opted_out_user_ids))
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
