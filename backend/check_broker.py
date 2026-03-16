import os
os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/yacht_db')

from sqlalchemy import text
from app.db.session import SessionLocal

db = SessionLocal()
try:
    # Check broker@yachtversal.test (the original)
    result = db.execute(text("SELECT id, email, user_type FROM users WHERE email = 'broker@yachtversal.test'")).first()
    if result:
        user_id = result[0]
        print(f"✓ Broker (test) exists: ID={user_id}, Email={result[1]}, Type={result[2]}")
        
        # Check listings for this broker
        listing_result = db.execute(text(f"SELECT COUNT(*) FROM listings WHERE user_id = {user_id}")).scalar()
        print(f"  └─ Listings: {listing_result}")
    
    # Check broker@yachtversal.com
    result2 = db.execute(text("SELECT id, email, user_type FROM users WHERE email = 'broker@yachtversal.com'")).first()
    if result2:
        print(f"✓ Broker (com) exists: ID={result2[0]}, Email={result2[1]}, Type={result2[2]}")
    else:
        print("✗ No broker@yachtversal.com account found")
    
finally:
    db.close()
