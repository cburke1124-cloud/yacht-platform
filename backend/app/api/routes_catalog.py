"""
GET /api/catalog/makes   — list all active makes (optionally filter by propulsion)
GET /api/catalog/models  — list models for a make (by name or id)
GET /api/catalog/types   — distinct boat_type values present in the catalog

Designed so BUC / NADA can be swapped in as data source with no frontend changes:
just repopulate the same tables and these endpoints stay identical.
"""

import re
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.catalog import VesselMake, VesselModel
from app.models.user import User
from app.api.routes_auth import get_current_user

router = APIRouter()


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class MakeCreate(BaseModel):
    name: str
    country: Optional[str] = None
    propulsion: str = "both"
    notes: Optional[str] = None
    active: bool = True

class MakeUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    propulsion: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None

class ModelCreate(BaseModel):
    make_id: int
    name: str
    boat_type: Optional[str] = None
    propulsion: Optional[str] = None
    length_ft: Optional[float] = None
    min_year: Optional[int] = None
    max_year: Optional[int] = None
    active: bool = True

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    boat_type: Optional[str] = None
    propulsion: Optional[str] = None
    length_ft: Optional[float] = None
    min_year: Optional[int] = None
    max_year: Optional[int] = None
    active: Optional[bool] = None


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


@router.get("/makes")
def list_makes(
    propulsion: Optional[str] = Query(None, description="power | sail | both"),
    show_all: Optional[bool] = Query(False, description="Include inactive (admin use)"),
    db: Session = Depends(get_db),
):
    """Return all makes, sorted alphabetically. Optionally filter by propulsion."""
    q = db.query(VesselMake)
    if not show_all:
        q = q.filter(VesselMake.active == True)
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
            "active": m.active,
        }
        for m in makes
    ]


@router.get("/models")
def list_models(
    make: Optional[str] = Query(None, description="Make name (case-insensitive)"),
    make_id: Optional[int] = Query(None, description="Make primary key"),
    boat_type: Optional[str] = Query(None),
    propulsion: Optional[str] = Query(None),
    show_all: Optional[bool] = Query(False, description="Include inactive (admin use)"),
    db: Session = Depends(get_db),
):
    """Return models for a specific make, sorted by name."""
    q = db.query(VesselModel)
    if not show_all:
        q = q.filter(VesselModel.active == True)

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


# ─── Admin: Makes CRUD ────────────────────────────────────────────────────────

def _require_admin(current_user: User) -> None:
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.post("/makes")
def create_make(
    payload: MakeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    slug = _slugify(payload.name)
    # Ensure slug uniqueness by appending counter if needed
    existing_slugs = {r[0] for r in db.query(VesselMake.slug).all()}
    base_slug, counter = slug, 1
    while slug in existing_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1
    make = VesselMake(
        name=payload.name,
        slug=slug,
        country=payload.country,
        propulsion=payload.propulsion,
        notes=payload.notes,
        active=payload.active,
        source="manual",
    )
    db.add(make)
    db.commit()
    db.refresh(make)
    return {"id": make.id, "name": make.name, "slug": make.slug, "country": make.country, "propulsion": make.propulsion, "active": make.active}


@router.put("/makes/{make_id}")
def update_make(
    make_id: int,
    payload: MakeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    make = db.query(VesselMake).filter(VesselMake.id == make_id).first()
    if not make:
        raise HTTPException(status_code=404, detail="Make not found")
    if payload.name is not None:
        make.name = payload.name
        make.slug = _slugify(payload.name)
    if payload.country is not None:
        make.country = payload.country
    if payload.propulsion is not None:
        make.propulsion = payload.propulsion
    if payload.notes is not None:
        make.notes = payload.notes
    if payload.active is not None:
        make.active = payload.active
    db.commit()
    db.refresh(make)
    return {"id": make.id, "name": make.name, "slug": make.slug, "country": make.country, "propulsion": make.propulsion, "active": make.active}


@router.delete("/makes/{make_id}")
def delete_make(
    make_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    make = db.query(VesselMake).filter(VesselMake.id == make_id).first()
    if not make:
        raise HTTPException(status_code=404, detail="Make not found")
    db.delete(make)
    db.commit()
    return {"success": True}


# ─── Admin: Models CRUD ───────────────────────────────────────────────────────

@router.post("/models")
def create_model(
    payload: ModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    make = db.query(VesselMake).filter(VesselMake.id == payload.make_id).first()
    if not make:
        raise HTTPException(status_code=404, detail="Make not found")
    model = VesselModel(
        make_id=payload.make_id,
        name=payload.name,
        boat_type=payload.boat_type,
        propulsion=payload.propulsion,
        length_ft=payload.length_ft,
        min_year=payload.min_year,
        max_year=payload.max_year,
        active=payload.active,
        source="manual",
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return {"id": model.id, "make_id": model.make_id, "name": model.name, "boat_type": model.boat_type, "propulsion": model.propulsion, "active": model.active}


@router.put("/models/{model_id}")
def update_model(
    model_id: int,
    payload: ModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    model = db.query(VesselModel).filter(VesselModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    for field in ("name", "boat_type", "propulsion", "length_ft", "min_year", "max_year", "active"):
        val = getattr(payload, field)
        if val is not None:
            setattr(model, field, val)
    db.commit()
    db.refresh(model)
    return {"id": model.id, "make_id": model.make_id, "name": model.name, "boat_type": model.boat_type, "propulsion": model.propulsion, "active": model.active}


@router.delete("/models/{model_id}")
def delete_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    model = db.query(VesselModel).filter(VesselModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(model)
    db.commit()
    return {"success": True}
