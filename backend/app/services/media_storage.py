import mimetypes
import os
from functools import lru_cache
from urllib.parse import urlparse
from datetime import datetime
from uuid import uuid4

import boto3

from app.services.clamav_service import scan_bytes as _clamav_scan


UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
STORAGE_BACKEND = os.getenv("MEDIA_STORAGE_BACKEND", "local").strip().lower()

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "").strip()
S3_REGION = os.getenv("S3_REGION", "us-east-1").strip()
S3_BUCKET = os.getenv("S3_BUCKET", "").strip()
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "").strip()
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "").strip()
S3_PREFIX = os.getenv("S3_PREFIX", "uploads").strip("/")
S3_PUBLIC_BASE_URL = os.getenv("S3_PUBLIC_BASE_URL", "").strip().rstrip("/")
# Cloudflare R2 does not support ACLs — default to empty (no ACL header sent)
# Set S3_OBJECT_ACL=public-read only if using AWS S3, not R2
S3_OBJECT_ACL = os.getenv("S3_OBJECT_ACL", "").strip()


def _is_s3_ready() -> bool:
    return (
        STORAGE_BACKEND == "s3"
        and bool(S3_BUCKET)
        and bool(S3_ACCESS_KEY_ID)
        and bool(S3_SECRET_ACCESS_KEY)
        and bool(S3_ENDPOINT_URL)
    )


@lru_cache(maxsize=1)
def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        region_name=S3_REGION,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
    )


def _build_key(filename: str) -> str:
    return f"{S3_PREFIX}/{filename}" if S3_PREFIX else filename


def store_media_bytes(filename: str, content: bytes, content_type: str | None = None) -> str:
    # -- Virus scan ----------------------------------------------------------
    result = _clamav_scan(content, filename)
    if not result.clean:
        raise ValueError(
            f"File rejected: virus/malware detected ({result.threat}). "
            "Upload blocked by security policy."
        )
    # ------------------------------------------------------------------------

    if _is_s3_ready():
        object_key = _build_key(filename)
        upload_kwargs = {
            "Bucket": S3_BUCKET,
            "Key": object_key,
            "Body": content,
            "ContentType": content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream",
        }
        if S3_OBJECT_ACL:
            upload_kwargs["ACL"] = S3_OBJECT_ACL
        _s3_client().put_object(**upload_kwargs)

        if S3_PUBLIC_BASE_URL:
            return f"{S3_PUBLIC_BASE_URL}/{object_key}"
        return f"{S3_ENDPOINT_URL.rstrip('/')}/{S3_BUCKET}/{object_key}"

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as stream:
        stream.write(content)
    return f"/uploads/{filename}"


def delete_media_by_url(url: str | None):
    if not url:
        return

    if url.startswith("/uploads/"):
        filename = url.split("/uploads/", 1)[1]
        if filename:
            path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(path):
                os.remove(path)
        return

    if not _is_s3_ready():
        return

    object_key = None

    if S3_PUBLIC_BASE_URL and url.startswith(f"{S3_PUBLIC_BASE_URL}/"):
        object_key = url.split(f"{S3_PUBLIC_BASE_URL}/", 1)[1]
    else:
        parsed = urlparse(url)
        path = parsed.path.lstrip("/")
        if path.startswith(f"{S3_BUCKET}/"):
            object_key = path.split(f"{S3_BUCKET}/", 1)[1]
        else:
            object_key = path

    if object_key:
        _s3_client().delete_object(Bucket=S3_BUCKET, Key=object_key)


def get_storage_health() -> dict:
    backend = "s3" if STORAGE_BACKEND == "s3" else "local"

    if backend == "local":
        return {
            "status": "ok",
            "backend": "local",
            "ready": True,
            "upload_dir": UPLOAD_DIR,
            "issues": None,
        }

    issues = []
    if not S3_ENDPOINT_URL:
        issues.append("S3_ENDPOINT_URL is missing")
    if not S3_BUCKET:
        issues.append("S3_BUCKET is missing")
    if not S3_ACCESS_KEY_ID:
        issues.append("S3_ACCESS_KEY_ID is missing")
    if not S3_SECRET_ACCESS_KEY:
        issues.append("S3_SECRET_ACCESS_KEY is missing")

    ready = _is_s3_ready() and len(issues) == 0

    return {
        "status": "ok" if ready else "misconfigured",
        "backend": "s3",
        "ready": ready,
        "bucket": S3_BUCKET or "(not set)",
        "endpoint": S3_ENDPOINT_URL or "(not set)",
        "region": S3_REGION,
        "issues": ", ".join(issues) if issues else None,
    }


def run_storage_test() -> dict:
    health = get_storage_health()
    backend = health["backend"]

    if backend == "local":
        test_filename = f"healthcheck_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid4().hex}.txt"
        path = os.path.join(UPLOAD_DIR, test_filename)
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        with open(path, "w", encoding="utf-8") as stream:
            stream.write("ok")
        exists_after_write = os.path.exists(path)
        if exists_after_write:
            os.remove(path)
        return {
            "success": exists_after_write,
            "backend": "local",
            "message": "Local storage write/delete test passed" if exists_after_write else "Local storage write test failed",
        }

    if not health["ready"]:
        return {
            "success": False,
            "backend": "s3",
            "message": "S3 configuration is incomplete",
            "issues": health.get("issues"),
        }

    object_key = _build_key(f"healthcheck/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid4().hex}.txt")
    client = _s3_client()
    client.put_object(
        Bucket=S3_BUCKET,
        Key=object_key,
        Body=b"ok",
        ContentType="text/plain",
    )
    client.delete_object(Bucket=S3_BUCKET, Key=object_key)
    return {
        "success": True,
        "backend": "s3",
        "message": "S3 put/delete test passed",
        "object_key": object_key,
    }
