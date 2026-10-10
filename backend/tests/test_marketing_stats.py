"""Market statistics for the marketing agent's data-backed posts.

The numbers end up in published articles, so the rules are tested hard: USD only, unpriced
listings never counted as zero, small samples flagged, and the endpoint applies the same
visibility rules as the public site (no demo, unpaid, deleted, inactive, or scraped listings).
Uses a private in-memory SQLite database; the Postgres-only full-text index is left out of the copy.
"""
import itertools
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import routes_marketing_feed as feed
from app.db.session import get_db
from app.main import app
from app.models.listing import Listing
from app.models.media import ListingMediaAttachment, MediaFile
from app.models.user import User
from app.services.marketing_stats import MIN_SAMPLE, summarize

SITE = "https://yachtversal.com"


def row(i, price=100_000, **kw):
    base = {"id": i, "title": f"Boat {i}", "price": price, "currency": "USD", "year": 2015, "make": "Beneteau",
            "length_feet": 40.0, "city": "Miami", "state": "FL", "boat_type": "Sailing Yacht"}
    base.update(kw)
    return base


# --- pure calculations ---------------------------------------------------------------------------

def test_quartiles_and_range_over_a_simple_set():
    rows = [row(i, price=p) for i, p in enumerate([100, 200, 300, 400, 500, 600, 700, 800, 900], start=1)]
    price = summarize(rows, SITE)["price"]
    assert price == {"min": 100, "p25": 300, "median": 500, "p75": 700, "max": 900}


def test_unpriced_listings_are_counted_but_never_treated_as_zero():
    rows = [row(1, price=200_000), row(2, price=None), row(3, price=0), row(4, price=400_000)]
    s = summarize(rows, SITE)
    assert s["total_listings"] == 4 and s["priced_listings"] == 2 and s["unpriced_listings"] == 2
    assert s["price"]["min"] == 200_000      # not dragged down by the missing prices
    assert s["price"]["median"] == 300_000


def test_other_currencies_are_excluded_from_prices_and_reported():
    rows = [row(1, price=100_000), row(2, price=90_000, currency="EUR"), row(3, price=300_000)]
    s = summarize(rows, SITE)
    assert s["priced_listings"] == 2 and s["non_usd_listings"] == 1
    assert s["price"]["max"] == 300_000


def test_a_missing_currency_is_treated_as_usd_like_the_rest_of_the_site():
    assert summarize([row(1, currency=None)], SITE)["priced_listings"] == 1


def test_small_samples_are_flagged():
    few = summarize([row(i) for i in range(MIN_SAMPLE - 1)], SITE)
    enough = summarize([row(i) for i in range(MIN_SAMPLE)], SITE)
    assert few["sample_small"] is True and enough["sample_small"] is False


def test_a_single_listing_does_not_crash_the_quartiles():
    s = summarize([row(1, price=250_000)], SITE)
    assert s["price"] == {"min": 250_000, "p25": 250_000, "median": 250_000, "p75": 250_000, "max": 250_000}


def test_empty_input_is_safe():
    s = summarize([], SITE)
    assert s["total_listings"] == 0 and s["price"] is None and s["examples"] == [] and s["sample_small"] is True
    assert s["length_feet"] is None and s["year"] is None and s["top_makes"] == []


def test_examples_are_real_boats_spread_across_the_range_with_site_links():
    rows = [row(i, price=i * 10_000) for i in range(1, 21)]
    examples = summarize(rows, SITE)["examples"]
    assert [e["id"] for e in examples] == [6, 11, 16]
    assert examples[0]["price"] < examples[1]["price"] < examples[2]["price"]
    assert examples[0]["url"] == "https://yachtversal.com/listings/6"


def test_examples_never_repeat_when_there_are_few_listings():
    ids = [e["id"] for e in summarize([row(1), row(2)], SITE)["examples"]]
    assert len(ids) == len(set(ids))


def test_size_age_and_top_lists():
    rows = [row(1, year=2010, length_feet=30, make="Sabre", state="RI"),
            row(2, year=2020, length_feet=50, make="Sabre", state="RI"),
            row(3, year=2015, length_feet=40, make="Grand Banks", state="FL"),
            row(4, make="", state=None)]
    s = summarize(rows, SITE)
    assert s["year"] == {"min": 2010, "median": 2015, "max": 2020}
    assert s["length_feet"] == {"min": 30.0, "median": 40.0, "max": 50.0}
    assert s["top_makes"][0] == {"name": "Sabre", "count": 2}
    assert all(m["name"] for m in s["top_makes"])        # blanks are never reported as a make
    assert s["top_states"][0] == {"name": "RI", "count": 2}


# --- the endpoint, against real rows -----------------------------------------------------------------

@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    meta = MetaData()

    def copy_with_dependencies(table):
        if table.name in meta.tables:
            return
        copied = table.to_metadata(meta)
        for index in [i for i in copied.indexes if "fulltext" in (i.name or "")]:   # Postgres-only index
            copied.indexes.discard(index)
        for fk in table.foreign_keys:
            copy_with_dependencies(fk.column.table)

    copy_with_dependencies(Listing.__table__)
    copy_with_dependencies(ListingMediaAttachment.__table__)   # example photos
    copy_with_dependencies(MediaFile.__table__)
    meta.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def http(db, monkeypatch):
    monkeypatch.setenv("MARKETING_FEED_KEY", "k")
    monkeypatch.setenv("BASE_URL", SITE)
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app, headers={"X-Marketing-Key": "k"})
    app.dependency_overrides.clear()


def broker(db, email="b@example.test", **kw):
    kw.setdefault("always_free", True)
    user = User(email=email, password_hash="x", user_type="dealer", **kw)
    db.add(user)
    db.commit()
    return user


_bin = itertools.count(1)


def listing(db, owner, price=100_000, **kw):
    fields = dict(user_id=owner.id, bin=f"TESTBIN{next(_bin):05d}", title="A boat", status="active", price=price,
                  currency="USD", year=2015,
                  make="Beneteau", model="41", length_feet=40.0, city="Miami", state="FL",
                  boat_type="Sailing Yacht", condition="used", source="manual")
    fields.update(kw)
    row_ = Listing(**fields)
    db.add(row_)
    db.commit()
    return row_


def stats(http, **params):
    response = http.get("/api/marketing/market-stats", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_counts_only_what_the_public_site_would_show(http, db):
    good = broker(db)
    listing(db, good, price=200_000)
    listing(db, good, price=300_000)
    listing(db, good, status="draft")                                    # not live
    listing(db, good, deleted_at=datetime.utcnow())                      # deleted
    listing(db, good, source="broker_scrape")                            # not entered by a broker
    unpaid = broker(db, email="u@example.test", always_free=False)       # no payment on file
    listing(db, unpaid)
    demo = broker(db, email="d@example.test", is_demo=True)
    listing(db, demo)

    s = stats(http)
    assert s["total_listings"] == 2 and s["price"]["median"] == 250_000


def test_filters_narrow_the_set(http, db):
    owner = broker(db)
    listing(db, owner, boat_type="Sailing Yacht", length_feet=40, price=200_000, year=2012, make="Beneteau", state="FL")
    listing(db, owner, boat_type="Sailing Yacht", length_feet=55, price=900_000, year=2020, make="Hallberg-Rassy", state="RI")
    listing(db, owner, boat_type="Motor Yacht", length_feet=42, price=500_000, year=2018, make="Sabre", state="RI")

    assert stats(http, boat_type="sailing")["total_listings"] == 2
    assert stats(http, boat_type="sailing", min_length=35, max_length=45)["total_listings"] == 1
    assert stats(http, state="ri")["total_listings"] == 2
    assert stats(http, make="sabre")["total_listings"] == 1
    assert stats(http, min_year=2015)["total_listings"] == 2
    assert stats(http, max_year=2013)["total_listings"] == 1
    assert stats(http, boat_type="sailing", min_length=35, max_length=45)["filters"] == {
        "boat_type": "sailing", "min_length": 35.0, "max_length": 45.0}


def test_response_carries_its_date_examples_and_facets(http, db):
    owner = broker(db)
    for i in range(10):
        listing(db, owner, price=100_000 + i * 10_000, title=f"Boat {i}")
    s = stats(http)
    assert s["as_of"] == datetime.utcnow().date().isoformat()
    assert s["priced_listings"] == 10 and s["sample_small"] is False
    assert len(s["examples"]) == 3 and all(e["url"].startswith(SITE + "/listings/") for e in s["examples"])
    assert all("image_url" in e for e in s["examples"])
    assert s["boat_types"][0]["name"] == "Sailing Yacht" and s["top_makes"][0]["name"] == "Beneteau"
    assert s["truncated"] is False


def test_empty_result_is_a_valid_answer_not_an_error(http, db):
    broker(db)
    s = stats(http, boat_type="submarine")
    assert s["total_listings"] == 0 and s["price"] is None


@pytest.mark.parametrize("bad", [{"min_length": -1}, {"min_year": 1500}, {"max_length": 99999}])
def test_nonsense_filters_are_rejected(http, bad):
    assert http.get("/api/marketing/market-stats", params=bad).status_code == 422


def test_requires_the_marketing_key(db, monkeypatch):
    monkeypatch.setenv("MARKETING_FEED_KEY", "k")
    app.dependency_overrides[get_db] = lambda: db
    try:
        anon = TestClient(app)
        assert anon.get("/api/marketing/market-stats").status_code == 401
        assert anon.get("/api/marketing/market-stats", headers={"X-Marketing-Key": "nope"}).status_code == 401
        monkeypatch.delenv("MARKETING_FEED_KEY")
        assert anon.get("/api/marketing/market-stats", headers={"X-Marketing-Key": "k"}).status_code == 503
    finally:
        app.dependency_overrides.clear()
