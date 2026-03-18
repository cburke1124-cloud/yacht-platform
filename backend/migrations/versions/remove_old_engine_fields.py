"""Remove old single-engine fields from listings

Revision ID: remove_old_engine_fields
Revises: 013_auth_tables
Create Date: 2026-03-18 14:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_old_engine_fields'
down_revision: Union[str, Sequence[str], None] = '013_auth_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('listings', 'engine_make')
    op.drop_column('listings', 'engine_model')
    op.drop_column('listings', 'engine_type')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('listings', sa.Column('engine_type', sa.String(), nullable=True))
    op.add_column('listings', sa.Column('engine_model', sa.String(), nullable=True))
    op.add_column('listings', sa.Column('engine_make', sa.String(), nullable=True))
