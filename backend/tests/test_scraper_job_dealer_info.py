"""
GET /scraper/jobs and GET /scraper/jobs/{id} should always include the
job's dealer_email/dealer_company_name, even for a dealer who wouldn't
appear in the (limit=200) /admin/dealers broker-picker list. Without this,
the admin scraper job edit form has no way to know which broker a job is
actually assigned to when that broker falls outside the picker's window --
the dropdown renders as if nothing were selected, which invites an admin to
"fix" it by picking a different broker and silently reassigning every
listing the job owns on its next run.
"""
import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.security.auth import create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.user import User
from app.models.misc import ScraperJob


def _unique_email(prefix: str) -> str:
    return f"pytest-{prefix}-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def admin_and_dealer():
    admin_email = _unique_email("admin")
    dealer_email = _unique_email("dealer")
    db = SessionLocal()
    try:
        admin = User(
            email=admin_email, password_hash=get_password_hash("TestPass123"),
            first_name="Admin", last_name="User", user_type="admin",
        )
        dealer = User(
            email=dealer_email, password_hash=get_password_hash("TestPass123"),
            first_name="Jeremy", last_name="Broker", user_type="dealer",
            company_name="Tot Nautic", subscription_tier="free",
        )
        db.add_all([admin, dealer])
        db.commit()
        db.refresh(admin)
        db.refresh(dealer)

        job = ScraperJob(
            dealer_id=dealer.id,
            site_name="Tot Nautic",
            broker_url="https://www.tot-nautic.com/our-boats/",
            schedule_hours=168,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        token = create_access_token(
            data={"sub": admin.email},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        state = {
            "client": TestClient(app),
            "headers": {"Authorization": f"Bearer {token}"},
            "dealer_id": dealer.id,
            "dealer_email": dealer.email,
            "job_id": job.id,
        }
        yield state
    finally:
        db2 = SessionLocal()
        try:
            db2.query(ScraperJob).filter(ScraperJob.id == state["job_id"]).delete()
            db2.query(User).filter(User.email.in_([admin_email, dealer_email])).delete(synchronize_session=False)
            db2.commit()
        finally:
            db2.close()
        db.close()


def test_get_single_job_includes_dealer_info(admin_and_dealer):
    s = admin_and_dealer
    res = s["client"].get(f"/api/scraper/jobs/{s['job_id']}", headers=s["headers"])
    assert res.status_code == 200, res.text
    job = res.json()["job"]
    assert job["dealer_id"] == s["dealer_id"]
    assert job["dealer_email"] == s["dealer_email"]
    assert job["dealer_company_name"] == "Tot Nautic"


def test_list_jobs_includes_dealer_info(admin_and_dealer):
    s = admin_and_dealer
    res = s["client"].get("/api/scraper/jobs", headers=s["headers"])
    assert res.status_code == 200, res.text
    jobs = {j["id"]: j for j in res.json()["jobs"]}
    assert s["job_id"] in jobs
    assert jobs[s["job_id"]]["dealer_email"] == s["dealer_email"]
    assert jobs[s["job_id"]]["dealer_company_name"] == "Tot Nautic"


def test_update_job_response_reflects_new_dealer_info(admin_and_dealer):
    s = admin_and_dealer
    # Give the job a schedule-only edit (not touching the broker) -- dealer
    # info in the response should still reflect the (unchanged) dealer.
    res = s["client"].put(
        f"/api/scraper/jobs/{s['job_id']}",
        json={"schedule_hours": 48},
        headers=s["headers"],
    )
    assert res.status_code == 200, res.text
    job = res.json()["job"]
    assert int(job["schedule_hours"]) == 48
    assert job["dealer_id"] == s["dealer_id"]
    assert job["dealer_email"] == s["dealer_email"]
