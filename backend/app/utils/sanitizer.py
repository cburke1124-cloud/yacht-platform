import html
import re
from app.exceptions import ValidationException


class InputSanitizer:
    @staticmethod
    def sanitize_string(text: str, max_length: int = 5000) -> str:
        if not text:
            return ""
        text = text[:max_length]
        text = html.escape(text)
        text = re.sub(r"[<>]", "", text)
        return text.strip()

    @staticmethod
    def sanitize_email(email: str) -> str:
        if not email:
            return ""
        email = email.lower().strip()
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, email):
            raise ValidationException("Invalid email format")
        return email

    @staticmethod
    def sanitize_phone(phone: str) -> str:
        if not phone:
            return ""
        phone = re.sub(r"\D", "", phone)
        if len(phone) < 7 or len(phone) > 15:
            raise ValidationException("Invalid phone number")
        return phone

    @staticmethod
    def sanitize_url(url: str) -> str:
        if not url:
            return ""
        url = url.strip()
        if not url.startswith(("http://", "https://")):
            raise ValidationException("URL must start with http:// or https://")
        pattern = r"^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$"
        if not re.match(pattern, url):
            raise ValidationException("Invalid URL format")
        return url

    @staticmethod
    def sanitize_numeric(value, min_val=None, max_val=None) -> float:
        try:
            num = float(value)
        except Exception:
            raise ValidationException("Invalid numeric value")
        if min_val is not None and num < min_val:
            raise ValidationException(f"Value must be at least {min_val}")
        if max_val is not None and num > max_val:
            raise ValidationException(f"Value must be at most {max_val}")
        return num