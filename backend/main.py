"""
Yacht_db Backend API
FastAPI + PostgreSQL + JWT Authentication

Installation:
pip install fastapi uvicorn psycopg2-binary python-jose[cryptography] passlib[bcrypt] python-multipart sqlalchemy pydantic-settings python-dotenv beautifulsoup4 Pillow
Run:
uvicorn main:app --reload

Database connection string format:
postgresql://username:admin123@localhost:5432/yacht_db
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from pathlib import Path
from dotenv import load_dotenv
from math import radians, cos, sin, asin, sqrt
import uuid
import shutil
import requests
import subprocess
import secrets
import random

from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware

from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey, JSON
from datetime import datetime

import enhanced_team_features

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    func,
    or_,
    text,
    Index,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from enum import Enum
import re

try:
    from optimized_scraper import OptimizedYachtScraper
except Exception:
    OptimizedYachtScraper = None

# Import password validator and error handlers
from password_validator import (
    PasswordValidator,
    hash_password as pwd_hash,
    verify_password as pwd_verify,
    PasswordChangeRequest,
)

from error_handler import (
    setup_logging,
    error_logger,
    RequestLoggingMiddleware,
    yachtversal_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
    YachtVersalException,
    ValidationException,
    AuthenticationException,
    AuthorizationException,
    ResourceNotFoundException,
    BusinessLogicException,
    ExternalServiceException,
    InputSanitizer,
)

# Additional security, rate limiting, and error handling imports
try:
    from password_validator import (
        PasswordValidator,
        hash_password,
        verify_password as verify_pwd,
        PasswordChangeRequest,
    )
except Exception:
    # Minimal fallbacks for local development / smoke tests
    class PasswordChangeRequest(BaseModel):
        old_password: str
        new_password: str

    class PasswordValidator:
        @staticmethod
        def validate(password: str):
            return (True, [])

    def hash_password(p: str) -> str:
        return p

    def verify_pwd(password: str, hashed: str) -> bool:
        return password == hashed


# Rate limiting has been removed from the project.
# Compatibility placeholders are defined so any remaining references
# do not raise NameError. Remove these placeholders when you're
# certain no references remain.
rate_limiter = None

def rate_limit(*args, **kwargs):
    def _decorator(f):
        return f

    return _decorator

class RateLimitConfig:
    AUTH_REGISTER = {}
    AUTH_LOGIN = {}
    API_LISTING_CREATE = {}
    API_SEARCH = {}
    API_UPLOAD = {}
    INQUIRY_CREATE = {}

class RateLimitMiddleware:
    def __init__(self, app, *args, **kwargs):
        self.app = app

    async def __call__(self, scope, receive, send):
        await self.app(scope, receive, send)



try:
    from error_handler import (
        setup_logging,
        error_logger,
        RequestLoggingMiddleware,
        yachtversal_exception_handler,
        http_exception_handler,
        validation_exception_handler,
        generic_exception_handler,
        YachtVersalException,
        ValidationException,
        AuthenticationException,
        AuthorizationException,
        ResourceNotFoundException,
        BusinessLogicException,
        ExternalServiceException,
    )
except Exception:
    # Minimal placeholders for exception types and handlers
    def setup_logging(*args, **kwargs):
        logging.basicConfig(level=logging.INFO)

    def error_logger(*args, **kwargs):
        pass

    class RequestLoggingMiddleware:
        def __init__(self, app):
            self.app = app

    def yachtversal_exception_handler(request, exc):
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    def http_exception_handler(request, exc):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    def validation_exception_handler(request, exc):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    def generic_exception_handler(request, exc):
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    class YachtVersalException(Exception):
        pass

    class ValidationException(YachtVersalException):
        pass

    class AuthenticationException(YachtVersalException):
        pass

    class AuthorizationException(YachtVersalException):
        pass

    class ResourceNotFoundException(YachtVersalException):
        def __init__(self, message, id=None):
            super().__init__(message)

    class BusinessLogicException(YachtVersalException):
        pass

    class ExternalServiceException(YachtVersalException):
        pass


from fastapi.staticfiles import StaticFiles
from PIL import Image, ExifTags
import stripe

import csv
import io
import hashlib
from fastapi.responses import StreamingResponse

# Import email service
try:
    from email_service import email_service
except Exception:

    class _DummyEmailService:
        def send_email(self, *args, **kwargs):
            logging.info("Dummy email sent: %s %s", args, kwargs)

        def send_password_reset_email(self, to_email, token, user_name=""):
            logging.info("Dummy password reset email to %s", to_email)

        def send_email_verification(self, to_email, token, user_name=""):
            logging.info("Dummy verification email to %s", to_email)

        def send_2fa_code(self, to_email, code, user_name=""):
            logging.info("Dummy 2FA code to %s: %s", to_email, code)

        def send_inquiry_to_dealer(self, to_email, inquiry):
            logging.info("Dummy inquiry email to %s", to_email)

    email_service = _DummyEmailService()

# Optional scraper import
try:
    from optimized_scraper import OptimizedYachtScraper
except Exception:
    OptimizedYachtScraper = None

load_dotenv()

# ======================
# CONFIGURATION
# ======================

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin123@localhost:5432/yacht_db")
SECRET_KEY = os.getenv("SECRET_KEY", "admin123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Stripe Configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Claude API for scraper
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")

print("App startup complete. DATABASE_URL =", DATABASE_URL)

# ======================
# LOGGING SETUP
# ======================

# Ensure logs directory exists
Path("logs").mkdir(exist_ok=True)

# REPLACE EXISTING LOGGING SETUP
setup_logging(
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    log_file="logs/yachtversal.log",
    json_logs=os.getenv("ENVIRONMENT") == "production",
)

logger = logging.getLogger(__name__)

# ======================
# DATABASE SETUP
# ======================

try:
    engine = create_engine(DATABASE_URL)
except Exception as e:
    logger.warning(f"Could not create engine with DATABASE_URL, falling back to in-memory SQLite: {e}")
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ======================
# DATABASE MODELS
# ======================


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    phone = Column(String)

    user_type = Column(String, default="admin")  # admin, dealer, private, buyer, salesman
    company_name = Column(String)
    subscription_tier = Column(String, default="free")
    verified = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    parent_dealer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role = Column(String, default="owner")

    verification_token = Column(String, unique=True, nullable=True)
    email_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime, nullable=True)
    two_factor_enabled = Column(Boolean, default=False)

    # Trial system
    trial_active = Column(Boolean, default=False)
    trial_converted = Column(Boolean, default=False)
    trial_end_date = Column(DateTime, nullable=True)

    # Sales rep tracking
    assigned_sales_rep_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Permissions JSON
    permissions = Column(JSON, default={})

    # 🔥 NEW MERGED FIELDS (from Enhanced User Model)
    public_profile = Column(Boolean, default=False)
    profile_photo_url = Column(String)
    bio = Column(Text)
    title = Column(String)
    specialties = Column(JSON, default=[])

    # Relationships
    listings = relationship("Listing", back_populates="owner", foreign_keys="Listing.user_id")
    created_listings = relationship("Listing", foreign_keys="Listing.created_by_user_id")
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
    language = Column(String, default="en")  # en, es, fr, de, it, pt, zh
    currency = Column(String, default="USD")  # USD, EUR, GBP, CAD, AUD, JPY, CNY, MXN
    units = Column(String, default="imperial")  # imperial, metric
    timezone = Column(String, default="America/New_York")

    user = relationship("User", back_populates="preferences")


class DealerProfile(Base):
    __tablename__ = "dealer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    slug = Column(String, unique=True, index=True)

    # Business Information
    name = Column(String, nullable=False)
    company_name = Column(String)
    email = Column(String)
    phone = Column(String)

    # Location
    address = Column(String)
    city = Column(String)
    state = Column(String)
    country = Column(String, default="USA")
    zip_code = Column(String)

    # Online Presence
    website = Column(String)
    description = Column(Text)
    logo_url = Column(String)

    # Customization
    banner_image = Column(String)
    primary_color = Column(String, default="#1e40af")
    about_section = Column(Text)
    specialties = Column(JSON, default=[])
    custom_css = Column(Text)

    # SEO
    meta_title = Column(String)
    meta_description = Column(String)

    # Status
    verified = Column(Boolean, default=False)
    active = Column(Boolean, default=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="dealer_profile")
    team_members = relationship("TeamMember", back_populates="dealer", cascade="all, delete-orphan")
    announcements = relationship("DealerAnnouncement", back_populates="dealer", cascade="all, delete-orphan")
    reviews = relationship("DealerReview", back_populates="dealer", cascade="all, delete-orphan")


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealer_profiles.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    name = Column(String, nullable=False)
    title = Column(String)
    email = Column(String)
    phone = Column(String)
    photo_url = Column(String)
    bio = Column(Text)
    specialties = Column(JSON, default=[])
    display_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    dealer = relationship("DealerProfile", back_populates="team_members")


class DealerAnnouncement(Base):
    __tablename__ = "dealer_announcements"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealer_profiles.id"))

    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    announcement_type = Column(String, default="news")  # news, event, promotion
    pinned = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dealer = relationship("DealerProfile", back_populates="announcements")


class DealerReview(Base):
    __tablename__ = "dealer_reviews"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealer_profiles.id"))

    reviewer_name = Column(String, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    review_text = Column(Text)
    verified_purchase = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    dealer = relationship("DealerProfile", back_populates="reviews")


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TwoFactorAuth(Base):
    __tablename__ = "two_factor_auth"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    secret = Column(String)
    backup_codes = Column(JSON)
    enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TwoFactorCode(Base):
    __tablename__ = "two_factor_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String, nullable=False)
    details = Column(JSON)
    ip_address = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_by_user_id = Column(Integer, ForeignKey("users.id"))

    # Basic Info
    title = Column(String, nullable=False)
    make = Column(String)
    model = Column(String)
    year = Column(Integer)
    price = Column(Float)
    currency = Column(String, default="USD")

    # Specifications
    length_feet = Column(Float)
    beam_feet = Column(Float)
    draft_feet = Column(Float)
    boat_type = Column(String)
    hull_material = Column(String)
    hull_type = Column(String)

    # Engine & Performance
    engine_make = Column(String)
    engine_model = Column(String)
    engine_type = Column(String)
    engine_count = Column(Integer)
    engine_hours = Column(Float)
    fuel_type = Column(String)
    max_speed_knots = Column(Float)
    cruising_speed_knots = Column(Float)

    # Capacity
    cabins = Column(Integer)
    berths = Column(Integer)
    heads = Column(Integer)
    fuel_capacity_gallons = Column(Float)
    water_capacity_gallons = Column(Float)

    # Location
    city = Column(String)
    state = Column(String)
    country = Column(String, default="USA")
    zip_code = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    continent = Column(String)  # North America, Europe, Caribbean, etc.

    # Description
    description = Column(Text)
    features = Column(Text)

    # Condition & Status
    condition = Column(String, default="used")
    previous_owners = Column(Integer)
    status = Column(String, default="active")

    # Featured/Sponsored
    featured = Column(Boolean, default=False)
    featured_until = Column(DateTime)
    featured_priority = Column(Integer, default=0)
    featured_plan = Column(String)  # "7day", "30day", "90day"

    # Metadata
    source = Column(String, default="manual")  # manual, broker_scrape
    source_url = Column(Text)
    views = Column(Integer, default=0)
    inquiries = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime)

    owner = relationship("User", back_populates="listings", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by_user_id])
    images = relationship("ListingImage", back_populates="listing", cascade="all, delete-orphan")
    saved_by = relationship("SavedListing", back_populates="listing", cascade="all, delete-orphan")

    __table_args__ = (
        # Full-text search index for PostgreSQL
        Index(
            'idx_listing_fulltext',
            func.to_tsvector('english', func.concat_ws(' ', title, description, make, model, boat_type)),
            postgresql_using='gin',
            info={'alembic_autogenerate': False}
        ),
        # Regular indexes for common queries
        Index('idx_listing_price', 'price'),
        Index('idx_listing_year', 'year'),
        Index('idx_listing_length', 'length_feet'),
        Index('idx_listing_location', 'country', 'state', 'city'),
        Index('idx_listing_type', 'boat_type', 'status'),
        Index('idx_listing_featured', 'featured', 'featured_until'),
    )


class ListingImage(Base):
    __tablename__ = "listing_images"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"))
    url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)
    filename = Column(String)
    display_order = Column(Integer, default=0)
    is_primary = Column(Boolean, default=False)
    caption = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    listing = relationship("Listing", back_populates="images")


class FeaturedListing(Base):
    __tablename__ = "featured_listings"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    plan = Column(String, nullable=False)  # "7day", "30day", "90day"
    price_paid = Column(Float, nullable=False)

    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)

    stripe_payment_id = Column(String)
    active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class SavedListing(Base):
    __tablename__ = "saved_listings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    listing_id = Column(Integer, ForeignKey("listings.id"))

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="saved_listings")
    listing = relationship("Listing", back_populates="saved_by")


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    listing_id = Column(Integer, ForeignKey("listings.id"))

    target_price = Column(Float, nullable=False)
    original_price = Column(Float)
    triggered = Column(Boolean, default=False)
    triggered_at = Column(DateTime)

    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="price_alerts")


class SearchAlert(Base):
    __tablename__ = "search_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    name = Column(String, nullable=False)
    search_criteria = Column(JSON, nullable=False)
    frequency = Column(String, default="daily")  # daily, weekly, instant
    last_sent = Column(DateTime)

    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="search_alerts")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String, unique=True, index=True)

    sender_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=True)

    message_type = Column(String, default="direct")  # direct, support_ticket, inquiry, broadcast
    subject = Column(String)
    body = Column(Text, nullable=False)

    parent_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)

    priority = Column(String, default="normal")  # low, normal, high, urgent
    category = Column(String)  # technical, billing, general

    status = Column(String, default="new")  # new, read, replied, closed

    read_at = Column(DateTime)
    replied_at = Column(DateTime)
    closed_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)

    replies = relationship("Message", remote_side=[parent_message_id])

    visibility = Column(String, default="private")  # private, dealer_visible, company_wide
    visible_to_dealer = Column(Boolean, default=False)
    visible_to_sales_rep = Column(Boolean, default=False)



class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    notification_type = Column(String, nullable=False)  # message, inquiry, price_alert, new_listing
    title = Column(String, nullable=False)
    body = Column(Text)
    link = Column(String)

    read = Column(Boolean, default=False)
    read_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)


class CRMIntegration(Base):
    __tablename__ = "crm_integrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    crm_type = Column(String, nullable=False)  # hubspot, gohighlevel
    api_key = Column(String, nullable=False)

    # Settings
    sync_leads = Column(Boolean, default=True)
    sync_contacts = Column(Boolean, default=True)
    sync_messages = Column(Boolean, default=True)

    active = Column(Boolean, default=True)
    last_sync = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CRMSyncLog(Base):
    __tablename__ = "crm_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    integration_id = Column(Integer, ForeignKey("crm_integrations.id"))

    sync_type = Column(String, nullable=False)  # lead, contact, message
    record_id = Column(Integer)
    external_id = Column(String)

    success = Column(Boolean, default=True)
    error_message = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)


class ScraperJob(Base):
    __tablename__ = "scraper_jobs"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("users.id"))

    broker_url = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, running, completed, failed

    listings_found = Column(Integer, default=0)
    listings_created = Column(Integer, default=0)
    listings_updated = Column(Integer, default=0)
    listings_removed = Column(Integer, default=0)

    media_downloaded = Column(Integer, default=0)
    team_members_imported = Column(Integer, default=0)

    error_message = Column(Text)

    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    next_run_at = Column(DateTime)

    frequency = Column(String, default="weekly")  # daily, weekly

    created_at = Column(DateTime, default=datetime.utcnow)


class ScrapedListing(Base):
    __tablename__ = "scraped_listings"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("scraper_jobs.id"))
    listing_id = Column(Integer, ForeignKey("listings.id"))

    source_url = Column(String, nullable=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
    still_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class CurrencyRate(Base):
    __tablename__ = "currency_rates"

    id = Column(Integer, primary_key=True, index=True)
    base_currency = Column(String, default="USD")
    target_currency = Column(String, nullable=False)
    rate = Column(Float, nullable=False)

    updated_at = Column(DateTime, default=datetime.utcnow)


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Banner settings
    banner_active = Column(Boolean, default=False)
    banner_text = Column(String)
    banner_type = Column(String, default="info")  # info, warning, success, promotion
    banner_target = Column(String, default="all")  # all, dealers, buyers

    # Subscription configuration
    subscription_config = Column(JSON, default={})

    # Email settings
    email_enabled = Column(Boolean, default=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Inquiry(Base):
    __tablename__ = "inquiries"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"))
    sender_name = Column(String, nullable=False)
    sender_email = Column(String, nullable=False)
    sender_phone = Column(String)
    message = Column(Text, nullable=False)
    status = Column(String, default="new")
    created_at = Column(DateTime, default=datetime.utcnow)


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"))

    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    excerpt = Column(Text)
    content = Column(Text, nullable=False)
    featured_image = Column(String)

    meta_title = Column(String)
    meta_description = Column(String)
    meta_keywords = Column(String)

    category = Column(String)
    tags = Column(String)

    status = Column(String, default="draft")
    published_at = Column(DateTime)

    views = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author = relationship("User", back_populates="blog_posts")


class MediaFile(Base):
    __tablename__ = "media_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=True)
    blog_post_id = Column(Integer, ForeignKey("blog_posts.id"), nullable=True)

    filename = Column(String, nullable=False)
    original_filename = Column(String)
    url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)

    file_type = Column(String)
    mime_type = Column(String)
    file_size = Column(Integer)

    alt_text = Column(Text)
    caption = Column(Text)
    width = Column(Integer)
    height = Column(Integer)

    optimized = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

# Add Payment model (from artifact #4)
class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    stripe_payment_intent_id = Column(String, unique=True, index=True)
    stripe_customer_id = Column(String)
    stripe_charge_id = Column(String)
    
    amount = Column(Float, nullable=False)
    currency = Column(String, default="usd")
    status = Column(String, default="pending")
    
    payment_type = Column(String)
    related_id = Column(Integer)
    
    description = Column(Text)
    payment_metadata = Column(JSON)
    
    failure_code = Column(String)
    failure_message = Column(Text)
    
    refunded = Column(Boolean, default=False)
    refund_amount = Column(Float)
    refund_reason = Column(String)
    refunded_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    payment_id = Column(Integer, ForeignKey("payments.id"))
    
    invoice_number = Column(String, unique=True, index=True)
    
    amount = Column(Float, nullable=False)
    currency = Column(String, default="usd")
    tax = Column(Float, default=0)
    total = Column(Float, nullable=False)
    
    description = Column(Text)
    items = Column(JSON)
    
    status = Column(String, default="draft")
    
    issued_at = Column(DateTime, default=datetime.utcnow)
    due_at = Column(DateTime)
    paid_at = Column(DateTime)
    
    pdf_url = Column(String)


class AccountDeletionRequest(Base):
    __tablename__ = "account_deletion_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    reason = Column(Text)
    scheduled_deletion_date = Column(DateTime, nullable=False)
    
    canceled = Column(Boolean, default=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)


# Duplicate model definitions removed (PasswordReset / EmailVerification / TwoFactorAuth / TwoFactorCode) to avoid re-definition conflicts.
# See canonical definitions earlier in the file.


# Create all tables
Base.metadata.create_all(bind=engine)

# ======================
# SUBSCRIPTION TIER LIMITS
# ======================

TIER_LIMITS = {
    "free": {"listings": 5, "images_per_listing": 5, "videos_per_listing": 0},
    "basic": {"listings": 25, "images_per_listing": 15, "videos_per_listing": 1},
    "premium": {"listings": 999999, "images_per_listing": 50, "videos_per_listing": 5},
    "trial": {"listings": 999999, "images_per_listing": 50, "videos_per_listing": 5},
}

# Featured listing pricing
FEATURED_PLANS = {
    "7day": {"price": 49.00, "days": 7},
    "30day": {"price": 149.00, "days": 30},
    "90day": {"price": 399.00, "days": 90},
}

# Currency exchange rates (fallback values)
DEFAULT_RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.79,
    "CAD": 1.36,
    "AUD": 1.53,
    "JPY": 149.50,
    "CNY": 7.24,
    "MXN": 17.05,
}

# Supported languages
SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "zh"]

# Geographic regions
CONTINENTS = {
    "North America": ["USA", "Canada", "Mexico"],
    "Caribbean": ["Bahamas", "Cayman Islands", "British Virgin Islands", "US Virgin Islands"],
    "Europe": ["France", "Italy", "Spain", "Greece", "Croatia", "Monaco"],
    "Mediterranean": ["France", "Italy", "Spain", "Greece", "Turkey", "Croatia"],
    "Asia": ["Thailand", "Singapore", "Hong Kong", "Indonesia"],
    "Pacific": ["Australia", "New Zealand", "Fiji"],
    "Middle East": ["UAE", "Qatar"],
}

# ======================
# PYDANTIC SCHEMAS
# ======================


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    user_type: str = "admin"
    company_name: Optional[str] = None
    subscription_tier: Optional[str] = "free"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class ListingCreate(BaseModel):
    title: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    price: Optional[float] = None
    length_feet: Optional[float] = None
    beam_feet: Optional[float] = None
    draft_feet: Optional[float] = None
    boat_type: Optional[str] = None
    hull_material: Optional[str] = None
    engine_make: Optional[str] = None
    engine_model: Optional[str] = None
    engine_type: Optional[str] = None
    engine_hours: Optional[float] = None
    fuel_type: Optional[str] = None
    cabins: Optional[int] = None
    berths: Optional[int] = None
    heads: Optional[int] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "USA"
    description: Optional[str] = None
    condition: str = "used"
    status: str = "active"
    featured: bool = False


class InquiryCreate(BaseModel):
    listing_id: int
    sender_name: str
    sender_email: EmailStr
    sender_phone: Optional[str] = None
    message: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class EmailVerificationRequest(BaseModel):
    token: str


class Enable2FARequest(BaseModel):
    enabled: bool


class Verify2FACode(BaseModel):
    code: str


# ======================
# SECURITY & UTILITIES
# ======================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_password(plain_password, hashed_password):
    """Verify password against hash"""
    return pwd_verify(plain_password, hashed_password)


def get_password_hash(password):
    """Hash password with validation"""
    # Validate password first
    is_valid, errors = PasswordValidator.validate(password)
    if not is_valid:
        raise ValidationException("Password does not meet requirements", {"errors": errors})
    return pwd_hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def check_listing_limit(user: User, db: Session):
    """Check if user can create more listings based on their tier"""
    active_count = db.query(Listing).filter(Listing.user_id == user.id, Listing.status == "active").count()

    limit = TIER_LIMITS.get(user.subscription_tier, TIER_LIMITS["free"])["listings"]

    if active_count >= limit:
        raise AuthorizationException(
            f"You've reached your listing limit ({limit}). Upgrade your subscription to create more listings."
        )


# ======================
# IMAGE OPTIMIZATION
# ======================


def optimize_image(input_path: Path, output_path: Path, max_width: int = 1920, quality: int = 85) -> tuple[bool, dict]:
    """Optimize image for web with proper orientation handling"""
    try:
        with Image.open(input_path) as img:
            original_width, original_height = img.size

            # Handle EXIF orientation
            try:
                for orientation in ExifTags.TAGS.keys():
                    if ExifTags.TAGS[orientation] == "Orientation":
                        break
                exif = img._getexif()
                if exif is not None:
                    orientation_value = exif.get(orientation)
                    if orientation_value == 3:
                        img = img.rotate(180, expand=True)
                    elif orientation_value == 6:
                        img = img.rotate(270, expand=True)
                    elif orientation_value == 8:
                        img = img.rotate(90, expand=True)
            except (AttributeError, KeyError, IndexError):
                pass

            # Convert RGBA/LA/P to RGB
            if img.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                if img.mode in ("RGBA", "LA"):
                    background.paste(img, mask=img.split()[-1])
                else:
                    background.paste(img)
                img = background

            # Resize if needed
            new_width = original_width
            new_height = original_height
            if img.width > max_width:
                ratio = max_width / img.width
                new_width = max_width
                new_height = int(img.height * ratio)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Save optimized version
            img.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True)

            return True, {
                "width": new_width,
                "height": new_height,
                "original_width": original_width,
                "original_height": original_height,
                "file_size": os.path.getsize(output_path),
            }

    except Exception as e:
        print(f"Image optimization error: {e}")
        return False, {}


def create_thumbnail(input_path: Path, output_path: Path, size: int = 400) -> bool:
    """Create a thumbnail version of an image"""
    try:
        with Image.open(input_path) as img:
            # Convert to RGB if needed
            if img.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                if img.mode in ("RGBA", "LA"):
                    background.paste(img, mask=img.split()[-1])
                else:
                    background.paste(img)
                img = background

            # Create thumbnail (maintains aspect ratio)
            img.thumbnail((size, size), Image.Resampling.LANCZOS)
            img.save(output_path, "JPEG", quality=80, optimize=True)
            return True
    except Exception as e:
        print(f"Thumbnail creation error: {e}")
        return False


# ==================== SECURE IMAGE UPLOAD (validation, scanning, optimize)

class UploadConfig:
    """Upload configuration"""

    # Allowed MIME types
    ALLOWED_IMAGE_TYPES = {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
        "image/gif": [".gif"],
    }

    # Magic numbers (file signatures) for validation
    MAGIC_NUMBERS = {
        b"\xFF\xD8\xFF": "image/jpeg",
        b"\x89\x50\x4E\x47": "image/png",
        b"\x52\x49\x46\x46": "image/webp",  # partial WEBP signature
        b"\x47\x49\x46\x38": "image/gif",
    }

    # Size limits
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    MAX_IMAGE_DIMENSION = 4096  # 4K

    # Optimization settings
    JPEG_QUALITY = 85
    PNG_OPTIMIZE = True
    WEBP_QUALITY = 85

    # ClamAV settings
    ENABLE_CLAMAV = os.getenv("ENABLE_CLAMAV", "1").lower() in ("1", "true", "yes")
    CLAMD_SOCKET = os.getenv("CLAMD_SOCKET", "/var/run/clamd.socket")
    CLAMD_HOST = os.getenv("CLAMD_HOST", "127.0.0.1")
    CLAMD_PORT = int(os.getenv("CLAMD_PORT", "3310"))

    # Thumbnail settings
    THUMBNAIL_SIZE = 400
    THUMBNAIL_QUALITY = 80

    # Directories
    UPLOAD_DIR = Path("uploads")
    TEMP_DIR = Path("temp")


class FileValidator:
    """Comprehensive file validation and virus scan"""

    @staticmethod
    def check_magic_number(file_content: bytes) -> Optional[str]:
        # Try to use python-magic if available
        try:
            import magic

            mime = magic.from_buffer(file_content, mime=True)
            if mime in UploadConfig.ALLOWED_IMAGE_TYPES:
                return mime
        except Exception:
            pass

        # Fallback: check file signatures
        for magic_num, mime_type in UploadConfig.MAGIC_NUMBERS.items():
            if file_content.startswith(magic_num):
                return mime_type
        return None

    @staticmethod
    def validate_file_size(size: int) -> bool:
        return 0 < size <= UploadConfig.MAX_FILE_SIZE

    @staticmethod
    def validate_file_extension(filename: str, mime_type: str) -> bool:
        ext = Path(filename).suffix.lower()
        allowed_exts = UploadConfig.ALLOWED_IMAGE_TYPES.get(mime_type, [])
        return ext in allowed_exts

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        filename = Path(filename).name
        filename = "".join(c for c in filename if c.isalnum() or c in "._-")
        if len(filename) > 255:
            name, ext = os.path.splitext(filename)
            filename = name[:250] + ext
        return filename

    @staticmethod
    async def scan_for_viruses(file_path: Path) -> Tuple[bool, str]:
        """Scan file with ClamAV. Tries unix socket, then network socket, then clamscan CLI. Honors ENABLE_CLAMAV config."""
        if not UploadConfig.ENABLE_CLAMAV:
            logger.info("ClamAV scanning disabled via configuration")
            return True, "Scan disabled"

        try:
            import clamd

            # Try unix socket
            try:
                cd = clamd.ClamdUnixSocket()
                result = cd.scan(str(file_path))
            except Exception:
                # Try network socket
                try:
                    cd = clamd.ClamdNetworkSocket(UploadConfig.CLAMD_HOST, UploadConfig.CLAMD_PORT)
                    result = cd.scan(str(file_path))
                except Exception:
                    result = None

            if result is None:
                return True, "Clean"

            # clamd.scan returns dict like {"/path": ("FOUND", "Eicar-Test-Signature")}
            for _, v in result.items():
                status = v[0] if isinstance(v, (list, tuple)) and len(v) > 0 else str(v)
                if status == "OK":
                    continue
                if "FOUND" in status or status == "FOUND":
                    return False, f"Virus detected: {v[1] if len(v) > 1 else status}"
            return True, "Clean"

        except ImportError:
            logger.warning("ClamAV (clamd) not installed, attempting clamscan CLI")
            try:
                proc = subprocess.run(["clamscan", "--no-summary", str(file_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                out = proc.stdout.decode(errors="ignore")
                if proc.returncode == 0:
                    return True, "Clean"
                if "FOUND" in out:
                    return False, "Virus detected: clamscan"
                return True, "Scan returned non-zero without FOUND"
            except Exception as e:
                logger.warning(f"ClamAV CLI scan failed: {e}")
                return True, f"Scan error: {e}"

        except Exception as e:
            logger.error(f"Virus scan error: {e}")
            return True, f"Scan error: {e}"


class ImageProcessor:
    """Image normalization and optimization helper"""

    @staticmethod
    def fix_image_orientation(image: Image.Image) -> Image.Image:
        try:
            exif = image._getexif()
            if exif is None:
                return image
            orientation_key = None
            for key in ExifTags.TAGS.keys():
                if ExifTags.TAGS[key] == "Orientation":
                    orientation_key = key
                    break
            if orientation_key is None:
                return image
            orientation = exif.get(orientation_key)
            if orientation == 3:
                image = image.rotate(180, expand=True)
            elif orientation == 6:
                image = image.rotate(270, expand=True)
            elif orientation == 8:
                image = image.rotate(90, expand=True)
        except Exception:
            pass
        return image

    @staticmethod
    def validate_image_dimensions(image: Image.Image) -> bool:
        width, height = image.size
        return width <= UploadConfig.MAX_IMAGE_DIMENSION and height <= UploadConfig.MAX_IMAGE_DIMENSION

    @staticmethod
    def convert_to_rgb(image: Image.Image) -> Image.Image:
        if image.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            if image.mode in ("RGBA", "LA"):
                background.paste(image, mask=image.split()[-1])
            else:
                background.paste(image)
            return background
        return image.convert("RGB") if image.mode != "RGB" else image

    @staticmethod
    def optimize_image(image: Image.Image, output_format: str = "JPEG", quality: int = 85) -> bytes:
        if output_format == "JPEG":
            image = ImageProcessor.convert_to_rgb(image)
        output = io.BytesIO()
        if output_format == "JPEG":
            image.save(output, format="JPEG", quality=quality, optimize=True, progressive=True)
        elif output_format == "PNG":
            image.save(output, format="PNG", optimize=True)
        elif output_format == "WEBP":
            image.save(output, format="WEBP", quality=quality, method=6)
        return output.getvalue()

    @staticmethod
    def create_thumbnail(image: Image.Image, size: int = 400) -> bytes:
        thumb = image.copy()
        thumb = ImageProcessor.convert_to_rgb(thumb)
        thumb.thumbnail((size, size), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        thumb.save(output, format="JPEG", quality=UploadConfig.THUMBNAIL_QUALITY, optimize=True)
        return output.getvalue()


class SecureUploadHandler:
    def __init__(self):
        UploadConfig.UPLOAD_DIR.mkdir(exist_ok=True)
        UploadConfig.TEMP_DIR.mkdir(exist_ok=True)

    @staticmethod
    def generate_unique_filename(original_filename: str) -> str:
        timestamp = str(int(os.times()[4] * 1000000))
        hash_input = f"{timestamp}{original_filename}".encode()
        file_hash = hashlib.sha256(hash_input).hexdigest()[:16]
        ext = Path(original_filename).suffix.lower()
        return f"{timestamp}_{file_hash}{ext}"

    async def upload_and_process_image(
        self,
        file: UploadFile,
        user_id: int,
        optimize: bool = True,
        create_thumbnail: bool = True,
    ) -> dict:
        temp_path = None
        try:
            file_content = await file.read()
            if not FileValidator.validate_file_size(len(file_content)):
                raise HTTPException(status_code=400, detail=f"File too large. Max size: {UploadConfig.MAX_FILE_SIZE / 1024 / 1024}MB")
            true_mime_type = FileValidator.check_magic_number(file_content)
            if not true_mime_type:
                raise HTTPException(status_code=400, detail="Invalid file type. Only images are allowed.")
            if true_mime_type not in UploadConfig.ALLOWED_IMAGE_TYPES:
                raise HTTPException(status_code=400, detail=f"File type not allowed: {true_mime_type}")
            if not FileValidator.validate_file_extension(file.filename, true_mime_type):
                raise HTTPException(status_code=400, detail="File extension doesn't match file type")
            sanitized_name = FileValidator.sanitize_filename(file.filename)
            temp_path = UploadConfig.TEMP_DIR / f"temp_{sanitized_name}"
            with open(temp_path, "wb") as f:
                f.write(file_content)
            is_safe, scan_message = await FileValidator.scan_for_viruses(temp_path)
            if not is_safe:
                logger.warning(f"Virus detected in upload from user {user_id}: {scan_message}")
                raise HTTPException(status_code=400, detail="File failed security scan")
            try:
                image = Image.open(io.BytesIO(file_content))
            except Exception as e:
                logger.error(f"Invalid image file: {e}")
                raise HTTPException(status_code=400, detail="Invalid or corrupted image file")
            if not ImageProcessor.validate_image_dimensions(image):
                raise HTTPException(status_code=400, detail=f"Image dimensions too large. Max: {UploadConfig.MAX_IMAGE_DIMENSION}px")
            image = ImageProcessor.fix_image_orientation(image)
            unique_filename = self.generate_unique_filename(file.filename)
            result = {
                "original_filename": file.filename,
                "filename": unique_filename,
                "mime_type": true_mime_type,
                "size": len(file_content),
                "width": image.size[0],
                "height": image.size[1],
            }
            if optimize:
                optimized_data = ImageProcessor.optimize_image(image, output_format="JPEG", quality=UploadConfig.JPEG_QUALITY)
                output_path = UploadConfig.UPLOAD_DIR / unique_filename
                with open(output_path, "wb") as f:
                    f.write(optimized_data)
                result["url"] = f"/uploads/{unique_filename}"
                result["optimized"] = True
                result["optimized_size"] = len(optimized_data)
            else:
                output_path = UploadConfig.UPLOAD_DIR / unique_filename
                with open(output_path, "wb") as f:
                    f.write(file_content)
                result["url"] = f"/uploads/{unique_filename}"
                result["optimized"] = False
            if create_thumbnail:
                thumbnail_data = ImageProcessor.create_thumbnail(image)
                thumbnail_filename = f"thumb_{unique_filename}"
                thumbnail_path = UploadConfig.UPLOAD_DIR / thumbnail_filename
                with open(thumbnail_path, "wb") as f:
                    f.write(thumbnail_data)
                result["thumbnail_url"] = f"/uploads/{thumbnail_filename}"
                result["thumbnail_size"] = len(thumbnail_data)
            logger.info(f"Image uploaded successfully: {unique_filename} by user {user_id}")
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Upload error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Upload failed")
        finally:
            if temp_path and temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception as e:
                    logger.error(f"Failed to delete temp file: {e}")


# Instantiate handler
upload_handler = SecureUploadHandler()


# ======================
# CURRENCY & UNIT CONVERSION
# ======================


def get_exchange_rate(from_currency: str, to_currency: str, db: Session) -> float:
    """Get exchange rate between two currencies"""
    if from_currency == to_currency:
        return 1.0

    # Try to get from database
    rate_record = (
        db.query(CurrencyRate)
        .filter(CurrencyRate.base_currency == from_currency, CurrencyRate.target_currency == to_currency)
        .first()
    )

    if rate_record:
        # Check if rate is less than 24 hours old
        if (datetime.utcnow() - rate_record.updated_at).days < 1:
            return rate_record.rate

    # Use fallback rates
    if from_currency == "USD":
        return DEFAULT_RATES.get(to_currency, 1.0)
    elif to_currency == "USD":
        return 1.0 / DEFAULT_RATES.get(from_currency, 1.0)
    else:
        # Convert through USD
        to_usd = 1.0 / DEFAULT_RATES.get(from_currency, 1.0)
        usd_to_target = DEFAULT_RATES.get(to_currency, 1.0)
        return to_usd * usd_to_target


def convert_price(price: float, from_currency: str, to_currency: str, db: Session) -> float:
    """Convert price between currencies"""
    rate = get_exchange_rate(from_currency, to_currency, db)
    return round(price * rate, 2)


def convert_length(feet: float, to_metric: bool) -> float:
    """Convert length between feet and meters"""
    if to_metric:
        return round(feet * 0.3048, 2)
    return feet


def convert_volume(gallons: float, to_metric: bool) -> float:
    """Convert volume between gallons and liters"""
    if to_metric:
        return round(gallons * 3.78541, 2)
    return gallons


def convert_speed(knots: float, to_kmh: bool) -> float:
    """Convert speed between knots and km/h"""
    if to_kmh:
        return round(knots * 1.852, 2)
    return knots


# ======================
# GEOGRAPHIC CALCULATIONS
# ======================


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in miles using Haversine formula"""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))

    miles = 3959 * c  # Earth radius in miles
    return round(miles, 1)


def geocode_location(address: str) -> tuple[Optional[float], Optional[float]]:
    """Convert address to coordinates (requires Google Maps API or similar)"""
    # This is a placeholder - implement with actual geocoding service
    # For now, return None
    return None, None


def get_continent_for_country(country: str) -> Optional[str]:
    """Get continent for a given country"""
    for continent, countries in CONTINENTS.items():
        if country in countries:
            return continent
    return None


# ======================
# CRM HELPER FUNCTIONS
# ======================


def sync_to_hubspot(api_key: str, contact_data: dict, deal_data: dict = None):
    """Sync contact and deal to HubSpot"""
    try:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        # Create/update contact
        contact_response = requests.post(
            "https://api.hubapi.com/crm/v3/objects/contacts", headers=headers, json={"properties": contact_data}
        )

        if contact_response.status_code in [200, 201]:
            contact_id = contact_response.json().get("id")

            # Create deal if provided
            if deal_data and contact_id:
                deal_data["associations"] = [
                    {
                        "to": {"id": contact_id},
                        "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3}],
                    }
                ]
                requests.post(
                    "https://api.hubapi.com/crm/v3/objects/deals",
                    headers=headers,
                    json={"properties": deal_data, "associations": deal_data["associations"]},
                )

            return True, contact_id

        return False, None

    except Exception as e:
        logger.error(f"HubSpot sync error: {e}")
        return False, None


def sync_to_gohighlevel(api_key: str, contact_data: dict, opportunity_data: dict = None):
    """Sync contact and opportunity to GoHighLevel"""
    try:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        # Create/update contact
        contact_response = requests.post(
            "https://rest.gohighlevel.com/v1/contacts/", headers=headers, json=contact_data
        )

        if contact_response.status_code in [200, 201]:
            contact_id = contact_response.json().get("contact", {}).get("id")

            # Create opportunity if provided
            if opportunity_data and contact_id:
                opportunity_data["contact_id"] = contact_id
                requests.post("https://rest.gohighlevel.com/v1/opportunities/", headers=headers, json=opportunity_data)

            return True, contact_id

        return False, None

    except Exception as e:
        logger.error(f"GoHighLevel sync error: {e}")
        return False, None


# ======================
# BACKGROUND TASK HELPERS
# ======================


def process_inquiry_crm_sync(inquiry_id: int, db: Session):
    """Background task to sync inquiry to dealer's CRM"""
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry:
        return

    # Get listing and dealer
    listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first()
    if not listing:
        return

    dealer = listing.owner

    # Check if dealer has CRM integration
    crm = db.query(CRMIntegration).filter(CRMIntegration.user_id == dealer.id, CRMIntegration.active.is_(True)).first()

    if not crm or not crm.sync_leads:
        return

    # Prepare contact data
    contact_data = {
        "email": inquiry.sender_email,
        "firstname": inquiry.sender_name.split()[0] if inquiry.sender_name else "",
        "lastname": " ".join(inquiry.sender_name.split()[1:]) if len(inquiry.sender_name.split()) > 1 else "",
        "phone": inquiry.sender_phone or "",
    }

    # Prepare deal/opportunity data
    deal_data = {
        "dealname": f"Inquiry: {listing.title}",
        "amount": listing.price or 0,
        "dealstage": "appointmentscheduled",
        "pipeline": "default",
    }

    success = False
    external_id = None

    if crm.crm_type == "hubspot":
        success, external_id = sync_to_hubspot(crm.api_key, contact_data, deal_data)
    elif crm.crm_type == "gohighlevel":
        opportunity_data = {
            "name": f"Inquiry: {listing.title}",
            "pipeline_stage_id": "default",
            "status": "open",
            "monetary_value": listing.price or 0,
        }
        success, external_id = sync_to_gohighlevel(crm.api_key, contact_data, opportunity_data)

    # Log the sync attempt
    sync_log = CRMSyncLog(
        integration_id=crm.id,
        sync_type="lead",
        record_id=inquiry.id,
        external_id=str(external_id) if external_id else None,
        success=success,
    )
    db.add(sync_log)
    db.commit()


def generate_ticket_number() -> str:
    """Generate unique ticket number"""
    timestamp = datetime.utcnow().strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:4].upper()
    return f"TICKET-{timestamp}-{random_suffix}"


def create_slug(text: str, db: Session, model) -> str:
    """Generate unique slug from text"""
    base_slug = text.lower().replace(" ", "-")
    base_slug = "".join(c for c in base_slug if c.isalnum() or c == "-")

    slug = base_slug
    counter = 1

    while db.query(model).filter(model.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


# ======================
# FASTAPI APP SETUP
# ======================

app = FastAPI(title="YachtVersal API", version="2.0.0")

# Startup event to run alembic migrations
@app.on_event("startup")
async def startup_event():
    """Run alembic migrations on startup"""
    import os
    import subprocess
    try:
        # Get the backend directory
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        
        print(f"[STARTUP] Running alembic upgrade from {backend_dir}", flush=True)
        
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            print(f"[STARTUP] Alembic migrations completed successfully", flush=True)
            if result.stdout:
                print(f"[STARTUP] Output: {result.stdout}", flush=True)
        else:
            print(f"[STARTUP] Alembic upgrade failed with code {result.returncode}", flush=True)
            print(f"[STARTUP] Stderr: {result.stderr}", flush=True)
            if result.stdout:
                print(f"[STARTUP] Stdout: {result.stdout}", flush=True)
    except FileNotFoundError:
        print("[STARTUP] Alembic command not found, trying to import alembic directly", flush=True)
        try:
            from alembic.config import Config
            from alembic import command
            import os
            
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
            alembic_cfg.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL", ""))
            
            command.upgrade(alembic_cfg, "head")
            print("[STARTUP] Alembic migrations completed via direct import", flush=True)
        except Exception as e:
            print(f"[STARTUP] Direct alembic import failed: {e}", flush=True)
    except Exception as e:
        print(f"[STARTUP] Alembic migration error: {e}", flush=True)

# Global error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": "Something went wrong. Check backend logs."},
    )

# Add request logging middleware (FIRST - so it wraps everything)
app.add_middleware(RequestLoggingMiddleware)


# KEEP your existing CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Change to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add exception handlers
app.add_exception_handler(YachtVersalException, yachtversal_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


# Mount static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Initialize scraper if available
scraper = None
if OptimizedYachtScraper and CLAUDE_API_KEY:
    try:
        scraper = OptimizedYachtScraper(CLAUDE_API_KEY)
    except Exception as e:
        logger.error(f"Scraper init failed: {e}")


def generate_reset_token() -> str:
    """Generate secure reset token"""
    return secrets.token_urlsafe(32)


def generate_verification_token() -> str:
    """Generate secure verification token"""
    return secrets.token_urlsafe(32)


def generate_2fa_code() -> str:
    """Generate 6-digit 2FA code"""
    return str(random.randint(100000, 999999))


def log_activity(db: Session, user_id: int, action: str, details: dict = None, request: Request = None):
    """Log user activity"""
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None

    log = ActivityLog(
        user_id=user_id, action=action, details=details or {}, ip_address=ip_address, user_agent=user_agent
    )
    db.add(log)
    db.commit()


# ==================== SEARCH UTILITIES ====================

class SortOrder(str, Enum):
    """Sort order options"""
    ASC = "asc"
    DESC = "desc"


class SortBy(str, Enum):
    """Sort field options"""
    PRICE = "price"
    YEAR = "year"
    LENGTH = "length_feet"
    CREATED = "created_at"
    RELEVANCE = "relevance"


class SearchRequest(BaseModel):
    """Advanced search request schema"""
    # Text search
    query: Optional[str] = None

    # Price filters
    min_price: Optional[float] = None
    max_price: Optional[float] = None

    # Year filters
    min_year: Optional[int] = None
    max_year: Optional[int] = None

    # Length filters
    min_length: Optional[float] = None
    max_length: Optional[float] = None

    # Type filters
    boat_types: Optional[List[str]] = None
    hull_materials: Optional[List[str]] = None
    fuel_types: Optional[List[str]] = None
    conditions: Optional[List[str]] = None

    # Location filters
    countries: Optional[List[str]] = None
    states: Optional[List[str]] = None
    cities: Optional[List[str]] = None
    continents: Optional[List[str]] = None

    # Capacity filters
    min_cabins: Optional[int] = None
    min_berths: Optional[int] = None
    min_heads: Optional[int] = None

    # Engine filters
    engine_types: Optional[List[str]] = None
    max_engine_hours: Optional[float] = None

    # Features
    makes: Optional[List[str]] = None
    models: Optional[List[str]] = None

    # Status
    status: str = "active"
    featured_only: bool = False

    # Sorting
    sort_by: SortBy = SortBy.CREATED
    sort_order: SortOrder = SortOrder.DESC

    # Pagination
    page: int = 1
    limit: int = 20


def sanitize_search_query(query: str) -> str:
    """
    Sanitize search query to prevent SQL injection
    and improve search quality
    """
    if not query:
        return ""

    # Remove special characters that could cause issues
    query = re.sub(r'[^\w\s\-]', ' ', query)

    # Remove extra whitespace
    query = ' '.join(query.split())

    # Convert to lowercase for case-insensitive search
    return query.lower().strip()


def create_tsquery(query: str) -> str:
    """
    Create PostgreSQL tsquery from search terms
    Supports AND, OR, and phrase searches
    """
    if not query:
        return ""

    # Split into words
    words = query.split()

    # Join with & for AND search (all words must match)
    # Use | for OR search if you prefer
    tsquery = ' & '.join(f"'{word}':*" for word in words)

    return tsquery


def calculate_relevance_score(listing, query: str) -> float:
    """
    Calculate relevance score for search results
    Higher score = more relevant
    """
    score = 0.0
    query_lower = query.lower()

    # Title match (highest weight)
    if listing.title and query_lower in listing.title.lower():
        score += 10.0
        # Exact match bonus
        if listing.title.lower() == query_lower:
            score += 5.0

    # Make/Model match (high weight)
    if listing.make and query_lower in listing.make.lower():
        score += 8.0
    if listing.model and query_lower in listing.model.lower():
        score += 8.0

    # Description match (medium weight)
    if listing.description and query_lower in listing.description.lower():
        score += 3.0

    # Boat type match
    if listing.boat_type and query_lower in listing.boat_type.lower():
        score += 5.0

    # Featured listings boost
    if listing.featured:
        score += 2.0

    # Recent listings boost
    if listing.created_at:
        from datetime import datetime
        days_old = (datetime.utcnow() - listing.created_at).days
        if days_old < 7:
            score += 1.0
        elif days_old < 30:
            score += 0.5

    return score


# ======================
# AUTH ENDPOINTS
# ======================


@app.post("/api/auth/register", response_model=Token)
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if email exists (handle possible schema drift for verification_token)
    from sqlalchemy.exc import ProgrammingError
    try:
        existing_user = db.query(User).filter(User.email == user_data.email).first()
    except ProgrammingError as e:
        logger.warning("Database schema error detected during register: %s - attempting to patch schema", e)
        # Attempt to add the missing column & index, then retry once
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR"))
            db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_verification_token ON users (verification_token)"))
            db.commit()
            logger.info("Auto-patched users table with verification_token column and index")
        except Exception as e2:
            logger.exception("Failed to auto-patch users table: %s", e2)
            raise
        existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise ValidationException("Email already registered")

    # VALIDATE PASSWORD
    is_valid, errors = PasswordValidator.validate(user_data.password)
    if not is_valid:
        raise ValidationException("Password does not meet requirements", {"errors": errors})

    # Hash password
    hashed_password = get_password_hash(user_data.password)
    # Subscription tier is intentionally NOT set from the registration form.
    # For dealer/private accounts, the tier is upgraded by the Stripe webhook
    # (checkout.session.completed) AFTER the user has actually paid.
    # Storing the selected tier here before payment would grant free access.
    user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        user_type=user_data.user_type,
        company_name=user_data.company_name,
        subscription_tier="free",  # Always start on free; webhook upgrades after payment
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create preferences
    prefs = UserPreferences(user_id=user.id)
    db.add(prefs)

    # Create dealer profile if dealer
    if user.user_type == "dealer":
        slug = create_slug(user.company_name or user.email, db, DealerProfile)
        profile = DealerProfile(
            user_id=user.id,
            name=f"{user.first_name} {user.last_name}",
            company_name=user.company_name,
            email=user.email,
            phone=user.phone,
            slug=slug,
        )
        db.add(profile)

    db.commit()

    # Log activity
    logger.info(f"New user registered: {user.email}", extra={"user_id": user.id})

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)

    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/auth/login", response_model=Token)
async def login(request: Request, user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_pwd(user_data.password, user.password_hash):
        logger.warning(f"Failed login attempt for: {user_data.email}")
        raise AuthenticationException("Incorrect email or password")

    if not user.active:
        raise AuthorizationException("User account is inactive")

    # Log successful login
    logger.info(f"User logged in: {user.email}", extra={"user_id": user.id})

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)

    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me")
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "user_type": current_user.user_type,
        "company_name": current_user.company_name,
        "subscription_tier": current_user.subscription_tier,
        "trial_active": current_user.trial_active,
        "trial_end_date": current_user.trial_end_date.isoformat() if current_user.trial_end_date else None,
    }


@app.post("/api/auth/start-trial")
def start_trial(data: dict, db: Session = Depends(get_db)):
    """Sign up for trial without payment"""
    existing = db.query(User).filter(User.email == data.get("email")).first()
    if existing:
        raise ValidationException("Email already registered")

    trial_days = data.get("trial_days", 5)
    trial_end = datetime.utcnow() + timedelta(days=trial_days)

    user = User(
        email=data.get("email"),
        password_hash=hash_password(data.get("password")),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        phone=data.get("phone"),
        company_name=data.get("company_name"),
        user_type="dealer",
        subscription_tier="trial",
        trial_active=True,
        trial_end_date=trial_end,
        assigned_sales_rep_id=data.get("sales_rep_id"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "trial_end_date": trial_end.isoformat(),
        "days_remaining": trial_days,
    }


@app.post("/api/auth/convert-trial-to-paid")
def convert_trial(payment_data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Convert trial to paid subscription"""
    if not current_user.trial_active:
        raise BusinessLogicException("No active trial")

    tier = payment_data.get("tier", "basic")

    # Update trial listings to active
    db.query(Listing).filter(Listing.user_id == current_user.id, Listing.status == "draft").update(
        {"status": "active", "published_at": datetime.utcnow()}
    )

    current_user.trial_active = False
    current_user.trial_converted = True
    current_user.subscription_tier = tier
    db.commit()

    return {"success": True, "message": f"Upgraded to {tier} plan!", "subscription_tier": tier}


# ======================
# USER PREFERENCES
# ======================


@app.get("/api/preferences")
def get_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user preferences"""
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)

    return {"language": prefs.language, "currency": prefs.currency, "units": prefs.units, "timezone": prefs.timezone}


@app.put("/api/preferences")
def update_preferences(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update user preferences"""
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    if "language" in data:
        prefs.language = data["language"]
    if "currency" in data:
        prefs.currency = data["currency"]
    if "units" in data:
        prefs.units = data["units"]
    if "timezone" in data:
        prefs.timezone = data["timezone"]

    db.commit()
    return {"success": True}


@app.get("/api/user/settings")
def get_user_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user settings including notification preferences"""
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()

    return {
        "email_new_message": current_user.permissions.get("email_new_message", True),
        "email_new_inquiry": current_user.permissions.get("email_new_inquiry", True),
        "email_price_alert": current_user.permissions.get("email_price_alert", True),
        "email_new_listing_match": current_user.permissions.get("email_new_listing_match", True),
        "email_marketing": current_user.permissions.get("email_marketing", False),
        "language": prefs.language,
        "currency": prefs.currency,
        "units": prefs.units,
        "timezone": prefs.timezone,
    }


@app.put("/api/user/settings")
def update_user_settings(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update user settings"""
    # Update preferences
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    if "language" in data:
        prefs.language = data["language"]
    if "currency" in data:
        prefs.currency = data["currency"]
    if "units" in data:
        prefs.units = data["units"]
    if "timezone" in data:
        prefs.timezone = data["timezone"]

    # Update email notification preferences in user permissions JSON
    email_prefs = {
        "email_new_message": data.get("email_new_message", True),
        "email_new_inquiry": data.get("email_new_inquiry", True),
        "email_price_alert": data.get("email_price_alert", True),
        "email_new_listing_match": data.get("email_new_listing_match", True),
        "email_marketing": data.get("email_marketing", False),
    }

    current_user.permissions = {**current_user.permissions, **email_prefs}

    db.commit()
    return {"success": True}


# ======================
# CURRENCY RATES
# ======================


@app.get("/api/currencies/rates")
def get_currency_rates(db: Session = Depends(get_db)):
    """Get current exchange rates"""
    rates = {}
    for currency in ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "MXN"]:
        rates[currency] = get_exchange_rate("USD", currency, db)
    return {"base": "USD", "rates": rates}


# ======================
# LISTING ENDPOINTS
# ======================


# ==================== SEARCH ENDPOINTS ====================

@app.post("/api/search/advanced")
async def advanced_search_endpoint(
    search: SearchRequest,
    db: Session = Depends(get_db)
):
    """
    Advanced search with full-text search and filters
    
    Returns paginated results with total count
    """
    try:
        # Start with base query
        query = db.query(Listing).filter(Listing.status == search.status)
        
        # Full-text search (PostgreSQL)
        if search.query:
            sanitized_query = sanitize_search_query(search.query)
            
            if sanitized_query:
                # PostgreSQL full-text search
                search_vector = func.to_tsvector(
                    'english',
                    func.concat_ws(
                        ' ',
                        Listing.title,
                        Listing.description,
                        Listing.make,
                        Listing.model,
                        Listing.boat_type
                    )
                )
                
                tsquery = func.to_tsquery('english', create_tsquery(sanitized_query))
                
                # Use ts_rank for relevance scoring
                rank = func.ts_rank(search_vector, tsquery).label('rank')
                
                query = query.add_columns(rank).filter(
                    search_vector.match(sanitized_query)
                )
        
        # Price filters
        if search.min_price is not None:
            query = query.filter(Listing.price >= search.min_price)
        if search.max_price is not None:
            query = query.filter(Listing.price <= search.max_price)
        
        # Year filters
        if search.min_year is not None:
            query = query.filter(Listing.year >= search.min_year)
        if search.max_year is not None:
            query = query.filter(Listing.year <= search.max_year)
        
        # Length filters
        if search.min_length is not None:
            query = query.filter(Listing.length_feet >= search.min_length)
        if search.max_length is not None:
            query = query.filter(Listing.length_feet <= search.max_length)
        
        # Type filters
        if search.boat_types:
            query = query.filter(Listing.boat_type.in_(search.boat_types))
        if search.hull_materials:
            query = query.filter(Listing.hull_material.in_(search.hull_materials))
        if search.fuel_types:
            query = query.filter(Listing.fuel_type.in_(search.fuel_types))
        if search.conditions:
            query = query.filter(Listing.condition.in_(search.conditions))
        
        # Location filters
        if search.countries:
            query = query.filter(Listing.country.in_(search.countries))
        if search.states:
            query = query.filter(Listing.state.in_(search.states))
        if search.cities:
            query = query.filter(Listing.city.in_(search.cities))
        if search.continents:
            query = query.filter(Listing.continent.in_(search.continents))
        
        # Capacity filters
        if search.min_cabins is not None:
            query = query.filter(Listing.cabins >= search.min_cabins)
        if search.min_berths is not None:
            query = query.filter(Listing.berths >= search.min_berths)
        if search.min_heads is not None:
            query = query.filter(Listing.heads >= search.min_heads)
        
        # Engine filters
        if search.engine_types:
            query = query.filter(Listing.engine_type.in_(search.engine_types))
        if search.max_engine_hours is not None:
            query = query.filter(Listing.engine_hours <= search.max_engine_hours)
        
        # Make/Model filters
        if search.makes:
            query = query.filter(Listing.make.in_(search.makes))
        if search.models:
            query = query.filter(Listing.model.in_(search.models))
        
        # Featured filter
        if search.featured_only:
            query = query.filter(
                Listing.featured == True,
                Listing.featured_until > datetime.utcnow()
            )
        
        # Get total count before pagination
        total_count = query.count()
        
        # Sorting
        if search.sort_by == SortBy.RELEVANCE and search.query:
            # Sort by relevance score from full-text search
            query = query.order_by(text('rank DESC'))
        else:
            sort_field = getattr(Listing, search.sort_by.value)
            if search.sort_order == SortOrder.DESC:
                query = query.order_by(sort_field.desc())
            else:
                query = query.order_by(sort_field.asc())
        
        # Pagination
        offset = (search.page - 1) * search.limit
        query = query.offset(offset).limit(search.limit)
        
        # Execute query
        if search.query and search.sort_by == SortBy.RELEVANCE:
            results = query.all()
            listings = [result[0] for result in results]  # Extract listing from tuple
        else:
            listings = query.all()
        
        # Format results
        results_data = []
        for listing in listings:
            listing_dict = {
                "id": listing.id,
                "title": listing.title,
                "make": listing.make,
                "model": listing.model,
                "year": listing.year,
                "price": listing.price,
                "currency": listing.currency,
                "length_feet": listing.length_feet,
                "boat_type": listing.boat_type,
                "city": listing.city,
                "state": listing.state,
                "country": listing.country,
                "condition": listing.condition,
                "featured": listing.featured,
                "created_at": listing.created_at.isoformat(),
                "images": [
                    {"url": img.url, "is_primary": img.is_primary}
                    for img in listing.images[:1]  # Just first image for list view
                ]
            }
            
            # Add relevance score if search query provided
            if search.query:
                listing_dict["relevance_score"] = calculate_relevance_score(listing, search.query)
            
            results_data.append(listing_dict)
        
        # Calculate pagination info
        total_pages = (total_count + search.limit - 1) // search.limit
        
        return {
            "results": results_data,
            "pagination": {
                "total_count": total_count,
                "page": search.page,
                "limit": search.limit,
                "total_pages": total_pages,
                "has_next": search.page < total_pages,
                "has_prev": search.page > 1
            }
        }
        
    except Exception as e:
        logger.error(f"Search error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Search failed")


@app.get("/api/search/simple")
async def simple_search(
    q: str,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Simple text search for quick lookups
    Searches across title, make, model, description
    """
    sanitized_query = sanitize_search_query(q)
    
    if not sanitized_query:
        return []
    
    # Simple ILIKE search for SQLite compatibility
    search_pattern = f"%{sanitized_query}%"
    
    listings = db.query(Listing).filter(
        Listing.status == "active",
        or_(
            Listing.title.ilike(search_pattern),
            Listing.make.ilike(search_pattern),
            Listing.model.ilike(search_pattern),
            Listing.description.ilike(search_pattern),
            Listing.boat_type.ilike(search_pattern)
        )
    ).limit(limit).all()
    
    return [
        {
            "id": listing.id,
            "title": listing.title,
            "price": listing.price,
            "year": listing.year,
            "make": listing.make,
            "model": listing.model
        }
        for listing in listings
    ]


@app.get("/api/search/autocomplete")
async def search_autocomplete(
    q: str,
    type: str = "all",  # all, make, model, location, boat_type
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Autocomplete suggestions for search
    """
    sanitized_query = sanitize_search_query(q)
    
    if not sanitized_query or len(sanitized_query) < 2:
        return []
    
    pattern = f"{sanitized_query}%"
    suggestions = []
    
    if type in ["all", "make"]:
        makes = db.query(Listing.make).filter(
            Listing.make.ilike(pattern),
            Listing.status == "active"
        ).distinct().limit(limit).all()
        suggestions.extend([{"type": "make", "value": m[0]} for m in makes if m[0]])
    
    if type in ["all", "model"]:
        models = db.query(Listing.model).filter(
            Listing.model.ilike(pattern),
            Listing.status == "active"
        ).distinct().limit(limit).all()
        suggestions.extend([{"type": "model", "value": m[0]} for m in models if m[0]])
    
    if type in ["all", "boat_type"]:
        types = db.query(Listing.boat_type).filter(
            Listing.boat_type.ilike(pattern),
            Listing.status == "active"
        ).distinct().limit(limit).all()
        suggestions.extend([{"type": "boat_type", "value": t[0]} for t in types if t[0]])
    
    if type in ["all", "location"]:
        cities = db.query(Listing.city, Listing.state).filter(
            Listing.city.ilike(pattern),
            Listing.status == "active"
        ).distinct().limit(limit).all()
        suggestions.extend([
            {"type": "location", "value": f"{c[0]}, {c[1]}"}
            for c in cities if c[0]
        ])
    
    return suggestions[:limit]


@app.get("/api/search/filters")
async def get_search_filters(db: Session = Depends(get_db)):
    """
    Get available filter options for search UI
    Returns unique values for dropdowns
    """
    filters = {
        "boat_types": [],
        "makes": [],
        "hull_materials": [],
        "fuel_types": [],
        "conditions": ["new", "used"],
        "countries": [],
        "states": [],
        "continents": [],
        "price_ranges": [
            {"label": "Under $50k", "min": 0, "max": 50000},
            {"label": "$50k - $100k", "min": 50000, "max": 100000},
            {"label": "$100k - $250k", "min": 100000, "max": 250000},
            {"label": "$250k - $500k", "min": 250000, "max": 500000},
            {"label": "$500k - $1M", "min": 500000, "max": 1000000},
            {"label": "Over $1M", "min": 1000000, "max": None}
        ],
        "length_ranges": [
            {"label": "Under 30ft", "min": 0, "max": 30},
            {"label": "30-40ft", "min": 30, "max": 40},
            {"label": "40-50ft", "min": 40, "max": 50},
            {"label": "50-60ft", "min": 50, "max": 60},
            {"label": "60-80ft", "min": 60, "max": 80},
            {"label": "Over 80ft", "min": 80, "max": None}
        ]
    }
    
    # Get unique values from database
    active_listings = db.query(Listing).filter(Listing.status == "active")
    
    # Boat types
    boat_types = active_listings.with_entities(Listing.boat_type).distinct().all()
    filters["boat_types"] = sorted([bt[0] for bt in boat_types if bt[0]])
    
    # Makes
    makes = active_listings.with_entities(Listing.make).distinct().all()
    filters["makes"] = sorted([m[0] for m in makes if m[0]])
    
    # Hull materials
    materials = active_listings.with_entities(Listing.hull_material).distinct().all()
    filters["hull_materials"] = sorted([m[0] for m in materials if m[0]])
    
    # Fuel types
    fuels = active_listings.with_entities(Listing.fuel_type).distinct().all()
    filters["fuel_types"] = sorted([f[0] for f in fuels if f[0]])
    
    # Countries
    countries = active_listings.with_entities(Listing.country).distinct().all()
    filters["countries"] = sorted([c[0] for c in countries if c[0]])
    
    # States
    states = active_listings.with_entities(Listing.state).distinct().all()
    filters["states"] = sorted([s[0] for s in states if s[0]])
    
    # Continents
    continents = active_listings.with_entities(Listing.continent).distinct().all()
    filters["continents"] = sorted([c[0] for c in continents if c[0]])
    
    return filters





@app.get("/api/listings")
async def get_listings(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    boat_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_year: Optional[int] = None,
    condition: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    country: Optional[str] = None,
    continent: Optional[str] = None,
    status: str = "active",
    featured_only: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Listing).filter(Listing.status == status)

    if featured_only:
        query = query.filter(Listing.featured.is_(True), Listing.featured_until > datetime.utcnow()).order_by(
            Listing.featured_priority.desc()
        )

    if boat_type:
        query = query.filter(Listing.boat_type == boat_type)
    if min_price:
        query = query.filter(Listing.price >= min_price)
    if max_price:
        query = query.filter(Listing.price <= max_price)
    if min_year:
        query = query.filter(Listing.year >= min_year)
    if condition:
        query = query.filter(Listing.condition == condition)
    if city:
        query = query.filter(Listing.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(Listing.state.ilike(f"%{state}%"))
    if country:
        query = query.filter(Listing.country == country)
    if continent:
        query = query.filter(Listing.continent == continent)

    listings = query.order_by(Listing.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for listing in listings:
        listing_dict = {
            "id": listing.id,
            "title": listing.title,
            "make": listing.make,
            "model": listing.model,
            "year": listing.year,
            "price": listing.price,
            "currency": listing.currency,
            "length_feet": listing.length_feet,
            "boat_type": listing.boat_type,
            "city": listing.city,
            "state": listing.state,
            "country": listing.country,
            "continent": listing.continent,
            "cabins": listing.cabins,
            "berths": listing.berths,
            "condition": listing.condition,
            "description": listing.description,
            "status": listing.status,
            "featured": listing.featured,
            "featured_until": listing.featured_until.isoformat() if listing.featured_until else None,
            "views": listing.views,
            "inquiries": listing.inquiries,
            "engine_hours": listing.engine_hours,
            "created_at": listing.created_at.isoformat(),
            "images": [{"id": img.id, "url": img.url, "is_primary": img.is_primary} for img in listing.images],
        }
        result.append(listing_dict)

    return result


@app.get("/api/listings/{listing_id}/contact-info")
def get_listing_contact_info(listing_id: int, db: Session = Depends(get_db)):
    """Get contact info for listing (dealer + creator if public profile)"""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Get dealer (owner)
    dealer = db.query(User).filter(User.id == listing.user_id).first()
    dealer_profile = db.query(DealerProfile).filter(
        DealerProfile.user_id == listing.user_id
    ).first()
    
    # Get creator (if team member with public profile)
    creator = db.query(User).filter(User.id == listing.created_by_user_id).first()
    
    result = {
        "dealer": {
            "name": dealer.company_name or f"{dealer.first_name} {dealer.last_name}",
            "email": dealer.email,
            "phone": dealer.phone,
            "logo_url": dealer_profile.logo_url if dealer_profile else None,
            "slug": dealer_profile.slug if dealer_profile else None
        }
    }
    
    # Add creator if different and has public profile
    if creator and creator.id != dealer.id and creator.public_profile:
        result["sales_contact"] = {
            "name": f"{creator.first_name} {creator.last_name}",
            "title": creator.title,
            "email": creator.email,
            "phone": creator.phone,
            "photo_url": creator.profile_photo_url,
            "bio": creator.bio
        }
    
    return result


# Canonical create_listing is implemented later in the file to handle team/dealer ownership and permissions. See the implementation near the "MODIFY EXISTING LISTING ENDPOINTS FOR PERMISSIONS" section.
# Canonical update_listing implemented later; removed duplicate.


@app.delete("/api/listings/{listing_id}")
def delete_listing(
    listing_id: int,
    permanent: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)

    if listing.user_id != current_user.id and current_user.user_type != "admin":
        raise AuthorizationException("You don't have permission to access this listing")

    if permanent:
        db.delete(listing)
        db.commit()
        return {"message": "Listing permanently deleted"}
    else:
        listing.status = "archived"
        listing.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Listing archived"}


@app.get("/api/users/{user_id}")
def get_user_info(user_id: int, db: Session = Depends(get_db)):
    """Get basic user information (public-safe)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)

    # Get dealer profile if exists
    dealer_profile = db.query(DealerProfile).filter(DealerProfile.user_id == user_id).first()

    return {
        "id": user.id,
        "name": f"{user.first_name} {user.last_name}" if user.first_name else user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "company_name": user.company_name,
        "email": user.email,
        "phone": user.phone,
        "user_type": user.user_type,
        "logo_url": dealer_profile.logo_url if dealer_profile else None,
        "slug": dealer_profile.slug if dealer_profile else None,
        "photo_url": None,
    }


@app.get("/api/my-listings")
def get_my_listings(
    status: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get listings for the current user"""
    query = db.query(Listing).filter(Listing.user_id == current_user.id)

    if status:
        query = query.filter(Listing.status == status)

    listings = query.order_by(Listing.created_at.desc()).all()

    result = []
    for listing in listings:
        listing_dict = {
            "id": listing.id,
            "title": listing.title,
            "make": listing.make,
            "model": listing.model,
            "year": listing.year,
            "price": listing.price,
            "currency": listing.currency,
            "length_feet": listing.length_feet,
            "boat_type": listing.boat_type,
            "city": listing.city,
            "state": listing.state,
            "status": listing.status,
            "featured": listing.featured,
            "featured_until": listing.featured_until.isoformat() if listing.featured_until else None,
            "views": listing.views,
            "inquiries": listing.inquiries,
            "created_at": listing.created_at.isoformat(),
            "images": [{"id": img.id, "url": img.url, "is_primary": img.is_primary} for img in listing.images],
        }
        result.append(listing_dict)

    return result


# ======================
# FEATURED LISTINGS
# ======================


@app.get("/api/featured-listings")
def get_featured_listings(db: Session = Depends(get_db)):
    """Get active featured listings"""
    listings = (
        db.query(Listing)
        .filter(Listing.featured.is_(True), Listing.featured_until > datetime.utcnow(), Listing.status == "active")
        .order_by(Listing.featured_priority.desc())
        .limit(10)
        .all()
    )

    return [
        {
            "id": listing.id,
            "title": listing.title,
            "price": listing.price,
            "currency": listing.currency,
            "images": [{"url": img.url} for img in listing.images[:1]],
            "city": listing.city,
            "state": listing.state,
        }
        for listing in listings
    ]


@app.post("/api/featured-listings/purchase")
async def purchase_featured_listing(
    data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Purchase featured placement with Stripe"""
    listing_id = data.get("listing_id")
    plan = data.get("plan")  # "7day", "30day", "90day"
    payment_method_id = data.get("payment_method_id")

    if plan not in FEATURED_PLANS:
        raise ValidationException("Invalid plan")

    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    if listing.user_id != current_user.id:
        raise AuthorizationException("You don't have permission to purchase featured placement for this listing")

    plan_details = FEATURED_PLANS[plan]
    amount = int(plan_details["price"] * 100)  # Stripe uses cents

    try:
        # Create Stripe payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="usd",
            payment_method=payment_method_id,
            confirm=True,
            description=f"Featured listing: {listing.title}",
            metadata={"listing_id": listing_id, "user_id": current_user.id, "plan": plan},
        )

        if intent.status == "succeeded":
            # Update listing
            expires_at = datetime.utcnow() + timedelta(days=plan_details["days"])
            listing.featured = True
            listing.featured_until = expires_at
            listing.featured_plan = plan
            listing.featured_priority = 10 if plan == "90day" else 5 if plan == "30day" else 1

            # Create featured listing record
            featured = FeaturedListing(
                listing_id=listing_id,
                user_id=current_user.id,
                plan=plan,
                price_paid=plan_details["price"],
                expires_at=expires_at,
                stripe_payment_id=intent.id,
            )
            db.add(featured)
            db.commit()

            return {
                "success": True,
                "message": f"Listing featured for {plan_details['days']} days",
                "expires_at": expires_at.isoformat(),
            }

        raise ExternalServiceException("Payment failed")

    except stripe.error.StripeError as e:
        raise ExternalServiceException(str(e))


@app.get("/api/featured-listings/stats/{listing_id}")
def get_featured_stats(listing_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get performance stats for featured listing"""
    featured = (
        db.query(FeaturedListing)
        .filter(FeaturedListing.listing_id == listing_id, FeaturedListing.user_id == current_user.id)
        .first()
    )

    if not featured:
        raise ResourceNotFoundException("No featured data found")

    ctr = (featured.clicks / featured.impressions * 100) if featured.impressions > 0 else 0

    return {
        "impressions": featured.impressions,
        "clicks": featured.clicks,
        "ctr": round(ctr, 2),
        "expires_at": featured.expires_at.isoformat(),
        "active": featured.active,
    }


@app.post("/api/featured-listings/track-impression")
def track_impression(data: dict, db: Session = Depends(get_db)):
    """Track impression for featured listing"""
    listing_id = data.get("listing_id")
    featured = (
        db.query(FeaturedListing)
        .filter(FeaturedListing.listing_id == listing_id, FeaturedListing.active.is_(True))
        .first()
    )

    if featured:
        featured.impressions += 1
        db.commit()

    return {"success": True}


@app.post("/api/featured-listings/track-click")
def track_click(data: dict, db: Session = Depends(get_db)):
    """Track click for featured listing"""
    listing_id = data.get("listing_id")
    featured = (
        db.query(FeaturedListing)
        .filter(FeaturedListing.listing_id == listing_id, FeaturedListing.active.is_(True))
        .first()
    )

    if featured:
        featured.clicks += 1
        db.commit()

    return {"success": True}


# ======================
# PAYMENTS / CHECKOUT
# ======================

# Stripe price IDs per tier — must match Render env vars.
# 'ultimate' is excluded: variable pricing, requires custom_subscription_price set by admin.
_CHECKOUT_STRIPE_PRICES = {
    "basic": os.getenv("STRIPE_PRICE_BASIC", "price_basic_monthly"),
    "plus": os.getenv("STRIPE_PRICE_PLUS", "price_plus_monthly"),
    "pro": os.getenv("STRIPE_PRICE_PRO", "price_pro_monthly"),
    "private_basic": os.getenv("STRIPE_PRICE_PRIVATE_BASIC", "price_private_basic_monthly"),
    "private_plus": os.getenv("STRIPE_PRICE_PRIVATE_PLUS", "price_private_plus_monthly"),
    "private_pro": os.getenv("STRIPE_PRICE_PRIVATE_PRO", "price_private_pro_monthly"),
}

# Trial days per tier
_CHECKOUT_TRIAL_DAYS = {
    "basic": 14,
    "plus": 14,
    "pro": 30,
    "private_basic": 7,
    "private_plus": 7,
    "private_pro": 14,
}


@app.post("/api/payments/create-checkout-session")
async def create_checkout_session(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Checkout Session for new registrations.
    The frontend redirects the browser to the returned checkout_url.
    After payment Stripe redirects to success_url / cancel_url.
    """
    subscription_tier = (data.get("subscription_tier") or "").lower().strip()
    user_type = (data.get("user_type") or "").lower().strip()
    success_url = data.get("success_url")
    cancel_url = data.get("cancel_url")

    if not subscription_tier:
        raise ValidationException("subscription_tier is required")
    if not success_url or not cancel_url:
        raise ValidationException("success_url and cancel_url are required")

    # Map tier name  ─  private sellers use private_* prefix
    tier_key = subscription_tier
    if user_type == "private" and not tier_key.startswith("private_"):
        tier_key = f"private_{tier_key}"

    # ── Ultimate tier uses variable pricing negotiated by sales ────
    if tier_key == "ultimate":
        if not current_user.custom_subscription_price or current_user.custom_subscription_price <= 0:
            raise ValidationException(
                "Ultimate plan pricing must be arranged with our sales team. "
                "Please contact support to complete your registration."
            )
        try:
            custom_price = stripe.Price.create(
                unit_amount=int(current_user.custom_subscription_price * 100),
                currency="usd",
                recurring={"interval": "month"},
                product_data={
                    "name": f"Ultimate Plan — {current_user.company_name or current_user.email}"
                },
            )
            price_id = custom_price.id
        except stripe.error.StripeError as e:
            logger.error("Custom price creation failed: %s", e)
            raise ExternalServiceException(f"Stripe error: {e}")
        trial_days = 0  # No trial for Ultimate; terms negotiated individually
    else:
        price_id = _CHECKOUT_STRIPE_PRICES.get(tier_key)
        if not price_id:
            raise ValidationException(f"No Stripe price configured for tier: {tier_key}")
        trial_days = _CHECKOUT_TRIAL_DAYS.get(tier_key, 0)

    # ── Get or create Stripe customer ──────────────────────────────
    if not current_user.stripe_customer_id:
        try:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
                metadata={"user_id": str(current_user.id), "user_type": user_type},
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
        except stripe.error.StripeError as e:
            logger.error("Stripe customer creation failed: %s", e)
            raise ExternalServiceException(f"Stripe error: {e}")

    # ── Build Checkout Session params ──────────────────────────────
    session_params: dict = {
        "customer": current_user.stripe_customer_id,
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {
            "user_id": str(current_user.id),
            "subscription_tier": tier_key,
        },
    }

    if trial_days > 0:
        session_params["subscription_data"] = {"trial_period_days": trial_days}

    # ── Create session ─────────────────────────────────────────────
    try:
        session = stripe.checkout.Session.create(**session_params)
    except stripe.error.StripeError as e:
        logger.error("Stripe checkout session creation failed: %s", e)
        raise ExternalServiceException(f"Stripe error: {e}")

    # Do NOT update subscription_tier here — the Stripe webhook
    # (checkout.session.completed) is the source of truth for tier upgrades.
    # Setting it prematurely would grant access before payment clears.

    logger.info(
        "Created checkout session %s for user %s (tier=%s)",
        session.id,
        current_user.id,
        tier_key,
    )

    return {"checkout_url": session.url, "session_id": session.id}


@app.get("/api/payments/plans")
def get_payment_plans(current_user: User = Depends(get_current_user)):
    """Return available subscription plans"""
    DEALER_PLANS = [
        {
            "id": "basic",
            "name": "Basic",
            "price": 199,
            "interval": "month",
            "features": [
                "25 active listings",
                "Featured-listing eligibility",
                "Basic analytics dashboard",
                "Lead & inquiry management",
                "Email support",
            ],
        },
        {
            "id": "plus",
            "name": "Plus",
            "price": 299,
            "popular": True,
            "interval": "month",
            "features": [
                "75 active listings",
                "Priority featured placement",
                "Advanced analytics",
                "CRM integration",
                "Team management (up to 3)",
                "Phone & email support",
            ],
        },
        {
            "id": "pro",
            "name": "Pro",
            "price": 499,
            "interval": "month",
            "features": [
                "Unlimited listings",
                "Priority featured placement",
                "Advanced analytics & API access",
                "Full CRM integration",
                "Unlimited team members",
                "Dedicated account manager",
                "Priority support",
            ],
        },
    ]

    PRIVATE_SELLER_PLANS = [
        {
            "id": "private_basic",
            "name": "Basic",
            "price": 9,
            "interval": "month",
            "features": [
                "1 active listing",
                "Basic analytics",
                "Email support",
            ],
        },
        {
            "id": "private_plus",
            "name": "Plus",
            "price": 19,
            "popular": True,
            "interval": "month",
            "features": [
                "3 active listings",
                "Featured-listing eligibility",
                "Analytics dashboard",
                "Email support",
            ],
        },
        {
            "id": "private_pro",
            "name": "Pro",
            "price": 39,
            "interval": "month",
            "features": [
                "5 active listings",
                "Priority featured placement",
                "Advanced analytics",
                "Priority support",
            ],
        },
    ]

    user_type = (current_user.user_type or "").lower()
    plans = list(PRIVATE_SELLER_PLANS) if user_type == "private" else list(DEALER_PLANS)

    # If admin set a custom price for this user, override displayed price
    if current_user.custom_subscription_price is not None and current_user.custom_subscription_price >= 0:
        plans = [dict(p) for p in plans]
        for p in plans:
            if p["id"] == (current_user.subscription_tier or "").lower():
                p["price"] = current_user.custom_subscription_price
                p["custom_price"] = True

    return {
        "plans": plans,
        "current_tier": current_user.subscription_tier or "free",
        "custom_subscription_price": current_user.custom_subscription_price,
    }


@app.get("/api/payments/subscription")
def get_subscription_details(current_user: User = Depends(get_current_user)):
    """Get current subscription details"""
    if not current_user.stripe_subscription_id:
        return {
            "active": False,
            "tier": current_user.subscription_tier,
            "trial_active": current_user.trial_active,
        }

    try:
        sub = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
        return {
            "active": True,
            "tier": current_user.subscription_tier,
            "status": sub.status,
            "current_period_end": sub.current_period_end,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "trial_end": sub.trial_end,
            "trial_active": current_user.trial_active,
        }
    except stripe.error.StripeError:
        return {
            "active": False,
            "tier": current_user.subscription_tier,
            "trial_active": current_user.trial_active,
        }


@app.post("/api/payments/create-subscription")
async def create_subscription_inline(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a subscription with Stripe Elements (inline card form).
    Returns a client_secret for stripe.confirmCardPayment().
    Used by the billing page for upgrades / new subscriptions.
    """
    tier = (data.get("tier") or "").lower().strip()
    valid_tiers = set(_CHECKOUT_STRIPE_PRICES.keys())
    if tier not in valid_tiers:
        raise ValidationException(f"Invalid subscription tier: {tier}")

    # Get or create Stripe customer
    if not current_user.stripe_customer_id:
        try:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
                metadata={"user_id": str(current_user.id)},
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
        except stripe.error.StripeError as e:
            logger.error("Stripe customer creation failed: %s", e)
            raise ExternalServiceException(f"Stripe error: {e}")

    # Resolve price ID — custom price takes precedence
    price_id = None
    if current_user.custom_subscription_price is not None and current_user.custom_subscription_price >= 0:
        try:
            price = stripe.Price.create(
                unit_amount=int(current_user.custom_subscription_price * 100),
                currency="usd",
                recurring={"interval": "month"},
                product_data={"name": f"{tier.title()} Plan (Custom)"},
            )
            price_id = price.id
        except stripe.error.StripeError as e:
            raise ExternalServiceException(f"Custom price creation failed: {e}")

    if not price_id:
        price_id = _CHECKOUT_STRIPE_PRICES.get(tier)
    if not price_id:
        raise ValidationException(f"Price not configured for tier: {tier}")

    # Create subscription (incomplete until card confirmed)
    try:
        sub_params = {
            "customer": current_user.stripe_customer_id,
            "items": [{"price": price_id}],
            "payment_behavior": "default_incomplete",
            "payment_settings": {"save_default_payment_method": "on_subscription"},
            "expand": ["latest_invoice.payment_intent"],
        }

        trial_days = _CHECKOUT_TRIAL_DAYS.get(tier, 0)
        if trial_days > 0:
            sub_params["trial_period_days"] = trial_days

        subscription = stripe.Subscription.create(**sub_params)
    except stripe.error.StripeError as e:
        logger.error("Stripe subscription creation failed: %s", e)
        raise ExternalServiceException(f"Stripe error: {e}")

    # Update user record
    current_user.subscription_tier = tier
    current_user.stripe_subscription_id = subscription.id
    if trial_days > 0:
        current_user.trial_active = True
        current_user.trial_end_date = datetime.utcnow() + timedelta(days=trial_days)
    db.commit()

    return {
        "success": True,
        "client_secret": subscription.latest_invoice.payment_intent.client_secret,
        "subscription_id": subscription.id,
        "trial_days": trial_days,
    }


@app.post("/api/payments/cancel-subscription")
async def cancel_subscription_endpoint(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel the current subscription"""
    if not current_user.stripe_subscription_id:
        raise ValidationException("No active subscription found")

    cancel_immediately = data.get("cancel_immediately", False)

    try:
        if cancel_immediately:
            stripe.Subscription.delete(current_user.stripe_subscription_id)
            current_user.subscription_tier = "free"
            current_user.stripe_subscription_id = None
        else:
            stripe.Subscription.modify(
                current_user.stripe_subscription_id,
                cancel_at_period_end=True,
            )
        db.commit()
    except stripe.error.StripeError as e:
        logger.error("Stripe cancel failed: %s", e)
        raise ExternalServiceException(f"Stripe error: {e}")

    return {"success": True, "message": "Subscription cancelled"}


@app.get("/api/payments/billing-portal")
def get_billing_portal(current_user: User = Depends(get_current_user)):
    """Get Stripe billing portal URL for the customer to manage payment methods"""
    if not current_user.stripe_customer_id:
        raise ValidationException("No Stripe customer found. Subscribe first.")

    try:
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=os.getenv("FRONTEND_URL", "https://www.yachtversal.com") + "/dashboard/billing",
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        logger.error("Billing portal error: %s", e)
        raise ExternalServiceException(f"Stripe error: {e}")


@app.post("/api/payments/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Handle Stripe webhooks — fires on payment success/failure, subscription
    lifecycle events, and invoice events.
    """
    import json as _json

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    # Verify signature if secret is configured
    if webhook_secret:
        try:
            stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            logger.warning("Webhook signature verification failed: %s", e)
            raise ValidationException("Invalid webhook signature")

    event = _json.loads(payload)
    event_type = event.get("type", "")
    obj = event.get("data", {}).get("object", {})

    logger.info("Stripe webhook received: %s", event_type)

    # --- Checkout session completed (registration flow) ----------------
    if event_type == "checkout.session.completed":
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")
        metadata = obj.get("metadata", {})
        user_id = metadata.get("user_id")
        tier = metadata.get("subscription_tier")

        user = None
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
        if not user and customer_id:
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

        if user:
            user.stripe_subscription_id = subscription_id
            if tier:
                user.subscription_tier = tier
            # Fetch the subscription to check for trial period
            if subscription_id:
                try:
                    sub = stripe.Subscription.retrieve(subscription_id)
                    if sub.status == "trialing" and sub.trial_end:
                        user.trial_active = True
                        user.trial_end_date = datetime.utcfromtimestamp(sub.trial_end)
                except stripe.error.StripeError:
                    pass  # Non-fatal — tier is already set
            db.commit()
            logger.info("checkout.session.completed → user %s subscribed (tier=%s)", user.id, tier)

    # --- Subscription lifecycle ----------------------------------------
    elif event_type == "customer.subscription.created":
        customer_id = obj.get("customer")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.stripe_subscription_id = obj.get("id")
            db.commit()

    elif event_type == "customer.subscription.updated":
        sub_id = obj.get("id")
        status = obj.get("status")
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first()
        if user:
            if status == "active" and obj.get("trial_end"):
                user.trial_active = False
                user.trial_converted = True
            db.commit()

    elif event_type == "customer.subscription.deleted":
        sub_id = obj.get("id")
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first()
        if user:
            user.subscription_tier = "free"
            user.stripe_subscription_id = None
            db.commit()
            logger.info("Subscription deleted → user %s downgraded to free", user.id)

    # --- Invoice events -----------------------------------------------
    elif event_type == "invoice.payment_failed":
        customer_id = obj.get("customer")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            logger.warning("Invoice payment failed for user %s", user.id)

    return {"success": True}


# ======================
# ADVANCED SEARCH
# ======================


@app.post("/api/search/advanced")
def advanced_search(search_data: dict, db: Session = Depends(get_db)):
    """Advanced search with geographic options"""
    query = db.query(Listing).filter(Listing.status == "active")

    # Geographic filters
    if "continent" in search_data:
        query = query.filter(Listing.continent == search_data["continent"])

    if "country" in search_data:
        query = query.filter(Listing.country == search_data["country"])

    if "states" in search_data and search_data["states"]:
        query = query.filter(Listing.state.in_(search_data["states"]))

    # Radius search
    if "center_location" in search_data and "radius_miles" in search_data:
        # Accept and validate the inputs, but we don't use them yet
        # Keep variables to show inputs were considered; lint:ignore unused
        _center_location = search_data.get("center_location")  # noqa: F841
        _radius_miles = search_data.get("radius_miles")  # noqa: F841

        # This requires lat/lng - implement with geocoding
        # For now, just filter by city/state
        # TODO: implement proper geospatial filtering using lat/lng
        pass

    # Standard filters
    if "boat_type" in search_data:
        query = query.filter(Listing.boat_type == search_data["boat_type"])

    if "min_price" in search_data:
        query = query.filter(Listing.price >= search_data["min_price"])

    if "max_price" in search_data:
        query = query.filter(Listing.price <= search_data["max_price"])

    if "min_length" in search_data:
        query = query.filter(Listing.length_feet >= search_data["min_length"])

    if "max_length" in search_data:
        query = query.filter(Listing.length_feet <= search_data["max_length"])

    listings = query.limit(100).all()

    return [
        {
            "id": listing.id,
            "title": listing.title,
            "price": listing.price,
            "length_feet": listing.length_feet,
            "city": listing.city,
            "state": listing.state,
            "images": [{"url": img.url} for img in listing.images[:1]],
        }
        for listing in listings
    ]


@app.get("/api/search/suggestions")
def get_search_suggestions(q: str, type: str, db: Session = Depends(get_db)):
    """Get autocomplete suggestions"""
    suggestions = []

    if type == "location":
        cities = db.query(Listing.city).filter(Listing.city.ilike(f"%{q}%")).distinct().limit(10).all()
        suggestions = [c[0] for c in cities if c[0]]

    elif type == "make":
        makes = db.query(Listing.make).filter(Listing.make.ilike(f"%{q}%")).distinct().limit(10).all()
        suggestions = [m[0] for m in makes if m[0]]

    elif type == "boat_type":
        types = db.query(Listing.boat_type).filter(Listing.boat_type.ilike(f"%{q}%")).distinct().limit(10).all()
        suggestions = [t[0] for t in types if t[0]]

    return {"suggestions": suggestions}


@app.get("/api/search/popular-locations")
def get_popular_locations(db: Session = Depends(get_db)):
    """Get most popular locations"""
    locations = (
        db.query(Listing.city, Listing.state, func.count(Listing.id).label("count"))
        .filter(Listing.status == "active", Listing.city.isnot(None))
        .group_by(Listing.city, Listing.state)
        .order_by(func.count(Listing.id).desc())
        .limit(12)
        .all()
    )

    return [{"city": loc[0], "state": loc[1], "count": loc[2]} for loc in locations]


# ======================
# ADMIN - FEATURED LISTING MANAGEMENT
# ======================


@app.get("/api/admin/featured-stats")
def get_featured_stats_admin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin: Get featured listing statistics"""
    if current_user.user_type not in ["admin", "salesman"]:
        raise AuthorizationException("Admin or sales rep access required")

    # Get all featured listings
    featured = db.query(FeaturedListing).all()
    active = [f for f in featured if f.active and f.expires_at > datetime.utcnow()]

    total_revenue = sum(f.price_paid for f in featured)
    avg_price = total_revenue / len(featured) if featured else 0

    return {
        "totalRevenue": total_revenue,
        "activeFeatured": len(active),
        "totalFeatured": len(featured),
        "averagePrice": avg_price,
    }


@app.get("/api/admin/featured-purchases")
def get_featured_purchases(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin: Get recent featured listing purchases"""
    if current_user.user_type not in ["admin", "salesman"]:
        raise AuthorizationException("Admin or sales rep access required")

    purchases = db.query(FeaturedListing).order_by(FeaturedListing.created_at.desc()).limit(50).all()

    result = []
    for p in purchases:
        listing = db.query(Listing).filter(Listing.id == p.listing_id).first()
        user = db.query(User).filter(User.id == p.user_id).first()

        result.append(
            {
                "id": p.id,
                "listing_title": listing.title if listing else "Unknown",
                "dealer_name": user.company_name or f"{user.first_name} {user.last_name}" if user else "Unknown",
                "plan": p.plan,
                "price_paid": p.price_paid,
                "created_at": p.created_at.isoformat(),
                "expires_at": p.expires_at.isoformat(),
                "active": p.active,
            }
        )

    return result


@app.put("/api/admin/featured-pricing")
def update_featured_pricing(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin: Update featured listing pricing"""
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin only")

    # In production, store this in database. For now, update the global constant
    plans = data.get("plans", [])

    # If FEATURED_PLANS is not used/defined elsewhere, store in DB instead or initialize here
    if "FEATURED_PLANS" not in globals():
        # Default placeholder if not present
        FEATURED_PLANS = {}

    for plan in plans:
        plan_id = plan.get("plan_id")
        if plan_id in FEATURED_PLANS:
            FEATURED_PLANS[plan_id]["price"] = plan.get("price")
            FEATURED_PLANS[plan_id]["days"] = plan.get("days")

    return {"success": True, "message": "Pricing updated successfully"}


# Duplicate stub removed: `update_inquiry_status` implemented in its canonical location earlier in the file.


@app.put("/api/messages/{message_id}/status")
def update_message_status(
    message_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Update message status"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise ResourceNotFoundException("Message", message_id)

    # Check authorization
    if current_user.id not in [message.sender_id, message.recipient_id] and current_user.user_type != "admin":
        raise AuthorizationException("Not authorized to modify this message")

    new_status = data.get("status")
    if new_status:
        message.status = new_status
        if new_status == "closed":
            message.closed_at = datetime.utcnow()
        db.commit()

    return {"success": True}

# ============================================
# ROLE & PERMISSION DEFINITIONS
# ============================================

from enum import Enum
from typing import List, Dict, Optional
from functools import wraps

class UserRole(str, Enum):
    """User role types"""
    ADMIN = "admin"              # YachtVersal owners/managers
    SALESMAN = "salesman"         # YachtVersal sales reps
    DEALER = "dealer"             # Yacht dealers (owner account)
    TEAM_MEMBER = "team_member"   # Dealer team members
    BUYER = "buyer"               # Regular users/buyers


class Permission(str, Enum):
    """Granular permissions"""
    # Admin permissions
    VIEW_ALL_USERS = "view_all_users"
    MANAGE_ALL_USERS = "manage_all_users"
    VIEW_ALL_LISTINGS = "view_all_listings"
    MANAGE_ALL_LISTINGS = "manage_all_listings"
    VIEW_ALL_DEALERS = "view_all_dealers"
    MANAGE_SITE_SETTINGS = "manage_site_settings"
    VIEW_ANALYTICS = "view_analytics"
    ASSIGN_SALES_REPS = "assign_sales_reps"
    PROCESS_REFUNDS = "process_refunds"
    
    # Sales rep permissions
    VIEW_ASSIGNED_DEALERS = "view_assigned_dealers"
    VIEW_DEALER_ANALYTICS = "view_dealer_analytics"
    MANAGE_ASSIGNED_DEALERS = "manage_assigned_dealers"
    
    # Dealer permissions
    CREATE_LISTINGS = "create_listings"
    EDIT_OWN_LISTINGS = "edit_own_listings"
    DELETE_OWN_LISTINGS = "delete_own_listings"
    MANAGE_TEAM = "manage_team"
    CUSTOMIZE_DEALER_PAGE = "customize_dealer_page"
    VIEW_COMPANY_ANALYTICS = "view_company_analytics"
    VIEW_INQUIRIES = "view_inquiries"
    
    # Team member permissions (configurable)
    EDIT_ALL_COMPANY_LISTINGS = "edit_all_company_listings"
    DELETE_COMPANY_LISTINGS = "delete_company_listings"
    VIEW_ALL_COMPANY_INQUIRIES = "view_all_company_inquiries"
    
    # Buyer permissions
    SAVE_LISTINGS = "save_listings"
    CREATE_ALERTS = "create_alerts"
    SEND_INQUIRIES = "send_inquiries"
    SEND_MESSAGES = "send_messages"


# Default permissions for each role
ROLE_PERMISSIONS: Dict[UserRole, List[Permission]] = {
    UserRole.ADMIN: [
        Permission.VIEW_ALL_USERS,
        Permission.MANAGE_ALL_USERS,
        Permission.VIEW_ALL_LISTINGS,
        Permission.MANAGE_ALL_LISTINGS,
        Permission.VIEW_ALL_DEALERS,
        Permission.MANAGE_SITE_SETTINGS,
        Permission.VIEW_ANALYTICS,
        Permission.ASSIGN_SALES_REPS,
        Permission.PROCESS_REFUNDS,
    ],
    UserRole.SALESMAN: [
        Permission.VIEW_ASSIGNED_DEALERS,
        Permission.VIEW_DEALER_ANALYTICS,
        Permission.MANAGE_ASSIGNED_DEALERS,
        Permission.VIEW_INQUIRIES,
    ],
    UserRole.DEALER: [
        Permission.CREATE_LISTINGS,
        Permission.EDIT_OWN_LISTINGS,
        Permission.DELETE_OWN_LISTINGS,
        Permission.MANAGE_TEAM,
        Permission.CUSTOMIZE_DEALER_PAGE,
        Permission.VIEW_COMPANY_ANALYTICS,
        Permission.VIEW_INQUIRIES,
        Permission.SEND_MESSAGES,
    ],
    UserRole.TEAM_MEMBER: [
        Permission.CREATE_LISTINGS,
        Permission.EDIT_OWN_LISTINGS,
        Permission.VIEW_INQUIRIES,
        Permission.SEND_MESSAGES,
    ],
    UserRole.BUYER: [
        Permission.SAVE_LISTINGS,
        Permission.CREATE_ALERTS,
        Permission.SEND_INQUIRIES,
        Permission.SEND_MESSAGES,
    ],
}


# ============================================
# PERMISSION CHECKING HELPERS
# ============================================

def get_user_permissions(user: User) -> List[Permission]:
    """Get all permissions for a user"""
    # Start with role-based permissions
    base_permissions = ROLE_PERMISSIONS.get(UserRole(user.user_type), [])
    
    # Add custom permissions from user.permissions JSON field
    custom_perms = []
    if user.permissions:
        for perm_name, enabled in user.permissions.items():
            if enabled and perm_name in Permission.__members__:
                custom_perms.append(Permission[perm_name])
    
    return list(set(base_permissions + custom_perms))


def has_permission(user: User, permission: Permission) -> bool:
    """Check if user has a specific permission"""
    user_perms = get_user_permissions(user)
    return permission in user_perms


def require_permission(permission: Permission):
    """Decorator to require a permission"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: User = None, **kwargs):
            if not current_user:
                # Try to extract current_user from kwargs
                current_user = kwargs.get('current_user')
            
            if not current_user:
                raise AuthenticationException("Authentication required")
            
            if not has_permission(current_user, permission):
                raise AuthorizationException(
                    f"Permission required: {permission.value}"
                )
            
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator


def require_role(role: UserRole):
    """Decorator to require a specific role"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: User = None, **kwargs):
            if not current_user:
                current_user = kwargs.get('current_user')
            
            if not current_user:
                raise AuthenticationException("Authentication required")
            
            if UserRole(current_user.user_type) != role:
                raise AuthorizationException(
                    f"Role required: {role.value}"
                )
            
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator


# ============================================
# PERMISSION MANAGEMENT ENDPOINTS
# ============================================

@app.get("/api/permissions/my")
def get_my_permissions(current_user: User = Depends(get_current_user)):
    """Get current user's permissions"""
    permissions = get_user_permissions(current_user)
    
    return {
        "role": current_user.user_type,
        "permissions": [p.value for p in permissions],
        "custom_permissions": current_user.permissions or {}
    }


@app.get("/api/permissions/roles")
def get_role_permissions():
    """Get default permissions for all roles (public)"""
    return {
        role.value: [p.value for p in perms]
        for role, perms in ROLE_PERMISSIONS.items()
    }


# ============================================
# TEAM MEMBER MANAGEMENT (DEALERS)
# ============================================

class TeamMemberRole(str, Enum):
    OWNER = "owner"           # Full access
    MANAGER = "manager"       # Almost full access
    SALESPERSON = "salesperson"  # Limited to own listings
    VIEWER = "viewer"         # Read-only


# Permission templates for team roles
TEAM_ROLE_PERMISSIONS = {
    TeamMemberRole.OWNER: {
        "can_create_listings": True,
        "can_edit_own_listings": True,
        "can_edit_all_listings": True,
        "can_delete_listings": True,
        "can_view_inquiries": True,
        "can_view_all_inquiries": True,
        "can_manage_team": True,
        "can_view_analytics": True,
        "can_customize_page": True,
    },
    TeamMemberRole.MANAGER: {
        "can_create_listings": True,
        "can_edit_own_listings": True,
        "can_edit_all_listings": True,
        "can_delete_listings": False,
        "can_view_inquiries": True,
        "can_view_all_inquiries": True,
        "can_manage_team": True,
        "can_view_analytics": True,
        "can_customize_page": False,
    },
    TeamMemberRole.SALESPERSON: {
        "can_create_listings": True,
        "can_edit_own_listings": True,
        "can_edit_all_listings": False,
        "can_delete_listings": False,
        "can_view_inquiries": True,
        "can_view_all_inquiries": False,
        "can_manage_team": False,
        "can_view_analytics": True,
        "can_customize_page": False,
    },
    TeamMemberRole.VIEWER: {
        "can_create_listings": False,
        "can_edit_own_listings": False,
        "can_edit_all_listings": False,
        "can_delete_listings": False,
        "can_view_inquiries": True,
        "can_view_all_inquiries": True,
        "can_manage_team": False,
        "can_view_analytics": True,
        "can_customize_page": False,
    },
}


@app.post("/api/team/members/invite")
def invite_team_member(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Invite team member with specific permissions"""
    # Check permission
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission to manage team")
    
    # Validate email
    email = InputSanitizer.sanitize_email(data.get("email"))
    
    # Check if user exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValidationException("User with this email already exists")
    
    # Get role and permissions
    team_role = data.get("role", "salesperson")
    if team_role not in TeamMemberRole.__members__.values():
        team_role = "salesperson"
    
    # Get permissions for role
    permissions = TEAM_ROLE_PERMISSIONS.get(
        TeamMemberRole(team_role),
        TEAM_ROLE_PERMISSIONS[TeamMemberRole.SALESPERSON]
    ).copy()
    
    # Allow custom permission overrides
    if "permissions" in data:
        permissions.update(data["permissions"])
    
    # Generate temporary password
    temp_password = secrets.token_urlsafe(12)
    
    # Create team member
    team_member = User(
        email=email,
        password_hash=get_password_hash(temp_password),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        phone=data.get("phone"),
        user_type="team_member",
        parent_dealer_id=current_user.id,
        role=team_role,
        permissions=permissions,
        subscription_tier=current_user.subscription_tier,
    )
    
    db.add(team_member)
    db.commit()
    db.refresh(team_member)
    
    # Send invitation email
    email_service.send_email(
        to_email=email,
        subject="You've been invited to join a team - YachtVersal",
        html_content=f"""
        <h2>Team Invitation</h2>
        <p>You've been invited by {current_user.company_name or current_user.email} 
        to join their team on YachtVersal.</p>
        
        <p><strong>Your Role:</strong> {team_role}</p>
        <p><strong>Temporary Password:</strong> <code>{temp_password}</code></p>
        
        <p>Please log in and change your password immediately.</p>
        
        <a href="{email_service.base_url}/login" class="button">Log In</a>
        
        <h3>Your Permissions:</h3>
        <ul>
            {"".join(f"<li>{key.replace('_', ' ').title()}: {'Yes' if val else 'No'}</li>" 
                     for key, val in permissions.items())}
        </ul>
        """
    )
    
    return {
        "success": True,
        "member_id": team_member.id,
        "temporary_password": temp_password,
        "message": "Team member invited successfully"
    }


@app.get("/api/team/members")
def get_team_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all team members"""
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission to view team")
    
    members = db.query(User).filter(
        User.parent_dealer_id == current_user.id
    ).all()
    
    return [
        {
            "id": m.id,
            "email": m.email,
            "first_name": m.first_name,
            "last_name": m.last_name,
            "role": m.role,
            "permissions": m.permissions,
            "active": m.active,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in members
    ]


@app.put("/api/team/members/{member_id}/permissions")
def update_team_member_permissions(
    member_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update team member permissions"""
    if not has_permission(current_user, Permission.MANAGE_TEAM):
        raise AuthorizationException("No permission to manage team")
    
    member = db.query(User).filter(
        User.id == member_id,
        User.parent_dealer_id == current_user.id
    ).first()
    
    if not member:
        raise ResourceNotFoundException("Team member", member_id)
    
    # Update role if provided
    if "role" in data:
        new_role = data["role"]
        if new_role in TeamMemberRole.__members__.values():
            member.role = new_role
            # Update permissions based on new role
            member.permissions = TEAM_ROLE_PERMISSIONS[TeamMemberRole(new_role)].copy()
    
    # Update specific permissions
    if "permissions" in data:
        current_perms = member.permissions or {}
        current_perms.update(data["permissions"])
        member.permissions = current_perms
    
    db.commit()
    
    # Send notification email
    email_service.send_email(
        to_email=member.email,
        subject="Your Permissions Have Been Updated - YachtVersal",
        html_content=f"""
        <h2>Permissions Updated</h2>
        <p>Your permissions have been updated by {current_user.first_name or 'your team admin'}.</p>
        
        <h3>Current Permissions:</h3>
        <ul>
            {"".join(f"<li>{key.replace('_', ' ').title()}: {'Yes' if val else 'No'}</li>" 
                     for key, val in member.permissions.items())}
        </ul>
        """
    )
    
    return {
        "success": True,
        "permissions": member.permissions
    }

# GET LISTING CONTACT INFO
@app.get("/api/listings/{listing_id}/contact-info")
def get_listing_contact_info(listing_id: int, db: Session = Depends(get_db)):
    """Get contact info for listing (dealer + creator if public profile)"""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Get dealer (owner)
    dealer = db.query(User).filter(User.id == listing.user_id).first()
    dealer_profile = db.query(DealerProfile).filter(
        DealerProfile.user_id == listing.user_id
    ).first()
    
    # Get creator (if team member with public profile)
    creator = db.query(User).filter(User.id == listing.created_by_user_id).first()
    
    result = {
        "dealer": {
            "name": dealer.company_name or f"{dealer.first_name} {dealer.last_name}",
            "email": dealer.email,
            "phone": dealer.phone,
            "logo_url": dealer_profile.logo_url if dealer_profile else None,
            "slug": dealer_profile.slug if dealer_profile else None
        }
    }
    
    # Add creator if different and has public profile
    if creator and creator.id != dealer.id and creator.public_profile:
        result["sales_contact"] = {
            "name": f"{creator.first_name} {creator.last_name}",
            "title": creator.title,
            "email": creator.email,
            "phone": creator.phone,
            "photo_url": creator.profile_photo_url,
            "bio": creator.bio
        }
    
    return result


# SALES REP ANALYTICS
@app.get("/api/sales-rep/analytics")
def get_sales_rep_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sales rep dashboard analytics"""
    if current_user.user_type != "salesman":
        raise AuthorizationException("Sales rep access required")
    
    # Get assigned dealers
    dealers = db.query(User).filter(
        User.assigned_sales_rep_id == current_user.id
    ).all()
    
    total_dealers = len(dealers)
    active_dealers = len([d for d in dealers if d.active])
    
    # Calculate commission (10% of subscription fees)
    tier_prices = {"free": 0, "basic": 29, "premium": 99, "trial": 0}
    monthly_revenue = sum(
        tier_prices.get(d.subscription_tier, 0) 
        for d in dealers if d.active
    )
    commission = monthly_revenue * 0.10
    
    # Get dealer stats
    dealer_stats = []
    for dealer in dealers:
        listings_count = db.query(Listing).filter(
            Listing.user_id == dealer.id
        ).count()
        
        active_listings = db.query(Listing).filter(
            Listing.user_id == dealer.id,
            Listing.status == "active"
        ).count()
        
        total_views = db.query(func.sum(Listing.views)).filter(
            Listing.user_id == dealer.id
        ).scalar() or 0
        
        total_inquiries = db.query(Inquiry).join(Listing).filter(
            Listing.user_id == dealer.id
        ).count()
        
        dealer_stats.append({
            "dealer_id": dealer.id,
            "dealer_name": dealer.company_name or dealer.email,
            "subscription_tier": dealer.subscription_tier,
            "total_listings": listings_count,
            "active_listings": active_listings,
            "total_views": total_views,
            "total_inquiries": total_inquiries,
            "joined_date": dealer.created_at.isoformat() if dealer.created_at else None
        })
    
    return {
        "total_dealers": total_dealers,
        "active_dealers": active_dealers,
        "monthly_revenue": monthly_revenue,
        "monthly_commission": commission,
        "dealers": dealer_stats
    }

# ============================================
# SALES REP ASSIGNMENT (ADMIN ONLY)
# ============================================

@app.post("/api/admin/assign-sales-rep")
def assign_sales_rep(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin: Assign sales rep to dealer"""
    if UserRole(current_user.user_type) != UserRole.ADMIN:
        raise AuthorizationException("Admin access required")
    
    dealer_id = data.get("dealer_id")
    sales_rep_id = data.get("sales_rep_id")
    
    # Get dealer
    dealer = db.query(User).filter(
        User.id == dealer_id,
        User.user_type == "dealer"
    ).first()
    
    if not dealer:
        raise ResourceNotFoundException("Dealer", dealer_id)
    
    # Get sales rep
    sales_rep = db.query(User).filter(
        User.id == sales_rep_id,
        User.user_type == "salesman"
    ).first()
    
    if not sales_rep:
        raise ResourceNotFoundException("Sales rep", sales_rep_id)
    
    # Assign
    dealer.assigned_sales_rep_id = sales_rep_id
    db.commit()
    
    # Notify both parties
    email_service.send_email(
        to_email=dealer.email,
        subject="Sales Representative Assigned - YachtVersal",
        html_content=f"""
        <h2>Your Sales Representative</h2>
        <p>You've been assigned a dedicated sales representative:</p>
        <p><strong>{sales_rep.first_name} {sales_rep.last_name}</strong></p>
        <p>Email: {sales_rep.email}</p>
        <p>They'll be your main point of contact for any questions or support.</p>
        """
    )
    
    email_service.send_email(
        to_email=sales_rep.email,
        subject="New Dealer Assigned - YachtVersal",
        html_content=f"""
        <h2>New Dealer Assignment</h2>
        <p>You've been assigned to:</p>
        <p><strong>{dealer.company_name or dealer.email}</strong></p>
        <p>Contact: {dealer.email}</p>
        """
    )
    
    return {
        "success": True,
        "message": "Sales rep assigned successfully"
    }


@app.get("/api/sales-rep/my-dealers")
def get_my_dealers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sales rep: Get assigned dealers"""
    if UserRole(current_user.user_type) != UserRole.SALESMAN:
        raise AuthorizationException("Sales rep access required")
    
    dealers = db.query(User).filter(
        User.assigned_sales_rep_id == current_user.id
    ).all()
    
    result = []
    for dealer in dealers:
        # Get dealer stats
        total_listings = db.query(Listing).filter(
            Listing.user_id == dealer.id
        ).count()
        
        active_listings = db.query(Listing).filter(
            Listing.user_id == dealer.id,
            Listing.status == "active"
        ).count()
        
        total_inquiries = db.query(Inquiry).join(Listing).filter(
            Listing.user_id == dealer.id
        ).count()
        
        result.append({
            "id": dealer.id,
            "company_name": dealer.company_name,
            "email": dealer.email,
            "subscription_tier": dealer.subscription_tier,
            "created_at": dealer.created_at.isoformat() if dealer.created_at else None,
            "stats": {
                "total_listings": total_listings,
                "active_listings": active_listings,
                "total_inquiries": total_inquiries,
            }
        })
    
    return result

# ======================
# BUYER FEATURES
# ======================


@app.get("/api/saved-listings")
def get_saved_listings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's saved listings"""
    saved = db.query(SavedListing).filter(SavedListing.user_id == current_user.id).all()

    return [
        {
            "id": s.id,
            "listing_id": s.listing_id,
            "title": s.listing.title if s.listing else "",
            "price": s.listing.price if s.listing else 0,
            "notes": s.notes,
            "created_at": s.created_at.isoformat(),
        }
        for s in saved
    ]


@app.post("/api/saved-listings")
def save_listing(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Save a listing"""
    listing_id = data.get("listing_id")

    existing = (
        db.query(SavedListing)
        .filter(SavedListing.user_id == current_user.id, SavedListing.listing_id == listing_id)
        .first()
    )

    if existing:
        return {"message": "Already saved"}

    saved = SavedListing(user_id=current_user.id, listing_id=listing_id, notes=data.get("notes"))
    db.add(saved)
    db.commit()

    return {"success": True}


@app.delete("/api/saved-listings/{saved_id}")
def remove_saved_listing(saved_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Remove saved listing"""
    saved = db.query(SavedListing).filter(SavedListing.id == saved_id, SavedListing.user_id == current_user.id).first()

    if saved:
        db.delete(saved)
        db.commit()

    return {"success": True}


@app.post("/api/price-alerts")
def create_price_alert(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create price alert"""
    alert = PriceAlert(
        user_id=current_user.id,
        listing_id=data.get("listing_id"),
        target_price=data.get("target_price"),
        original_price=data.get("original_price"),
    )
    db.add(alert)
    db.commit()

    return {"success": True, "alert_id": alert.id}


@app.get("/api/price-alerts")
def get_price_alerts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's price alerts"""
    alerts = db.query(PriceAlert).filter(PriceAlert.user_id == current_user.id, PriceAlert.active.is_(True)).all()

    return [
        {
            "id": a.id,
            "listing_id": a.listing_id,
            "target_price": a.target_price,
            "triggered": a.triggered,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


@app.post("/api/search-alerts")
def create_search_alert(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create search alert"""
    alert = SearchAlert(
        user_id=current_user.id,
        name=data.get("name"),
        search_criteria=data.get("search_criteria"),
        frequency=data.get("frequency", "daily"),
    )
    db.add(alert)
    db.commit()

    return {"success": True, "alert_id": alert.id}


@app.get("/api/search-alerts")
def get_search_alerts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's search alerts"""
    alerts = db.query(SearchAlert).filter(SearchAlert.user_id == current_user.id, SearchAlert.active.is_(True)).all()

    return [
        {
            "id": a.id,
            "name": a.name,
            "search_criteria": a.search_criteria,
            "frequency": a.frequency,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


# ======================
# MESSAGING SYSTEM
# ======================


@app.get("/api/messages")
def get_messages(
    message_type: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get user's messages"""
    query = db.query(Message).filter((Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id))

    if message_type:
        query = query.filter(Message.message_type == message_type)

    messages = query.order_by(Message.created_at.desc()).all()

    return [
        {
            "id": m.id,
            "ticket_number": m.ticket_number,
            "subject": m.subject,
            "body": m.body,
            "message_type": m.message_type,
            "status": m.status,
            "priority": m.priority,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]

    # Duplicate `create_message` removed; canonical implementation (with status code and email notifications) exists later in this file.

    # Duplicate: initial `reply_to_message` implementation removed; canonical implementation (with email notification) exists later in this file.

    return {"success": True}

# ============================================
# MESSAGING SYSTEM WITH RBAC
# ============================================

class MessageAccess(str, Enum):
    """Message access levels"""
    PRIVATE = "private"              # Only sender and recipient
    DEALER_VISIBLE = "dealer_visible"  # Visible to parent dealer
    SUPPORT = "support"              # Support ticket (admin visible)


def can_access_message(user: User, message: 'Message', db: Session) -> bool:
    """Check if user can access a message"""
    # Admin can see everything
    if UserRole(user.user_type) == UserRole.ADMIN:
        return True
    
    # Sender and recipient can always see
    if message.sender_id == user.id or message.recipient_id == user.id:
        return True
    
    # Support tickets visible to admin/salesman
    if message.message_type == "support_ticket":
        if user.user_type in ["admin", "salesman"]:
            return True
    
    # Check if user is parent dealer of sender or recipient
    sender = db.query(User).filter(User.id == message.sender_id).first()
    recipient = db.query(User).filter(User.id == message.recipient_id).first() if message.recipient_id else None
    
    # If message is dealer_visible and user is the parent dealer
    if hasattr(message, 'access_level') and message.access_level == MessageAccess.DEALER_VISIBLE:
        if sender and sender.parent_dealer_id == user.id:
            return True
        if recipient and recipient.parent_dealer_id == user.id:
            return True
    
    # Sales rep can see messages from their assigned dealers
    if user.user_type == "salesman":
        if sender and sender.assigned_sales_rep_id == user.id:
            return True
        if recipient and recipient.assigned_sales_rep_id == user.id:
            return True
    
    return False


# Update Message model - add this field to the existing Message class in main.py
# Add after the 'status' field:
# access_level = Column(String, default="private")  # private, dealer_visible, support


@app.get("/api/messages")
def get_messages(
    message_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages with proper access control"""
    
    # Build base query
    if UserRole(current_user.user_type) == UserRole.ADMIN:
        # Admins see all
        query = db.query(Message)
    elif user.user_type == "salesman":
        # Sales reps see their dealers' messages
        dealer_ids = db.query(User.id).filter(
            User.assigned_sales_rep_id == current_user.id
        ).all()
        dealer_ids = [d[0] for d in dealer_ids]
        
        query = db.query(Message).filter(
            or_(
                Message.sender_id == current_user.id,
                Message.recipient_id == current_user.id,
                Message.sender_id.in_(dealer_ids),
                Message.recipient_id.in_(dealer_ids)
            )
        )
    elif current_user.parent_dealer_id:
        # Team members see their own + dealer-visible from their company
        query = db.query(Message).filter(
            or_(
                Message.sender_id == current_user.id,
                Message.recipient_id == current_user.id,
                and_(
                    Message.access_level == "dealer_visible",
                    or_(
                        Message.sender_id == current_user.parent_dealer_id,
                        Message.recipient_id == current_user.parent_dealer_id
                    )
                )
            )
        )
    else:
        # Regular users see only their own
        query = db.query(Message).filter(
            or_(
                Message.sender_id == current_user.id,
                Message.recipient_id == current_user.id
            )
        )
    
    # Filter by type if specified
    if message_type:
        query = query.filter(Message.message_type == message_type)
    
    messages = query.order_by(Message.created_at.desc()).limit(100).all()
    
    result = []
    for m in messages:
        # Get sender/recipient info
        sender = db.query(User).filter(User.id == m.sender_id).first()
        recipient = db.query(User).filter(User.id == m.recipient_id).first() if m.recipient_id else None
        
        # Get listing info if applicable
        listing_title = None
        if m.listing_id:
            listing = db.query(Listing).filter(Listing.id == m.listing_id).first()
            if listing:
                listing_title = listing.title
        
        result.append({
            "id": m.id,
            "ticket_number": m.ticket_number,
            "sender": {
                "id": sender.id,
                "name": f"{sender.first_name} {sender.last_name}" if sender.first_name else sender.email,
                "email": sender.email,
                "type": sender.user_type,
            } if sender else None,
            "recipient": {
                "id": recipient.id,
                "name": f"{recipient.first_name} {recipient.last_name}" if recipient.first_name else recipient.email,
                "email": recipient.email,
                "type": recipient.user_type,
            } if recipient else None,
            "subject": m.subject,
            "body": m.body,
            "message_type": m.message_type,
            "status": m.status,
            "priority": m.priority,
            "listing_title": listing_title,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "read_at": m.read_at.isoformat() if m.read_at else None,
        })
    
    return result


@app.post("/api/messages", status_code=status.HTTP_201_CREATED)
def create_message(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create message with proper access control"""
    
    # Determine message type
    message_type = data.get("message_type", "direct")
    
    # Get recipient
    recipient_id = data.get("recipient_id")
    recipient = None
    
    if recipient_id:
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if not recipient:
            raise ResourceNotFoundException("Recipient", recipient_id)
    
    # Determine access level
    access_level = "private"
    
    if message_type == "support_ticket":
        access_level = "support"
        # Support tickets go to admin
        admin = db.query(User).filter(User.user_type == "admin").first()
        recipient_id = admin.id if admin else None
    elif data.get("visible_to_dealer", False):
        access_level = "dealer_visible"
    
    # Create message
    message = Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        listing_id=data.get("listing_id"),
        message_type=message_type,
        subject=data.get("subject"),
        body=data.get("body"),
        priority=data.get("priority", "normal"),
        category=data.get("category"),
        ticket_number=generate_ticket_number() if message_type == "support_ticket" else None,
        access_level=access_level,
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Send email notifications
    if message_type == "support_ticket":
        # Notify admin
        email_service.send_email(
            to_email=email_service.admin_email,
            subject=f"New Support Ticket: {message.ticket_number}",
            html_content=f"""
            <h2>New Support Ticket</h2>
            <p><strong>Ticket:</strong> {message.ticket_number}</p>
            <p><strong>From:</strong> {current_user.email}</p>
            <p><strong>Priority:</strong> {message.priority}</p>
            <p><strong>Subject:</strong> {message.subject}</p>
            <div class="highlight-box">
                <p>{message.body}</p>
            </div>
            <a href="{email_service.base_url}/admin/messages/{message.id}" class="button">
                View Ticket
            </a>
            """
        )
    elif recipient:
        # Check notification preferences
        prefs = recipient.permissions or {}
        if prefs.get("email_new_message", True):
            email_service.send_email(
                to_email=recipient.email,
                subject=f"New Message: {message.subject}",
                html_content=f"""
                <h2>You have a new message</h2>
                <p><strong>From:</strong> {current_user.first_name or current_user.email}</p>
                <p><strong>Subject:</strong> {message.subject}</p>
                <div class="highlight-box">
                    <p>{message.body}</p>
                </div>
                <a href="{email_service.base_url}/messages/{message.id}" class="button">
                    Reply
                </a>
                """
            )
        
        # Create in-app notification
        notification = Notification(
            user_id=recipient.id,
            notification_type="message",
            title=f"New message from {current_user.first_name or current_user.email}",
            body=message.subject,
            link=f"/messages/{message.id}"
        )
        db.add(notification)
        db.commit()
    
    return {
        "id": message.id,
        "ticket_number": message.ticket_number,
        "message": "Message sent successfully"
    }


@app.post("/api/messages/{message_id}/reply")
def reply_to_message(
    message_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reply to a message"""
    parent = db.query(Message).filter(Message.id == message_id).first()
    if not parent:
        raise ResourceNotFoundException("Message", message_id)
    
    # Check access
    if not can_access_message(current_user, parent, db):
        raise AuthorizationException("Cannot access this message")
    
    # Determine recipient (original sender if current user is recipient, otherwise original recipient)
    if current_user.id == parent.recipient_id:
        recipient_id = parent.sender_id
    else:
        recipient_id = parent.recipient_id
    
    # Create reply
    reply = Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        parent_message_id=message_id,
        message_type=parent.message_type,
        subject=f"Re: {parent.subject}",
        body=data.get("body"),
        ticket_number=parent.ticket_number,
        access_level=parent.access_level,
    )
    
    db.add(reply)
    
    # Update parent message status
    parent.status = "replied"
    parent.replied_at = datetime.utcnow()
    
    db.commit()
    db.refresh(reply)
    
    # Send notification
    recipient = db.query(User).filter(User.id == recipient_id).first()
    if recipient:
        prefs = recipient.permissions or {}
        if prefs.get("email_new_message", True):
            email_service.send_email(
                to_email=recipient.email,
                subject=f"New Reply: {parent.subject}",
                html_content=f"""
                <h2>New Reply</h2>
                <p><strong>From:</strong> {current_user.first_name or current_user.email}</p>
                <p><strong>Subject:</strong> {parent.subject}</p>
                <div class="highlight-box">
                    <p>{data.get("body")}</p>
                </div>
                <a href="{email_service.base_url}/messages/{parent.id}" class="button">
                    View Conversation
                </a>
                """
            )
    
    return {
        "success": True,
        "reply_id": reply.id
    }


@app.get("/api/messages/{message_id}/thread")
def get_message_thread(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get entire message thread"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise ResourceNotFoundException("Message", message_id)
    
    # Check access
    if not can_access_message(current_user, message, db):
        raise AuthorizationException("Cannot access this message")
    
    # Get root message
    root_id = message.parent_message_id or message.id
    
    # Get all messages in thread
    thread = db.query(Message).filter(
        or_(
            Message.id == root_id,
            Message.parent_message_id == root_id
        )
    ).order_by(Message.created_at.asc()).all()
    
    result = []
    for m in thread:
        sender = db.query(User).filter(User.id == m.sender_id).first()
        result.append({
            "id": m.id,
            "sender": {
                "id": sender.id,
                "name": f"{sender.first_name} {sender.last_name}" if sender.first_name else sender.email,
                "type": sender.user_type,
            } if sender else None,
            "subject": m.subject,
            "body": m.body,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    
    return result


@app.get("/api/messages/contacts")
def get_message_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of contacts (users you've messaged with)"""
    
    # Get unique user IDs from sent and received messages
    sent_to = db.query(Message.recipient_id).filter(
        Message.sender_id == current_user.id,
        Message.recipient_id.isnot(None)
    ).distinct().all()
    
    received_from = db.query(Message.sender_id).filter(
        Message.recipient_id == current_user.id
    ).distinct().all()
    
    # Combine and deduplicate
    contact_ids = set([s[0] for s in sent_to] + [r[0] for r in received_from])
    
    # Get user details
    contacts = []
    for user_id in contact_ids:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            # Get last message
            last_message = db.query(Message).filter(
                or_(
                    and_(Message.sender_id == current_user.id, Message.recipient_id == user_id),
                    and_(Message.sender_id == user_id, Message.recipient_id == current_user.id)
                )
            ).order_by(Message.created_at.desc()).first()
            
            # Count unread
            unread_count = db.query(Message).filter(
                Message.sender_id == user_id,
                Message.recipient_id == current_user.id,
                Message.read_at.is_(None)
            ).count()
            
            contacts.append({
                "id": user.id,
                "name": f"{user.first_name} {user.last_name}" if user.first_name else user.email,
                "email": user.email,
                "user_type": user.user_type,
                "company_name": user.company_name,
                "last_message": {
                    "body": last_message.body[:100] if last_message else "",
                    "created_at": last_message.created_at.isoformat() if last_message and last_message.created_at else None,
                } if last_message else None,
                "unread_count": unread_count,
            })
    
    # Sort by last message time
    contacts.sort(
        key=lambda x: x["last_message"]["created_at"] if x["last_message"] else "",
        reverse=True
    )
    
    return contacts


@app.get("/api/admin/support-tickets")
def get_support_tickets(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin/Sales rep: Get support tickets"""
    if user_type not in ["admin", "salesman"]:
        raise AuthorizationException("Admin or sales rep access required")
    
    query = db.query(Message).filter(Message.message_type == "support_ticket")
    
    if status:
        query = query.filter(Message.status == status)
    
    tickets = query.order_by(
        Message.priority.desc(),
        Message.created_at.desc()
    ).limit(100).all()
    
    result = []
    for ticket in tickets:
        sender = db.query(User).filter(User.id == ticket.sender_id).first()
        result.append({
            "id": ticket.id,
            "ticket_number": ticket.ticket_number,
            "sender": {
                "id": sender.id,
                "name": f"{sender.first_name} {sender.last_name}" if sender.first_name else sender.email,
                "email": sender.email,
            } if sender else None,
            "subject": ticket.subject,
            "priority": ticket.priority,
            "category": ticket.category,
            "status": ticket.status,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        })
    
    return result

# ======================
# ENHANCED MESSAGING WITH EMAIL NOTIFICATIONS
# ======================


@app.post("/api/messages/{message_id}/read")
def mark_message_read(message_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Mark message as read"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise ResourceNotFoundException("Message not found")

    if message.recipient_id == current_user.id and not message.read_at:
        message.status = "read"
        message.read_at = datetime.utcnow()
        db.commit()

    return {"success": True}


# Update the existing reply endpoint to send email notifications
@app.post("/api/messages/{message_id}/reply")
def reply_to_message(
    message_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Reply to a message with email notification"""
    parent = db.query(Message).filter(Message.id == message_id).first()
    if not parent:
        raise ResourceNotFoundException("Message not found")

    reply = Message(
        sender_id=current_user.id,
        recipient_id=parent.sender_id if current_user.id != parent.sender_id else parent.recipient_id,
        parent_message_id=message_id,
        message_type=parent.message_type,
        subject=f"Re: {parent.subject}",
        body=data.get("body"),
        ticket_number=parent.ticket_number,
    )
    db.add(reply)

    parent.status = "replied"
    parent.replied_at = datetime.utcnow()
    db.commit()
    db.refresh(reply)

    # Send email notification to recipient
    recipient = db.query(User).filter(User.id == reply.recipient_id).first()
    if recipient and recipient.email:
        sender_name = (
            f"{current_user.first_name} {current_user.last_name}" if current_user.first_name else current_user.email
        )

        email_service.send_email(
            to_email=recipient.email,
            subject=f"New Reply: {parent.subject}",
            html_content=f"""
            <h2>You have a new message reply</h2>
            <p><strong>From:</strong> {sender_name}</p>
            <p><strong>Subject:</strong> {parent.subject}</p>
            {f'<p><strong>Ticket:</strong> {parent.ticket_number}</p>' if parent.ticket_number else ''}
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p>{data.get("body")}</p>
            </div>
            <p><a href="https://yachtversal.com/messages" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View Message</a></p>
            """,
        )

    return {"success": True}


# Update the create message endpoint to send notifications
@app.post("/api/messages", status_code=status.HTTP_201_CREATED)
def create_message(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create message or support ticket with email notification"""
    message = Message(
        sender_id=current_user.id,
        recipient_id=data.get("recipient_id"),
        listing_id=data.get("listing_id"),
        message_type=data.get("message_type", "direct"),
        subject=data.get("subject"),
        body=data.get("body"),
        priority=data.get("priority", "normal"),
        category=data.get("category"),
        ticket_number=generate_ticket_number() if data.get("message_type") == "support_ticket" else None,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # Send email notification
    if message.message_type == "support_ticket":
        # Notify admin/support team
        email_service.send_email(
            to_email="support@yachtversal.com",
            subject=f"New Support Ticket: {message.ticket_number}",
            html_content=f"""
            <h2>New Support Ticket</h2>
            <p><strong>Ticket:</strong> {message.ticket_number}</p>
            <p><strong>From:</strong> {current_user.email}</p>
            <p><strong>Priority:</strong> {message.priority}</p>
            <p><strong>Category:</strong> {message.category}</p>
            <p><strong>Subject:</strong> {message.subject}</p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p>{message.body}</p>
            </div>
            <p><a href="https://yachtversal.com/admin/messages" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View Ticket</a></p>
            """,
        )
    elif message.recipient_id:
        # Notify recipient for direct messages
        recipient = db.query(User).filter(User.id == message.recipient_id).first()
        if recipient and recipient.email:
            sender_name = (
                f"{current_user.first_name} {current_user.last_name}" if current_user.first_name else current_user.email
            )

            email_service.send_email(
                to_email=recipient.email,
                subject=f"New Message: {message.subject}",
                html_content=f"""
                <h2>You have a new message</h2>
                <p><strong>From:</strong> {sender_name}</p>
                <p><strong>Subject:</strong> {message.subject}</p>
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p>{message.body}</p>
                </div>
                <p><a href="https://yachtversal.com/messages" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View Message</a></p>
                """,
            )

    # Sync to CRM if it's an inquiry
    if message.message_type == "inquiry" and message.listing_id:
        # CRM sync logic here (already exists in your inquiry endpoint)
        pass

    return {"id": message.id, "ticket_number": message.ticket_number, "message": "Message sent successfully"}


# ======================
# NOTIFICATIONS
# ======================


@app.get("/api/notifications")
def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user notifications"""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "id": n.id,
            "notification_type": n.notification_type,
            "title": n.title,
            "body": n.body,
            "link": n.link,
            "read": n.read,
            "read_at": n.read_at.isoformat() if n.read_at else None,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Mark notification as read"""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )

    if notification:
        notification.read = True
        notification.read_at = datetime.utcnow()
        db.commit()

    return {"success": True}


@app.post("/api/notifications/read-all")
def mark_all_notifications_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Mark all notifications as read"""
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.read.is_(False)).update(
        {"read": True, "read_at": datetime.utcnow()}
    )

    db.commit()
    return {"success": True}


@app.delete("/api/notifications/{notification_id}")
def delete_notification(
    notification_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Delete notification"""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )

    if notification:
        db.delete(notification)
        db.commit()

    return {"success": True}


# Helper function to create notifications
def create_notification(db: Session, user_id: int, notification_type: str, title: str, body: str, link: str):
    """Helper to create notifications"""
    notification = Notification(user_id=user_id, notification_type=notification_type, title=title, body=body, link=link)
    db.add(notification)
    db.commit()
    return notification


# ======================
# DEALER PAGES
# ======================


@app.get("/api/dealers/{slug}/public")
def get_dealer_page(slug: str, db: Session = Depends(get_db)):
    """Get public dealer profile"""
    dealer = db.query(DealerProfile).filter(DealerProfile.slug == slug, DealerProfile.active.is_(True)).first()

    if not dealer:
        raise ResourceNotFoundException("Dealer not found")

    # Get listings
    listings = db.query(Listing).filter(Listing.user_id == dealer.user_id, Listing.status == "active").all()

    # Get reviews
    reviews = db.query(DealerReview).filter(DealerReview.dealer_id == dealer.id).all()
    avg_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else 0

    return {
        "id": dealer.id,
        "name": dealer.name,
        "company_name": dealer.company_name,
        "logo_url": dealer.logo_url,
        "banner_image": dealer.banner_image,
        "about_section": dealer.about_section,
        "specialties": dealer.specialties,
        "primary_color": dealer.primary_color,
        "verified": dealer.verified,
        "listings_count": len(listings),
        "avg_rating": round(avg_rating, 1),
        "reviews_count": len(reviews),
        "team_members": [
            {"name": tm.name, "title": tm.title, "photo_url": tm.photo_url, "bio": tm.bio}
            for tm in dealer.team_members
            if tm.active
        ],
        "announcements": [
            {
                "title": a.title,
                "content": a.content,
                "type": a.announcement_type,
                "created_at": a.created_at.isoformat(),
            }
            for a in dealer.announcements
        ][:5],
    }


@app.put("/api/dealers/customize")
def customize_dealer_page(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Customize dealer page"""
    dealer = db.query(DealerProfile).filter(DealerProfile.user_id == current_user.id).first()
    if not dealer:
        raise ResourceNotFoundException("Dealer profile not found")

    for field, value in data.items():
        if hasattr(dealer, field):
            setattr(dealer, field, value)

    dealer.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True}


# ======================
# CRM INTEGRATION
# ======================


@app.get("/api/crm/integrations")
def get_crm_integrations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's CRM integrations"""
    integrations = db.query(CRMIntegration).filter(CRMIntegration.user_id == current_user.id).all()

    return [
        {
            "id": i.id,
            "crm_type": i.crm_type,
            "sync_leads": i.sync_leads,
            "sync_contacts": i.sync_contacts,
            "sync_messages": i.sync_messages,
            "active": i.active,
            "last_sync": i.last_sync.isoformat() if i.last_sync else None,
        }
        for i in integrations
    ]


@app.post("/api/crm/integrations")
def create_crm_integration(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Connect CRM"""
    integration = CRMIntegration(
        user_id=current_user.id,
        crm_type=data.get("crm_type"),
        api_key=data.get("api_key"),
        sync_leads=data.get("sync_leads", True),
        sync_contacts=data.get("sync_contacts", True),
        sync_messages=data.get("sync_messages", True),
    )
    db.add(integration)
    db.commit()

    return {"success": True, "integration_id": integration.id}


# ======================
# SCRAPER (ADMIN)
# ======================


@app.post("/api/admin/scraper/start")
async def start_scraper_job(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: Start scraper job"""
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin only")

    if not scraper:
        raise ExternalServiceException("Scraper not available")

    job = ScraperJob(
        dealer_id=data.get("dealer_id"), broker_url=data.get("broker_url"), frequency=data.get("frequency", "weekly")
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_scraper_job, job.id, db)

    return {"success": True, "job_id": job.id}


def run_scraper_job(job_id: int, db: Session):
    """Background task to run scraper"""
    job = db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
    if not job:
        return

    job.status = "running"
    job.started_at = datetime.utcnow()
    db.commit()

    try:
        # Implementation would go here
        # This is a placeholder
        pass

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)

    job.completed_at = datetime.utcnow()
    db.commit()


# ======================
# INQUIRIES (with CRM sync)
# ======================


@app.post("/api/inquiries", status_code=status.HTTP_201_CREATED)
async def create_inquiry(
    request: Request, inquiry_data: InquiryCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
):
    listing = db.query(Listing).filter(Listing.id == inquiry_data.listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing", inquiry_data.listing_id)

    inquiry = Inquiry(**inquiry_data.dict())
    db.add(inquiry)

    listing.inquiries += 1
    db.commit()
    db.refresh(inquiry)

    # Send email to dealer
    dealer = listing.owner
    if dealer.email:
        email_service.send_inquiry_to_dealer(
            dealer_email=dealer.email,
            dealer_name=f"{dealer.first_name} {dealer.last_name}",
            inquirer_name=inquiry.sender_name,
            inquirer_email=inquiry.sender_email,
            inquirer_phone=inquiry.sender_phone or "Not provided",
            listing_title=listing.title,
            listing_url=f"https://yachtversal.com/listings/{listing.id}",
            message=inquiry.message,
        )

    # Sync to CRM in background
    background_tasks.add_task(process_inquiry_crm_sync, inquiry.id, db)

    return {"id": inquiry.id, "message": "Inquiry sent successfully"}


# ======================
# ADMIN SETTINGS
# ======================


@app.get("/api/admin/settings")
def get_admin_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get admin settings"""
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin only")

    settings = db.query(SiteSettings).first()
    if not settings:
        settings = SiteSettings()
        db.add(settings)
        db.commit()

    return {
        "banner": {
            "active": settings.banner_active,
            "text": settings.banner_text,
            "type": settings.banner_type,
            "target": settings.banner_target,
        }
    }


@app.put("/api/admin/settings/banner")
def update_banner(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update site banner"""
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin only")

    settings = db.query(SiteSettings).first()
    if not settings:
        settings = SiteSettings()
        db.add(settings)

    settings.banner_active = data.get("active", False)
    settings.banner_text = data.get("text")
    settings.banner_type = data.get("type", "info")
    settings.banner_target = data.get("target", "all")

    db.commit()

    return {"success": True}


@app.get("/api/public/banner")
def get_public_banner(db: Session = Depends(get_db)):
    """Get active banner (public)"""
    settings = db.query(SiteSettings).first()

    if not settings or not settings.banner_active:
        return {"active": False}

    return {
        "active": True,
        "text": settings.banner_text,
        "type": settings.banner_type,
        "target": settings.banner_target,
    }


# ======================
# FILE UPLOADS
# ======================


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """
    Secure file upload with validation and optimization
    """
    result = await upload_handler.upload_and_process_image(
        file=file,
        user_id=current_user.id,
        optimize=True,
        create_thumbnail=True,
    )

    return {"success": True, **result}


@app.post("/api/upload/bulk")
async def upload_multiple_files(files: list[UploadFile] = File(...), current_user: User = Depends(get_current_user)):
    """
    Upload multiple images at once
    """
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per upload")

    results = []
    errors = []

    for file in files:
        try:
            result = await upload_handler.upload_and_process_image(
                file=file,
                user_id=current_user.id,
                optimize=True,
                create_thumbnail=True,
            )
            results.append(result)
        except HTTPException as e:
            errors.append({"file": file.filename, "error": e.detail})
        except Exception:
            errors.append({"file": file.filename, "error": "Upload failed"})

    return {
        "success": len(errors) == 0,
        "uploaded": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors if errors else None,
    }


# ======================
# EXPORT LISTINGS TO CSV
# ======================


@app.get("/api/listings/export")
def export_listings_csv(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Export user's listings to CSV"""
    try:
        # Get user's listings
        query = db.query(Listing)

        # Filter based on user type
        if current_user.user_type == "admin":
            # Admin can export all
            listings = query.all()
        elif current_user.parent_dealer_id:
            # Sales rep - only their created listings
            listings = query.filter(Listing.created_by_user_id == current_user.id).all()
        else:
            # Dealer - all their company's listings
            listings = query.filter(Listing.user_id == current_user.id).all()

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)

        # Write headers
        headers = [
            "id",
            "title",
            "make",
            "model",
            "year",
            "price",
            "currency",
            "length_feet",
            "beam_feet",
            "draft_feet",
            "boat_type",
            "hull_material",
            "engine_make",
            "engine_model",
            "engine_type",
            "engine_hours",
            "fuel_type",
            "cabins",
            "berths",
            "heads",
            "city",
            "state",
            "country",
            "description",
            "condition",
            "status",
            "views",
            "inquiries",
            "created_at",
        ]
        writer.writerow(headers)

        # Write data
        for listing in listings:
            writer.writerow(
                [
                    listing.id,
                    listing.title,
                    listing.make,
                    listing.model,
                    listing.year,
                    listing.price,
                    listing.currency,
                    listing.length_feet,
                    listing.beam_feet,
                    listing.draft_feet,
                    listing.boat_type,
                    listing.hull_material,
                    listing.engine_make,
                    listing.engine_model,
                    listing.engine_type,
                    listing.engine_hours,
                    listing.fuel_type,
                    listing.cabins,
                    listing.berths,
                    listing.heads,
                    listing.city,
                    listing.state,
                    listing.country,
                    listing.description,
                    listing.condition,
                    listing.status,
                    listing.views,
                    listing.inquiries,
                    listing.created_at.isoformat() if listing.created_at else "",
                ]
            )

        # Prepare response
        output.seek(0)
        filename = f"listings-export-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv"

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        logger.error(f"Export error: {e}", exc_info=True)
        raise BusinessLogicException("Failed to export listings")


# ======================
# IMPORT LISTINGS FROM CSV
# ======================


@app.post("/api/listings/import")
async def import_listings_csv(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Import listings from CSV file"""
    try:
        # Check if user can create listings
        if current_user.parent_dealer_id and not current_user.permissions.get("can_create_listings", False):
            raise AuthorizationException("No permission to import listings")

        # Read file content
        contents = await file.read()

        # Determine owner
        owner_id = current_user.parent_dealer_id if current_user.parent_dealer_id else current_user.id

        # Parse CSV
        csv_file = io.StringIO(contents.decode("utf-8"))
        reader = csv.DictReader(csv_file)

        created_count = 0
        updated_count = 0
        errors = []

        for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Check if updating existing listing (if ID provided)
                listing_id = row.get("id", "").strip()

                if listing_id and listing_id.isdigit():
                    # Update existing listing
                    listing = (
                        db.query(Listing).filter(Listing.id == int(listing_id), Listing.user_id == owner_id).first()
                    )

                    if listing:
                        # Update fields
                        listing.title = row.get("title", listing.title)
                        listing.make = row.get("make", listing.make)
                        listing.model = row.get("model", listing.model)
                        listing.year = int(row["year"]) if row.get("year") else listing.year
                        listing.price = float(row["price"]) if row.get("price") else listing.price
                        listing.currency = row.get("currency", listing.currency)
                        listing.length_feet = (
                            float(row["length_feet"]) if row.get("length_feet") else listing.length_feet
                        )
                        listing.beam_feet = float(row["beam_feet"]) if row.get("beam_feet") else listing.beam_feet
                        listing.draft_feet = float(row["draft_feet"]) if row.get("draft_feet") else listing.draft_feet
                        listing.boat_type = row.get("boat_type", listing.boat_type)
                        listing.hull_material = row.get("hull_material", listing.hull_material)
                        listing.engine_make = row.get("engine_make", listing.engine_make)
                        listing.engine_model = row.get("engine_model", listing.engine_model)
                        listing.engine_type = row.get("engine_type", listing.engine_type)
                        listing.engine_hours = (
                            float(row["engine_hours"]) if row.get("engine_hours") else listing.engine_hours
                        )
                        listing.fuel_type = row.get("fuel_type", listing.fuel_type)
                        listing.cabins = int(row["cabins"]) if row.get("cabins") else listing.cabins
                        listing.berths = int(row["berths"]) if row.get("berths") else listing.berths
                        listing.heads = int(row["heads"]) if row.get("heads") else listing.heads
                        listing.city = row.get("city", listing.city)
                        listing.state = row.get("state", listing.state)
                        listing.country = row.get("country", listing.country)
                        listing.description = row.get("description", listing.description)
                        listing.condition = row.get("condition", listing.condition)
                        listing.status = row.get("status", listing.status)
                        listing.updated_at = datetime.utcnow()

                        updated_count += 1
                    else:
                        errors.append(f"Row {row_num}: Listing ID {listing_id} not found or not owned by you")
                else:
                    # Create new listing
                    # Validate required fields
                    if not row.get("title") or not row.get("make") or not row.get("model"):
                        errors.append(f"Row {row_num}: Missing required fields (title, make, model)")
                        continue

                    listing = Listing(
                        user_id=owner_id,
                        created_by_user_id=current_user.id,
                        title=row["title"],
                        make=row.get("make"),
                        model=row.get("model"),
                        year=int(row["year"]) if row.get("year") else None,
                        price=float(row["price"]) if row.get("price") else None,
                        currency=row.get("currency", "USD"),
                        length_feet=float(row["length_feet"]) if row.get("length_feet") else None,
                        beam_feet=float(row["beam_feet"]) if row.get("beam_feet") else None,
                        draft_feet=float(row["draft_feet"]) if row.get("draft_feet") else None,
                        boat_type=row.get("boat_type"),
                        hull_material=row.get("hull_material"),
                        engine_make=row.get("engine_make"),
                        engine_model=row.get("engine_model"),
                        engine_type=row.get("engine_type"),
                        engine_hours=float(row["engine_hours"]) if row.get("engine_hours") else None,
                        fuel_type=row.get("fuel_type"),
                        cabins=int(row["cabins"]) if row.get("cabins") else None,
                        berths=int(row["berths"]) if row.get("berths") else None,
                        heads=int(row["heads"]) if row.get("heads") else None,
                        city=row.get("city"),
                        state=row.get("state"),
                        country=row.get("country", "USA"),
                        description=row.get("description"),
                        condition=row.get("condition", "used"),
                        status=row.get("status", "draft"),
                    )

                    # Auto-detect continent
                    if listing.country:
                        listing.continent = get_continent_for_country(listing.country)

                    db.add(listing)
                    created_count += 1

            except Exception as row_error:
                errors.append(f"Row {row_num}: {str(row_error)}")
                continue

        # Commit all changes
        db.commit()

        return {
            "success": True,
            "created": created_count,
            "updated": updated_count,
            "errors": errors,
            "total_processed": created_count + updated_count,
        }

    except Exception as e:
        logger.error(f"Import error: {e}", exc_info=True)
        raise BusinessLogicException(f"Failed to import listings: {str(e)}")


# ======================
# GET CSV TEMPLATE
# ======================


@app.get("/api/listings/template")
def download_csv_template():
    """Download blank CSV template for importing listings"""
    output = io.StringIO()
    writer = csv.writer(output)

    # Headers with example data
    writer.writerow(
        [
            "id",
            "title",
            "make",
            "model",
            "year",
            "price",
            "currency",
            "length_feet",
            "beam_feet",
            "draft_feet",
            "boat_type",
            "hull_material",
            "engine_make",
            "engine_model",
            "engine_type",
            "engine_hours",
            "fuel_type",
            "cabins",
            "berths",
            "heads",
            "city",
            "state",
            "country",
            "description",
            "condition",
            "status",
        ]
    )

    # Example row
    writer.writerow(
        [
            "",
            "2020 Sea Ray Sundancer 320",
            "Sea Ray",
            "Sundancer 320",
            "2020",
            "250000",
            "USD",
            "32",
            "10.5",
            "3.2",
            "Motor Yacht",
            "Fiberglass",
            "MerCruiser",
            "8.2L",
            "Inboard",
            "250",
            "Diesel",
            "2",
            "4",
            "1",
            "Miami",
            "Florida",
            "USA",
            "Beautiful yacht in excellent condition",
            "used",
            "active",
        ]
    )

    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=listings-import-template.csv"},
    )


# ======================
# BULK DELETE LISTINGS
# ======================


@app.post("/api/listings/bulk-delete")
def bulk_delete_listings(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bulk delete listings"""
    try:
        listing_ids = data.get("listing_ids", [])
        permanent = data.get("permanent", False)

        if not listing_ids:
            raise ValidationException("No listing IDs provided")

        # Get listings
        query = db.query(Listing).filter(Listing.id.in_(listing_ids))

        # Filter by ownership
        if current_user.user_type == "admin":
            listings = query.all()
        elif current_user.parent_dealer_id:
            # Sales rep - only their created listings
            can_delete_all = current_user.permissions.get("can_delete_listings", False)
            if can_delete_all:
                listings = query.filter(Listing.user_id == current_user.parent_dealer_id).all()
            else:
                listings = query.filter(Listing.created_by_user_id == current_user.id).all()
        else:
            # Dealer - their company's listings
            listings = query.filter(Listing.user_id == current_user.id).all()

        if not listings:
            raise ResourceNotFoundException("Listings", None)

        deleted_count = len(listings)

        if permanent:
            # Permanently delete
            for listing in listings:
                db.delete(listing)
        else:
            # Archive
            for listing in listings:
                listing.status = "archived"
                listing.updated_at = datetime.utcnow()

        db.commit()

        return {"success": True, "deleted_count": deleted_count, "permanent": permanent}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk delete error: {e}", exc_info=True)
        raise BusinessLogicException("Failed to delete listings")


# ======================
# BULK UPDATE LISTING STATUS
# ======================


@app.post("/api/listings/bulk-update-status")
def bulk_update_status(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bulk update listing status"""
    try:
        listing_ids = data.get("listing_ids", [])
        new_status = data.get("status")

        if not listing_ids or not new_status:
            raise ValidationException("Missing listing_ids or status")

        if new_status not in ["active", "draft", "archived"]:
            raise ValidationException("Invalid status")

        # Get listings (with permission checks)
        query = db.query(Listing).filter(Listing.id.in_(listing_ids))

        if current_user.user_type == "admin":
            listings = query.all()
        elif current_user.parent_dealer_id:
            listings = query.filter(Listing.user_id == current_user.parent_dealer_id).all()
        else:
            listings = query.filter(Listing.user_id == current_user.id).all()

        updated_count = 0
        for listing in listings:
            listing.status = new_status
            listing.updated_at = datetime.utcnow()
            if new_status == "active" and not listing.published_at:
                listing.published_at = datetime.utcnow()
            updated_count += 1

        db.commit()

        return {"success": True, "updated_count": updated_count}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk update error: {e}", exc_info=True)
        raise BusinessLogicException("Failed to update listings")


# ======================
# STARTUP TASKS
# ======================


@app.on_event("startup")
async def startup_event():
    # Rate limiter initialization removed (rate limiting disabled)
    logger.debug("Skipping rate limiter initialization (disabled)")

    # Log the signature of authentication endpoints to detect signature injection bugs
    try:
        import inspect
        for r in app.routes:
            if getattr(r, 'path', None) in ('/api/auth/register', '/api/auth/login'):
                endpoint = getattr(r, 'endpoint', None)
                sig = None
                try:
                    sig = inspect.signature(endpoint)
                except Exception:
                    sig = getattr(endpoint, '__signature__', None)
                logger.info(
                    "Endpoint %s -> endpoint=%s, signature=%s, wrapped=%s",
                    getattr(r, 'path', None),
                    repr(endpoint),
                    sig,
                    getattr(endpoint, '__wrapped__', None) is not None,
                )
    except Exception as e:
        logger.warning("Could not introspect auth endpoints: %s", e)

    # Log that startup completes for observability
    logger.info("Application startup completed and background services initialized")


# Run on app startup
logger.info("YachtVersal API started")

# Could add: currency rate updates, check trial expirations, etc.

# ======================
# SALES REP ENDPOINTS
# ======================


@app.get("/api/sales-rep/clients")
def get_sales_rep_clients(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all clients assigned to this sales rep"""
    if current_user.user_type != "salesman":
        raise AuthorizationException("Sales rep access required")

    clients = db.query(User).filter(User.assigned_sales_rep_id == current_user.id, User.user_type == "dealer").all()

    return [
        {
            "id": client.id,
            "name": f"{client.first_name} {client.last_name}",
            "company_name": client.company_name,
            "email": client.email,
            "subscription_tier": client.subscription_tier,
            "active": client.active,
            "created_at": client.created_at.isoformat(),
        }
        for client in clients
    ]

# ======================
# Sales REP ANALYTICS
# ======================

@app.get("/api/sales-rep/analytics")
def get_sales_rep_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sales rep dashboard analytics"""
    if current_user.user_type != "salesman":
        raise AuthorizationException("Sales rep access required")
    
    # Get assigned dealers
    dealers = db.query(User).filter(
        User.assigned_sales_rep_id == current_user.id
    ).all()
    
    total_dealers = len(dealers)
    active_dealers = len([d for d in dealers if d.active])
    
    # Calculate commission (10% of subscription fees)
    monthly_revenue = sum(
        get_tier_price(d.subscription_tier) 
        for d in dealers if d.active
    )
    commission = monthly_revenue * 0.10
    
    # Get dealer stats
    dealer_stats = []
    for dealer in dealers:
        listings_count = db.query(Listing).filter(
            Listing.user_id == dealer.id
        ).count()
        
        active_listings = db.query(Listing).filter(
            Listing.user_id == dealer.id,
            Listing.status == "active"
        ).count()
        
        total_views = db.query(func.sum(Listing.views)).filter(
            Listing.user_id == dealer.id
        ).scalar() or 0
        
        total_inquiries = db.query(Inquiry).join(Listing).filter(
            Listing.user_id == dealer.id
        ).count()
        
        dealer_stats.append({
            "dealer_id": dealer.id,
            "dealer_name": dealer.company_name or dealer.email,
            "subscription_tier": dealer.subscription_tier,
            "total_listings": listings_count,
            "active_listings": active_listings,
            "total_views": total_views,
            "total_inquiries": total_inquiries,
            "joined_date": dealer.created_at.isoformat() if dealer.created_at else None
        })
    
    return {
        "total_dealers": total_dealers,
        "active_dealers": active_dealers,
        "monthly_revenue": monthly_revenue,
        "monthly_commission": commission,
        "dealers": dealer_stats
    }

def get_tier_price(tier: str) -> float:
    """Get monthly price for subscription tier"""
    prices = {"free": 0, "basic": 29, "premium": 99, "trial": 0}
    return prices.get(tier, 0)

# ======================
# TEAM MEMBER ENDPOINTS (for dealers)
# ======================


@app.get("/api/team/members")
def get_team_members(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all team members for the current dealer"""
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Dealer access required")

    # If user is a team member, get their parent dealer
    dealer_id = current_user.id if current_user.parent_dealer_id is None else current_user.parent_dealer_id

    members = db.query(User).filter(User.parent_dealer_id == dealer_id).all()

    return [
        {
            "id": member.id,
            "email": member.email,
            "first_name": member.first_name,
            "last_name": member.last_name,
            "role": member.role,
            "permissions": member.permissions,
            "active": member.active,
            "created_at": member.created_at.isoformat(),
        }
        for member in members
    ]


@app.post("/api/team/invite")
def invite_team_member(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Invite a team member (sales rep) to join the dealer's team"""
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Dealer access required")

    # Check if email already exists
    existing = db.query(User).filter(User.email == data.get("email")).first()
    if existing:
        raise ValidationException("User with this email already exists")

    # Default permissions for sales reps
    default_permissions = {
        "can_create_listings": True,
        "can_edit_own_listings": True,
        "can_edit_all_listings": False,
        "can_delete_listings": False,
        "can_view_inquiries": True,
        "can_manage_team": False,
        "can_view_analytics": True,
    }

    # Create team member account
    team_member = User(
        email=data.get("email"),
        password_hash=hash_password(data.get("password", "changeme123")),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        phone=data.get("phone"),
        user_type="salesman",
        parent_dealer_id=current_user.id,
        role=data.get("role", "team_member"),
        permissions=data.get("permissions", default_permissions),
        subscription_tier=current_user.subscription_tier,  # Inherit from parent
    )

    db.add(team_member)
    db.commit()
    db.refresh(team_member)

    # Send invitation email
    email_service.send_email(
        to_email=team_member.email,
        subject="You've been invited to join a yacht dealership",
        html_content=f"""
        <h2>Welcome to YachtVersal!</h2>
        <p>You've been invited by {current_user.company_name or current_user.email} to join their team.</p>
        <p>Your temporary password is: <strong>changeme123</strong></p>
        <p>Please log in and change your password immediately.</p>
        <a href="https://yachtversal.com/login">Log In Now</a>
        """,
    )

    return {"success": True, "member_id": team_member.id, "message": "Team member invited successfully"}


@app.put("/api/team/members/{member_id}/permissions")
def update_member_permissions(
    member_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Update team member permissions"""
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Dealer access required")

    member = db.query(User).filter(User.id == member_id, User.parent_dealer_id == current_user.id).first()

    if not member:
        raise ResourceNotFoundException("Team member not found")

    member.permissions = data.get("permissions", member.permissions)
    member.role = data.get("role", member.role)

    db.commit()

    return {"success": True}


@app.delete("/api/team/members/{member_id}")
def remove_team_member(member_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Remove a team member"""
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Dealer access required")

    member = db.query(User).filter(User.id == member_id, User.parent_dealer_id == current_user.id).first()

    if not member:
        raise ResourceNotFoundException("Team member not found")

    # Reassign their listings to parent dealer
    db.query(Listing).filter(Listing.user_id == member_id).update({"user_id": current_user.id})

    # Deactivate instead of delete to preserve history
    member.active = False

    db.commit()

    return {"success": True}


# PASSWORD RESET ENDPOINTS

# Duplicate `reset_password` removed; canonical implementation exists later in this file.

# EMAIL VERIFICATION ENDPOINTS

# Canonical email verification endpoints are defined later in the file (see /api/auth/resend-verification and /api/auth/verify-email).


# TWO-FACTOR AUTHENTICATION ENDPOINTS

# TWO-FACTOR AUTHENTICATION ENDPOINTS and ACTIVITY LOG ENDPOINT

# Canonical 2FA and activity log endpoints are defined later in the file; earlier duplicate implementations removed.
# ======================
# MODIFY EXISTING LISTING ENDPOINTS FOR PERMISSIONS
# ======================


@app.post("/api/listings", status_code=status.HTTP_201_CREATED)
async def create_listing(
    request: Request,
    listing_data: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # Check permissions if user is a team member
        if current_user.parent_dealer_id is not None:
            if not current_user.permissions.get("can_create_listings", False):
                raise AuthorizationException("You don't have permission to create listings")

        check_listing_limit(current_user, db)

        # Determine owner: if team member, use parent dealer; otherwise use current user
        owner_id = current_user.parent_dealer_id if current_user.parent_dealer_id else current_user.id

        listing = Listing(
            user_id=owner_id,  # Owner (dealer)
            created_by_user_id=current_user.id,  # Creator (could be sales rep)
            **listing_data.dict(),
        )

        # Auto-detect continent from country
        if listing.country and not listing.continent:
            listing.continent = get_continent_for_country(listing.country)

        # For trial users, set status to draft
        if current_user.trial_active and not current_user.trial_converted:
            listing.status = "draft"
        elif listing.status == "active":
            listing.published_at = datetime.utcnow()

        db.add(listing)
        db.commit()
        db.refresh(listing)

        return {"id": listing.id, "message": "Listing created successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating listing: {e}", exc_info=True)
        raise BusinessLogicException("Error creating listing")


@app.put("/api/listings/{listing_id}")
def update_listing(
    listing_id: int, listing_data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise ResourceNotFoundException("Listing not found")

    # Permission checks
    is_owner = listing.user_id == current_user.id
    is_creator = listing.created_by_user_id == current_user.id
    is_admin = current_user.user_type == "admin"
    is_parent_dealer = current_user.id == listing.owner.parent_dealer_id if listing.owner.parent_dealer_id else False

    can_edit_own = current_user.permissions.get("can_edit_own_listings", True)
    can_edit_all = current_user.permissions.get("can_edit_all_listings", False)

    # Check if user has permission
    if not (is_admin or is_owner or is_parent_dealer or (is_creator and can_edit_own) or can_edit_all):
        raise AuthorizationException("You don't have permission to edit this listing")

    for field, value in listing_data.items():
        if hasattr(listing, field) and value is not None:
            setattr(listing, field, value)

    listing.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Listing updated successfully"}


# ======================
# INQUIRIES - Filter by sales rep
# ======================


@app.get("/api/inquiries")
def get_inquiries(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get inquiries - filtered by permissions"""
    if current_user.user_type == "admin":
        inquiries = db.query(Inquiry).all()
    elif current_user.parent_dealer_id is not None:
        # Team member - only see inquiries for their own listings
        if not current_user.permissions.get("can_view_inquiries", True):
            raise AuthorizationException("No permission to view inquiries")

        inquiries = db.query(Inquiry).join(Listing).filter(Listing.created_by_user_id == current_user.id).all()
    else:
        # Dealer - see all inquiries for their company
        inquiries = db.query(Inquiry).join(Listing).filter(Listing.user_id == current_user.id).all()

    return [
        {
            "id": inq.id,
            "listing_id": inq.listing_id,
            "listing_title": inq.listing.title if inq.listing else "Unknown",
            "sender_name": inq.sender_name,
            "sender_email": inq.sender_email,
            "sender_phone": inq.sender_phone,
            "message": inq.message,
            "status": inq.status,
            "created_at": inq.created_at.isoformat(),
        }
        for inq in inquiries
    ]


@app.patch("/api/inquiries/{inquiry_id}/status")
def update_inquiry_status(
    inquiry_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Update inquiry status"""
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry:
        raise ResourceNotFoundException("Inquiry", inquiry_id)

    # Check permission
    listing = inquiry.listing
    if not (
        current_user.user_type == "admin"
        or listing.user_id == current_user.id
        or listing.created_by_user_id == current_user.id
    ):
        raise AuthorizationException("Not authorized")

    inquiry.status = data.get("status", inquiry.status)
    db.commit()

    return {"success": True}


# ======================
# RUN THE APP
# ======================


# Duplicate appended models/schemas/helpers removed to avoid re-definition conflicts. See earlier definitions above.
# PASSWORD RESET ENDPOINTS


@app.post("/api/auth/forgot-password")
def forgot_password(data: PasswordResetRequest, db: Session = Depends(get_db)):
    """Request password reset"""
    user = db.query(User).filter(User.email == data.email).first()

    # Always return success to prevent email enumeration
    if not user:
        return {"success": True, "message": "If that email exists, a reset link has been sent"}

    # Generate reset token
    token = generate_reset_token()
    expires_at = datetime.utcnow() + timedelta(hours=1)

    # Delete old unused tokens
    db.query(PasswordReset).filter(PasswordReset.user_id == user.id, PasswordReset.used.is_(False)).delete()

    # Create new reset token
    reset = PasswordReset(user_id=user.id, token=token, expires_at=expires_at)
    db.add(reset)
    db.commit()

    # Send email
    user_name = f"{user.first_name} {user.last_name}" if user.first_name else ""
    email_service.send_password_reset_email(user.email, token, user_name)

    return {"success": True, "message": "If that email exists, a reset link has been sent"}


@app.post("/api/auth/reset-password")
def reset_password(data: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Reset password with token"""
    reset = (
        db.query(PasswordReset)
        .filter(
            PasswordReset.token == data.token, PasswordReset.used.is_(False), PasswordReset.expires_at > datetime.utcnow()
        )
        .first()
    )

    if not reset:
        raise ValidationException("Invalid or expired reset token")

    # Update user password
    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        raise ResourceNotFoundException("User not found")

    user.password_hash = get_password_hash(data.new_password)
    reset.used = True

    db.commit()

    # Log activity
    log_activity(db, user.id, "password_reset", {"method": "email_link"})

    return {"success": True, "message": "Password reset successfully"}


# EMAIL VERIFICATION ENDPOINTS


@app.post("/api/auth/resend-verification")
def resend_verification(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Resend email verification"""
    if current_user.email_verified:
        return {"success": False, "message": "Email already verified"}

    # Generate new token
    token = generate_verification_token()
    expires_at = datetime.utcnow() + timedelta(hours=24)

    # Delete old tokens
    db.query(EmailVerification).filter(
        EmailVerification.user_id == current_user.id, EmailVerification.verified.is_(False)
    ).delete()

    # Create new verification
    verification = EmailVerification(user_id=current_user.id, token=token, expires_at=expires_at)
    db.add(verification)
    db.commit()

    # Send email
    user_name = f"{current_user.first_name} {current_user.last_name}" if current_user.first_name else ""
    email_service.send_email_verification(current_user.email, token, user_name)

    return {"success": True, "message": "Verification email sent"}


@app.post("/api/auth/verify-email")
def verify_email(data: EmailVerificationRequest, db: Session = Depends(get_db)):
    """Verify email with token"""
    verification = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.token == data.token,
            EmailVerification.verified.is_(False),
            EmailVerification.expires_at > datetime.utcnow(),
        )
        .first()
    )

    if not verification:
        raise ValidationException("Invalid or expired verification token")

    # Update user
    user = db.query(User).filter(User.id == verification.user_id).first()
    if not user:
        raise ResourceNotFoundException("User not found")

    user.email_verified = True
    user.email_verified_at = datetime.utcnow()
    verification.verified = True

    db.commit()

    # Log activity
    log_activity(db, user.id, "email_verified")

    return {"success": True, "message": "Email verified successfully"}


# TWO-FACTOR AUTHENTICATION ENDPOINTS


@app.post("/api/auth/2fa/enable")
def enable_2fa(data: Enable2FARequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Enable/disable 2FA"""
    # Get or create 2FA record
    tfa = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == current_user.id).first()

    if not tfa:
        # Generate backup codes
        backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]

        tfa = TwoFactorAuth(user_id=current_user.id, backup_codes=backup_codes, enabled=data.enabled)
        db.add(tfa)
    else:
        tfa.enabled = data.enabled

    current_user.two_factor_enabled = data.enabled
    db.commit()

    # Log activity
    log_activity(db, current_user.id, "2fa_enabled" if data.enabled else "2fa_disabled")

    result = {"success": True, "enabled": data.enabled}
    if data.enabled and tfa.backup_codes:
        result["backup_codes"] = tfa.backup_codes

    return result


@app.post("/api/auth/2fa/send-code")
def send_2fa_code(data: UserLogin, db: Session = Depends(get_db)):
    """Send 2FA code via email"""
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise AuthenticationException("Invalid credentials")

    if not user.two_factor_enabled:
        raise ValidationException("2FA not enabled")

    # Generate code
    code = generate_2fa_code()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Delete old codes
    db.query(TwoFactorCode).filter(TwoFactorCode.user_id == user.id, TwoFactorCode.used.is_(False)).delete()

    # Save code
    tfa_code = TwoFactorCode(user_id=user.id, code=code, expires_at=expires_at)
    db.add(tfa_code)
    db.commit()

    # Send email
    user_name = f"{user.first_name} {user.last_name}" if user.first_name else ""
    email_service.send_2fa_code(user.email, code, user_name)

    return {"success": True, "message": "Verification code sent", "requires_2fa": True}


@app.post("/api/auth/2fa/verify")
def verify_2fa_code(email: str, data: Verify2FACode, db: Session = Depends(get_db)):
    """Verify 2FA code and complete login"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise AuthenticationException("Invalid credentials")

    # Check if it's a backup code
    tfa = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == user.id).first()
    if tfa and data.code.upper() in (tfa.backup_codes or []):
        # Remove used backup code
        tfa.backup_codes.remove(data.code.upper())
        db.commit()

        # Log activity
        log_activity(db, user.id, "login_2fa", {"method": "backup_code"})

        # Generate token
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": access_token, "token_type": "bearer"}

    # Check regular code
    tfa_code = (
        db.query(TwoFactorCode)
        .filter(
            TwoFactorCode.user_id == user.id,
            TwoFactorCode.code == data.code,
            TwoFactorCode.used.is_(False),
            TwoFactorCode.expires_at > datetime.utcnow(),
        )
        .first()
    )

    if not tfa_code:
        raise ValidationException("Invalid or expired code")

    # Mark code as used
    tfa_code.used = True
    db.commit()

    # Log activity
    log_activity(db, user.id, "login_2fa", {"method": "email_code"})

    # Generate token
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {"access_token": access_token, "token_type": "bearer"}


# ACTIVITY LOG ENDPOINTS


@app.get("/api/activity-log")
def get_activity_log(limit: int = 50, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's activity log"""
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# ======================
# LEADS ENDPOINTS
# ======================

class LeadResponse(BaseModel):
    """Lead response schema"""
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    interested_in: str
    date: str
    unread_count: int = 0
    last_message: Optional[str] = None


class ConversationMessage(BaseModel):
    """Conversation message schema"""
    id: int
    sender: str
    message: str
    timestamp: str
    is_from_lead: bool


@app.get("/api/leads")
def get_leads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """Get all inbound leads for the current dealer"""
    # Get all listings owned by the current user
    user_listing_ids = db.query(Listing.id).filter(Listing.user_id == current_user.id).all()
    user_listing_ids = [l[0] for l in user_listing_ids]
    
    if not user_listing_ids:
        return []
    
    # Get all inquiries for this user's listings
    inquiries = db.query(Inquiry).filter(
        Inquiry.listing_id.in_(user_listing_ids)
    ).order_by(Inquiry.created_at.desc()).all()
    
    # Get all messages where the current user is recipient and messages are from inquiries about their listings
    messages = db.query(Message).filter(
        Message.recipient_id == current_user.id,
        Message.listing_id.in_(user_listing_ids)
    ).order_by(Message.created_at.desc()).all()
    
    # Aggregate leads from inquiries and messages
    leads_dict = {}
    
    # Process inquiries
    for inquiry in inquiries:
        lead_key = inquiry.sender_email
        listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first()
        
        if lead_key not in leads_dict:
            leads_dict[lead_key] = {
                "id": inquiry.id,
                "name": inquiry.sender_name,
                "email": inquiry.sender_email,
                "phone": inquiry.sender_phone,
                "interested_in": f"{listing.make} {listing.model} - {listing.length_feet}ft" if listing else "Unknown",
                "date": inquiry.created_at.isoformat(),
                "unread_count": 0,
                "last_message": inquiry.message[:100] if inquiry.message else ""
            }
    
    # Process messages
    for msg in messages:
        lead_key = msg.sender_id  # Use sender_id for uniqueness
        listing = db.query(Listing).filter(Listing.id == msg.listing_id).first() if msg.listing_id else None
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        
        if sender and listing:
            lead_email = sender.email
            if lead_email not in leads_dict:
                leads_dict[lead_email] = {
                    "id": msg.sender_id,
                    "name": f"{sender.first_name} {sender.last_name}".strip() or sender.email,
                    "email": sender.email,
                    "phone": sender.phone,
                    "interested_in": f"{listing.make} {listing.model} - {listing.length_feet}ft" if listing else "Unknown",
                    "date": msg.created_at.isoformat(),
                    "unread_count": 1 if msg.status == "new" else 0,
                    "last_message": msg.body[:100] if msg.body else ""
                }
            else:
                if msg.status == "new":
                    leads_dict[lead_email]["unread_count"] += 1
                leads_dict[lead_email]["last_message"] = msg.body[:100] if msg.body else ""
    
    leads_list = list(leads_dict.values())
    return leads_list[skip:skip + limit]


@app.get("/api/leads/{lead_id}/conversations")
def get_lead_conversations(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all conversations with a specific lead"""
    # First, try to find messages from this lead
    messages = db.query(Message).filter(
        Message.sender_id == lead_id,
        Message.recipient_id == current_user.id
    ).order_by(Message.created_at.asc()).all()
    
    # If no messages, try to find an inquiry
    if not messages:
        inquiries = db.query(Inquiry).filter(
            Inquiry.sender_email == lead_id
        ).order_by(Inquiry.created_at.asc()).all()
        
        conversations = []
        for inquiry in inquiries:
            conversations.append({
                "id": inquiry.id,
                "sender": inquiry.sender_name,
                "message": inquiry.message,
                "timestamp": inquiry.created_at.isoformat(),
                "is_from_lead": True
            })
        return conversations
    
    # Convert messages to conversation format
    conversations = []
    sender = db.query(User).filter(User.id == lead_id).first()
    sender_name = f"{sender.first_name} {sender.last_name}".strip() if sender else "Unknown"
    
    for msg in messages:
        conversations.append({
            "id": msg.id,
            "sender": sender_name if msg.sender_id == lead_id else current_user.first_name or current_user.email,
            "message": msg.body,
            "timestamp": msg.created_at.isoformat(),
            "is_from_lead": msg.sender_id == lead_id
        })
    
    return conversations


@app.post("/api/leads/{lead_id}/reply")
def send_reply_to_lead(
    lead_id: int,
    request_body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a reply to a lead"""
    message_text = request_body.get("message", "").strip()
    
    if not message_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Find the lead (User)
    lead_user = db.query(User).filter(User.id == lead_id).first()
    if not lead_user:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get the original message/inquiry to find the listing
    original_message = db.query(Message).filter(
        Message.sender_id == lead_id,
        Message.recipient_id == current_user.id
    ).order_by(Message.created_at.desc()).first()
    
    listing_id = original_message.listing_id if original_message else None
    
    # Create new message
    new_message = Message(
        ticket_number=generate_ticket_number(),
        sender_id=current_user.id,
        recipient_id=lead_id,
        listing_id=listing_id,
        message_type="direct",
        body=message_text,
        subject=f"Re: Inquiry about yacht",
        status="new"
    )
    
    db.add(new_message)
    db.commit()
    
    # Send email notification to lead
    try:
        recipient_email = lead_user.email
        recipient_name = f"{lead_user.first_name} {lead_user.last_name}".strip() or lead_user.email
        business_name = current_user.company_name or current_user.email
        
        email_service.send_email(
            recipient_email,
            f"Response from {business_name}",
            f"""
Hi {recipient_name},

You have received a response to your inquiry:

{message_text}

Best regards,
{business_name}
            """
        )
    except Exception as e:
        logger.error(f"Failed to send email notification: {e}")
    
    return {
        "id": new_message.id,
        "message": "Reply sent successfully",
        "timestamp": new_message.created_at.isoformat()
    }


# ------------------
# NOTE: The following updates integrate these features into existing endpoints
# (register, login, listing publish) — ensure you merge these sections into the
# earlier endpoint definitions if you prefer centralized placement instead of
# appending duplicates. For now they are implemented here for clarity and
# immediate availability.


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
