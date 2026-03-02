from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import os
from datetime import datetime

import anthropic as _anthropic

from app.db.session import get_db
from app.models.listing import Listing

router = APIRouter()


class AISearchRequest(BaseModel):
    query: str
    max_results: int = 10


class SearchCriteria(BaseModel):
    """Extracted search criteria from natural language"""
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


async def extract_search_criteria(query: str) -> SearchCriteria:
    """Use Claude to extract structured search criteria from natural language"""
    
    prompt = f"""You are a yacht search assistant. Extract search criteria from this query:

"{query}"

Return ONLY a JSON object with these fields (use null for unspecified):
{{
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

Key conversions:
- "10 people" = at least 10 berths (sleeping) or estimate cabins
- "party" = spacious deck, entertainment features, 8+ berths
- "fishing" = fishing boat types, fishing equipment
- "luxury" = higher price range, premium features
- "family" = 3+ cabins, safe, comfortable
- Location mentions = add to locations array

Return ONLY valid JSON, no markdown or explanations."""

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return SearchCriteria(features=[query.lower()])

    try:
        client = _anthropic.AsyncAnthropic(api_key=api_key)
        message = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        content = message.content[0].text.strip()
        # Strip markdown fences if present
        if content.startswith("```json"): content = content[7:]
        if content.startswith("```"):     content = content[3:]
        if content.endswith("```"):       content = content[:-3]
        criteria_dict = json.loads(content.strip())
        return SearchCriteria(**criteria_dict)
    except Exception:
        return SearchCriteria(features=[query.lower()])


def score_listing(listing: Listing, criteria: SearchCriteria, query: str) -> ScoredListing:
    """Score a listing based on how well it matches the search criteria"""
    
    score = 0
    max_score = 0
    match_reasons = []
    warnings = []
    
    # Boat type match (20 points)
    max_score += 20
    if criteria.boat_types:
        if listing.boat_type and listing.boat_type in criteria.boat_types:
            score += 20
            match_reasons.append(f"✓ Exact boat type match: {listing.boat_type}")
        else:
            score += 5
            warnings.append(f"Different boat type: {listing.boat_type}")
    else:
        score += 20  # No preference specified
    
    # Price match (15 points)
    max_score += 15
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
                score += 15
                match_reasons.append(f"✓ Within budget: ${listing.price:,.0f}")
            else:
                score += 3
        else:
            score += 7  # Some credit if no price specified
    else:
        score += 15
    
    # Size/Length match (15 points)
    max_score += 15
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
                score += 15
                match_reasons.append(f"✓ Perfect size: {listing.length_feet} feet")
            else:
                score += 5
        else:
            score += 7
    else:
        score += 15
    
    # Capacity - Cabins (15 points)
    max_score += 15
    if criteria.min_cabins:
        if listing.cabins and listing.cabins >= criteria.min_cabins:
            score += 15
            match_reasons.append(f"✓ Has {listing.cabins} cabins (need {criteria.min_cabins}+)")
        elif listing.cabins:
            score += 5
            warnings.append(f"Only {listing.cabins} cabins (wanted {criteria.min_cabins}+)")
        else:
            score += 7
    else:
        score += 15
    
    # Capacity - Berths/People (15 points)
    max_score += 15
    if criteria.min_berths:
        if listing.berths and listing.berths >= criteria.min_berths:
            score += 15
            match_reasons.append(f"✓ Sleeps {listing.berths} people (need {criteria.min_berths}+)")
        elif listing.berths:
            score += 5
            warnings.append(f"Only sleeps {listing.berths} (wanted {criteria.min_berths}+)")
        else:
            score += 7
    else:
        score += 15
    
    # Year/Age (10 points)
    max_score += 10
    if criteria.min_year or criteria.max_year:
        if listing.year:
            in_range = True
            if criteria.min_year and listing.year < criteria.min_year:
                in_range = False
                warnings.append(f"Older than preferred ({listing.year} < {criteria.min_year})")
            if criteria.max_year and listing.year > criteria.max_year:
                in_range = False
            
            if in_range:
                score += 10
                match_reasons.append(f"✓ Year: {listing.year}")
            else:
                score += 3
        else:
            score += 5
    else:
        score += 10
    
    # Location match (10 points)
    max_score += 10
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
            score += 10
        else:
            score += 3
            warnings.append(f"Different location: {listing.city}, {listing.state}")
    else:
        score += 10
    
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
        "images": [{"url": img.url} for img in listing.images[:1]],
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
        criteria = await extract_search_criteria(request.query)
        
        # Step 2: Build database query
        query = db.query(Listing).filter(Listing.status == "active")
        
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
        
        # Get candidate listings (cast wider net for scoring)
        candidates = query.limit(50).all()
        
        if not candidates:
            return {
                "query": request.query,
                "understood_criteria": criteria.dict(),
                "results": [],
                "message": "No yachts found matching your criteria. Try broadening your search."
            }
        
        # Step 3: Score each listing
        scored_listings = []
        for listing in candidates:
            scored = score_listing(listing, criteria, request.query)
            scored_listings.append(scored)
        
        # Step 4: Sort by score and return top results
        scored_listings.sort(key=lambda x: x.score, reverse=True)
        top_results = scored_listings[:request.max_results]
        
        return {
            "query": request.query,
            "understood_criteria": criteria.dict(),
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
