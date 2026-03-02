"""
USCG Vessel Documentation Database importer.

Downloads are available at:
  https://www.uscg.mil/Mariners/National-Vessel-Documentation-Center/
  → "Abstract of Title" → "Vessel Count by State" or the full CSV export

The most useful freely-available file is the bulk export from:
  https://opendata.arcgis.com/datasets/...uscg...
  or direct CSV from NVDC at https://www.uscg.mil/

Usage (run from backend root):
    python -m app.migrations.import_uscg_csv --csv /path/to/uscg_vessels.csv [--limit 50000] [--dry-run]

Expected CSV columns (field names vary by export year — use --show-headers to inspect):
    VESSEL_NAME, MFR_MKR (manufacturer/make), HULL_ID, VESSEL_TYPE, PROPULSION_TYPE,
    VESSEL_LENGTH, BUILD_YEAR, HIN_MFR_ID

The script normalises make names, deduplicates, and upserts into vessel_makes and
vessel_models with source="uscg".

Re-running is idempotent: rows already in the DB are skipped.
"""

import sys
import os
import re
import csv
import argparse
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from app.db.session import SessionLocal
from app.models.catalog import VesselMake, VesselModel

# ─────────────────────────────────────────────────────────────────────────────
# Column-name mappings — edit if your CSV uses different headers
# ─────────────────────────────────────────────────────────────────────────────
COL_MAKE = ["MFR_MKR", "MANUFACTURER", "MAKE", "HIN_MFR_CODE", "BUILDER"]
COL_MODEL = ["VESSEL_MODEL", "MODEL", "VESSEL_NAME"]         # best-effort
COL_TYPE = ["VESSEL_TYPE", "TYPE_VESSEL", "TYPE"]
COL_PROPULSION = ["PROPULSION_TYPE", "PROPULSION", "PROP_TYPE"]
COL_LENGTH = ["VESSEL_LENGTH", "LENGTH", "LOA_FT", "FEET"]
COL_YEAR = ["BUILD_YEAR", "YEAR_BUILT", "MODEL_YEAR", "YEAR"]


# ─────────────────────────────────────────────────────────────────────────────
# Normalisation helpers
# ─────────────────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# Short noise words that appear at the start of make strings in the USCG data
_NOISE_PREFIX = re.compile(
    r"^(UNKNOWN|UNK|NONE|NO MFR|HOMEMADE|HOME MADE|CUSTOM|OTHER)\b",
    re.IGNORECASE,
)

# Normalise common USCG abbreviations → proper display name
_MAKE_REPLACEMENTS = {
    "SEA RAY": "Sea Ray",
    "BOST WHL": "Boston Whaler",
    "BOSTON WHALER": "Boston Whaler",
    "GRDY WHT": "Grady-White",
    "GRADY WHITE": "Grady-White",
    "HATTERAS": "Hatteras",
    "BERTRAM": "Bertram",
    "CHRIS CRAFT": "Chris-Craft",
    "CHRIS-CRAFT": "Chris-Craft",
    "BENETEAU": "Beneteau",
    "JEANNEAU": "Jeanneau",
    "LAGOON": "Lagoon",
    "AZIMUT": "Azimut",
    "VIKING": "Viking Yachts",
    "PURSUIT": "Pursuit Boats",
    "MAKO": "Mako",
    "SCOUT": "Scout Boats",
    "GRAND BANKS": "Grand Banks",
    "NORDHAVN": "Nordhavn",
    "HUNTER": "Hunter Marine",
    "CATALINA": "Catalina Yachts",
}

PROPULSION_MAP = {
    "PROPELLER": "power",
    "OUTBOARD": "power",
    "INBOARD": "power",
    "STERN DRIVE": "power",
    "JET": "power",
    "SAIL": "sail",
    "SAILING": "sail",
    "WIND": "sail",
}

TYPE_MAP = {
    "AUX SAIL": "Sailing Yacht",
    "SAILING": "Sailing Yacht",
    "SAIL": "Sailing Yacht",
    "MOTOR YACHT": "Motor Yacht",
    "HOUSEBOATS": "Motor Yacht",
    "OPEN MOTORBOAT": "Center Console",
    "CABIN MOTORBOAT": "Express Cruiser",
    "TRAWLER": "Trawler",
    "CATAMARAN": "Catamaran",
    "SPORTFISHER": "Sport Fisher",
    "SPORT FISH": "Sport Fisher",
}


def _find_col(headers: list[str], candidates: list[str]) -> str | None:
    """Return the first CSV header that matches one of our candidate names."""
    upper = {h.upper(): h for h in headers}
    for c in candidates:
        if c.upper() in upper:
            return upper[c.upper()]
    return None


def _clean_make(raw: str) -> str | None:
    raw = raw.strip().upper()
    if not raw or _NOISE_PREFIX.match(raw):
        return None
    # Check replacements dict first
    if raw in _MAKE_REPLACEMENTS:
        return _MAKE_REPLACEMENTS[raw]
    # Title-case fallback — strip trailing punctuation
    return raw.title().rstrip(",./")


def _parse_length(raw: str) -> float | None:
    try:
        v = float(raw.strip())
        return v if 5 <= v <= 500 else None
    except (ValueError, AttributeError):
        return None


def _parse_year(raw: str) -> int | None:
    try:
        v = int(raw.strip())
        return v if 1900 <= v <= 2100 else None
    except (ValueError, AttributeError):
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Main import logic
# ─────────────────────────────────────────────────────────────────────────────

def import_csv(path: str, limit: int | None, dry_run: bool, show_headers: bool):

    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        if show_headers:
            print("CSV headers found:")
            for h in headers:
                print(f"  {h!r}")
            return

        col_make = _find_col(headers, COL_MAKE)
        col_model = _find_col(headers, COL_MODEL)
        col_type = _find_col(headers, COL_TYPE)
        col_prop = _find_col(headers, COL_PROPULSION)
        col_length = _find_col(headers, COL_LENGTH)
        col_year = _find_col(headers, COL_YEAR)

        print(f"Column mapping:")
        print(f"  make      → {col_make}")
        print(f"  model     → {col_model}")
        print(f"  type      → {col_type}")
        print(f"  propulsion→ {col_prop}")
        print(f"  length    → {col_length}")
        print(f"  year      → {col_year}\n")

        if not col_make:
            print("ERROR: Could not find a 'make' column. Run with --show-headers and update COL_MAKE list.")
            sys.exit(1)

        # Aggregate: make → { (model_key, boat_type, propulsion) → {lengths, years} }
        data: dict[str, dict[tuple, dict]] = defaultdict(lambda: defaultdict(lambda: {"lengths": [], "years": []}))

        rows_read = 0
        rows_skipped = 0

        for row in reader:
            if limit and rows_read >= limit:
                break

            raw_make = row.get(col_make, "").strip() if col_make else ""
            make_name = _clean_make(raw_make)
            if not make_name:
                rows_skipped += 1
                continue

            raw_model = row.get(col_model, "").strip() if col_model else ""
            raw_type = row.get(col_type, "").strip().upper() if col_type else ""
            raw_prop = row.get(col_prop, "").strip().upper() if col_prop else ""

            boat_type = TYPE_MAP.get(raw_type, "Motor Yacht")
            propulsion = PROPULSION_MAP.get(raw_prop, "power")
            model_key_name = raw_model if raw_model else f"{make_name} (Unknown Model)"

            key = (model_key_name, boat_type, propulsion)
            entry = data[make_name][key]

            if col_length:
                l = _parse_length(row.get(col_length, ""))
                if l:
                    entry["lengths"].append(l)
            if col_year:
                y = _parse_year(row.get(col_year, ""))
                if y:
                    entry["years"].append(y)

            rows_read += 1

        print(f"Read {rows_read} rows, skipped {rows_skipped} with no make.\n")
        print(f"Unique makes found: {len(data)}")
        total_models = sum(len(v) for v in data.values())
        print(f"Unique make+model combinations: {total_models}\n")

    if dry_run:
        print("DRY RUN — no database writes. Re-run without --dry-run to import.")
        for make_name, models in sorted(data.items())[:20]:
            print(f"  {make_name}  ({len(models)} models)")
        return

    db = SessionLocal()
    try:
        added_makes = 0
        added_models = 0
        skipped = 0

        for make_name, models in data.items():
            slug = _slugify(make_name)
            make = db.query(VesselMake).filter_by(name=make_name).first()
            if not make:
                make = VesselMake(name=make_name, slug=slug, source="uscg")
                db.add(make)
                db.flush()
                added_makes += 1

            for (model_name, boat_type, propulsion), stats in models.items():
                existing = db.query(VesselModel).filter_by(make_id=make.id, name=model_name).first()
                if existing:
                    skipped += 1
                    continue

                lengths = stats["lengths"]
                years = stats["years"]
                avg_length = round(sum(lengths) / len(lengths), 1) if lengths else None
                min_year = min(years) if years else None
                max_year = max(years) if years else None

                model = VesselModel(
                    make_id=make.id,
                    name=model_name,
                    boat_type=boat_type,
                    propulsion=propulsion,
                    length_ft=avg_length,
                    min_year=min_year,
                    max_year=max_year,
                    source="uscg",
                )
                db.add(model)
                added_models += 1

        db.commit()
        print(f"Import complete. Added {added_makes} makes, {added_models} models. Skipped {skipped} already-existing.")

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Import USCG vessel CSV into the vessel catalog tables."
    )
    parser.add_argument("--csv", required=True, help="Path to USCG CSV file")
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Max rows to process (useful for testing)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse only — don't write to the database"
    )
    parser.add_argument(
        "--show-headers", action="store_true",
        help="Print the CSV column headers and exit"
    )
    args = parser.parse_args()

    import_csv(
        path=args.csv,
        limit=args.limit,
        dry_run=args.dry_run,
        show_headers=args.show_headers,
    )


if __name__ == "__main__":
    main()
