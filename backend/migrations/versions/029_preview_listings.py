"""Add preview_listings table

Revision ID: 029_preview_listings
Revises: 028_partner_offer_coupon
"""

revision = "029_preview_listings"
down_revision = "028_partner_offer_coupon"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        "preview_listings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("share_token", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("make", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(), nullable=True, default="USD"),
        sa.Column("length_feet", sa.Float(), nullable=True),
        sa.Column("beam_feet", sa.Float(), nullable=True),
        sa.Column("draft_feet", sa.Float(), nullable=True),
        sa.Column("boat_type", sa.String(), nullable=True),
        sa.Column("hull_material", sa.String(), nullable=True),
        sa.Column("hull_type", sa.String(), nullable=True),
        sa.Column("condition", sa.String(), nullable=True),
        sa.Column("engine_count", sa.Integer(), nullable=True),
        sa.Column("engine_hours", sa.Float(), nullable=True),
        sa.Column("fuel_type", sa.String(), nullable=True),
        sa.Column("max_speed_knots", sa.Float(), nullable=True),
        sa.Column("cruising_speed_knots", sa.Float(), nullable=True),
        sa.Column("cabins", sa.Integer(), nullable=True),
        sa.Column("berths", sa.Integer(), nullable=True),
        sa.Column("heads", sa.Integer(), nullable=True),
        sa.Column("fuel_capacity_gallons", sa.Float(), nullable=True),
        sa.Column("water_capacity_gallons", sa.Float(), nullable=True),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("state", sa.String(), nullable=True),
        sa.Column("country", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("feature_bullets", sa.JSON(), nullable=True),
        sa.Column("additional_specs", sa.JSON(), nullable=True),
        sa.Column("seller_name", sa.String(), nullable=True),
        sa.Column("seller_email", sa.String(), nullable=True),
        sa.Column("seller_phone", sa.String(), nullable=True),
        sa.Column("brokerage_name", sa.String(), nullable=True),
        sa.Column("brokerage_logo_url", sa.String(), nullable=True),
        sa.Column("brokerage_website", sa.String(), nullable=True),
        sa.Column("images", sa.JSON(), nullable=True),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("internal_note", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, default=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("preview_listings")
