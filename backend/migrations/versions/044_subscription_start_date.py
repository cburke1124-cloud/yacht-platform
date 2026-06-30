"""Add subscription_start_date to users table.

Revision ID: 044
Revises: 043
"""
revision = '044'
down_revision = '043'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('users')]
    if 'subscription_start_date' not in cols:
        op.add_column('users', sa.Column('subscription_start_date', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('users', 'subscription_start_date')
