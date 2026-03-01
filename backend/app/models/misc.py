from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


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


class SmsConversation(Base):
    """
    Maps a dealer phone number to the most recent platform message so that
    when they reply to a YachtVersal SMS notification we can route it back
    into the correct conversation thread.
    """
    __tablename__ = "sms_conversations"

    id = Column(Integer, primary_key=True, index=True)
    dealer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    dealer_phone = Column(String, nullable=False, index=True)  # E.164 format
    twilio_number = Column(String)                              # which Twilio number was used
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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


# REMOVED MediaFile - it's now in media.py to avoid conflict


# Payment model
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

class CommissionRateHistory(Base):
    __tablename__ = "commission_rate_history"
    
    id = Column(Integer, primary_key=True, index=True)
    sales_rep_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    old_rate = Column(Float, nullable=False)
    new_rate = Column(Float, nullable=False)
    reason = Column(Text)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"))
    changed_at = Column(DateTime, default=datetime.utcnow)
    
    sales_rep = relationship("User", foreign_keys=[sales_rep_id])
    changed_by = relationship("User", foreign_keys=[changed_by_user_id])

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


class Comparison(Base):
    __tablename__ = "comparisons"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, default="My Comparison")
    created_at = Column(DateTime, default=datetime.utcnow)
    

class ComparisonItem(Base):
    __tablename__ = "comparison_items"
    
    id = Column(Integer, primary_key=True)
    comparison_id = Column(Integer, ForeignKey("comparisons.id"))
    listing_id = Column(Integer, ForeignKey("listings.id"))
    added_at = Column(DateTime, default=datetime.utcnow)