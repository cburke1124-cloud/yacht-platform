from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class MediaFile(Base):
    """
    Stores all uploaded media files (images, videos, PDFs)
    Shared across dealer organization (dealer + their sales reps)
    """
    __tablename__ = "media_files"

    id = Column(Integer, primary_key=True, index=True)
    
    # File Information
    filename = Column(String, nullable=False)
    url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)
    file_type = Column(String, nullable=False)
    file_size_mb = Column(Float, nullable=False)
    
    # Image/Video specific
    width = Column(Integer)
    height = Column(Integer)
    duration_seconds = Column(Integer)
    
    # Metadata
    alt_text = Column(Text)
    caption = Column(Text)
    
    # Organization & Ownership
    folder_id = Column(Integer, ForeignKey("media_folders.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # ✅ Only this one
    # uploaded_by_user_id removed - use user_id for both owner and uploader
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships - ✅ Simplified
    folder = relationship("MediaFolder", back_populates="files")
    user = relationship("User", back_populates="media_files")  # ✅ Simple relationship
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_media_owner', 'user_id', 'deleted_at'),
        Index('idx_media_folder', 'folder_id', 'deleted_at'),
        Index('idx_media_type', 'file_type', 'deleted_at'),
        Index('idx_media_created', 'created_at'),
    )


class MediaFolder(Base):
    """
    Folders for organizing media files
    Shared across dealer organization
    """
    __tablename__ = "media_folders"

    id = Column(Integer, primary_key=True, index=True)
    
    # Folder Information
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("media_folders.id"), nullable=True)
    
    # Ownership
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # NOT NULL in the live DB (unlike MediaFile, which really did drop its
    # equivalent column) — a prior cleanup pass removed this from the model
    # assuming the DB column had been dropped too, but it never was, so every
    # ORM insert omitting it violated the NOT NULL constraint and folder
    # creation always 500'd. Kept distinct from user_id: user_id is the
    # owning org/dealer (may be a different dealer than the caller when an
    # admin passes as_dealer_id), created_by_user_id is whoever actually
    # clicked "create".
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships - ✅ Simplified
    files = relationship("MediaFile", back_populates="folder")
    parent = relationship("MediaFolder", remote_side=[id], backref="subfolders")
    user = relationship("User", foreign_keys=[user_id], backref="media_folders")
    
    # Indexes
    __table_args__ = (
        Index('idx_folder_owner', 'user_id', 'deleted_at'),
        Index('idx_folder_parent', 'parent_id'),
    )


class ListingMediaAttachment(Base):
    """
    Junction table linking media files to listings (for-sale) OR charter
    listings. Exactly one of listing_id / charter_listing_id is set per row —
    both are nullable so the table can serve either owner type without a
    polymorphic owner_type/owner_id redesign.
    """
    __tablename__ = "listing_media_attachments"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign Keys — exactly one of these two is populated per row
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=True)
    charter_listing_id = Column(Integer, ForeignKey("charter_listings.id"), nullable=True)
    media_id = Column(Integer, ForeignKey("media_files.id"), nullable=False)

    # Display settings
    display_order = Column(Integer, default=0)
    is_primary = Column(Boolean, default=False)
    caption = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    listing = relationship("Listing", backref="media_attachments")
    charter_listing = relationship("CharterListing", backref="media_attachments")
    media = relationship("MediaFile", backref="listing_attachments")

    # Indexes
    __table_args__ = (
        Index('idx_attachment_listing', 'listing_id'),
        Index('idx_attachment_charter_listing', 'charter_listing_id'),
        Index('idx_attachment_media', 'media_id'),
        Index('idx_attachment_order', 'listing_id', 'display_order'),
        Index('idx_attachment_charter_order', 'charter_listing_id', 'display_order'),
    )
