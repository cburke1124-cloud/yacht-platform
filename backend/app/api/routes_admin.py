from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime
from typing import Optional
import secrets
import sys
import platform
import os
import time
import logging
import uuid

from app.core.logging import memory_log_handler

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.models.media import MediaFile, MediaFolder, ListingMediaAttachment
from app.models.partner_growth import AffiliateAccount, ReferralSignup
from app.models.partner_growth import PartnerDeal
from app.models.misc import SiteSettings
from app.exceptions import (
    AuthorizationException,
    ValidationException,
    ResourceNotFoundException
)
from app.services.media_storage import get_storage_health, run_storage_test
from app.security.auth import get_password_hash
from app.services.email_service import email_service
from app.services.demo_fixtures import get_demo_listing_data
from app.models.documentation import Documentation
from app.services.default_documentation import get_default_doc_by_slug

router = APIRouter()


def _generate_ref_code() -> str:
    return f"YV{secrets.token_hex(4).upper()}"


def _ensure_sales_rep_affiliate_account(sales_rep: User, db: Session, created_by: Optional[int] = None) -> AffiliateAccount:
    account = db.query(AffiliateAccount).filter(
        AffiliateAccount.user_id == sales_rep.id,
        AffiliateAccount.account_type == "sales_rep",
    ).first()
    if account:
        return account

    code = _generate_ref_code()
    while db.query(AffiliateAccount).filter(AffiliateAccount.code == code).first():
        code = _generate_ref_code()

    account = AffiliateAccount(
        name=f"{sales_rep.first_name or ''} {sales_rep.last_name or ''}".strip() or sales_rep.email,
        email=sales_rep.email,
        code=code,
        account_type="sales_rep",
        user_id=sales_rep.id,
        commission_rate=sales_rep.commission_rate or 10.0,
        active=True,
        created_by=created_by,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def require_admin(current_user: User = Depends(get_current_user)):
    """Dependency to require admin access."""
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    return current_user


@router.get("/storage/health")
def storage_health(
    current_user: User = Depends(require_admin),
):
    return get_storage_health()


@router.post("/storage/health/test")
def storage_health_test(
    current_user: User = Depends(require_admin),
):
    try:
        return run_storage_test()
    except Exception as e:
        return {
            "success": False,
            "message": f"Storage test failed: {str(e)}",
        }

# ============= Commission Management =============

@router.put("/sales-reps/{rep_id}/commission")
def update_sales_rep_commission(
    rep_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a sales rep's commission rate (admin only)."""
    sales_rep = db.query(User).filter(
        User.id == rep_id,
        User.user_type == "salesman"
    ).first()
    
    if not sales_rep:
        raise ResourceNotFoundException("Sales rep", rep_id)
    
    new_rate = data.get("commission_rate")
    if new_rate is None or new_rate < 0 or new_rate > 100:
        raise ValidationException("Commission rate must be between 0 and 100")
    
    # Log the change in history
    from app.models.misc import CommissionRateHistory
    
    old_rate = sales_rep.commission_rate or 10.0
    
    history = CommissionRateHistory(
        sales_rep_id=rep_id,
        old_rate=old_rate,
        new_rate=new_rate,
        reason=data.get("reason", "Rate adjustment"),
        changed_by_user_id=current_user.id
    )
    db.add(history)
    
    # Update the rate
    sales_rep.commission_rate = new_rate

    affiliate_account = db.query(AffiliateAccount).filter(
        AffiliateAccount.user_id == sales_rep.id,
        AffiliateAccount.account_type == "sales_rep",
    ).first()
    if affiliate_account:
        affiliate_account.commission_rate = float(new_rate)
    
    db.commit()
    db.refresh(sales_rep)
    
    return {
        "success": True,
        "sales_rep_id": rep_id,
        "old_rate": float(old_rate),
        "new_rate": float(new_rate)
    }


@router.get("/sales-reps/{rep_id}/commission-history")
def get_commission_history(
    rep_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get commission rate change history for a sales rep."""
    from app.models.misc import CommissionRateHistory
    
    history = db.query(CommissionRateHistory).filter(
        CommissionRateHistory.sales_rep_id == rep_id
    ).order_by(CommissionRateHistory.changed_at.desc()).all()
    
    return [
        {
            "old_rate": float(h.old_rate),
            "new_rate": float(h.new_rate),
            "reason": h.reason,
            "changed_at": h.changed_at.isoformat(),
            "changed_by": h.changed_by_user_id
        }
        for h in history
    ]

# ============= USERS MANAGEMENT =============

@router.get("/users")
def get_all_users(
    skip: int = 0,
    limit: int = 100,
    user_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all users with filtering."""
    query = db.query(User)
    
    if user_type:
        query = query.filter(User.user_type == user_type)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_pattern)) |
            (User.first_name.ilike(search_pattern)) |
            (User.last_name.ilike(search_pattern)) |
            (User.company_name.ilike(search_pattern))
        )
    
    total = query.count()
    users = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "company_name": u.company_name,
                "user_type": u.user_type,
                "subscription_tier": u.subscription_tier,
                "active": u.active,
                "trial_active": u.trial_active,
                "created_at": u.created_at.isoformat() if u.created_at else None
            }
            for u in users
        ]
    }


@router.get("/users/{user_id}")
def get_user_details(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get detailed user information."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    # Get dealer profile if exists
    dealer_profile = db.query(DealerProfile).filter(
        DealerProfile.user_id == user_id
    ).first()
    
    # Get listing stats
    listing_stats = db.query(
        func.count(Listing.id).label('total'),
        func.count(Listing.id).filter(Listing.status == 'active').label('active'),
        func.sum(Listing.views).label('total_views'),
        func.sum(Listing.inquiries).label('total_inquiries')
    ).filter(Listing.user_id == user_id).first()
    
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "company_name": user.company_name,
        "user_type": user.user_type,
        "subscription_tier": user.subscription_tier,
        "active": user.active,
        "trial_active": user.trial_active,
        "trial_end_date": user.trial_end_date.isoformat() if user.trial_end_date else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "dealer_profile": {
            "slug": dealer_profile.slug,
            "logo_url": dealer_profile.logo_url,
            "website": dealer_profile.website,
            "description": dealer_profile.description
        } if dealer_profile else None,
        "listing_stats": {
            "total_listings": listing_stats.total or 0,
            "active_listings": listing_stats.active or 0,
            "total_views": listing_stats.total_views or 0,
            "total_inquiries": listing_stats.total_inquiries or 0
        }
    }


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update user details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    updatable_fields = [
        'first_name', 'last_name', 'phone', 'company_name',
        'user_type', 'subscription_tier', 'active', 'trial_active'
    ]
    
    for field in updatable_fields:
        if field in data:
            setattr(user, field, data[field])
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return {"success": True, "user": {
        "id": user.id,
        "email": user.email,
        "user_type": user.user_type,
        "subscription_tier": user.subscription_tier
    }}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    permanent: bool = False,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete or deactivate a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    if permanent:
        # Delete user and all their listings
        db.query(Listing).filter(Listing.user_id == user_id).delete()
        db.delete(user)
        message = "User permanently deleted"
    else:
        # Just deactivate
        user.active = False
        message = "User deactivated"
    
    db.commit()
    return {"success": True, "message": message}


# ============= DEALERS MANAGEMENT =============

@router.get("/dealers")
def get_all_dealers(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all dealers with their stats."""
    dealers = db.query(User).filter(
        User.user_type == "dealer"
    ).offset(skip).limit(limit).all()
    
    dealer_list = []
    for dealer in dealers:
        # Get listing count
        listing_count = db.query(Listing).filter(
            Listing.user_id == dealer.id
        ).count()
        
        active_listings = db.query(Listing).filter(
            Listing.user_id == dealer.id,
            Listing.status == "active"
        ).count()
        
        dealer_list.append({
            "id": dealer.id,
            "name": f"{dealer.first_name or ''} {dealer.last_name or ''}".strip() or dealer.email,
            "email": dealer.email,
            "first_name": dealer.first_name,
            "last_name": dealer.last_name,
            "phone": dealer.phone,
            "company_name": dealer.company_name,
            "subscription_tier": dealer.subscription_tier,
            "verified": dealer.verified,
            "active": dealer.active,
            "total_listings": listing_count,
            "active_listings": active_listings,
            "created_at": dealer.created_at.isoformat() if dealer.created_at else None
        })
    
    return dealer_list


@router.post("/dealers")
def create_dealer(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new dealer account and send a password-setup email."""
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise ValidationException("Email is required")

    # Check for duplicate
    if db.query(User).filter(User.email == email).first():
        raise ValidationException("A user with that email already exists")

    # Split name into first/last
    raw_name = (data.get("name") or "").strip()
    parts = raw_name.split(" ", 1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""

    # Generate a one-time setup token stored in verification_token
    setup_token = secrets.token_urlsafe(32)
    # Unusable random password — dealer cannot log in until they set their own
    dummy_hash = get_password_hash(secrets.token_urlsafe(32))

    dealer = User(
        email=email,
        password_hash=dummy_hash,
        first_name=first_name,
        last_name=last_name,
        phone=data.get("phone"),
        company_name=data.get("company_name"),
        user_type="dealer",
        subscription_tier="free",
        verified=bool(data.get("verified", False)),
        active=bool(data.get("active", True)),
        verification_token=setup_token,
        email_verified=False,
    )
    db.add(dealer)
    db.commit()
    db.refresh(dealer)

    # Send password-setup email
    base_url = __import__("os").getenv("BASE_URL", "https://yachtversal.com")
    setup_link = f"{base_url}/set-password?token={setup_token}"
    display_name = raw_name or email
    html = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(to right,#0f4c81,#1a6fad);padding:30px;text-align:center">
        <h1 style="color:white;margin:0">Welcome to YachtVersal</h1>
      </div>
      <div style="padding:30px;background:#f9fafb">
        <h2 style="color:#1f2937">Hi {display_name},</h2>
        <p style="color:#4b5563">Your dealer account has been created. Click the button below to set up your password and access your dashboard.</p>
        <div style="text-align:center;margin:30px 0">
          <a href="{setup_link}" style="background:#0f4c81;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
            Set Up My Password
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px">This link expires in 72&nbsp;hours. If you did not expect this email, you can ignore it.</p>
      </div>
    </body></html>
    """
    try:
        email_service.send_email(
            to_email=email,
            subject="Set up your YachtVersal dealer account",
            html_content=html,
        )
        email_sent = True
    except Exception:
        email_sent = False

    return {
        "success": True,
        "id": dealer.id,
        "email": dealer.email,
        "name": f"{dealer.first_name or ''} {dealer.last_name or ''}".strip(),
        "email_sent": email_sent,
        "message": "Dealer created. A password-setup email has been sent." if email_sent else "Dealer created. Email could not be sent — check SendGrid configuration.",
    }


@router.put("/dealers/{dealer_id}")
def update_dealer(
    dealer_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update dealer fields (verified, active, name, company, etc.)."""
    dealer = db.query(User).filter(User.id == dealer_id, User.user_type == "dealer").first()
    if not dealer:
        raise ResourceNotFoundException("Dealer", dealer_id)

    updatable = ["first_name", "last_name", "phone", "company_name",
                 "verified", "active", "subscription_tier"]
    for field in updatable:
        if field in data:
            setattr(dealer, field, data[field])

    db.commit()
    db.refresh(dealer)
    return {"success": True, "id": dealer.id, "verified": dealer.verified, "active": dealer.active}


@router.delete("/dealers/{dealer_id}")
def delete_dealer(
    dealer_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Permanently delete a dealer and their listings."""
    dealer = db.query(User).filter(User.id == dealer_id, User.user_type == "dealer").first()
    if not dealer:
        raise ResourceNotFoundException("Dealer", dealer_id)

    db.query(Listing).filter(Listing.user_id == dealer_id).delete()
    db.delete(dealer)
    db.commit()
    return {"success": True, "message": "Dealer deleted"}


# ============= MEDIA MANAGEMENT =============

@router.get("/media/stats")
def get_media_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get media storage statistics."""
    from app.models.media import MediaFile, MediaFolder

    # Total files and storage
    total_stats = db.query(
        func.count(MediaFile.id).label('total_files'),
        func.sum(MediaFile.file_size_mb).label('total_size_mb')
    ).filter(MediaFile.deleted_at == None).first()

    # Stats by file type
    image_stats = db.query(
        func.count(MediaFile.id).label('count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).filter(
        MediaFile.file_type == 'image',
        MediaFile.deleted_at == None
    ).first()

    video_stats = db.query(
        func.count(MediaFile.id).label('count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).filter(
        MediaFile.file_type == 'video',
        MediaFile.deleted_at == None
    ).first()
    
    pdf_stats = db.query(
        func.count(MediaFile.id).label('count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).filter(
        MediaFile.file_type == 'pdf',
        MediaFile.deleted_at == None
    ).first()
    
    # Storage by dealer
    dealer_storage = db.query(
        User.id.label('dealer_id'),
        User.company_name.label('dealer_name'),
        User.subscription_tier.label('tier'),
        func.count(MediaFile.id).label('file_count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).join(MediaFile, MediaFile.user_id == User.id).filter(
        User.user_type == 'dealer',
        MediaFile.deleted_at == None
    ).group_by(User.id).order_by(func.sum(MediaFile.file_size_mb).desc()).limit(20).all()
    
    # Orphaned files (not associated with any listing)
    orphaned_count = db.query(func.count(MediaFile.id)).filter(
        MediaFile.deleted_at == None
    ).outerjoin(
        ListingMediaAttachment,
        MediaFile.id == ListingMediaAttachment.media_id
    ).filter(
        ListingMediaAttachment.id == None
    ).scalar()
    
    # Large files (over 10MB)
    large_files_count = db.query(func.count(MediaFile.id)).filter(
        MediaFile.file_size_mb > 10,
        MediaFile.deleted_at == None
    ).scalar()
    
    return {
        "total_files": total_stats.total_files or 0,
        "total_size_gb": (total_stats.total_size_mb or 0) / 1024,
        "by_type": {
            "images": {
                "count": image_stats.count or 0,
                "size_gb": (image_stats.size_mb or 0) / 1024
            },
            "videos": {
                "count": video_stats.count or 0,
                "size_gb": (video_stats.size_mb or 0) / 1024
            },
            "pdfs": {
                "count": pdf_stats.count or 0,
                "size_gb": (pdf_stats.size_mb or 0) / 1024
            }
        },
        "by_dealer": [
            {
                "dealer_id": d.dealer_id,
                "dealer_name": d.dealer_name or "Unknown",
                "file_count": d.file_count,
                "size_gb": (d.size_mb or 0) / 1024,
                "tier": d.tier or "free"
            }
            for d in dealer_storage
        ],
        "orphaned_files": orphaned_count or 0,
        "large_files": large_files_count or 0
    }


@router.get("/media")
def get_all_media(
    skip: int = 0,
    limit: int = 50,
    file_type: Optional[str] = None,
    owner_id: Optional[int] = None,  # ← Keep parameter name for API
    search: Optional[str] = None,
    sort: str = "date",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all media files with filtering."""
    from app.models.media import MediaFile
    
    query = db.query(MediaFile).join(
        User, MediaFile.user_id == User.id  # ✅ CHANGED: uploaded_by_user_id → user_id
    ).filter(
        MediaFile.deleted_at == None
    )
    
    if file_type and file_type != 'all':
        query = query.filter(MediaFile.file_type == file_type)
    
    if owner_id:
        query = query.filter(MediaFile.user_id == owner_id)  # ✅ CHANGED
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (MediaFile.filename.ilike(search_pattern)) |
            (User.company_name.ilike(search_pattern))
        )
    
    # Sorting
    if sort == "size":
        query = query.order_by(MediaFile.file_size_mb.desc())
    elif sort == "usage":
        query = query.order_by(MediaFile.usage_count.desc())
    else:  # date
        query = query.order_by(MediaFile.created_at.desc())
    
    total = query.count()
    media_files = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "media": [
            {
                "id": m.id,
                "filename": m.filename,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "file_type": m.file_type,
                "file_size_mb": round(m.file_size_mb, 2) if m.file_size_mb else 0,
                "owner_id": m.user_id,  # ✅ CHANGED: Keep key name for API compatibility
                "owner_name": f"{m.user.first_name} {m.user.last_name}" if m.user else "Unknown",  # ✅ CHANGED: owner → user
                "owner_company": m.user.company_name if m.user else "N/A",  # ✅ CHANGED: owner → user
                "owner_type": m.user.user_type if m.user else "unknown",  # ✅ CHANGED: owner → user
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "used_in_listings": m.usage_count or 0,
                "views": m.view_count or 0
            }
            for m in media_files
        ]
    }
    
    # Sorting
    if sort == "size":
        query = query.order_by(MediaFile.file_size_mb.desc())
    elif sort == "usage":
        query = query.order_by(MediaFile.usage_count.desc())
    else:  # date
        query = query.order_by(MediaFile.created_at.desc())
    
    total = query.count()
    media_files = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "media": [
            {
                "id": m.id,
                "filename": m.filename,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "file_type": m.file_type,
                "file_size_mb": round(m.file_size_mb, 2) if m.file_size_mb else 0,
                "owner_id": m.user_id,
                "owner_name": f"{m.owner.first_name} {m.owner.last_name}" if m.owner else "Unknown",
                "owner_company": m.owner.company_name if m.owner else "N/A",
                "owner_type": m.owner.user_type if m.owner else "unknown",
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "used_in_listings": m.usage_count or 0,
                "views": m.view_count or 0
            }
            for m in media_files
        ]
    }


@router.delete("/media/bulk-delete")
def bulk_delete_media(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete multiple media files."""
    from app.models.media import MediaFile
    
    media_ids = data.get("media_ids", [])
    if not media_ids:
        raise ValidationException("No media IDs provided")
    
    # Soft delete
    deleted = db.query(MediaFile).filter(
        MediaFile.id.in_(media_ids)
    ).update(
        {"deleted_at": datetime.utcnow()},
        synchronize_session=False
    )
    db.commit()
    
    return {"success": True, "deleted": deleted}


@router.delete("/media/cleanup-orphaned")
def cleanup_orphaned_media(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete all orphaned media files."""
    from app.models.media import MediaFile, ListingMediaAttachment
    
    # Find orphaned media (not attached to any listing)
    orphaned_query = db.query(MediaFile).outerjoin(
        ListingMediaAttachment,
        MediaFile.id == ListingMediaAttachment.media_id
    ).filter(
        ListingMediaAttachment.id == None,
        MediaFile.deleted_at == None
    )
    
    count = orphaned_query.count()
    
    # Soft delete them
    orphaned_query.update(
        {"deleted_at": datetime.utcnow()},
        synchronize_session=False
    )
    db.commit()
    
    return {"success": True, "count": count}
    
    # ============= MEDIA MANAGEMENT (ADMIN) =============

@router.get("/media/stats")
def get_all_media_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get platform-wide media statistics"""
    from app.models.media import MediaFile
    
    # Total stats
    total_stats = db.query(
        func.count(MediaFile.id).label('total_files'),
        func.sum(MediaFile.file_size_mb).label('total_size_mb')
    ).filter(MediaFile.deleted_at == None).first()
    
    # By type
    type_stats = {}
    for file_type in ['image', 'video', 'pdf']:
        stats = db.query(
            func.count(MediaFile.id).label('count'),
            func.sum(MediaFile.file_size_mb).label('size_mb')
        ).filter(
            MediaFile.file_type == file_type,
            MediaFile.deleted_at == None
        ).first()
        
        type_stats[f"{file_type}s"] = {
            "count": stats.count or 0,
            "size_gb": (stats.size_mb or 0) / 1024
        }
    
    # By dealer
    dealer_stats = db.query(
        User.id.label('dealer_id'),
        User.company_name.label('dealer_name'),
        User.subscription_tier.label('tier'),
        func.count(MediaFile.id).label('file_count'),
        func.sum(MediaFile.file_size_mb).label('size_mb')
    ).join(MediaFile, MediaFile.user_id == User.id).filter(
        User.user_type == 'dealer',
        MediaFile.deleted_at == None
    ).group_by(User.id).order_by(func.sum(MediaFile.file_size_mb).desc()).limit(20).all()
    
    # Orphaned files
    orphaned = db.query(func.count(MediaFile.id)).filter(
        MediaFile.listing_id == None,
        MediaFile.blog_post_id == None,
        MediaFile.deleted_at == None
    ).scalar()
    
    # Large files
    large_files = db.query(func.count(MediaFile.id)).filter(
        MediaFile.file_size_mb > 10,
        MediaFile.deleted_at == None
    ).scalar()
    
    return {
        "total_files": total_stats.total_files or 0,
        "total_size_gb": (total_stats.total_size_mb or 0) / 1024,
        "by_type": type_stats,
        "by_dealer": [
            {
                "dealer_id": d.dealer_id,
                "dealer_name": d.dealer_name or "Unknown",
                "file_count": d.file_count,
                "size_gb": (d.size_mb or 0) / 1024,
                "tier": d.tier or "free"
            }
            for d in dealer_stats
        ],
        "orphaned_files": orphaned or 0,
        "large_files": large_files or 0
    }


@router.get("/media")  # This appears twice - fix both!
def get_all_media(
    skip: int = 0,
    limit: int = 50,
    file_type: Optional[str] = None,
    owner_id: Optional[int] = None,
    search: Optional[str] = None,
    sort: str = "date",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all media files (admin only)"""
    from app.models.media import MediaFile
    
    query = db.query(MediaFile).join(User, MediaFile.user_id == User.id).filter(  # ✅ CHANGED
        MediaFile.deleted_at == None
    )
    
    if file_type and file_type != 'all':
        query = query.filter(MediaFile.file_type == file_type)
    
    if owner_id:
        query = query.filter(MediaFile.user_id == owner_id)  # ✅ CHANGED
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (MediaFile.filename.ilike(search_pattern)) |
            (User.company_name.ilike(search_pattern))
        )
    
    # Sorting
    if sort == "size":
        query = query.order_by(MediaFile.file_size_mb.desc())
    elif sort == "usage":
        query = query.order_by(MediaFile.listing_id.desc().nullslast())
    else:
        query = query.order_by(MediaFile.created_at.desc())
    
    total = query.count()
    media_files = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "media": [
            {
                "id": m.id,
                "filename": m.filename,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "file_type": m.file_type,
                "file_size_mb": round(m.file_size_mb, 2) if m.file_size_mb else 0,
                "owner_id": m.user_id,  # ✅ Keep API key name
                "owner_name": f"{m.user.first_name} {m.user.last_name}" if m.user else "Unknown",  # ✅ CHANGED
                "owner_company": m.user.company_name if m.user else "N/A",  # ✅ CHANGED
                "owner_type": m.user.user_type if m.user else "unknown",  # ✅ CHANGED
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "used_in_listings": 1 if m.listing_id else 0,
                "views": m.views or 0
            }
            for m in media_files
        ]
    }


# ============= SALES REPS MANAGEMENT =============

@router.get("/sales-reps")
def get_all_sales_reps(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all sales reps with their assigned dealers and revenue."""
    sales_reps = db.query(User).filter(
        User.user_type == "salesman"
    ).all()
    
    tier_prices = {
        "free": 0.0,
        "trial": 0.0,
        "basic": 29.0,
        "plus": 59.0,
        "premium": 99.0,
        "pro": 99.0,
        "private_basic": 9.0,
        "private_plus": 19.0,
        "private_pro": 39.0,
    }
    
    result = []
    for rep in sales_reps:
        affiliate_account = _ensure_sales_rep_affiliate_account(rep, db, current_user.id)

        # Get assigned dealers
        assigned_dealers = db.query(User).filter(
            User.assigned_sales_rep_id == rep.id
        ).all()

        referral_signups = db.query(ReferralSignup).filter(
            ReferralSignup.sales_rep_id == rep.id
        ).all()

        referral_dealer_ids = {r.dealer_user_id for r in referral_signups}
        referred_dealers = []
        if referral_dealer_ids:
            referred_dealers = db.query(User).filter(User.id.in_(list(referral_dealer_ids))).all()

        dealers_by_id = {d.id: d for d in assigned_dealers}
        for dealer in referred_dealers:
            dealers_by_id[dealer.id] = dealer

        all_dealers = list(dealers_by_id.values())
        
        assigned_count = len(all_dealers)
        
        # Calculate revenue from active dealers (prefer tracked effective price)
        referral_map = {r.dealer_user_id: r for r in referral_signups}
        active_dealers = [d for d in all_dealers if d.active]
        total_revenue = 0.0
        monthly_commission = 0.0
        for dealer in active_dealers:
            signup = referral_map.get(dealer.id)
            effective_price = float(signup.effective_monthly_price) if signup and signup.effective_monthly_price is not None else float(tier_prices.get(dealer.subscription_tier, 0.0))
            commission_rate = float(signup.commission_rate) if signup and signup.commission_rate is not None else float(rep.commission_rate or affiliate_account.commission_rate or 10.0)
            total_revenue += effective_price
            monthly_commission += effective_price * (commission_rate / 100.0)
        
        commission_rate = float(rep.commission_rate or affiliate_account.commission_rate or 10.0)
        
        result.append({
            "id": rep.id,
            "name": f"{rep.first_name} {rep.last_name}",  # Changed from separate fields
            "email": rep.email,
            "dealer_count": assigned_count,
            "active_dealers": len(active_dealers),
            "total_revenue": total_revenue,
            "monthly_commission": monthly_commission,
            "commission_rate": float(commission_rate),
            "referral_code": affiliate_account.code,
            "referral_link": f"/register?user_type=dealer&ref={affiliate_account.code}",
            "referred_signups": len(referral_signups),
        })
    
    return result


@router.post("/sales-reps")
def create_sales_rep(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new sales rep."""
    from app.security.auth import get_password_hash
    
    required = ["email", "password", "first_name", "last_name"]
    for field in required:
        if field not in data:
            raise ValidationException(f"Missing required field: {field}")
    
    # Check if email exists
    existing = db.query(User).filter(User.email == data["email"]).first()
    if existing:
        raise ValidationException("Email already registered")
    
    sales_rep = User(
        email=data["email"],
        password_hash=get_password_hash(data["password"]),
        first_name=data["first_name"],
        last_name=data["last_name"],
        phone=data.get("phone"),
        user_type="salesman",
        commission_rate=float(data.get("commission_rate", 10.0)),
        active=True
    )
    
    db.add(sales_rep)
    db.commit()
    db.refresh(sales_rep)

    affiliate_account = _ensure_sales_rep_affiliate_account(sales_rep, db, current_user.id)
    
    return {
        "success": True,
        "sales_rep_id": sales_rep.id,
        "email": sales_rep.email,
        "referral_code": affiliate_account.code,
        "referral_link": f"/register?user_type=dealer&ref={affiliate_account.code}",
    }


@router.post("/assign-sales-rep")
def assign_sales_rep(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    dealer_id = data.get("dealer_id")
    sales_rep_id = data.get("sales_rep_id")

    if not dealer_id or not sales_rep_id:
        raise ValidationException("dealer_id and sales_rep_id are required")

    dealer = db.query(User).filter(
        User.id == dealer_id,
        User.user_type == "dealer"
    ).first()
    if not dealer:
        raise ResourceNotFoundException("Dealer", dealer_id)

    sales_rep = db.query(User).filter(
        User.id == sales_rep_id,
        User.user_type == "salesman"
    ).first()
    if not sales_rep:
        raise ResourceNotFoundException("Sales rep", sales_rep_id)

    dealer.assigned_sales_rep_id = sales_rep.id
    db.commit()

    return {
        "success": True,
        "dealer_id": dealer.id,
        "sales_rep_id": sales_rep.id,
    }


@router.get("/affiliates")
def get_affiliates(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    accounts = db.query(AffiliateAccount).order_by(AffiliateAccount.created_at.desc()).all()
    return [
        {
            "id": account.id,
            "name": account.name,
            "email": account.email,
            "code": account.code,
            "account_type": account.account_type,
            "user_id": account.user_id,
            "commission_rate": float(account.commission_rate or 10.0),
            "active": bool(account.active),
            "created_at": account.created_at.isoformat() if account.created_at else None,
            "referral_link": f"/register?user_type=dealer&ref={account.code}",
        }
        for account in accounts
    ]


@router.post("/affiliates")
def create_affiliate(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    name = (data.get("name") or "").strip()
    if not name:
        raise ValidationException("Affiliate name is required")

    requested_code = (data.get("code") or "").strip().upper()
    code = requested_code or _generate_ref_code()
    while db.query(AffiliateAccount).filter(AffiliateAccount.code == code).first():
        code = _generate_ref_code()

    account = AffiliateAccount(
        name=name,
        email=data.get("email"),
        code=code,
        account_type=data.get("account_type", "affiliate"),
        commission_rate=float(data.get("commission_rate", 10.0)),
        active=bool(data.get("active", True)),
        created_by=current_user.id,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    return {
        "id": account.id,
        "code": account.code,
        "referral_link": f"/register?user_type=dealer&ref={account.code}",
        "message": "Affiliate account created",
    }


@router.put("/affiliates/{affiliate_id}")
def update_affiliate(
    affiliate_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    account = db.query(AffiliateAccount).filter(AffiliateAccount.id == affiliate_id).first()
    if not account:
        raise ResourceNotFoundException("Affiliate account", affiliate_id)

    if "name" in data:
        account.name = data["name"]
    if "email" in data:
        account.email = data["email"]
    if "commission_rate" in data:
        account.commission_rate = float(data["commission_rate"])
    if "active" in data:
        account.active = bool(data["active"])

    db.commit()
    db.refresh(account)

    return {
        "success": True,
        "id": account.id,
        "code": account.code,
        "referral_link": f"/register?user_type=dealer&ref={account.code}",
    }


@router.get("/deal-performance")
def get_deal_performance(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    deals = db.query(PartnerDeal).order_by(PartnerDeal.created_at.desc()).all()

    referrals = db.query(ReferralSignup).all()
    referrals_by_deal = {}
    for referral in referrals:
        if referral.deal_id is None:
            continue
        referrals_by_deal.setdefault(referral.deal_id, []).append(referral)

    rep_summary = {}
    affiliate_summary = {}
    deal_rows = []

    for deal in deals:
        linked_referrals = referrals_by_deal.get(deal.id, [])
        signup_count = len(linked_referrals)

        dealer_ids = [r.dealer_user_id for r in linked_referrals]
        dealers = []
        if dealer_ids:
            dealers = db.query(User).filter(User.id.in_(dealer_ids)).all()
        dealer_map = {dealer.id: dealer for dealer in dealers}

        active_paid_count = 0
        monthly_revenue = 0.0
        monthly_commission = 0.0

        for referral in linked_referrals:
            dealer = dealer_map.get(referral.dealer_user_id)
            if not dealer or not dealer.active:
                continue

            effective_price = float(referral.effective_monthly_price or 0.0)
            commission_rate = float(referral.commission_rate or 10.0)

            # Treat non-trial/non-free dealers with positive effective price as paid.
            if effective_price > 0 and dealer.subscription_tier not in ["free", "trial"]:
                active_paid_count += 1

            monthly_revenue += effective_price
            monthly_commission += effective_price * (commission_rate / 100.0)

            if referral.sales_rep_id:
                rep_row = rep_summary.setdefault(referral.sales_rep_id, {
                    "sales_rep_id": referral.sales_rep_id,
                    "sales_rep_name": None,
                    "signup_count": 0,
                    "active_paid_accounts": 0,
                    "monthly_revenue": 0.0,
                    "monthly_commission": 0.0,
                })
                rep_row["signup_count"] += 1
                if effective_price > 0 and dealer.subscription_tier not in ["free", "trial"]:
                    rep_row["active_paid_accounts"] += 1
                rep_row["monthly_revenue"] += effective_price
                rep_row["monthly_commission"] += effective_price * (commission_rate / 100.0)

            if referral.affiliate_account_id:
                affiliate_row = affiliate_summary.setdefault(referral.affiliate_account_id, {
                    "affiliate_account_id": referral.affiliate_account_id,
                    "affiliate_name": None,
                    "code": None,
                    "signup_count": 0,
                    "active_paid_accounts": 0,
                    "monthly_revenue": 0.0,
                    "monthly_commission": 0.0,
                })
                affiliate_row["signup_count"] += 1
                if effective_price > 0 and dealer.subscription_tier not in ["free", "trial"]:
                    affiliate_row["active_paid_accounts"] += 1
                affiliate_row["monthly_revenue"] += effective_price
                affiliate_row["monthly_commission"] += effective_price * (commission_rate / 100.0)

        owner_sales_rep_name = None
        if deal.owner_sales_rep_id:
            sales_rep = db.query(User).filter(User.id == deal.owner_sales_rep_id).first()
            if sales_rep:
                owner_sales_rep_name = f"{sales_rep.first_name or ''} {sales_rep.last_name or ''}".strip() or sales_rep.email

        affiliate_name = None
        affiliate_code = None
        if deal.affiliate_account_id:
            account = db.query(AffiliateAccount).filter(AffiliateAccount.id == deal.affiliate_account_id).first()
            if account:
                affiliate_name = account.name
                affiliate_code = account.code

        deal_rows.append({
            "deal_id": deal.id,
            "crm_sync_key": f"deal:{deal.id}",
            "name": deal.name,
            "code": deal.code,
            "target_email": deal.target_email,
            "owner_sales_rep_id": deal.owner_sales_rep_id,
            "owner_sales_rep_name": owner_sales_rep_name,
            "affiliate_account_id": deal.affiliate_account_id,
            "affiliate_name": affiliate_name,
            "affiliate_code": affiliate_code,
            "signup_count": signup_count,
            "active_paid_accounts": active_paid_count,
            "monthly_revenue": monthly_revenue,
            "monthly_commission": monthly_commission,
            "free_days": deal.free_days,
            "discount_type": deal.discount_type,
            "discount_value": deal.discount_value,
            "fixed_monthly_price": deal.fixed_monthly_price,
            "term_months": deal.term_months,
            "lifetime": bool(deal.lifetime),
            "active": bool(deal.active),
            "created_at": deal.created_at.isoformat() if deal.created_at else None,
        })

    # Resolve display names for summaries
    if rep_summary:
        rep_ids = list(rep_summary.keys())
        reps = db.query(User).filter(User.id.in_(rep_ids)).all()
        rep_map = {rep.id: rep for rep in reps}
        for rep_id, row in rep_summary.items():
            rep = rep_map.get(rep_id)
            if rep:
                row["sales_rep_name"] = f"{rep.first_name or ''} {rep.last_name or ''}".strip() or rep.email

    if affiliate_summary:
        affiliate_ids = list(affiliate_summary.keys())
        accounts = db.query(AffiliateAccount).filter(AffiliateAccount.id.in_(affiliate_ids)).all()
        account_map = {account.id: account for account in accounts}
        for account_id, row in affiliate_summary.items():
            account = account_map.get(account_id)
            if account:
                row["affiliate_name"] = account.name
                row["code"] = account.code

    return {
        "deals": deal_rows,
        "summary_by_sales_rep": list(rep_summary.values()),
        "summary_by_affiliate": list(affiliate_summary.values()),
        "generated_at": datetime.utcnow().isoformat(),
    }


# ============= SETTINGS MANAGEMENT =============

_DEFAULT_BROKER_TIERS = {
    "basic": {"name": "Basic", "price": 29, "listings": 25, "images_per_listing": 15, "videos_per_listing": 1, "features": ["25 active listings", "15 images per listing", "1 video per listing", "Enhanced search visibility", "Priority email support", "Analytics dashboard"], "trial_days": 14, "active": True},
    "plus":  {"name": "Plus",  "price": 59, "listings": 75, "images_per_listing": 30, "videos_per_listing": 3, "features": ["75 active listings", "30 images per listing", "3 videos per listing", "Priority search placement", "Featured broker badge", "Priority support", "Advanced analytics"], "trial_days": 14, "active": True},
    "pro":   {"name": "Pro",   "price": 99, "listings": 999999, "images_per_listing": 50, "videos_per_listing": 5, "features": ["Unlimited listings", "50 images per listing", "5 videos per listing", "Top search placement", "Featured broker badge", "Dedicated account manager", "Advanced analytics", "AI scraper tools"], "trial_days": 30, "active": True},
    "ultimate": {"name": "Ultimate", "price": 0, "listings": 999999, "images_per_listing": 999999, "videos_per_listing": 999999, "features": ["Unlimited listings", "Unlimited images & video", "White-glove onboarding", "Dedicated account manager", "Custom API integrations", "Branded micro-site", "Premium search placement", "Co-brokering network access"], "trial_days": 0, "active": True, "is_custom_pricing": True},
}

_DEFAULT_PRIVATE_TIERS = {
    "private_basic": {"name": "Basic", "price": 9, "listings": 1, "images_per_listing": 20, "videos_per_listing": 1, "features": ["1 active listing", "20 photos per listing", "1 video per listing", "Standard search visibility", "Direct buyer messaging", "Email support"], "trial_days": 7, "active": True},
    "private_plus": {"name": "Plus", "price": 19, "listings": 3, "images_per_listing": 35, "videos_per_listing": 1, "features": ["3 active listings", "35 photos per listing", "1 video per listing", "Priority search placement", "Direct buyer messaging", "Listing analytics", "Email support"], "trial_days": 7, "active": True},
    "private_pro": {"name": "Pro", "price": 39, "listings": 10, "images_per_listing": 50, "videos_per_listing": 3, "features": ["10 active listings", "50 photos per listing", "3 videos per listing", "Top search placement", "Featured badge", "Priority support", "Social media promotion"], "trial_days": 14, "active": True},
}


def _get_or_create_settings(db: Session) -> SiteSettings:
    settings = db.query(SiteSettings).first()
    if not settings:
        settings = SiteSettings(subscription_config={})
        db.add(settings)
        db.commit()
    return settings

@router.get("/settings")
def get_settings(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get platform settings."""
    # For now, return default settings
    # You can create a Settings model later if needed
    return {
        "site_name": "YachtVersal",
        "support_email": "support@yachtversal.com",
        "featured_listing_enabled": True,
        "require_approval": False,
        "max_images_per_listing": 20,
        "default_currency": "USD",
        "allowed_currencies": ["USD", "EUR", "GBP", "CAD", "AUD"],
        "maintenance_mode": False
    }


@router.put("/settings")
def update_settings(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update platform settings."""
    # Store settings in database or config file
    # For now, just return success
    return {"success": True, "message": "Settings updated"}


@router.get("/subscription-config")
def get_subscription_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get broker subscription tier configuration."""
    settings = _get_or_create_settings(db)
    config = settings.subscription_config or {}
    tiers = config.get("broker_tiers", _DEFAULT_BROKER_TIERS)
    return {"tiers": tiers}


@router.put("/subscription-config")
def update_subscription_config(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update broker subscription configuration."""
    settings = _get_or_create_settings(db)
    config = dict(settings.subscription_config or {})
    config["broker_tiers"] = data.get("tiers", data)
    settings.subscription_config = config
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(settings, "subscription_config")
    db.commit()
    return {"success": True, "message": "Broker subscription config updated"}


@router.get("/subscription-config/private")
def get_private_subscription_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get private seller subscription tier configuration."""
    settings = _get_or_create_settings(db)
    config = settings.subscription_config or {}
    tiers = config.get("private_tiers", _DEFAULT_PRIVATE_TIERS)
    return {"tiers": tiers}


@router.put("/subscription-config/private")
def update_private_subscription_config(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update private seller subscription configuration."""
    settings = _get_or_create_settings(db)
    config = dict(settings.subscription_config or {})
    config["private_tiers"] = data.get("tiers", data)
    settings.subscription_config = config
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(settings, "subscription_config")
    db.commit()
    return {"success": True, "message": "Private subscription config updated"}


# ============= DASHBOARD STATS =============

@router.get("/stats")
def get_admin_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get admin dashboard statistics."""
    
    # User stats
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.active == True).count()
    total_dealers = db.query(User).filter(User.user_type == "dealer").count()
    active_dealers = db.query(User).filter(
        User.user_type == "dealer",
        User.active == True
    ).count()
    
    # Listing stats
    total_listings = db.query(Listing).count()
    active_listings = db.query(Listing).filter(Listing.status == "active").count()
    pending_listings = db.query(Listing).filter(Listing.status == "pending").count()
    
    # Revenue calculation (simple)
    tier_prices = {"free": 0, "basic": 29, "premium": 99, "trial": 0}
    monthly_revenue = sum(
        tier_prices.get(u.subscription_tier, 0)
        for u in db.query(User).filter(User.active == True).all()
    )
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "dealers": total_dealers,
            "active_dealers": active_dealers
        },
        "listings": {
            "total": total_listings,
            "active": active_listings,
            "pending": pending_listings
        },
        "revenue": {
            "monthly": monthly_revenue,
            "annual": monthly_revenue * 12
        }
    }


# ============= SYSTEM / DIAGNOSTICS =============

_app_start_time = time.time()


@router.get("/logs")
def get_logs(
    level: str = Query(default="ALL", description="Filter by level: ALL DEBUG INFO WARNING ERROR CRITICAL"),
    search: str = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    current_user: User = Depends(require_admin),
):
    """Return recent in-memory log records."""
    records = memory_log_handler.get_records(level=level, search=search, limit=limit)
    return {
        "count": len(records),
        "total_in_buffer": memory_log_handler.entry_count,
        "records": records,
    }


@router.post("/logs/clear")
def clear_logs(current_user: User = Depends(require_admin)):
    """Clear the in-memory log buffer."""
    before = memory_log_handler.entry_count
    memory_log_handler.clear()
    return {"cleared": before, "message": "Log buffer cleared"}


@router.post("/logs/test")
def test_logging(current_user: User = Depends(require_admin)):
    """Write one test entry at every log level — useful to verify logging is wired up."""
    logger = logging.getLogger("yachtversal")
    logger.debug("[ADMIN TEST] Debug-level test entry")
    logger.info("[ADMIN TEST] Info-level test entry")
    logger.warning("[ADMIN TEST] Warning-level test entry")
    logger.error("[ADMIN TEST] Error-level test entry")
    return {"message": "Test log entries written at DEBUG / INFO / WARNING / ERROR"}


@router.get("/system/health")
def system_health(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Run a suite of health checks and return status for each subsystem."""
    results = {}

    # Database connectivity
    try:
        db.execute(text("SELECT 1"))
        results["database"] = {"status": "ok", "message": "Connection successful"}
    except Exception as exc:
        results["database"] = {"status": "error", "message": str(exc)}

    # Database table row counts
    try:
        table_counts = {
            "users": db.query(User).count(),
            "listings": db.query(Listing).count(),
            "media_files": db.query(MediaFile).count(),
        }
        results["table_counts"] = {"status": "ok", "counts": table_counts}
    except Exception as exc:
        results["table_counts"] = {"status": "error", "message": str(exc)}

    # Storage health (re-uses existing helper)
    try:
        storage = get_storage_health()
        results["storage"] = storage
    except Exception as exc:
        results["storage"] = {"status": "error", "message": str(exc)}

    # Environment variable presence check
    env_vars = [
        "DATABASE_URL",
        "SECRET_KEY",
        "SENDGRID_API_KEY",
        "ANTHROPIC_API_KEY",
        "CLOUDFLARE_R2_BUCKET",
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_R2_ACCESS_KEY",
        "CLOUDFLARE_R2_SECRET_KEY",
        "FRONTEND_URL",
        "AUTO_CREATE_TABLES",
    ]
    env_status = {
        v: ("set" if os.environ.get(v) else "missing") for v in env_vars
    }
    results["env_vars"] = env_status

    # Scheduler — check if APScheduler is running
    try:
        from app.core.scheduler import scheduler as apscheduler
        results["scheduler"] = {
            "status": "ok" if apscheduler.running else "stopped",
            "jobs": len(apscheduler.get_jobs()),
        }
    except Exception as exc:
        results["scheduler"] = {"status": "error", "message": str(exc)}

    # Email service
    sendgrid_key = os.environ.get("SENDGRID_API_KEY", "")
    results["email"] = {
        "status": "ok" if sendgrid_key else "missing_key",
        "provider": "SendGrid",
    }

    results["generated_at"] = datetime.utcnow().isoformat()
    return results


@router.get("/system/info")
def system_info(current_user: User = Depends(require_admin)):
    """Return runtime environment information."""
    uptime_seconds = int(time.time() - _app_start_time)
    hours, remainder = divmod(uptime_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_str = f"{hours}h {minutes}m {seconds}s"

    log_file_info = {"path": "logs/yachtversal.log", "size_bytes": None, "exists": False}
    try:
        import pathlib
        lf = pathlib.Path("logs/yachtversal.log")
        if lf.exists():
            log_file_info["exists"] = True
            log_file_info["size_bytes"] = lf.stat().st_size
    except Exception:
        pass

    return {
        "python_version": sys.version,
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "uptime_seconds": uptime_seconds,
        "uptime_human": uptime_str,
        "log_buffer_entries": memory_log_handler.entry_count,
        "log_file": log_file_info,
        "pid": os.getpid(),
    }

# ============= ACCOUNT RECOVERY & SOFT DELETE =============

@router.get("/users/recovery/pending")
def get_deleted_users_pending_recovery(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Get all users pending recovery (soft-deleted within recovery period).
    """
    now = datetime.utcnow()
    
    # Find deleted users within recovery deadline
    deleted_users = db.query(User).filter(
        User.deleted_at.isnot(None),
        User.recovery_deadline > now  # Not yet expired
    ).order_by(User.deleted_at.desc()).all()
    
    result = []
    for user in deleted_users:
        days_remaining = (user.recovery_deadline - now).days
        
        # Get listing count
        listing_count = db.query(Listing).filter(Listing.user_id == user.id).count()
        
        result.append({
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "company_name": user.company_name,
            "user_type": user.user_type,
            "deleted_at": user.deleted_at.isoformat(),
            "recovery_deadline": user.recovery_deadline.isoformat(),
            "days_remaining": days_remaining,
            "listings": listing_count,
        })
    
    return {
        "total": len(result),
        "users": result
    }


@router.post("/users/{user_id}/recover")
def admin_recover_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint to restore a deleted user account.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    if not user.deleted_at:
        raise ValidationException("User account is not deleted")
    
    now = datetime.utcnow()
    if user.recovery_deadline and now > user.recovery_deadline:
        raise ValidationException("Recovery period has expired. This account cannot be restored.")
    
    # Restore the account
    user.deleted_at = None
    user.recovery_deadline = None
    db.commit()
    
    return {
        "success": True,
        "message": f"User {user.email} has been restored",
        "user_id": user.id,
        "email": user.email
    }


@router.post("/users/{user_id}/permanent-delete")
def admin_permanently_delete_user(
    user_id: int,
    data: dict = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint to permanently delete a user after recovery period expires.
    This will hard-delete the user and all associated data.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    if not user.deleted_at:
        raise ValidationException("User is not deleted")
    
    # Check if recovery period has expired
    now = datetime.utcnow()
    if user.recovery_deadline and now <= user.recovery_deadline:
        days_remaining = (user.recovery_deadline - now).days
        raise ValidationException(
            f"Cannot permanently delete: recovery period expires in {days_remaining} days. "
            "Pass force=true in request body to override."
        )
    
    # Optional force parameter for immediate deletion
    force = (data or {}).get("force", False) if data else False
    if not force and user.recovery_deadline and now <= user.recovery_deadline:
        raise ValidationException("Recovery period not expired. Pass force=true to override safety check.")
    
    # Delete all user data
    email = user.email
    
    # Delete listings
    db.query(Listing).filter(Listing.user_id == user_id).delete()
    
    # Delete user record
    db.delete(user)
    db.commit()
    
    return {
        "success": True,
        "message": f"User {email} permanently deleted with all associated data",
    }


@router.get("/users/{user_id}/deletion-status")
def get_user_deletion_status_admin(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint to check deletion status of any user.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)
    
    if not user.deleted_at:
        return {
            "user_id": user.id,
            "email": user.email,
            "status": "active",
            "message": "Account is active"
        }
    
    now = datetime.utcnow()
    is_expired = user.recovery_deadline and now > user.recovery_deadline
    days_remaining = (user.recovery_deadline - now).days if user.recovery_deadline and not is_expired else 0
    
    return {
        "user_id": user.id,
        "email": user.email,
        "status": "deleted_expired" if is_expired else "deleted_recoverable",
        "deleted_at": user.deleted_at.isoformat(),
        "recovery_deadline": user.recovery_deadline.isoformat() if user.recovery_deadline else None,
        "days_remaining": max(days_remaining, 0),
        "can_restore": not is_expired,
        "can_permanently_delete": is_expired
    }


# ============= DEMO ACCOUNTS FOR SALES TEAM =============

@router.post("/demo-account/create")
def create_demo_account(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new demo dealer account for a sales rep.
    Automatically populates with sample listings.
    """
    sales_rep_id = data.get("sales_rep_id")
    if not sales_rep_id:
        raise ValidationException("sales_rep_id is required")
    
    # Verify sales rep exists
    sales_rep = db.query(User).filter(
        User.id == sales_rep_id,
        User.user_type == "salesman"
    ).first()
    
    if not sales_rep:
        raise ResourceNotFoundException("Sales rep", sales_rep_id)
    
    # Check if this sales rep already has a demo account
    existing_demo = db.query(User).filter(
        User.demo_owner_sales_rep_id == sales_rep_id,
        User.deleted_at.is_(None)
    ).first()
    
    if existing_demo:
        raise ValidationException(f"Sales rep already has a demo account (ID: {existing_demo.id})")
    
    # Create demo dealer account
    demo_email = f"demo-{sales_rep.id}-{secrets.token_hex(4)}@yachtversal.demo"
    demo_password = secrets.token_urlsafe(16)
    demo_password_hash = get_password_hash(demo_password)
    
    demo_dealer = User(
        email=demo_email,
        password_hash=demo_password_hash,
        first_name=f"Demo - {sales_rep.first_name or 'Sales Rep'}",
        last_name=sales_rep.last_name or f"{sales_rep_id}",
        phone=sales_rep.phone,
        company_name=f"[DEMO] {sales_rep.first_name or 'Sales Rep'}'s Demo",
        user_type="dealer",
        subscription_tier="demo",  # Special demo tier
        verified=True,
        active=True,
        is_demo=True,
        demo_owner_sales_rep_id=sales_rep_id,
    )
    
    db.add(demo_dealer)
    db.commit()
    db.refresh(demo_dealer)
    
    # Create demo dealer profile
    from app.utils.slug import create_slug
    dealer_profile = DealerProfile(
        user_id=demo_dealer.id,
        slug=create_slug(f"demo-{demo_dealer.id}"),
        description="This is a demo dealer account showcasing YachtVersal features.",
        website="https://yachtversal.com",
    )
    db.add(dealer_profile)
    db.commit()
    
    # Populate with sample listings
    sample_listings = get_demo_listing_data()
    for i, listing_data in enumerate(sample_listings):
        listing = Listing(
            user_id=demo_dealer.id,
            created_by_user_id=demo_dealer.id,
            title=listing_data["title"],
            description=listing_data["description"],
            make_model=listing_data["make_model"],
            year=listing_data["year"],
            length_feet=listing_data["length_feet"],
            beam_feet=listing_data["beam_feet"],
            draft_feet=listing_data["draft_feet"],
            price=listing_data["price"],
            price_currency=listing_data["price_currency"],
            condition=listing_data["condition"],
            location=listing_data["location"],
            boat_type=listing_data["boat_type"],
            fuel_type=listing_data["fuel_type"],
            num_cabins=listing_data["num_cabins"],
            num_heads=listing_data["num_heads"],
            water_capacity_gallons=listing_data["water_capacity_gallons"],
            fuel_capacity_gallons=listing_data["fuel_capacity_gallons"],
            features=listing_data["features"],
            status="active",
            views=0,
            inquiries=0,
        )
        db.add(listing)
    
    db.commit()
    
    return {
        "success": True,
        "demo_account": {
            "id": demo_dealer.id,
            "email": demo_email,
            "password": demo_password,
            "first_name": demo_dealer.first_name,
            "last_name": demo_dealer.last_name,
            "company_name": demo_dealer.company_name,
            "is_demo": True,
        },
        "sales_rep_id": sales_rep_id,
        "listings_created": len(sample_listings),
        "message": f"Demo account created with {len(sample_listings)} sample listings. Share the email and password with the sales rep.",
        "note": "This is a test account. The password is provided above — save it securely."
    }


@router.get("/demo-account/{sales_rep_id}")
def get_demo_account_for_sales_rep(
    sales_rep_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get the demo account associated with a sales rep."""
    demo_account = db.query(User).filter(
        User.demo_owner_sales_rep_id == sales_rep_id,
        User.deleted_at.is_(None),
        User.is_demo == True
    ).first()
    
    if not demo_account:
        raise ResourceNotFoundException("Demo account", f"for sales rep {sales_rep_id}")
    
    # Get listings
    listings = db.query(Listing).filter(Listing.user_id == demo_account.id).count()
    
    # Get inquiries
    from app.models.misc import Message
    inquiries = db.query(func.count(Message.id)).filter(
        Message.recipient_id == demo_account.id,
        Message.message_type == "inquiry"
    ).scalar() or 0
    
    return {
        "id": demo_account.id,
        "email": demo_account.email,
        "is_demo": True,
        "company_name": demo_account.company_name,
        "listings": listings,
        "inquiries": inquiries,
        "sales_rep_id": sales_rep_id,
    }


@router.post("/demo-account/{demo_account_id}/reset")
def reset_demo_account(
    demo_account_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reset a demo account to pristine state.
    - Clear all messages/inquiries
    - Reset listing view/inquiry counts
    - Restore sample listings
    """
    demo_account = db.query(User).filter(
        User.id == demo_account_id,
        User.is_demo == True
    ).first()
    
    if not demo_account:
        raise ResourceNotFoundException("Demo account", demo_account_id)
    
    # Clear messages and inquiries
    from app.models.misc import Message
    db.query(Message).filter(Message.recipient_id == demo_account_id).delete()
    
    # Reset listing stats
    db.query(Listing).filter(Listing.user_id == demo_account_id).update({
        "views": 0,
        "inquiries": 0,
    })
    
    # Delete existing listings to clean slate
    db.query(Listing).filter(Listing.user_id == demo_account_id).delete()
    
    # Re-populate with fresh sample listings
    sample_listings = get_demo_listing_data()
    for listing_data in sample_listings:
        listing = Listing(
            user_id=demo_account_id,
            created_by_user_id=demo_account_id,
            title=listing_data["title"],
            description=listing_data["description"],
            make_model=listing_data["make_model"],
            year=listing_data["year"],
            length_feet=listing_data["length_feet"],
            beam_feet=listing_data["beam_feet"],
            draft_feet=listing_data["draft_feet"],
            price=listing_data["price"],
            price_currency=listing_data["price_currency"],
            condition=listing_data["condition"],
            location=listing_data["location"],
            boat_type=listing_data["boat_type"],
            fuel_type=listing_data["fuel_type"],
            num_cabins=listing_data["num_cabins"],
            num_heads=listing_data["num_heads"],
            water_capacity_gallons=listing_data["water_capacity_gallons"],
            fuel_capacity_gallons=listing_data["fuel_capacity_gallons"],
            features=listing_data["features"],
            status="active",
            views=0,
            inquiries=0,
        )
        db.add(listing)
    
    db.commit()
    
    return {
        "success": True,
        "demo_account_id": demo_account_id,
        "email": demo_account.email,
        "listings_restored": len(sample_listings),
        "message": "Demo account reset to pristine state"
    }


@router.delete("/demo-account/{demo_account_id}")
def delete_demo_account(
    demo_account_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Permanently delete a demo account and all its data."""
    demo_account = db.query(User).filter(
        User.id == demo_account_id,
        User.is_demo == True
    ).first()
    
    if not demo_account:
        raise ResourceNotFoundException("Demo account", demo_account_id)
    
    # Delete all listings
    db.query(Listing).filter(Listing.user_id == demo_account_id).delete()
    
    # Delete the demo account
    db.delete(demo_account)
    db.commit()
    
    return {
        "success": True,
        "message": "Demo account permanently deleted"
    }


@router.get("/demo-accounts")
def list_all_demo_accounts(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all demo accounts."""
    demo_accounts = db.query(User).filter(
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).all()
    
    result = []
    for demo in demo_accounts:
        listings_count = db.query(Listing).filter(Listing.user_id == demo.id).count()
        
        sales_rep = db.query(User).filter(User.id == demo.demo_owner_sales_rep_id).first() if demo.demo_owner_sales_rep_id else None
        
        result.append({
            "id": demo.id,
            "email": demo.email,
            "company_name": demo.company_name,
            "sales_rep_id": demo.demo_owner_sales_rep_id,
            "sales_rep_name": f"{sales_rep.first_name} {sales_rep.last_name}".strip() if sales_rep else "Unknown",
            "listings": listings_count,
            "created_at": demo.created_at.isoformat() if demo.created_at else None,
        })
    
    return {
        "total": len(result),
        "demo_accounts": result
    }

# ============= DOCUMENTATION MANAGEMENT =============

@router.post("/docs/init-defaults")
def initialize_default_docs(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Initialize default documentation (demo guide, sales guide).
    Safe to call multiple times - will skip existing docs.
    """
    from app.services.default_documentation import DEFAULT_DOCS
    
    created = []
    skipped = []
    
    for doc_data in DEFAULT_DOCS:
        existing = db.query(Documentation).filter(
            Documentation.slug == doc_data["slug"]
        ).first()
        
        if existing:
            skipped.append(doc_data["slug"])
            continue
        
        doc = Documentation(
            slug=doc_data["slug"],
            title=doc_data["title"],
            description=doc_data["description"],
            category=doc_data["category"],
            audience=doc_data["audience"],
            order=doc_data["order"],
            content=doc_data["content"],
            published=True,
            updated_by_user_id=current_user.id,
        )
        db.add(doc)
        created.append(doc_data["slug"])
    
    db.commit()
    
    return {
        "success": True,
        "created": created,
        "skipped": skipped,
        "message": f"Initialized {len(created)} default documentation(s)"
    }


@router.post("/docs")
def create_documentation(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new documentation page."""
    slug = (data.get("slug") or "").strip().lower().replace(" ", "-")
    if not slug:
        raise ValidationException("slug is required")
    
    # Check for duplicate slug
    existing = db.query(Documentation).filter(Documentation.slug == slug).first()
    if existing:
        raise ValidationException("Documentation with this slug already exists")
    
    doc = Documentation(
        slug=slug,
        title=data.get("title", "Untitled").strip(),
        description=data.get("description", "").strip(),
        category=data.get("category", "general"),
        audience=data.get("audience", "all"),
        order=int(data.get("order", 0)),
        content=data.get("content", ""),
        published=bool(data.get("published", True)),
        updated_by_user_id=current_user.id,
    )
    
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    return {
        "success": True,
        "id": doc.id,
        "slug": doc.slug,
        "title": doc.title,
        "message": "Documentation created"
    }


@router.get("/docs")
def list_documentation(
    category: Optional[str] = None,
    audience: Optional[str] = None,
    published_only: bool = True,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all documentation pages (admin view)."""
    query = db.query(Documentation)
    
    if published_only:
        query = query.filter(Documentation.published == True)
    
    if category:
        query = query.filter(Documentation.category == category)
    
    if audience:
        query = query.filter(Documentation.audience == audience)
    
    docs = query.order_by(Documentation.category, Documentation.order).all()
    
    return {
        "total": len(docs),
        "docs": [
            {
                "id": doc.id,
                "slug": doc.slug,
                "title": doc.title,
                "description": doc.description,
                "category": doc.category,
                "audience": doc.audience,
                "order": doc.order,
                "published": doc.published,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            }
            for doc in docs
        ]
    }


@router.get("/docs/{slug}")
def get_documentation_admin(
    slug: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get a specific documentation page (admin view with full content)."""
    doc = db.query(Documentation).filter(Documentation.slug == slug).first()
    
    if not doc:
        raise ResourceNotFoundException("Documentation", slug)
    
    return {
        "id": doc.id,
        "slug": doc.slug,
        "title": doc.title,
        "description": doc.description,
        "category": doc.category,
        "audience": doc.audience,
        "order": doc.order,
        "content": doc.content,
        "published": doc.published,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        "updated_by_user_id": doc.updated_by_user_id,
    }


@router.put("/docs/{slug}")
def update_documentation(
    slug: str,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update a documentation page."""
    doc = db.query(Documentation).filter(Documentation.slug == slug).first()
    
    if not doc:
        raise ResourceNotFoundException("Documentation", slug)
    
    # Update fields
    if "title" in data:
        doc.title = data["title"].strip()
    if "description" in data:
        doc.description = data["description"].strip()
    if "content" in data:
        doc.content = data["content"]
    if "category" in data:
        doc.category = data["category"]
    if "audience" in data:
        doc.audience = data["audience"]
    if "order" in data:
        doc.order = int(data["order"])
    if "published" in data:
        doc.published = bool(data["published"])
    
    doc.updated_by_user_id = current_user.id
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    
    return {
        "success": True,
        "slug": doc.slug,
        "title": doc.title,
        "message": "Documentation updated"
    }


@router.delete("/docs/{slug}")
def delete_documentation(
    slug: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a documentation page."""
    doc = db.query(Documentation).filter(Documentation.slug == slug).first()
    
    if not doc:
        raise ResourceNotFoundException("Documentation", slug)
    
    db.delete(doc)
    db.commit()
    
    return {
        "success": True,
        "message": "Documentation deleted"
    }


# ============= Demo Account Management =============

@router.post("/demo-account/create")
def create_demo_account(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a demo account for a sales rep.
    - Auto-populate with 8 sample yacht listings
    - Generate unique credentials
    """
    sales_rep_id = data.get("sales_rep_id")
    if not sales_rep_id:
        raise ValidationException("sales_rep_id is required")
    
    # Verify sales rep exists
    sales_rep = db.query(User).filter(
        User.id == sales_rep_id,
        User.user_type == "salesman",
        User.deleted_at.is_(None)
    ).first()
    
    if not sales_rep:
        raise ResourceNotFoundException("Sales representative", sales_rep_id)
    
    # Check if demo already exists
    existing_demo = db.query(User).filter(
        User.demo_owner_sales_rep_id == sales_rep_id,
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).first()
    
    if existing_demo:
        raise ValidationException(f"Sales rep {sales_rep_id} already has a demo account")
    
    # Generate credentials
    demo_email = f"demo-{sales_rep_id}-{secrets.token_hex(4)}@yachtversal.demo"
    temp_password = secrets.token_urlsafe(16)
    hashed_password = get_password_hash(temp_password)
    
    # Create demo user account
    demo_user = User(
        email=demo_email,
        password_hash=hashed_password,
        first_name="Demo",
        last_name=f"- {sales_rep.first_name or 'Sales Rep'}",
        user_type="dealer",
        company_name=f"[DEMO] {sales_rep.first_name or 'Demo'}'s Demo Dealership",
        subscription_tier="premium",  # Unlimited features for demo
        is_demo=True,
        demo_owner_sales_rep_id=sales_rep_id,
        active=True,
        verified=True,
        email_verified=True,
    )
    db.add(demo_user)
    db.flush()
    
    # Create dealer profile
    profile = DealerProfile(
        user_id=demo_user.id,
        name=demo_user.company_name,
        company_name=demo_user.company_name,
        slug=f"demo-{sales_rep_id}-{secrets.token_hex(3)}",
        email=demo_email,
    )
    db.add(profile)
    
    # Create sample listings
    demo_listings = get_demo_listing_data()
    listings_created = 0
    
    for listing_data in demo_listings:
        # Generate unique BIN
        bin_id = f"DEMO{uuid.uuid4().hex[:12].upper()}"
        
        listing = Listing(
            user_id=demo_user.id,
            created_by_user_id=current_user.id,
            title=listing_data.get("title", "Sample Yacht"),
            description=listing_data.get("description", ""),
            make=listing_data.get("make_model", "").split()[0] if listing_data.get("make_model") else "",
            model=listing_data.get("make_model", ""),
            year=listing_data.get("year"),
            price=listing_data.get("price", 0),
            currency=listing_data.get("price_currency", "USD"),
            bin=bin_id,
            length_feet=listing_data.get("length_feet"),
            beam_feet=listing_data.get("beam_feet"),
            draft_feet=listing_data.get("draft_feet"),
            boat_type=listing_data.get("boat_type", "motor_yacht"),
            cabins=listing_data.get("num_cabins", 0),
            berths=listing_data.get("num_cabins", 0) * 2,
            heads=listing_data.get("num_heads", 0),
            fuel_capacity_gallons=listing_data.get("fuel_capacity_gallons"),
            water_capacity_gallons=listing_data.get("water_capacity_gallons"),
            city=listing_data.get("location", "").split(",")[0],
            state=listing_data.get("location", "").split(",")[1].strip() if "," in listing_data.get("location", "") else "",
            country="USA",
            fuel_type=listing_data.get("fuel_type", "diesel"),
            condition=listing_data.get("condition", "Used"),
            feature_bullets=listing_data.get("features", []),
            status="active",
        )
        db.add(listing)
        listings_created += 1
    
    db.commit()
    db.refresh(demo_user)
    
    return {
        "success": True,
        "demo_account": {
            "id": demo_user.id,
            "email": demo_email,
            "password": temp_password,
            "first_name": demo_user.first_name,
            "last_name": demo_user.last_name,
            "company_name": demo_user.company_name,
            "is_demo": demo_user.is_demo,
        },
        "sales_rep_id": sales_rep_id,
        "listings_created": listings_created,
        "message": "Demo account created with 8 sample listings. Share the email and password with the sales rep.",
        "note": "This is a test account. Save the password securely as it is provided here.",
    }


@router.get("/demo-accounts")
def list_all_demo_accounts(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get all demo accounts with their details."""
    demo_accounts = db.query(User).filter(
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).all()
    
    result = []
    for demo in demo_accounts:
        listing_count = db.query(func.count(Listing.id)).filter(
            Listing.user_id == demo.id
        ).scalar() or 0
        
        sales_rep = None
        if demo.demo_owner_sales_rep_id:
            sr = db.query(User).filter(User.id == demo.demo_owner_sales_rep_id).first()
            if sr:
                sales_rep = f"{sr.first_name} {sr.last_name}".strip()
        
        result.append({
            "id": demo.id,
            "email": demo.email,
            "company_name": demo.company_name,
            "sales_rep_id": demo.demo_owner_sales_rep_id,
            "sales_rep_name": sales_rep,
            "listings": listing_count,
            "created_at": demo.created_at.isoformat() if demo.created_at else None,
        })
    
    return {
        "total": len(result),
        "demo_accounts": result,
    }


@router.get("/demo-account/{sales_rep_id}")
def get_demo_account_for_sales_rep(
    sales_rep_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get demo account info for a specific sales rep."""
    demo = db.query(User).filter(
        User.demo_owner_sales_rep_id == sales_rep_id,
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).first()
    
    if not demo:
        raise ResourceNotFoundException("Demo account for sales rep", sales_rep_id)
    
    listing_count = db.query(func.count(Listing.id)).filter(
        Listing.user_id == demo.id
    ).scalar() or 0
    
    return {
        "id": demo.id,
        "email": demo.email,
        "company_name": demo.company_name,
        "sales_rep_id": sales_rep_id,
        "listings": listing_count,
        "created_at": demo.created_at.isoformat() if demo.created_at else None,
    }


@router.post("/demo-account/{demo_account_id}/reset")
def reset_demo_account(
    demo_account_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reset a demo account to pristine state.
    - Clear all messages and conversations
    - Restore original sample listings
    """
    demo_user = db.query(User).filter(
        User.id == demo_account_id,
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).first()
    
    if not demo_user:
        raise ResourceNotFoundException("Demo account", demo_account_id)
    
    # Delete all existing listings
    db.query(Listing).filter(Listing.user_id == demo_account_id).delete()
    
    # Recreate sample listings
    demo_listing_data = get_demo_listing_data()
    listings_restored = 0
    
    for listing_data in demo_listing_data:
        bin_id = f"DEMO{uuid.uuid4().hex[:12].upper()}"
        
        listing = Listing(
            user_id=demo_user.id,
            created_by_user_id=current_user.id,
            title=listing_data.get("title", "Sample Yacht"),
            description=listing_data.get("description", ""),
            make=listing_data.get("make_model", "").split()[0] if listing_data.get("make_model") else "",
            model=listing_data.get("make_model", ""),
            year=listing_data.get("year"),
            price=listing_data.get("price", 0),
            currency=listing_data.get("price_currency", "USD"),
            bin=bin_id,
            length_feet=listing_data.get("length_feet"),
            beam_feet=listing_data.get("beam_feet"),
            draft_feet=listing_data.get("draft_feet"),
            boat_type=listing_data.get("boat_type", "motor_yacht"),
            cabins=listing_data.get("num_cabins", 0),
            berths=listing_data.get("num_cabins", 0) * 2,
            heads=listing_data.get("num_heads", 0),
            fuel_capacity_gallons=listing_data.get("fuel_capacity_gallons"),
            water_capacity_gallons=listing_data.get("water_capacity_gallons"),
            city=listing_data.get("location", "").split(",")[0],
            state=listing_data.get("location", "").split(",")[1].strip() if "," in listing_data.get("location", "") else "",
            country="USA",
            fuel_type=listing_data.get("fuel_type", "diesel"),
            condition=listing_data.get("condition", "Used"),
            feature_bullets=listing_data.get("features", []),
            status="active",
        )
        db.add(listing)
        listings_restored += 1
    
    db.commit()
    
    return {
        "success": True,
        "demo_account_id": demo_account_id,
        "email": demo_user.email,
        "listings_restored": listings_restored,
        "message": "Demo account reset to pristine state",
    }


@router.delete("/demo-account/{demo_account_id}")
def delete_demo_account(
    demo_account_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a demo account and all associated data."""
    demo_user = db.query(User).filter(
        User.id == demo_account_id,
        User.is_demo == True,
        User.deleted_at.is_(None)
    ).first()
    
    if not demo_user:
        raise ResourceNotFoundException("Demo account", demo_account_id)
    
    # Soft delete the account
    demo_user.deleted_at = datetime.utcnow()
    
    # Delete all listings associated with the demo account
    db.query(Listing).filter(Listing.user_id == demo_account_id).delete()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Demo account deleted",
        "demo_account_id": demo_account_id,
    }