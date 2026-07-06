import secrets
import hashlib
from datetime import datetime
from typing import Optional

from fastapi import Header, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.plugin_license import PluginLicense, PluginLicenseActivation


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_plugin_license(
    db: Session,
    dealer_id: int,
    plan: str = "standard",
    max_sites: int = 1,
    expires_at: Optional[datetime] = None,
) -> PluginLicense:
    """Issue a new plugin license key for a dealer."""
    raw_key = f"yvlic_{secrets.token_urlsafe(24)}"

    license = PluginLicense(
        dealer_id=dealer_id,
        license_key_hash=_hash_key(raw_key),
        license_key_prefix=raw_key[:12],
        plan=plan,
        max_sites=max_sites,
        status="active",
        expires_at=expires_at,
    )
    db.add(license)
    db.commit()
    db.refresh(license)

    license.raw_key = raw_key
    return license


def get_license_by_raw_key(db: Session, raw_key: str) -> Optional[PluginLicense]:
    return db.query(PluginLicense).filter(
        PluginLicense.license_key_hash == _hash_key(raw_key)
    ).first()


def _license_is_valid(license: PluginLicense) -> bool:
    if not license or license.status != "active":
        return False
    if license.expires_at and license.expires_at < datetime.utcnow():
        return False
    return True


def activate_license(db: Session, raw_key: str, site_url: str, plugin_version: Optional[str] = None) -> dict:
    """Activate (or re-check-in) a license for a given WordPress site."""
    license = get_license_by_raw_key(db, raw_key)

    if not license:
        return {"success": False, "message": "Invalid license key"}

    if not _license_is_valid(license):
        return {"success": False, "message": f"License is {license.status}"}

    existing = db.query(PluginLicenseActivation).filter(
        PluginLicenseActivation.license_id == license.id,
        PluginLicenseActivation.site_url == site_url,
        PluginLicenseActivation.deactivated_at.is_(None),
    ).first()

    if existing:
        existing.last_check_in = datetime.utcnow()
        if plugin_version:
            existing.plugin_version = plugin_version
        db.commit()
        return {"success": True, "message": "License already active on this site", "plan": license.plan}

    active_count = db.query(PluginLicenseActivation).filter(
        PluginLicenseActivation.license_id == license.id,
        PluginLicenseActivation.deactivated_at.is_(None),
    ).count()

    if active_count >= license.max_sites:
        return {
            "success": False,
            "message": f"License is already active on the maximum number of sites ({license.max_sites})",
        }

    activation = PluginLicenseActivation(
        license_id=license.id,
        site_url=site_url,
        plugin_version=plugin_version,
    )
    db.add(activation)
    db.commit()

    return {"success": True, "message": "License activated", "plan": license.plan}


def deactivate_license(db: Session, raw_key: str, site_url: str) -> dict:
    license = get_license_by_raw_key(db, raw_key)

    if not license:
        return {"success": False, "message": "Invalid license key"}

    activation = db.query(PluginLicenseActivation).filter(
        PluginLicenseActivation.license_id == license.id,
        PluginLicenseActivation.site_url == site_url,
        PluginLicenseActivation.deactivated_at.is_(None),
    ).first()

    if not activation:
        return {"success": False, "message": "No active activation found for this site"}

    activation.deactivated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "License deactivated"}


def verify_licensed_site(
    x_license_key: str = Header(..., alias="X-License-Key"),
    x_site_url: str = Header(..., alias="X-Site-Url"),
    db: Session = Depends(get_db),
) -> PluginLicenseActivation:
    """FastAPI dependency gating endpoints (like the inventory feed) behind a
    valid, currently-activated plugin license for the calling site."""
    license = get_license_by_raw_key(db, x_license_key)

    if not license or not _license_is_valid(license):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or inactive license")

    activation = db.query(PluginLicenseActivation).filter(
        PluginLicenseActivation.license_id == license.id,
        PluginLicenseActivation.site_url == x_site_url,
        PluginLicenseActivation.deactivated_at.is_(None),
    ).first()

    if not activation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="License is not activated for this site",
        )

    activation.last_check_in = datetime.utcnow()
    db.commit()

    return activation
