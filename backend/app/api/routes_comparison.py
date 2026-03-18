from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db  
from app.api.deps import get_current_user
from app.models.user import User  
from app.models.misc import Comparison, ComparisonItem  
from app.models.listing import Listing  
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
    """Add listing to comparison."""
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

@router.get("/comparisons")
def list_comparisons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all comparisons for the current user."""
    comparisons = db.query(Comparison).filter(
        Comparison.user_id == current_user.id
    ).order_by(Comparison.created_at.desc()).all()

    result = []
    for comp in comparisons:
        items = db.query(ComparisonItem, Listing).join(
            Listing, ComparisonItem.listing_id == Listing.id
        ).filter(ComparisonItem.comparison_id == comp.id).all()

        result.append({
            "id": comp.id,
            "name": comp.name,
            "created_at": comp.created_at.isoformat(),
            "listings": [
                {
                    "id": listing.id,
                    "title": listing.title,
                    "images": [img.url for img in listing.images[:1]]
                }
                for _, listing in items
            ]
        })

    return result


@router.get("/comparisons/{comparison_id}")
def get_comparison(
    comparison_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comparison with all listings."""
    comparison = db.query(Comparison).filter(
        Comparison.id == comparison_id,
        Comparison.user_id == current_user.id
    ).first()
    
    if not comparison:
        raise ResourceNotFoundException("Comparison", comparison_id)
    
    items = db.query(ComparisonItem, Listing).join(
        Listing, ComparisonItem.listing_id == Listing.id
    ).filter(
        ComparisonItem.comparison_id == comparison_id
    ).all()
    
    listings = []
    for item, listing in items:
        listings.append({
            "id": listing.id,
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
