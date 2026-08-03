"""add show_financing_calculator column to listings

Revision ID: 055
Revises: 054
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '055'
down_revision: Union[str, Sequence[str], None] = '054'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('show_financing_calculator', sa.Boolean(), server_default='true', nullable=True))


def downgrade() -> None:
    op.drop_column('listings', 'show_financing_calculator')
