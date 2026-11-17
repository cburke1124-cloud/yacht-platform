"""NautiX feed importer: field mapping + a full job run against a trimmed real feed."""
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest

from app.main import app  # noqa: F401  (registers every model for the mapper)
from app.db.session import SessionLocal
from app.models.listing import Listing, ListingImage
from app.models.misc import YachtworldSyncJob
from app.models.user import User
from app.services import nautix_feed
from app.services.yachtworld_api import sync_yachtworld_job

SAMPLE = Path(__file__).parent / "data" / "nautix_sample.xml"
ENDPOINT = "https://feeds.example.test/nautix.xml"


def _adverts():
    return nautix_feed.iter_adverts(nautix_feed.parse_nautix_root(SAMPLE.read_bytes()))


def test_maps_first_advert():
    rec = nautix_feed.map_nautix_advert(_adverts()[0])
    assert rec["_yw_id"] == "16659"
    assert rec["title"] == "1927 Sleepboot 17.36"
    assert rec["price"] == 67750.0 and rec["currency"] == "EUR"
    assert rec["country"] == "Netherlands" and rec["city"] == "Sneek"
    assert rec["boat_type"] == "Motor Yacht" and rec["hull_material"] == "Steel"
    assert round(rec["length_feet"], 1) == 57.0          # 17.36 m
    assert rec["cabins"] == 2 and rec["berths"] == 5 and rec["heads"] == 1
    assert 0 < len(rec["images"]) <= nautix_feed.MAX_IMAGES_PER_LISTING
    assert all(u.startswith("http") for u in rec["images"])
    assert rec["description"] and "<br" not in rec["description"]


def test_skips_non_sale_and_inactive():
    ad = _adverts()[0]
    ad.attrib["purpose"] = "rent"
    assert nautix_feed.map_nautix_advert(ad) is None
    ad.attrib["purpose"] = "sale"
    ad.attrib["status"] = "withdrawn"
    assert nautix_feed.map_nautix_advert(ad) is None


def test_rejects_other_xml():
    with pytest.raises(RuntimeError):
        nautix_feed.parse_nautix_root(b"<feed><entry/></feed>")


@pytest.fixture
def dealer_and_job():
    db = SessionLocal()
    dealer = User(email=f"pytest-nautix-{uuid.uuid4().hex[:8]}@example.com", password_hash="x",
                  first_name="N", last_name="X", user_type="dealer", subscription_tier="free", active=True)
    db.add(dealer)
    db.commit()
    job = YachtworldSyncJob(dealer_id=dealer.id, site_name="pytest nautix", api_endpoint=ENDPOINT,
                            feed_type="nautix", enabled=True)
    db.add(job)
    db.commit()
    yield db, dealer, job
    ids = [r.id for r in db.query(Listing).filter(Listing.user_id == dealer.id).all()]
    if ids:
        db.query(ListingImage).filter(ListingImage.listing_id.in_(ids)).delete(synchronize_session=False)
        db.query(Listing).filter(Listing.id.in_(ids)).delete(synchronize_session=False)
    db.delete(job)
    db.delete(dealer)
    db.commit()
    db.close()


def test_job_run_creates_updates_and_archives(dealer_and_job):
    db, dealer, job = dealer_and_job
    with patch.object(nautix_feed, "fetch_nautix_feed", return_value=SAMPLE.read_bytes()):
        res = sync_yachtworld_job(job.id, db)
        assert res["success"] and res["created"] == 3 and res["errors"] == 0, res

        listings = db.query(Listing).filter(Listing.user_id == dealer.id).all()
        assert len(listings) == 3
        assert all(l.status == "awaiting_review" and l.currency == "EUR" for l in listings)
        assert all(db.query(ListingImage).filter(ListingImage.listing_id == l.id).count() > 0 for l in listings)

        # second run: nothing new, nothing duplicated
        res = sync_yachtworld_job(job.id, db)
        assert res["created"] == 0 and res["updated"] == 3
        assert db.query(Listing).filter(Listing.user_id == dealer.id).count() == 3

    # a listing that was live and disappears from the feed gets archived
    first = db.query(Listing).filter(Listing.user_id == dealer.id).first()
    first.status = "active"
    db.commit()
    trimmed = SAMPLE.read_bytes()
    xml = trimmed.decode("utf-8")
    start = xml.index('<advert id="%s"' % first.source_url.split("#id=")[1])
    end = xml.index("</advert>", start) + len("</advert>")
    with patch.object(nautix_feed, "fetch_nautix_feed", return_value=(xml[:start] + xml[end:]).encode("utf-8")):
        res = sync_yachtworld_job(job.id, db)
    db.refresh(first)
    assert first.status == "archived", (res, first.status)
