"""
ClamAV virus scanning service.

Controlled by env vars:
    ENABLE_CLAMAV=1         (default 0 — disabled)
    CLAMD_SOCKET=...        Unix socket path (tried first when set)
    CLAMD_HOST=127.0.0.1    TCP host (fallback)
    CLAMD_PORT=3310         TCP port (fallback)

When ENABLE_CLAMAV is not "1" the scanner is a no-op so the rest of the
application works unchanged in development environments without ClamAV.
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

ENABLE_CLAMAV = os.getenv("ENABLE_CLAMAV", "0").strip() == "1"
CLAMD_SOCKET  = os.getenv("CLAMD_SOCKET", "").strip()
CLAMD_HOST    = os.getenv("CLAMD_HOST", "127.0.0.1").strip()
CLAMD_PORT    = int(os.getenv("CLAMD_PORT", "3310"))


@dataclass
class ScanResult:
    clean: bool
    threat: Optional[str] = None   # e.g. "Win.Test.EICAR_HDB-1"
    error: Optional[str] = None    # set when scan could not be performed


def _get_clamd():
    """Return a connected pyclamd instance, or None on failure."""
    try:
        import pyclamd  # type: ignore

        # Prefer Unix socket when configured
        if CLAMD_SOCKET:
            try:
                cd = pyclamd.ClamdUnixSocket(CLAMD_SOCKET)
                cd.ping()
                return cd
            except Exception as sock_err:
                logger.warning(
                    "ClamAV Unix socket %s unavailable (%s); falling back to TCP",
                    CLAMD_SOCKET,
                    sock_err,
                )

        # TCP fallback
        cd = pyclamd.ClamdNetworkSocket(CLAMD_HOST, CLAMD_PORT)
        cd.ping()
        return cd

    except ImportError:
        logger.error("pyclamd is not installed — virus scanning unavailable")
        return None
    except Exception as exc:
        logger.error("Cannot connect to ClamAV daemon: %s", exc)
        return None


def scan_bytes(data: bytes, filename: str = "<unknown>") -> ScanResult:
    """
    Scan raw bytes for viruses.

    Returns a ScanResult:
      - clean=True              → file is safe to store
      - clean=False, threat=... → infection detected; caller should reject file
      - clean=True, error=...   → scan could not run (ClamAV disabled/down);
                                  file is allowed through with a warning logged
    """
    if not ENABLE_CLAMAV:
        return ScanResult(clean=True)

    cd = _get_clamd()
    if cd is None:
        msg = "ClamAV daemon unreachable — file accepted without scanning"
        logger.warning("%s: %s", filename, msg)
        return ScanResult(clean=True, error=msg)

    try:
        result = cd.scan_stream(data)
        # pyclamd returns None for clean files,
        # or {"stream": ("FOUND", "ThreatName")} for infected ones
        if result is None:
            return ScanResult(clean=True)

        # result looks like: {"stream": ("FOUND", "Virus.Name")}
        status, threat_name = next(iter(result.values()))
        if status == "FOUND":
            logger.warning(
                "ClamAV INFECTED: %s — threat: %s", filename, threat_name
            )
            return ScanResult(clean=False, threat=threat_name)

        # ERROR status
        logger.error("ClamAV scan error for %s: %s %s", filename, status, threat_name)
        return ScanResult(clean=True, error=f"{status}: {threat_name}")

    except Exception as exc:
        msg = f"ClamAV scan exception: {exc}"
        logger.error("%s: %s", filename, msg)
        return ScanResult(clean=True, error=msg)


def health_check() -> dict:
    """Return ClamAV connectivity status for the /health endpoint."""
    if not ENABLE_CLAMAV:
        return {"enabled": False, "status": "disabled"}

    cd = _get_clamd()
    if cd is None:
        return {"enabled": True, "status": "unavailable"}

    try:
        version = cd.version()
        return {"enabled": True, "status": "ok", "version": version}
    except Exception as exc:
        return {"enabled": True, "status": "error", "detail": str(exc)}
