"""merge divergent heads: 014_inquiry_lead_fields and remove_old_engine_fields

Revision ID: 015_merge_heads
Revises: 014_inquiry_lead_fields, remove_old_engine_fields
Create Date: 2026-03-19

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "015_merge_heads"
down_revision: Union[str, Sequence[str]] = (
    "014_inquiry_lead_fields",
    "remove_old_engine_fields",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
