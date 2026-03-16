import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal, engine
from sqlalchemy import inspect

def check_schema():
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns("users")]
    print(f"Users table columns: {columns}")
    
    if "is_demo" in columns:
        print("is_demo exists!")
    else:
        print("is_demo DOES NOT exist!")

if __name__ == "__main__":
    check_schema()
