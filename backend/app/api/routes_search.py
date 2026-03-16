from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime

from app.db.session import get_db
from app.models.listing import Listing
from app.utils.search import (
    sanitize_search_query,
    create_tsquery,
    calculate_relevance_score,
)
from app.exceptions import ResourceNotFoundException

router = APIRouter()


@router.post("/advanced")
def advanced_search(search, db: Session = Depends(get_db)):
    try:
        query = db.query(Listing).join(User, Listing.user_id == User.id).filter(Listing.status == search.status, User.is_demo != True)

        if search.query:
            sanitized = sanitize_search_query(search.query)
            if sanitized:
                search_vector = func.to_tsvector(
                    "english",
                    func.concat_ws(
                        " ",
                        Listing.title,
                        Listing.description,
                        Listing.make,
                        Listing.model,
                        Listing.boat_type,
                    ),
                )
                tsquery = func.to_tsquery("english", create_tsquery(sanitized))
                rank = func.ts_rank(search_vector, tsquery).label("rank")

                query = query.add_columns(rank).filter(search_vector.match(sanitized))

        if search.min_price is not None:
            query = query.filter(Listing.price >= search.min_price)
        if search.max_price is not None:
            query = query.filter(Listing.price <= search.max_price)

        if search.min_year is not None:
            query = query.filter(Listing.year >= search.min_year)
        if search.max_year is not None:
            query = query.filter(Listing.year <= search.max_year)

        if search.min_length is not None:
            query = query.filter(Listing.length_feet >= search.min_length)
        if search.max_length is not None:
            query = query.filter(Listing.length_feet <= search.max_length)

        if search.boat_types:
            query = query.filter(Listing.boat_type.in_(search.boat_types))

        if search.countries:
            query = query.filter(Listing.country.in_(search.countries))

        total_count = query.count()

        offset = (search.page - 1) * search.limit
        query = query.offset(offset).limit(search.limit)

        results = query.all()

        listings = [r[0] if isinstance(r, tuple) else r for r in results]

        formatted = []
        for listing in listings:
            formatted.append(
                {
                    "id": listing.id,
                    "title": listing.title,
                    "price": listing.price,
                    "year": listing.year,
                    "make": listing.make,
                    "model": listing.model,
                    "length_feet": listing.length_feet,
                    "images": [{"url": img.url} for img in listing.images[:1]],
                }
            )

        return {
            "results": formatted,
            "pagination": {
                "total_count": total_count,
                "page": search.page,
                "limit": search.limit,
                "total_pages": (total_count + search.limit - 1) // search.limit,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/simple")
def simple_search(q: str, limit: int = 20, db: Session = Depends(get_db)):
    sanitized = sanitize_search_query(q)
    if not sanitized:
        return []

    pattern = f"%{sanitized}%"

    listings = (
        db.query(Listing)
        .filter(
            Listing.status == "active",
            or_(
                Listing.title.ilike(pattern),
                Listing.make.ilike(pattern),
                Listing.model.ilike(pattern),
                Listing.description.ilike(pattern),
            ),
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "id": l.id,
            "title": l.title,
            "price": l.price,
            "year": l.year,
            "make": l.make,
            "model": l.model,
        }
        for l in listings
    ]


@router.get("/autocomplete")
def autocomplete(q: str, type: str = "all", limit: int = 10, db: Session = Depends(get_db)):
    sanitized = sanitize_search_query(q)
    if not sanitized or len(sanitized) < 2:
        return []

    pattern = f"{sanitized}%"
    suggestions = []

    if type in ["all", "make"]:
        makes = (
            db.query(Listing.make)
            .filter(Listing.make.ilike(pattern))
            .distinct()
            .limit(limit)
            .all()
        )
        suggestions.extend([{"type": "make", "value": m[0]} for m in makes if m[0]])

    if type in ["all", "model"]:
        models = (
            db.query(Listing.model)
            .filter(Listing.model.ilike(pattern))
            .distinct()
            .limit(limit)
            .all()
        )
        suggestions.extend([{"type": "model", "value": m[0]} for m in models if m[0]])

    return suggestions[:limit]


@router.get("/filters")
def get_filters(db: Session = Depends(get_db)):
    active = db.query(Listing).filter(Listing.status == "active")

    return {
        "boat_types": sorted({bt[0] for bt in active.with_entities(Listing.boat_type).distinct() if bt[0]}),
        "makes": sorted({m[0] for m in active.with_entities(Listing.make).distinct() if m[0]}),
        "hull_materials": sorted({m[0] for m in active.with_entities(Listing.hull_material).distinct() if m[0]}),
        "fuel_types": sorted({f[0] for f in active.with_entities(Listing.fuel_type).distinct() if f[0]}),
        "countries": sorted({c[0] for c in active.with_entities(Listing.country).distinct() if c[0]}),
        "states": sorted({s[0] for s in active.with_entities(Listing.state).distinct() if s[0]}),
    }