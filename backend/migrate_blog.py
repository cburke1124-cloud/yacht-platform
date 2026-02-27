import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin123@localhost:5432/yacht_db")

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    migrations = [
        # Add blog tables
        """
        CREATE TABLE IF NOT EXISTS blog_posts (
            id SERIAL PRIMARY KEY,
            author_id INTEGER REFERENCES users(id),
            title VARCHAR NOT NULL,
            slug VARCHAR UNIQUE NOT NULL,
            excerpt TEXT,
            content TEXT NOT NULL,
            featured_image VARCHAR,
            meta_title VARCHAR,
            meta_description VARCHAR,
            meta_keywords VARCHAR,
            category VARCHAR,
            tags VARCHAR,
            status VARCHAR DEFAULT 'draft',
            published_at TIMESTAMP,
            views INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        
        # Add indexes
        """
        CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
        CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);
        CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category);
        """,
        
        # Add missing user fields
        """
        ALTER TABLE users ADD COLUMN IF NOT EXISTS public_profile BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url VARCHAR;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS specialties JSON DEFAULT '[]';
        """,
    ]
    
    with engine.connect() as conn:
        for migration in migrations:
            try:
                conn.execute(text(migration))
                conn.commit()
                print(f"✓ Executed migration")
            except Exception as e:
                print(f"✗ Migration failed: {e}")
                conn.rollback()

if __name__ == "__main__":
    print("Running migrations...")
    run_migration()
    print("Migrations complete!")
