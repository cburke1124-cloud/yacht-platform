from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base


class WordPressSite(Base):
    """WordPress site managed by YachtVersal Sites"""
    __tablename__ = "wordpress_sites"
    
    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Site Information
    domain = Column(String(255), unique=True, nullable=False, index=True)
    site_name = Column(String(255))
    
    # Hosting Information
    hosting_provider = Column(String(100))  # cloudways, wp_engine, self_hosted
    hosting_app_id = Column(String(255))
    server_ip = Column(String(50))
    
    # Theme & Design
    theme_name = Column(String(100), default="luxury-modern")
    theme_version = Column(String(20))
    primary_color = Column(String(7))
    secondary_color = Column(String(7))
    logo_url = Column(String(500))
    
    # WordPress Credentials (encrypted in production)
    wp_admin_url = Column(String(500))
    wp_admin_username = Column(String(100))
    wp_admin_password_encrypted = Column(Text)
    
    # API Connection
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    wp_rest_api_url = Column(String(500))
    
    # Status & Health
    status = Column(String(50), default="provisioning")  # provisioning, active, suspended, cancelled, failed
    last_sync = Column(DateTime)
    last_health_check = Column(DateTime)
    health_status = Column(String(50))  # healthy, degraded, down
    
    # Subscription
    subscription_tier = Column(String(50), default="essential")  # essential, professional
    subscription_status = Column(String(50), default="active")  # active, cancelled, past_due
    billing_cycle = Column(String(20), default="monthly")  # monthly, annual
    monthly_price = Column(Integer, default=19900)  # in cents
    
    # Features
    features_enabled = Column(JSON)
    
    # Stats
    listings_count = Column(Integer, default=0)
    pages_count = Column(Integer, default=0)
    team_members_count = Column(Integer, default=0)
    monthly_visitors = Column(Integer, default=0)
    monthly_leads = Column(Integer, default=0)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    provisioned_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    admin_notes = Column(Text)
    
    # Relationships
    dealer = relationship("User", back_populates="wordpress_sites")
    api_key = relationship("APIKey", back_populates="wordpress_site", uselist=False)
    sync_logs = relationship("WordPressSyncLog", back_populates="site", cascade="all, delete-orphan")


class WordPressSyncLog(Base):
    """Log of sync operations between YachtVersal and WordPress sites"""
    __tablename__ = "wordpress_sync_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("wordpress_sites.id"), nullable=False)
    
    # Sync Information
    sync_type = Column(String(50))  # full, incremental, manual
    direction = Column(String(20))  # to_wordpress, from_wordpress, bidirectional
    entity_type = Column(String(50))  # listings, team_members, settings
    
    # Results
    entities_processed = Column(Integer, default=0)
    entities_created = Column(Integer, default=0)
    entities_updated = Column(Integer, default=0)
    entities_deleted = Column(Integer, default=0)
    entities_failed = Column(Integer, default=0)
    
    # Status
    status = Column(String(50))  # started, completed, failed, partial
    error_message = Column(Text)
    
    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)
    
    # Details
    details = Column(JSON)
    
    # Relationships
    site = relationship("WordPressSite", back_populates="sync_logs")


# ============================================
# UPDATE EXISTING MODELS - Add these to existing files
# ============================================

# app/models/user.py - ADD this relationship to User model:
"""
class User(Base):
    # ... existing fields ...
    
    # ADD this relationship:
    wordpress_sites = relationship("WordPressSite", back_populates="dealer")
"""


# app/models/api_keys.py - UPDATE APIKey model:
"""
class APIKey(Base):
    # ... existing fields ...
    
    # ADD these fields if they don't exist:
    key_type = Column(String(50), default="standard")  # standard, wordpress, webhook
    tier = Column(String(50), default="basic")  # free, basic, premium
    expires_at = Column(DateTime, nullable=True)
    
    # ADD this relationship:
    wordpress_site = relationship("WordPressSite", back_populates="api_key", uselist=False)
"""


# app/models/listing.py - ADD these fields to Listing model if missing:
"""
class Listing(Base):
    # ... existing fields ...
    
    # ADD these fields for WordPress integration:
    external_id = Column(String(255), index=True)  # For tracking WP-created listings
    source = Column(String, default="manual")  # manual, wordpress, yachtworld, etc.
    source_url = Column(Text)  # Already exists in your model
"""


# ============================================
# app/services/api_key_service.py
# UPDATE existing file with WordPress-specific methods
# ============================================

import secrets
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Optional
from app.models.api_keys import APIKey


def generate_wordpress_api_key(
    db: Session,
    dealer_id: int,
    site_domain: str,
    tier: str = "essential"
) -> APIKey:
    """
    Generate API key specifically for WordPress site
    
    Args:
        db: Database session
        dealer_id: Dealer user ID
        site_domain: WordPress site domain
        tier: Subscription tier (essential, professional)
    
    Returns:
        APIKey object with raw_key attribute for one-time display
    """
    # Generate random API key with WordPress prefix
    raw_key = f"yvwp_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:8]
    
    # Hash for storage
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    # Create API key
    api_key = APIKey(
        dealer_id=dealer_id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        key_type="wordpress",
        name=f"WordPress Site: {site_domain}",
        tier=tier,
        is_active=True,
        rate_limit=10000 if tier == "professional" else 1000,
        created_at=datetime.utcnow()
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    # Attach raw key for one-time display
    api_key.raw_key = raw_key
    
    return api_key


def verify_wordpress_api_key(db: Session, raw_key: str) -> Optional[APIKey]:
    """
    Verify WordPress API key
    
    Args:
        db: Database session
        raw_key: Raw API key from WordPress request
    
    Returns:
        APIKey object if valid, None otherwise
    """
    # Hash the key
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    # Look up key
    api_key = db.query(APIKey).filter(
        APIKey.key_hash == key_hash,
        APIKey.key_type == "wordpress",
        APIKey.is_active == True
    ).first()
    
    if not api_key:
        return None
    
    # Check expiration
    if api_key.expires_at and api_key.expires_at < datetime.utcnow():
        return None
    
    # Update last used
    api_key.last_used_at = datetime.utcnow()
    db.commit()
    
    return api_key


# ============================================
# app/services/wordpress_sync.py
# CREATE this new file
# ============================================

import httpx
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.models.listing import Listing
from app.models.user import User

logger = logging.getLogger(__name__)


async def sync_listings_to_wordpress(
    dealer_id: int,
    wordpress_domain: str,
    api_key: str,
    db: Session
) -> Dict[str, Any]:
    """
    Sync dealer's YachtVersal listings to their WordPress site
    
    Args:
        dealer_id: Dealer user ID
        wordpress_domain: WordPress site domain
        api_key: API key for authentication
        db: Database session
    
    Returns:
        Sync results dictionary
    """
    results = {
        "processed": 0,
        "created": 0,
        "updated": 0,
        "failed": 0,
        "total_listings": 0
    }
    
    try:
        # Get all active listings for dealer
        listings = db.query(Listing).filter(
            Listing.user_id == dealer_id,
            Listing.status == "active"
        ).all()
        
        results["total_listings"] = len(listings)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for listing in listings:
                try:
                    # Convert to WordPress format
                    wp_data = {
                        "title": listing.title,
                        "description": listing.description,
                        "price": listing.price,
                        "currency": listing.currency,
                        "year": listing.year,
                        "make": listing.make,
                        "model": listing.model,
                        "length_feet": listing.length_feet,
                        "boat_type": listing.boat_type,
                        "location": {
                            "city": listing.city,
                            "state": listing.state,
                            "country": listing.country
                        },
                        "specs": {
                            "beam_feet": listing.beam_feet,
                            "draft_feet": listing.draft_feet,
                            "cabins": listing.cabins,
                            "berths": listing.berths,
                            "engine_make": listing.engine_make,
                            "engine_model": listing.engine_model,
                            "fuel_type": listing.fuel_type
                        },
                        "images": [img.url for img in listing.images],
                        "yachtversal_id": listing.id,
                        "bin": listing.bin,
                        "status": "publish"
                    }
                    
                    # Check if exists on WordPress
                    check_url = f"https://{wordpress_domain}/wp-json/yachtversal/v1/listings/by-yv-id/{listing.id}"
                    check_response = await client.get(
                        check_url,
                        headers={"Authorization": f"Bearer {api_key}"}
                    )
                    
                    if check_response.status_code == 404:
                        # Create new
                        create_url = f"https://{wordpress_domain}/wp-json/yachtversal/v1/listings"
                        response = await client.post(
                            create_url,
                            json=wp_data,
                            headers={"Authorization": f"Bearer {api_key}"}
                        )
                        
                        if response.status_code in [200, 201]:
                            results["created"] += 1
                        else:
                            logger.error(f"Failed to create listing {listing.id}: {response.text}")
                            results["failed"] += 1
                    
                    else:
                        # Update existing
                        wp_listing = check_response.json()
                        update_url = f"https://{wordpress_domain}/wp-json/yachtversal/v1/listings/{wp_listing['id']}"
                        response = await client.put(
                            update_url,
                            json=wp_data,
                            headers={"Authorization": f"Bearer {api_key}"}
                        )
                        
                        if response.status_code == 200:
                            results["updated"] += 1
                        else:
                            logger.error(f"Failed to update listing {listing.id}: {response.text}")
                            results["failed"] += 1
                    
                    results["processed"] += 1
                    
                except Exception as e:
                    logger.error(f"Error syncing listing {listing.id}: {str(e)}")
                    results["failed"] += 1
        
        return results
        
    except Exception as e:
        logger.error(f"Sync failed: {str(e)}")
        raise


async def sync_listings_from_wordpress(
    dealer_id: int,
    wordpress_domain: str,
    api_key: str,
    db: Session
) -> Dict[str, Any]:
    """
    Sync listings FROM WordPress site back to YachtVersal
    (For listings created directly on WordPress)
    """
    results = {
        "processed": 0,
        "created": 0,
        "updated": 0,
        "skipped": 0
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get all listings from WordPress
            url = f"https://{wordpress_domain}/wp-json/yachtversal/v1/listings"
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {api_key}"}
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to fetch WordPress listings: {response.status_code}")
            
            wp_listings = response.json()
            
            for wp_listing in wp_listings:
                try:
                    # Skip if originated from YachtVersal
                    if wp_listing.get("yachtversal_id"):
                        results["skipped"] += 1
                        continue
                    
                    # Check if exists by WordPress ID
                    existing = db.query(Listing).filter(
                        Listing.user_id == dealer_id,
                        Listing.external_id == f"wp_{wp_listing['id']}"
                    ).first()
                    
                    if existing:
                        # Update existing
                        existing.title = wp_listing.get("title")
                        existing.description = wp_listing.get("description")
                        existing.price = wp_listing.get("price")
                        existing.updated_at = datetime.utcnow()
                        results["updated"] += 1
                    else:
                        # Create new listing
                        # Generate unique BIN
                        import random
                        bin_number = f"YV{random.randint(100000, 999999)}"
                        while db.query(Listing).filter(Listing.bin == bin_number).first():
                            bin_number = f"YV{random.randint(100000, 999999)}"
                        
                        new_listing = Listing(
                            user_id=dealer_id,
                            created_by_user_id=dealer_id,
                            title=wp_listing.get("title"),
                            description=wp_listing.get("description"),
                            price=wp_listing.get("price"),
                            currency=wp_listing.get("currency", "USD"),
                            year=wp_listing.get("year"),
                            make=wp_listing.get("make"),
                            model=wp_listing.get("model"),
                            length_feet=wp_listing.get("length_feet"),
                            boat_type=wp_listing.get("boat_type"),
                            city=wp_listing.get("location", {}).get("city"),
                            state=wp_listing.get("location", {}).get("state"),
                            country=wp_listing.get("location", {}).get("country", "USA"),
                            external_id=f"wp_{wp_listing['id']}",
                            source="wordpress",
                            status="active",
                            bin=bin_number,
                            published_at=datetime.utcnow()
                        )
                        db.add(new_listing)
                        results["created"] += 1
                    
                    results["processed"] += 1
                    
                except Exception as e:
                    logger.error(f"Error importing WordPress listing: {str(e)}")
            
            db.commit()
        
        return results
        
    except Exception as e:
        logger.error(f"Import from WordPress failed: {str(e)}")
        raise


# ============================================
# app/services/email_service.py
# ADD this method to your existing EmailService class
# ============================================

def send_wordpress_site_created(
    self,
    to_email: str,
    dealer_name: str,
    site_domain: str,
    api_key: str,
    wp_admin_url: str,
    wp_username: str,
    wp_password: str
):
    """Send WordPress site creation email with credentials"""
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0066cc 0%, #003d7a 100%); padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0;">🚤 Your YachtVersal Site is Ready!</h1>
            </div>
            
            <div style="padding: 40px; background: #f8fafc;">
                <h2 style="color: #0066cc;">Welcome, {dealer_name}!</h2>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Your professional yacht dealer website is now live and ready to showcase your inventory!
                </p>
                
                <div style="background: white; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="color: #0066cc; margin-top: 0;">Your Website</h3>
                    <p style="margin: 10px 0;">
                        <strong>URL:</strong> <a href="https://{site_domain}" style="color: #0066cc;">https://{site_domain}</a>
                    </p>
                </div>
                
                <div style="background: white; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="color: #0066cc; margin-top: 0;">WordPress Admin Access</h3>
                    <p style="margin: 10px 0;">
                        <strong>Admin URL:</strong> <a href="{wp_admin_url}" style="color: #0066cc;">{wp_admin_url}</a><br>
                        <strong>Username:</strong> {wp_username}<br>
                        <strong>Password:</strong> <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">{wp_password}</code>
                    </p>
                </div>
                
                <div style="background: white; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="color: #0066cc; margin-top: 0;">YachtVersal API Key</h3>
                    <p style="color: #4b5563; font-size: 14px; margin-bottom: 10px;">
                        Your inventory syncs automatically. This key is pre-configured in your site.
                    </p>
                    <code style="background: #f1f5f9; padding: 12px; display: block; font-size: 12px; word-break: break-all; border-radius: 4px; border-left: 4px solid #0066cc;">
                        {api_key}
                    </code>
                </div>
                
                <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 30px 0;">
                    <p style="margin: 0; color: #92400e;">
                        <strong>⚠️ Important:</strong> Save these credentials securely! Change your WordPress password after first login.
                    </p>
                </div>
                
                <h3 style="color: #0066cc; margin-top: 40px;">What's Next?</h3>
                <ol style="color: #4b5563; line-height: 1.8;">
                    <li>Visit your new website at <a href="https://{site_domain}">{site_domain}</a></li>
                    <li>Log in to WordPress admin to customize your branding</li>
                    <li>Your yacht inventory syncs automatically every 24 hours</li>
                    <li>Check out the YachtVersal dashboard in your admin panel</li>
                </ol>
                
                <div style="margin-top: 40px; text-align: center;">
                    <a href="https://{site_domain}/wp-admin" 
                       style="background: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; margin-right: 10px;">
                        Go to WordPress Admin
                    </a>
                    <a href="https://sites.yachtversal.com/help" 
                       style="background: white; color: #0066cc; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; border: 2px solid #0066cc;">
                        View Help Docs
                    </a>
                </div>
                
                <p style="margin-top: 40px; color: #6b7280; font-size: 14px;">
                    Need help? Reply to this email or visit our 
                    <a href="https://sites.yachtversal.com/help" style="color: #0066cc;">help center</a>.
                </p>
            </div>
            
            <div style="background: #1e293b; padding: 20px; text-align: center; color: white;">
                <p style="margin: 0; font-size: 14px;">© 2026 YachtVersal. All rights reserved.</p>
            </div>
        </body>
    </html>
    """
    
    return self.send_email(to_email, f"Your YachtVersal Website is Ready - {site_domain}", html_content)
