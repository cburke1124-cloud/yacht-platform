#!/usr/bin/env python3
"""Create a public dummy broker account with listings."""
import os
from datetime import datetime
import uuid

# Setup environment
os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/yacht_db')

from app.db.session import SessionLocal
from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.security.auth import get_password_hash

db = SessionLocal()

try:
    # 1. Create broker
    broker = db.query(User).filter(User.email == 'broker@yachtversal.test').first()
    if not broker:
        broker = User(
            email='broker@yachtversal.test',
            password_hash=get_password_hash('demo123'),
            first_name='National',
            last_name='Yacht Brokers',
            company_name='National Yacht Brokers',
            user_type='dealer',
            subscription_tier='premium',
            active=True,
            verified=True,
            email_verified=True,
            is_demo=False,
        )
        db.add(broker)
        db.flush()
        print('✓ Created broker (ID: {})'.format(broker.id))
    else:
        print('✓ Broker exists (ID: {})'.format(broker.id))

    # 2. Create dealer profile
    profile = db.query(DealerProfile).filter(DealerProfile.user_id == broker.id).first()
    if not profile:
        profile = DealerProfile(
            user_id=broker.id,
            company_name='National Yacht Brokers',
            slug='national-yacht-brokers',
            email='broker@yachtversal.test',
            city='Miami',
            state='FL',
            country='USA',
            cobrokering_enabled=True,
        )
        db.add(profile)
        print('✓ Created dealer profile')

    # 3. Create salesman
    salesman = db.query(User).filter(User.email == 'salesman@yachtversal.test').first()
    if not salesman:
        salesman = User(
            email='salesman@yachtversal.test',
            password_hash=get_password_hash('demo123'),
            first_name='John',
            last_name='Davidson',
            user_type='salesman',
            parent_dealer_id=broker.id,
            active=True,
            verified=True,
            email_verified=True,
            is_demo=False,
        )
        db.add(salesman)
        db.flush()
        print('✓ Created salesman (ID: {})'.format(salesman.id))
    else:
        print('✓ Salesman exists')

    # 4. Create listings
    listings_data = [
        {
            'title': '2024 Azimut 55 - Luxury Motor Yacht',
            'description': 'Stunning 55-foot Azimut with state-of-the-art navigation and luxury cabin.',
            'price': 2500000,
            'make': 'Azimut',
            'model': '55',
            'year': 2024,
            'length_feet': 55,
            'beam_feet': 15,
            'draft_feet': 4.5,
            'city': 'Miami',
            'state': 'FL',
            'boat_type': 'motor_yacht',
            'fuel_type': 'diesel',
            'cabins': 3,
            'heads': 3,
            'water_capacity_gallons': 1500,
            'fuel_capacity_gallons': 3000,
        },
        {
            'title': '2022 Sunseeker 76 - Express Cruiser',
            'description': 'Luxurious 76-foot Sunseeker with open flybridge and full spa.',
            'price': 3800000,
            'make': 'Sunseeker',
            'model': '76',
            'year': 2022,
            'length_feet': 76,
            'beam_feet': 18,
            'draft_feet': 5.2,
            'city': 'Fort Lauderdale',
            'state': 'FL',
            'boat_type': 'motor_yacht',
            'fuel_type': 'diesel',
            'cabins': 4,
            'heads': 4,
            'water_capacity_gallons': 2000,
            'fuel_capacity_gallons': 4000,
        },
        {
            'title': '2021 Lagoon 450 - Sailing Catamaran',
            'description': 'Award-winning 45-foot sailing catamaran ideal for cruising.',
            'price': 850000,
            'make': 'Lagoon',
            'model': '450',
            'year': 2021,
            'length_feet': 45,
            'beam_feet': 24,
            'draft_feet': 3.5,
            'city': 'Nassau',
            'state': 'BS',
            'boat_type': 'sailing_catamaran',
            'fuel_type': 'diesel',
            'cabins': 3,
            'heads': 3,
            'water_capacity_gallons': 250,
            'fuel_capacity_gallons': 100,
        },
    ]

    for listing_data in listings_data:
        existing = db.query(Listing).filter(Listing.title == listing_data['title']).first()
        if not existing:
            listing = Listing(
                user_id=broker.id,
                created_by_user_id=broker.id,
                title=listing_data['title'],
                description=listing_data['description'],
                price=listing_data['price'],
                make=listing_data['make'],
                model=listing_data['model'],
                year=listing_data['year'],
                length_feet=listing_data['length_feet'],
                beam_feet=listing_data['beam_feet'],
                draft_feet=listing_data['draft_feet'],
                city=listing_data['city'],
                state=listing_data['state'],
                country='USA',
                boat_type=listing_data['boat_type'],
                fuel_type=listing_data['fuel_type'],
                cabins=listing_data['cabins'],
                heads=listing_data['heads'],
                water_capacity_gallons=listing_data['water_capacity_gallons'],
                fuel_capacity_gallons=listing_data['fuel_capacity_gallons'],
                currency='USD',
                bin='YV-{}'.format(uuid.uuid4().hex[:8].upper()),
                condition='Excellent' if listing_data['year'] >= 2022 else 'Very Good',
                status='active',
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(listing)
            print('✓ Created: {}'.format(listing_data['title'][:50]))
        else:
            print('✓ Exists: {}'.format(listing_data['title'][:50]))

    db.commit()
    print('\n✅ SUCCESS!')
    print('\nPublic Broker Account:')
    print('  Email: broker@yachtversal.test')
    print('  Password: demo123')
    print('  Company: National Yacht Brokers')
    print('\nSalesman Account:')
    print('  Email: salesman@yachtversal.test')
    print('  Password: demo123')
    print('\n✓ 3 active listings created (visible on live site)')

except Exception as e:
    db.rollback()
    print('Error: {}'.format(e))
    import traceback
    traceback.print_exc()
finally:
    db.close()
