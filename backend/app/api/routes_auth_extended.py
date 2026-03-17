import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import secrets
import pyotp

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.dealer import EmailVerification, TwoFactorAuth, TwoFactorCode, PasswordReset
from app.models.partner_growth import ReferralSignup, AffiliateAccount
from app.services.email_service import email_service
from app.exceptions import ValidationException, AuthenticationException
from app.security.auth import get_password_hash

router = APIRouter()


# ==================== EMAIL VERIFICATION ====================

@router.post("/send-verification")
async def send_verification_email(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send email verification link to user"""
    if current_user.email_verified:
        raise ValidationException("Email already verified")
    
    # Generate verification token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    # Delete any existing verification for this user
    db.query(EmailVerification).filter(
        EmailVerification.user_id == current_user.id
    ).delete()
    
    # Create new verification record
    verification = EmailVerification(
        user_id=current_user.id,
        token=token,
        expires_at=expires_at
    )
    
    db.add(verification)
    db.commit()
    
    # Send email
    user_name = f"{current_user.first_name} {current_user.last_name}" if current_user.first_name else None
    email_service.send_verification_email(
        to_email=current_user.email,
        token=token,
        user_name=user_name
    )
    
    return {
        "success": True,
        "message": "Verification email sent"
    }


@router.get("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    """Verify email with token"""
    verification = db.query(EmailVerification).filter(
        EmailVerification.token == token,
        EmailVerification.verified == False
    ).first()
    
    if not verification:
        raise ValidationException("Invalid verification token")
    
    if verification.expires_at < datetime.utcnow():
        raise ValidationException("Verification token has expired")
    
    # Update user
    user = db.query(User).filter(User.id == verification.user_id).first()
    if user:
        user.email_verified = True
        user.email_verified_at = datetime.utcnow()
    
    # Mark verification as used
    verification.verified = True
    
    db.commit()
    
    return {
        "success": True,
        "message": "Email verified successfully!"
    }


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resend verification email"""
    return await send_verification_email(current_user, db)


# ==================== TWO-FACTOR AUTHENTICATION ====================

@router.post("/2fa/enable")
async def enable_2fa(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enable or disable 2FA"""
    enabled = data.get("enabled", True)
    
    if enabled:
        # Generate backup codes
        backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
        
        # Create or update 2FA record
        twofa = db.query(TwoFactorAuth).filter(
            TwoFactorAuth.user_id == current_user.id
        ).first()
        
        if not twofa:
            twofa = TwoFactorAuth(
                user_id=current_user.id,
                backup_codes=backup_codes,
                enabled=True
            )
            db.add(twofa)
        else:
            twofa.backup_codes = backup_codes
            twofa.enabled = True
        
        # Update user
        current_user.two_factor_enabled = True
        db.commit()
        
        return {
            "success": True,
            "enabled": True,
            "backup_codes": backup_codes,
            "message": "Two-factor authentication enabled"
        }
    else:
        # Disable 2FA
        db.query(TwoFactorAuth).filter(
            TwoFactorAuth.user_id == current_user.id
        ).delete()
        
        current_user.two_factor_enabled = False
        db.commit()
        
        return {
            "success": True,
            "enabled": False,
            "message": "Two-factor authentication disabled"
        }


@router.post("/2fa/send-code")
async def send_2fa_code(
    data: dict,
    db: Session = Depends(get_db)
):
    """Send 2FA code to user email (called during login)"""
    email = data.get("email")
    
    if not email:
        raise ValidationException("Email is required")
    
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.two_factor_enabled:
        raise ValidationException("2FA not enabled for this account")
    
    # Generate 6-digit code
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Delete old codes
    db.query(TwoFactorCode).filter(
        TwoFactorCode.user_id == user.id
    ).delete()
    
    # Create new code
    twofa_code = TwoFactorCode(
        user_id=user.id,
        code=code,
        expires_at=expires_at
    )
    
    db.add(twofa_code)
    db.commit()
    
    # Send code via email
    user_name = f"{user.first_name} {user.last_name}" if user.first_name else None
    email_service.send_2fa_code(
        to_email=user.email,
        code=code,
        user_name=user_name
    )
    
    return {
        "success": True,
        "message": "Verification code sent to your email"
    }


@router.post("/2fa/verify-code")
async def verify_2fa_code(
    data: dict,
    db: Session = Depends(get_db)
):
    """Verify 2FA code"""
    email = data.get("email")
    code = data.get("code")
    
    if not email or not code:
        raise ValidationException("Email and code are required")
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise AuthenticationException("Invalid credentials")
    
    # Check code
    twofa_code = db.query(TwoFactorCode).filter(
        TwoFactorCode.user_id == user.id,
        TwoFactorCode.code == code,
        TwoFactorCode.used == False
    ).first()
    
    if not twofa_code:
        # Check if it's a backup code
        twofa = db.query(TwoFactorAuth).filter(
            TwoFactorAuth.user_id == user.id
        ).first()
        
        if twofa and code in twofa.backup_codes:
            # Remove used backup code
            twofa.backup_codes.remove(code)
            db.commit()
            
            return {
                "success": True,
                "verified": True,
                "message": "Backup code accepted"
            }
        else:
            raise AuthenticationException("Invalid verification code")
    
    if twofa_code.expires_at < datetime.utcnow():
        raise AuthenticationException("Verification code has expired")
    
    # Mark code as used
    twofa_code.used = True
    db.commit()
    
    return {
        "success": True,
        "verified": True,
        "message": "Code verified"
    }


@router.get("/2fa/backup-codes")
async def get_backup_codes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get 2FA backup codes"""
    twofa = db.query(TwoFactorAuth).filter(
        TwoFactorAuth.user_id == current_user.id
    ).first()
    
    if not twofa:
        raise ValidationException("2FA not enabled")
    
    return {
        "backup_codes": twofa.backup_codes
    }


@router.post("/2fa/regenerate-backup-codes")
async def regenerate_backup_codes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate 2FA backup codes"""
    twofa = db.query(TwoFactorAuth).filter(
        TwoFactorAuth.user_id == current_user.id
    ).first()
    
    if not twofa:
        raise ValidationException("2FA not enabled")
    
    # Generate new backup codes
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    twofa.backup_codes = backup_codes
    
    db.commit()
    
    return {
        "success": True,
        "backup_codes": backup_codes,
        "message": "Backup codes regenerated"
    }


# ==================== REGISTER WITH INVITATION ====================

@router.post("/register-invited")
async def register_with_invitation(
    data: dict,
    db: Session = Depends(get_db)
):
    """Register dealer with invitation token"""
    from app.models.api_keys import DealerInvitation
    from app.models.dealer import DealerProfile
    from app.utils.slug import create_slug
    from app.security.auth import create_access_token
    
    token = data.get("invitation_token")
    
    if not token:
        raise ValidationException("Invitation token is required")
    
    # Validate invitation
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
    
    # Check if email already used
    existing = db.query(User).filter(User.email == invitation.email).first()
    if existing:
        raise ValidationException("Email already registered")
    
    # Create user
    password = data.get("password")
    if not password:
        raise ValidationException("Password is required")
    
    # Let get_password_hash handle password validation and truncation
    user = User(
        email=invitation.email,
        password_hash=get_password_hash(password),
        first_name=data.get("first_name") or invitation.first_name,
        last_name=data.get("last_name") or invitation.last_name,
        phone=data.get("phone"),
        company_name=data.get("company_name") or invitation.company_name,
        user_type="dealer",
        subscription_tier=data.get("subscription_tier", "free"),
        assigned_sales_rep_id=invitation.sales_rep_id,
        active=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create dealer profile
    slug = create_slug(user.company_name or user.email, db, DealerProfile)
    profile = DealerProfile(
        user_id=user.id,
        name=f"{user.first_name} {user.last_name}",
        company_name=user.company_name,
        email=user.email,
        phone=user.phone,
        slug=slug
    )
    
    db.add(profile)

    affiliate_account = db.query(AffiliateAccount).filter(
        AffiliateAccount.user_id == invitation.sales_rep_id,
        AffiliateAccount.account_type == "sales_rep",
    ).first()

    commission_rate = 10.0
    referral_code = None
    if affiliate_account:
        commission_rate = float(affiliate_account.commission_rate or 10.0)
        referral_code = affiliate_account.code

    signup = ReferralSignup(
        dealer_user_id=user.id,
        source_type="sales_rep",
        sales_rep_id=invitation.sales_rep_id,
        affiliate_account_id=affiliate_account.id if affiliate_account else None,
        referral_code_used=referral_code,
        commission_rate=commission_rate,
    )
    db.add(signup)
    
    # Mark invitation as accepted
    invitation.status = "accepted"
    invitation.accepted_at = datetime.utcnow()
    
    db.commit()
    
    # Generate access token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=60 * 24 * 7)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "message": "Account created successfully!"
    }


# ==================== PASSWORD SETUP (admin-created accounts) ====================

@router.post("/set-password")
def set_password(
    data: dict,
    db: Session = Depends(get_db),
):
    """
    Lets a newly-created dealer (or any user with a setup token) choose their
    password the first time.  No auth required — the token IS the credential.
    """
    token = (data.get("token") or "").strip()
    password = (data.get("password") or "").strip()

    if not token:
        raise ValidationException("Setup token is required")
    if len(password) < 8:
        raise ValidationException("Password must be at least 8 characters")

    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise ValidationException("Invalid or expired setup link. Please contact support.")

    user.password_hash = get_password_hash(password)
    user.verification_token = None
    user.email_verified = True
    user.email_verified_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Password set successfully. You can now log in."}


# ==================== FORGOT / RESET PASSWORD ====================

@router.post("/forgot-password")
def forgot_password(data: dict, db: Session = Depends(get_db)):
    """
    Request a password reset email.  Always returns success to prevent
    email enumeration — check Render logs or SendGrid activity for errors.
    """
    email = (data.get("email") or "").strip().lower()
    if not email:
        return {"success": True, "message": "If that email exists, a reset link has been sent"}

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"success": True, "message": "If that email exists, a reset link has been sent"}

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    # Invalidate old unused tokens
    db.query(PasswordReset).filter(
        PasswordReset.user_id == user.id,
        PasswordReset.used.is_(False),
    ).delete()

    db.add(PasswordReset(user_id=user.id, token=token, expires_at=expires_at))
    db.commit()

    user_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    try:
        result = email_service.send_password_reset_email(user.email, token, user_name)
        if result:
            logging.info("forgot_password: reset email SENT to %s", email)
        else:
            logging.error("forgot_password: send_email returned False for %s — check SendGrid config", email)
    except Exception as exc:
        logging.error("forgot_password: email FAILED for %s: %s", email, exc)

    return {"success": True, "message": "If that email exists, a reset link has been sent"}


@router.post("/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    """Confirm a password reset using the token from the email link."""
    token = (data.get("token") or "").strip()
    new_password = (data.get("new_password") or data.get("password") or "").strip()

    if not token:
        raise ValidationException("Reset token is required")
    if len(new_password) < 8:
        raise ValidationException("Password must be at least 8 characters")

    reset = (
        db.query(PasswordReset)
        .filter(
            PasswordReset.token == token,
            PasswordReset.used.is_(False),
            PasswordReset.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not reset:
        raise ValidationException("Invalid or expired reset link. Please request a new one.")

    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        raise ValidationException("Account not found")

    user.password_hash = get_password_hash(new_password)
    reset.used = True
    db.commit()

    return {"success": True, "message": "Password reset successfully. You can now log in."}
