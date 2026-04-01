from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class AffiliateAccount(Base):
    __tablename__ = "affiliate_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False)
    account_type = Column(String(32), default="affiliate", nullable=False)  # affiliate | sales_rep
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    commission_rate = Column(Float, default=10.0)
    active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner_user = relationship("User", foreign_keys=[user_id])
    creator_user = relationship("User", foreign_keys=[created_by])


class PartnerDeal(Base):
    __tablename__ = "partner_deals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String(64), unique=True, index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner_sales_rep_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    affiliate_account_id = Column(Integer, ForeignKey("affiliate_accounts.id"), nullable=True)

    target_email = Column(String, nullable=True, index=True)
    free_days = Column(Integer, default=0)
    discount_type = Column(String(32), nullable=True)  # percentage | fixed
    discount_value = Column(Float, nullable=True)
    fixed_monthly_price = Column(Float, nullable=True)
    term_months = Column(Integer, nullable=True)
    lifetime = Column(Boolean, default=False)

    notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator_user = relationship("User", foreign_keys=[created_by])
    owner_sales_rep = relationship("User", foreign_keys=[owner_sales_rep_id])
    affiliate_account = relationship("AffiliateAccount", foreign_keys=[affiliate_account_id])


class PartnerOffer(Base):
    """Pre-created promotional offers admin creates; sales reps share the URLs."""
    __tablename__ = "partner_offers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    terms_summary = Column(String, nullable=True)       # e.g. "4 months free, then $199/mo"
    coupon_id = Column(String(64), nullable=True)        # Stripe coupon ID — drives the shareable link
    stripe_payment_link_url = Column(String, nullable=True)  # manual URL override (legacy)
    tier = Column(String(32), nullable=True)             # basic | plus | pro (label only for coupon-based offers)
    sort_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator_user = relationship("User", foreign_keys=[created_by])


class ReferralSignup(Base):
    __tablename__ = "referral_signups"

    id = Column(Integer, primary_key=True, index=True)
    dealer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    source_type = Column(String(32), nullable=False)  # sales_rep | affiliate
    sales_rep_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    affiliate_account_id = Column(Integer, ForeignKey("affiliate_accounts.id"), nullable=True, index=True)
    deal_id = Column(Integer, ForeignKey("partner_deals.id"), nullable=True)
    referral_code_used = Column(String(64), nullable=True)
    effective_monthly_price = Column(Float, nullable=True)
    commission_rate = Column(Float, default=10.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    dealer_user = relationship("User", foreign_keys=[dealer_user_id])
    sales_rep = relationship("User", foreign_keys=[sales_rep_id])
    affiliate_account = relationship("AffiliateAccount", foreign_keys=[affiliate_account_id])
    deal = relationship("PartnerDeal", foreign_keys=[deal_id])