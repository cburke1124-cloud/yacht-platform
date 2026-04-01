"""Add partner_offers table for pre-created Stripe Payment Link offers

Revision ID: 027_partner_offers
Revises: 026_listing_soft_delete
Create Date: 2026-04-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "027_partner_offers"
down_revision: Union[str, None] = "026_listing_soft_delete"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "partner_offers",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("terms_summary", sa.String, nullable=True),
        sa.Column("stripe_payment_link_url", sa.String, nullable=False),
        sa.Column("tier", sa.String(32), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("partner_offers")
