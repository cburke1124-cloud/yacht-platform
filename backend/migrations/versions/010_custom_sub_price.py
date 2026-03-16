"""add custom_subscription_price to users"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "010_custom_sub_price"
down_revision = "009_scraper_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("custom_subscription_price", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "custom_subscription_price")
