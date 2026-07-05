"""add alt_text column to listing_images

Revision ID: a4f3c9e2d716
Revises: 378bb639b229
Create Date: 2026-07-05 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a4f3c9e2d716'
down_revision: Union[str, Sequence[str], None] = '378bb639b229'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listing_images', sa.Column('alt_text', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('listing_images', 'alt_text')
