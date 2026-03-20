from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings
from app.services.password_validator import PasswordValidator
from app.exceptions import ValidationException

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def truncate_password(password: str) -> str:
    """Truncate password to 72 bytes for bcrypt compatibility."""
    # Encode to bytes, truncate to 72 bytes, then decode back to string
    password_bytes = password.encode('utf-8')
    if len(password_bytes) <= 72:
        return password
    
    # Truncate to 72 bytes
    truncated_bytes = password_bytes[:72]
    
    # Decode back to string, ignoring any incomplete UTF-8 sequences at the end
    return truncated_bytes.decode('utf-8', errors='ignore')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    # Truncate password to 72 bytes for bcrypt
    plain_password = truncate_password(plain_password)
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str, skip_validation: bool = False) -> str:
    """Hash a password after validating it meets requirements.
    
    Pass skip_validation=True for system-generated passwords (e.g. temp passwords)
    that are guaranteed to be replaced by the user on first login.
    """
    if not skip_validation:
        # Validate before truncation to ensure full password meets requirements
        is_valid, errors = PasswordValidator.validate(password)
        if not is_valid:
            raise ValidationException("Password does not meet requirements", {"errors": errors})
    
    # Truncate password to 72 bytes for bcrypt before hashing
    password = truncate_password(password)
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
