from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class APIKey(Base):
    """API keys for dealers to access the API"""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    key_hash = Column(String, unique=True, index=True, nullable=False)
    key_prefix = Column(String(8), nullable=False)
    name = Column(String, nullable=False)
    
    last_used_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # Only ONE expires_at
    
    is_active = Column(Boolean, default=True)
    rate_limit = Column(Integer, default=1000)

    # NEW WordPress fields
    key_type = Column(String(50), default="standard")
    tier = Column(String(50), default="basic")
    
    # Relationships
    dealer = relationship("User", foreign_keys=[dealer_id])
    wordpress_site = relationship("WordPressSite", back_populates="api_key", uselist=False)



class ListingAPIBlock(Base):
    """Block specific listings from API access"""
    __tablename__ = "listing_api_blocks"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    dealer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    reason = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    listing = relationship("Listing", foreign_keys=[listing_id])


class DealerInvitation(Base):
    """Sales rep invitations for dealers to join"""
    __tablename__ = "dealer_invitations"

    id = Column(Integer, primary_key=True, index=True)
    sales_rep_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    email = Column(String, nullable=False, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    
    company_name = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    
    status = Column(String, default="pending")  # pending, accepted, expired
    accepted_at = Column(DateTime)
    expires_at = Column(DateTime, nullable=False)
    
    # Optional promotional offer attached to invitation
    promotional_offer_id = Column(Integer, ForeignKey("promotional_offers.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    sales_rep = relationship("User", foreign_keys=[sales_rep_id])


class PromotionalOffer(Base):
    """Promotional offers for dealers (discounts, trials, etc.)"""
    __tablename__ = "promotional_offers"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    offer_type = Column(String, nullable=False)  # discount, trial, custom
    
    # Discount settings
    discount_type = Column(String)  # percentage, fixed
    discount_value = Column(Float)  # e.g., 20 (for 20% off) or 10 (for $10 off)
    
    # Trial settings
    trial_days = Column(Integer, default=0)
    trial_tier = Column(String)  # Which tier they get during trial
    
    # Timing
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=False)
    
    # Original and discounted pricing
    original_tier = Column(String)  # basic, premium
    original_price = Column(Float)
    discounted_price = Column(Float)
    
    # Status
    active = Column(Boolean, default=True)
    applied = Column(Boolean, default=False)
    applied_at = Column(DateTime)
    
    # Stripe integration
    stripe_coupon_id = Column(String)
    stripe_subscription_schedule_id = Column(String)
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    dealer = relationship("User", foreign_keys=[dealer_id])
    creator = relationship("User", foreign_keys=[created_by])


class RateLimitLog(Base):
    """Track API rate limiting"""
    __tablename__ = "rate_limit_logs"

    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    
    endpoint = Column(String, nullable=False)
    ip_address = Column(String)
    
    requests_count = Column(Integer, default=1)
    window_start = Column(DateTime, default=datetime.utcnow)
    
    blocked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
