from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.wordpress_site import WordPressSite, WordPressSyncLog
from app.models.api_keys import APIKey
from app.exceptions import ValidationException, AuthorizationException
from app.services.api_key_service import generate_wordpress_api_key
from app.services.email_service import email_service
from app.services.notification_service import notification_service

router = APIRouter()


# ==================== PYDANTIC MODELS ====================

class WordPressSiteCreate(BaseModel):
    domain: str = Field(..., description="Domain for the WordPress site (e.g., paintedladies.com)")
    theme_name: str = Field(default="luxury-modern", description="Theme template to use")
    subscription_tier: str = Field(default="essential", description="essential or professional")
    billing_cycle: str = Field(default="monthly", description="monthly or annual")


class WordPressSiteUpdate(BaseModel):
    site_name: Optional[str] = None
    theme_name: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    logo_url: Optional[str] = None
    subscription_tier: Optional[str] = None
    status: Optional[str] = None


class WordPressSiteResponse(BaseModel):
    id: int
    dealer_id: int
    domain: str
    site_name: Optional[str]
    theme_name: str
    status: str
    subscription_tier: str
    subscription_status: str
    monthly_price: int
    listings_count: int
    last_sync: Optional[datetime]
    health_status: Optional[str]
    created_at: datetime
    wp_admin_url: Optional[str]
    
    class Config:
        from_attributes = True


class SyncTrigger(BaseModel):
    sync_type: str = Field(default="full", description="full or incremental")


# ==================== HELPER FUNCTIONS ====================

def check_wordpress_permissions(current_user: User, site: WordPressSite):
    """Check if user has permission to access this WordPress site"""
    if current_user.user_type == "admin":
        return True
    
    if site.dealer_id == current_user.id:
        return True
    
    raise AuthorizationException("Not authorized to access this WordPress site")


# ==================== ROUTES ====================

@router.post("/wordpress-sites", response_model=WordPressSiteResponse, status_code=status.HTTP_201_CREATED)
async def create_wordpress_site(
    site_data: WordPressSiteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new WordPress site for the current dealer
    Admins can create for any dealer, dealers create for themselves
    """
    
    # Only dealers and admins can create WordPress sites
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Only dealers can create WordPress sites")
    
    # Check if domain already exists
    existing_site = db.query(WordPressSite).filter(
        WordPressSite.domain == site_data.domain
    ).first()
    
    if existing_site:
        raise ValidationException(f"Domain {site_data.domain} is already registered")
    
    # Determine pricing based on tier and billing cycle
    pricing = {
        "essential": {"monthly": 19900, "annual": 199000},  # $199/mo or $1990/year
        "professional": {"monthly": 34900, "annual": 349000}  # $349/mo or $3490/year
    }
    
    monthly_price = pricing[site_data.subscription_tier][site_data.billing_cycle]
    if site_data.billing_cycle == "annual":
        monthly_price = monthly_price // 12  # Average monthly for display
    
    # Generate WordPress-specific API key
    api_key = generate_wordpress_api_key(
        db=db,
        dealer_id=current_user.id,
        site_domain=site_data.domain,
        tier=site_data.subscription_tier
    )
    
    # Create site record
    new_site = WordPressSite(
        dealer_id=current_user.id,
        domain=site_data.domain,
        site_name=current_user.company_name or f"{current_user.first_name}'s Yacht Site",
        theme_name=site_data.theme_name,
        subscription_tier=site_data.subscription_tier,
        subscription_status="active",
        billing_cycle=site_data.billing_cycle,
        monthly_price=monthly_price,
        api_key_id=api_key.id,
        status="provisioning",
        features_enabled={
            "custom_pages": True,
            "team_members": 10 if site_data.subscription_tier == "professional" else 3,
            "advanced_analytics": site_data.subscription_tier == "professional",
            "priority_support": site_data.subscription_tier == "professional"
        }
    )
    
    db.add(new_site)
    db.commit()
    db.refresh(new_site)
    
    # Trigger provisioning (async task - would use Celery/background tasks in production)
    try:
        # Import here to avoid circular dependency
        from app.services.wordpress_provisioner import provision_wordpress_site
        
        provisioning_result = await provision_wordpress_site(
            dealer_id=current_user.id,
            domain=site_data.domain,
            plan=site_data.subscription_tier,
            theme=site_data.theme_name
        )
        
        # Update with provisioning results
        new_site.status = "active"
        new_site.provisioned_at = datetime.utcnow()
        new_site.wp_admin_url = provisioning_result.get("admin_url")
        new_site.server_ip = provisioning_result.get("server_ip")
        new_site.wp_admin_username = provisioning_result.get("username")
        new_site.wp_admin_password_encrypted = provisioning_result.get("password")  # Encrypt in production!
        
        db.commit()
        db.refresh(new_site)
        
        # Send welcome email with credentials
        email_service.send_wordpress_site_created(
            to_email=current_user.email,
            dealer_name=current_user.company_name or f"{current_user.first_name} {current_user.last_name}",
            site_domain=site_data.domain,
            api_key=api_key.raw_key,  # Only available immediately after creation
            wp_admin_url=provisioning_result.get("admin_url"),
            wp_username=provisioning_result.get("username"),
            wp_password=provisioning_result.get("password")
        )
        
        # Send notification
        await notification_service.send_notification(
            user_id=current_user.id,
            title="Your YachtVersal Website is Ready!",
            body=f"Your website at {site_data.domain} has been created and is ready to use.",
            notification_type="wordpress_site",
            db=db,
            link=f"https://{site_data.domain}",
            priority="high"
        )
        
    except Exception as e:
        new_site.status = "failed"
        new_site.admin_notes = f"Provisioning failed: {str(e)}"
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Site created but provisioning failed: {str(e)}"
        )
    
    return new_site


@router.get("/wordpress-sites", response_model=List[WordPressSiteResponse])
async def list_wordpress_sites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status_filter: Optional[str] = None
):
    """
    List WordPress sites
    - Dealers see only their sites
    - Admins see all sites
    """
    
    query = db.query(WordPressSite)
    
    # Filter by user role
    if current_user.user_type != "admin":
        query = query.filter(WordPressSite.dealer_id == current_user.id)
    
    # Optional status filter
    if status_filter:
        query = query.filter(WordPressSite.status == status_filter)
    
    sites = query.order_by(WordPressSite.created_at.desc()).all()
    return sites


@router.get("/wordpress-sites/{site_id}", response_model=WordPressSiteResponse)
async def get_wordpress_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details for a specific WordPress site"""
    
    site = db.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Check permissions
    check_wordpress_permissions(current_user, site)
    
    return site


@router.patch("/wordpress-sites/{site_id}", response_model=WordPressSiteResponse)
async def update_wordpress_site(
    site_id: int,
    site_update: WordPressSiteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update WordPress site settings"""
    
    site = db.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Check permissions
    check_wordpress_permissions(current_user, site)
    
    # Update fields
    update_data = site_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(site, field, value)
    
    site.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(site)
    
    return site


@router.post("/wordpress-sites/{site_id}/sync")
async def trigger_sync(
    site_id: int,
    sync_data: SyncTrigger,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger a sync for a WordPress site"""
    
    site = db.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Check permissions
    check_wordpress_permissions(current_user, site)
    
    # Create sync log
    sync_log = WordPressSyncLog(
        site_id=site_id,
        sync_type=sync_data.sync_type,
        direction="to_wordpress",
        entity_type="listings",
        status="started"
    )
    
    db.add(sync_log)
    db.commit()
    db.refresh(sync_log)
    
    try:
        # Import sync service
        from app.services.wordpress_sync import sync_listings_to_wordpress
        
        # Perform sync
        result = await sync_listings_to_wordpress(
            dealer_id=site.dealer_id,
            wordpress_domain=site.domain,
            api_key=site.api_key.key_hash,  # In production, decrypt this properly
            db=db
        )
        
        # Update sync log
        sync_log.status = "completed"
        sync_log.completed_at = datetime.utcnow()
        sync_log.entities_processed = result.get("processed", 0)
        sync_log.entities_created = result.get("created", 0)
        sync_log.entities_updated = result.get("updated", 0)
        sync_log.entities_failed = result.get("failed", 0)
        sync_log.duration_seconds = (datetime.utcnow() - sync_log.started_at).seconds
        
        # Update site
        site.last_sync = datetime.utcnow()
        site.listings_count = result.get("total_listings", site.listings_count)
        site.health_status = "healthy"
        
        db.commit()
        
        return {
            "success": True,
            "message": "Sync completed successfully",
            "sync_log_id": sync_log.id,
            "results": result
        }
        
    except Exception as e:
        sync_log.status = "failed"
        sync_log.error_message = str(e)
        sync_log.completed_at = datetime.utcnow()
        site.health_status = "degraded"
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )


@router.get("/wordpress-sites/{site_id}/sync-logs")
async def get_sync_logs(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20
):
    """Get sync history for a WordPress site"""
    
    site = db.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Check permissions
    check_wordpress_permissions(current_user, site)
    
    logs = db.query(WordPressSyncLog)\
        .filter(WordPressSyncLog.site_id == site_id)\
        .order_by(WordPressSyncLog.started_at.desc())\
        .limit(limit)\
        .all()
    
    return [{
        "id": log.id,
        "sync_type": log.sync_type,
        "direction": log.direction,
        "entity_type": log.entity_type,
        "entities_processed": log.entities_processed,
        "entities_created": log.entities_created,
        "entities_updated": log.entities_updated,
        "entities_failed": log.entities_failed,
        "status": log.status,
        "error_message": log.error_message,
        "started_at": log.started_at.isoformat(),
        "completed_at": log.completed_at.isoformat() if log.completed_at else None,
        "duration_seconds": log.duration_seconds
    } for log in logs]


@router.delete("/wordpress-sites/{site_id}")
async def cancel_wordpress_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel/delete a WordPress site (soft delete)"""
    
    site = db.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Check permissions
    check_wordpress_permissions(current_user, site)
    
    # Soft delete
    site.status = "cancelled"
    site.subscription_status = "cancelled"
    site.cancelled_at = datetime.utcnow()
    
    # Deactivate API key
    if site.api_key:
        site.api_key.is_active = False
    
    db.commit()
    
    # Notify user
    await notification_service.send_notification(
        user_id=current_user.id,
        title="WordPress Site Cancelled",
        body=f"Your website at {site.domain} has been cancelled. You can export your data before the site is deleted.",
        notification_type="wordpress_site",
        db=db
    )
    
    return {
        "success": True,
        "message": "Site cancelled successfully",
        "site_id": site_id
    }


# ==================== ADMIN ROUTES ====================

@router.get("/admin/wordpress-sites/stats")
async def get_admin_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get overall WordPress sites statistics (admin only)"""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    total_sites = db.query(WordPressSite).count()
    active_sites = db.query(WordPressSite).filter(WordPressSite.status == "active").count()
    
    # Calculate MRR
    active_subscriptions = db.query(WordPressSite).filter(
        WordPressSite.subscription_status == "active"
    ).all()
    
    mrr = sum(site.monthly_price for site in active_subscriptions) / 100  # Convert from cents to dollars
    
    # Recent signups (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_signups = db.query(WordPressSite).filter(
        WordPressSite.created_at >= thirty_days_ago
    ).count()
    
    # Health status breakdown
    health_stats = db.query(
        WordPressSite.health_status,
        db.func.count(WordPressSite.id)
    ).group_by(WordPressSite.health_status).all()
    
    return {
        "total_sites": total_sites,
        "active_sites": active_sites,
        "cancelled_sites": db.query(WordPressSite).filter(WordPressSite.status == "cancelled").count(),
        "mrr": mrr,
        "arr": mrr * 12,
        "recent_signups_30d": recent_signups,
        "avg_revenue_per_site": mrr / active_sites if active_sites > 0 else 0,
        "health_status": {status: count for status, count in health_stats},
        "tier_breakdown": {
            "essential": db.query(WordPressSite).filter(WordPressSite.subscription_tier == "essential").count(),
            "professional": db.query(WordPressSite).filter(WordPressSite.subscription_tier == "professional").count()
        }
    }


@router.post("/admin/wordpress-sites/{site_id}/provision")
async def admin_reprovision_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger re-provisioning (admin only)"""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    site = db.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Trigger re-provisioning
    site.status = "provisioning"
    db.commit()
    
    # Would trigger provisioning job here
    
    return {
        "success": True,
        "message": "Re-provisioning initiated",
        "site_id": site_id
    }
