"""Add coupon_id to partner_offers and make stripe_payment_link_url nullable

Revision ID: 028_partner_offer_coupon
Revises: 027_partner_offers
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "028_partner_offer_coupon"
down_revision = "027_partner_offers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "partner_offers",
        sa.Column("coupon_id", sa.String(64), nullable=True),
    )
    op.alter_column(
        "partner_offers",
        "stripe_payment_link_url",
        existing_type=sa.String(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "partner_offers",
        "stripe_payment_link_url",
        existing_type=sa.String(),
        nullable=False,
    )
    op.drop_column("partner_offers", "coupon_id")
