from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class PreviewListing(Base):
    __tablename__ = "preview_listings"

    id = Column(Integer, primary_key=True, index=True)
    share_token = Column(String(64), unique=True, index=True, nullable=False)

    # Who created it
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Basic info
    title = Column(String)
    make = Column(String)
    model = Column(String)
    year = Column(Integer)
    price = Column(Float)
    currency = Column(String, default="USD")

    # Specs
    length_feet = Column(Float)
    beam_feet = Column(Float)
    draft_feet = Column(Float)
    boat_type = Column(String)
    hull_material = Column(String)
    hull_type = Column(String)
    condition = Column(String)

    # Engine
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
    country = Column(String)

    # Description
    description = Column(Text)
    feature_bullets = Column(JSON, default=list)
    additional_specs = Column(JSON, default=dict)

    # Seller / Brokerage info
    seller_name = Column(String)
    seller_email = Column(String)
    seller_phone = Column(String)
    brokerage_name = Column(String)
    brokerage_logo_url = Column(String)
    brokerage_website = Column(String)

    # Images — list of {url, is_primary}
    images = Column(JSON, default=list)

    # Source URL (used for scrape-fill)
    source_url = Column(String)

    # Internal note visible only to staff
    internal_note = Column(Text)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])
