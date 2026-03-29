"""Add subscription_monthly_price to users table

Stores the actual Stripe-sourced monthly amount the dealer pays (after
discounts), updated on every subscription sync. Null means unknown/not yet
synced.

Revision ID: 024_subscription_monthly_price
Revises: 023_messages_soft_delete
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '024_subscription_monthly_price'
down_revision: Union[str, Sequence[str], None] = '023_messages_soft_delete'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("subscription_monthly_price", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "subscription_monthly_price")
