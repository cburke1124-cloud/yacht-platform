"""011 - Add always_free flag to users

Revision ID: 011_always_free_flag
Revises: 010_custom_sub_price
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '011_always_free_flag'
down_revision = '010_custom_sub_price'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('always_free', sa.Boolean(), nullable=True))
        batch.create_index('ix_users_always_free', ['always_free'], unique=False)
    op.execute("UPDATE users SET always_free = FALSE WHERE always_free IS NULL")


def downgrade() -> None:
    with op.batch_alter_table('users') as batch:
        batch.drop_index('ix_users_always_free')
        batch.drop_column('always_free')
