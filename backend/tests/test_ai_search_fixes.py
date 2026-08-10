"""
Deterministic coverage for the five AI-search bug fixes in routes_ai_search.py:
1. boat_type is a soft filter (only hard-filters to a type that actually exists)
2. criteria.features is scored against description/feature_bullets/amenities
3. boat_name lets a user search for a specific vessel by name
4. regional/state location synonyms (Caribbean, Mediterranean, FL<->Florida, ...)
5. charter min_day_rate/min_week_rate are NULL-tolerant like their max_ counterparts

Unlike test_ai_smart_search.py (which exercises the real Claude extraction step
end-to-end), these tests bypass the LLM — for-sale cases call _run_for_sale_search
directly with a hand-built SearchCriteria, and charter cases monkeypatch
extract_unified_criteria — so each fix is pinned down deterministically against
the real dev DB rather than depending on what the model happens to extract.
"""
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.listing import Listing
from app.models.charter import CharterListing
from app.api.routes_ai_search import (
    SearchCriteria,
    UnifiedSearchCriteria,
    _run_for_sale_search,
    score_listing,
    score_charter,
)
import app.api.routes_ai_search as ai_search_module


def _unique_email() -> str:
    return f"pytest-aifix-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def owner(db):
    """A plain active, non-demo user to own throwaway listings/charters."""
    email = _unique_email()
    user = User(
        email=email,
        password_hash="x",
        first_name="Pytest",
        last_name="Owner",
        user_type="user",
        active=True,
        is_demo=False,
        always_free=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    db.query(User).filter(User.id == user.id).delete()
    db.commit()


@pytest.fixture
def cleanup_listings(db):
    ids = []
    yield ids
    for lid in ids:
        listing = db.query(Listing).filter(Listing.id == lid).first()
        if listing:
            db.delete(listing)
    db.commit()


@pytest.fixture
def cleanup_charters(db):
    ids = []
    yield ids
    for cid in ids:
        charter = db.query(CharterListing).filter(CharterListing.id == cid).first()
        if charter:
            db.delete(charter)
    db.commit()


def _make_listing(db, owner, cleanup_listings, **overrides):
    defaults = dict(
        user_id=owner.id,
        created_by_user_id=owner.id,
        title="Pytest Fix Listing",
        bin=uuid.uuid4().hex[:12].upper(),
        status="active",
        condition="used",
        make="TestMake",
        model="TestModel",
        year=2015,
        price=250000,
        boat_type="Center Console",
        length_feet=40,
        cabins=2,
        berths=6,
        country="United States",
        state="Florida",
        city="Miami",
        description="A solid boat.",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    defaults.update(overrides)
    listing = Listing(**defaults)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    cleanup_listings.append(listing.id)
    return listing


def _make_charter(db, owner, cleanup_charters, **overrides):
    defaults = dict(
        user_id=owner.id,
        title="Pytest Fix Charter",
        vessel_name="Pytest Vessel",
        slug=f"pytest-fix-{uuid.uuid4().hex[:8]}",
        make="TestMake",
        model="TestModel",
        year=2018,
        boat_type="Catamaran",
        cabins=3,
        max_guests=8,
        crew_included=True,
        length_feet=45,
        home_port_city="Athens",
        home_port_country="Greece",
        day_rate=None,
        week_rate=20000,
        currency="USD",
        min_charter_days=5,
        description="A solid charter.",
        status="active",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    defaults.update(overrides)
    charter = CharterListing(**defaults)
    db.add(charter)
    db.commit()
    db.refresh(charter)
    cleanup_charters.append(charter.id)
    return charter


# ---------------------------------------------------------------------------
# Fix #2: features scoring
# ---------------------------------------------------------------------------

def test_features_scored_for_listing(db, owner, cleanup_listings):
    matching = _make_listing(db, owner, cleanup_listings, description="Comes with a huge jacuzzi on the sundeck.")
    non_matching = _make_listing(db, owner, cleanup_listings, description="No special extras.")

    criteria = SearchCriteria(features=["jacuzzi"])
    scored_match = score_listing(matching, criteria, "jacuzzi boat", db)
    scored_non_match = score_listing(non_matching, criteria, "jacuzzi boat", db)

    assert scored_match.score > scored_non_match.score
    assert any("jacuzzi" in r.lower() for r in scored_match.match_reasons)
    assert scored_non_match.warnings and any("missing features" in w.lower() for w in scored_non_match.warnings)


def test_features_scored_for_charter(db, owner, cleanup_charters):
    matching = _make_charter(db, owner, cleanup_charters, description="Includes full dive gear and jacuzzi.")
    non_matching = _make_charter(db, owner, cleanup_charters, description="Standard fit-out.")

    criteria = UnifiedSearchCriteria(intent="charter", features=["dive gear"])
    scored_match = score_charter(matching, criteria, "dive charter", db)
    scored_non_match = score_charter(non_matching, criteria, "dive charter", db)

    assert scored_match.score > scored_non_match.score
    assert any("dive gear" in r.lower() for r in scored_match.match_reasons)
    assert scored_non_match.warnings and any("missing features" in w.lower() for w in scored_non_match.warnings)


# ---------------------------------------------------------------------------
# Fix #3: boat_name scoring
# ---------------------------------------------------------------------------

def test_boat_name_scored_for_listing(db, owner, cleanup_listings):
    named = _make_listing(db, owner, cleanup_listings, title="Serenity Now")
    other = _make_listing(db, owner, cleanup_listings, title="Completely Different Boat")

    criteria = SearchCriteria(boat_name="Serenity Now")
    scored_named = score_listing(named, criteria, "Serenity Now", db)
    scored_other = score_listing(other, criteria, "Serenity Now", db)

    assert scored_named.score > scored_other.score
    assert any("matches boat name" in r.lower() for r in scored_named.match_reasons)
    assert scored_other.warnings and any("different boat name" in w.lower() for w in scored_other.warnings)


def test_boat_name_scored_for_charter(db, owner, cleanup_charters):
    named = _make_charter(db, owner, cleanup_charters, vessel_name="Bella Vita")
    other = _make_charter(db, owner, cleanup_charters, vessel_name="Something Else")

    criteria = UnifiedSearchCriteria(intent="charter", boat_name="Bella Vita")
    scored_named = score_charter(named, criteria, "Bella Vita", db)
    scored_other = score_charter(other, criteria, "Bella Vita", db)

    assert scored_named.score > scored_other.score
    assert any("matches boat name" in r.lower() for r in scored_named.match_reasons)
    assert scored_other.warnings and any("different boat name" in w.lower() for w in scored_other.warnings)


# ---------------------------------------------------------------------------
# Fix #4: regional/state location synonym expansion
# ---------------------------------------------------------------------------

def test_location_region_synonym_scores_for_listing(db, owner, cleanup_listings):
    listing = _make_listing(db, owner, cleanup_listings, country="Greece", state=None, city="Athens")
    criteria = SearchCriteria(locations=["Mediterranean"])
    scored = score_listing(listing, criteria, "mediterranean yacht", db)
    assert any("location" in r.lower() for r in scored.match_reasons)
    assert not any("different location" in w.lower() for w in (scored.warnings or []))


def test_location_region_synonym_scores_for_charter(db, owner, cleanup_charters):
    charter = _make_charter(db, owner, cleanup_charters, home_port_country="Croatia")
    criteria = UnifiedSearchCriteria(intent="charter", locations=["Mediterranean"])
    scored = score_charter(charter, criteria, "mediterranean charter", db)
    assert any("location" in r.lower() for r in scored.match_reasons)
    assert not any("different location" in w.lower() for w in (scored.warnings or []))


def test_location_state_abbreviation_synonym(db, owner, cleanup_listings):
    listing = _make_listing(db, owner, cleanup_listings, state="FL", country="United States")
    criteria = SearchCriteria(locations=["Florida"])
    scored = score_listing(listing, criteria, "florida boat", db)
    assert any("location" in r.lower() for r in scored.match_reasons)


# ---------------------------------------------------------------------------
# Fix #1 (for-sale side): boat_type soft filter + max_year filter, via the
# real query-building function (_run_for_sale_search)
# ---------------------------------------------------------------------------

def test_boat_type_soft_filter_for_sale(db, owner, cleanup_listings):
    listing = _make_listing(db, owner, cleanup_listings, boat_type="Center Console", title="Pytest Soft Filter CC")

    criteria = SearchCriteria(boat_types=["Sport Fisher"])
    result = _run_for_sale_search(criteria, "sport fisher", 50, db)

    result_ids = [r["listing"]["id"] for r in result["results"]]
    assert listing.id in result_ids
    assert result["search_context"].get("no_matching_boat_type") == ["Sport Fisher"]
    assert result["search_context"].get("showing_all_boat_types") is True


def test_boat_type_still_hard_filters_when_type_exists(db, owner, cleanup_listings):
    motor_yacht = _make_listing(db, owner, cleanup_listings, boat_type="Motor Yacht", title="Pytest MY Exists")
    center_console = _make_listing(db, owner, cleanup_listings, boat_type="Center Console", title="Pytest CC Exists")

    criteria = SearchCriteria(boat_types=["Motor Yacht"])
    result = _run_for_sale_search(criteria, "motor yacht", 50, db)

    result_ids = [r["listing"]["id"] for r in result["results"]]
    assert motor_yacht.id in result_ids
    assert center_console.id not in result_ids
    assert "no_matching_boat_type" not in result["search_context"]


def test_location_synonym_filters_for_sale_search(db, owner, cleanup_listings):
    listing = _make_listing(db, owner, cleanup_listings, country="Greece", state=None, city="Athens", title="Pytest Med Listing")

    criteria = SearchCriteria(locations=["Mediterranean"])
    result = _run_for_sale_search(criteria, "mediterranean yacht", 50, db)

    result_ids = [r["listing"]["id"] for r in result["results"]]
    assert listing.id in result_ids
    assert result["search_context"].get("location_filtered") == ["Mediterranean"]
    assert "no_location_match" not in result["search_context"]


def test_max_year_hard_filter_for_sale(db, owner, cleanup_listings):
    new_listing = _make_listing(db, owner, cleanup_listings, year=2020, title="Pytest New Year")

    criteria = SearchCriteria(max_year=2010)
    result = _run_for_sale_search(criteria, "old boat", 50, db)

    result_ids = [r["listing"]["id"] for r in result["results"]]
    all_candidate_ids = result_ids  # top_results only, but max_year is a hard DB filter so it's enough
    assert new_listing.id not in all_candidate_ids


def test_boat_name_ranks_first_for_sale(db, owner, cleanup_listings):
    named = _make_listing(db, owner, cleanup_listings, title="Serenity Now Unique Pytest")
    _make_listing(db, owner, cleanup_listings, title="Some Other Boat Pytest")

    criteria = SearchCriteria(boat_name="Serenity Now Unique Pytest")
    result = _run_for_sale_search(criteria, "Serenity Now Unique Pytest", 50, db)

    assert result["results"], "expected at least one result"
    assert result["results"][0]["listing"]["id"] == named.id
    assert result["results"][0]["match_score"] == 100


# ---------------------------------------------------------------------------
# Fix #1 (charter side) + Fix #5 (rate NULL-tolerance) + Fix #4 (charter
# location synonyms), via the real endpoint with a monkeypatched extractor
# so no LLM call is involved.
# ---------------------------------------------------------------------------

def _patch_unified_criteria(monkeypatch, criteria: UnifiedSearchCriteria):
    monkeypatch.setattr(ai_search_module, "extract_unified_criteria", lambda query: criteria)


def test_charter_boat_type_soft_filter(client, monkeypatch, db, owner, cleanup_charters):
    charter = _make_charter(db, owner, cleanup_charters, boat_type="Catamaran", vessel_name="Pytest Soft Filter Cat")

    _patch_unified_criteria(monkeypatch, UnifiedSearchCriteria(intent="charter", boat_types=["Trawler"]))
    res = client.post("/api/ai/smart-search", json={"query": "trawler charter", "max_results": 50})
    assert res.status_code == 200
    data = res.json()
    charter_ids = [r["charter"]["id"] for r in data["results"]]
    assert charter.id in charter_ids
    assert data["search_context"].get("no_matching_boat_type") == ["Trawler"]


def test_charter_rate_null_tolerance(client, monkeypatch, db, owner, cleanup_charters):
    day_only = _make_charter(
        db, owner, cleanup_charters, day_rate=1500, week_rate=None, vessel_name="Pytest Day Rate Only"
    )
    week_only = _make_charter(
        db, owner, cleanup_charters, day_rate=None, week_rate=9000, vessel_name="Pytest Week Rate Only"
    )

    # Mirrors the extraction prompt's fallback of setting both min_day_rate and
    # min_week_rate to the same value when trip framing is ambiguous.
    _patch_unified_criteria(
        monkeypatch,
        UnifiedSearchCriteria(intent="charter", min_day_rate=1000, min_week_rate=5000),
    )
    res = client.post("/api/ai/smart-search", json={"query": "charter over budget", "max_results": 50})
    assert res.status_code == 200
    data = res.json()
    charter_ids = [r["charter"]["id"] for r in data["results"]]
    assert day_only.id in charter_ids, "day-rate-only charter wrongly excluded by min_week_rate filter"
    assert week_only.id in charter_ids, "week-rate-only charter wrongly excluded by min_day_rate filter"


def test_charter_location_synonym_via_endpoint(client, monkeypatch, db, owner, cleanup_charters):
    charter = _make_charter(db, owner, cleanup_charters, home_port_country="Croatia", vessel_name="Pytest Med Charter")

    _patch_unified_criteria(monkeypatch, UnifiedSearchCriteria(intent="charter", locations=["Mediterranean"]))
    res = client.post("/api/ai/smart-search", json={"query": "mediterranean charter", "max_results": 50})
    assert res.status_code == 200
    data = res.json()
    charter_ids = [r["charter"]["id"] for r in data["results"]]
    assert charter.id in charter_ids
    assert data["search_context"].get("location_filtered") == ["Mediterranean"]
