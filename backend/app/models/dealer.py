from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base

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
    postal_code = Column(String)

    # Online Presence
    website = Column(String)
    description = Column(Text)
    logo_url = Column(String)
    banner_url = Column(String)  
    facebook_url = Column(String)  
    instagram_url = Column(String)  
    twitter_url = Column(String) 
    linkedin_url = Column(String)  


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

    # Co-Brokering / API Access
    # When True (default), the dealer's listings are accessible via the public API (co-brokering enabled).
    # When False, ALL of this dealer's listings are hidden from the public API regardless of
    # individual listing settings.
    # cobrokering_enabled = Column(Boolean, default=True)

    # Team Display
    show_team_on_profile = Column(Boolean, default=False)

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
