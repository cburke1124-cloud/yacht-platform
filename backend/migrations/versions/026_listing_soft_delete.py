"""Add deleted_at soft-delete column to listings

Revision ID: 026_listing_soft_delete
Revises: 025_demo_owner_sales_rep_id
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '026_listing_soft_delete'
down_revision: Union[str, Sequence[str], None] = '025_demo_owner_sales_rep_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("listings")]
    if "deleted_at" not in existing_columns:
        op.add_column("listings", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("listings", "deleted_at")
