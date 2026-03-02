"""
Vessel catalog — normalized make/model reference data.

Designed to be source-agnostic: can be seeded manually, imported from the
USCG documentation database CSV, or replaced by a BUC/NADA API feed later.
Future tables (vessel_specs, vessel_years) can be added without touching these.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, UniqueConstraint, Index, Text,
)
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class VesselMake(Base):
    __tablename__ = "vessel_makes"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(200), nullable=False, unique=True, index=True)
    slug        = Column(String(200), nullable=False, unique=True, index=True)
    country     = Column(String(100))                 # e.g. "Italy", "USA"
    propulsion  = Column(String(20), default="both")  # power | sail | both
    notes       = Column(Text)                        # free-form, e.g. "luxury Italian builder"
    active      = Column(Boolean, default=True, nullable=False)
    source      = Column(String(50), default="manual") # manual | uscg | buc | nada
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    models = relationship("VesselModel", back_populates="make", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<VesselMake id={self.id} name={self.name!r}>"


class VesselModel(Base):
    __tablename__ = "vessel_models"

    id          = Column(Integer, primary_key=True, index=True)
    make_id     = Column(Integer, ForeignKey("vessel_makes.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(200), nullable=False)
    boat_type   = Column(String(100))   # Motor Yacht, Sailing Yacht, Catamaran, Trawler…
    propulsion  = Column(String(20))    # power | sail
    length_ft   = Column(Float)         # nominal LOA
    min_year    = Column(Integer)       # first model year
    max_year    = Column(Integer)       # last model year; NULL = still in production
    active      = Column(Boolean, default=True, nullable=False)
    source      = Column(String(50), default="manual")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    make = relationship("VesselMake", back_populates="models")

    __table_args__ = (
        UniqueConstraint("make_id", "name", name="uq_vessel_model_make_name"),
        Index("idx_vessel_model_boat_type", "boat_type"),
        Index("idx_vessel_model_propulsion", "propulsion"),
    )

    def __repr__(self) -> str:
        return f"<VesselModel id={self.id} make_id={self.make_id} name={self.name!r}>"
