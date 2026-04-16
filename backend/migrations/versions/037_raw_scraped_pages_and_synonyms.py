"""Add raw_scraped_pages and field_synonyms tables for staged scraper pipeline.

raw_scraped_pages: stores raw HTML + intermediate extraction data per URL per job.
  - Enables re-parsing without re-fetching (storage is cheap, network is not).
  - Stages: intake → normalized → ai_parsed → validated
  - content_hash (SHA-256 prefix) skips unchanged pages on re-runs (saves AI credits).

field_synonyms: normalization dictionary mapping raw spec-table labels to canonical
  DB field names (e.g. "LOA" → "length_feet", "running hours" → "engine_hours").
  - Pre-seeded with ~80 common marine terminology variants.
  - Admin-editable without a code deploy.

Revision ID: 037
Revises: 036
"""
revision = '037'
down_revision = '036'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = inspector.get_table_names()

    if 'raw_scraped_pages' not in existing:
        op.create_table(
            'raw_scraped_pages',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('job_id', sa.Integer(), sa.ForeignKey('scraper_jobs.id'), nullable=False),
            sa.Column('source_url', sa.String(), nullable=False),
            sa.Column('content_hash', sa.String(64), nullable=True),
            sa.Column('raw_html', sa.Text(), nullable=True),
            sa.Column('raw_text', sa.Text(), nullable=True),
            sa.Column('wp_extra_text', sa.Text(), nullable=True),
            sa.Column('stage', sa.String(), server_default='intake', nullable=False),
            sa.Column('skip_reason', sa.String(), nullable=True),
            sa.Column('normalized_data', sa.JSON(), nullable=True),
            sa.Column('ai_data', sa.JSON(), nullable=True),
            sa.Column('merged_data', sa.JSON(), nullable=True),
            sa.Column('confidence_score', sa.Float(), nullable=True),
            sa.Column('ai_used', sa.Boolean(), server_default='false'),
            sa.Column('fetched_at', sa.DateTime(), nullable=True),
            sa.Column('normalized_at', sa.DateTime(), nullable=True),
            sa.Column('ai_parsed_at', sa.DateTime(), nullable=True),
            sa.Column('validated_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()')),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('NOW()')),
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_raw_scraped_pages_job_id "
            "ON raw_scraped_pages (job_id)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_raw_scraped_pages_source_url "
            "ON raw_scraped_pages (source_url)"
        )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_scraped_pages_job_url "
            "ON raw_scraped_pages (job_id, source_url)"
        )

    if 'field_synonyms' not in existing:
        op.create_table(
            'field_synonyms',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('raw_term', sa.String(), nullable=False, unique=True),
            sa.Column('canonical_field', sa.String(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()')),
        )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_field_synonyms_raw_term "
            "ON field_synonyms (raw_term)"
        )

        # ── Seed common marine spec label synonyms ─────────────────────────────
        # All raw_term values are lowercase and stripped (matching lookup logic).
        # canonical_field must match a real Listing column OR a recognised key
        # such as "engine_hours", "horsepower", "boat_type".
        synonyms = [
            # Length / LOA
            ("loa",                    "length_feet"),
            ("length",                 "length_feet"),
            ("length overall",         "length_feet"),
            ("overall length",         "length_feet"),
            ("length (loa)",           "length_feet"),
            ("loa (length overall)",   "length_feet"),
            ("length (ft)",            "length_feet"),
            ("length ft",              "length_feet"),
            ("length (feet)",          "length_feet"),
            ("boat length",            "length_feet"),
            ("vessel length",          "length_feet"),
            ("hull length",            "length_feet"),
            ("registered length",      "length_feet"),
            ("waterline length",       "length_feet"),
            ("lwl",                    "length_feet"),
            # Beam
            ("beam",                   "beam_feet"),
            ("beam (ft)",              "beam_feet"),
            ("beam ft",                "beam_feet"),
            ("beam (feet)",            "beam_feet"),
            ("max beam",               "beam_feet"),
            ("maximum beam",           "beam_feet"),
            ("width",                  "beam_feet"),
            ("boat width",             "beam_feet"),
            # Draft
            ("draft",                  "draft_feet"),
            ("draft (ft)",             "draft_feet"),
            ("draft ft",               "draft_feet"),
            ("draught",                "draft_feet"),
            ("max draft",              "draft_feet"),
            ("draft max",              "draft_feet"),
            ("minimum draft",          "draft_feet"),
            ("draft min",              "draft_feet"),
            # Engine hours
            ("hours",                  "engine_hours"),
            ("engine hours",           "engine_hours"),
            ("engine hrs",             "engine_hours"),
            ("hour meter",             "engine_hours"),
            ("hours on engines",       "engine_hours"),
            ("running hours",          "engine_hours"),
            ("total hours",            "engine_hours"),
            ("hrs",                    "engine_hours"),
            ("hours (approx)",         "engine_hours"),
            ("smoh",                   "engine_hours"),
            # Year
            ("year",                   "year"),
            ("year built",             "year"),
            ("model year",             "year"),
            ("build year",             "year"),
            ("year of manufacture",    "year"),
            ("manufactured",           "year"),
            # Make / Manufacturer
            ("make",                   "make"),
            ("manufacturer",           "make"),
            ("builder",                "make"),
            ("brand",                  "make"),
            ("built by",               "make"),
            # Model
            ("model",                  "model"),
            ("model name",             "model"),
            # Cabins / Staterooms
            ("cabins",                 "cabins"),
            ("staterooms",             "cabins"),
            ("no. of staterooms",      "cabins"),
            ("number of staterooms",   "cabins"),
            ("sleeping cabins",        "cabins"),
            # Berths / Sleeps
            ("berths",                 "berths"),
            ("sleeps",                 "berths"),
            ("sleeping capacity",      "berths"),
            ("guests",                 "berths"),
            ("persons",                "berths"),
            # Heads / Bathrooms
            ("heads",                  "heads"),
            ("bathrooms",              "heads"),
            ("no. of heads",           "heads"),
            ("number of heads",        "heads"),
            ("toilets",                "heads"),
            # Fuel type
            ("fuel type",              "fuel_type"),
            ("fuel",                   "fuel_type"),
            ("propulsion type",        "fuel_type"),
            ("engine type",            "fuel_type"),
            # Hull material
            ("hull material",          "hull_material"),
            ("hull",                   "hull_material"),
            ("construction",           "hull_material"),
            ("hull construction",      "hull_material"),
            ("material",               "hull_material"),
            # Hull type / form
            ("hull type",              "hull_type"),
            ("hull form",              "hull_type"),
            ("hull style",             "hull_type"),
            # Boat / Vessel type
            ("type",                   "boat_type"),
            ("boat type",              "boat_type"),
            ("vessel type",            "boat_type"),
            ("category",               "boat_type"),
            ("class",                  "boat_type"),
            # Engine count
            ("engines",                "engine_count"),
            ("engine count",           "engine_count"),
            ("no. of engines",         "engine_count"),
            ("number of engines",      "engine_count"),
            # Speed
            ("max speed",              "max_speed_knots"),
            ("maximum speed",          "max_speed_knots"),
            ("top speed",              "max_speed_knots"),
            ("cruise speed",           "cruising_speed_knots"),
            ("cruising speed",         "cruising_speed_knots"),
            ("cruise",                 "cruising_speed_knots"),
            # Location
            ("city",                   "city"),
            ("state",                  "state"),
            ("country",                "country"),
            ("location",               "city"),
            ("port",                   "city"),
            ("home port",              "city"),
            ("berthing location",      "city"),
            # Horsepower (not a listing column but kept for context)
            ("horsepower",             "horsepower"),
            ("hp",                     "horsepower"),
            ("total hp",               "horsepower"),
            # Condition
            ("condition",              "condition"),
            # Fuel capacity
            ("fuel capacity",          "fuel_capacity_gallons"),
            ("fuel tank",              "fuel_capacity_gallons"),
            ("fuel tank capacity",     "fuel_capacity_gallons"),
            # Water capacity
            ("water capacity",         "water_capacity_gallons"),
            ("fresh water",            "water_capacity_gallons"),
            ("water tank",             "water_capacity_gallons"),
        ]

        for raw_term, canonical_field in synonyms:
            op.execute(
                f"INSERT INTO field_synonyms (raw_term, canonical_field) "
                f"VALUES ('{raw_term}', '{canonical_field}') "
                f"ON CONFLICT (raw_term) DO NOTHING"
            )


def downgrade():
    op.execute("DROP TABLE IF EXISTS raw_scraped_pages")
    op.execute("DROP TABLE IF EXISTS field_synonyms")
