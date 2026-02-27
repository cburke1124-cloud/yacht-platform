from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserPreferences
from app.models.dealer import DealerProfile
from app.exceptions import ResourceNotFoundException

router = APIRouter()


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