"""
Deterministic coverage for the scraper reliability fixes in
app/services/scraper.py, app/services/master_ocean.py, and
app/services/yachtworld_api.py:

1. Archival safety threshold — a partial/broken discovery run must not be
   able to mass-archive a dealer's live inventory (never delete, only archive).
2. Job locking — concurrent runs of the same ScraperJob are prevented via an
   atomic status compare-and-swap.
3. Price extraction — avoids grabbing a superseded/related-listing price
   instead of the current asking price.
4. Unit conversion — meters are converted to feet instead of silently stored
   as if they were already feet.
5. Currency defaulting — AUD/NZD sites are no longer silently defaulted to USD
   the way only CAD previously was.
6. _apply_scraped_data numeric bounds — implausible values (from a scrape OR
   a "trusted" API feed) are rejected instead of written to the DB, and a
   large price swing on re-scrape is flagged for review instead of silently
   applied.

Pure-function tests (price/unit/currency extraction, _apply_scraped_data)
need no DB. The archival-threshold and job-locking tests exercise
run_scraper_job end-to-end against the real dev DB, with the network/discovery
step monkeypatched out so they're deterministic and don't hit a real site.
"""
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.main import app  # noqa: F401 — registers all SQLAlchemy model relationships
from app.db.session import SessionLocal
from app.models.user import User
from app.models.listing import Listing
from app.models.misc import ScraperJob, ScrapedListing, RawScrapedPage, YachtworldSyncJob
from app.services import scraper as scraper_module
from app.services.scraper import OptimizedYachtScraper, _apply_scraped_data, run_scraper_job
from app.services import master_ocean
from app.services import yachtworld_api
from app.services.yachtworld_api import sync_yachtworld_job, run_due_yachtworld_jobs


def _unique_email() -> str:
    return f"pytest-scraperfix-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def owner(db):
    user = User(
        email=_unique_email(), password_hash="x", first_name="Pytest", last_name="Owner",
        user_type="user", active=True, is_demo=False, always_free=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    yield user
    # Same reasoning as the `cleanup` fixture below: don't rely on `db` still
    # being attached/open by teardown time — run_scraper_job may have closed it.
    teardown_db = SessionLocal()
    try:
        teardown_db.query(User).filter(User.id == user_id).delete()
        teardown_db.commit()
    finally:
        teardown_db.close()


@pytest.fixture
def cleanup():
    # run_scraper_job/run_due_scraper_jobs manage their own DB session lifecycle
    # internally (closing/reopening the session passed in across network calls),
    # which detaches any ORM objects the test created against its own `db`
    # fixture session. Teardown therefore uses a fresh, independent session
    # rather than the (possibly-closed/detached) `db` fixture — a bulk
    # id-filtered delete doesn't need attached instances anyway.
    job_ids, listing_ids, yw_job_ids = [], [], []
    yield {"job_ids": job_ids, "listing_ids": listing_ids, "yw_job_ids": yw_job_ids}
    cleanup_db = SessionLocal()
    try:
        for jid in job_ids:
            # RawScrapedPage has an FK to scraper_jobs with no cascade (same
            # ordering the admin "delete job" endpoint uses) — must delete
            # before the job, or the job delete fails with a FK violation.
            cleanup_db.query(RawScrapedPage).filter(RawScrapedPage.job_id == jid).delete()
            cleanup_db.query(ScrapedListing).filter(ScrapedListing.job_id == jid).delete()
            cleanup_db.query(ScraperJob).filter(ScraperJob.id == jid).delete()
        for jid in yw_job_ids:
            cleanup_db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == jid).delete()
        for lid in listing_ids:
            listing = cleanup_db.query(Listing).filter(Listing.id == lid).first()
            if listing:
                cleanup_db.delete(listing)
        cleanup_db.commit()
    finally:
        cleanup_db.close()


# ---------------------------------------------------------------------------
# Pure-function fixes — no DB needed
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def scraper():
    return OptimizedYachtScraper(api_key="")


def test_price_extraction_avoids_superseded_price(scraper):
    cases = [
        ("Reduced from $650,000 to $549,000. Great boat.", 549000.0),
        ("Was $650,000 Now $549,000", 549000.0),
        ("Original List Price: $650,000. Reduced Price: $549,000. Call today.", 549000.0),
        ("You may also like: 2015 Sea Ray $120,000. Asking Price: $549,000", 549000.0),
    ]
    for text, expected in cases:
        result = scraper.extract_price_with_currency(text)
        assert result is not None, f"expected a match for {text!r}"
        assert result[0] == expected, f"{text!r} -> {result}, expected {expected}"


def test_unit_conversion_meters_to_feet(scraper):
    cases = [
        ("LOA: 18.5m Beautiful yacht", 60.7),
        ("Length: 18,50 m", 60.7),
        ("Length: 60 ft", 60.0),
    ]
    for text, expected in cases:
        specs = scraper.extract_specs_from_text(text)
        got = specs.get("length_feet")
        assert got is not None and abs(got - expected) < 0.5, f"{text!r} -> {got}, expected ~{expected}"


def test_unit_conversion_spec_table(scraper):
    html = """
    <table><tr><td>Length</td><td>18,50 m</td></tr>
    <tr><td>Beam</td><td>5.2m</td></tr></table>
    """
    specs = scraper.parse_spec_tables(html)
    assert abs(specs["length_feet"] - 60.7) < 0.5
    assert abs(specs["beam_feet"] - 17.06) < 0.5


def test_currency_defaulting_aud_nzd_not_forced_to_usd(scraper):
    aud = scraper.extract_price_with_currency("Price $1,250,000. Sydney, Australia. AUD pricing.")
    nzd = scraper.extract_price_with_currency("Price $1,250,000. New Zealand based broker. NZD.")
    usd = scraper.extract_price_with_currency("Price $1,250,000. Miami, FL, USA.")
    assert aud[1] == "AUD"
    assert nzd[1] == "NZD"
    assert usd[1] == "USD"


def test_apply_scraped_data_rejects_implausible_values():
    listing = Listing(title="Test", bin=uuid.uuid4().hex[:12].upper(), condition="used")
    job = SimpleNamespace(dealer_id=1, salesman_id=None)
    raw = {
        "price": 549000,
        "length_feet": 45,
        "cabins": 250,       # implausible — should be rejected
        "year": 9999,        # implausible — should be rejected
        "beam_feet": 14,
    }
    _apply_scraped_data(listing, raw, job)
    assert listing.price == 549000
    assert listing.length_feet == 45
    assert listing.beam_feet == 14
    assert listing.cabins is None, "implausible cabins value should have been rejected"
    assert listing.year is None, "implausible year value should have been rejected"


def test_apply_scraped_data_flags_large_price_swing_instead_of_overwriting():
    listing = Listing(title="Test", bin=uuid.uuid4().hex[:12].upper(), condition="used", price=500000)
    job = SimpleNamespace(dealer_id=1, salesman_id=None)
    _apply_scraped_data(listing, {"price": 5000}, job)  # >80% swing
    assert listing.price == 500000, "large price swing should not silently overwrite"
    assert listing.additional_specs and "price_review_pending" in listing.additional_specs

    _apply_scraped_data(listing, {"price": 480000}, job)  # modest, legitimate change
    assert listing.price == 480000, "a modest price change should apply normally"


def test_headless_discovery_follows_pagination(scraper, monkeypatch):
    """_discover_with_headless must follow pagination links found in the
    *rendered* HTML, not just harvest listings from whichever single page it
    was seeded with. Reproduces the bviyachtsales.com case: the static crawl
    finds no pagination links (its fetch is blocked, so it never sees real
    content), the headless fallback renders page 1 fine and used to stop
    there — this locks in that page 2+ now gets visited too."""
    # The real bviyachtsales.com pagination link has its own trailing query
    # string — "/yachts/page/2/?exclude_sold=1" — which must both (a) still
    # be recognized as pagination (a bare end-of-string "$" anchor would miss
    # it) and (b) be preserved when queued, not stripped down to the bare
    # path, since the site needs that param for correct pagination.
    page_1_html = """
    <html><body>
        <a href="/yachts/2024-Test-Yacht-One">Yacht One</a>
        <a href="/yachts/2024-Test-Yacht-Two">Yacht Two</a>
        <a href="/yachts/page/2/?exclude_sold=1">2</a>
    </body></html>
    """
    page_2_html = """
    <html><body>
        <a href="/yachts/2024-Test-Yacht-Three">Yacht Three</a>
    </body></html>
    """
    fetched_urls = []

    def fake_fetch_headless(self, url, wait_selector=None, timeout=30):
        fetched_urls.append(url)
        if url.rstrip('/').endswith('/yachts'):
            return page_1_html
        if '/page/2/' in url:
            return page_2_html
        return None

    monkeypatch.setattr(scraper_module, "_PLAYWRIGHT_AVAILABLE", True)
    monkeypatch.setattr(OptimizedYachtScraper, "fetch_page_headless", fake_fetch_headless)

    # Use the real (broad) production pattern for this site's inventory
    # segment — "/yacht[s]?/" — not a narrower one. It matches listing paths
    # AND "/yachts/page/2/" (since that path also contains "/yachts/"), which
    # is exactly the ambiguity that caused pagination links to be misclassified
    # as listings and silently dropped from the crawl queue.
    found = scraper._discover_with_headless(
        "https://bviyachtsales.test",
        [("https://bviyachtsales.test/yachts", True)],
        inventory_keywords=["/yachts"],
        listing_path_patterns=[r"/yacht[s]?/"],
    )

    assert any("Yacht-One" in u for u in found), "page 1 listings should be found"
    assert any("Yacht-Three" in u for u in found), "page 2 (reached via discovered pagination) listings should be found"
    assert any("/page/2/" in u for u in fetched_urls), "pagination link discovered in rendered HTML should have been followed"
    assert not any("/page/2/" in u for u in found), "the pagination link itself must not be misclassified as a listing"
    assert any("exclude_sold=1" in u for u in fetched_urls), "the pagination link's own query string must be preserved, not stripped"


def test_proxy_auth_failure_is_flagged_distinctly_from_a_site_block(scraper, monkeypatch):
    """An expired/invalid ScraperAPI subscription (401/403 from ScraperAPI
    itself) must be flagged on the scraper instance so run_scraper_job can
    surface it as job.last_error — otherwise it's indistinguishable from the
    target site blocking us, and every recurrence needs a fresh investigation."""
    monkeypatch.setattr(scraper_module, "_SCRAPER_PROXY_URL", "http://scraperapi:badkey@proxy-server.scraperapi.com:8001")

    class _FakeResp:
        status_code = 401
        text = "Invalid API key or subscription expired"

    def fake_get(url, headers=None, params=None, timeout=None):
        assert "api.scraperapi.com" in url
        return _FakeResp()

    monkeypatch.setattr(scraper_module.requests, "get", fake_get)

    assert scraper._proxy_auth_failed is None
    result = scraper._proxy_fetch("https://example.test/yachts")
    assert result is None
    assert scraper._proxy_auth_failed is not None
    assert "401" in scraper._proxy_auth_failed
    scraper._proxy_auth_failed = None  # reset — `scraper` fixture is module-scoped/shared


def test_master_ocean_archive_disappeared_only_archives_never_deletes(db, owner, cleanup):
    """_archive_disappeared must flip Listing.status, never touch deleted_at."""
    job = ScraperJob(
        dealer_id=owner.id, broker_url="https://master-ocean.com", site_name="pytest MO",
        enabled=True, status="idle", site_template={"api_type": "master_ocean", "api_key": "x"},
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    cleanup["job_ids"].append(job.id)

    listing = Listing(
        user_id=owner.id, created_by_user_id=owner.id, title="Pytest MO Listing",
        bin=uuid.uuid4().hex[:12].upper(), status="active", condition="used",
        source="scraped", source_url="masterocean://sale/12345",
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    cleanup["listing_ids"].append(listing.id)

    scraped = ScrapedListing(job_id=job.id, listing_id=listing.id, source_url="masterocean://sale/12345", still_active=True)
    db.add(scraped)
    db.commit()

    archived_count = master_ocean._archive_disappeared(job.id, seen_source_urls=set(), db=db, url_prefixes=("masterocean://sale/",))
    db.refresh(listing)
    assert archived_count == 0, "single tracked listing with 0 seen URLs should trip the safety threshold, not archive"
    assert listing.status == "active"
    assert listing.deleted_at is None


def test_master_ocean_sync_archives_completed_type_despite_other_type_incomplete(db, owner, cleanup, monkeypatch):
    """run_master_ocean_sync must archive a Sale listing that disappeared even
    when the Charter fetch was incomplete that same run (and vice versa) —
    the two types are archived independently, not gated on both completing."""
    from app.models.charter import CharterListing

    job = ScraperJob(
        dealer_id=owner.id, broker_url="https://master-ocean.com", site_name="pytest MO decouple",
        enabled=True, status="idle",
        site_template={"api_type": "master_ocean", "api_key": "x", "sync_types": ["Sale", "Charter"]},
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    cleanup["job_ids"].append(job.id)

    # Sale: S1 will disappear this run (not returned), S2/S3 stay — keeps the
    # drop ratio under the separate suspicious-drop safety threshold so this
    # test isolates the completeness-gating fix specifically.
    sale_listings = {}
    for key in ("S1", "S2", "S3"):
        listing = Listing(
            user_id=owner.id, created_by_user_id=owner.id, title=f"Pytest MO Sale {key}",
            bin=uuid.uuid4().hex[:12].upper(), status="active", condition="used",
            source="scraped", source_url=f"masterocean://sale/{key}",
            created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        cleanup["listing_ids"].append(listing.id)
        db.add(ScrapedListing(job_id=job.id, listing_id=listing.id, source_url=f"masterocean://sale/{key}", still_active=True))
        sale_listings[key] = listing.id
    db.commit()

    # Charter: C1 will also not be returned this run, but the Charter fetch
    # itself is mocked incomplete — C1 must NOT be archived despite "vanishing".
    charter = CharterListing(
        user_id=owner.id, slug=f"pytest-mo-charter-{uuid.uuid4().hex[:8]}",
        title="Pytest MO Charter C1", vessel_name="C1", status="active",
    )
    db.add(charter)
    db.commit()
    db.refresh(charter)
    db.add(ScrapedListing(job_id=job.id, charter_listing_id=charter.id, source_url="masterocean://charter/C1", still_active=True))
    db.commit()

    def fake_paginate_all(self, listing_type, page_size=100):
        if listing_type == "Sale":
            return ([{"id": "S2", "name": "S2"}, {"id": "S3", "name": "S3"}], True)  # complete
        if listing_type == "Charter":
            return ([], False)  # incomplete — nothing returned, and not trustworthy
        return ([], True)

    monkeypatch.setattr(master_ocean.MasterOceanClient, "paginate_all", fake_paginate_all)
    monkeypatch.setattr(master_ocean.MasterOceanClient, "get_yacht_detail", lambda self, yacht_id: None)

    try:
        stats = master_ocean.run_master_ocean_sync(job.id, job, job.site_template, db)

        s1 = db.query(Listing).filter(Listing.id == sale_listings["S1"]).first()
        s2 = db.query(Listing).filter(Listing.id == sale_listings["S2"]).first()
        db.refresh(charter)

        assert s1.status == "archived", "Sale fetch completed — S1 (no longer returned) should be archived"
        assert s2.status == "active", "S2 was returned this run — should stay active"
        assert charter.status == "active", "Charter fetch was incomplete — C1 must NOT be archived"
        assert any(e.get("outcome") == "archival_skipped_incomplete_fetch" and e.get("listing_type") == "Charter/Event" for e in stats["log"])
    finally:
        db.query(ScrapedListing).filter(ScrapedListing.charter_listing_id == charter.id).delete()
        db.query(CharterListing).filter(CharterListing.id == charter.id).delete()
        db.commit()


# ---------------------------------------------------------------------------
# Archival safety threshold + job locking — full run_scraper_job, DB-backed,
# network layer monkeypatched out.
# ---------------------------------------------------------------------------

def _make_job(db, owner, cleanup, **overrides):
    defaults = dict(
        dealer_id=owner.id, broker_url="https://example-broker.test/inventory",
        site_name="pytest scraper job", enabled=True, status="idle",
    )
    defaults.update(overrides)
    job = ScraperJob(**defaults)
    db.add(job)
    db.commit()
    db.refresh(job)
    cleanup["job_ids"].append(job.id)
    return job


def test_archival_safety_threshold_skips_on_suspicious_drop(db, owner, cleanup, monkeypatch):
    job = _make_job(db, owner, cleanup)

    listings = []
    for i in range(6):
        listing = Listing(
            user_id=owner.id, created_by_user_id=owner.id, title=f"Pytest Archival Listing {i}",
            bin=uuid.uuid4().hex[:12].upper(), status="active", condition="used",
            source="scraped", source_url=f"https://example-broker.test/listing-{i}",
            created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        db.add(listing)
        db.flush()
        cleanup["listing_ids"].append(listing.id)
        db.add(ScrapedListing(job_id=job.id, listing_id=listing.id, source_url=listing.source_url, still_active=True))
        listings.append(listing)
    db.commit()

    # Discovery finds nothing this run (simulates broken pagination / JS render
    # failure / transient block) — with 6 previously-tracked listings, this
    # must trip the safety threshold rather than archive all 6.
    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [])

    result = run_scraper_job(job.id, db)

    assert result.get("archival_skipped") is True
    verify_db = SessionLocal()
    try:
        for listing in listings:
            fresh = verify_db.query(Listing).filter(Listing.id == listing.id).first()
            assert fresh.status == "active", "listings must stay active when archival is skipped as suspicious"
            assert fresh.deleted_at is None
    finally:
        verify_db.close()


def test_archival_proceeds_normally_when_discovery_looks_healthy(db, owner, cleanup, monkeypatch):
    job = _make_job(db, owner, cleanup)

    kept = Listing(
        user_id=owner.id, created_by_user_id=owner.id, title="Pytest Kept Listing",
        bin=uuid.uuid4().hex[:12].upper(), status="active", condition="used",
        source="scraped", source_url="https://example-broker.test/kept",
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    gone = Listing(
        user_id=owner.id, created_by_user_id=owner.id, title="Pytest Gone Listing",
        bin=uuid.uuid4().hex[:12].upper(), status="active", condition="used",
        source="scraped", source_url="https://example-broker.test/gone",
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    db.add_all([kept, gone])
    db.flush()
    cleanup["listing_ids"].extend([kept.id, gone.id])
    db.add(ScrapedListing(job_id=job.id, listing_id=kept.id, source_url=kept.source_url, still_active=True))
    db.add(ScrapedListing(job_id=job.id, listing_id=gone.id, source_url=gone.source_url, still_active=True))
    db.commit()

    # Discovery finds "kept" again but not "gone" — a normal, healthy partial
    # turnover (well under the 50% suspicious-drop threshold since only 1 of
    # 2... actually this IS 50%, but previously_tracked_count(2) < 5 so the
    # percentage guard doesn't apply at this small scale; only the "discovered
    # zero AND previously tracked something" guard would, and it doesn't fire
    # here since we did discover something.
    monkeypatch.setattr(
        OptimizedYachtScraper, "find_listing_urls",
        lambda self, *a, **kw: ["https://example-broker.test/kept"],
    )
    monkeypatch.setattr(
        OptimizedYachtScraper, "_fetch_listing_html",
        lambda self, *a, **kw: (None, "", []),  # force a fetch failure so no re-scrape/AI call happens
    )

    kept_id, gone_id = kept.id, gone.id  # capture before run_scraper_job detaches these instances

    result = run_scraper_job(job.id, db)

    assert not result.get("archival_skipped")
    verify_db = SessionLocal()
    try:
        fresh_kept = verify_db.query(Listing).filter(Listing.id == kept_id).first()
        fresh_gone = verify_db.query(Listing).filter(Listing.id == gone_id).first()
        assert fresh_kept.status == "active"
        assert fresh_gone.status == "archived", "listing genuinely absent from a healthy discovery run should still archive"
        assert fresh_gone.deleted_at is None, "archival must never hard-delete"
    finally:
        verify_db.close()


def test_concurrent_run_is_rejected_not_duplicated(db, owner, cleanup):
    job = _make_job(db, owner, cleanup, status="running", started_at=datetime.utcnow())

    result = run_scraper_job(job.id, db)

    assert result.get("success") is False
    assert "already running" in (result.get("error") or "").lower()


def test_stale_running_job_is_recoverable_by_scheduler(db, owner, cleanup, monkeypatch):
    from app.services.scraper import run_due_scraper_jobs

    job = _make_job(
        db, owner, cleanup, status="running",
        started_at=datetime.utcnow() - timedelta(minutes=45),  # older than STALE_RUNNING_MINUTES
        next_run_at=datetime.utcnow() - timedelta(minutes=1),
    )
    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [])

    count = run_due_scraper_jobs(db)

    verify_db = SessionLocal()
    try:
        fresh_job = verify_db.query(ScraperJob).filter(ScraperJob.id == job.id).first()
        assert count == 1, "a stale 'running' job should be recovered and run by the scheduler pass"
        assert fresh_job.status == "completed"
    finally:
        verify_db.close()


# ---------------------------------------------------------------------------
# YachtworldSyncJob (separate orchestration system from ScraperJob, used for
# YachtWorld/Boats Group + IYBA feeds) — same three gaps existed here
# independently and needed the same fixes:
#   1. run_yw_job's "is it already running" check was a TOCTOU race (fixed by
#      making sync_yachtworld_job's status claim atomic, mirroring
#      run_scraper_job).
#   2. run_due_yachtworld_jobs() existed fully built but was never wired into
#      scheduler.py — feed jobs never auto-ran on their schedule_hours, only
#      on a manual "Run" click.
#   3. Stuck "running" jobs were only recovered on server startup (app/main.py),
#      not on every scheduler tick like ScraperJob now gets.
# ---------------------------------------------------------------------------

def _make_yw_job(db, owner, cleanup, **overrides):
    defaults = dict(
        dealer_id=owner.id, api_endpoint="https://example-feed.test/vessel",
        site_name="pytest YW job", feed_type="iyba", enabled=True, status="idle",
    )
    defaults.update(overrides)
    job = YachtworldSyncJob(**defaults)
    db.add(job)
    db.commit()
    db.refresh(job)
    cleanup["yw_job_ids"].append(job.id)
    return job


def test_yw_concurrent_run_is_rejected_not_duplicated(db, owner, cleanup):
    job = _make_yw_job(db, owner, cleanup, status="running", started_at=datetime.utcnow())

    result = sync_yachtworld_job(job.id, db)

    assert result.get("success") is False
    assert "already running" in (result.get("error") or "").lower()


def test_yw_stale_running_job_is_recoverable_by_scheduler(db, owner, cleanup, monkeypatch):
    job = _make_yw_job(
        db, owner, cleanup, status="running",
        started_at=datetime.utcnow() - timedelta(minutes=45),  # older than STALE_YW_RUNNING_MINUTES
        next_run_at=datetime.utcnow() - timedelta(minutes=1),
    )
    # Avoid a real network call for the IYBA feed fetch — we're testing the
    # scheduling/recovery wiring, not the feed parsing itself.
    monkeypatch.setattr(
        yachtworld_api, "_sync_iyba_feed",
        lambda job, db, run_log, stats, seen_source_urls: None,
    )

    count = run_due_yachtworld_jobs(db)

    verify_db = SessionLocal()
    try:
        fresh_job = verify_db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job.id).first()
        assert count == 1, "a stale 'running' YW feed job should be recovered and run by the scheduler pass"
        assert fresh_job.status == "completed"
    finally:
        verify_db.close()


def test_yw_due_job_is_picked_up_by_scheduler(db, owner, cleanup, monkeypatch):
    job = _make_yw_job(
        db, owner, cleanup, status="idle",
        next_run_at=datetime.utcnow() - timedelta(minutes=1),  # due
    )
    monkeypatch.setattr(
        yachtworld_api, "_sync_iyba_feed",
        lambda job, db, run_log, stats, seen_source_urls: None,
    )

    count = run_due_yachtworld_jobs(db)

    verify_db = SessionLocal()
    try:
        fresh_job = verify_db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job.id).first()
        assert count == 1
        assert fresh_job.status == "completed"
        assert fresh_job.total_runs == 1
        # Confirms schedule_hours/next_run_at are now actually consumed —
        # previously these fields were dead weight since nothing scheduled
        # against them.
        assert fresh_job.next_run_at > datetime.utcnow()
    finally:
        verify_db.close()
