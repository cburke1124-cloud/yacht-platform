import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin123@localhost:5432/yacht_db")

def test_connection():
    """Test basic database connection"""
    try:
        # Parse the DATABASE_URL
        # Format: postgresql://username:password@host:port/database
        url = DATABASE_URL.replace("postgresql://", "")
        user_pass, host_db = url.split("@")
        username, password = user_pass.split(":")
        host_port, database = host_db.split("/")
        host, port = host_port.split(":") if ":" in host_port else (host_port, "5432")
        
        print(f"Attempting to connect to:")
        print(f"  Host: {host}")
        print(f"  Port: {port}")
        print(f"  Database: {database}")
        print(f"  User: {username}")
        print()
        
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=username,
            password=password
        )
        
        print("✅ Database connection successful!")
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

def check_tables(conn):
    """Check if all required tables exist"""
    cur = conn.cursor()
    
    required_tables = [
        'users', 'user_preferences', 'dealer_profiles', 'listings', 
        'listing_images', 'featured_listings', 'saved_listings',
        'price_alerts', 'search_alerts', 'messages', 'notifications',
        'crm_integrations', 'scraper_jobs', 'currency_rates', 'site_settings'
    ]
    
    print("\n=== Checking Tables ===")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    
    existing_tables = [row[0] for row in cur.fetchall()]
    print(f"Found {len(existing_tables)} tables:")
    for table in existing_tables:
        print(f"  ✓ {table}")
    
    missing_tables = [t for t in required_tables if t not in existing_tables]
    if missing_tables:
        print(f"\n⚠️  Missing {len(missing_tables)} required tables:")
        for table in missing_tables:
            print(f"  ✗ {table}")
        return False
    
    print("\n✅ All required tables exist!")
    return True

def check_users(conn):
    """Check users in database"""
    cur = conn.cursor()
    
    print("\n=== Checking Users ===")
    cur.execute("SELECT COUNT(*) FROM users")
    user_count = cur.fetchone()[0]
    print(f"Total users: {user_count}")
    
    if user_count > 0:
        cur.execute("""
            SELECT id, email, user_type, subscription_tier, active 
            FROM users 
            LIMIT 10
        """)
        users = cur.fetchall()
        print("\nFirst 10 users:")
        for user in users:
            print(f"  ID: {user[0]}, Email: {user[1]}, Type: {user[2]}, Tier: {user[3]}, Active: {user[4]}")
    else:
        print("⚠️  No users found in database!")
    
    return user_count

def check_listings(conn):
    """Check listings in database"""
    cur = conn.cursor()
    
    print("\n=== Checking Listings ===")
    cur.execute("SELECT COUNT(*) FROM listings")
    listing_count = cur.fetchone()[0]
    print(f"Total listings: {listing_count}")
    
    if listing_count > 0:
        cur.execute("""
            SELECT id, title, price, status, created_at
            FROM listings 
            ORDER BY created_at DESC
            LIMIT 5
        """)
        listings = cur.fetchall()
        print("\nLast 5 listings:")
        for listing in listings:
            print(f"  ID: {listing[0]}, Title: {listing[1]}, Price: ${listing[2]:,.0f}, Status: {listing[3]}")
    else:
        print("⚠️  No listings found in database!")
    
    return listing_count

def check_columns(conn):
    """Check if new columns exist"""
    cur = conn.cursor()
    
    print("\n=== Checking New Columns ===")
    
    # Check users table
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('trial_active', 'trial_end_date', 'assigned_sales_rep_id', 'permissions')
    """)
    user_cols = [row[0] for row in cur.fetchall()]
    print(f"Users table new columns: {user_cols}")
    
    # Check listings table
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'listings' 
        AND column_name IN ('continent', 'latitude', 'longitude', 'featured_priority', 'featured_plan')
    """)
    listing_cols = [row[0] for row in cur.fetchall()]
    print(f"Listings table new columns: {listing_cols}")
    
    # Check dealer_profiles table
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'dealer_profiles' 
        AND column_name IN ('slug', 'banner_image', 'primary_color', 'about_section')
    """)
    dealer_cols = [row[0] for row in cur.fetchall()]
    print(f"Dealer_profiles table new columns: {dealer_cols}")

def create_test_user(conn):
    """Create a test admin user"""
    from passlib.context import CryptContext
    
    cur = conn.cursor()
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    email = "admin@test.com"
    password = "admin123"
    
    # Check if user exists
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        print(f"\n✓ Test user {email} already exists")
        return
    
    # Create user
    hashed = pwd_context.hash(password)
    cur.execute("""
        INSERT INTO users (email, password_hash, first_name, last_name, user_type, subscription_tier, active)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (email, hashed, "Admin", "User", "admin", "free", True))
    
    conn.commit()
    print(f"\n✅ Created test admin user:")
    print(f"   Email: {email}")
    print(f"   Password: {password}")

def create_test_listing(conn):
    """Create a test listing"""
    cur = conn.cursor()
    
    # Get first user
    cur.execute("SELECT id FROM users LIMIT 1")
    user = cur.fetchone()
    if not user:
        print("⚠️  No users found, cannot create test listing")
        return
    
    user_id = user[0]
    
    # Check if test listing exists
    cur.execute("SELECT id FROM listings WHERE title = %s", ("Test Yacht - 2024 Sea Ray",))
    if cur.fetchone():
        print("\n✓ Test listing already exists")
        return
    
    # Create listing
    cur.execute("""
        INSERT INTO listings 
        (user_id, created_by_user_id, title, make, model, year, price, length_feet, 
         boat_type, city, state, country, description, condition, status, published_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
    """, (
        user_id, user_id, "Test Yacht - 2024 Sea Ray", "Sea Ray", "Sundancer 320",
        2024, 250000, 32, "Motor Yacht", "Miami", "Florida", "USA",
        "Beautiful test yacht for sale", "new", "active"
    ))
    
    conn.commit()
    print(f"\n✅ Created test listing: Test Yacht - 2024 Sea Ray")

def main():
    print("=" * 60)
    print("YachtVersal Database Diagnostic Tool")
    print("=" * 60)
    
    # Test connection
    conn = test_connection()
    if not conn:
        print("\n❌ Cannot proceed without database connection.")
        print("\nTroubleshooting:")
        print("1. Make sure PostgreSQL is running")
        print("2. Check your .env file DATABASE_URL")
        print("3. Verify credentials: username, password, database name")
        return
    
    try:
        # Check tables
        tables_ok = check_tables(conn)
        
        if not tables_ok:
            print("\n❌ Missing tables! Please run the SQL migrations first:")
            print("   psql -U postgres -d yacht_db -f sql_migrations.sql")
            return
        
        # Check columns
        check_columns(conn)
        
        # Check data
        user_count = check_users(conn)
        listing_count = check_listings(conn)
        
        # Offer to create test data
        if user_count == 0:
            response = input("\n⚠️  No users found. Create test admin user? (y/n): ")
            if response.lower() == 'y':
                create_test_user(conn)
        
        if listing_count == 0:
            response = input("\n⚠️  No listings found. Create test listing? (y/n): ")
            if response.lower() == 'y':
                create_test_listing(conn)
        
        print("\n" + "=" * 60)
        print("Diagnostic Complete!")
        print("=" * 60)
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()
