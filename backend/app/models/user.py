from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)  # Removed unique constraint; will be enforced at app level
    password_hash = Column(String, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    phone = Column(String)

    user_type = Column(String, default="admin")
    company_name = Column(String)
    subscription_tier = Column(String, default="free")
    custom_subscription_price = Column(Float, nullable=True)
    subscription_monthly_price = Column(Float, nullable=True)  # Actual Stripe amount (post-discount) updated on sync
    verified = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Soft delete fields for account recovery
    deleted_at = Column(DateTime, nullable=True, index=True)  # Timestamp when account was deleted
    recovery_deadline = Column(DateTime, nullable=True)  # Until when account can be recovered (60-90 days)

    parent_dealer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role = Column(String, default="owner")

    verification_token = Column(String, unique=True, nullable=True)
    email_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime, nullable=True)
    two_factor_enabled = Column(Boolean, default=False)

    trial_active = Column(Boolean, default=False)
    trial_converted = Column(Boolean, default=False)
    trial_end_date = Column(DateTime, nullable=True)

    assigned_sales_rep_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    commission_rate = Column(Float, default=10.0)
    
    # Custom subscription price for negotiated deals (e.g. Ultimate tier)
    # custom_subscription_price = Column(Float, nullable=True)

    stripe_customer_id = Column(String, unique=True, nullable=True, index=True)
    stripe_subscription_id = Column(String, unique=True, nullable=True)

    # Flag to make an account permanently free (bypass billing)
    always_free = Column(Boolean, default=False, index=True)

    permissions = Column(JSON, default={})

    public_profile = Column(Boolean, default=False)
    profile_photo_url = Column(String)
    bio = Column(String)
    title = Column(String)
    specialties = Column(JSON, default=[])
    social_links = Column(JSON, default={})

    wordpress_sites = relationship("WordPressSite", back_populates="dealer")
    
    # Demo account fields
    is_demo = Column(Boolean, default=False, index=True)  # Mark as demo account
    # demo_owner_sales_rep_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Sales rep who owns this demo

    # Relationships
    listings = relationship("Listing", back_populates="owner", foreign_keys="Listing.user_id")
    created_listings = relationship("Listing", foreign_keys="Listing.created_by_user_id")
    media_files = relationship("MediaFile", back_populates="user", foreign_keys="MediaFile.user_id")
    blog_posts = relationship("BlogPost", back_populates="author", cascade="all, delete-orphan")  
    dealer_profile = relationship("DealerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    team_members = relationship(
        "User", back_populates="parent_dealer", remote_side=[id], foreign_keys=[parent_dealer_id]
    )
    parent_dealer = relationship("User", remote_side=[id], foreign_keys=[parent_dealer_id], overlaps="team_members")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    saved_listings = relationship("SavedListing", back_populates="user", cascade="all, delete-orphan")
    price_alerts = relationship("PriceAlert", back_populates="user", cascade="all, delete-orphan")
    search_alerts = relationship("SearchAlert", back_populates="user", cascade="all, delete-orphan")
    
class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Regional Settings
    language = Column(String, default="en")
    currency = Column(String, default="USD")
    units = Column(String, default="imperial")  # imperial or metric
    timezone = Column(String, default="America/New_York")
    date_format = Column(String, default="MM/DD/YYYY")
    number_format = Column(String, default="en-US")
    
    # Email Notification Settings
    email_new_message = Column(Boolean, default=True)
    email_new_inquiry = Column(Boolean, default=True)
    email_price_alert = Column(Boolean, default=True)
    email_new_listing_match = Column(Boolean, default=True)
    email_listing_views = Column(Boolean, default=False)
    email_featured_expiring = Column(Boolean, default=True)
    email_weekly_summary = Column(Boolean, default=True)
    email_marketing = Column(Boolean, default=False)
    
    # Push Notification Settings (for future mobile app)
    push_new_message = Column(Boolean, default=True)
    push_new_inquiry = Column(Boolean, default=True)
    push_price_alert = Column(Boolean, default=True)

    # SMS Notification Settings
    sms_new_message = Column(Boolean, default=True)
    sms_new_inquiry = Column(Boolean, default=True)
    
    # In-App Notification Settings
    app_new_message = Column(Boolean, default=True)
    app_new_inquiry = Column(Boolean, default=True)
    app_price_alert = Column(Boolean, default=True)
    app_listing_views = Column(Boolean, default=True)
    
    # Notification Preferences
    notification_frequency = Column(String, default="instant")  # instant, hourly, daily
    quiet_hours_enabled = Column(Boolean, default=False)
    quiet_hours_start = Column(String, default="22:00")
    quiet_hours_end = Column(String, default="08:00")
    
    # Relationships
    user = relationship("User", back_populates="preferences")

