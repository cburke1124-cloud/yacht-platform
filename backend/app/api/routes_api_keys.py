from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import secrets
import hashlib

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.api_keys import APIKey, DealerInvitation, PromotionalOffer
from app.services.email_service import email_service
from app.exceptions import ValidationException, AuthorizationException

router = APIRouter()


# ==================== API KEYS ====================

@router.post("/api-keys")
async def create_api_key(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API key for the dealer"""
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Only dealers can create API keys")
    
    name = data.get("name")
    if not name:
        raise ValidationException("API key name is required")
    
    # Generate API key
    key = f"yvk_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    key_prefix = key[:8]
    
    # Create API key record
    api_key = APIKey(
        dealer_id=current_user.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        name=name,
        rate_limit=data.get("rate_limit", 1000),
        expires_at=data.get("expires_at")
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    return {
        "id": api_key.id,
        "key": key,  # Only returned once!
        "key_prefix": key_prefix,
        "name": api_key.name,
        "created_at": api_key.created_at.isoformat(),
        "message": "Save this key securely - it won't be shown again!"
    }


@router.get("/api-keys")
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API keys for the current dealer"""
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Only dealers can view API keys")
    
    keys = db.query(APIKey).filter(
        APIKey.dealer_id == current_user.id
    ).all()
    
    return [{
        "id": key.id,
        "key_prefix": key.key_prefix,
        "name": key.name,
        "is_active": key.is_active,
        "rate_limit": key.rate_limit,
        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
        "created_at": key.created_at.isoformat(),
        "expires_at": key.expires_at.isoformat() if key.expires_at else None
    } for key in keys]


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an API key"""
    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.dealer_id == current_user.id
    ).first()
    
    if not api_key:
        raise ValidationException("API key not found")
    
    db.delete(api_key)
    db.commit()
    
    return {"success": True, "message": "API key deleted"}


@router.patch("/api-keys/{key_id}")
async def update_api_key(
    key_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update API key (toggle active status, change name, etc.)"""
    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.dealer_id == current_user.id
    ).first()
    
    if not api_key:
        raise ValidationException("API key not found")
    
    if "is_active" in data:
        api_key.is_active = data["is_active"]
    if "name" in data:
        api_key.name = data["name"]
    if "rate_limit" in data:
        api_key.rate_limit = data["rate_limit"]
    
    db.commit()
    
    return {"success": True, "message": "API key updated"}


@router.post("/api-keys/{key_id}/regenerate")
async def regenerate_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rotate an API key by deactivating the old key and creating a replacement."""
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Only dealers can regenerate API keys")

    old_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.dealer_id == current_user.id
    ).first()

    if not old_key:
        raise ValidationException("API key not found")

    old_key.is_active = False

    new_key_value = f"yvk_{secrets.token_urlsafe(32)}"
    new_key_hash = hashlib.sha256(new_key_value.encode()).hexdigest()
    new_key_prefix = new_key_value[:8]

    new_key = APIKey(
        dealer_id=current_user.id,
        key_hash=new_key_hash,
        key_prefix=new_key_prefix,
        name=old_key.name,
        rate_limit=old_key.rate_limit,
        expires_at=old_key.expires_at,
        key_type=old_key.key_type,
        tier=old_key.tier,
        is_active=True,
    )

    db.add(new_key)
    db.commit()
    db.refresh(new_key)

    return {
        "old_key_id": old_key.id,
        "id": new_key.id,
        "key": new_key_value,
        "key_prefix": new_key.key_prefix,
        "name": new_key.name,
        "is_active": new_key.is_active,
        "rate_limit": new_key.rate_limit,
        "created_at": new_key.created_at.isoformat(),
        "expires_at": new_key.expires_at.isoformat() if new_key.expires_at else None,
        "message": "API key regenerated. Copy the new key now; it will not be shown again."
    }


# ==================== DEALER INVITATIONS ====================

@router.post("/invitations")
async def create_invitation(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create dealer invitation (sales rep only)"""
    if current_user.user_type not in ["salesman", "admin"]:
        raise AuthorizationException("Only sales reps or admins can send invitations")
        sales_rep_id = current_user.id
        if current_user.user_type == "admin":
            requested_rep_id = data.get("sales_rep_id")
            if not requested_rep_id:
                raise ValidationException("sales_rep_id is required for admin invitations")
            sales_rep = db.query(User).filter(
                User.id == requested_rep_id,
                User.user_type == "salesman",
                User.active == True,
            ).first()
            if not sales_rep:
                raise ValidationException("Invalid sales_rep_id")
            sales_rep_id = sales_rep.id

    
    email = data.get("email")
    if not email:
        raise ValidationException("Email is required")
    
    # Check if already registered
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValidationException("User already registered")
    
    # Generate invitation token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    invitation = DealerInvitation(
        sales_rep_id=sales_rep_id,
        email=email,
        token=token,
        company_name=data.get("company_name"),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        expires_at=expires_at
    )
    
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    
    # Send invitation email
    rep_user = current_user
    if current_user.user_type == "admin":
        rep_user = db.query(User).filter(User.id == sales_rep_id).first() or current_user

    email_service.send_dealer_invitation(
        to_email=email,
        token=token,
        sales_rep_name=f"{rep_user.first_name} {rep_user.last_name}",
        company_name=data.get("company_name")
    )
    
    return {
        "id": invitation.id,
        "email": invitation.email,
        "token": invitation.token,
        "expires_at": invitation.expires_at.isoformat(),
        "message": "Invitation sent successfully"
    }


@router.get("/invitations")
async def list_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all invitations sent by current sales rep"""
    if current_user.user_type != "salesman":
        raise AuthorizationException("Only sales reps can view invitations")
    
    invitations = db.query(DealerInvitation).filter(
        DealerInvitation.sales_rep_id == current_user.id
    ).order_by(DealerInvitation.created_at.desc()).all()
    
    return [{
        "id": inv.id,
        "email": inv.email,
        "company_name": inv.company_name,
        "first_name": inv.first_name,
        "last_name": inv.last_name,
        "status": inv.status,
        "created_at": inv.created_at.isoformat(),
        "expires_at": inv.expires_at.isoformat(),
        "accepted_at": inv.accepted_at.isoformat() if inv.accepted_at else None
    } for inv in invitations]


@router.get("/invitations/validate/{token}")
async def validate_invitation(
    token: str,
    db: Session = Depends(get_db)
):
    """Validate invitation token (public endpoint)"""
    invitation = db.query(DealerInvitation).filter(
        DealerInvitation.token == token,
        DealerInvitation.status == "pending"
    ).first()
    
    if not invitation:
        raise ValidationException("Invalid invitation token")
    
    if invitation.expires_at < datetime.utcnow():
        invitation.status = "expired"
        db.commit()
        raise ValidationException("Invitation has expired")
    
    return {
        "valid": True,
        "email": invitation.email,
        "company_name": invitation.company_name,
        "first_name": invitation.first_name,
        "last_name": invitation.last_name
    }


# ==================== PROMOTIONAL OFFERS ====================

@router.post("/promotional-offers")
async def create_promotional_offer(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create promotional offer for a dealer (sales rep only)"""
    if current_user.user_type not in ["salesman", "admin"]:
        raise AuthorizationException("Only sales reps or admins can create offers")

    created_by = current_user.id
    if current_user.user_type == "admin" and data.get("sales_rep_id"):
        sales_rep = db.query(User).filter(
            User.id == data.get("sales_rep_id"),
            User.user_type == "salesman",
        ).first()
        if not sales_rep:
            raise ValidationException("Invalid sales_rep_id")
        created_by = sales_rep.id
    
    dealer_id = data.get("dealer_id")
    if not dealer_id:
        raise ValidationException("Dealer ID is required")
    
    offer = PromotionalOffer(
        dealer_id=dealer_id,
        created_by=created_by,
        offer_type=data.get("offer_type", "discount"),
        discount_type=data.get("discount_type"),
        discount_value=data.get("discount_value"),
        trial_days=data.get("trial_days", 0),
        trial_tier=data.get("trial_tier"),
        end_date=datetime.fromisoformat(data["end_date"]),
        original_tier=data.get("original_tier"),
        original_price=data.get("original_price"),
        discounted_price=data.get("discounted_price"),
        notes=data.get("notes")
    )
    
    db.add(offer)
    db.commit()
    db.refresh(offer)
    
    return {
        "id": offer.id,
        "message": "Promotional offer created successfully"
    }


@router.get("/promotional-offers")
async def list_promotional_offers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List promotional offers"""
    if current_user.user_type == "salesman":
        # Sales reps see all offers they created
        offers = db.query(PromotionalOffer).filter(
            PromotionalOffer.created_by == current_user.id
        ).all()
    elif current_user.user_type in ["dealer", "admin"]:
        # Dealers see their own offers
        offers = db.query(PromotionalOffer).filter(
            PromotionalOffer.dealer_id == current_user.id
        ).all()
    else:
        raise AuthorizationException("Unauthorized")
    
    return [{
        "id": offer.id,
        "offer_type": offer.offer_type,
        "discount_type": offer.discount_type,
        "discount_value": offer.discount_value,
        "trial_days": offer.trial_days,
        "active": offer.active,
        "applied": offer.applied,
        "start_date": offer.start_date.isoformat(),
        "end_date": offer.end_date.isoformat(),
        "created_at": offer.created_at.isoformat()
    } for offer in offers]
