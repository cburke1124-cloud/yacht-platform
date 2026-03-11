from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base import Base


class Documentation(Base):
    __tablename__ = "documentation"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)  # URL-friendly identifier
    title = Column(String, nullable=False)
    description = Column(String)  # Short description for listings
    content = Column(Text, nullable=False)  # Full markdown/HTML content
    category = Column(String, default="general", index=True)  # demo, sales, admin, api, general
    audience = Column(String, default="all")  # all, admin, sales_rep, dealer, public
    order = Column(Integer, default=0)  # Sort order within category
    published = Column(Boolean, default=True, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationship
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id])
