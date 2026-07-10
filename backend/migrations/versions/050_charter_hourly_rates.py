"""Add charter_hourly_rates table.

Revision ID: 050
Revises: 049
"""

revision = '050'
down_revision = '049'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'charter_hourly_rates' not in existing_tables:
        op.create_table(
            'charter_hourly_rates',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('charter_id', sa.Integer(), sa.ForeignKey('charter_listings.id', ondelete='CASCADE'), nullable=False),
            sa.Column('hours', sa.Integer(), nullable=False),
            sa.Column('price', sa.Float(), nullable=False),
            sa.Column('label', sa.String(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_charter_hourly_rates_id', 'charter_hourly_rates', ['id'])
        op.create_index('ix_charter_hourly_rates_charter_id', 'charter_hourly_rates', ['charter_id'])
        op.create_index('ix_charter_hourly_rates_hours', 'charter_hourly_rates', ['hours'])


def downgrade():
    op.drop_index('ix_charter_hourly_rates_hours', table_name='charter_hourly_rates')
    op.drop_index('ix_charter_hourly_rates_charter_id', table_name='charter_hourly_rates')
    op.drop_index('ix_charter_hourly_rates_id', table_name='charter_hourly_rates')
    op.drop_table('charter_hourly_rates')
