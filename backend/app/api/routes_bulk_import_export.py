from fastapi import APIRouter, UploadFile, File, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from io import StringIO
import csv

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.listing import Listing, ListingImage
from app.exceptions import AuthorizationException

router = APIRouter()

# -----------------------------
# BULK IMPORT
# -----------------------------
@router.post("/listings/import")
async def import_listings(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk import listings from CSV for admin or dealer accounts."""

    if current_user.user_type not in ["admin", "dealer"]:
        raise AuthorizationException("Not authorized to import listings")

    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(StringIO(text))

    created = 0
    updated = 0
    errors = []

    for row_index, row in enumerate(reader, start=2):
        try:
            title = (row.get("title") or "").strip()
            make = (row.get("make") or "").strip()
            model = (row.get("model") or "").strip()
            year_raw = (row.get("year") or "").strip()

            if not title or not make or not model or not year_raw:
                errors.append(f"Row {row_index}: missing required fields (title, make, model, year)")
                continue

            payload = {
                "title": title,
                "make": make,
                "model": model,
                "year": int(year_raw),
                "price": float(row.get("price") or 0),
                "currency": row.get("currency") or "USD",
                "length_feet": float(row.get("length_feet") or 0),
                "beam_feet": float(row.get("beam_feet") or 0),
                "draft_feet": float(row.get("draft_feet") or 0),
                "hull_material": row.get("hull_material"),
                "fuel_type": row.get("fuel_type"),
                "engine_make": row.get("engine_make"),
                "engine_model": row.get("engine_model"),
                "engine_hours": float(row.get("engine_hours") or 0),
                "cruising_speed_knots": float(row.get("cruising_speed") or 0),
                "max_speed_knots": float(row.get("max_speed") or 0),
                "fuel_capacity_gallons": float(row.get("fuel_capacity") or 0),
                "water_capacity_gallons": float(row.get("water_capacity") or 0),
                "cabins": int(row.get("cabins") or 0),
                "berths": int(row.get("berths") or 0),
                "heads": int(row.get("heads") or 0),
                "city": row.get("city"),
                "state": row.get("state"),
                "country": row.get("country") or "USA",
                "status": row.get("status") or "active",
                "description": row.get("description"),
            }

            listing_id_raw = (row.get("id") or "").strip()
            listing = None
            if listing_id_raw:
                listing = db.query(Listing).filter(Listing.id == int(listing_id_raw)).first()
                if listing and current_user.user_type != "admin" and listing.user_id != current_user.id:
                    errors.append(f"Row {row_index}: not authorized to update listing id {listing_id_raw}")
                    continue

            if listing:
                for key, value in payload.items():
                    setattr(listing, key, value)
                db.commit()
                updated += 1
            else:
                listing = Listing(
                    user_id=current_user.id,
                    created_by_user_id=current_user.id,
                    **payload,
                )
                db.add(listing)
                db.commit()
                db.refresh(listing)

                placeholder = ListingImage(
                    listing_id=listing.id,
                    url="/placeholder.jpg",
                    is_primary=True
                )
                db.add(placeholder)
                db.commit()
                created += 1

        except Exception as exc:
            db.rollback()
            errors.append(f"Row {row_index}: {str(exc)}")

    return {"success": True, "created": created, "updated": updated, "errors": errors}


# -----------------------------
# BULK EXPORT
# -----------------------------
@router.get("/listings/export")
def export_listings(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export listings to CSV for admin or dealer accounts."""

    if current_user.user_type not in ["admin", "dealer"]:
        raise AuthorizationException("Not authorized to export listings")

    listings = db.query(Listing).filter(Listing.user_id == current_user.id).all()

    output = StringIO()
    writer = csv.writer(output)

    # CSV header
    writer.writerow([
        "id","title","make","model","year","price","currency",
        "length_feet","beam_feet","draft_feet","hull_material","fuel_type",
        "engine_make","engine_model","engine_hours",
        "cruising_speed","max_speed",
        "fuel_capacity","water_capacity",
        "cabins","berths","heads",
        "city","state","country","status","description"
    ])

    for l in listings:
        writer.writerow([
            l.id, l.title, l.make, l.model, l.year, l.price, l.currency,
            l.length_feet, l.beam_feet, l.draft_feet, l.hull_material, l.fuel_type,
            l.engine_make, l.engine_model, l.engine_hours,
            l.cruising_speed_knots, l.max_speed_knots,
            l.fuel_capacity_gallons, l.water_capacity_gallons,
            l.cabins, l.berths, l.heads,
            l.city, l.state, l.country, l.status, l.description
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=listings-export.csv"},
    )
