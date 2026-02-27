from main import SessionLocal, User, hash_password
from datetime import datetime

db = SessionLocal()

admin = User(
    email="admin@yachtversal.com",
    password_hash=hash_password("Admin123!"),
    first_name="Christopher",
    last_name="Burke",
    phone="5043909829",
    user_type="admin",
    company_name="YachtVersal",
    subscription_tier="premium",
    verified=True,
    active=True,
    created_at=datetime.utcnow()
)

db.add(admin)
db.commit()
db.refresh(admin)

print("Admin created:", admin.id)