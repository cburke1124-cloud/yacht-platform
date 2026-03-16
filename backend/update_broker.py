import os
os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/yacht_db')

from sqlalchemy import text, update
from app.db.session import SessionLocal
from app.models.user import User
from app.security.auth import get_password_hash

db = SessionLocal()
try:
    # Update the broker account email and password to valid values
    user = db.query(User).filter(User.email == 'broker@yachtversal.test').first()
    
    if user:
        user.email = 'broker@yachtversal.com'
        user.password_hash = get_password_hash('DemoBroker2025!')
        user.verified = True
        user.email_verified = True
        db.add(user)
        db.commit()
        
        print(f"✓ Updated broker account")
        print(f"  Email: broker@yachtversal.com")
        print(f"  Password: DemoBroker2025!")
        print(f"  ID: {user.id}")
        print(f"  Type: {user.user_type}")
        print(f"  Active: {user.active}")
        print(f"  Verified: {user.verified}")
    else:
        print("✗ Broker account not found")
    
finally:
    db.close()
