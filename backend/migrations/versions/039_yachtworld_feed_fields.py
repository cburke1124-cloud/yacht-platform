"""Create yachtworld_sync_jobs table for standalone YachtWorld / Boats Group API feed.

This replaces the earlier draft that added feed_type/api_key columns to scraper_jobs.
Those columns are dropped here if they exist; the YW feed runs as a completely
separate job type with its own table.

Revision ID: 039
Revises: 038
"""
revision = '039'
down_revision = '038'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Drop stale draft columns from scraper_jobs if they somehow exist
    scraper_cols = {c['name'] for c in inspector.get_columns('scraper_jobs')}
    if 'feed_type' in scraper_cols:
        op.drop_column('scraper_jobs', 'feed_type')
    if 'api_key' in scraper_cols:
        op.drop_column('scraper_jobs', 'api_key')

    # Create the standalone YachtWorld sync jobs table
    tables = inspector.get_table_names()
    if 'yachtworld_sync_jobs' not in tables:
        op.create_table(
            'yachtworld_sync_jobs',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('dealer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('salesman_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),

            sa.Column('site_name', sa.String(), nullable=True),
            sa.Column('api_endpoint', sa.String(), nullable=False),
            sa.Column('api_key', sa.String(), nullable=False),

            sa.Column('enabled', sa.Boolean(), default=True),
            sa.Column('status', sa.String(), default='idle'),

            sa.Column('schedule_hours', sa.Integer(), default=24),
            sa.Column('next_run_at', sa.DateTime(), nullable=True),
            sa.Column('last_run_at', sa.DateTime(), nullable=True),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),

            sa.Column('listings_found', sa.Integer(), default=0),
            sa.Column('listings_created', sa.Integer(), default=0),
            sa.Column('listings_updated', sa.Integer(), default=0),
            sa.Column('listings_removed', sa.Integer(), default=0),
            sa.Column('total_runs', sa.Integer(), default=0),

            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('last_run_log', sa.JSON(), nullable=True),

            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        )


def downgrade():
    op.drop_table('yachtworld_sync_jobs')
