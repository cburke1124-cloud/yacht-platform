import sys
import os

# Add parent directory to path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.user import User
from app.models.listing import Listing, ListingImage
from app.models.dealer import DealerProfile
from app.models.wordpress_site import WordPressSite
from app.models.media import MediaFile
from app.models.blog import BlogPost  # Likely needed by User
from app.models.misc import Inquiry   # Likely needed by User or Listing
# from app.security.auth import get_password_hash
import bcrypt
from datetime import datetime
from sqlalchemy import text, inspect
from app.db.session import engine


def get_password_hash(password):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')

def create_sample_broker():
    # ─── Schema Fix: Add is_demo if missing ──────────────────────────────────
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns("users")]
    if "is_demo" not in columns:
        print("Adding missing column: is_demo")
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;"))
                conn.commit()
            print("Successfully added is_demo column.")
        except Exception as e:
            print(f"Error adding is_demo column: {e}")
            return

    db = SessionLocal()
    try:
        email = "sample_broker@yachtversal.com"
        password = "SampleBrokerPassword123!"
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Creating new sample broker: {email}")
            user = User(
                email=email,
                password_hash=get_password_hash(password),
                first_name="Sample",
                last_name="Broker",
                user_type="dealer",
                active=True,
                verified=True,
                is_demo=True,  # Crucial flag
                subscription_tier="premium"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # Dealer Profile
            profile = DealerProfile(
                user_id=user.id,
                company_name="Poseidon Yacht Sales (Sample)",
                slug="poseidon-yacht-sales-sample",
                website="https://poseidon-sample.com",
                description="This is a sample broker account demonstrating the platform's capabilities. All listings are for demonstration purposes only.",
                phone="+1-555-0100",
                address="123 Marina Bay Dr",
                city="Fort Lauderdale",
                state="FL",
                country="USA",
                postal_code="33316"
            )
            db.add(profile)
            db.commit()
        else:
            print(f"Found existing sample broker: {email}")
            if not user.is_demo:
                user.is_demo = True
                db.add(user)
                db.commit()
                print("Updated is_demo flag.")

        # Create Listings
        # Listing 1: 50ft Motor Yacht
        create_listing(db, user, {
            "title": "2023 Ocean Runner 50 - SAMPLE",
            "make": "Ocean Runner",
            "model": "50",
            "year": 2023,
            "length_feet": 50.0,
            "beam_feet": 15.5,
            "boat_type": "Motor Yacht",
            "price": 1250000.0,
            "currency": "USD",
            "bin": "SAMPLE-OR50-2023",
            "location": {"city": "Miami", "state": "FL", "country": "USA"},
            "description": "SAMPLE LISTING: Experience luxury on the water with this stunning 50ft motor yacht. Features include a spacious flybridge, master stateroom with ensuite, and twin diesel engines.",
            "features": "Twin Diesel Engines\nGenerator\nAir Conditioning\nGPS/Radar\nTeak Decks",
            "images": [
                "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&q=80&w=1000",
                "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=1000"
            ]
        })

        # Listing 2: 40ft Sailing Yacht
        create_listing(db, user, {
            "title": "2020 Blue Water 40 - SAMPLE",
            "make": "Blue Water",
            "model": "40",
            "year": 2020,
            "length_feet": 40.0,
            "beam_feet": 12.0,
            "boat_type": "Sailing Yacht",
            "price": 350000.0,
            "currency": "USD",
            "bin": "SAMPLE-BW40-2020",
            "location": {"city": "San Diego", "state": "CA", "country": "USA"},
            "description": "SAMPLE LISTING: A beautiful cruiser/racer ready for your next adventure. Meticulously maintained and fully equipped.",
            "features": "Main Sail\nJib\nAutopilot\nSolar Panels\nDinghy",
            "images": [
                "https://images.unsplash.com/photo-1569263979104-565b63484f93?auto=format&fit=crop&q=80&w=1000",
                 "https://images.unsplash.com/photo-1508964348616-a36c1e5443fa?auto=format&fit=crop&q=80&w=1000"
            ]
        })
        
        print("Sample data creation complete.")

    finally:
        db.close()

def create_listing(db, user, data):
    existing = db.query(Listing).filter(Listing.bin == data['bin']).first()
    if existing:
        print(f"Listing {data['bin']} already exists.")
        return

    print(f"Creating listing: {data['title']}")
    listing = Listing(
        user_id=user.id,
        created_by_user_id=user.id,
        title=data['title'],
        make=data['make'],
        model=data['model'],
        year=data['year'],
        length_feet=data['length_feet'],
        beam_feet=data.get('beam_feet'),
        boat_type=data['boat_type'],
        price=data['price'],
        currency=data['currency'],
        bin=data['bin'],
        city=data['location']['city'],
        state=data['location']['state'],
        country=data['location']['country'],
        description=data['description'],
        features=data['features'],
        status="active",
        created_at=datetime.utcnow(),
        published_at=datetime.utcnow()
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    # Add Images
    for i, url in enumerate(data.get('images', [])):
        img = ListingImage(
            listing_id=listing.id,
            url=url,
            is_primary=(i==0),
            display_order=i,
            caption="Sample Image"
        )
        db.add(img)
    db.commit()

if __name__ == "__main__":
    create_sample_broker()
