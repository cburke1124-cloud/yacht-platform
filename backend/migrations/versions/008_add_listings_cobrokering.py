"""Add allow_cobrokering column to listings

Revision ID: 008_add_listings_cobrokering
Revises: 007_add_cobrokering_enabled
"""
revision = '008_add_listings_cobrokering'
down_revision = '007_add_cobrokering_enabled'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('listings', sa.Column('allow_cobrokering', sa.Boolean(), server_default='true', nullable=True))


def downgrade():
    op.drop_column('listings', 'allow_cobrokering')
