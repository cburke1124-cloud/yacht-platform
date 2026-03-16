import os
from hashlib import pbkdf2_hmac
import base64

os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/yacht_db')

from sqlalchemy import text
from app.db.session import SessionLocal

# Generate password hash for 'DemoBroker2025!'
password = 'DemoBroker2025!'
salt = b'salt'  # Using simple salt for demo; FastAPI uses proper salt
hash_obj = pbkdf2_hmac('sha256', password.encode(), salt, 100000)
password_hash = '$2b$12$' + base64.b64encode(hash_obj).decode()[:50]  # bcrypt format

db = SessionLocal()
try:
    # Use the hash from the create_public_broker.py which we know works
    # Let me try using Python's passlib
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_pw = pwd_context.hash('DemoBroker2025!')
    
    # Update broker email and password
    result = db.execute(text("""
        UPDATE users 
        SET email = 'broker@yachtversal.com', 
            password_hash = :pwd_hash,
            verified = true,
            email_verified = true
        WHERE email = 'broker@yachtversal.test'
        RETURNING id, email, user_type
    """), {"pwd_hash": hashed_pw})
    
    db.commit()
    row = result.first()
    
    if row:
        print(f"✓ Updated broker account")
        print(f"  ID: {row[0]}")
        print(f"  Email: {row[1]}")
        print(f"  Type: {row[2]}")
        print(f"\nBroker Login Credentials:")
        print(f"  Email: broker@yachtversal.com")
        print(f"  Password: DemoBroker2025!")
    else:
        print("✗ Failed to update - broker not found")
    
    # Verify listings exist
    result = db.execute(text("SELECT COUNT(*) FROM listings WHERE user_id = 9")).scalar()
    print(f"\n✓ Sample Listings: {result}")
    
finally:
    db.close()
