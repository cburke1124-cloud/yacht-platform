from fastapi import Security, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import hashlib
from datetime import datetime

from app.models.api_keys import APIKey
from app.db.session import get_db

security = HTTPBearer()

def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
):
    """Verify API key from Authorization header"""
    key = credentials.credentials
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    
    api_key = db.query(APIKey).filter(
        APIKey.key_hash == key_hash,
        APIKey.is_active == True
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    # Update last used
    api_key.last_used_at = datetime.utcnow()
    db.commit()
    
    return api_key