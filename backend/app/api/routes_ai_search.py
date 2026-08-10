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
from app.models.charter import CharterListing
from app.api.routes_charter import _serialize as _serialize_charter

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


# US state name <-> abbreviation, both directions, so "Florida" matches a
# listing stored as "FL" and vice versa.
_STATE_NAME_TO_ABBR = {
    "alabama": "al", "alaska": "ak", "arizona": "az", "arkansas": "ar", "california": "ca",
    "colorado": "co", "connecticut": "ct", "delaware": "de", "florida": "fl", "georgia": "ga",
    "hawaii": "hi", "idaho": "id", "illinois": "il", "indiana": "in", "iowa": "ia",
    "kansas": "ks", "kentucky": "ky", "louisiana": "la", "maine": "me", "maryland": "md",
    "massachusetts": "ma", "michigan": "mi", "minnesota": "mn", "mississippi": "ms", "missouri": "mo",
    "montana": "mt", "nebraska": "ne", "nevada": "nv", "new hampshire": "nh", "new jersey": "nj",
    "new mexico": "nm", "new york": "ny", "north carolina": "nc", "north dakota": "nd", "ohio": "oh",
    "oklahoma": "ok", "oregon": "or", "pennsylvania": "pa", "rhode island": "ri", "south carolina": "sc",
    "south dakota": "sd", "tennessee": "tn", "texas": "tx", "utah": "ut", "vermont": "vt",
    "virginia": "va", "washington": "wa", "west virginia": "wv", "wisconsin": "wi", "wyoming": "wy",
    "district of columbia": "dc",
}
_STATE_ABBR_TO_NAME = {abbr: name for name, abbr in _STATE_NAME_TO_ABBR.items()}

# Regional groupings the AI is likely to extract (e.g. "Caribbean", "Mediterranean")
# that never literally appear in a listing's city/state/country/continent columns.
# Expanding them into their constituent country/state names before matching keeps
# genuinely-correct listings from scoring zero on location just because the raw
# region word isn't stored anywhere.
_REGION_SYNONYMS = {
    "caribbean": [
        "bahamas", "bvi", "british virgin islands", "us virgin islands", "virgin islands",
        "puerto rico", "turks and caicos", "cayman islands", "jamaica", "dominican republic",
        "st martin", "st. martin", "st thomas", "st. thomas", "antigua", "grenada", "st lucia",
        "st. lucia", "barbados", "aruba", "curacao", "trinidad",
    ],
    "mediterranean": [
        "greece", "croatia", "italy", "france", "spain", "turkey", "monaco", "montenegro",
        "cyprus", "malta",
    ],
    "pacific coast": ["california", "oregon", "washington"],
    "pacific northwest": ["washington", "oregon", "british columbia"],
    "new england": ["maine", "new hampshire", "massachusetts", "rhode island", "connecticut"],
    "gulf coast": ["florida", "alabama", "mississippi", "louisiana", "texas"],
}

_LOCATION_ALIASES = {
    "bvi": ["british virgin islands"],
    "british virgin islands": ["bvi"],
    "usvi": ["us virgin islands", "virgin islands"],
    "us virgin islands": ["usvi"],
}


def _expand_location_terms(locations: Optional[List[str]]) -> List[str]:
    """Expand user/LLM-provided location strings into every synonym worth
    matching against listing location columns (state abbreviations, region
    groupings, common aliases). Used for both the DB filter and in-code
    scoring so a query like "Mediterranean" actually matches Greece/Croatia/
    etc. instead of scoring zero on location for every genuinely-correct
    listing."""
    expanded: set[str] = set()
    for loc in locations or []:
        loc_l = (loc or "").strip().lower()
        if not loc_l:
            continue
        expanded.add(loc_l)
        if loc_l in _STATE_NAME_TO_ABBR:
            expanded.add(_STATE_NAME_TO_ABBR[loc_l])
        if loc_l in _STATE_ABBR_TO_NAME:
            expanded.add(_STATE_ABBR_TO_NAME[loc_l])
        if loc_l in _REGION_SYNONYMS:
            expanded.update(_REGION_SYNONYMS[loc_l])
        if loc_l in _LOCATION_ALIASES:
            expanded.update(_LOCATION_ALIASES[loc_l])
    return sorted(expanded)


def _match_features(features: Optional[List[str]], searchable_text: str) -> tuple[list[str], list[str]]:
    """Split requested features into (matched, missing) by substring presence
    in the listing/charter's combined searchable text."""
    text = (searchable_text or "").lower()
    matched, missing = [], []
    for feat in features or []:
        feat_clean = (feat or "").strip()
        if not feat_clean:
            continue
        if feat_clean.lower() in text:
            matched.append(feat_clean)
        else:
            missing.append(feat_clean)
    return matched, missing


class AISearchRequest(BaseModel):
    query: str
    max_results: int = 10


class SearchCriteria(BaseModel):
    """Extracted search criteria from natural language"""
    make: Optional[str] = None          # e.g. "Cheoy Lee", "Azimut", "Hatteras"
    model: Optional[str] = None         # e.g. "68 Evolution", "Convertible"
    boat_name: Optional[str] = None     # e.g. "Serenity Now" — a specific vessel's name
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
  "boat_name": "specific vessel/boat name if the query names one, e.g. 'Serenity Now'" or null,
  "boat_types": ["Motor Yacht", "Sailing Yacht", "Catamaran", "Sport Fisher", "Trawler", "Mega Yacht", "Express Cruiser", "Center Console", "Sloop", etc.] or null,
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

IMPORTANT — make/model/boat_name extraction:
- If the query mentions a brand name (e.g. "Cheoy Lee", "Azimut", "Hatteras", "Sunseeker", "Ferretti", "Beneteau"), set "make" to that exact brand name.
- If the query mentions a specific model (e.g. "68 Evolution", "Convertible 60"), set "model" to that model name.
- If the query names a specific vessel (e.g. "the boat called Serenity Now", "do you have Bella Vita"), set "boat_name" to that name. Do NOT confuse a vessel name with a make or model.
- Do NOT put brand or model names into "features" — they belong in "make"/"model".
- "boat_types" is a category, not a purpose — use the actual boat-type category the query implies (e.g. "fishing boat"/"offshore fishing" usually means "Sport Fisher" or "Center Console", NOT a made-up type like "Fishing Boat"; "trawler"/"passagemaker" means "Trawler"; "superyacht"/"large crewed yacht" means "Mega Yacht"). Only use values from the list above — never invent a new category string.

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

    # Boat name match (20 points) — a named vessel is as strong an identity
    # signal as make, since the user is looking for one specific boat.
    max_score += 20
    if criteria.boat_name:
        listing_title = (listing.title or "").strip().lower()
        wanted_name = criteria.boat_name.strip().lower()
        if wanted_name and (wanted_name in listing_title or listing_title in wanted_name):
            score += 20
            match_reasons.append(f"✓ Matches boat name: {listing.title}")
        else:
            score += 0
            warnings.append(f"Different boat name (searched for \"{criteria.boat_name}\")")
    else:
        score += 20

    # Features/capabilities match (10 points) — matches requested features
    # against title, description, features text, and feature_bullets.
    max_score += 10
    if criteria.features:
        searchable = " ".join(filter(None, [
            listing.title,
            listing.description,
            listing.features,
            json.dumps(listing.feature_bullets or []),
        ]))
        matched, missing = _match_features(criteria.features, searchable)
        if criteria.features:
            score += round(10 * (len(matched) / len(criteria.features)))
        if matched:
            match_reasons.append(f"✓ Has requested features: {', '.join(matched)}")
        if missing:
            warnings.append(f"Missing features: {', '.join(missing)}")
    else:
        score += 10

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
        for loc_lower in _expand_location_terms(criteria.locations):
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


def _run_for_sale_search(criteria: SearchCriteria, query_text: str, max_results: int, db: Session) -> dict:
    """Body of the original /ai handler, extracted verbatim (only request.query/
    request.max_results renamed to parameters) so it can be called both by /ai
    (after its own extract_search_criteria call) and by /ai/smart-search's
    for_sale branch (criteria already extracted via the unified prompt) —
    avoiding a second, redundant Claude API call for every for-sale query
    routed through the unified endpoint."""
    broker_user_ids: list[int] = []
    broker_query_applied = False
    if _looks_like_broker_query(query_text):
        broker_user_ids = _find_broker_listing_user_ids(query_text, db)
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
    if criteria.max_year:
        query = query.filter(Listing.year <= criteria.max_year)

    # boat_types: only hard-filter to types that actually exist in the active
    # inventory (case-insensitive). The LLM's guessed category names don't
    # always exactly match our stored strings (e.g. "Fishing Boat" vs "Sport
    # Fisher"/"Center Console"); filtering on a guess that doesn't exist would
    # zero out results even though score_listing already handles a boat-type
    # mismatch as a soft penalty rather than an exclusion.
    matching_boat_types: list[str] = []
    if criteria.boat_types:
        requested_types_lower = [t.strip().lower() for t in criteria.boat_types if t and t.strip()]
        if requested_types_lower:
            matching_boat_types = [
                row[0] for row in db.query(func.lower(Listing.boat_type)).filter(
                    Listing.status == "active",
                    Listing.deleted_at.is_(None),
                    func.lower(Listing.boat_type).in_(requested_types_lower),
                ).distinct().all()
            ]
    if matching_boat_types:
        query = query.filter(func.lower(Listing.boat_type).in_(matching_boat_types))

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
    # Expand region words ("Caribbean", "Mediterranean") and state abbreviations
    # into their constituent terms first, since raw region names rarely appear
    # literally in city/state/country/continent columns.
    location_exists_in_db = False
    location_filter_clauses: list = []
    if criteria.locations and not broker_query_applied:
        for loc in _expand_location_terms(criteria.locations):
            loc_like = f"%{loc}%"
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
            "query": query_text,
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
            scored = score_listing(listing, criteria, query_text, db)
            scored_listings.append(scored)
        except Exception:
            pass

    # Step 4: Sort by score and return top results
    scored_listings.sort(key=lambda x: x.score, reverse=True)
    top_results = scored_listings[:max_results]

    # Build search context message for the frontend banner
    search_context: Dict[str, Any] = {}
    if broker_query_applied:
        search_context["broker_match"] = query_text
        search_context["broker_filtered"] = True
    if criteria.boat_types and not matching_boat_types:
        search_context["no_matching_boat_type"] = criteria.boat_types
        search_context["showing_all_boat_types"] = True
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
        "query": query_text,
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
        criteria = extract_search_criteria(request.query)
        return _run_for_sale_search(criteria, request.query, request.max_results, db)
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


# =============================================================================
# Unified (buy vs charter) AI search — additive only. Everything above this
# line (extract_search_criteria, SearchCriteria, score_listing, /ai, /ai/search)
# is left completely untouched so existing callers (AISearchComponent.tsx's
# POST /ai, and BrowseContent.tsx's GET /ai/search ai_query flow) keep working
# byte-for-byte identically.
# =============================================================================

class UnifiedSearchCriteria(BaseModel):
    """Extracted search criteria from natural language, covering both
    yacht-for-sale and charter intents in a single schema."""
    intent: str = "for_sale"  # "for_sale" | "charter"

    # Shared / for-sale fields (same semantics as SearchCriteria)
    make: Optional[str] = None
    model: Optional[str] = None
    boat_name: Optional[str] = None
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
    use_case: Optional[str] = None

    # Charter-specific fields
    min_guests: Optional[int] = None
    max_guests: Optional[int] = None
    min_day_rate: Optional[float] = None
    max_day_rate: Optional[float] = None
    min_week_rate: Optional[float] = None
    max_week_rate: Optional[float] = None
    crew_included: Optional[bool] = None
    trip_length_days: Optional[int] = None
    min_charter_days: Optional[int] = None
    charter_use_case: Optional[str] = None  # honeymoon | family_reunion | dive_trip | fishing_charter | corporate_event | bareboat_sailing | crewed_luxury


class ScoredCharter(BaseModel):
    charter: Dict[str, Any]
    score: int
    match_reasons: List[str]
    warnings: Optional[List[str]] = None


_UNIFIED_SEARCH_PROMPT = """You are a yacht marketplace search assistant. This platform has two kinds of inventory:
1. Yachts FOR SALE (purchase)
2. Yacht CHARTERS (renting a crewed or bareboat vessel for a trip, by the day/week)

First, classify the user's intent, then extract structured search criteria for that intent.

Query: "{query}"

Classify intent as "charter" if the query mentions or implies: renting, chartering, a trip/vacation with a date range or duration ("a week", "long weekend", "5 days"), number of guests/people for a vacation, crewed vs bareboat, day/week rates, destinations framed as a vacation ("in the BVI", "in Greece for a family of 6"), or occasions like honeymoon, family reunion, dive trip, fishing charter, corporate event, bachelor/bachelorette party trip. Classify intent as "for_sale" if the query mentions or implies: buying, purchasing, owning, price/budget framed as a purchase, make/model/year of a boat to own, or has no rental/trip framing at all. Default to "for_sale" if genuinely ambiguous.

Return ONLY a JSON object with these fields (use null for unspecified, and leave charter-only or for-sale-only fields null when they do not apply to the classified intent):
{{
  "intent": "for_sale" | "charter",
  "make": "exact brand/manufacturer name" or null,
  "model": "exact model name" or null,
  "boat_name": "specific vessel/boat name if the query names one, e.g. 'Serenity Now'" or null,
  "boat_types": ["Motor Yacht", "Sailing Yacht", "Catamaran", "Sport Fisher", "Trawler", "Mega Yacht", "Express Cruiser", "Center Console", "Sloop"] or null,
  "min_price": number or null,
  "max_price": number or null,
  "min_length": number (feet) or null,
  "max_length": number (feet) or null,
  "min_year": number or null,
  "max_year": number or null,
  "min_cabins": number or null,
  "min_berths": number (sleeping capacity) or null,
  "locations": ["Florida", "Caribbean", "BVI", "Greece", "Croatia"] or null,
  "features": ["fishing equipment", "party deck", "entertainment system"] or null,
  "use_case": "party" | "fishing" | "cruising" | "racing" | "living" | null,
  "min_guests": number or null,
  "max_guests": number or null,
  "min_day_rate": number or null,
  "max_day_rate": number or null,
  "min_week_rate": number or null,
  "max_week_rate": number or null,
  "crew_included": true | false | null,
  "trip_length_days": number or null,
  "min_charter_days": number or null,
  "charter_use_case": "honeymoon" | "family_reunion" | "dive_trip" | "fishing_charter" | "corporate_event" | "bareboat_sailing" | "crewed_luxury" | null
}}

IMPORTANT — make/model/boat_name extraction:
- If the query mentions a brand name (e.g. "Cheoy Lee", "Azimut", "Hatteras", "Sunseeker", "Ferretti", "Beneteau", "Lagoon", "Fountaine Pajot"), set "make" to that exact brand name.
- If the query mentions a specific model (e.g. "68 Evolution", "Convertible 60"), set "model" to that model name.
- If the query names a specific vessel (e.g. "the boat called Serenity Now", "do you have Bella Vita"), set "boat_name" to that name. Do NOT confuse a vessel name with a make or model.
- Do NOT put brand or model names into "features" — they belong in "make"/"model".
- "boat_types" is a category, not a purpose — use the actual boat-type category the query implies (e.g. "fishing boat"/"offshore fishing" usually means "Sport Fisher" or "Center Console", NOT a made-up type like "Fishing Boat"; "trawler"/"passagemaker" means "Trawler"; "superyacht"/"large crewed yacht" means "Mega Yacht"). Only use values from the list above — never invent a new category string.

Key conversions:
- "10 people" / "party of 8" / "family of 6" = min_guests (charter) or min_berths (for_sale), whichever matches the classified intent
- "week in the BVI" → intent=charter, trip_length_days=7, locations=["BVI"]
- "long weekend" → intent=charter, trip_length_days=3
- "under $50k" for a charter query → max_week_rate if trip framing is a week, otherwise max_day_rate if a day/few days, otherwise set both to the same value as a fallback
- "bareboat" / "bareboat sailing" → intent=charter, crew_included=false, charter_use_case="bareboat_sailing"
- "crewed" → intent=charter, crew_included=true
- "dive trip" / "diving" → intent=charter, charter_use_case="dive_trip"
- "fishing charter" (rental framing) → intent=charter, charter_use_case="fishing_charter"; but "fishing boat under $500k" (purchase framing, has a purchase price) → intent=for_sale, use_case="fishing"
- "party" = for_sale spacious/entertainment features UNLESS framed as a trip/rental, in which case treat as charter with charter_use_case reflecting the occasion
- "luxury" = higher price/rate range, premium features
- "family" = 3+ cabins, safe, comfortable
- Location mentions = add to locations array; use country names ("Mexico", "Greece", "Croatia"), regional names ("Caribbean", "BVI", "Mediterranean", "Pacific Coast"), and US state names as needed
- Cruising-area context like "marina nearby", "resort", "anchorage" describes where the boat operates, NOT the boat itself — do NOT add those to features

Examples:
- "week in the BVI for 8 people under $50k" → intent=charter, locations=["BVI"], trip_length_days=7, min_guests=8, max_week_rate=50000
- "crewed catamaran in Greece for a family of 6" → intent=charter, boat_types=["Catamaran"], locations=["Greece"], min_guests=6, crew_included=true
- "bareboat sailing charter in Croatia" → intent=charter, boat_types=["Sailing Yacht"], locations=["Croatia"], crew_included=false, charter_use_case="bareboat_sailing"
- "long weekend near Miami" → intent=charter, locations=["Miami", "Florida"], trip_length_days=3
- "Fishing boat under $500k in Florida" → intent=for_sale, use_case="fishing", max_price=500000, locations=["Florida"]

Return ONLY valid JSON, no markdown or explanations."""


def extract_unified_criteria(query: str) -> UnifiedSearchCriteria:
    """Use Claude to classify buy-vs-charter intent and extract structured criteria in one call."""

    prompt = _UNIFIED_SEARCH_PROMPT.format(query=query)

    api_key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        return UnifiedSearchCriteria(intent="for_sale", features=[query.lower()])

    try:
        response = _requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-5",
                "max_tokens": 1200,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=20,
        )
        if not response.ok:
            return UnifiedSearchCriteria(intent="for_sale", features=[query.lower()])
        payload = response.json()
        content_list = payload.get("content", [])
        # Some models emit a leading "thinking" block before the actual text
        # block — find the first block that actually has text rather than
        # assuming index 0.
        text_block = next((b for b in content_list if b.get("type") == "text"), None)
        if not text_block:
            return UnifiedSearchCriteria(intent="for_sale", features=[query.lower()])
        content = text_block.get("text", "").strip()
        content = re.sub(r"^```json\s*|\s*```$", "", content).strip()
        criteria_dict = json.loads(content)
        if criteria_dict.get("intent") not in ("for_sale", "charter"):
            criteria_dict["intent"] = "for_sale"
        return UnifiedSearchCriteria(**criteria_dict)
    except Exception:
        return UnifiedSearchCriteria(intent="for_sale", features=[query.lower()])


def _to_legacy_criteria(u: UnifiedSearchCriteria) -> SearchCriteria:
    """Adapter so the for_sale branch can reuse score_listing() unmodified."""
    return SearchCriteria(
        make=u.make,
        model=u.model,
        boat_name=u.boat_name,
        boat_types=u.boat_types,
        min_price=u.min_price,
        max_price=u.max_price,
        min_length=u.min_length,
        max_length=u.max_length,
        min_year=u.min_year,
        max_year=u.max_year,
        min_cabins=u.min_cabins,
        min_berths=u.min_berths,
        locations=u.locations,
        features=u.features,
        use_case=u.use_case,
    )


def score_charter(charter: CharterListing, criteria: UnifiedSearchCriteria, query: str, db: Session = None) -> ScoredCharter:
    """Score a charter listing against extracted criteria — mirrors score_listing's
    weighting philosophy, adapted to charter-specific fields (rates, guests, crew)."""

    score = 0
    max_score = 0
    match_reasons = []
    warnings = []

    # Make match (30 points)
    max_score += 30
    if criteria.make:
        charter_make = (charter.make or "").strip().lower()
        wanted_make = criteria.make.strip().lower()
        if charter_make == wanted_make:
            score += 30
            match_reasons.append(f"✓ Exact make match: {charter.make}")
        elif wanted_make in charter_make or charter_make in wanted_make:
            score += 18
            match_reasons.append(f"✓ Make match: {charter.make}")
        else:
            score += 0
            warnings.append(f"Different make: {charter.make} (searched for {criteria.make})")
    else:
        score += 30

    # Model match (15 points)
    max_score += 15
    if criteria.model:
        charter_model = (charter.model or "").strip().lower()
        wanted_model = criteria.model.strip().lower()
        if charter_model == wanted_model or wanted_model in charter_model or charter_model in wanted_model:
            score += 15
            match_reasons.append(f"✓ Model match: {charter.model}")
        else:
            score += 0
            warnings.append(f"Different model: {charter.model}")
    else:
        score += 15

    # Boat name match (20 points)
    max_score += 20
    if criteria.boat_name:
        charter_name = (charter.vessel_name or charter.title or "").strip().lower()
        wanted_name = criteria.boat_name.strip().lower()
        if wanted_name and (wanted_name in charter_name or charter_name in wanted_name):
            score += 20
            match_reasons.append(f"✓ Matches boat name: {charter.vessel_name or charter.title}")
        else:
            score += 0
            warnings.append(f"Different boat name (searched for \"{criteria.boat_name}\")")
    else:
        score += 20

    # Features/amenities match (10 points)
    max_score += 10
    if criteria.features:
        searchable = " ".join(filter(None, [
            charter.title,
            charter.vessel_name,
            charter.description,
            json.dumps(charter.amenities or []),
        ]))
        matched, missing = _match_features(criteria.features, searchable)
        if criteria.features:
            score += round(10 * (len(matched) / len(criteria.features)))
        if matched:
            match_reasons.append(f"✓ Has requested features: {', '.join(matched)}")
        if missing:
            warnings.append(f"Missing features: {', '.join(missing)}")
    else:
        score += 10

    # Boat type match (15 points)
    max_score += 15
    if criteria.boat_types:
        if charter.boat_type and charter.boat_type in criteria.boat_types:
            score += 15
            match_reasons.append(f"✓ Exact boat type match: {charter.boat_type}")
        else:
            score += 3
            warnings.append(f"Different boat type: {charter.boat_type}")
    else:
        score += 15

    # Rate match (10 points) — prefer day_rate, fall back to week_rate if day_rate is null
    max_score += 10
    wants_rate = criteria.min_day_rate or criteria.max_day_rate or criteria.min_week_rate or criteria.max_week_rate
    if wants_rate:
        rate = charter.day_rate if charter.day_rate is not None else charter.week_rate
        min_rate = criteria.min_day_rate if charter.day_rate is not None else criteria.min_week_rate
        max_rate = criteria.max_day_rate if charter.day_rate is not None else criteria.max_week_rate
        if rate is not None:
            in_range = True
            if min_rate and rate < min_rate:
                in_range = False
            if max_rate and rate > max_rate:
                in_range = False
                warnings.append(f"Above desired rate (${rate:,.0f} > ${max_rate:,.0f})")
            if in_range:
                score += 10
                match_reasons.append(f"✓ Within budget: ${rate:,.0f}")
            else:
                score += 2
        else:
            score += 5
    else:
        score += 10

    # Length match (10 points)
    max_score += 10
    if criteria.min_length or criteria.max_length:
        if charter.length_feet:
            in_range = True
            if criteria.min_length and charter.length_feet < criteria.min_length:
                in_range = False
            if criteria.max_length and charter.length_feet > criteria.max_length:
                in_range = False
            if in_range:
                score += 10
                match_reasons.append(f"✓ Perfect size: {charter.length_feet} feet")
            else:
                score += 3
        else:
            score += 5
    else:
        score += 10

    # Cabins (10 points)
    max_score += 10
    if criteria.min_cabins:
        if charter.cabins and charter.cabins >= criteria.min_cabins:
            score += 10
            match_reasons.append(f"✓ Has {charter.cabins} cabins (need {criteria.min_cabins}+)")
        elif charter.cabins:
            score += 3
            warnings.append(f"Only {charter.cabins} cabins (wanted {criteria.min_cabins}+)")
        else:
            score += 5
    else:
        score += 10

    # Guest capacity (10 points) — replaces score_listing's berths criterion
    max_score += 10
    wanted_guests = criteria.min_guests or criteria.min_berths
    if wanted_guests:
        if charter.max_guests and charter.max_guests >= wanted_guests:
            score += 10
            match_reasons.append(f"✓ Fits {charter.max_guests} guests (need {wanted_guests}+)")
        elif charter.max_guests:
            score += 3
            warnings.append(f"Only fits {charter.max_guests} guests (wanted {wanted_guests}+)")
        else:
            score += 5
    else:
        score += 10

    # Year (5 points)
    max_score += 5
    if criteria.min_year or criteria.max_year:
        if charter.year:
            in_range = True
            if criteria.min_year and charter.year < criteria.min_year:
                in_range = False
            if criteria.max_year and charter.year > criteria.max_year:
                in_range = False
            if in_range:
                score += 5
                match_reasons.append(f"✓ Year: {charter.year}")
            else:
                score += 1
        else:
            score += 2
    else:
        score += 5

    # Location match (20 points) — home port fields + embarkation/disembarkation JSON arrays
    max_score += 20
    if criteria.locations:
        location_match = False
        embark = json.dumps(charter.embarkation_ports or []).lower()
        disembark = json.dumps(charter.disembarkation_ports or []).lower()
        for loc_lower in _expand_location_terms(criteria.locations):
            if (
                (charter.home_port_city and loc_lower in charter.home_port_city.lower())
                or (charter.home_port_state and loc_lower in charter.home_port_state.lower())
                or (charter.home_port_country and loc_lower in charter.home_port_country.lower())
                or (charter.operating_regions and loc_lower in charter.operating_regions.lower())
                or (loc_lower in embark)
                or (loc_lower in disembark)
            ):
                location_match = True
                match_reasons.append(f"✓ Location: {charter.home_port_city or charter.operating_regions}")
                break
        if location_match:
            score += 20
        else:
            score += 0
            warnings.append(f"Different location: {charter.home_port_city or charter.operating_regions}")
    else:
        score += 20

    # Crew preference
    if criteria.crew_included is not None:
        if bool(charter.crew_included) == criteria.crew_included:
            score += 5
            match_reasons.append("✓ Crewed" if criteria.crew_included else "✓ Bareboat")
        else:
            warnings.append("Crewed" if charter.crew_included else "Bareboat, not crewed" if criteria.crew_included else "Comes with crew")

    # Trip length fit
    if criteria.trip_length_days and charter.min_charter_days:
        if criteria.trip_length_days >= charter.min_charter_days:
            score += 5
            match_reasons.append(f"✓ Accepts {criteria.trip_length_days}-day trips")
        else:
            warnings.append(f"Requires minimum {charter.min_charter_days}-day booking (you want {criteria.trip_length_days})")

    # Charter use-case bonus
    if criteria.charter_use_case:
        if criteria.charter_use_case == "bareboat_sailing" and charter.crew_included is False:
            score += 5
            match_reasons.append("✓ Bareboat sailing")
        elif criteria.charter_use_case == "crewed_luxury" and charter.crew_included is True:
            score += 5
            match_reasons.append("✓ Fully crewed")
        elif criteria.charter_use_case == "family_reunion" and charter.cabins and charter.cabins >= 3:
            score += 5
            match_reasons.append("✓ Spacious for a family group")
        elif criteria.charter_use_case == "dive_trip":
            amenities_text = json.dumps(charter.amenities or []).lower() + " " + (charter.description or "").lower()
            if "dive" in amenities_text:
                score += 5
                match_reasons.append("✓ Dive-friendly")

    final_score = min(100, int((score / max_score) * 100)) if max_score else 0

    return ScoredCharter(
        charter=_serialize_charter(charter),
        score=final_score,
        match_reasons=match_reasons,
        warnings=warnings if warnings else None,
    )


@router.post("/ai/smart-search")
async def ai_smart_search(request: AISearchRequest, db: Session = Depends(get_db)):
    """
    Unified AI search: classifies buy-vs-charter intent from natural language,
    then searches the appropriate inventory (Listing or CharterListing).
    """
    try:
        criteria = extract_unified_criteria(request.query)

        if criteria.intent == "charter":
            query = db.query(CharterListing).filter(CharterListing.status == "active")

            # min_day_rate/min_week_rate are NULL-tolerant like their max_ counterparts:
            # many charters only price by day OR week, and the extraction prompt's own
            # "set both to the same value as a fallback" instruction means a stray
            # min_day_rate shouldn't zero out a week-rate-only charter (or vice versa).
            if criteria.min_day_rate is not None:
                query = query.filter(
                    or_(CharterListing.day_rate.is_(None), CharterListing.day_rate >= criteria.min_day_rate)
                )
            if criteria.max_day_rate is not None:
                query = query.filter(
                    or_(CharterListing.day_rate.is_(None), CharterListing.day_rate <= criteria.max_day_rate)
                )
            if criteria.min_week_rate is not None:
                query = query.filter(
                    or_(CharterListing.week_rate.is_(None), CharterListing.week_rate >= criteria.min_week_rate)
                )
            if criteria.max_week_rate is not None:
                query = query.filter(
                    or_(CharterListing.week_rate.is_(None), CharterListing.week_rate <= criteria.max_week_rate)
                )
            if criteria.min_length:
                query = query.filter(CharterListing.length_feet >= criteria.min_length)
            if criteria.max_length:
                query = query.filter(CharterListing.length_feet <= criteria.max_length)
            if criteria.min_year:
                query = query.filter(CharterListing.year >= criteria.min_year)
            if criteria.max_year:
                query = query.filter(CharterListing.year <= criteria.max_year)

            # boat_types: same soft-filter fix as the for-sale branch — only hard-filter
            # to types that actually exist in the active charter inventory.
            matching_boat_types: list[str] = []
            if criteria.boat_types:
                requested_types_lower = [t.strip().lower() for t in criteria.boat_types if t and t.strip()]
                if requested_types_lower:
                    matching_boat_types = [
                        row[0] for row in db.query(func.lower(CharterListing.boat_type)).filter(
                            CharterListing.status == "active",
                            func.lower(CharterListing.boat_type).in_(requested_types_lower),
                        ).distinct().all()
                    ]
            if matching_boat_types:
                query = query.filter(func.lower(CharterListing.boat_type).in_(matching_boat_types))

            # Exact make existence check (avoid zeroing results on a made-up/rare make)
            exact_make_exists = False
            if criteria.make:
                exact_make_exists = db.query(CharterListing.id).filter(
                    CharterListing.status == "active",
                    func.lower(CharterListing.make) == criteria.make.strip().lower(),
                ).first() is not None

            if criteria.make and exact_make_exists:
                candidates_query = query.filter(func.lower(CharterListing.make) == criteria.make.strip().lower())
            else:
                candidates_query = query

            # Location existence check, same narrowing philosophy as /ai
            location_exists_in_db = False
            location_filter_clauses: list = []
            if criteria.locations:
                for loc in _expand_location_terms(criteria.locations):
                    loc_like = f"%{loc}%"
                    location_filter_clauses.append(
                        or_(
                            func.lower(func.coalesce(CharterListing.home_port_city, "")).like(loc_like),
                            func.lower(func.coalesce(CharterListing.home_port_state, "")).like(loc_like),
                            func.lower(func.coalesce(CharterListing.home_port_country, "")).like(loc_like),
                            func.lower(func.coalesce(CharterListing.operating_regions, "")).like(loc_like),
                        )
                    )
                if location_filter_clauses:
                    location_exists_in_db = db.query(CharterListing.id).filter(
                        CharterListing.status == "active",
                        or_(*location_filter_clauses),
                    ).first() is not None

            if location_filter_clauses and location_exists_in_db:
                candidates_query = candidates_query.filter(or_(*location_filter_clauses))

            candidates = candidates_query.limit(50).all()

            if not candidates:
                return {
                    "intent": "charter",
                    "query": request.query,
                    "understood_criteria": criteria.dict(),
                    "search_context": {
                        "no_exact_make": criteria.make if criteria.make and not exact_make_exists else None,
                        "showing_similar": False,
                    },
                    "total_found": 0,
                    "results": [],
                    "message": "No charters found matching your criteria. Try broadening your search.",
                }

            scored = []
            for c in candidates:
                try:
                    scored.append(score_charter(c, criteria, request.query, db))
                except Exception:
                    pass
            scored.sort(key=lambda x: x.score, reverse=True)
            top_results = scored[: request.max_results]

            search_context: Dict[str, Any] = {}
            if criteria.boat_types and not matching_boat_types:
                search_context["no_matching_boat_type"] = criteria.boat_types
                search_context["showing_all_boat_types"] = True
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
                "intent": "charter",
                "query": request.query,
                "understood_criteria": criteria.dict(),
                "search_context": search_context,
                "total_found": len(candidates),
                "results": [
                    {
                        "charter": r.charter,
                        "match_score": r.score,
                        "match_reasons": r.match_reasons,
                        "warnings": r.warnings,
                    }
                    for r in top_results
                ],
            }

        # for_sale branch: reuse the existing /ai handler's query-building + scoring
        # logic via _run_for_sale_search, using the criteria already extracted above
        # (converted through _to_legacy_criteria) — no second Claude call.
        legacy_criteria = _to_legacy_criteria(criteria)
        response = _run_for_sale_search(legacy_criteria, request.query, request.max_results, db)
        response["intent"] = "for_sale"
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI search failed: {str(e)}")
