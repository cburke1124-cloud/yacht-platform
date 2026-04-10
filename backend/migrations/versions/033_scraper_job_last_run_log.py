"""Add last_run_log column to scraper_jobs

Revision ID: 033_scraper_job_last_run_log
Revises: 032_scraper_job_site_template
Create Date: 2026-04-09
"""

revision = '033_scraper_job_last_run_log'
down_revision = '032_scraper_job_site_template'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    inspector = sa.inspect(op.get_bind())
    cols = {c['name'] for c in inspector.get_columns('scraper_jobs')}
    if 'last_run_log' not in cols:
        op.add_column('scraper_jobs', sa.Column('last_run_log', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('scraper_jobs', 'last_run_log')
