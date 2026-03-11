"""004 - Soft delete support for user accounts with 60-90 day recovery window

Adds: deleted_at, recovery_deadline columns to users table
Removes: unique constraint on email (will enforce at app level with index)
Creates: Unique index on (email, deleted_at) to allow deleted emails to be reused
"""

revision = '004_soft_delete_users'
down_revision = '003_webhook_integration'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    conn = op.get_bind()

    # ── users: add soft delete columns (PostgreSQL-safe) ──────────────────────
    rows = conn.execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'users'"
        )
    ).fetchall()
    existing = {r[0] for r in rows}

    if "deleted_at" not in existing:
        conn.execute(
            sa.text("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL")
        )

    if "recovery_deadline" not in existing:
        conn.execute(
            sa.text("ALTER TABLE users ADD COLUMN recovery_deadline TIMESTAMP NULL")
        )

    # ── Remove old unique constraint on email (if exists) ────────────────────
    # Check if constraint exists before trying to drop it
    constraint_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_name = 'users' AND constraint_name = 'users_email_key' LIMIT 1"
        )
    ).fetchone()
    if constraint_exists:
        conn.execute(
            sa.text("ALTER TABLE users DROP CONSTRAINT users_email_key")
        )

    # ── Create indexes ────────────────────────────────────────────────────────
    conn.execute(
        sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email_active ON users(email) WHERE deleted_at IS NULL")
    )
    conn.execute(
        sa.text("CREATE INDEX IF NOT EXISTS ix_users_deleted_at ON users(deleted_at)")
    )


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS deleted_at"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS recovery_deadline"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_email_active"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_deleted_at"))
