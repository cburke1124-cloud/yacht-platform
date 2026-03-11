"""005 - Demo account support for sales team

Adds: is_demo, demo_owner_sales_rep_id columns to users table
Allows sales reps to have dedicated demo dealer accounts for showcasing features
"""

revision = '005_demo_account_support'
down_revision = '004_soft_delete_users'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    conn = op.get_bind()

    # Check if columns already exist (SQLite and Postgres compatible)
    existing = set()
    try:
        # Try Postgres first
        rows = conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'users'"
            )
        ).fetchall()
        existing = {r[0] for r in rows}
    except Exception:
        # SQLite fallback
        try:
            rows = conn.execute(sa.text("PRAGMA table_info(users)")).fetchall()
            existing = {r[1] for r in rows}
        except Exception:
            pass

    # Add is_demo column if not present
    if "is_demo" not in existing:
        conn.execute(
            sa.text("ALTER TABLE users ADD COLUMN is_demo BOOLEAN DEFAULT FALSE")
        )

    # Add demo_owner_sales_rep_id column if not present
    if "demo_owner_sales_rep_id" not in existing:
        conn.execute(
            sa.text(
                "ALTER TABLE users ADD COLUMN demo_owner_sales_rep_id "
                "INTEGER REFERENCES users(id) ON DELETE SET NULL"
            )
        )

    # Create index on is_demo for efficient filtering
    try:
        conn.execute(
            sa.text("CREATE INDEX IF NOT EXISTS ix_users_is_demo ON users(is_demo)")
        )
    except Exception:
        pass

    # Create index on demo_owner_sales_rep_id for efficient lookups
    try:
        conn.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_users_demo_owner_sales_rep_id "
                "ON users(demo_owner_sales_rep_id)"
            )
        )
    except Exception:
        pass


def downgrade():
    conn = op.get_bind()

    # Drop columns
    try:
        conn.execute(sa.text("ALTER TABLE users DROP COLUMN is_demo"))
    except Exception:
        pass

    try:
        conn.execute(sa.text("ALTER TABLE users DROP COLUMN demo_owner_sales_rep_id"))
    except Exception:
        pass

    # Drop indexes
    try:
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_is_demo"))
    except Exception:
        pass

    try:
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_demo_owner_sales_rep_id"))
    except Exception:
        pass
