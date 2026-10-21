"""Admin-dashboard bridge to the standalone marketing agent.

The browser never talks to the agent: these admin-only endpoints call it server-to-server with the
shared MARKETING_AGENT_API_KEY, so the key stays on the server and the agent can sit behind its own
host. Inert (503 "not configured") until MARKETING_AGENT_URL and MARKETING_AGENT_API_KEY are set.

Also hosts the one action the agent is deliberately not allowed to do: publishing a blog draft it
created. A signed-in admin must click it, after reviewing the draft.
"""
import logging
import os
from datetime import datetime
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.exceptions import AuthorizationException
from app.models.blog import BlogPost, PostStatus
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

_TIMEOUT_SECONDS = 20


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    return current_user


def _config() -> tuple[str, str]:
    url = os.getenv("MARKETING_AGENT_URL", "").strip().rstrip("/")
    key = os.getenv("MARKETING_AGENT_API_KEY", "").strip()
    if not url or not key:
        raise HTTPException(status_code=503, detail="The marketing agent is not connected (MARKETING_AGENT_URL / MARKETING_AGENT_API_KEY)")
    return url, key


def _call(method: str, path: str, params: Optional[dict] = None) -> dict:
    url, key = _config()
    try:
        response = requests.request(
            method,
            f"{url}/api/admin{path}",
            params=params,
            headers={"X-Agent-Key": key, "Accept": "application/json"},
            timeout=_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.warning("Marketing agent unreachable: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach the marketing agent")
    if response.status_code in (401, 503):
        # Our key is wrong / the agent's key is unset: that is a setup problem, not the admin's request.
        raise HTTPException(status_code=502, detail="The marketing agent rejected this site's key or is not configured")
    try:
        body = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="The marketing agent returned an invalid response")
    if 400 <= response.status_code < 500:
        raise HTTPException(status_code=response.status_code, detail=body.get("detail") or "Request refused")
    if response.status_code >= 300 and response.status_code != 202:
        raise HTTPException(status_code=502, detail=f"The marketing agent returned HTTP {response.status_code}")
    return body


@router.get("/marketing/status")
def marketing_status(_: User = Depends(require_admin)):
    """Lets the tab show a setup message instead of an error when the agent is not connected yet."""
    try:
        _config()
    except HTTPException as exc:
        return {"configured": False, "detail": exc.detail}
    return {"configured": True}


@router.get("/marketing/overview")
def overview(_: User = Depends(require_admin)):
    return _call("GET", "/overview")


@router.get("/marketing/drafts")
def drafts(status: Optional[str] = Query(None, max_length=20), _: User = Depends(require_admin)):
    return _call("GET", "/drafts", {"status": status} if status else None)


@router.get("/marketing/site-posts")
def site_posts(_: User = Depends(require_admin)):
    return _call("GET", "/site-posts")


@router.post("/marketing/drafts/{draft_id}/{action}")
def draft_action(draft_id: int, action: str, _: User = Depends(require_admin)):
    if action not in ("approve", "reject", "publish"):
        raise HTTPException(status_code=404, detail="Unknown action")
    return _call("POST", f"/drafts/{draft_id}/{action}")


@router.post("/marketing/site-posts/{post_id}/{action}")
def site_post_action(post_id: int, action: str, _: User = Depends(require_admin)):
    if action not in ("send", "discard"):
        raise HTTPException(status_code=404, detail="Unknown action")
    return _call("POST", f"/site-posts/{post_id}/{action}")


@router.post("/marketing/clients/{client_id}/{action:path}")
def client_run(client_id: int, action: str, _: User = Depends(require_admin)):
    if action not in ("sync", "topics/run"):
        raise HTTPException(status_code=404, detail="Unknown action")
    return _call("POST", f"/clients/{client_id}/{action}")


@router.post("/marketing/blog/{post_id}/publish")
def publish_blog_draft(post_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Publish a blog DRAFT (e.g. one the agent wrote). Only drafts can be published here."""
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.deleted_at.is_(None)).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status != PostStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Only a draft can be published from here")
    post.status = PostStatus.PUBLISHED
    post.published_at = datetime.utcnow()
    db.commit()
    return {"success": True, "post_id": post.id, "slug": post.slug, "status": "published"}
