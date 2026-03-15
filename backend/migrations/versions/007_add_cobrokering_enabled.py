"""Add cobrokering columns to dealer_profiles and listings

Revision ID: 007_add_cobrokering_enabled
Revises: 006_documentation_system
"""
revision = '007_add_cobrokering_enabled'
down_revision = '006_documentation_system'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dealer_profiles', sa.Column('cobrokering_enabled', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('listings', sa.Column('allow_cobrokering', sa.Boolean(), server_default='true', nullable=True))


def downgrade():
    op.drop_column('listings', 'allow_cobrokering')
    op.drop_column('dealer_profiles', 'cobrokering_enabled')
