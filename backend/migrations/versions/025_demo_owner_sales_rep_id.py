"""Add demo_owner_sales_rep_id to users table

Revision ID: 025_demo_owner_sales_rep_id
Revises: 024_subscription_monthly_price
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '025_demo_owner_sales_rep_id'
down_revision: Union[str, Sequence[str], None] = '024_subscription_monthly_price'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("demo_owner_sales_rep_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_demo_owner_sales_rep_id",
        "users", "users",
        ["demo_owner_sales_rep_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_demo_owner_sales_rep_id", "users", type_="foreignkey")
    op.drop_column("users", "demo_owner_sales_rep_id")
