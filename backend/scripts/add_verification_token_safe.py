import os, traceback
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:admin123@localhost:5432/yacht_db')
out = {'DATABASE_URL': DATABASE_URL, 'actions': []}
try:
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR"))
        out['actions'].append('added_column')
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_verification_token ON users (verification_token)"))
        out['actions'].append('created_index')
        conn.execute(text("UPDATE users SET verification_token = md5(random()::text || clock_timestamp()::text) WHERE verification_token IS NULL"))
        out['actions'].append('populated_tokens')
    out['status'] = 'success'
except Exception as e:
    out['status'] = 'error'
    out['error'] = str(e)
    out['trace'] = traceback.format_exc()

with open('scripts/add_verification_token_safe_result.txt', 'w', encoding='utf-8') as f:
    f.write(str(out))
print('Script finished, wrote result file scripts/add_verification_token_safe_result.txt')
