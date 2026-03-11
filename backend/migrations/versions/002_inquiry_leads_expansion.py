"""002 - Inquiry leads expansion + LeadNote table

Adds: assigned_to_id, lead_stage, lead_score, notes, paperwork_status, updated_at
      to the `inquiries` table, and creates the `lead_notes` table.
"""

revision = '002_inquiry_leads_expansion'
down_revision = '001_sms_prefs'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Skip if inquiries table doesn't exist
    if "inquiries" not in inspector.get_table_names():
        return

    # ── inquiries: new columns (PostgreSQL-safe) ──────────────────────────────
    rows = conn.execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'inquiries'"
        )
    ).fetchall()
    existing = {r[0] for r in rows}

    new_inquiry_cols = {
        "assigned_to_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
        "lead_stage": "VARCHAR DEFAULT 'new'",
        "lead_score": "INTEGER DEFAULT 0",
        "notes": "TEXT",
        "paperwork_status": "VARCHAR DEFAULT 'none'",
        "updated_at": "TIMESTAMP",
    }
    for col, definition in new_inquiry_cols.items():
        if col not in existing:
            conn.execute(
                sa.text(f"ALTER TABLE inquiries ADD COLUMN {col} {definition}")
            )

    # Index on assigned_to_id
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_inquiries_assigned_to_id "
            "ON inquiries(assigned_to_id)"
        )
    )

    # ── lead_notes table ──────────────────────────────────────────────────────
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS lead_notes (
                id          SERIAL PRIMARY KEY,
                inquiry_id  INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
                author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content     TEXT    NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )

    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_lead_notes_inquiry_id "
            "ON lead_notes(inquiry_id)"
        )
    )


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS lead_notes"))
    # Column drops are intentionally omitted to avoid data loss on rollback.
