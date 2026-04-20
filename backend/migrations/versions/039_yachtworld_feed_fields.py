"""Add feed_type and api_key columns to scraper_jobs.

Supports two feed modes on a ScraperJob:
  feed_type = NULL / "html"     — existing HTML scraper behaviour (default)
  feed_type = "yachtworld_api"  — pulls from the Boats Group / YachtWorld REST API

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
    cols = {c['name'] for c in inspector.get_columns('scraper_jobs')}

    if 'feed_type' not in cols:
        op.add_column('scraper_jobs', sa.Column('feed_type', sa.String(), nullable=True))
    if 'api_key' not in cols:
        op.add_column('scraper_jobs', sa.Column('api_key', sa.String(), nullable=True))


def downgrade():
    op.drop_column('scraper_jobs', 'api_key')
    op.drop_column('scraper_jobs', 'feed_type')
