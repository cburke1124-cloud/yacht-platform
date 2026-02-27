from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.db.base_class import Base


class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    SCHEDULED = "scheduled"
    ARCHIVED = "archived"


class BlogCategory(Base):
    __tablename__ = "blog_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(120), unique=True, nullable=False, index=True)
    description = Column(Text)
    icon = Column(String(50))  # Emoji or icon class
    color = Column(String(20))  # Hex color code
    order = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    posts = relationship("BlogPost", back_populates="category")


class BlogTag(Base):
    __tablename__ = "blog_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    slug = Column(String(60), unique=True, nullable=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class BlogPost(Base):
    __tablename__ = "blog_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Author
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Category
    category_id = Column(Integer, ForeignKey("blog_categories.id"))
    
    # Content
    title = Column(String(255), nullable=False)
    slug = Column(String(300), unique=True, nullable=False, index=True)
    excerpt = Column(Text)
    content = Column(Text, nullable=False)
    
    # Media
    featured_image = Column(String(500))
    featured_image_alt = Column(String(255))
    
    # SEO
    meta_title = Column(String(255))
    meta_description = Column(Text)
    meta_keywords = Column(Text)
    
    # Status & Publishing
    status = Column(Enum(PostStatus), default=PostStatus.DRAFT, nullable=False)
    published_at = Column(DateTime)
    scheduled_for = Column(DateTime)
    
    # Engagement
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    
    # Settings
    allow_comments = Column(Boolean, default=True)
    featured = Column(Boolean, default=False)
    
    # Reading time (auto-calculated)
    reading_time_minutes = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)
    
    # Relationships
    author = relationship("User", back_populates="blog_posts")
    category = relationship("BlogCategory", back_populates="posts")
    tags = relationship("BlogTag", secondary="blog_post_tags")
    comments = relationship("BlogComment", back_populates="post")


class BlogPostTag(Base):
    __tablename__ = "blog_post_tags"
    
    post_id = Column(Integer, ForeignKey("blog_posts.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("blog_tags.id"), primary_key=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class BlogComment(Base):
    __tablename__ = "blog_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    
    post_id = Column(Integer, ForeignKey("blog_posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    parent_id = Column(Integer, ForeignKey("blog_comments.id"))  # For nested comments
    
    # Comment content
    author_name = Column(String(100))  # For guest comments
    author_email = Column(String(255))  # For guest comments
    content = Column(Text, nullable=False)
    
    # Moderation
    approved = Column(Boolean, default=False)
    spam = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)
    
    # Relationships
    post = relationship("BlogPost", back_populates="comments")
    user = relationship("User")
    replies = relationship("BlogComment", backref="parent", remote_side=[id])
