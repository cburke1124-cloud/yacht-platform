"""add plugin_licenses and plugin_license_activations tables

Revision ID: f2c7a1d94b8e
Revises: a4f3c9e2d716
Create Date: 2026-07-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f2c7a1d94b8e'
down_revision: Union[str, Sequence[str], None] = 'a4f3c9e2d716'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOTE: the original version of this migration declared id columns with
    # index=True (which makes create_table auto-create ix_<table>_id) and then
    # ALSO called op.create_index for the same name — CREATE INDEX failed with
    # DuplicateTable on every deploy, rolling the migration back and blocking
    # everything queued after it. All operations are now inspector-guarded.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'plugin_licenses' not in tables:
        op.create_table(
            'plugin_licenses',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('dealer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('license_key_hash', sa.String(), nullable=False),
            sa.Column('license_key_prefix', sa.String(length=12), nullable=False),
            sa.Column('plan', sa.String(length=50), server_default='standard'),
            sa.Column('max_sites', sa.Integer(), server_default='1'),
            sa.Column('status', sa.String(length=50), server_default='active'),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
    lic_indexes = {ix['name'] for ix in inspector.get_indexes('plugin_licenses')} if 'plugin_licenses' in tables else set()
    if 'ix_plugin_licenses_license_key_hash' not in lic_indexes:
        op.create_index('ix_plugin_licenses_license_key_hash', 'plugin_licenses', ['license_key_hash'], unique=True)

    if 'plugin_license_activations' not in tables:
        op.create_table(
            'plugin_license_activations',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('license_id', sa.Integer(), sa.ForeignKey('plugin_licenses.id'), nullable=False),
            sa.Column('site_url', sa.String(length=500), nullable=False),
            sa.Column('plugin_version', sa.String(length=20), nullable=True),
            sa.Column('activated_at', sa.DateTime(), nullable=True),
            sa.Column('last_check_in', sa.DateTime(), nullable=True),
            sa.Column('deactivated_at', sa.DateTime(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
        )
    act_indexes = {ix['name'] for ix in inspector.get_indexes('plugin_license_activations')} if 'plugin_license_activations' in tables else set()
    if 'ix_plugin_license_activations_site_url' not in act_indexes:
        op.create_index('ix_plugin_license_activations_site_url', 'plugin_license_activations', ['site_url'])


def downgrade() -> None:
    op.drop_table('plugin_license_activations')
    op.drop_table('plugin_licenses')
