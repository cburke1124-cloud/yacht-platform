"""
GET /api/catalog/makes   — list all active makes (optionally filter by propulsion)
GET /api/catalog/models  — list models for a make (by name or id)
GET /api/catalog/types   — distinct boat_type values present in the catalog

Designed so BUC / NADA can be swapped in as data source with no frontend changes:
just repopulate the same tables and these endpoints stay identical.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.catalog import VesselMake, VesselModel

router = APIRouter()


@router.get("/makes")
def list_makes(
    propulsion: Optional[str] = Query(None, description="power | sail | both"),
    db: Session = Depends(get_db),
):
    """Return all active makes, sorted alphabetically. Optionally filter by propulsion."""
    q = db.query(VesselMake).filter(VesselMake.active == True)
    if propulsion:
        q = q.filter(
            (VesselMake.propulsion == propulsion) | (VesselMake.propulsion == "both")
        )
    makes = q.order_by(VesselMake.name).all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "slug": m.slug,
            "country": m.country,
            "propulsion": m.propulsion,
        }
        for m in makes
    ]


@router.get("/models")
def list_models(
    make: Optional[str] = Query(None, description="Make name (case-insensitive)"),
    make_id: Optional[int] = Query(None, description="Make primary key"),
    boat_type: Optional[str] = Query(None),
    propulsion: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return models for a specific make, sorted by name."""
    q = db.query(VesselModel).filter(VesselModel.active == True)

    if make_id:
        q = q.filter(VesselModel.make_id == make_id)
    elif make:
        # Join to resolve by name
        q = (
            q.join(VesselMake)
            .filter(VesselMake.name.ilike(make))
        )

    if boat_type:
        q = q.filter(VesselModel.boat_type == boat_type)
    if propulsion:
        q = q.filter(VesselModel.propulsion == propulsion)

    models = q.order_by(VesselModel.name).all()
    return [
        {
            "id": m.id,
            "make_id": m.make_id,
            "name": m.name,
            "boat_type": m.boat_type,
            "propulsion": m.propulsion,
            "length_ft": m.length_ft,
            "min_year": m.min_year,
            "max_year": m.max_year,
        }
        for m in models
    ]


@router.get("/types")
def list_boat_types(
    propulsion: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return distinct boat_type values present in the catalog."""
    q = db.query(VesselModel.boat_type).filter(
        VesselModel.active == True,
        VesselModel.boat_type.isnot(None),
    )
    if propulsion:
        q = q.filter(VesselModel.propulsion == propulsion)
    rows = q.distinct().order_by(VesselModel.boat_type).all()
    return [r[0] for r in rows if r[0]]


@router.get("/search")
def search_catalog(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """
    Quick search across makes and models.
    Returns {makes: [...], models: [...]} for autocomplete use.
    """
    pattern = f"%{q}%"
    makes = (
        db.query(VesselMake)
        .filter(VesselMake.active == True, VesselMake.name.ilike(pattern))
        .order_by(VesselMake.name)
        .limit(10)
        .all()
    )
    models = (
        db.query(VesselModel, VesselMake.name.label("make_name"))
        .join(VesselMake)
        .filter(VesselModel.active == True, VesselModel.name.ilike(pattern))
        .order_by(VesselMake.name, VesselModel.name)
        .limit(20)
        .all()
    )
    return {
        "makes": [{"id": m.id, "name": m.name, "propulsion": m.propulsion} for m in makes],
        "models": [
            {
                "id": mod.id,
                "make_id": mod.make_id,
                "make_name": make_name,
                "name": mod.name,
                "boat_type": mod.boat_type,
                "length_ft": mod.length_ft,
            }
            for mod, make_name in models
        ],
    }
