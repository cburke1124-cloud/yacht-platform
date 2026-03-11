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

    # ── users: add demo columns (PostgreSQL-safe) ─────────────────────────────
    rows = conn.execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'users'"
        )
    ).fetchall()
    existing = {r[0] for r in rows}

    if "is_demo" not in existing:
        conn.execute(
            sa.text("ALTER TABLE users ADD COLUMN is_demo BOOLEAN DEFAULT FALSE")
        )

    if "demo_owner_sales_rep_id" not in existing:
        conn.execute(
            sa.text(
                "ALTER TABLE users ADD COLUMN demo_owner_sales_rep_id "
                "INTEGER REFERENCES users(id) ON DELETE SET NULL"
            )
        )

    # ── Create indexes ────────────────────────────────────────────────────────
    conn.execute(
        sa.text("CREATE INDEX IF NOT EXISTS ix_users_is_demo ON users(is_demo)")
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_users_demo_owner_sales_rep_id "
            "ON users(demo_owner_sales_rep_id)"
        )
    )


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS is_demo"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS demo_owner_sales_rep_id"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_is_demo"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_demo_owner_sales_rep_id"))
