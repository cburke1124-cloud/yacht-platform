#!/usr/bin/env python3
"""
Setup script to create a public dummy broker account with listings.
This creates a REAL (non-demo) account visible on the live site.
"""

import os
import sys
from datetime import datetime
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.security.auth import get_password_hash


LISTINGS_DATA = [
    {
        "title": "2024 Azimut 55 - Luxury Motor Yacht",
        "description": "Stunning 55-foot Azimut with state-of-the-art navigation, luxurious cabin, and professional crew quarters. Recently refitted with new electronics and upholstery. Perfect for Mediterranean cruising.",
        "make": "Azimut",
        "model": "55",
        "year": 2024,
        "length_feet": 55,
        "beam_feet": 15,
        "draft_feet": 4.5,
        "price": 2500000,
        "condition": "Excellent",
        "city": "Miami",
        "state": "FL",
        "boat_type": "motor_yacht",
        "fuel_type": "diesel",
        "cabins": 3,
        "heads": 3,
        "water_capacity_gallons": 1500,
        "fuel_capacity_gallons": 3000,
    },
    {
        "title": "2022 Sunseeker 76 - Express Cruiser",
        "description": "Luxurious 76-foot Sunseeker with open flybridge and spacious salon. Twin Caterpillar engines provide excellent fuel efficiency. Full spa with hot tub on sundeck.",
        "make": "Sunseeker",
        "model": "76",
        "year": 2022,
        "length_feet": 76,
        "beam_feet": 18,
        "draft_feet": 5.2,
        "price": 3800000,
        "condition": "Excellent",
        "city": "Fort Lauderdale",
        "state": "FL",
        "boat_type": "motor_yacht",
        "fuel_type": "diesel",
        "cabins": 4,
        "heads": 4,
        "water_capacity_gallons": 2000,
        "fuel_capacity_gallons": 4000,
    },
    {
        "title": "2021 Lagoon 450 - Sailing Catamaran",
        "description": "Award-winning 45-foot sailing catamaran. Ideal for cruising or charter. Twin daggerboards for excellent windward performance. Recently hauled and painted.",
        "make": "Lagoon",
        "model": "450",
        "year": 2021,
        "length_feet": 45,
        "beam_feet": 24,
        "draft_feet": 3.5,
        "price": 850000,
        "condition": "Very Good",
        "city": "Nassau",
        "state": "BS",
        "boat_type": "sailing_catamaran",
        "fuel_type": "diesel",
        "cabins": 3,
        "heads": 3,
        "water_capacity_gallons": 250,
        "fuel_capacity_gallons": 100,
    },
]


def main():
    db = SessionLocal()
    
    try:
        # Create broker (dealer) account
        broker_email = "broker@yachtversal.test"
        broker = db.query(User).filter(User.email == broker_email).first()
        
        if broker:
            print(f"✓ Broker account already exists: {broker_email}")
        else:
            broker = User(
                email=broker_email,
                password_hash=get_password_hash("demo123"),
                first_name="National",
                last_name="Yacht Brokers",
                company_name="National Yacht Brokers",
                user_type="dealer",
                subscription_tier="premium",
                active=True,
                verified=True,
                email_verified=True,
                is_demo=False,  # REAL account, not demo
            )
            db.add(broker)
            db.flush()
            print(f"✓ Created broker account: {broker_email} (ID: {broker.id})")
        
        # Create dealer profile if not exists
        dealer_profile = db.query(DealerProfile).filter(DealerProfile.user_id == broker.id).first()
        if not dealer_profile:
            dealer_profile = DealerProfile(
                user_id=broker.id,
                company_name="National Yacht Brokers",
                slug="national-yacht-brokers",
                email=broker_email,
                phone="+1-800-YACHTS-1",
                website="https://yachtversal.com",
                address="123 Marina Drive",
                city="Miami",
                state="FL",
                country="USA",
                postal_code="33139",
                description="Premium yacht brokerage specializing in luxury motor yachts and sailing vessels.",
                cobrokering_enabled=True,
            )
            db.add(dealer_profile)
            print(f"✓ Created dealer profile")
        
        # Create salesman account
        salesman_email = "salesman@yachtversal.test"
        salesman = db.query(User).filter(User.email == salesman_email).first()
        
        if salesman:
            print(f"✓ Salesman account already exists: {salesman_email}")
        else:
            salesman = User(
                email=salesman_email,
                password_hash=get_password_hash("demo123"),
                first_name="John",
                last_name="Davidson",
                company_name="National Yacht Brokers",
                user_type="salesman",
                subscription_tier="premium",
                parent_dealer_id=broker.id,
                active=True,
                verified=True,
                email_verified=True,
                is_demo=False,  # REAL account
            )
            db.add(salesman)
            db.flush()
            print(f"✓ Created salesman account: {salesman_email} (ID: {salesman.id})")
        
        # Create 3 listings
        for listing_data in LISTINGS_DATA:
            bin_id = f"YV-{uuid.uuid4().hex[:8].upper()}"
            
            # Check if listing already exists by title
            existing = db.query(Listing).filter(Listing.title == listing_data["title"]).first()
            if existing:
                print(f"✓ Listing already exists: {listing_data['title']}")
                continue
            
            listing = Listing(
                user_id=broker.id,
                created_by_user_id=broker.id,
                title=listing_data["title"],
                description=listing_data["description"],
                make=listing_data["make"],
                model=listing_data["model"],
                year=listing_data["year"],
                price=listing_data["price"],
                currency="USD",
                bin=bin_id,
                length_feet=listing_data["length_feet"],
                beam_feet=listing_data["beam_feet"],
                draft_feet=listing_data["draft_feet"],
                boat_type=listing_data["boat_type"],
                cabins=listing_data["cabins"],
                heads=listing_data["heads"],
                fuel_capacity_gallons=listing_data["fuel_capacity_gallons"],
                water_capacity_gallons=listing_data["water_capacity_gallons"],
                city=listing_data["city"],
                state=listing_data["state"],
                country="USA",
                fuel_type=listing_data["fuel_type"],
                condition=listing_data["condition"],
                status="active",  # ACTIVE - visible on site
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(listing)
            db.flush()
            print(f"✓ Created listing: {listing_data['title']} (BIN: {bin_id})")
        
        db.commit()
        print("\n✓ Public broker account setup complete!")
        print(f"\nBroker Account:")
        print(f"  Email: {broker_email}")
        print(f"  Password: demo123")
        print(f"  Company: National Yacht Brokers")
        print(f"\nSalesman Account:")
        print(f"  Email: {salesman_email}")
        print(f"  Password: demo123")
        print(f"\nListings: 3 active listings (visible on site)")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
