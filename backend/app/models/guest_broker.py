from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class GuestBroker(Base):
    """
    A reusable broker/salesman profile that belongs to a dealer but is NOT
    tied to a YachtVersal user account.  Office admins create these so that
    listings can be attributed to a real person who has no interest in
    managing their own platform account.
    """
    __tablename__ = "guest_brokers"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    first_name = Column(String, nullable=False)
    last_name = Column(String, default="")
    email = Column(String)
    phone = Column(String)
    title = Column(String)
    bio = Column(Text)
    photo_url = Column(String)
    social_links = Column(JSON, default={})
    # 'scraper' = auto-created by broker site importer; 'manual' = created by office admin
    source = Column(String, default="manual")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dealer = relationship("User", foreign_keys=[dealer_id])
