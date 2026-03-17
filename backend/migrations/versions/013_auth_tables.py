"""013 - Auth support tables

Adds:
  Tables : password_resets, email_verifications,
           two_factor_auth, two_factor_codes

These are required by the forgot-password, email-verification, and
2FA flows.  All DDL uses IF NOT EXISTS so it is safe on databases that
already have these tables (e.g. bootstrapped via create_all()).
"""

revision = "013_auth_tables"
down_revision = "012_partner_growth"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :t"
        ),
        {"t": table},
    ).fetchone()
    return row is not None


def upgrade():
    conn = op.get_bind()

    # ── password_resets ───────────────────────────────────────────────────────
    if not _table_exists(conn, "password_resets"):
        conn.execute(sa.text("""
            CREATE TABLE password_resets (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token       VARCHAR UNIQUE NOT NULL,
                expires_at  TIMESTAMP NOT NULL,
                used        BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_password_resets_token "
            "ON password_resets(token)"
        ))

    # ── email_verifications ───────────────────────────────────────────────────
    if not _table_exists(conn, "email_verifications"):
        conn.execute(sa.text("""
            CREATE TABLE email_verifications (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token       VARCHAR UNIQUE NOT NULL,
                expires_at  TIMESTAMP NOT NULL,
                verified    BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_email_verifications_token "
            "ON email_verifications(token)"
        ))

    # ── two_factor_auth ───────────────────────────────────────────────────────
    if not _table_exists(conn, "two_factor_auth"):
        conn.execute(sa.text("""
            CREATE TABLE two_factor_auth (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                secret      VARCHAR,
                backup_codes JSONB,
                enabled     BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        """))

    # ── two_factor_codes ──────────────────────────────────────────────────────
    if not _table_exists(conn, "two_factor_codes"):
        conn.execute(sa.text("""
            CREATE TABLE two_factor_codes (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code        VARCHAR NOT NULL,
                expires_at  TIMESTAMP NOT NULL,
                used        BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        """))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS two_factor_codes"))
    conn.execute(sa.text("DROP TABLE IF EXISTS two_factor_auth"))
    conn.execute(sa.text("DROP TABLE IF EXISTS email_verifications"))
    conn.execute(sa.text("DROP TABLE IF EXISTS password_resets"))
