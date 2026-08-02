"""Shared phone number normalization.

Uses the `phonenumbers` library (the Python port of Google's libphonenumber
metadata — the same data `libphonenumber-js` uses on the frontend, so both
layers agree on what's valid).
"""
import phonenumbers


def normalize_phone(raw: str | None, default_region: str = "US") -> str | None:
    """Best-effort normalize a user-supplied phone number to E.164.

    Never raises and never blocks on a format the number doesn't cleanly
    parse into — a phone field that's merely oddly formatted shouldn't fail
    a whole form submission over it. Returns the original (stripped) string
    unchanged if it can't be confidently parsed.
    """
    if not raw:
        return None
    raw = raw.strip()
    if not raw:
        return None
    # "00" is the ITU-standard international call prefix used by the vast
    # majority of countries (the US/Canada's "011" is the outlier), but
    # phonenumbers.parse() only recognizes it as such when the *default
    # region's own* IDD prefix is "00" — so "0047..." parsed with
    # default_region="US" is treated as a national US number, not escaped
    # to international. Normalize it to "+" ourselves first.
    if raw.startswith("00"):
        raw = "+" + raw[2:]
    try:
        parsed = phonenumbers.parse(raw, default_region)
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        pass
    return raw
