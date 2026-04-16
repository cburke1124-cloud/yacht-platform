"""Add boat_model_specs table — reference database of production boat specifications.

Keyed by make + model + optional year range.  Used by the scraper pipeline to
auto-fill blank spec fields (length, beam, draft, hull material, boat type, etc.)
once year/make/model are resolved from the listing — similar to a VIN lookup for cars.

Engine specs are intentionally omitted (engines are commonly replaced).

Revision ID: 038
Revises: 037
"""
revision = '038'
down_revision = '037'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = inspector.get_table_names()

    if 'boat_model_specs' not in existing:
        op.create_table(
            'boat_model_specs',
            sa.Column('id',           sa.Integer(),  primary_key=True),
            sa.Column('make',         sa.String(),   nullable=False),
            sa.Column('model',        sa.String(),   nullable=False),
            sa.Column('year_from',    sa.Integer(),  nullable=True),
            sa.Column('year_to',      sa.Integer(),  nullable=True),
            sa.Column('boat_type',    sa.String(),   nullable=True),
            sa.Column('length_feet',  sa.Float(),    nullable=True),
            sa.Column('beam_feet',    sa.Float(),    nullable=True),
            sa.Column('draft_feet',   sa.Float(),    nullable=True),
            sa.Column('hull_material',sa.String(),   nullable=True),
            sa.Column('hull_type',    sa.String(),   nullable=True),
            sa.Column('fuel_capacity_gallons',  sa.Float(),   nullable=True),
            sa.Column('water_capacity_gallons', sa.Float(),   nullable=True),
            sa.Column('cabins',       sa.Integer(),  nullable=True),
            sa.Column('berths',       sa.Integer(),  nullable=True),
            sa.Column('heads',        sa.Integer(),  nullable=True),
            sa.Column('max_speed_knots',      sa.Float(), nullable=True),
            sa.Column('cruising_speed_knots', sa.Float(), nullable=True),
            sa.Column('notes',      sa.Text(),    nullable=True),
            sa.Column('source',     sa.String(),  nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index('ix_boat_model_specs_make',  'boat_model_specs', ['make'])
        op.create_index('ix_boat_model_specs_model', 'boat_model_specs', ['model'])


def downgrade():
    op.drop_index('ix_boat_model_specs_model', table_name='boat_model_specs')
    op.drop_index('ix_boat_model_specs_make',  table_name='boat_model_specs')
    op.drop_table('boat_model_specs')
