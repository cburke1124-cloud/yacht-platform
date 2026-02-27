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
    
    # Ownership - ✅ Simplified
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # created_by_user_id removed - use user_id
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships - ✅ Simplified
    files = relationship("MediaFile", back_populates="folder")
    parent = relationship("MediaFolder", remote_side=[id], backref="subfolders")
    user = relationship("User", backref="media_folders")  # ✅ Simple relationship
    
    # Indexes
    __table_args__ = (
        Index('idx_folder_owner', 'user_id', 'deleted_at'),
        Index('idx_folder_parent', 'parent_id'),
    )


class ListingMediaAttachment(Base):
    """
    Junction table linking media files to listings
    Replaces the simple url storage in ListingImage
    """
    __tablename__ = "listing_media_attachments"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    media_id = Column(Integer, ForeignKey("media_files.id"), nullable=False)
    
    # Display settings
    display_order = Column(Integer, default=0)
    is_primary = Column(Boolean, default=False)
    caption = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    listing = relationship("Listing", backref="media_attachments")
    media = relationship("MediaFile", backref="listing_attachments")
    
    # Indexes
    __table_args__ = (
        Index('idx_attachment_listing', 'listing_id'),
        Index('idx_attachment_media', 'media_id'),
        Index('idx_attachment_order', 'listing_id', 'display_order'),
    )
