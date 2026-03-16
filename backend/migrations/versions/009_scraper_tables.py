"""Create scraper_jobs and scraped_listings tables

Revision ID: 009_scraper_tables
Revises: 007_add_cobrokering_enabled
"""
revision = '009_scraper_tables'
down_revision = '007_add_cobrokering_enabled'

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = inspector.get_table_names()

    if 'scraper_jobs' not in existing:
        op.create_table(
            'scraper_jobs',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('dealer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('salesman_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('site_name', sa.String(), nullable=True),
            sa.Column('broker_url', sa.String(), nullable=False),
            sa.Column('enabled', sa.Boolean(), server_default='true'),
            sa.Column('status', sa.String(), server_default='idle'),
            sa.Column('schedule_hours', sa.Integer(), server_default='24'),
            sa.Column('next_run_at', sa.DateTime(), nullable=True),
            sa.Column('last_run_at', sa.DateTime(), nullable=True),
            sa.Column('listings_found', sa.Integer(), server_default='0'),
            sa.Column('listings_created', sa.Integer(), server_default='0'),
            sa.Column('listings_updated', sa.Integer(), server_default='0'),
            sa.Column('listings_removed', sa.Integer(), server_default='0'),
            sa.Column('media_downloaded', sa.Integer(), server_default='0'),
            sa.Column('team_members_imported', sa.Integer(), server_default='0'),
            sa.Column('total_runs', sa.Integer(), server_default='0'),
            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()')),
        )

    if 'scraped_listings' not in existing:
        op.create_table(
            'scraped_listings',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('job_id', sa.Integer(), sa.ForeignKey('scraper_jobs.id'), nullable=True),
            sa.Column('listing_id', sa.Integer(), sa.ForeignKey('listings.id'), nullable=True),
            sa.Column('source_url', sa.String(), nullable=False),
            sa.Column('last_seen', sa.DateTime(), server_default=sa.text('NOW()')),
            sa.Column('still_active', sa.Boolean(), server_default='true'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()')),
        )


def downgrade():
    op.drop_table('scraped_listings')
    op.drop_table('scraper_jobs')
