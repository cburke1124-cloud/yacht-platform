"""Add source column to guest_brokers

Revision ID: 031
Revises: 030
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa

revision = '031'
down_revision = '030_preview_listing_deal'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'guest_brokers',
        sa.Column('source', sa.String(), nullable=True, server_default='manual'),
    )


def downgrade():
    op.drop_column('guest_brokers', 'source')
