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
from app.models.listing import Listing, ListingImage
from app.models.misc import ScraperJob, ScrapedListing, RawScrapedPage, YachtworldSyncJob
from app.services import scraper as scraper_module
from app.services.scraper import OptimizedYachtScraper, _apply_scraped_data, run_scraper_job, _looks_like_challenge_page
from app.api.routes_scraper import retry_flagged_listings
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


def test_extract_images_excludes_header_logo_with_generic_filename(scraper):
    """A site logo uploaded with a generic filename and alt text (observed on
    bviyachtsales.com: "IMG_1637.png", alt="yachts") evades both the filename
    skip-list and the alt-text check — the only reliable signal is that it
    sits inside a container structurally classed as the logo. Real gallery
    images outside that container must still come through."""
    html = """
    <html><body>
        <div class="x-bar-container header-logo">
            <div class="x-image">
                <img src="https://example.test/wp-content/uploads/2025/09/IMG_1637.png" alt="yachts">
            </div>
        </div>
        <div class="gallery">
            <img src="https://cdn.example.test/images/12345_1.jpg" alt="Boat photo 1">
            <img src="https://cdn.example.test/images/12345_2.jpg" alt="Boat photo 2">
        </div>
    </body></html>
    """
    images = scraper.extract_images(html, "https://example.test")
    assert not any("IMG_1637" in u for u in images), "the header logo must be excluded despite its generic filename/alt text"
    assert any("12345_1.jpg" in u for u in images), "real gallery image 1 should still be extracted"
    assert any("12345_2.jpg" in u for u in images), "real gallery image 2 should still be extracted"


def test_extract_images_excludes_logo_duplicated_in_mobile_offcanvas_menu(scraper):
    """Reproduces the real bviyachtsales.com case caught after the first logo
    fix deployed: the theme embeds the SAME logo image twice — once in the
    visible header (caught by the header-logo container check) and again
    inside a mobile off-canvas/slide-out menu, whose wrapper has no "logo" in
    its own class chain at all. Since images dedupe by URL, stripping only
    the header copy still let the off-canvas copy's URL through untouched."""
    html = """
    <html><body>
        <div class="x-bar-container header-logo">
            <div class="x-image"><img src="https://example.test/wp-content/uploads/2025/09/IMG_1637.png" alt="yachts"></div>
        </div>
        <div class="x-off-canvas-content x-off-canvas-content-right">
            <div class="x-div"><img src="https://example.test/wp-content/uploads/2025/09/IMG_1637.png" alt="Image"></div>
        </div>
        <div class="gallery">
            <img src="https://cdn.example.test/images/12345_1.jpg" alt="Boat photo 1">
        </div>
    </body></html>
    """
    images = scraper.extract_images(html, "https://example.test")
    assert not any("IMG_1637" in u for u in images), "the logo must be excluded even when its only surviving instance is the off-canvas menu copy"
    assert any("12345_1.jpg" in u for u in images), "real gallery image should still be extracted"


def test_fetch_listing_html_retries_once_on_empty_result(scraper, monkeypatch):
    """A site with intermittent (not absolute) blocking can fail one attempt
    purely by bad luck — both fetch_page and fetch_page_headless already have
    their own internal proxy/render fallbacks, but if the whole chain still
    comes back empty, one retry is cheap insurance against permanently
    losing that listing until the next scheduled run."""
    calls = {"fetch_page": 0}

    def fake_fetch_page(self, url, timeout=15):
        calls["fetch_page"] += 1
        if calls["fetch_page"] == 1:
            return None  # first attempt: simulate the intermittent block
        return "<html><body><h1>Real content</h1></body></html>"  # retry succeeds

    monkeypatch.setattr(scraper_module, "_PLAYWRIGHT_AVAILABLE", False)  # isolate the retry from the headless fallback path
    monkeypatch.setattr(OptimizedYachtScraper, "fetch_page", fake_fetch_page)
    monkeypatch.setattr(scraper_module.time, "sleep", lambda *_: None)

    html, _, _ = scraper._fetch_listing_html("https://bviyachtsales.test/yacht/1")

    assert calls["fetch_page"] == 2, "must retry once after the first attempt comes back empty"
    assert "Real content" in html, "the retry's successful result should be used"


def test_looks_like_challenge_page_detects_captcha_stub_not_real_short_page():
    """Reproduces the real bviyachtsales.com case: a ~570-byte Cloudflare
    Turnstile stub returned with an HTTP 200, which every empty/exception-
    based check treats as a normal successful fetch. It must be told apart
    from a real (if short) listing page, or it silently "succeeds" with
    garbage on ~38% of a run."""
    captcha_stub = (
        '<html><head><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>'
        '</head><div class="cf-turnstile" data-sitekey="x">Please complete the captcha to continue.</div></html>'
    )
    assert _looks_like_challenge_page(captcha_stub) is True

    real_short_page = "<html><body><h1>2015 Beneteau 45</h1><p>Price: $250,000</p></body></html>"
    assert _looks_like_challenge_page(real_short_page) is False, "a real page with a <body> must never be misclassified, however short"

    assert _looks_like_challenge_page("") is False
    assert _looks_like_challenge_page(None) is False

    long_page_mentioning_cloudflare = (
        "<html><body><h1>2015 Beneteau 45</h1>" + ("<p>filler</p>" * 500) +
        "<footer>Protected by Cloudflare captcha</footer></body></html>"
    )
    assert _looks_like_challenge_page(long_page_mentioning_cloudflare) is False, "a long real page must not be flagged just for mentioning cloudflare/captcha in passing"


def test_fetch_listing_html_retries_past_a_challenge_page_not_just_emptiness(scraper, monkeypatch):
    """The captcha stub is non-empty, so the pre-existing empty-check retry
    never fired for it — the fetch "succeeded" with garbage. The retry must
    trigger on this too, and use the retry's real content once it lands."""
    captcha_stub = '<html><div class="cf-turnstile">captcha challenge</div></html>'
    calls = {"fetch_page": 0}

    def fake_fetch_page(self, url, timeout=15):
        calls["fetch_page"] += 1
        if calls["fetch_page"] == 1:
            return captcha_stub
        return "<html><body><h1>Real content</h1></body></html>"

    monkeypatch.setattr(scraper_module, "_PLAYWRIGHT_AVAILABLE", False)
    monkeypatch.setattr(OptimizedYachtScraper, "fetch_page", fake_fetch_page)
    monkeypatch.setattr(scraper_module.time, "sleep", lambda *_: None)

    html, _, _ = scraper._fetch_listing_html("https://bviyachtsales.test/yacht/1")

    assert calls["fetch_page"] == 2, "a challenge-page result must trigger a retry, not be accepted as success"
    assert "Real content" in html


def test_fetch_listing_html_never_returns_a_challenge_page_even_after_retry_fails(scraper, monkeypatch):
    """If every attempt keeps hitting the WAF stub, _fetch_listing_html must
    give up and return empty -- not the captcha HTML -- so downstream code
    (AI parse, confidence scoring) never treats it as real content."""
    captcha_stub = '<html><div class="cf-turnstile">captcha challenge</div></html>'

    monkeypatch.setattr(scraper_module, "_PLAYWRIGHT_AVAILABLE", False)
    monkeypatch.setattr(OptimizedYachtScraper, "fetch_page", lambda self, url, timeout=15: captcha_stub)
    monkeypatch.setattr(scraper_module.time, "sleep", lambda *_: None)

    html, _, _ = scraper._fetch_listing_html("https://bviyachtsales.test/yacht/1")

    assert html == "", "a persistent challenge-page response must come back as empty, never as the stub HTML"


def test_ai_parse_is_skipped_when_fetch_never_got_real_content(db, owner, cleanup, monkeypatch):
    """A blocked/empty fetch has nothing for AI to extract -- calling it
    anyway just spends a credit to confirm what's already known. This is
    also what makes the ~38%-of-a-run WAF-block rate cheap to capture as
    review stubs instead of expensive."""
    job = _make_job(db, owner, cleanup)
    url = "https://example-broker.test/yacht/ai-skip-check"

    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [url])
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: ("", "", []))

    ai_calls = []
    monkeypatch.setattr(OptimizedYachtScraper, "scrape_with_ai", lambda self, *a, **kw: (ai_calls.append(1), {})[1])

    result = run_scraper_job(job.id, db)

    assert ai_calls == [], "no AI call should happen when the fetch returned nothing real to parse"
    assert result.get("captured_low_confidence") == 1

    verify_db = SessionLocal()
    listing = verify_db.query(Listing).filter(Listing.source_url == url).first()
    if listing:
        cleanup["listing_ids"].append(listing.id)
    verify_db.close()


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


def test_apply_scraped_data_reassembles_features_list_instead_of_stringifying_it():
    """The AI is instructed to return `features` as a single multi-line
    string (see prompt_store.py), but doesn't always comply and sometimes
    returns a JSON array instead. Naively str()'ing that array produced a
    literal "['- item', '- item']" Python-repr mess in the stored listing
    (reproduces a real bviyachtsales.com listing seen in production)."""
    listing = Listing(title="Test", bin=uuid.uuid4().hex[:12].upper(), condition="used")
    job = SimpleNamespace(dealer_id=1, salesman_id=None)
    raw = {
        "features": [
            "- Dual helm stations with Jefa wheels and custom grab rails",
            "- Self-tacking furling jib with electric windlass",
            "- Bow thruster for easy maneuvering",
        ],
    }
    _apply_scraped_data(listing, raw, job)
    assert listing.features is not None
    assert "[" not in listing.features and "]" not in listing.features, "must not contain literal list-repr brackets"
    assert "'" not in listing.features, "must not contain the list items' quote marks"
    assert listing.features.count("\n") == 2, "each feature should be its own line"
    assert "Dual helm stations" in listing.features

    # A feature missing the "- " prefix should still get one, for consistent rendering
    listing2 = Listing(title="Test2", bin=uuid.uuid4().hex[:12].upper(), condition="used")
    _apply_scraped_data(listing2, {"features": ["Bow thruster", "- Radar arch"]}, job)
    assert listing2.features.splitlines() == ["- Bow thruster", "- Radar arch"]


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


def test_headless_discovery_stops_after_going_idle(scraper, monkeypatch):
    """A fixed wall-clock budget was replaced with an idle-timeout: discovery
    should only give up once it's gone quiet (no new listing/pagination
    target found) for _HEADLESS_DISCOVERY_IDLE_TIMEOUT_SECONDS — not simply
    because total elapsed time crossed some fixed line. Page 2 here is
    queued (discovered on page 1) but must never be fetched once the mocked
    clock jumps past the idle window with no further progress in between."""
    page_1_html = """
    <html><body>
        <a href="/yachts/2024-Test-Yacht-One">Yacht One</a>
        <a href="/yachts/page/2/">2</a>
    </body></html>
    """
    fetched_urls = []

    def fake_fetch_headless(self, url, wait_selector=None, timeout=30):
        fetched_urls.append(url)
        return page_1_html if url.rstrip('/').endswith('/yachts') else None

    idle_timeout = scraper._HEADLESS_DISCOVERY_IDLE_TIMEOUT_SECONDS
    # monotonic() calls, in order: discovery_started_at, iteration-1's top-of-
    # loop check (idle_for=0 — proceeds), the progress update right after
    # page 1 finds a new pagination link, iteration-2's top-of-loop check
    # (now well past the idle window since that last progress update).
    clock = iter([0.0, 0.0, 1.0, 1.0 + idle_timeout + 1])
    monkeypatch.setattr(scraper_module, "_PLAYWRIGHT_AVAILABLE", True)
    monkeypatch.setattr(OptimizedYachtScraper, "fetch_page_headless", fake_fetch_headless)
    monkeypatch.setattr(scraper_module.time, "monotonic", lambda: next(clock))
    monkeypatch.setattr(scraper_module.time, "sleep", lambda *_: None)

    found = scraper._discover_with_headless(
        "https://bviyachtsales.test",
        [("https://bviyachtsales.test/yachts", True)],
        inventory_keywords=["/yachts"],
        listing_path_patterns=[r"/yacht[s]?/"],
    )

    assert any("Yacht-One" in u for u in found), "page 1 (fetched before going idle) should still be found"
    assert len(fetched_urls) == 1, "page 2 was queued but must never be fetched once discovery has gone idle"


def test_headless_discovery_continues_past_the_old_fixed_budget_while_progress_continues(scraper, monkeypatch):
    """The old mechanism cut discovery off at a fixed 480s of total elapsed
    time regardless of whether it was still succeeding. As long as new pages
    keep turning up new listings, discovery must now keep going well past
    that — a large, slow broker needs real time, not an arbitrary clock."""
    n_pages = 5
    pages = {
        f"/yachts/page/{i}/": (
            f'<a href="/yachts/boat-{i}">Boat {i}</a>'
            + (f'<a href="/yachts/page/{i + 1}/">{i + 1}</a>' if i < n_pages else '')
        )
        for i in range(1, n_pages + 1)
    }
    fetched_urls = []

    def fake_fetch_headless(self, url, wait_selector=None, timeout=30):
        fetched_urls.append(url)
        if url.rstrip('/').endswith('/yachts'):
            return f'<html><body>{pages["/yachts/page/1/"]}</body></html>'
        for path, body in pages.items():
            if url.rstrip('/').endswith(path.rstrip('/')):
                return f'<html><body>{body}</body></html>'
        return None

    # Each page is separated by 130s (under the 180s idle timeout, so
    # continued progress keeps it alive) — cumulative elapsed by the last
    # page comfortably exceeds the old fixed 480s budget.
    gap = 130.0
    clock_values = [0.0]  # discovery_started_at
    for i in range(n_pages):
        clock_values.append(i * gap)      # top-of-loop check for page i+1
        clock_values.append(i * gap)      # progress update after page i+1
    clock = iter(clock_values)
    assert (n_pages - 1) * gap > 480, "test setup should exceed the old fixed budget"

    monkeypatch.setattr(scraper_module, "_PLAYWRIGHT_AVAILABLE", True)
    monkeypatch.setattr(OptimizedYachtScraper, "fetch_page_headless", fake_fetch_headless)
    monkeypatch.setattr(scraper_module.time, "monotonic", lambda: next(clock))
    monkeypatch.setattr(scraper_module.time, "sleep", lambda *_: None)

    found = scraper._discover_with_headless(
        "https://bviyachtsales.test",
        [("https://bviyachtsales.test/yachts", True)],
        inventory_keywords=["/yachts"],
        listing_path_patterns=[r"/yacht[s]?/"],
    )

    assert len(fetched_urls) == n_pages, f"all {n_pages} pages should have been visited despite exceeding the old 480s budget"
    for i in range(1, n_pages + 1):
        assert any(f"boat-{i}" in u for u in found), f"boat-{i} should have been found"


def test_old_fixed_discovery_budget_constant_is_gone(scraper):
    """Sanity check that the fixed-budget mechanism was actually replaced,
    not just supplemented — a lingering unused constant would be a sign the
    old cutoff is still wired in somewhere."""
    assert not hasattr(scraper, "_HEADLESS_DISCOVERY_TIME_BUDGET_SECONDS")


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


def test_pause_requested_stops_run_and_saves_remaining_urls(db, owner, cleanup, monkeypatch):
    """A pause requested mid-run must stop the per-URL loop before the next
    URL, save whatever's left to pending_urls, and mark the job 'paused' —
    not silently keep running to completion (the actual pre-fix bug)."""
    job = _make_job(db, owner, cleanup)

    urls = [
        "https://example-broker.test/one",
        "https://example-broker.test/two",
        "https://example-broker.test/three",
    ]
    job_id = job.id  # capture before run_scraper_job — it closes/replaces its own session, detaching `job`
    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: list(urls))

    fetched = []

    def fake_fetch(self, url, *a, **kw):
        fetched.append(url)
        if url == urls[0]:
            # Simulate the admin clicking pause while URL 1 is being processed —
            # by the time the loop re-checks at the top of the next iteration,
            # pause_requested is set.
            side_db = SessionLocal()
            try:
                side_db.query(ScraperJob).filter(ScraperJob.id == job_id).update({"pause_requested": True})
                side_db.commit()
            finally:
                side_db.close()
        return (None, "", [])  # fetch "fails" — irrelevant to what's being tested here

    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", fake_fetch)

    run_scraper_job(job_id, db)

    assert fetched == [urls[0]], "must stop before fetching URL 2 once pause_requested is seen"
    verify_db = SessionLocal()
    try:
        fresh = verify_db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
        assert fresh.status == "paused"
        assert fresh.pause_requested is False, "the request flag should be cleared once honored"
        assert fresh.pending_urls == urls[1:], "the not-yet-processed URLs should be saved for resuming"
        assert any(e.get("outcome") == "archival_skipped_paused_or_resumed" for e in (fresh.last_run_log or [])), \
            "archival must not run against a partial (paused) discovery pass"
    finally:
        verify_db.close()


def test_resume_skips_discovery_and_uses_pending_urls(db, owner, cleanup, monkeypatch):
    """A job with saved pending_urls (from a prior pause) must resume from
    there — not rediscover and reprocess the whole site from scratch."""
    pending = ["https://example-broker.test/two", "https://example-broker.test/three"]
    job = _make_job(db, owner, cleanup, status="paused", pending_urls=pending)
    job_id = job.id  # capture before run_scraper_job — it closes/replaces its own session, detaching `job`

    def fail_if_called(self, *a, **kw):
        raise AssertionError("find_listing_urls must not run on a resumed job — it should use pending_urls")

    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", fail_if_called)
    fetched = []
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, url, *a, **kw: (fetched.append(url), (None, "", []))[1])

    run_scraper_job(job_id, db)

    assert fetched == pending, "resumed run should process exactly the saved pending URLs"
    verify_db = SessionLocal()
    try:
        fresh = verify_db.query(ScraperJob).filter(ScraperJob.id == job_id).first()
        assert fresh.status == "completed"
        assert not fresh.pending_urls, "pending_urls should be cleared once the resumed run finishes"
    finally:
        verify_db.close()


def test_ai_disabled_skips_ai_parse_even_when_fields_are_missing(db, owner, cleanup, monkeypatch):
    """site_template.ai_enabled == False must skip the AI-parse stage
    entirely, regardless of whether deterministic extraction left fields
    missing — the whole point is running without spending AI credits."""
    job = _make_job(db, owner, cleanup, site_template={"ai_enabled": False})

    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: ["https://example-broker.test/boat"])
    monkeypatch.setattr(
        OptimizedYachtScraper, "_fetch_listing_html",
        lambda self, *a, **kw: ("<html><body><h1>Boat</h1></body></html>", "", []),
    )
    # Force the "AI would normally be needed" branch regardless of what
    # deterministic extraction produced, so this test isolates the new gate
    # rather than depending on fragile field-by-field extraction behavior.
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: True)

    ai_calls = []
    monkeypatch.setattr(OptimizedYachtScraper, "scrape_with_ai", lambda self, *a, **kw: (ai_calls.append(1), {})[1])

    run_scraper_job(job.id, db)

    assert ai_calls == [], "AI must not be called when this job has ai_enabled=False"


def test_ai_enabled_by_default_still_calls_ai_when_needed(db, owner, cleanup, monkeypatch):
    """Sanity check for the above: jobs without ai_enabled set (the default,
    and every job that existed before this feature) must be unaffected."""
    job = _make_job(db, owner, cleanup)  # no site_template — defaults to ai_enabled=True

    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: ["https://example-broker.test/boat"])
    monkeypatch.setattr(
        OptimizedYachtScraper, "_fetch_listing_html",
        lambda self, *a, **kw: ("<html><body><h1>Boat</h1></body></html>", "", []),
    )
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: True)

    ai_calls = []
    monkeypatch.setattr(OptimizedYachtScraper, "scrape_with_ai", lambda self, *a, **kw: (ai_calls.append(1), {})[1])

    run_scraper_job(job.id, db)

    assert ai_calls == [1], "AI should still run normally for a job with no ai_enabled override"


def test_low_confidence_url_is_captured_as_review_stub(db, owner, cleanup, monkeypatch):
    """A page extraction can't trust (e.g. an empty fetch, or barely any real
    content) must still be captured as a reviewable stub — not silently
    discarded — so an admin can see exactly which source-site listings never
    made it in cleanly and go complete them by hand, instead of only seeing
    a raw count mismatch with no way to tell which ones are missing."""
    job = _make_job(db, owner, cleanup)
    url = "https://example-broker.test/yacht/12345/1980-Custom-47-SeaTruck"

    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [url])
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: ("", "", []))  # empty fetch
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: False)  # keep this deterministic — no AI call

    result = run_scraper_job(job.id, db)

    assert result.get("captured_low_confidence") == 1
    assert result.get("created") == 1, "the stub still counts as a created listing, not an error"
    verify_db = SessionLocal()
    try:
        listing = verify_db.query(Listing).filter(Listing.source_url == url).first()
        assert listing is not None, "a low-confidence page must still produce a Listing, not be discarded"
        cleanup["listing_ids"].append(listing.id)
        assert listing.status == "awaiting_review"
        assert listing.title == "1980 Custom 47 SeaTruck", "should fall back to a URL-slug-derived title when extraction found none"
        specs = listing.additional_specs or {}
        assert specs.get("needs_manual_review") is not None
        assert specs["needs_manual_review"]["reason"] in ("low_confidence", "too_small")
    finally:
        verify_db.close()


def test_needs_manual_review_flag_clears_on_a_later_successful_rescrape(db, owner, cleanup, monkeypatch):
    """Once a URL that previously failed extraction succeeds on a later run,
    the needs_manual_review marker must be cleared — it shouldn't linger in
    the review queue forever after the data is actually good now. Also
    confirms a real (non-blank) title from a later successful run isn't
    clobbered back to the URL-slug fallback."""
    job = _make_job(db, owner, cleanup)
    job_id = job.id
    url = "https://example-broker.test/yacht/1"

    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [url])
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: ("", "", []))
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: False)  # keep this deterministic — no AI call
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    listing_row = verify_db.query(Listing).filter(Listing.source_url == url).first()
    listing_id = listing_row.id
    cleanup["listing_ids"].append(listing_id)
    assert (listing_row.additional_specs or {}).get("needs_manual_review") is not None
    verify_db.close()

    real_html = """
    <html><head><title>2015 Beneteau Oceanis 45</title></head>
    <body>
        <nav>Home | Inventory | About | Contact</nav>
        <h1>2015 Beneteau Oceanis 45</h1>
        <p>Price: $250,000</p>
        <p>Located in Fort Lauderdale, FL, United States</p>
        <p>Length: 45 ft</p>
        <p>A well-maintained cruising sailboat with a spacious cockpit and modern electronics
        package. This vessel has been meticulously maintained by her current owner and is
        ready for immediate offshore cruising. Recent upgrades include new standing rigging,
        a fully serviced engine, and updated navigation electronics throughout the cabin.</p>
        <footer>Copyright 2026 Example Broker. All rights reserved.</footer>
    </body></html>
    """
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: (real_html, "", []))
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: False)  # keep this deterministic — no AI call
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    try:
        listing = verify_db.query(Listing).filter(Listing.id == listing_id).first()
        specs = listing.additional_specs or {}
        assert "needs_manual_review" not in specs, "flag should be cleared once a later run extracts real data"
        assert listing.title and listing.title.lower() != "yacht", \
            "a real extracted title should win over the URL-slug fallback ('yacht', from /yacht/1), not get stuck on it"
    finally:
        verify_db.close()


def test_update_path_populates_images_for_a_previously_imageless_stub(db, owner, cleanup, monkeypatch):
    """A needs_manual_review stub is captured with zero images (the fetch that
    created it failed). The "update existing listing" branch only ever called
    _apply_scraped_data (scalar fields), which never touched images -- so a
    later successful re-fetch with real photos left the listing permanently
    at zero images even after everything else came through correctly.
    Reproduces the real bviyachtsales.com case: 49/130 listings stuck with
    "No image" after a batch of stubs got real data on retry."""
    job = _make_job(db, owner, cleanup)
    job_id = job.id
    url = "https://example-broker.test/yacht/needs-photos"

    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [url])
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: ("", "", []))
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: False)
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    listing_row = verify_db.query(Listing).filter(Listing.source_url == url).first()
    listing_id = listing_row.id
    cleanup["listing_ids"].append(listing_id)
    assert verify_db.query(ListingImage).filter(ListingImage.listing_id == listing_id).count() == 0
    verify_db.close()

    real_html = (
        "<html><body><nav>Home | Inventory | About | Contact</nav>"
        "<h1>2016 Beneteau Oceanis 41</h1><p>Price: $220,000</p>"
        "<p>Located in Tortola, British Virgin Islands</p><p>Length: 41 ft</p>"
        "<p>A superbly maintained charter-ready sailboat with a spacious cockpit "
        "and fully equipped galley, recently serviced and ready to sail today.</p>"
        "<div class=\"gallery\">"
        "<img src=\"https://cdn.example.test/photos/boat1.jpg\">"
        "<img src=\"https://cdn.example.test/photos/boat2.jpg\">"
        "<img src=\"https://cdn.example.test/photos/boat3.jpg\">"
        "</div>"
        "<footer>Copyright 2026 Example Broker.</footer>"
        "</body></html>"
    )
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: (real_html, "", []))
    monkeypatch.setattr(scraper_module, "_rehost_image", lambda u: u)  # skip real network re-hosting in the test
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    try:
        images = verify_db.query(ListingImage).filter(ListingImage.listing_id == listing_id).all()
        assert len(images) == 3, "the update path must populate images once real ones are extracted, not just scalar fields"
        assert {i.url for i in images} == {
            "https://cdn.example.test/photos/boat1.jpg",
            "https://cdn.example.test/photos/boat2.jpg",
            "https://cdn.example.test/photos/boat3.jpg",
        }
    finally:
        verify_db.close()


def test_update_path_never_duplicates_or_replaces_existing_curated_images(db, owner, cleanup, monkeypatch):
    """An update to a listing that ALREADY has images (e.g. an admin curated
    them, or they were set on a prior successful scrape) must never wipe,
    reorder, or duplicate them -- image sync on update is scoped to
    "currently empty" specifically to avoid this."""
    job = _make_job(db, owner, cleanup)
    job_id = job.id
    url = "https://example-broker.test/yacht/already-has-photos"
    real_html = (
        "<html><body><nav>Home | Inventory | About | Contact</nav>"
        "<h1>2019 Jeanneau 51</h1><p>Price: $410,000</p>"
        "<p>Located in Road Town, British Virgin Islands</p><p>Length: 51 ft</p>"
        "<p>This flagship cruiser offers exceptional volume and comfort for "
        "extended offshore passages, with premium electronics throughout.</p>"
        "<div class=\"gallery\">"
        "<img src=\"https://cdn.example.test/photos/boatA.jpg\">"
        "</div>"
        "<footer>Copyright 2026 Example Broker.</footer>"
        "</body></html>"
    )
    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [url])
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: (real_html, "", []))
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: False)
    monkeypatch.setattr(scraper_module, "_rehost_image", lambda u: u)
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    listing_row = verify_db.query(Listing).filter(Listing.source_url == url).first()
    listing_id = listing_row.id
    cleanup["listing_ids"].append(listing_id)
    assert verify_db.query(ListingImage).filter(ListingImage.listing_id == listing_id).count() == 1
    verify_db.close()

    # Second run, source now shows a DIFFERENT photo -- must not touch existing images.
    real_html_2 = real_html.replace("boatA.jpg", "boatB.jpg")
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: (real_html_2, "", []))
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    try:
        images = verify_db.query(ListingImage).filter(ListingImage.listing_id == listing_id).all()
        assert len(images) == 1
        assert images[0].url == "https://cdn.example.test/photos/boatA.jpg", "an update must never replace existing curated images"
    finally:
        verify_db.close()


def test_deleted_listing_is_not_silently_revived_on_rescrape(db, owner, cleanup, monkeypatch):
    """An admin who soft-deletes a scraped listing from the review queue must
    not have it come back as an invisible "updated" row on the next scrape.
    Before this fix, the update-existing branch never checked deleted_at, so
    it flipped status back to "active" while leaving deleted_at set -- a
    listing excluded from every deleted_at-filtered query (invisible), yet
    permanently "found" via its ScrapedListing tracking row, so it could
    never come back as a normal new review item either."""
    job = _make_job(db, owner, cleanup)
    job_id = job.id
    url = "https://example-broker.test/yacht/99"

    real_html = (
        "<html><body><h1>2018 Sea Ray 350</h1><p>Price: $180,000</p>"
        "<p>Located in Miami, FL, United States</p><p>Length: 35 ft</p>"
        "<p>A great weekend cruiser in excellent condition with low engine hours "
        "and a fully serviced drivetrain, ready for the water this season.</p>"
        "</body></html>"
    )
    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [url])
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: (real_html, "", []))
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: False)
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    listing_row = verify_db.query(Listing).filter(Listing.source_url == url).first()
    original_listing_id = listing_row.id
    cleanup["listing_ids"].append(original_listing_id)
    # Simulate the admin soft-deleting it from the review queue (DELETE /listings/{id})
    listing_row.status = "deleted"
    listing_row.deleted_at = datetime.utcnow()
    verify_db.commit()
    verify_db.close()

    result = run_scraper_job(job_id, db)

    assert result.get("created") == 1, "a deleted listing's URL should produce a brand-new listing, not a silent revive"
    assert result.get("updated") == 0

    verify_db = SessionLocal()
    try:
        old_listing = verify_db.query(Listing).filter(Listing.id == original_listing_id).first()
        assert old_listing.deleted_at is not None, "the deleted listing must stay deleted, not get reactivated"
        assert old_listing.status == "deleted"

        new_listing = (
            verify_db.query(Listing)
            .filter(Listing.source_url == url, Listing.id != original_listing_id)
            .first()
        )
        assert new_listing is not None, "a fresh listing should have been created for this URL"
        cleanup["listing_ids"].append(new_listing.id)
        assert new_listing.deleted_at is None
        assert new_listing.status == "awaiting_review"

        # Exactly one ScrapedListing row should track this URL for this job --
        # inserting a second row instead of repointing the existing one would
        # make the next run's lookup ambiguous (MultipleResultsFound).
        tracking_rows = (
            verify_db.query(ScrapedListing)
            .filter(ScrapedListing.job_id == job_id, ScrapedListing.source_url == url)
            .all()
        )
        assert len(tracking_rows) == 1
        assert tracking_rows[0].listing_id == new_listing.id
    finally:
        verify_db.close()


def test_retry_flagged_listings_only_retries_flagged_urls_and_skips_archival(db, owner, cleanup, monkeypatch):
    """The "retry flagged" action must scope the retry to ONLY the currently
    needs_manual_review URLs -- not rediscover and refetch every URL this job
    has ever tracked. It reuses the pause/resume pending_urls mechanism to
    skip discovery, which also means the listings outside this batch must
    NOT get archived just because they weren't in this run's URL list (that
    mechanism already guards against exactly this for a resumed run)."""
    job = _make_job(db, owner, cleanup)
    job_id = job.id

    good_url = "https://example-broker.test/yacht/retry-good"
    flagged_url = "https://example-broker.test/yacht/retry-flagged"
    real_html = (
        "<html><body><nav>Home | Inventory | About | Contact</nav>"
        "<h1>2017 Jeanneau 419</h1><p>Price: $210,000</p>"
        "<p>Located in Miami, FL, United States</p><p>Length: 41 ft</p>"
        "<p>A well-equipped cruiser with low hours, recently serviced rigging, "
        "and a fully updated electronics suite ready for offshore passages. "
        "This vessel has been meticulously maintained and comes with a full "
        "service history, ready for immediate offshore cruising this season.</p>"
        "<footer>Copyright 2026 Example Broker. All rights reserved.</footer>"
        "</body></html>"
    )

    def fake_fetch_initial(self, url, *a, **kw):
        if url == good_url:
            return (real_html, "", [])
        return ("", "", [])

    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [good_url, flagged_url])
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", fake_fetch_initial)
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: False)
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    good = verify_db.query(Listing).filter(Listing.source_url == good_url).first()
    flagged = verify_db.query(Listing).filter(Listing.source_url == flagged_url).first()
    good_id, flagged_id = good.id, flagged.id
    cleanup["listing_ids"].extend([good_id, flagged_id])
    assert (flagged.additional_specs or {}).get("needs_manual_review") is not None
    assert (good.additional_specs or {}).get("needs_manual_review") is None
    verify_db.close()

    # Now call the retry-flagged endpoint directly (it's a plain function --
    # @router.post doesn't change that). Discovery must never run, and only
    # the flagged URL should get fetched.
    discovery_calls = []
    monkeypatch.setattr(
        OptimizedYachtScraper, "find_listing_urls",
        lambda self, *a, **kw: (discovery_calls.append(1), [])[1],
    )
    fetched_urls = []
    real_html_2 = real_html.replace("2017 Jeanneau 419", "2017 Jeanneau 419 Retried")

    def fake_fetch_retry(self, url, *a, **kw):
        fetched_urls.append(url)
        return (real_html_2, "", [])

    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", fake_fetch_retry)

    admin = SimpleNamespace(user_type="admin")
    result = retry_flagged_listings(job_id, db, admin)

    assert result["success"] is True
    assert result["count"] == 1

    # The retry runs in a background thread -- wait for it to finish. Must
    # wait for status to actually BECOME "running" first before treating a
    # non-running status as "done" -- otherwise a slow thread start (still
    # showing the previous run's "completed" status) races the very first
    # poll and the test proceeds before the retry fetch ever happens.
    import time as _time
    seen_running = False
    for _ in range(200):
        wait_db = SessionLocal()
        status = wait_db.query(ScraperJob.status).filter(ScraperJob.id == job_id).scalar()
        wait_db.close()
        if status == "running":
            seen_running = True
        elif seen_running:
            break
        _time.sleep(0.05)

    assert discovery_calls == [], "retry-flagged must skip discovery entirely"
    assert fetched_urls == [flagged_url], "only the flagged URL should be retried, not every tracked URL"

    verify_db = SessionLocal()
    try:
        good_after = verify_db.query(Listing).filter(Listing.id == good_id).first()
        flagged_after = verify_db.query(Listing).filter(Listing.id == flagged_id).first()
        assert good_after.status != "archived", "listings outside the retry batch must never be archived just for not being in pending_urls"
        assert (flagged_after.additional_specs or {}).get("needs_manual_review") is None, "a successful retry should clear the flag"
        assert flagged_after.title and "Retried" in flagged_after.title
    finally:
        verify_db.close()


def test_retry_flagged_listings_reports_nothing_to_do_when_none_flagged(db, owner, cleanup, monkeypatch):
    job = _make_job(db, owner, cleanup)
    job_id = job.id
    url = "https://example-broker.test/yacht/retry-clean"
    real_html = (
        "<html><body><nav>Home | Inventory | About | Contact</nav>"
        "<h1>2019 Catalina 355</h1><p>Price: $175,000</p>"
        "<p>Located in Annapolis, MD, United States</p><p>Length: 35 ft</p>"
        "<p>Freshwater-kept sailboat with meticulous maintenance records and a "
        "recently replaced sail inventory, ready to cruise this season. This "
        "vessel has been stored indoors every winter and shows exceptionally "
        "well, with all systems recently serviced and functioning properly.</p>"
        "<footer>Copyright 2026 Example Broker. All rights reserved.</footer>"
        "</body></html>"
    )
    monkeypatch.setattr(OptimizedYachtScraper, "find_listing_urls", lambda self, *a, **kw: [url])
    monkeypatch.setattr(OptimizedYachtScraper, "_fetch_listing_html", lambda self, *a, **kw: (real_html, "", []))
    monkeypatch.setattr(OptimizedYachtScraper, "_needs_ai_check", lambda self, partial: False)
    run_scraper_job(job_id, db)

    verify_db = SessionLocal()
    listing = verify_db.query(Listing).filter(Listing.source_url == url).first()
    cleanup["listing_ids"].append(listing.id)
    verify_db.close()

    admin = SimpleNamespace(user_type="admin")
    result = retry_flagged_listings(job_id, db, admin)

    assert result["success"] is False
    assert "no listings" in result["message"].lower()


def test_concurrent_run_is_rejected_not_duplicated(db, owner, cleanup):
    job = _make_job(db, owner, cleanup, status="running", started_at=datetime.utcnow())

    result = run_scraper_job(job.id, db)

    assert result.get("success") is False
    assert "already running" in (result.get("error") or "").lower()


def test_stale_running_job_is_recoverable_by_scheduler(db, owner, cleanup, monkeypatch):
    from app.services.scraper import run_due_scraper_jobs

    from app.services.scraper import STALE_RUNNING_MINUTES
    job = _make_job(
        db, owner, cleanup, status="running",
        started_at=datetime.utcnow() - timedelta(minutes=STALE_RUNNING_MINUTES + 15),  # older than STALE_RUNNING_MINUTES
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
