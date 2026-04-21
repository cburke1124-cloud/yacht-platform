"""
YachtWorld / Boats Group API feed management routes.

Admin-only. Manages YachtworldSyncJob records and triggers sync runs.
All sync calls are routed through the proxy (enforced in the service layer).

Routes:
  GET    /yachtworld/jobs              — list all feed jobs
  POST   /yachtworld/jobs              — create a new feed job
  GET    /yachtworld/jobs/{id}         — get single job
  PUT    /yachtworld/jobs/{id}         — update job
  DELETE /yachtworld/jobs/{id}         — delete job
  POST   /yachtworld/jobs/{id}/run     — trigger immediate sync (background)
  POST   /yachtworld/jobs/{id}/toggle  — enable / disable
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.exceptions import AuthorizationException
from app.models.misc import YachtworldSyncJob
from app.models.user import User
from app.services.yachtworld_api import sync_yachtworld_job

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _require_admin(current_user: User) -> None:
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CreateYWJobRequest(BaseModel):
    dealer_id: int
    salesman_id: Optional[int] = None
    site_name: Optional[str] = None
    api_endpoint: str
    api_key: str
    schedule_hours: Optional[int] = 24
    notes: Optional[str] = None
    enabled: Optional[bool] = True


class UpdateYWJobRequest(BaseModel):
    dealer_id: Optional[int] = None
    salesman_id: Optional[int] = None
    site_name: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None          # blank string = no change
    schedule_hours: Optional[int] = None
    notes: Optional[str] = None
    enabled: Optional[bool] = None


# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------

def _job_to_dict(job: YachtworldSyncJob) -> dict:
    return {
        "id": job.id,
        "dealer_id": job.dealer_id,
        "salesman_id": job.salesman_id,
        "site_name": job.site_name,
        "api_endpoint": job.api_endpoint,
        "api_key_set": bool(job.api_key),   # never return the actual key
        "schedule_hours": job.schedule_hours,
        "enabled": job.enabled,
        "status": job.status,
        "notes": job.notes,
        "listings_found": job.listings_found,
        "listings_created": job.listings_created,
        "listings_updated": job.listings_updated,
        "listings_removed": job.listings_removed,
        "total_runs": job.total_runs,
        "last_error": job.last_error,
        "last_run_at": job.last_run_at.isoformat() if job.last_run_at else None,
        "next_run_at": job.next_run_at.isoformat() if job.next_run_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "last_run_log": job.last_run_log,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/yachtworld/jobs")
def list_yw_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    jobs = db.query(YachtworldSyncJob).order_by(YachtworldSyncJob.id.desc()).all()
    return [_job_to_dict(j) for j in jobs]


@router.post("/yachtworld/jobs")
def create_yw_job(
    body: CreateYWJobRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = YachtworldSyncJob(
        dealer_id=body.dealer_id,
        salesman_id=body.salesman_id,
        created_by_id=current_user.id,
        site_name=body.site_name or body.api_endpoint,
        api_endpoint=body.api_endpoint.strip(),
        api_key=body.api_key.strip(),
        schedule_hours=body.schedule_hours or 24,
        notes=body.notes,
        enabled=body.enabled if body.enabled is not None else True,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.get("/yachtworld/jobs/{job_id}")
def get_yw_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Feed job not found")
    return _job_to_dict(job)


@router.put("/yachtworld/jobs/{job_id}")
def update_yw_job(
    job_id: int,
    body: UpdateYWJobRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Feed job not found")

    if body.dealer_id is not None:
        job.dealer_id = body.dealer_id
    if body.salesman_id is not None:
        job.salesman_id = body.salesman_id
    if body.site_name is not None:
        job.site_name = body.site_name
    if body.api_endpoint is not None:
        job.api_endpoint = body.api_endpoint.strip()
    if body.api_key is not None and body.api_key.strip():
        job.api_key = body.api_key.strip()
    if body.schedule_hours is not None:
        job.schedule_hours = body.schedule_hours
    if body.notes is not None:
        job.notes = body.notes
    if body.enabled is not None:
        job.enabled = body.enabled

    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.delete("/yachtworld/jobs/{job_id}")
def delete_yw_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Feed job not found")
    db.delete(job)
    db.commit()
    return {"success": True}


@router.post("/yachtworld/jobs/{job_id}/run")
def run_yw_job(
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger an immediate sync in a background thread."""
    _require_admin(current_user)
    job = db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Feed job not found")
    if job.status == "running":
        raise HTTPException(status_code=409, detail="Job is already running")

    def _run():
        from app.db.session import SessionLocal
        _db = SessionLocal()
        try:
            sync_yachtworld_job(job_id, _db)
        finally:
            _db.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"success": True, "message": f"Feed job #{job_id} started"}


@router.post("/yachtworld/jobs/{job_id}/toggle")
def toggle_yw_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    job = db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Feed job not found")
    job.enabled = not job.enabled
    db.commit()
    return {"success": True, "enabled": job.enabled}


@router.get("/yachtworld/jobs/{job_id}/log")
def get_yw_job_log(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the structured log from the most recent sync run."""
    _require_admin(current_user)
    job = db.query(YachtworldSyncJob).filter(YachtworldSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Feed job not found")
    return {
        "job_id": job.id,
        "site_name": job.site_name,
        "status": job.status,
        "last_error": job.last_error,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "log": job.last_run_log or [],
    }
