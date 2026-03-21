"""Add social_links JSON column to users table

Revision ID: 017_salesman_social_links
Revises: 016_message_external_sender
Create Date: 2026-03-20
"""
revision = '017_salesman_social_links'
down_revision = '016_message_external_sender'

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('users')]
    if 'social_links' not in cols:
        op.add_column('users', sa.Column('social_links', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('users', 'social_links')
