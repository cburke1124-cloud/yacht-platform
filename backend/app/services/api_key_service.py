import secrets
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Optional
import logging

from app.models.api_keys import APIKey
from app.constants import TIER_LIMITS

logger = logging.getLogger(__name__)


def generate_api_key_for_dealer(
    db: Session,
    dealer_id: int,
    tier: str = "free"
) -> APIKey:
    """
    Generate standard API key for new dealer account
    Called automatically during registration
    
    Args:
        db: Database session
        dealer_id: Dealer user ID
        tier: Subscription tier (free, basic, premium)
    
    Returns:
        APIKey object with raw_key attribute for one-time display
    """
    # Generate random API key
    raw_key = f"yv_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:6]
    
    # Hash for storage
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    # Get rate limit based on tier
    tier_limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])
    rate_limit = tier_limits.get("api_requests_per_day", 1000)
    
    # Create API key
    api_key = APIKey(
        dealer_id=dealer_id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        key_type="standard",
        name=f"Default API Key",
        tier=tier,
        is_active=True,
        rate_limit=rate_limit,
        created_at=datetime.utcnow()
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    # Attach raw key for one-time display
    api_key.raw_key = raw_key
    
    logger.info(f"Generated API key for dealer {dealer_id} with tier {tier}")
    
    return api_key


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
    
    logger.info(f"Generated WordPress API key for {site_domain}")
    
    return api_key


def verify_api_key(db: Session, raw_key: str) -> Optional[APIKey]:
    """
    Verify an API key and return the associated record
    
    Args:
        db: Database session
        raw_key: Raw API key to verify
    
    Returns:
        APIKey object if valid, None otherwise
    """
    # Hash the key
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    # Look up key
    api_key = db.query(APIKey).filter(
        APIKey.key_hash == key_hash,
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


def update_api_key_tier(db: Session, api_key_id: int, new_tier: str):
    """
    Update API key tier and rate limits when dealer subscription changes
    
    Args:
        db: Database session
        api_key_id: API key ID
        new_tier: New subscription tier
    """
    api_key = db.query(APIKey).filter(APIKey.id == api_key_id).first()
    
    if not api_key:
        return
    
    # Update tier
    api_key.tier = new_tier
    
    # Update rate limit based on tier
    tier_limits = TIER_LIMITS.get(new_tier, TIER_LIMITS["free"])
    api_key.rate_limit = tier_limits.get("api_requests_per_day", 1000)
    
    db.commit()
    
    logger.info(f"Updated API key {api_key_id} to tier {new_tier}")
