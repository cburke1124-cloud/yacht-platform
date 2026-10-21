from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class ChatConversation(Base):
    """One chat-widget session. Stored for lead follow-up and so admins can
    audit (and later train on) the assistant's answers."""
    __tablename__ = "chat_conversations"

    id = Column(Integer, primary_key=True, index=True)
    # Client-generated UUID kept in the visitor's browser so successive
    # messages land in the same conversation.
    session_id = Column(String(64), unique=True, index=True, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # Salted hash only -- raw IPs are not stored.
    ip_hash = Column(String(64), nullable=True, index=True)
    page_url = Column(String, nullable=True)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)

    # Lead data, filled in as the visitor volunteers it.
    contact_name = Column(String, nullable=True)
    contact_email = Column(String, nullable=True, index=True)
    contact_phone = Column(String, nullable=True)
    inquiry_id = Column(Integer, ForeignKey("inquiries.id", ondelete="SET NULL"), nullable=True)
    lead_captured_at = Column(DateTime, nullable=True)

    message_count = Column(Integer, default=0)
    # Admin review fields
    reviewed = Column(Boolean, default=False)
    admin_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    last_message_at = Column(DateTime, default=datetime.utcnow, index=True)

    messages = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.id",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False, index=True)

    role = Column(String(20), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    intent = Column(String(30), nullable=True)  # general | search | contact_broker
    # Listing/charter ids shown to the visitor for a "search" reply.
    result_refs = Column(JSON, nullable=True)

    # Admin feedback for improving responses: 1 good, -1 bad, NULL unrated.
    admin_rating = Column(Integer, nullable=True)
    admin_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("ChatConversation", back_populates="messages")


class AIUsageEvent(Base):
    """One row per token-spending request (AI search, chatbot message). Backs
    the per-visitor / per-account quotas."""
    __tablename__ = "ai_usage_events"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(30), nullable=False, index=True)  # ai_search | chatbot
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    ip_hash = Column(String(64), nullable=True, index=True)
    visitor_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
