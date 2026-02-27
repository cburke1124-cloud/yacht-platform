from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func
from datetime import datetime
from typing import Optional, List
import re

from app.db.session import get_db
from app.api.deps import get_current_user, get_optional_user
from app.models.user import User
from app.models.blog import BlogPost, BlogCategory, BlogTag, BlogComment, PostStatus, BlogPostTag
from app.exceptions import (
    AuthorizationException,
    ValidationException,
    ResourceNotFoundException
)

router = APIRouter()


def require_admin_or_editor(current_user: User = Depends(get_current_user)):
    """Require admin or editor access for blog management."""
    if current_user.user_type not in ["admin", "editor"]:
        raise AuthorizationException("Admin or editor access required")
    return current_user


def calculate_reading_time(content: str) -> int:
    """Calculate reading time in minutes (assuming 200 words per minute)."""
    word_count = len(content.split())
    return max(1, round(word_count / 200))


def generate_slug(title: str, db: Session) -> str:
    """Generate a unique slug from title."""
    base_slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    slug = base_slug
    counter = 1
    
    while db.query(BlogPost).filter(BlogPost.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    return slug


# ============= PUBLIC ROUTES =============

@router.get("/blog/posts")
def get_blog_posts(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    featured: Optional[bool] = Query(None),
    limit: int = Query(20, le=100),
    skip: int = Query(0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Get blog posts with filtering - public endpoint."""
    query = db.query(BlogPost).filter(BlogPost.deleted_at == None)
    
    # Non-authenticated users only see published posts
    if not current_user or current_user.user_type not in ["admin", "editor"]:
        query = query.filter(
            BlogPost.status == PostStatus.PUBLISHED,
            BlogPost.published_at <= datetime.utcnow()
        )
    else:
        # Admins/editors can filter by status
        if status:
            query = query.filter(BlogPost.status == status)
    
    # Filter by category
    if category:
        cat = db.query(BlogCategory).filter(BlogCategory.slug == category).first()
        if cat:
            query = query.filter(BlogPost.category_id == cat.id)
    
    # Filter by tag
    if tag:
        tag_obj = db.query(BlogTag).filter(BlogTag.slug == tag).first()
        if tag_obj:
            query = query.join(BlogPostTag).filter(BlogPostTag.tag_id == tag_obj.id)
    
    # Filter by featured
    if featured is not None:
        query = query.filter(BlogPost.featured == featured)
    
    # Search
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                BlogPost.title.ilike(search_term),
                BlogPost.excerpt.ilike(search_term),
                BlogPost.content.ilike(search_term)
            )
        )
    
    total = query.count()
    posts = query.order_by(desc(BlogPost.published_at)).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "posts": [
            {
                "id": post.id,
                "title": post.title,
                "slug": post.slug,
                "excerpt": post.excerpt,
                "content": post.content if current_user else None,
                "featured_image": post.featured_image,
                "category": post.category.slug if post.category else None,
                "category_name": post.category.name if post.category else None,
                "tags": [tag.slug for tag in post.tags],
                "author": f"{post.author.first_name} {post.author.last_name}" if post.author else "Unknown",
                "status": post.status,
                "published_at": post.published_at.isoformat() if post.published_at else None,
                "reading_time": post.reading_time_minutes,
                "view_count": post.view_count,
                "featured": post.featured,
                "created_at": post.created_at.isoformat() if post.created_at else None,
            }
            for post in posts
        ]
    }


@router.get("/blog/posts/{slug}")
def get_blog_post(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Get single blog post by slug."""
    query = db.query(BlogPost).filter(
        BlogPost.slug == slug,
        BlogPost.deleted_at == None
    )
    
    # Non-authenticated users only see published posts
    if not current_user or current_user.user_type not in ["admin", "editor"]:
        query = query.filter(
            BlogPost.status == PostStatus.PUBLISHED,
            BlogPost.published_at <= datetime.utcnow()
        )
    
    post = query.first()
    
    if not post:
        raise ResourceNotFoundException("Blog post", slug)
    
    # Increment view count
    post.view_count += 1
    db.commit()
    
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "excerpt": post.excerpt,
        "content": post.content,
        "featured_image": post.featured_image,
        "featured_image_alt": post.featured_image_alt,
        "category": post.category.slug if post.category else None,
        "category_name": post.category.name if post.category else None,
        "tags": [{"id": tag.id, "name": tag.name, "slug": tag.slug} for tag in post.tags],
        "author": f"{post.author.first_name} {post.author.last_name}" if post.author else "Unknown",
        "author_id": post.author_id,
        "status": post.status,
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "reading_time": post.reading_time_minutes,
        "view_count": post.view_count,
        "like_count": post.like_count,
        "comment_count": post.comment_count,
        "allow_comments": post.allow_comments,
        "featured": post.featured,
        "meta_title": post.meta_title,
        "meta_description": post.meta_description,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
    }


# ============= ADMIN/EDITOR ROUTES =============

@router.post("/admin/blog/posts")
def create_blog_post(
    data: dict,
    current_user: User = Depends(require_admin_or_editor),
    db: Session = Depends(get_db)
):
    """Create a new blog post."""
    if "title" not in data or "content" not in data:
        raise ValidationException("Title and content are required")
    
    # Generate slug if not provided
    slug = data.get("slug", generate_slug(data["title"], db))
    
    # Check if slug exists
    if db.query(BlogPost).filter(BlogPost.slug == slug).first():
        raise ValidationException("A post with this slug already exists")
    
    # Calculate reading time
    reading_time = calculate_reading_time(data["content"])
    
    # Get category
    category_id = None
    if data.get("category"):
        category = db.query(BlogCategory).filter(
            BlogCategory.slug == data["category"]
        ).first()
        if category:
            category_id = category.id
    
    # Create post
    post = BlogPost(
        title=data["title"],
        slug=slug,
        excerpt=data.get("excerpt", ""),
        content=data["content"],
        featured_image=data.get("featured_image"),
        featured_image_alt=data.get("featured_image_alt"),
        meta_title=data.get("meta_title", data["title"]),
        meta_description=data.get("meta_description", data.get("excerpt", "")),
        meta_keywords=data.get("meta_keywords"),
        status=data.get("status", PostStatus.DRAFT),
        author_id=current_user.id,
        category_id=category_id,
        reading_time_minutes=reading_time,
        allow_comments=data.get("allow_comments", True),
        featured=data.get("featured", False)
    )
    
    # Set published date
    if post.status == PostStatus.PUBLISHED:
        post.published_at = datetime.utcnow()
    elif data.get("scheduled_for"):
        post.scheduled_for = datetime.fromisoformat(data["scheduled_for"])
        post.status = PostStatus.SCHEDULED
    
    db.add(post)
    db.flush()
    
    # Add tags
    if data.get("tags"):
        for tag_slug in data["tags"]:
            tag = db.query(BlogTag).filter(BlogTag.slug == tag_slug).first()
            if not tag:
                tag = BlogTag(
                    name=tag_slug.replace("-", " ").title(),
                    slug=tag_slug
                )
                db.add(tag)
                db.flush()
            
            post_tag = BlogPostTag(post_id=post.id, tag_id=tag.id)
            db.add(post_tag)
    
    db.commit()
    db.refresh(post)
    
    return {"success": True, "post_id": post.id, "slug": post.slug}


@router.put("/admin/blog/posts/{post_id}")
def update_blog_post(
    post_id: int,
    data: dict,
    current_user: User = Depends(require_admin_or_editor),
    db: Session = Depends(get_db)
):
    """Update a blog post."""
    post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    
    if not post:
        raise ResourceNotFoundException("Blog post", post_id)
    
    # Update basic fields
    if "title" in data:
        post.title = data["title"]
    if "excerpt" in data:
        post.excerpt = data["excerpt"]
    if "content" in data:
        post.content = data["content"]
        post.reading_time_minutes = calculate_reading_time(data["content"])
    if "featured_image" in data:
        post.featured_image = data["featured_image"]
    if "featured_image_alt" in data:
        post.featured_image_alt = data["featured_image_alt"]
    if "meta_title" in data:
        post.meta_title = data["meta_title"]
    if "meta_description" in data:
        post.meta_description = data["meta_description"]
    if "meta_keywords" in data:
        post.meta_keywords = data["meta_keywords"]
    if "allow_comments" in data:
        post.allow_comments = data["allow_comments"]
    if "featured" in data:
        post.featured = data["featured"]
    
    # Update category
    if "category" in data:
        if data["category"]:
            category = db.query(BlogCategory).filter(
                BlogCategory.slug == data["category"]
            ).first()
            post.category_id = category.id if category else None
        else:
            post.category_id = None
    
    # Update status
    if "status" in data:
        old_status = post.status
        post.status = data["status"]
        
        if post.status == PostStatus.PUBLISHED and not post.published_at:
            post.published_at = datetime.utcnow()
        elif post.status == PostStatus.SCHEDULED and "scheduled_for" in data:
            post.scheduled_for = datetime.fromisoformat(data["scheduled_for"])
    
    # Update tags
    if "tags" in data:
        db.query(BlogPostTag).filter(BlogPostTag.post_id == post_id).delete()
        
        for tag_slug in data["tags"]:
            tag = db.query(BlogTag).filter(BlogTag.slug == tag_slug).first()
            if not tag:
                tag = BlogTag(
                    name=tag_slug.replace("-", " ").title(),
                    slug=tag_slug
                )
                db.add(tag)
                db.flush()
            
            post_tag = BlogPostTag(post_id=post.id, tag_id=tag.id)
            db.add(post_tag)
    
    db.commit()
    db.refresh(post)
    
    return {"success": True, "post": {"id": post.id, "slug": post.slug}}


@router.delete("/admin/blog/posts/{post_id}")
def delete_blog_post(
    post_id: int,
    current_user: User = Depends(require_admin_or_editor),
    db: Session = Depends(get_db)
):
    """Soft delete a blog post."""
    post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    
    if not post:
        raise ResourceNotFoundException("Blog post", post_id)
    
    post.deleted_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Blog post deleted"}


# ============= CATEGORIES =============

@router.get("/blog/categories")
def get_categories(db: Session = Depends(get_db)):
    """Get all blog categories."""
    categories = db.query(BlogCategory).order_by(BlogCategory.order, BlogCategory.name).all()
    
    return [
        {
            "id": cat.id,
            "name": cat.name,
            "slug": cat.slug,
            "description": cat.description,
            "icon": cat.icon,
            "color": cat.color,
            "post_count": db.query(BlogPost).filter(
                BlogPost.category_id == cat.id,
                BlogPost.status == PostStatus.PUBLISHED,
                BlogPost.deleted_at == None
            ).count()
        }
        for cat in categories
    ]


@router.post("/admin/blog/categories")
def create_category(
    data: dict,
    current_user: User = Depends(require_admin_or_editor),
    db: Session = Depends(get_db)
):
    """Create a new category."""
    if "name" not in data:
        raise ValidationException("Category name is required")
    
    slug = data.get("slug", generate_slug(data["name"], db))
    
    category = BlogCategory(
        name=data["name"],
        slug=slug,
        description=data.get("description"),
        icon=data.get("icon"),
        color=data.get("color"),
        order=data.get("order", 0)
    )
    
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return {"success": True, "category_id": category.id}


# ============= TAGS =============

@router.get("/blog/tags")
def get_tags(
    limit: int = Query(50),
    db: Session = Depends(get_db)
):
    """Get all blog tags with post counts."""
    tags = db.query(
        BlogTag,
        func.count(BlogPostTag.post_id).label('post_count')
    ).outerjoin(BlogPostTag).group_by(BlogTag.id).order_by(
        desc('post_count')
    ).limit(limit).all()
    
    return [
        {
            "id": tag.id,
            "name": tag.name,
            "slug": tag.slug,
            "post_count": count
        }
        for tag, count in tags
    ]


# ============= STATS =============

@router.get("/blog/stats")
def get_blog_stats(
    current_user: User = Depends(require_admin_or_editor),
    db: Session = Depends(get_db)
):
    """Get blog statistics for dashboard."""
    total_posts = db.query(BlogPost).filter(BlogPost.deleted_at == None).count()
    published_posts = db.query(BlogPost).filter(
        BlogPost.status == PostStatus.PUBLISHED,
        BlogPost.deleted_at == None
    ).count()
    draft_posts = db.query(BlogPost).filter(
        BlogPost.status == PostStatus.DRAFT,
        BlogPost.deleted_at == None
    ).count()
    total_views = db.query(func.sum(BlogPost.view_count)).scalar() or 0
    total_comments = db.query(BlogComment).filter(
        BlogComment.deleted_at == None
    ).count()
    
    return {
        "total_posts": total_posts,
        "published_posts": published_posts,
        "draft_posts": draft_posts,
        "total_views": total_views,
        "total_comments": total_comments,
        "total_categories": db.query(BlogCategory).count(),
        "total_tags": db.query(BlogTag).count()
    }

    # ============= SCHEDULED POSTS =============

@router.post("/admin/blog/publish-scheduled")
def publish_scheduled_posts_manually(
    current_user: User = Depends(require_admin_or_editor),
    db: Session = Depends(get_db)
):
    """Manually trigger publishing of scheduled posts (for testing)"""
    now = datetime.utcnow()
    
    scheduled_posts = db.query(BlogPost).filter(
        and_(
            BlogPost.status == PostStatus.SCHEDULED,
            BlogPost.scheduled_for <= now,
            BlogPost.deleted_at == None
        )
    ).all()
    
    published_count = 0
    for post in scheduled_posts:
        post.status = PostStatus.PUBLISHED
        post.published_at = post.scheduled_for
        published_count += 1
    
    db.commit()
    
    return {
        "success": True,
        "published_count": published_count,
        "message": f"Published {published_count} scheduled post(s)"
    }