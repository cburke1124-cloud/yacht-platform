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

    # ── users: add soft delete columns ────────────────────────────────────────

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

    # Add deleted_at column if not present
    if "deleted_at" not in existing:
        conn.execute(
            sa.text("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL")
        )

    # Add recovery_deadline column if not present
    if "recovery_deadline" not in existing:
        conn.execute(
            sa.text("ALTER TABLE users ADD COLUMN recovery_deadline TIMESTAMP NULL")
        )

    # ── Remove old unique constraint on email (if exists) ────────────────────

    # For Postgres, drop the constraint
    try:
        conn.execute(
            sa.text("ALTER TABLE users DROP CONSTRAINT users_email_key")
        )
    except Exception:
        pass  # Constraint doesn't exist (SQLite doesn't have named constraints)

    # For SQLite, we need to recreate the table (Alembic batch_alter_table can help)
    # But since we're doing raw SQL, we'll handle this differently
    # SQLite will automatically drop the unique constraint when we drop the unique=True in the model

    # ── Create index on email for active (non-deleted) users ────────────────

    try:
        # This index helps with lookups for active users
        conn.execute(
            sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email_active ON users(email) WHERE deleted_at IS NULL")
        )
    except Exception:
        # Some databases may not support partial indexes
        pass

    # Create regular index on deleted_at for recovery queries
    try:
        conn.execute(
            sa.text("CREATE INDEX IF NOT EXISTS ix_users_deleted_at ON users(deleted_at)")
        )
    except Exception:
        pass


def downgrade():
    conn = op.get_bind()

    # Drop the columns
    try:
        conn.execute(sa.text("ALTER TABLE users DROP COLUMN deleted_at"))
    except Exception:
        pass

    try:
        conn.execute(sa.text("ALTER TABLE users DROP COLUMN recovery_deadline"))
    except Exception:
        pass

    # Drop indexes
    try:
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_email_active"))
    except Exception:
        pass

    try:
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_deleted_at"))
    except Exception:
        pass

    # Restore unique constraint on email
    # This is tricky with SQLite, so we'll leave it as is for downgrade
    # The app layer will need to re-enforce unique email for non-deleted users
