"""
Shared handling for "the AI provider can't serve this request" failures
(no API key, exhausted credit, auth/overload errors, timeouts, unparseable
output). Callers raise AIUnavailableError instead of quietly degrading to
low-quality results; the API turns it into a 503 the frontend answers with a
"leave us a message" form so a human follows up.
"""
import logging
from typing import Optional

from app.exceptions import YachtVersalException

logger = logging.getLogger(__name__)

UNAVAILABLE_MESSAGE = (
    "Our AI assistant is temporarily unavailable. Leave us a message and "
    "our team will follow up with you personally."
)


class AIUnavailableError(YachtVersalException):
    def __init__(self, message: str = UNAVAILABLE_MESSAGE):
        super().__init__(message, 503)
        self.details = {"code": "ai_unavailable", "signup_required": False}


def log_ai_failure(context: str, response=None, exc: Optional[BaseException] = None) -> None:
    """Record why a Claude call failed so a dead key / empty balance is
    visible in the server logs instead of looking like a flaky search."""
    if response is not None:
        try:
            err = response.json().get("error", {})
            detail = f"{err.get('type')}: {err.get('message')}"
        except Exception:
            detail = (response.text or "")[:200]
        logger.error("AI unavailable (%s): HTTP %s — %s", context, response.status_code, detail)
    elif exc is not None:
        logger.error("AI unavailable (%s): %s: %s", context, type(exc).__name__, exc)
    else:
        logger.error("AI unavailable (%s)", context)
