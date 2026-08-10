from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.plugin_license import PluginLicense
from app.models.listing import Listing
from app.exceptions import AuthorizationException
from app.services.plugin_license_service import (
    generate_plugin_license,
    activate_license,
    deactivate_license,
    verify_licensed_site,
)

router = APIRouter()


# ==================== PYDANTIC MODELS ====================

class PluginLicenseCreate(BaseModel):
    plan: str = Field(default="standard", description="standard or agency")
    max_sites: int = Field(default=1, ge=1, le=25)


class PluginLicenseResponse(BaseModel):
    id: int
    plan: str
    max_sites: int
    status: str
    license_key_prefix: str
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PluginLicenseCreateResponse(PluginLicenseResponse):
    license_key: str = Field(..., description="Full license key - only shown once, at creation time")


class ActivationRequest(BaseModel):
    license_key: str
    site_url: str
    plugin_version: Optional[str] = None


class DeactivationRequest(BaseModel):
    license_key: str
    site_url: str


# ==================== DEALER-FACING ROUTES (authenticated) ====================

@router.post("/plugin-licenses", response_model=PluginLicenseCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_plugin_license(
    data: PluginLicenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Issue a new yachtversal-inventory plugin license for the current dealer."""
    if current_user.user_type not in ["dealer", "admin"]:
        raise AuthorizationException("Only brokers can purchase a plugin license")

    license = generate_plugin_license(
        db=db,
        dealer_id=current_user.id,
        plan=data.plan,
        max_sites=data.max_sites,
    )

    return PluginLicenseCreateResponse(
        id=license.id,
        plan=license.plan,
        max_sites=license.max_sites,
        status=license.status,
        license_key_prefix=license.license_key_prefix,
        expires_at=license.expires_at,
        created_at=license.created_at,
        license_key=license.raw_key,
    )


@router.get("/plugin-licenses", response_model=List[PluginLicenseResponse])
async def list_plugin_licenses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List plugin licenses - dealers see their own, admins see all."""
    query = db.query(PluginLicense)
    if current_user.user_type != "admin":
        query = query.filter(PluginLicense.dealer_id == current_user.id)

    return query.order_by(PluginLicense.created_at.desc()).all()


@router.post("/plugin-licenses/{license_id}/revoke")
async def revoke_plugin_license(
    license_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke a plugin license (owner or admin)."""
    license = db.query(PluginLicense).filter(PluginLicense.id == license_id).first()

    if not license:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")

    if current_user.user_type != "admin" and license.dealer_id != current_user.id:
        raise AuthorizationException("Not authorized to revoke this license")

    license.status = "cancelled"
    license.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "License revoked"}


# ==================== PLUGIN-FACING ROUTES (called from WordPress, license-key auth) ====================

@router.post("/plugin-licenses/activate")
async def activate_plugin_license(
    data: ActivationRequest,
    db: Session = Depends(get_db),
):
    """Called by the yachtversal-inventory plugin when a dealer enters their license key."""
    result = activate_license(db, data.license_key, data.site_url, data.plugin_version)

    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=result["message"])

    return result


@router.post("/plugin-licenses/deactivate")
async def deactivate_plugin_license(
    data: DeactivationRequest,
    db: Session = Depends(get_db),
):
    """Called by the yachtversal-inventory plugin on deactivation/uninstall."""
    result = deactivate_license(db, data.license_key, data.site_url)

    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["message"])

    return result


@router.get("/plugin/inventory")
async def get_licensed_inventory(
    activation=Depends(verify_licensed_site),
    db: Session = Depends(get_db),
):
    """Dealer inventory feed for the standalone plugin, gated behind an active license."""
    dealer_id = activation.license.dealer_id

    listings = db.query(Listing).filter(
        Listing.user_id == dealer_id,
        Listing.status == "active",
    ).all()

    yachts = [
        {
            "id": listing.id,
            "name": listing.title,
            "description": listing.description,
            "price": listing.price,
            "year": listing.year,
            "length": listing.length_feet,
            "location": ", ".join(filter(None, [listing.city, listing.state, listing.country])),
            "make": listing.make,
            "model": listing.model,
            "condition": listing.condition,
            "type": listing.boat_type,
            "featured": listing.featured,
            "images": [image.url for image in listing.images],
        }
        for listing in listings
    ]

    return {"yachts": yachts}
