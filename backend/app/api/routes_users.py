from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserPreferences
from app.models.dealer import DealerProfile, ActivityLog
from app.exceptions import ResourceNotFoundException, ValidationException

router = APIRouter()


@router.get("/users/me")  
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current authenticated user's information"""
    dealer_profile = db.query(DealerProfile).filter(
        DealerProfile.user_id == current_user.id
    ).first()

    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "user_type": current_user.user_type,
        "company_name": current_user.company_name,
        "subscription_tier": current_user.subscription_tier,
        "photo_url": current_user.profile_photo_url,
        "title": current_user.title,
        "bio": current_user.bio,
        "verified": current_user.verified,
        "active": current_user.active,
        "logo_url": dealer_profile.logo_url if dealer_profile else None,
        "slug": dealer_profile.slug if dealer_profile else None,
    }


@router.get("/users/{user_id}")
def get_user_info(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ResourceNotFoundException("User", user_id)

    dealer_profile = db.query(DealerProfile).filter(DealerProfile.user_id == user_id).first()

    return {
        "id": user.id,
        "name": f"{user.first_name} {user.last_name}" if user.first_name else user.email,
        "company_name": user.company_name,
        "email": user.email,
        "phone": user.phone,
        "user_type": user.user_type,
        "logo_url": dealer_profile.logo_url if dealer_profile else None,
        "slug": dealer_profile.slug if dealer_profile else None,
    }

@router.get("/preferences")
def get_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)

    permissions = current_user.permissions or {}

    return {
        "language": prefs.language,
        "currency": prefs.currency,
        "units": prefs.units,
        "timezone": prefs.timezone,
        "marketing_opt_in": bool(prefs.email_marketing),
        "communication_email": bool(prefs.email_new_message or prefs.email_new_inquiry),
        "communication_sms": bool(permissions.get("communication_sms", False)),
        "communication_push": bool(prefs.push_new_message or prefs.push_new_inquiry),
    }


@router.put("/preferences")
def update_preferences(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    for key in ["language", "currency", "units", "timezone"]:
        if key in data:
            setattr(prefs, key, data[key])

    if "marketing_opt_in" in data:
        prefs.email_marketing = bool(data["marketing_opt_in"])

    if "communication_email" in data:
        email_enabled = bool(data["communication_email"])
        prefs.email_new_message = email_enabled
        prefs.email_new_inquiry = email_enabled
        prefs.email_price_alert = email_enabled
        prefs.email_new_listing_match = email_enabled

    if "communication_push" in data:
        push_enabled = bool(data["communication_push"])
        prefs.push_new_message = push_enabled
        prefs.push_new_inquiry = push_enabled
        prefs.app_new_message = push_enabled
        prefs.app_new_inquiry = push_enabled

    if "communication_sms" in data:
        permissions = current_user.permissions or {}
        permissions["communication_sms"] = bool(data["communication_sms"])
        current_user.permissions = permissions

    db.commit()
    return {"success": True}


# ============= Account Deletion & Recovery =============

@router.post("/account/delete")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft delete the current user account. Account can be recovered for 90 days.
    """
    from datetime import datetime, timedelta
    
    # Set deletion timestamp and recovery deadline (90 days)
    current_user.deleted_at = datetime.utcnow()
    current_user.recovery_deadline = datetime.utcnow() + timedelta(days=90)
    db.commit()
    
    return {
        "success": True,
        "message": "Account deleted. You can restore it within 90 days.",
        "recovery_deadline": current_user.recovery_deadline.isoformat()
    }


@router.post("/account/restore")
def restore_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Restore a soft-deleted account if within recovery period.
    """
    from datetime import datetime
    
    if not current_user.deleted_at:
        raise ResourceNotFoundException("No deleted account to restore")
    
    if current_user.recovery_deadline and datetime.utcnow() > current_user.recovery_deadline:
        raise ValidationException("Recovery period has expired (90 days). Your account cannot be restored.")
    
    # Restore the account
    current_user.deleted_at = None
    current_user.recovery_deadline = None
    db.commit()
    
    return {
        "success": True,
        "message": "Account restored successfully"
    }


@router.get("/account/deletion-status")
def get_deletion_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the current deletion status of the account.
    """
    from datetime import datetime
    
    if not current_user.deleted_at:
        return {
            "deleted": False,
            "message": "Account is active"
        }
    
    is_expired = current_user.recovery_deadline and datetime.utcnow() > current_user.recovery_deadline
    
    return {
        "deleted": True,
        "deleted_at": current_user.deleted_at.isoformat(),
        "recovery_deadline": current_user.recovery_deadline.isoformat() if current_user.recovery_deadline else None,
        "recovery_expired": is_expired,
        "days_remaining": (current_user.recovery_deadline - datetime.utcnow()).days if current_user.recovery_deadline and not is_expired else 0
    }


# ============= User Settings (notification preferences) =============

@router.get("/user/settings")
def get_user_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)

    return {
        "email_new_message": bool(prefs.email_new_message),
        "email_new_inquiry": bool(prefs.email_new_inquiry),
        "email_price_alert": bool(prefs.email_price_alert),
        "email_new_listing_match": bool(prefs.email_new_listing_match),
        "email_marketing": bool(prefs.email_marketing),
        "language": prefs.language or "en",
        "currency": prefs.currency or "USD",
        "units": prefs.units or "imperial",
        "timezone": prefs.timezone or "America/New_York",
    }


@router.put("/user/settings")
def update_user_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    bool_fields = [
        "email_new_message", "email_new_inquiry", "email_price_alert",
        "email_new_listing_match", "email_marketing",
    ]
    for field in bool_fields:
        if field in data:
            setattr(prefs, field, bool(data[field]))

    for field in ["language", "currency", "units", "timezone"]:
        if field in data:
            setattr(prefs, field, data[field])

    db.commit()
    return {"success": True, "message": "Settings saved successfully"}


# ============= Activity Log =============

@router.get("/activity-log")
def get_activity_log(
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details or {},
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]

