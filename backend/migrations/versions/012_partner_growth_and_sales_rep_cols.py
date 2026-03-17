"""012 - Partner growth tables + sales-rep columns on users

Adds:
  Tables : affiliate_accounts, partner_deals, referral_signups
  Columns: users.assigned_sales_rep_id  (FK → users.id)
           users.verification_token     (String, unique)
           users.commission_rate        (Float, default 10.0)

All DDL uses IF NOT EXISTS / column-existence checks so it is safe to
run on a database that was bootstrapped with create_all() and already
has some or all of these objects.
"""

revision = "012_partner_growth_and_sales_rep_cols"
down_revision = "011_always_free_flag"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def _existing_columns(conn, table: str) -> set:
    rows = conn.execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = :t"
        ),
        {"t": table},
    ).fetchall()
    return {r[0] for r in rows}


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

    # ── affiliate_accounts ────────────────────────────────────────────────────
    if not _table_exists(conn, "affiliate_accounts"):
        conn.execute(sa.text("""
            CREATE TABLE affiliate_accounts (
                id               SERIAL PRIMARY KEY,
                name             VARCHAR NOT NULL,
                email            VARCHAR,
                code             VARCHAR(64) UNIQUE NOT NULL,
                account_type     VARCHAR(32) NOT NULL DEFAULT 'affiliate',
                user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
                commission_rate  DOUBLE PRECISION DEFAULT 10.0,
                active           BOOLEAN DEFAULT TRUE,
                created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at       TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_affiliate_accounts_email "
            "ON affiliate_accounts(email)"
        ))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_affiliate_accounts_code "
            "ON affiliate_accounts(code)"
        ))

    # ── partner_deals ─────────────────────────────────────────────────────────
    if not _table_exists(conn, "partner_deals"):
        conn.execute(sa.text("""
            CREATE TABLE partner_deals (
                id                    SERIAL PRIMARY KEY,
                name                  VARCHAR NOT NULL,
                code                  VARCHAR(64) UNIQUE NOT NULL,
                created_by            INTEGER NOT NULL REFERENCES users(id),
                owner_sales_rep_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
                affiliate_account_id  INTEGER REFERENCES affiliate_accounts(id) ON DELETE SET NULL,
                target_email          VARCHAR,
                free_days             INTEGER DEFAULT 0,
                discount_type         VARCHAR(32),
                discount_value        DOUBLE PRECISION,
                fixed_monthly_price   DOUBLE PRECISION,
                term_months           INTEGER,
                lifetime              BOOLEAN DEFAULT FALSE,
                notes                 TEXT,
                active                BOOLEAN DEFAULT TRUE,
                start_date            TIMESTAMP DEFAULT NOW(),
                end_date              TIMESTAMP,
                created_at            TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_partner_deals_code ON partner_deals(code)"
        ))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_partner_deals_target_email "
            "ON partner_deals(target_email)"
        ))

    # ── referral_signups ──────────────────────────────────────────────────────
    if not _table_exists(conn, "referral_signups"):
        conn.execute(sa.text("""
            CREATE TABLE referral_signups (
                id                    SERIAL PRIMARY KEY,
                dealer_user_id        INTEGER NOT NULL REFERENCES users(id),
                source_type           VARCHAR(32) NOT NULL,
                sales_rep_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
                affiliate_account_id  INTEGER REFERENCES affiliate_accounts(id) ON DELETE SET NULL,
                deal_id               INTEGER REFERENCES partner_deals(id) ON DELETE SET NULL,
                referral_code_used    VARCHAR(64),
                effective_monthly_price DOUBLE PRECISION,
                commission_rate       DOUBLE PRECISION DEFAULT 10.0,
                created_at            TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_referral_signups_dealer_user_id "
            "ON referral_signups(dealer_user_id)"
        ))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_referral_signups_sales_rep_id "
            "ON referral_signups(sales_rep_id)"
        ))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_referral_signups_affiliate_account_id "
            "ON referral_signups(affiliate_account_id)"
        ))

    # ── users: assigned_sales_rep_id ──────────────────────────────────────────
    existing_user_cols = _existing_columns(conn, "users")

    if "assigned_sales_rep_id" not in existing_user_cols:
        conn.execute(sa.text(
            "ALTER TABLE users ADD COLUMN assigned_sales_rep_id "
            "INTEGER REFERENCES users(id) ON DELETE SET NULL"
        ))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_users_assigned_sales_rep_id "
            "ON users(assigned_sales_rep_id)"
        ))

    # ── users: verification_token ─────────────────────────────────────────────
    if "verification_token" not in existing_user_cols:
        conn.execute(sa.text(
            "ALTER TABLE users ADD COLUMN verification_token VARCHAR"
        ))
        conn.execute(sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_verification_token "
            "ON users(verification_token) WHERE verification_token IS NOT NULL"
        ))

    # ── users: commission_rate ────────────────────────────────────────────────
    if "commission_rate" not in existing_user_cols:
        conn.execute(sa.text(
            "ALTER TABLE users ADD COLUMN commission_rate "
            "DOUBLE PRECISION DEFAULT 10.0"
        ))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS referral_signups"))
    conn.execute(sa.text("DROP TABLE IF EXISTS partner_deals"))
    conn.execute(sa.text("DROP TABLE IF EXISTS affiliate_accounts"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS assigned_sales_rep_id"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS verification_token"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS commission_rate"))
