from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class CharterListing(Base):
    __tablename__ = "charter_listings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    # Team-member attribution, mirroring Listing.assigned_salesman_id — lets a
    # charter be attributed to a specific sales rep for dashboard/analytics
    # purposes, independent of which dealer account owns it (user_id).
    assigned_salesman_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Identity
    title = Column(String, nullable=False)
    vessel_name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)

    # Vessel specs
    make = Column(String)
    model = Column(String)
    year = Column(Integer)
    length_feet = Column(Float)
    beam_feet = Column(Float)
    draft_feet = Column(Float)
    boat_type = Column(String)
    hull_material = Column(String)

    # Engine
    engine_make = Column(String)
    engine_count = Column(Integer)
    fuel_type = Column(String)
    max_speed_knots = Column(Float)
    cruising_speed_knots = Column(Float)

    # Accommodation
    cabins = Column(Integer)
    berths = Column(Integer)
    heads = Column(Integer)

    # Charter specifics
    max_guests = Column(Integer)
    crew_included = Column(Boolean, default=True)
    crew_count = Column(Integer)
    crew_profiles = Column(JSON, default=list)  # optional: [{name, role, bio}]

    # Location
    home_port = Column(String)
    home_port_city = Column(String, index=True)
    home_port_state = Column(String)
    home_port_country = Column(String, default="USA")
    operating_regions = Column(String)
    embarkation_ports = Column(JSON, default=list)
    disembarkation_ports = Column(JSON, default=list)
    one_way_allowed = Column(Boolean, default=False)
    turnaround_days = Column(Integer)

    # Rates
    day_rate = Column(Float)
    half_day_rate = Column(Float)
    week_rate = Column(Float)
    currency = Column(String, default="USD")
    min_charter_days = Column(Integer)
    max_charter_days = Column(Integer)
    apa_percentage = Column(Float)
    security_deposit = Column(Float)
    tax_notes = Column(Text)
    cancellation_policy = Column(Text)

    # Package inclusions / exclusions
    included_items = Column(JSON, default=list)
    excluded_items = Column(JSON, default=list)

    # Content
    description = Column(Text)
    amenities = Column(JSON, default=list)
    images = Column(JSON, default=list)

    # External booking
    booking_url = Column(String)

    # Charter company info (denormalized for easy display)
    charter_company_name = Column(String)
    charter_company_slug = Column(String)
    charter_company_email = Column(String)
    charter_company_phone = Column(String)
    charter_company_website = Column(String)

    # Status
    status = Column(String, default="active", index=True)  # active, inactive, draft
    deleted_at = Column(DateTime, nullable=True, index=True)  # soft-delete timestamp; NULL = not deleted

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    availability_blocks = relationship(
        "CharterAvailabilityBlock",
        back_populates="charter",
        cascade="all, delete-orphan",
    )
    seasonal_rates = relationship(
        "CharterSeasonalRate",
        back_populates="charter",
        cascade="all, delete-orphan",
    )


class CharterAvailabilityBlock(Base):
    __tablename__ = "charter_availability_blocks"

    id = Column(Integer, primary_key=True, index=True)
    charter_id = Column(Integer, ForeignKey("charter_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    status = Column(String, default="booked", index=True)  # booked, hold, option, maintenance, owner_use
    source = Column(String, default="manual")  # manual, ical, api, booking
    notes = Column(Text)
    external_ref = Column(String)
    hold_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    charter = relationship("CharterListing", back_populates="availability_blocks")


class CharterSeasonalRate(Base):
    __tablename__ = "charter_seasonal_rates"

    id = Column(Integer, primary_key=True, index=True)
    charter_id = Column(Integer, ForeignKey("charter_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    season_name = Column(String, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    day_rate = Column(Float)
    half_day_rate = Column(Float)
    week_rate = Column(Float)
    currency = Column(String, default="USD")
    min_charter_days = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    charter = relationship("CharterListing", back_populates="seasonal_rates")
