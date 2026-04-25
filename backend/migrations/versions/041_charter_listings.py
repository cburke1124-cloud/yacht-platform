"""Create charter_listings table.

Revision ID: 041
Revises: 040
"""
revision = '041'
down_revision = '040'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'charter_listings' not in existing_tables:
        op.create_table(
            'charter_listings',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),

            # Identity
            sa.Column('title', sa.String(), nullable=False),
            sa.Column('vessel_name', sa.String(), nullable=False),
            sa.Column('slug', sa.String(), unique=True, nullable=True),

            # Vessel specs
            sa.Column('make', sa.String(), nullable=True),
            sa.Column('model', sa.String(), nullable=True),
            sa.Column('year', sa.Integer(), nullable=True),
            sa.Column('length_feet', sa.Float(), nullable=True),
            sa.Column('beam_feet', sa.Float(), nullable=True),
            sa.Column('draft_feet', sa.Float(), nullable=True),
            sa.Column('boat_type', sa.String(), nullable=True),
            sa.Column('hull_material', sa.String(), nullable=True),

            # Engine
            sa.Column('engine_make', sa.String(), nullable=True),
            sa.Column('engine_count', sa.Integer(), nullable=True),
            sa.Column('fuel_type', sa.String(), nullable=True),
            sa.Column('max_speed_knots', sa.Float(), nullable=True),
            sa.Column('cruising_speed_knots', sa.Float(), nullable=True),

            # Accommodation
            sa.Column('cabins', sa.Integer(), nullable=True),
            sa.Column('berths', sa.Integer(), nullable=True),
            sa.Column('heads', sa.Integer(), nullable=True),

            # Charter specifics
            sa.Column('max_guests', sa.Integer(), nullable=True),
            sa.Column('crew_included', sa.Boolean(), default=True),
            sa.Column('crew_count', sa.Integer(), nullable=True),

            # Location
            sa.Column('home_port', sa.String(), nullable=True),
            sa.Column('home_port_city', sa.String(), nullable=True),
            sa.Column('home_port_state', sa.String(), nullable=True),
            sa.Column('home_port_country', sa.String(), nullable=True, server_default='USA'),
            sa.Column('operating_regions', sa.String(), nullable=True),

            # Rates
            sa.Column('day_rate', sa.Float(), nullable=True),
            sa.Column('half_day_rate', sa.Float(), nullable=True),
            sa.Column('week_rate', sa.Float(), nullable=True),
            sa.Column('currency', sa.String(), nullable=True, server_default='USD'),
            sa.Column('min_charter_days', sa.Integer(), nullable=True),
            sa.Column('max_charter_days', sa.Integer(), nullable=True),

            # Content
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('amenities', sa.JSON(), nullable=True),
            sa.Column('images', sa.JSON(), nullable=True),

            # External booking
            sa.Column('booking_url', sa.String(), nullable=True),

            # Charter company info
            sa.Column('charter_company_name', sa.String(), nullable=True),
            sa.Column('charter_company_slug', sa.String(), nullable=True),
            sa.Column('charter_company_email', sa.String(), nullable=True),
            sa.Column('charter_company_phone', sa.String(), nullable=True),
            sa.Column('charter_company_website', sa.String(), nullable=True),

            # Status
            sa.Column('status', sa.String(), nullable=True, server_default='active'),

            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_charter_listings_id', 'charter_listings', ['id'])
        op.create_index('ix_charter_listings_slug', 'charter_listings', ['slug'], unique=True)
        op.create_index('ix_charter_listings_status', 'charter_listings', ['status'])
        op.create_index('ix_charter_listings_home_port_city', 'charter_listings', ['home_port_city'])


def downgrade():
    op.drop_table('charter_listings')
