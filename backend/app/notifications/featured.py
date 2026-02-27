async def send_expiring_notification(featured: FeaturedListing, db: Session):
    """Send email when featured listing is expiring soon."""
    
    days_remaining = (featured.expires_at - datetime.utcnow()).days
    
    if days_remaining == 7:  # 7 days before expiry
        listing = db.query(Listing).filter(Listing.id == featured.listing_id).first()
        user = db.query(User).filter(User.id == featured.user_id).first()
        
        # Send email
        send_email(
            to=user.email,
            subject="Your Featured Listing Expires in 7 Days",
            body=f"Your listing '{listing.title}' will expire on {featured.expires_at.strftime('%B %d, %Y')}. Renew now to maintain visibility!"
        )
