from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.security.auth import security, optional_security, AUTH_COOKIE_NAME


def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    """The httpOnly session cookie is the primary credential for browser
    clients; the Authorization header remains a fallback for non-browser API
    consumers (and for any request the cookie didn't reach)."""
    cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if credentials:
        return credentials.credentials
    return None


def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    token = _extract_token(request, credentials)
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        email: str | None = payload.get("sub")
        if not email:
            return None
    except JWTError:
        return None

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.active:
        return None
    return user

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = _extract_token(request, credentials)
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise credentials_exception
    if not user.active:
        raise credentials_exception

    return user