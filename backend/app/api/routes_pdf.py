from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.listing import Listing
from app.models.user import User
from app.models.dealer import DealerProfile
from app.exceptions import ResourceNotFoundException
from app.services.pdf_generator import generate_listing_pdf

router = APIRouter()


@router.get("/listings/{listing_id}/pdf")
def export_listing_pdf(
    listing_id: int,
    db: Session = Depends(get_db)
):
    """Generate and download PDF brochure for listing."""
    # Get listing
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Get dealer info
    dealer = db.query(User).filter(User.id == listing.user_id).first()
    dealer_profile = db.query(DealerProfile).filter(
        DealerProfile.user_id == listing.user_id
    ).first()
    
    dealer_info = {
        'name': f"{dealer.first_name} {dealer.last_name}" if dealer else 'Unknown',
        'company_name': dealer.company_name if dealer else None,
        'email': dealer.email if dealer else None,
        'phone': dealer.phone if dealer else None,
    }
    
    # Get image URLs
    image_urls = [img.url for img in listing.images[:6]]  # Max 6 images
    
    # Generate PDF
    try:
        pdf_data = generate_listing_pdf(listing, dealer_info, image_urls)
        
        # Return PDF as download
        filename = f"yacht-{listing.id}-{listing.make}-{listing.model}.pdf".replace(' ', '-')
        
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        print(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate PDF")
