"""add show_team_on_profile to dealer_profiles

Revision ID: 020_dealer_show_team_on_profile
Revises: 019_scraper_jobs_schema_fix
Create Date: 2026-03-23

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "020_dealer_show_team_on_profile"
down_revision: Union[str, Sequence[str]] = "019_scraper_jobs_schema_fix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dealer_profiles",
        sa.Column("show_team_on_profile", sa.Boolean(), nullable=True, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("dealer_profiles", "show_team_on_profile")
