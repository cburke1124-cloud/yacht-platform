from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Index, func, JSON, text
)
import sqlalchemy.dialects.postgresql
from sqlalchemy.orm import relationship, deferred
from datetime import datetime

from app.db.base_class import Base   


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    assigned_salesman_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    guest_salesman_id = Column(Integer, ForeignKey('guest_brokers.id'), nullable=True)
    external_id = Column(String(255), index=True)


    # Basic Info
    title = Column(String, nullable=False)
    make = Column(String)
    model = Column(String)
    year = Column(Integer)
    price = Column(Float)
    currency = Column(String, default="USD")
    bin = Column(String, nullable=False, unique=True, index=True)

    # Video Support
    youtube_video_url = Column(String)
    vimeo_video_url = Column(String)
    video_tour_url = Column(String)  # For 360° tours
    has_video = Column(Boolean, default=False)

    # Specifications
    length_feet = Column(Float)
    beam_feet = Column(Float)
    draft_feet = Column(Float)
    boat_type = Column(String)
    hull_material = Column(String)
    hull_type = Column(String)

    # Engine & Performance
    engine_count = Column(Integer)
    engine_hours = Column(Float)
    additional_engines = deferred(Column(JSON, default=[]))
    generators = deferred(Column(JSON, default=[]))
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
    country = Column(String)
    zip_code = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    continent = Column(String)  # North America, Europe, Caribbean, etc.

    # Description
    description = Column(Text)
    features = Column(Text)
    feature_bullets = deferred(Column(JSON, default=[]))
    additional_specs = deferred(Column(JSON, default={}))

    # Condition & Status
    condition = Column(String, default="used")
    previous_owners = Column(Integer)
    status = Column(String, default="active")

    # Co-Brokering / API Access
    # When True (default), this listing is accessible via the public co-brokering API.
    # Only evaluated if the dealer's cobrokering_enabled is also True.
    # allow_cobrokering = Column(Boolean, default=True)

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
    deleted_at = Column(DateTime, nullable=True)  # soft-delete timestamp; NULL = not deleted

    owner = relationship("User", back_populates="listings", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by_user_id], overlaps="created_listings")
    images = relationship("ListingImage", back_populates="listing", cascade="all, delete-orphan")
    saved_by = relationship("SavedListing", back_populates="listing", cascade="all, delete-orphan")

    __table_args__ = (
        # Full-text search index for PostgreSQL
        Index(
            'idx_listing_fulltext',
            text(
                "to_tsvector('english', "
                "coalesce(title, '') || ' ' || "
                "coalesce(description, '') || ' ' || "
                "coalesce(make, '') || ' ' || "
                "coalesce(model, '') || ' ' || "
                "coalesce(boat_type, '')"
                ")"
            ),
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