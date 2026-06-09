"""Add charter availability and detail fields.

Revision ID: 043
Revises: 042
"""

revision = '043'
down_revision = '042'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def _existing_columns(inspector, table_name: str) -> set[str]:
    return {c['name'] for c in inspector.get_columns(table_name)}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'charter_listings' in existing_tables:
        cols = _existing_columns(inspector, 'charter_listings')
        add_cols = []
        if 'embarkation_ports' not in cols:
            add_cols.append(sa.Column('embarkation_ports', sa.JSON(), nullable=True))
        if 'disembarkation_ports' not in cols:
            add_cols.append(sa.Column('disembarkation_ports', sa.JSON(), nullable=True))
        if 'one_way_allowed' not in cols:
            add_cols.append(sa.Column('one_way_allowed', sa.Boolean(), nullable=True, server_default=sa.false()))
        if 'turnaround_days' not in cols:
            add_cols.append(sa.Column('turnaround_days', sa.Integer(), nullable=True))
        if 'apa_percentage' not in cols:
            add_cols.append(sa.Column('apa_percentage', sa.Float(), nullable=True))
        if 'security_deposit' not in cols:
            add_cols.append(sa.Column('security_deposit', sa.Float(), nullable=True))
        if 'tax_notes' not in cols:
            add_cols.append(sa.Column('tax_notes', sa.Text(), nullable=True))
        if 'cancellation_policy' not in cols:
            add_cols.append(sa.Column('cancellation_policy', sa.Text(), nullable=True))
        if 'included_items' not in cols:
            add_cols.append(sa.Column('included_items', sa.JSON(), nullable=True))
        if 'excluded_items' not in cols:
            add_cols.append(sa.Column('excluded_items', sa.JSON(), nullable=True))
        for col in add_cols:
            op.add_column('charter_listings', col)

    if 'charter_availability_blocks' not in existing_tables:
        op.create_table(
            'charter_availability_blocks',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('charter_id', sa.Integer(), sa.ForeignKey('charter_listings.id', ondelete='CASCADE'), nullable=False),
            sa.Column('start_date', sa.Date(), nullable=False),
            sa.Column('end_date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(), nullable=True, server_default='booked'),
            sa.Column('source', sa.String(), nullable=True, server_default='manual'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('external_ref', sa.String(), nullable=True),
            sa.Column('hold_expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_charter_availability_blocks_id', 'charter_availability_blocks', ['id'])
        op.create_index('ix_charter_availability_blocks_charter_id', 'charter_availability_blocks', ['charter_id'])
        op.create_index('ix_charter_availability_blocks_start_date', 'charter_availability_blocks', ['start_date'])
        op.create_index('ix_charter_availability_blocks_end_date', 'charter_availability_blocks', ['end_date'])
        op.create_index('ix_charter_availability_blocks_status', 'charter_availability_blocks', ['status'])

    if 'charter_seasonal_rates' not in existing_tables:
        op.create_table(
            'charter_seasonal_rates',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('charter_id', sa.Integer(), sa.ForeignKey('charter_listings.id', ondelete='CASCADE'), nullable=False),
            sa.Column('season_name', sa.String(), nullable=False),
            sa.Column('start_date', sa.Date(), nullable=True),
            sa.Column('end_date', sa.Date(), nullable=True),
            sa.Column('day_rate', sa.Float(), nullable=True),
            sa.Column('half_day_rate', sa.Float(), nullable=True),
            sa.Column('week_rate', sa.Float(), nullable=True),
            sa.Column('currency', sa.String(), nullable=True, server_default='USD'),
            sa.Column('min_charter_days', sa.Integer(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_charter_seasonal_rates_id', 'charter_seasonal_rates', ['id'])
        op.create_index('ix_charter_seasonal_rates_charter_id', 'charter_seasonal_rates', ['charter_id'])
        op.create_index('ix_charter_seasonal_rates_start_date', 'charter_seasonal_rates', ['start_date'])
        op.create_index('ix_charter_seasonal_rates_end_date', 'charter_seasonal_rates', ['end_date'])


def downgrade():
    op.drop_index('ix_charter_seasonal_rates_end_date', table_name='charter_seasonal_rates')
    op.drop_index('ix_charter_seasonal_rates_start_date', table_name='charter_seasonal_rates')
    op.drop_index('ix_charter_seasonal_rates_charter_id', table_name='charter_seasonal_rates')
    op.drop_index('ix_charter_seasonal_rates_id', table_name='charter_seasonal_rates')
    op.drop_table('charter_seasonal_rates')

    op.drop_index('ix_charter_availability_blocks_status', table_name='charter_availability_blocks')
    op.drop_index('ix_charter_availability_blocks_end_date', table_name='charter_availability_blocks')
    op.drop_index('ix_charter_availability_blocks_start_date', table_name='charter_availability_blocks')
    op.drop_index('ix_charter_availability_blocks_charter_id', table_name='charter_availability_blocks')
    op.drop_index('ix_charter_availability_blocks_id', table_name='charter_availability_blocks')
    op.drop_table('charter_availability_blocks')
