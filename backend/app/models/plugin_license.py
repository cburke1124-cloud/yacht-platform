from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class PluginLicense(Base):
    """License for the standalone yachtversal-inventory WordPress plugin,
    sold to dealers who run their own WordPress site."""
    __tablename__ = "plugin_licenses"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    license_key_hash = Column(String, unique=True, index=True, nullable=False)
    license_key_prefix = Column(String(12), nullable=False)

    plan = Column(String(50), default="standard")  # standard, agency
    max_sites = Column(Integer, default=1)

    status = Column(String(50), default="active")  # active, suspended, cancelled, expired
    expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dealer = relationship("User", back_populates="plugin_licenses")
    activations = relationship(
        "PluginLicenseActivation", back_populates="license", cascade="all, delete-orphan"
    )


class PluginLicenseActivation(Base):
    """A single WordPress site the license has been activated on."""
    __tablename__ = "plugin_license_activations"

    id = Column(Integer, primary_key=True, index=True)
    license_id = Column(Integer, ForeignKey("plugin_licenses.id"), nullable=False)

    site_url = Column(String(500), nullable=False, index=True)
    plugin_version = Column(String(20))

    activated_at = Column(DateTime, default=datetime.utcnow)
    last_check_in = Column(DateTime, default=datetime.utcnow)
    deactivated_at = Column(DateTime, nullable=True)

    notes = Column(Text)

    license = relationship("PluginLicense", back_populates="activations")
