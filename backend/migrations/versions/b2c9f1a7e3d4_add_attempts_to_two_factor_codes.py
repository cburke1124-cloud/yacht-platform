"""add attempts column to two_factor_codes

Revision ID: b2c9f1a7e3d4
Revises: faa436eff634
Create Date: 2026-07-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c9f1a7e3d4'
down_revision: Union[str, Sequence[str], None] = 'faa436eff634'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'two_factor_codes',
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('two_factor_codes', 'attempts')
