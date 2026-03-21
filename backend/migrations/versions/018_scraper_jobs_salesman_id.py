"""Add salesman_id column to scraper_jobs table

Revision ID: 018_scraper_jobs_salesman_id
Revises: 017_salesman_social_links
Create Date: 2026-03-20
"""
revision = '018_scraper_jobs_salesman_id'
down_revision = '017_salesman_social_links'

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c['name'] for c in inspector.get_columns('scraper_jobs')]

    if 'salesman_id' not in columns:
        op.add_column(
            'scraper_jobs',
            sa.Column('salesman_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        )


def downgrade():
    op.drop_column('scraper_jobs', 'salesman_id')
