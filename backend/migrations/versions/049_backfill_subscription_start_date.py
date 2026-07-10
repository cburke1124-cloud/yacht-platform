"""Backfill subscription_start_date for pre-existing Stripe-paid accounts.

subscription_start_date (added in 044) is now used to gate "have you
actually paid" checks (commission calculations, the billing page, the
dashboard payment banner) — it's only ever set going forward by the
Stripe webhook / session-confirm flow. Accounts that paid before 044
existed, or before this gating went live, never got it backfilled, so
they'd incorrectly show as unpaid.

This is a narrow, conservative backfill: only touches users who are on a
paid subscription_tier AND have a stripe_customer_id on file (proof they
actually went through Stripe checkout at some point — accounts manually
created by a sales rep/admin never get a stripe_customer_id at all, so
they're correctly left untouched). Uses created_at as a best-effort
stand-in for the real payment date, since the real date isn't recorded
anywhere for these older rows.

Revision ID: 049
Revises: 048
"""

revision = '049'
down_revision = '048'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


PAID_TIERS = (
    'basic', 'plus', 'pro', 'premium',
    'private_basic', 'private_plus', 'private_pro',
)


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('users')]
    if 'subscription_start_date' not in cols or 'stripe_customer_id' not in cols:
        return

    tiers_sql = ", ".join(f"'{t}'" for t in PAID_TIERS)
    op.execute(f"""
        UPDATE users
        SET subscription_start_date = created_at
        WHERE subscription_start_date IS NULL
          AND stripe_customer_id IS NOT NULL
          AND subscription_tier IN ({tiers_sql})
    """)


def downgrade():
    # Backfill is best-effort and not reversible to a known prior state.
    pass
