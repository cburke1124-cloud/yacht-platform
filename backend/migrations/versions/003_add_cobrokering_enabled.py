"""Add cobrokering_enabled column to dealer_profiles

Revision ID: 003_add_cobrokering_enabled
Revises: 002_inquiry_leads_expansion
"""
revision = '003_add_cobrokering_enabled'
down_revision = '002_inquiry_leads_expansion'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dealer_profiles', sa.Column('cobrokering_enabled', sa.Boolean(), server_default='true', nullable=True))


def downgrade():
    op.drop_column('dealer_profiles', 'cobrokering_enabled')
