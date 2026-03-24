"""add guest_brokers table and guest_salesman_id on listings

Revision ID: 021_guest_brokers
Revises: 020_dealer_show_team_on_profile
Create Date: 2026-03-23

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "021_guest_brokers"
down_revision: Union[str, Sequence[str]] = "020_dealer_show_team_on_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "guest_brokers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dealer_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.String(), nullable=True),
        sa.Column("social_links", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["dealer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_guest_brokers_id", "guest_brokers", ["id"])
    op.create_index("ix_guest_brokers_dealer_id", "guest_brokers", ["dealer_id"])

    op.add_column(
        "listings",
        sa.Column("guest_salesman_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_listings_guest_salesman_id",
        "listings", "guest_brokers",
        ["guest_salesman_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_listings_guest_salesman_id", "listings", type_="foreignkey")
    op.drop_column("listings", "guest_salesman_id")
    op.drop_index("ix_guest_brokers_dealer_id", table_name="guest_brokers")
    op.drop_index("ix_guest_brokers_id", table_name="guest_brokers")
    op.drop_table("guest_brokers")
