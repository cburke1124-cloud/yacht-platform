from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class CharterListing(Base):
    __tablename__ = "charter_listings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

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

    # Location
    home_port = Column(String)
    home_port_city = Column(String, index=True)
    home_port_state = Column(String)
    home_port_country = Column(String, default="USA")
    operating_regions = Column(String)

    # Rates
    day_rate = Column(Float)
    half_day_rate = Column(Float)
    week_rate = Column(Float)
    currency = Column(String, default="USD")
    min_charter_days = Column(Integer)
    max_charter_days = Column(Integer)

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

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
