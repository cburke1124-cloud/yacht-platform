#!/usr/bin/env python3
"""Create a demo broker account with valid email and sample listings."""
import os
from datetime import datetime
import uuid

os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/yacht_db')

from app.db.session import SessionLocal
from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.security.auth import get_password_hash

db = SessionLocal()

try:
    # Create broker with valid email
    broker = db.query(User).filter(User.email == 'broker@yachtversal.com').first()
    if not broker:
        broker = User(
            email='broker@yachtversal.com',
            password_hash=get_password_hash('DemoBroker2025!'),
            first_name='National',
            last_name='Yacht Brokers',
            company_name='National Yacht Brokers',
            user_type='dealer',
            subscription_tier='premium',
            active=True,
            verified=True,
            email_verified=True,
            is_demo=True,
        )
        db.add(broker)
        db.flush()
        print(f'✓ Created broker account (ID: {broker.id})')
    else:
        print(f'✓ Broker account exists (ID: {broker.id})')

    # Create dealer profile if missing
    profile = db.query(DealerProfile).filter(DealerProfile.user_id == broker.id).first()
    if not profile:
        profile = DealerProfile(
            user_id=broker.id,
            name='National Yacht Brokers',
            company_name='National Yacht Brokers',
            slug='national-yacht-brokers',
            email='broker@yachtversal.com',
            city='Miami',
            state='FL',
            country='USA',
        )
        db.add(profile)
        print('✓ Created dealer profile')
    else:
        print('✓ Dealer profile exists')

    # Verify listings exist
    listing_count = db.query(Listing).filter(Listing.user_id == broker.id).count()
    print(f'✓ Broker has {listing_count} sample listings')

    db.commit()
    print('\n✅ SUCCESS!')
    print('\nBroker Account Credentials:')
    print('  Email: broker@yachtversal.com')
    print('  Password: DemoBroker2025!')
    print('  Account Type: Dealer (Broker)')

except Exception as e:
    db.rollback()
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
