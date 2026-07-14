from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.misc import Comparison, ComparisonItem
from app.models.listing import Listing
from app.models.charter import CharterListing
from app.exceptions import ResourceNotFoundException


router = APIRouter()

@router.post("/comparisons")
def create_comparison(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new comparison."""
    comparison = Comparison(
        user_id=current_user.id,
        name=data.get("name", "My Comparison")
    )
    db.add(comparison)
    db.commit()
    db.refresh(comparison)
    return {"id": comparison.id, "name": comparison.name}

@router.post("/comparisons/{comparison_id}/add/{listing_id}")
def add_to_comparison(
    comparison_id: int,
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a for-sale listing to a comparison."""
    # Verify comparison belongs to user
    comparison = db.query(Comparison).filter(
        Comparison.id == comparison_id,
        Comparison.user_id == current_user.id
    ).first()

    if not comparison:
        raise ResourceNotFoundException("Comparison", comparison_id)

    # Check if already added
    exists = db.query(ComparisonItem).filter(
        ComparisonItem.comparison_id == comparison_id,
        ComparisonItem.listing_id == listing_id
    ).first()

    if exists:
        return {"message": "Already in comparison"}

    # Add item
    item = ComparisonItem(
        comparison_id=comparison_id,
        listing_id=listing_id
    )
    db.add(item)
    db.commit()

    return {"success": True}


@router.post("/comparisons/{comparison_id}/add-charter/{charter_id}")
def add_charter_to_comparison(
    comparison_id: int,
    charter_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a charter listing to a comparison."""
    comparison = db.query(Comparison).filter(
        Comparison.id == comparison_id,
        Comparison.user_id == current_user.id
    ).first()

    if not comparison:
        raise ResourceNotFoundException("Comparison", comparison_id)

    exists = db.query(ComparisonItem).filter(
        ComparisonItem.comparison_id == comparison_id,
        ComparisonItem.charter_id == charter_id
    ).first()

    if exists:
        return {"message": "Already in comparison"}

    item = ComparisonItem(
        comparison_id=comparison_id,
        charter_id=charter_id
    )
    db.add(item)
    db.commit()

    return {"success": True}


def _serialize_listing_summary(listing: Listing) -> dict:
    return {
        "id": listing.id,
        "item_type": "listing",
        "title": listing.title,
        "images": [img.url for img in listing.images[:1]],
    }


def _serialize_charter_summary(charter: CharterListing) -> dict:
    return {
        "id": charter.id,
        "item_type": "charter",
        "title": charter.title,
        "images": (charter.images or [])[:1],
    }


@router.get("/comparisons")
def list_comparisons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all comparisons for the current user — mixes for-sale and charter items."""
    comparisons = db.query(Comparison).filter(
        Comparison.user_id == current_user.id
    ).order_by(Comparison.created_at.desc()).all()

    result = []
    for comp in comparisons:
        listing_items = db.query(ComparisonItem, Listing).join(
            Listing, ComparisonItem.listing_id == Listing.id
        ).filter(ComparisonItem.comparison_id == comp.id).all()
        charter_items = db.query(ComparisonItem, CharterListing).join(
            CharterListing, ComparisonItem.charter_id == CharterListing.id
        ).filter(ComparisonItem.comparison_id == comp.id).all()

        listings = [_serialize_listing_summary(listing) for _, listing in listing_items]
        listings += [_serialize_charter_summary(charter) for _, charter in charter_items]

        result.append({
            "id": comp.id,
            "name": comp.name,
            "created_at": comp.created_at.isoformat(),
            "listings": listings,
        })

    return result


@router.get("/comparisons/{comparison_id}")
def get_comparison(
    comparison_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comparison with all items — for-sale and charter listings side by side."""
    comparison = db.query(Comparison).filter(
        Comparison.id == comparison_id,
        Comparison.user_id == current_user.id
    ).first()

    if not comparison:
        raise ResourceNotFoundException("Comparison", comparison_id)

    listing_items = db.query(ComparisonItem, Listing).join(
        Listing, ComparisonItem.listing_id == Listing.id
    ).filter(
        ComparisonItem.comparison_id == comparison_id
    ).all()

    listings = []
    for item, listing in listing_items:
        listings.append({
            "id": listing.id,
            "item_type": "listing",
            "title": listing.title,
            "price": listing.price,
            "currency": listing.currency,
            "year": listing.year,
            "make": listing.make,
            "model": listing.model,
            "length_feet": listing.length_feet,
            "beam_feet": listing.beam_feet,
            "draft_feet": listing.draft_feet,
            "cabins": listing.cabins,
            "berths": listing.berths,
            "engine_hours": listing.engine_hours,
            "fuel_type": listing.fuel_type,
            "condition": listing.condition,
            "city": listing.city,
            "state": listing.state,
            "images": [img.url for img in listing.images[:1]]
        })

    charter_items = db.query(ComparisonItem, CharterListing).join(
        CharterListing, ComparisonItem.charter_id == CharterListing.id
    ).filter(
        ComparisonItem.comparison_id == comparison_id
    ).all()

    for item, charter in charter_items:
        listings.append({
            "id": charter.id,
            "item_type": "charter",
            "title": charter.title,
            "price": charter.week_rate or charter.day_rate,
            "currency": charter.currency,
            "year": charter.year,
            "make": charter.make,
            "model": charter.model,
            "length_feet": charter.length_feet,
            "beam_feet": charter.beam_feet,
            "draft_feet": charter.draft_feet,
            "cabins": charter.cabins,
            "berths": charter.berths,
            "max_guests": charter.max_guests,
            "fuel_type": charter.fuel_type,
            "condition": None,
            "city": charter.home_port_city,
            "state": charter.home_port_state,
            "images": (charter.images or [])[:1],
        })

    return {
        "id": comparison.id,
        "name": comparison.name,
        "listings": listings,
        "created_at": comparison.created_at.isoformat()
    }


@router.delete("/comparisons/{comparison_id}")
def delete_comparison(
    comparison_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a comparison."""
    comparison = db.query(Comparison).filter(
        Comparison.id == comparison_id,
        Comparison.user_id == current_user.id
    ).first()

    if not comparison:
        raise ResourceNotFoundException("Comparison", comparison_id)

    # Delete all items first
    db.query(ComparisonItem).filter(
        ComparisonItem.comparison_id == comparison_id
    ).delete()

    db.delete(comparison)
    db.commit()

    return {"success": True}
