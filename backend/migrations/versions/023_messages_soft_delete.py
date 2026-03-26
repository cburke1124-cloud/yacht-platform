"""Add soft-delete (deleted_at) to messages table

Revision ID: 023_messages_soft_delete
Revises: 022_messages_attachments
Create Date: 2026-03-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '023_messages_soft_delete'
down_revision: Union[str, Sequence[str], None] = '022_messages_attachments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'messages',
        sa.Column('deleted_at', sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('messages', 'deleted_at')
