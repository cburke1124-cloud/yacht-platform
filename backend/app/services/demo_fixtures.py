"""
Demo account fixtures and sample listing data.
Used to populate demo dealer accounts with showcase listings.

Status distribution across the 9 fixtures:
  - active (5): visible in All / Active tabs, showcases listings in action
  - featured (1): active + featured=True, showcases the Featured Listings tab
  - sold (1): showcases the Sold tab
  - draft (1): showcases the Draft tab
  - needs_approval (1): showcases the Awaiting Approval tab
  - recently_deleted=True (1 of the actives): soft-deleted post-creation to
    showcase the Recently Deleted tab with the 30-day recovery countdown
"""

import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.dealer import DealerProfile
from app.models.listing import Listing
from app.models.misc import Inquiry, Message
from app.security.auth import get_password_hash

DEMO_SAMPLE_LISTINGS = [
    # --- Featured showcase ---
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
        "location": "Miami, Florida",
        "boat_type": "motor_yacht",
        "fuel_type": "diesel",
        "num_cabins": 3,
        "num_heads": 3,
        "water_capacity_gallons": 1500,
        "fuel_capacity_gallons": 3000,
        "features": ["GPS", "Radar", "Autopilot", "Stabilizers", "AC/Heating", "Generator", "Water Maker", "Satellite TV", "Tender with Outboard"],
        "status": "active",
        "featured": True,      # showcases Featured Listings tab
        "views": 847,
        "inquiries": 12,
    },
    # --- Active listings ---
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
        "location": "Fort Lauderdale, Florida",
        "boat_type": "motor_yacht",
        "fuel_type": "diesel",
        "num_cabins": 4,
        "num_heads": 4,
        "water_capacity_gallons": 2000,
        "fuel_capacity_gallons": 4000,
        "features": ["Twin Cats", "Bowthruster", "Dynamic Positioning", "Stabilizers", "Full A/C", "Generator", "Watermaker", "Satellite Comms", "Hot Tub", "Gym"],
        "status": "active",
        "featured": False,
        "views": 512,
        "inquiries": 7,
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
        "location": "St. Thomas, USVI",
        "boat_type": "sailing_catamaran",
        "fuel_type": "diesel",
        "num_cabins": 3,
        "num_heads": 3,
        "water_capacity_gallons": 250,
        "fuel_capacity_gallons": 100,
        "features": ["Furling Sails", "Electric Winches", "Autopilot", "GPS/Chartplotter", "VHF", "Generator", "Dinghy"],
        "status": "active",
        "featured": False,
        "views": 234,
        "inquiries": 3,
    },
    {
        "title": "2023 Jeanneau 64 - Performance Cruising Yacht",
        "description": "Sleek 64-foot Jeanneau with excellent performance and comfort. Modern design with spacious cabins and sophisticated navigation suite.",
        "make": "Jeanneau",
        "model": "64",
        "year": 2023,
        "length_feet": 64,
        "beam_feet": 17,
        "draft_feet": 4.8,
        "price": 2200000,
        "condition": "Excellent",
        "location": "Newport, Rhode Island",
        "boat_type": "sailing_yacht",
        "fuel_type": "diesel",
        "num_cabins": 4,
        "num_heads": 3,
        "water_capacity_gallons": 400,
        "fuel_capacity_gallons": 500,
        "features": ["Furling Sails", "In-boom Furler", "Autopilot", "Full A/C", "Generator", "Watermaker"],
        "status": "active",
        "featured": False,
        "views": 156,
        "inquiries": 2,
    },
    # --- Sold listing (showcases Sold tab) ---
    {
        "title": "2019 Sea Ray 460 Sundancer - Spacious Cruiser",
        "description": "Beautiful 46-foot Sea Ray Sundancer with open galley and updated furnishings. Twin Cummins engines. Great for weekenders or liveaboard.",
        "make": "Sea Ray",
        "model": "460 Sundancer",
        "year": 2019,
        "length_feet": 46,
        "beam_feet": 14,
        "draft_feet": 4.2,
        "price": 1200000,
        "condition": "Good",
        "location": "San Diego, California",
        "boat_type": "motor_yacht",
        "fuel_type": "diesel",
        "num_cabins": 2,
        "num_heads": 2,
        "water_capacity_gallons": 800,
        "fuel_capacity_gallons": 2400,
        "features": ["Twin Engines", "Bowthruster", "A/C", "Generator", "Hardtop", "Enclosure", "Dinghy Davit"],
        "status": "sold",       # showcases Sold tab
        "featured": False,
        "views": 189,
        "inquiries": 5,
    },
    # --- Draft listing (showcases Draft tab) ---
    {
        "title": "2020 Beneteau Swift Trawler 50 - Trawler Yacht",
        "description": "Economical 50-foot trawler with excellent sea keeper design. Perfect for world cruising. Low fuel consumption with heavy displacement hull. Listing in progress.",
        "make": "Beneteau",
        "model": "Swift Trawler 50",
        "year": 2020,
        "length_feet": 50,
        "beam_feet": 15,
        "draft_feet": 4.5,
        "price": 980000,
        "condition": "Very Good",
        "location": "Seattle, Washington",
        "boat_type": "trawler",
        "fuel_type": "diesel",
        "num_cabins": 3,
        "num_heads": 3,
        "water_capacity_gallons": 500,
        "fuel_capacity_gallons": 1600,
        "features": ["Single Engine", "Stabilizers", "A/C", "Generator", "Watermaker", "Tender", "Fishing Gear"],
        "status": "draft",      # showcases Draft tab
        "featured": False,
        "views": 0,
        "inquiries": 0,
    },
    # --- Needs Approval listing (showcases Needs Approval tab) ---
    {
        "title": "2023 Princess 68 Flybridge - Luxury Motor Yacht",
        "description": "Latest generation Princess with innovative design. Expansive saloon with floor-to-ceiling windows. Twin Rolls-Royce engines. Pending broker review.",
        "make": "Princess",
        "model": "68 Flybridge",
        "year": 2023,
        "length_feet": 68,
        "beam_feet": 17,
        "draft_feet": 4.9,
        "price": 4500000,
        "condition": "Excellent",
        "location": "Antibes, France",
        "boat_type": "motor_yacht",
        "fuel_type": "diesel",
        "num_cabins": 4,
        "num_heads": 4,
        "water_capacity_gallons": 2000,
        "fuel_capacity_gallons": 4500,
        "features": ["Twin Rolls-Royce", "Dynamic Positioning", "Smart Glass", "Spa Pool", "Sauna", "Elevator", "Tender with Jet"],
        "status": "awaiting_review",  # showcases Awaiting Approval tab
        "featured": False,
        "views": 67,
        "inquiries": 1,
    },
    # --- Active listing that gets soft-deleted to showcase Recently Deleted tab ---
    {
        "title": "2018 Riviera 445 SUV - Sport Utility Vessel",
        "description": "Premium 44-foot Riviera with distinctive SUV styling. Outstanding offshore performance with exceptional range and seakeeping ability.",
        "make": "Riviera",
        "model": "445 SUV",
        "year": 2018,
        "length_feet": 44,
        "beam_feet": 14,
        "draft_feet": 1.3,
        "price": 695000,
        "condition": "Good",
        "location": "Gold Coast, Australia",
        "boat_type": "motor_yacht",
        "fuel_type": "diesel",
        "num_cabins": 2,
        "num_heads": 2,
        "water_capacity_gallons": 600,
        "fuel_capacity_gallons": 1800,
        "features": ["Twin Volvo IPS", "Joystick Docking", "Bowthruster", "A/C", "Generator", "Hardtop"],
        "status": "active",
        "featured": False,
        "views": 91,
        "inquiries": 0,
        "recently_deleted": True,  # soft-deleted after creation to showcase Recently Deleted tab
    },
    # --- A second recently-deleted listing for more realistic Recently Deleted tab ---
    {
        "title": "2020 Beneteau Oceanis 46.1 - Sailing Yacht",
        "description": "Well-appointed 46-foot cruising yacht with excellent offshore capability. Comfort-oriented interior designed for long passages.",
        "make": "Beneteau",
        "model": "Oceanis 46.1",
        "year": 2020,
        "length_feet": 46,
        "beam_feet": 14.4,
        "draft_feet": 6.2,
        "price": 395000,
        "condition": "Very Good",
        "location": "Annapolis, Maryland",
        "boat_type": "sailing_yacht",
        "fuel_type": "diesel",
        "num_cabins": 3,
        "num_heads": 2,
        "water_capacity_gallons": 185,
        "fuel_capacity_gallons": 68,
        "features": ["Self-Tacking Jib", "Autopilot", "Chartplotter", "AIS", "VHF", "Windlass", "Bimini"],
        "status": "active",
        "featured": False,
        "views": 44,
        "inquiries": 0,
        "recently_deleted": True,  # soft-deleted 12 days ago — shows amber countdown
    },
]


def get_demo_listing_data(index: int = None):
    """
    Get demo listing data by index, or all if index is None.
    """
    if index is not None and 0 <= index < len(DEMO_SAMPLE_LISTINGS):
        return DEMO_SAMPLE_LISTINGS[index]
    return DEMO_SAMPLE_LISTINGS


def create_demo_account_for_owner(db: Session, owner: User, created_by_user_id: int) -> dict:
    """
    Create a demo User + DealerProfile + 8 sample Listings owned by `owner`
    (a sales rep or admin). Does not commit — caller owns the transaction.
    """
    demo_email = f"demo-{owner.id}-{secrets.token_hex(4)}@yachtversal.demo"
    temp_password = secrets.token_urlsafe(16)
    hashed_password = get_password_hash(temp_password)

    demo_user = User(
        email=demo_email,
        password_hash=hashed_password,
        first_name="Demo",
        last_name=f"- {owner.first_name or 'Account'}",
        user_type="dealer",
        company_name=f"[DEMO] {owner.first_name or 'Demo'}'s Demo Brokerage",
        subscription_tier="premium",
        is_demo=True,
        # Demo accounts never touch Stripe, but should look and behave like a
        # fully paid broker — same convention as sales-rep/admin-comped
        # accounts (see routes_sales.py) and required by billing_status.py's
        # user_has_paid() check, which the dashboard's payment banner and the
        # listing-creation payment gate both rely on.
        always_free=True,
        demo_owner_sales_rep_id=owner.id,
        active=True,
        verified=True,
        email_verified=True,
    )
    db.add(demo_user)
    db.flush()

    profile = DealerProfile(
        user_id=demo_user.id,
        name=demo_user.company_name,
        company_name=demo_user.company_name,
        slug=f"demo-{owner.id}-{secrets.token_hex(3)}",
        email=demo_email,
    )
    db.add(profile)
    db.flush()

    demo_listings = get_demo_listing_data()
    listings_created = 0
    created_listings: list[Listing] = []
    now = datetime.utcnow()

    for idx, listing_data in enumerate(demo_listings):
        try:
            bin_id = f"DEMO{uuid.uuid4().hex[:12].upper()}"
            location = listing_data.get("location", "Miami, Florida")
            location_parts = location.split(",")
            city = location_parts[0].strip() if location_parts else "Miami"
            state = location_parts[1].strip() if len(location_parts) > 1 else "FL"

            is_featured = listing_data.get("featured", False)
            listing_status = listing_data.get("status", "active")
            is_recently_deleted = listing_data.get("recently_deleted", False)

            listing = Listing(
                user_id=demo_user.id,
                created_by_user_id=created_by_user_id,
                title=listing_data.get("title", "Sample Yacht"),
                description=listing_data.get("description", ""),
                make=listing_data.get("make", ""),
                model=listing_data.get("model", ""),
                year=listing_data.get("year", 2023),
                price=listing_data.get("price", 1000000),
                currency="USD",
                bin=bin_id,
                length_feet=listing_data.get("length_feet", 50),
                beam_feet=listing_data.get("beam_feet", 15),
                draft_feet=listing_data.get("draft_feet", 4),
                boat_type=listing_data.get("boat_type", "motor_yacht"),
                cabins=listing_data.get("num_cabins", 3),
                heads=listing_data.get("num_heads", 2),
                fuel_capacity_gallons=listing_data.get("fuel_capacity_gallons", 2000),
                water_capacity_gallons=listing_data.get("water_capacity_gallons", 1000),
                city=city,
                state=state,
                country="USA",
                fuel_type=listing_data.get("fuel_type", "diesel"),
                condition=listing_data.get("condition", "Excellent"),
                feature_bullets=listing_data.get("features", []),
                status=listing_status,
                featured=is_featured,
                featured_until=now + timedelta(days=90) if is_featured else None,
                views=listing_data.get("views", 0),
                inquiries=listing_data.get("inquiries", 0),
                # Soft-delete listings flagged recently_deleted so the
                # Recently Deleted tab is populated on a fresh demo.
                # Use staggered ages so countdown numbers vary.
                deleted_at=now - timedelta(days=3 + idx * 2) if is_recently_deleted else None,
            )
            db.add(listing)
            listings_created += 1
            created_listings.append(listing)
        except Exception as e:
            # Log but continue creating other listings
            print(f"Error creating listing: {str(e)}")
            continue

    db.flush()

    create_demo_inquiries(db, demo_user, created_listings, now)
    db.flush()

    return {
        "demo_user": demo_user,
        "listings_created": listings_created,
        "temp_password": temp_password,
    }


def create_demo_inquiries(db: Session, demo_user: User, listings: list[Listing], now: datetime) -> None:
    """
    Seed a couple of sample buyer inquiries so the Messages tab isn't empty
    on a fresh demo. Mirrors the shape POST /inquiries and
    POST /inquiries/{id}/reply produce (see routes_inquiries.py) so the
    dashboard's Messages tab and inquiries counter render exactly as they
    would for a real lead.
    """
    if len(listings) < 2:
        return

    threads = [
        {
            "listing": listings[0],
            "sender_name": "James Whitfield",
            "sender_email": "jwhitfield@example.com",
            "sender_phone": "+1 305-555-0142",
            "message": "Hi, is the Azimut 55 still available? I'd love to schedule a showing this weekend if possible.",
            "lead_stage": "new",
            "days_ago": 4,
            "reply": None,
        },
        {
            "listing": listings[1],
            "sender_name": "Marie Devereux",
            "sender_email": "marie.devereux@example.com",
            "sender_phone": "+1 954-555-0198",
            "message": "Interested in the Sunseeker 76 — can you send over recent service records and let me know if the price is negotiable?",
            "lead_stage": "contacted",
            "days_ago": 6,
            "reply": "Hi Marie, thanks for reaching out! I'll get the service records over to you today. The listing price has some flexibility for a serious buyer — happy to discuss further on a call whenever works for you.",
        },
    ]

    for thread in threads:
        listing = thread["listing"]
        created_at = now - timedelta(days=thread["days_ago"])

        inquiry = Inquiry(
            listing_id=listing.id,
            sender_name=thread["sender_name"],
            sender_email=thread["sender_email"],
            sender_phone=thread["sender_phone"],
            message=thread["message"],
            assigned_to_id=demo_user.id,
            lead_stage=thread["lead_stage"],
            lead_score=25 if thread["reply"] else 10,
            status="replied" if thread["reply"] else "new",
            created_at=created_at,
            updated_at=created_at,
        )
        db.add(inquiry)
        db.flush()

        root_message = Message(
            ticket_number=f"INQ-{inquiry.id}",
            sender_id=None,
            recipient_id=demo_user.id,
            listing_id=listing.id,
            message_type="inquiry",
            subject=f"Inquiry from {thread['sender_name']}: {listing.title}",
            body=f"From {thread['sender_name']} ({thread['sender_email']}):\n{thread['message']}",
            status="replied" if thread["reply"] else "new",
            visible_to_dealer=True,
            external_sender_email=thread["sender_email"],
            category="inquiry",
            created_at=created_at,
            replied_at=created_at + timedelta(hours=5) if thread["reply"] else None,
        )
        db.add(root_message)
        db.flush()

        if thread["reply"]:
            reply_message = Message(
                sender_id=demo_user.id,
                recipient_id=None,
                parent_message_id=root_message.id,
                listing_id=listing.id,
                message_type="inquiry",
                subject=f"Re: {root_message.subject}",
                body=thread["reply"],
                status="new",
                visible_to_dealer=True,
                category="inquiry",
                created_at=created_at + timedelta(hours=5),
            )
            db.add(reply_message)
