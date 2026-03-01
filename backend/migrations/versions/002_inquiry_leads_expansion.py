"""002 - Inquiry leads expansion + LeadNote table

Adds: assigned_to_id, lead_stage, lead_score, notes, paperwork_status, updated_at
      to the `inquiries` table, and creates the `lead_notes` table.
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    conn = op.get_bind()

    # ── inquiries: new columns ────────────────────────────────────────────────
    cols = {r[0] for r in conn.execute(sa.text("PRAGMA table_info(inquiries)")).fetchall()
            if True}  # SQLite; for Postgres use information_schema below

    # Postgres-safe existence check
    existing = set()
    try:
        rows = conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'inquiries'"
            )
        ).fetchall()
        existing = {r[0] for r in rows}
    except Exception:
        # SQLite fallback
        rows = conn.execute(sa.text("PRAGMA table_info(inquiries)")).fetchall()
        existing = {r[1] for r in rows}

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

    # Index on assigned_to_id for fast salesman queries
    try:
        conn.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_inquiries_assigned_to_id "
                "ON inquiries(assigned_to_id)"
            )
        )
    except Exception:
        pass

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

    try:
        conn.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_lead_notes_inquiry_id "
                "ON lead_notes(inquiry_id)"
            )
        )
    except Exception:
        pass


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS lead_notes"))
    # Column drops are intentionally omitted to avoid data loss on rollback.
