"""Align scraper_jobs table with current model

Adds missing columns and renames legacy columns:
  frequency       -> schedule_hours
  error_message   -> last_error
  + created_by_id, site_name, enabled, last_run_at, total_runs, notes

Revision ID: 019_scraper_jobs_schema_fix
Revises: 018_scraper_jobs_salesman_id
Create Date: 2026-03-21
"""
revision = '019_scraper_jobs_schema_fix'
down_revision = '018_scraper_jobs_salesman_id'

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c['name'] for c in inspector.get_columns('scraper_jobs')}

    # Rename legacy columns (only if old name still exists)
    if 'frequency' in cols and 'schedule_hours' not in cols:
        op.alter_column('scraper_jobs', 'frequency', new_column_name='schedule_hours')
        cols.discard('frequency')
        cols.add('schedule_hours')

    if 'error_message' in cols and 'last_error' not in cols:
        op.alter_column('scraper_jobs', 'error_message', new_column_name='last_error')
        cols.discard('error_message')
        cols.add('last_error')

    # Add missing columns
    if 'created_by_id' not in cols:
        op.add_column('scraper_jobs', sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))

    if 'site_name' not in cols:
        op.add_column('scraper_jobs', sa.Column('site_name', sa.String(), nullable=True))

    if 'enabled' not in cols:
        op.add_column('scraper_jobs', sa.Column('enabled', sa.Boolean(), server_default='true', nullable=False))

    if 'last_run_at' not in cols:
        op.add_column('scraper_jobs', sa.Column('last_run_at', sa.DateTime(), nullable=True))

    if 'total_runs' not in cols:
        op.add_column('scraper_jobs', sa.Column('total_runs', sa.Integer(), server_default='0', nullable=False))

    if 'notes' not in cols:
        op.add_column('scraper_jobs', sa.Column('notes', sa.Text(), nullable=True))

    if 'last_error' not in cols:
        op.add_column('scraper_jobs', sa.Column('last_error', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('scraper_jobs', 'notes')
    op.drop_column('scraper_jobs', 'total_runs')
    op.drop_column('scraper_jobs', 'last_run_at')
    op.drop_column('scraper_jobs', 'enabled')
    op.drop_column('scraper_jobs', 'site_name')
    op.drop_column('scraper_jobs', 'created_by_id')
    op.alter_column('scraper_jobs', 'last_error', new_column_name='error_message')
    op.alter_column('scraper_jobs', 'schedule_hours', new_column_name='frequency')
