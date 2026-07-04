"""add vessel_makes and vessel_models tables

Revision ID: faa436eff634
Revises: 047
Create Date: 2026-07-04 09:18:35.455326

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'faa436eff634'
down_revision: Union[str, Sequence[str], None] = '047'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'vessel_makes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('slug', sa.String(length=200), nullable=False),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('propulsion', sa.String(length=20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('source', sa.String(length=50), nullable=True, server_default='manual'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vessel_makes_id'), 'vessel_makes', ['id'], unique=False)
    op.create_index(op.f('ix_vessel_makes_name'), 'vessel_makes', ['name'], unique=True)
    op.create_index(op.f('ix_vessel_makes_slug'), 'vessel_makes', ['slug'], unique=True)

    op.create_table(
        'vessel_models',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('make_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('boat_type', sa.String(length=100), nullable=True),
        sa.Column('propulsion', sa.String(length=20), nullable=True),
        sa.Column('length_ft', sa.Float(), nullable=True),
        sa.Column('min_year', sa.Integer(), nullable=True),
        sa.Column('max_year', sa.Integer(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('source', sa.String(length=50), nullable=True, server_default='manual'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['make_id'], ['vessel_makes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('make_id', 'name', name='uq_vessel_model_make_name'),
    )
    op.create_index('idx_vessel_model_boat_type', 'vessel_models', ['boat_type'], unique=False)
    op.create_index('idx_vessel_model_propulsion', 'vessel_models', ['propulsion'], unique=False)
    op.create_index(op.f('ix_vessel_models_id'), 'vessel_models', ['id'], unique=False)
    op.create_index(op.f('ix_vessel_models_make_id'), 'vessel_models', ['make_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vessel_models_make_id'), table_name='vessel_models')
    op.drop_index(op.f('ix_vessel_models_id'), table_name='vessel_models')
    op.drop_index('idx_vessel_model_propulsion', table_name='vessel_models')
    op.drop_index('idx_vessel_model_boat_type', table_name='vessel_models')
    op.drop_table('vessel_models')

    op.drop_index(op.f('ix_vessel_makes_slug'), table_name='vessel_makes')
    op.drop_index(op.f('ix_vessel_makes_name'), table_name='vessel_makes')
    op.drop_index(op.f('ix_vessel_makes_id'), table_name='vessel_makes')
    op.drop_table('vessel_makes')
