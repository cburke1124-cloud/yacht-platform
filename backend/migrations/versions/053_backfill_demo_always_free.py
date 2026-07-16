"""Backfill always_free for pre-existing demo accounts.

Demo accounts (is_demo=True) never go through Stripe, but
create_demo_account_for_owner() previously left always_free unset. The
dashboard's payment banner and the billing_status.user_has_paid() gate both
key off always_free/subscription_start_date, not subscription_tier text, so
every demo account created before this fix incorrectly showed the "payment
required" banner and paywalled Billing tab. New demo accounts are now
created with always_free=True (see demo_fixtures.py); this backfills the
accounts that already exist.

Revision ID: 053
Revises: 052
"""

revision = '053'
down_revision = '052'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('users')]
    if 'is_demo' not in cols or 'always_free' not in cols:
        return

    op.execute("""
        UPDATE users
        SET always_free = true
        WHERE is_demo = true
          AND always_free IS NOT true
    """)


def downgrade():
    # Backfill is best-effort and not reversible to a known prior state.
    pass
