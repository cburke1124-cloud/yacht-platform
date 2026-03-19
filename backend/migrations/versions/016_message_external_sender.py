"""add external_sender_email to messages table

Revision ID: 016_message_external_sender
Revises: 015_merge_heads
Create Date: 2026-03-19

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "016_message_external_sender"
down_revision: Union[str, Sequence[str]] = "015_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("external_sender_email", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "external_sender_email")
