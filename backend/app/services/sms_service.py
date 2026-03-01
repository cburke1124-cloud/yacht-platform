"""
SMS notification service via Twilio.

Environment variables required:
  TWILIO_ACCOUNT_SID   – Twilio account SID (starts with AC)
  TWILIO_AUTH_TOKEN    – Twilio auth token
  TWILIO_PHONE_NUMBER  – Your purchased Twilio number in E.164 (+12223334444)
"""
import os
import re
import logging
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    """
    Convert a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
    Returns the original string if it can't be parsed.
    """
    if not phone:
        return phone
    digits = re.sub(r"[^\d+]", "", phone)
    if digits.startswith("+"):
        return digits
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return digits  # international — pass through as-is


class SmsService:
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_PHONE_NUMBER")
        self._client = None

    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.from_number)

    @property
    def client(self):
        if self._client is None:
            if not self.is_configured():
                return None
            from twilio.rest import Client
            self._client = Client(self.account_sid, self.auth_token)
        return self._client

    def send_sms(self, to_phone: str, body: str) -> bool:
        """Send an SMS. Returns True on success."""
        if not self.is_configured():
            logger.info("Twilio not configured — skipping SMS")
            return False
        try:
            normalized = normalize_phone(to_phone)
            self.client.messages.create(
                body=body,
                from_=self.from_number,
                to=normalized,
            )
            logger.info(f"SMS sent to {normalized}")
            return True
        except Exception as exc:
            logger.error(f"Failed to send SMS to {to_phone}: {exc}")
            return False

    def track_conversation(
        self,
        dealer_user_id: int,
        dealer_phone: str,
        message_id: int,
        db: Session,
    ) -> None:
        """
        Upsert an SmsConversation record so that inbound replies from
        `dealer_phone` can be routed back to `message_id`.

        Uses a simple "latest active conversation" strategy per phone number:
        one row per dealer, updated each time a new notification is sent.
        """
        from app.models.misc import SmsConversation

        normalized = normalize_phone(dealer_phone)
        existing = (
            db.query(SmsConversation)
            .filter(SmsConversation.dealer_user_id == dealer_user_id)
            .first()
        )
        if existing:
            existing.dealer_phone = normalized
            existing.message_id = message_id
            existing.twilio_number = self.from_number
        else:
            db.add(
                SmsConversation(
                    dealer_user_id=dealer_user_id,
                    dealer_phone=normalized,
                    twilio_number=self.from_number,
                    message_id=message_id,
                )
            )
        try:
            db.commit()
        except Exception as exc:
            logger.error(f"Failed to save SmsConversation: {exc}")
            db.rollback()


# Singleton
sms_service = SmsService()
