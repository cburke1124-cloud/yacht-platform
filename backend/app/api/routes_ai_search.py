from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import os
import re
import requests as _requests
from datetime import datetime

from app.db.session import get_db
from app.models.listing import Listing
from app.models.user import User
from app.models.dealer import DealerProfile
from app.api.routes_listings import _get_primary_images_for_listings

router = APIRouter()


def _looks_like_broker_query(raw_query: str) -> bool:
    """Heuristic gate to detect broker/dealer name searches."""
    q = (raw_query or "").strip().lower()
    if not q:
        return False

    # Explicit broker intent keywords.
    if any(k in q for k in ["broker", "dealer", "company", "from "]):
        return True

    tokens = re.findall(r"[a-z]+", q)
    has_numbers = bool(re.search(r"\d", q))

    # Name-like queries such as "rick obey" or "northrop & johnson".
    return (2 <= len(tokens) <= 4) and not has_numbers


def _find_broker_listing_user_ids(raw_query: str, db: Session) -> list[int]:
    """
    Resolve a broker/dealer text query into listing owner user IDs.
    Includes the dealer plus team members under that dealer.
    """
    q = (raw_query or "").strip().lower()
    if not q:
        return []

    like_q = f"%{q}%"

    full_name = func.lower(
        func.trim(
            func.concat(
                func.coalesce(User.first_name, ""),
                " ",
                func.coalesce(User.last_name, ""),
            )
        )
    )

    matches = (
        db.query(User.id, User.user_type, User.parent_dealer_id)
        .outerjoin(DealerProfile, DealerProfile.user_id == User.id)
        .filter(
            User.active == True,  # noqa: E712
            User.is_demo != True,  # noqa: E712
            or_(
                full_name.like(like_q),
                func.lower(func.coalesce(User.company_name, "")).like(like_q),
                func.lower(func.coalesce(User.email, "")).like(like_q),
                func.lower(func.coalesce(DealerProfile.name, "")).like(like_q),
                func.lower(func.coalesce(DealerProfile.company_name, "")).like(like_q),
                func.lower(func.coalesce(DealerProfile.slug, "")).like(like_q),
            ),
        )
        .all()
    )

    if not matches:
        return []

    dealer_ids: set[int] = set()
    for uid, user_type, parent_dealer_id in matches:
        if user_type == "dealer":
            dealer_ids.add(uid)
        elif parent_dealer_id:
            dealer_ids.add(parent_dealer_id)

    # If only dealer/team relationship wasn't present, still include direct matches.
    if not dealer_ids:
        dealer_ids = {uid for uid, _, _ in matches}

    listing_owner_rows = (
        db.query(User.id)
        .filter(
            User.active == True,  # noqa: E712
            User.is_demo != True,  # noqa: E712
            or_(User.id.in_(dealer_ids), User.parent_dealer_id.in_(dealer_ids)),
        )
        .all()
    )
    return [row.id for row in listing_owner_rows]


class AISearchRequest(BaseModel):
    query: str
    max_results: int = 10


class SearchCriteria(BaseModel):
    """Extracted search criteria from natural language"""
    make: Optional[str] = None          # e.g. "Cheoy Lee", "Azimut", "Hatteras"
    model: Optional[str] = None         # e.g. "68 Evolution", "Convertible"
    boat_types: Optional[List[str]] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_length: Optional[float] = None
    max_length: Optional[float] = None
    min_year: Optional[int] = None
    max_year: Optional[int] = None
    min_cabins: Optional[int] = None
    min_berths: Optional[int] = None
    locations: Optional[List[str]] = None
    features: Optional[List[str]] = None
    use_case: Optional[str] = None  # "party", "fishing", "cruising", "racing", etc.
    

class ScoredListing(BaseModel):
    """A listing with relevance score and explanation"""
    listing: Dict[str, Any]
    score: int  # 0-100
    match_reasons: List[str]
    warnings: Optional[List[str]] = None


def extract_search_criteria(query: str) -> SearchCriteria:
    """Use Claude to extract structured search criteria from natural language"""
    
    prompt = f"""You are a yacht search assistant. Extract search criteria from this query:

"{query}"

Return ONLY a JSON object with these fields (use null for unspecified):
{{
  "make": "exact brand/manufacturer name" or null,
  "model": "exact model name" or null,
  "boat_types": ["Motor Yacht", "Sailing Yacht", etc.] or null,
  "min_price": number or null,
  "max_price": number or null,
  "min_length": number (feet) or null,
  "max_length": number (feet) or null,
  "min_year": number or null,
  "max_year": number or null,
  "min_cabins": number or null,
  "min_berths": number (sleeping capacity) or null,
  "locations": ["Florida", "Caribbean", etc.] or null,
  "features": ["fishing equipment", "party deck", "entertainment system", etc.] or null,
  "use_case": "party" | "fishing" | "cruising" | "racing" | "living" | null
}}

IMPORTANT — make/model extraction:
- If the query mentions a brand name (e.g. "Cheoy Lee", "Azimut", "Hatteras", "Sunseeker", "Ferretti", "Beneteau"), set "make" to that exact brand name.
- If the query mentions a specific model (e.g. "68 Evolution", "Convertible 60"), set "model" to that model name.
- Do NOT put brand or model names into "features" — they belong in "make"/"model".

Key conversions:
- "10 people" = at least 10 berths (sleeping) or estimate cabins
- "party" = spacious deck, entertainment features, 8+ berths
- "fishing" = fishing boat types, fishing equipment
- "luxury" = higher price range, premium features
- "family" = 3+ cabins, safe, comfortable
- Location mentions = add to locations array; use country names ("Mexico", "Greece", "Croatia"), regional names ("Caribbean", "Pacific Coast", "Mediterranean"), and US state names as needed
- Cruising-area context like "marina nearby", "resort", "anchorage", or "Pacific coast cruising" describes where the boat operates, NOT the boat itself — do NOT add those to features

Return ONLY valid JSON, no markdown or explanations."""

    api_key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        return SearchCriteria(features=[query.lower()])

    try:
        response = _requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=20,
        )
        if not response.ok:
            return SearchCriteria(features=[query.lower()])
        payload = response.json()
        content_list = payload.get("content", [])
        if not content_list:
            return SearchCriteria(features=[query.lower()])
        content = content_list[0].get("text", "").strip()
        # Strip markdown fences if present
        content = re.sub(r"^```json\s*|\s*```$", "", content).strip()
        criteria_dict = json.loads(content)
        return SearchCriteria(**criteria_dict)
    except Exception:
        return SearchCriteria(features=[query.lower()])


def score_listing(listing: Listing, criteria: SearchCriteria, query: str, db: Session = None) -> ScoredListing:
    """Score a listing based on how well it matches the search criteria"""
    
    score = 0
    max_score = 0
    match_reasons = []
    warnings = []

    # Make match (30 points) — highest weight: brand is a hard identity criterion
    max_score += 30
    if criteria.make:
        listing_make = (listing.make or "").strip().lower()
        wanted_make = criteria.make.strip().lower()
        if listing_make == wanted_make:
            score += 30
            match_reasons.append(f"✓ Exact make match: {listing.make}")
        elif wanted_make in listing_make or listing_make in wanted_make:
            score += 18
            match_reasons.append(f"✓ Make match: {listing.make}")
        else:
            # Wrong brand — hard penalty, no free points
            score += 0
            warnings.append(f"Different make: {listing.make} (searched for {criteria.make})")
    else:
        score += 30  # No make preference — full credit

    # Model match (15 points)
    max_score += 15
    if criteria.model:
        listing_model = (listing.model or "").strip().lower()
        wanted_model = criteria.model.strip().lower()
        if listing_model == wanted_model or wanted_model in listing_model or listing_model in wanted_model:
            score += 15
            match_reasons.append(f"✓ Model match: {listing.model}")
        else:
            score += 0
            warnings.append(f"Different model: {listing.model}")
    else:
        score += 15  # No model preference — full credit

    # Boat type match (15 points)
    max_score += 15
    if criteria.boat_types:
        if listing.boat_type and listing.boat_type in criteria.boat_types:
            score += 15
            match_reasons.append(f"✓ Exact boat type match: {listing.boat_type}")
        else:
            score += 3
            warnings.append(f"Different boat type: {listing.boat_type}")
    else:
        score += 15  # No preference specified
    
    # Price match (10 points)
    max_score += 10
    if criteria.min_price or criteria.max_price:
        if listing.price:
            in_range = True
            if criteria.min_price and listing.price < criteria.min_price:
                in_range = False
                warnings.append(f"Below desired price range (${listing.price:,.0f} < ${criteria.min_price:,.0f})")
            if criteria.max_price and listing.price > criteria.max_price:
                in_range = False
                warnings.append(f"Above desired price range (${listing.price:,.0f} > ${criteria.max_price:,.0f})")
            
            if in_range:
                score += 10
                match_reasons.append(f"✓ Within budget: ${listing.price:,.0f}")
            else:
                score += 2
        else:
            score += 5  # Some credit if no price specified
    else:
        score += 10
    
    # Size/Length match (10 points)
    max_score += 10
    if criteria.min_length or criteria.max_length:
        if listing.length_feet:
            in_range = True
            if criteria.min_length and listing.length_feet < criteria.min_length:
                in_range = False
                warnings.append(f"Smaller than desired ({listing.length_feet}' < {criteria.min_length}')")
            if criteria.max_length and listing.length_feet > criteria.max_length:
                in_range = False
                warnings.append(f"Larger than desired ({listing.length_feet}' > {criteria.max_length}')")
            
            if in_range:
                score += 10
                match_reasons.append(f"✓ Perfect size: {listing.length_feet} feet")
            else:
                score += 3
        else:
            score += 5
    else:
        score += 10
    
    # Capacity - Cabins (10 points)
    max_score += 10
    if criteria.min_cabins:
        if listing.cabins and listing.cabins >= criteria.min_cabins:
            score += 10
            match_reasons.append(f"✓ Has {listing.cabins} cabins (need {criteria.min_cabins}+)")
        elif listing.cabins:
            score += 3
            warnings.append(f"Only {listing.cabins} cabins (wanted {criteria.min_cabins}+)")
        else:
            score += 5
    else:
        score += 10
    
    # Capacity - Berths/People (10 points)
    max_score += 10
    if criteria.min_berths:
        if listing.berths and listing.berths >= criteria.min_berths:
            score += 10
            match_reasons.append(f"✓ Sleeps {listing.berths} people (need {criteria.min_berths}+)")
        elif listing.berths:
            score += 3
            warnings.append(f"Only sleeps {listing.berths} (wanted {criteria.min_berths}+)")
        else:
            score += 5
    else:
        score += 10
    
    # Year/Age (5 points)
    max_score += 5
    if criteria.min_year or criteria.max_year:
        if listing.year:
            in_range = True
            if criteria.min_year and listing.year < criteria.min_year:
                in_range = False
                warnings.append(f"Older than preferred ({listing.year} < {criteria.min_year})")
            if criteria.max_year and listing.year > criteria.max_year:
                in_range = False
            
            if in_range:
                score += 5
                match_reasons.append(f"✓ Year: {listing.year}")
            else:
                score += 1
        else:
            score += 2
    else:
        score += 5
    
    # Location match (20 points) — weighted heavily: location is a hard requirement for most queries
    max_score += 20
    if criteria.locations:
        location_match = False
        for loc in criteria.locations:
            loc_lower = loc.lower()
            if (listing.city and loc_lower in listing.city.lower()) or \
               (listing.state and loc_lower in listing.state.lower()) or \
               (listing.country and loc_lower in listing.country.lower()) or \
               (listing.continent and loc_lower in listing.continent.lower()):
                location_match = True
                match_reasons.append(f"✓ Location: {listing.city}, {listing.state}")
                break
        
        if location_match:
            score += 20
        else:
            score += 0  # No consolation — wrong location is a real mismatch
            warnings.append(f"Different location: {listing.city}, {listing.state}")
    else:
        score += 20
    
    # Use case bonus (bonus points, can exceed 100)
    if criteria.use_case:
        if criteria.use_case == "party":
            # Good for parties: spacious, newer, good capacity
            if listing.berths and listing.berths >= 8:
                score += 5
                match_reasons.append("✓ Great capacity for parties")
            if listing.year and listing.year >= 2010:
                score += 3
        elif criteria.use_case == "fishing":
            if listing.boat_type and "fishing" in listing.boat_type.lower():
                score += 10
                match_reasons.append("✓ Purpose-built for fishing")
        elif criteria.use_case == "cruising":
            if listing.cabins and listing.cabins >= 2:
                score += 5
                match_reasons.append("✓ Comfortable for cruising")

    # Featured placement boost
    if listing.featured and listing.featured_until and listing.featured_until >= datetime.utcnow():
        score += 8
        match_reasons.append("✓ Featured listing boost")
    
    # Calculate final percentage score
    final_score = min(100, int((score / max_score) * 100))
    
    owner = listing.owner
    dealer_user = owner.parent_dealer if owner and owner.parent_dealer_id and owner.parent_dealer else owner
    dealer_profile = dealer_user.dealer_profile if dealer_user else None

    dealer_name = None
    dealer_company = None
    if dealer_user:
        dealer_name = " ".join(filter(None, [dealer_user.first_name, dealer_user.last_name])).strip() or dealer_user.email
        dealer_company = (dealer_profile.company_name if dealer_profile and dealer_profile.company_name else dealer_user.company_name) or dealer_name

    # Format listing data
    listing_data = {
        "id": listing.id,
        "title": listing.title,
        "price": listing.price,
        "currency": listing.currency or "USD",
        "year": listing.year,
        "make": listing.make,
        "model": listing.model,
        "boat_type": listing.boat_type,
        "length_feet": listing.length_feet,
        "cabins": listing.cabins,
        "berths": listing.berths,
        "city": listing.city,
        "state": listing.state,
        "country": listing.country,
        "images": (
            _get_primary_images_for_listings(db, [listing.id]).get(listing.id)
            or [{"url": img.url} for img in listing.images[:1]]
        ) if db else [{"url": img.url} for img in listing.images[:1]],
        "featured": listing.featured or False,
        "dealer": {
            "name": dealer_name,
            "company_name": dealer_company,
            "slug": dealer_profile.slug if dealer_profile else None,
            "logo_url": dealer_profile.logo_url if dealer_profile else None,
        } if dealer_user else None,
    }
    
    return ScoredListing(
        listing=listing_data,
        score=final_score,
        match_reasons=match_reasons,
        warnings=warnings if warnings else None
    )


@router.get("/ai/search")
async def ai_search_get(
    query: str,
    db: Session = Depends(get_db)
):
    """
    GET version of AI search — called by the listings page.
    Accepts ?query= and returns the same shape as the POST endpoint.
    """
    request = AISearchRequest(query=query)
    return await ai_search(request, db)


@router.post("/ai")
async def ai_search(
    request: AISearchRequest,
    db: Session = Depends(get_db)
):
    """
    AI-powered natural language yacht search with scoring
    
    Example queries:
    - "I need a yacht for 10 people for parties"
    - "Fishing boat under $500k in Florida"
    - "Luxury sailing yacht 60+ feet, Mediterranean"
    """
    
    try:
        # Step 1: Extract search criteria using Claude
        criteria = extract_search_criteria(request.query)

        broker_user_ids: list[int] = []
        broker_query_applied = False
        if _looks_like_broker_query(request.query):
            broker_user_ids = _find_broker_listing_user_ids(request.query, db)
            broker_query_applied = len(broker_user_ids) > 0
        
        # Step 2: Build database query — inner-join User so orphaned listings
        # are excluded, and eager-load all relationships to prevent lazy-load 500s.
        from sqlalchemy.orm import joinedload as jl
        query = (
            db.query(Listing)
            .join(User, Listing.user_id == User.id)
            .filter(Listing.status == "active", Listing.deleted_at.is_(None), User.is_demo != True)
            .options(
                jl(Listing.owner).joinedload(User.dealer_profile),
                jl(Listing.owner).joinedload(User.parent_dealer).joinedload(User.dealer_profile),
                jl(Listing.images),
            )
        )

        # If query looks like a broker/dealer name, narrow to that broker's inventory first.
        if broker_query_applied:
            query = query.filter(Listing.user_id.in_(broker_user_ids))
        
        # Apply hard filters (must-haves)
        if criteria.min_price:
            query = query.filter(Listing.price >= criteria.min_price)
        if criteria.max_price:
            query = query.filter(Listing.price <= criteria.max_price)
        
        if criteria.min_length:
            query = query.filter(Listing.length_feet >= criteria.min_length)
        if criteria.max_length:
            query = query.filter(Listing.length_feet <= criteria.max_length)
        
        if criteria.min_year:
            query = query.filter(Listing.year >= criteria.min_year)
        
        if criteria.boat_types:
            query = query.filter(Listing.boat_type.in_(criteria.boat_types))

        # Check if exact make exists in inventory before filtering
        exact_make_exists = False
        if criteria.make:
            exact_make_exists = db.query(Listing.id).filter(
                Listing.status == "active",
                Listing.deleted_at.is_(None),
                func.lower(Listing.make) == criteria.make.strip().lower()
            ).first() is not None

        # If an exact make match exists, filter down to it; otherwise cast wider net
        if criteria.make and exact_make_exists:
            candidates_query = query.filter(func.lower(Listing.make) == criteria.make.strip().lower())
        else:
            candidates_query = query

        # Check if any listings exist in the requested location(s).
        # If they do, constrain the candidate pool to that location so a Sarasota
        # boat doesn't beat a Mexico boat just because most fields are unspecified.
        location_exists_in_db = False
        location_filter_clauses: list = []
        if criteria.locations and not broker_query_applied:
            for loc in criteria.locations:
                loc_like = f"%{loc.lower()}%"
                location_filter_clauses.append(
                    or_(
                        func.lower(Listing.city).like(loc_like),
                        func.lower(Listing.state).like(loc_like),
                        func.lower(Listing.country).like(loc_like),
                        func.lower(func.coalesce(Listing.continent, "")).like(loc_like),
                    )
                )
            if location_filter_clauses:
                location_exists_in_db = (
                    db.query(Listing.id)
                    .filter(
                        Listing.status == "active",
                        Listing.deleted_at.is_(None),
                        or_(*location_filter_clauses),
                    )
                    .first() is not None
                )

        if location_filter_clauses and location_exists_in_db:
            candidates_query = candidates_query.filter(or_(*location_filter_clauses))

        # Get candidate listings (cast wider net for scoring)
        candidates = candidates_query.limit(50).all()
        
        if not candidates:
            return {
                "query": request.query,
                "understood_criteria": criteria.dict(),
                "search_context": {
                    "no_exact_make": criteria.make if criteria.make and not exact_make_exists else None,
                    "showing_similar": False,
                },
                "results": [],
                "message": "No yachts found matching your criteria. Try broadening your search."
            }
        
        # Step 3: Score each listing (skip any that fail to avoid single bad record tanking all results)
        scored_listings = []
        for listing in candidates:
            try:
                scored = score_listing(listing, criteria, request.query, db)
                scored_listings.append(scored)
            except Exception:
                pass
        
        # Step 4: Sort by score and return top results
        scored_listings.sort(key=lambda x: x.score, reverse=True)
        top_results = scored_listings[:request.max_results]

        # Build search context message for the frontend banner
        search_context: Dict[str, Any] = {}
        if broker_query_applied:
            search_context["broker_match"] = request.query
            search_context["broker_filtered"] = True
        if criteria.make and not exact_make_exists:
            search_context["no_exact_make"] = criteria.make
            search_context["showing_similar"] = True
        elif criteria.make and exact_make_exists:
            search_context["exact_make"] = criteria.make
            search_context["showing_similar"] = False
        if criteria.locations:
            if location_exists_in_db:
                search_context["location_filtered"] = criteria.locations
            else:
                search_context["no_location_match"] = criteria.locations
                search_context["showing_all_locations"] = True
        
        return {
            "query": request.query,
            "understood_criteria": criteria.dict(),
            "search_context": search_context,
            "total_found": len(candidates),
            "results": [
                {
                    "listing": result.listing,
                    "match_score": result.score,
                    "match_reasons": result.match_reasons,
                    "warnings": result.warnings
                }
                for result in top_results
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI search failed: {str(e)}"
        )


@router.get("/ai/suggestions")
async def get_ai_suggestions():
    """Get example queries users can try"""
    return {
        "suggestions": [
            "I need a yacht that can fit 10 people for a party",
            "Fishing boat under $500k in Florida",
            "Luxury motor yacht 80+ feet for Mediterranean cruising",
            "Family-friendly sailboat with 3 cabins under $300k",
            "Fast sport fishing boat in the Caribbean",
            "New or like-new mega yacht over 100 feet",
            "Budget-friendly cruiser for coastal trips, under $200k",
            "Catamaran with 4 cabins for charter business"
        ]
    }
