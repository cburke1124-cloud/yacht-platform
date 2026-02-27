from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    engine = create_engine(DATABASE_URL)
    
    migrations = [
        """
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS visibility VARCHAR DEFAULT 'private';
        """,
        """
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS visible_to_dealer BOOLEAN DEFAULT FALSE;
        """,
        """
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS visible_to_sales_rep BOOLEAN DEFAULT FALSE;
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_messages_visibility 
        ON messages(visibility);
        """
    ]
    
    with engine.connect() as conn:
        for migration in migrations:
            conn.execute(text(migration))
            conn.commit()
    
    print("✓ Message privacy migration complete")

if __name__ == "__main__":
    migrate()
