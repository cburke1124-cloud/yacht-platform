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
    op.create_index('ix_plugin_licenses_license_key_hash', 'plugin_licenses', ['license_key_hash'], unique=True)
    op.create_index('ix_plugin_licenses_id', 'plugin_licenses', ['id'])

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
    op.create_index('ix_plugin_license_activations_site_url', 'plugin_license_activations', ['site_url'])
    op.create_index('ix_plugin_license_activations_id', 'plugin_license_activations', ['id'])


def downgrade() -> None:
    op.drop_index('ix_plugin_license_activations_id', table_name='plugin_license_activations')
    op.drop_index('ix_plugin_license_activations_site_url', table_name='plugin_license_activations')
    op.drop_table('plugin_license_activations')

    op.drop_index('ix_plugin_licenses_id', table_name='plugin_licenses')
    op.drop_index('ix_plugin_licenses_license_key_hash', table_name='plugin_licenses')
    op.drop_table('plugin_licenses')
