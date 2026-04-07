"""Add preview_listing_id to partner_deals

Revision ID: 030_preview_listing_deal
Revises: 029_preview_listings
"""

revision = "030_preview_listing_deal"
down_revision = "029_preview_listings"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        "partner_deals",
        sa.Column("preview_listing_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_partner_deals_preview_listing_id",
        "partner_deals",
        "preview_listings",
        ["preview_listing_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_partner_deals_preview_listing_id", "partner_deals", type_="foreignkey")
    op.drop_column("partner_deals", "preview_listing_id")
