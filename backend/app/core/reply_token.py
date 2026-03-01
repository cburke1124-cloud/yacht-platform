"""
Tamper-proof tokens used in Reply-To email addresses and SMS tracking.

Format (base64url): `{message_id}:{user_id}:{hmac_signature}`
Signed with the app's SECRET_KEY — no expiry needed because tokens are
single-use reply addresses tied to a specific message thread.
"""
import hmac
import hashlib
import base64
import logging

logger = logging.getLogger(__name__)


def _secret() -> bytes:
    from app.core.config import settings
    return settings.SECRET_KEY.encode()


def generate_reply_token(message_id: int, recipient_user_id: int) -> str:
    """
    Create a URL-safe signed token that encodes which message and which
    user should be credited for the reply.
    """
    payload = f"{message_id}:{recipient_user_id}"
    sig = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    raw = f"{payload}:{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_reply_token(token: str) -> tuple[int, int] | None:
    """
    Decode and verify a reply token.

    Returns ``(message_id, recipient_user_id)`` on success, ``None`` if the
    token is invalid, tampered, or malformed.
    """
    try:
        pad = "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode((token + pad).encode()).decode()
        parts = raw.split(":")
        if len(parts) != 3:
            return None
        msg_id_str, user_id_str, provided_sig = parts
        expected_payload = f"{msg_id_str}:{user_id_str}"
        expected_sig = hmac.new(
            _secret(), expected_payload.encode(), hashlib.sha256
        ).hexdigest()[:24]
        if not hmac.compare_digest(provided_sig, expected_sig):
            logger.warning("reply_token: signature mismatch")
            return None
        return int(msg_id_str), int(user_id_str)
    except Exception as exc:
        logger.debug(f"reply_token: decode failed: {exc}")
        return None
