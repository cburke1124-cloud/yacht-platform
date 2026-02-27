import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/yacht_db')
print('Using DATABASE_URL:', DATABASE_URL)
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position;"))
    cols = [r[0] for r in res]
    print('users columns:', cols)
    print('verification_token present:', 'verification_token' in cols)
