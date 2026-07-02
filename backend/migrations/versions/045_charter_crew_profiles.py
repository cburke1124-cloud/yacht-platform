"""Add optional crew_profiles field to charter listings.

Revision ID: 045
Revises: 044
"""

revision = '045'
down_revision = '044'
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
        if 'crew_profiles' not in cols:
            op.add_column('charter_listings', sa.Column('crew_profiles', sa.JSON(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'charter_listings' in inspector.get_table_names():
        cols = _existing_columns(inspector, 'charter_listings')
        if 'crew_profiles' in cols:
            op.drop_column('charter_listings', 'crew_profiles')
