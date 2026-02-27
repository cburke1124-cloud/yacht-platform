import os
import subprocess
from datetime import datetime
from sqlalchemy import create_engine, text

# Load DATABASE_URL from environment (same as main.py)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin123@localhost:5432/yacht_db")
print("Using DATABASE_URL:", DATABASE_URL)

# 1) Attempt pg_dump backup
backup_file = None
try:
    pg_dump_path = subprocess.run(["where", "pg_dump"], capture_output=True, text=True)
    if pg_dump_path.returncode == 0:
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_dir = os.path.join(os.getcwd(), "db_backups")
        os.makedirs(backup_dir, exist_ok=True)
        backup_file = os.path.join(backup_dir, f"yacht_db_backup_{ts}.dump")
        print("pg_dump found, creating backup to", backup_file)
        # pg_dump requires connection params; parse DATABASE_URL for host/user/db
        # We'll call pg_dump using the DATABASE_URL directly via the --dbname flag
        cmd = ["pg_dump", "--dbname", DATABASE_URL, "-Fc", "-f", backup_file]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print("pg_dump failed:", result.stderr)
            backup_file = None
        else:
            print("Backup created:", backup_file)
    else:
        print("pg_dump not found in PATH; skipping backup.")
except Exception as e:
    print("Backup step skipped due to error:", e)

# 2) Run ALTER TABLE and index creation via SQLAlchemy
engine = create_engine(DATABASE_URL)
sqls = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_users_verification_token ON users (verification_token)",
    # Populate existing rows with a token if NULL (optional)
    "UPDATE users SET verification_token = md5(random()::text || clock_timestamp()::text) WHERE verification_token IS NULL",
]

with engine.begin() as conn:
    for s in sqls:
        print("Executing:", s)
        conn.execute(text(s))

print("Done. Verify the column and index exist with: SELECT column_name FROM information_schema.columns WHERE table_name='users';")
if backup_file:
    print("Backup available at:", backup_file)
else:
    print("No backup was created.")
