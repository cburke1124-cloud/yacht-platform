"""Add site_template JSON column to scraper_jobs

Revision ID: 032_scraper_job_site_template
Revises: 031_guest_broker_source
Create Date: 2026-04-08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '032_scraper_job_site_template'
down_revision = '031'
branch_labels = None
depends_on = None


def upgrade():
    inspector = inspect(op.get_bind())
    cols = {c['name'] for c in inspector.get_columns('scraper_jobs')}
    if 'site_template' not in cols:
        op.add_column('scraper_jobs', sa.Column('site_template', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('scraper_jobs', 'site_template')
