"""Add attachments column to messages table

Revision ID: 022_messages_attachments
Revises: 021_guest_brokers
Create Date: 2026-03-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '022_messages_attachments'
down_revision: Union[str, Sequence[str], None] = '021_guest_brokers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'messages',
        sa.Column('attachments', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('messages', 'attachments')
