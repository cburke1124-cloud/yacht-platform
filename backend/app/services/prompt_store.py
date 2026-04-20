"""Simple file-based prompt store for AI scraper prompts.

Prompts are stored in backend/app/data/scraper_prompts.json.
Overrides are loaded at call time; defaults are defined here.
"""

import json
from pathlib import Path

_DATA_DIR  = Path(__file__).parent.parent / "data"
_PROMPTS_FILE = _DATA_DIR / "scraper_prompts.json"

# ---------------------------------------------------------------------------
# Default prompt text — these mirror the hardcoded prompts in scraper.py.
# The stored/returned text is the *instruction block only* — the backend
# always appends the dynamic payload (URL, content, existing data) in code.
# ---------------------------------------------------------------------------
_DEFAULTS: dict[str, str] = {
    "full": (
        "Extract all yacht listing data from the text below. Return ONLY a JSON object.\n\n"
        "Fields to extract: title, make, model, year, price, currency, length_feet, beam_feet, draft_feet,\n"
        "cabins, berths, heads, engine_count, engine_hours, fuel_type, max_speed_knots, cruising_speed_knots,\n"
        "hull_material, hull_type, city, state, country, description, boat_type,\n"
        "agent_name (listing agent/salesman name if clearly present),\n"
        "features (all notable features and equipment as a single multi-line text block, one feature per line prefixed with \"- \"),\n"
        "feature_bullets (array of up to 12 short bullet-point strings highlighting the best features).\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. Location (city/state/country) is often NOT in a dedicated field. Read the FULL text carefully:\n"
        "   - Look for: \"located in X\", \"currently in X\", \"presently at X marina\", \"homeported in X\",\n"
        "     \"available in X\", \"moored at X\", \"berthed at X\", \"on the [coast/waterway] of X\"\n"
        "   - Recognize marina and port names that imply a location:\n"
        "     e.g. \"Coal Harbour\" or \"False Creek\" → Vancouver, BC, Canada\n"
        "          \"Shilshole Bay\" → Seattle, WA, USA\n"
        "          \"Antibes\" or \"Port Vauban\" → France\n"
        "          \"Palma\" or \"Puerto Portals\" → Mallorca, Spain\n"
        "          \"Ft. Lauderdale\" / \"Fort Lauderdale\" → Florida, USA\n"
        "          \"Annapolis\" → Maryland, USA\n"
        "   - Use context clues: phone number country code, currency, broker's own city, marina names\n"
        "2. Length, engine horsepower/power, beam, draft, and other specs may appear ONLY in description\n"
        "   prose — extract them even if they are not in a labeled spec field.\n"
        "3. For country: use the actual country where the vessel IS LOCATED (not the broker's country).\n"
        "   Be specific — never default to USA unless the text clearly places the vessel there.\n"
        "4. If a field is genuinely not mentioned anywhere in the text, omit it rather than guessing.\n"
        "5. For title: use exactly 'YEAR MAKE MODEL' format (e.g. '2019 Azimut 43'). "
        "Do NOT include length, condition, or location in the title.\n"
        "6. For description: write a clean, concise description broken into short paragraphs "
        "(2-3 sentences each). Do not write walls of text. Each paragraph should cover one aspect: "
        "what the vessel is, key specs/features, and condition/history. "
        "No flowery language — write as if briefing a professional broker: factual, direct, and succinct."
    ),
    "partial": (
        "Fill in as many missing fields as possible for this yacht listing.\n\n"
        "CRITICAL: Many yacht broker sites do NOT put location in a dedicated field — it appears only\n"
        "in the description or body text. Read the FULL content carefully and look for:\n"
        "- Explicit location mentions: \"located in X\", \"currently in X\", \"presently at X marina\",\n"
        "  \"homeported in X\", \"available in X\", \"moored at X\", \"on the coast of X\"\n"
        "- Named marinas or ports that imply a city/country (e.g. \"Coal Harbour\" → Vancouver, BC, Canada;\n"
        "  \"Antibes\" → France; \"Palma\" → Mallorca, Spain; \"Newport\" → check context for RI vs. CA)\n"
        "- Country context clues: phone number format, currency, broker address, marina/port names\n\n"
        "Also extract from prose if not in structured fields: length (\"X feet\", \"X'\", \"Xm\"),\n"
        "engine horsepower/power, beam, draft, and any other specs mentioned in sentences.\n\n"
        "For description: write a clean, concise description broken into short paragraphs "
        "(2-3 sentences each). Do not write walls of text. Each paragraph should cover one aspect: "
        "what the vessel is, key specs/features, and condition/history. "
        "No flowery language — write as if briefing a professional broker: factual, direct, and succinct.\n\n"
        "Return ONLY a JSON object with all yacht listing fields you can determine.\n"
        "Include \"agent_name\" if a listing agent/salesman name is clearly present.\n"
        "Include: features (multi-line text, one per line prefixed with \"- \"), "
        "feature_bullets (array ≤12 short bullets).\n"
        "For country: use the actual country where the VESSEL is located, not the broker. Be specific."
    ),
}

_LABELS = {
    "full": "Full Extraction Prompt",
    "partial": "Fill-In Prompt",
}

_DESCRIPTIONS = {
    "full": (
        "Used when scraping a new listing from scratch. "
        "Instructs the AI on what fields to extract and how to interpret the page."
    ),
    "partial": (
        "Used when some fields are already known (e.g. from HTML selectors). "
        "Instructs the AI to fill in missing fields from the page text."
    ),
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_prompt(key: str) -> str:
    """Return the current active prompt for *key* (override → default fallback)."""
    overrides = _load_overrides()
    return overrides.get(key) or _DEFAULTS.get(key, "")


def save_prompt(key: str, text: str) -> None:
    """Persist an override for *key*."""
    if key not in _DEFAULTS:
        raise ValueError(f"Unknown prompt key: {key!r}")
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    overrides = _load_overrides()
    overrides[key] = text.strip()
    _PROMPTS_FILE.write_text(json.dumps(overrides, indent=2, ensure_ascii=False), encoding="utf-8")


def reset_prompt(key: str) -> str:
    """Remove the override for *key*, reverting to the hardcoded default."""
    if key not in _DEFAULTS:
        raise ValueError(f"Unknown prompt key: {key!r}")
    overrides = _load_overrides()
    overrides.pop(key, None)
    if overrides:
        _PROMPTS_FILE.write_text(json.dumps(overrides, indent=2, ensure_ascii=False), encoding="utf-8")
    elif _PROMPTS_FILE.exists():
        _PROMPTS_FILE.unlink()
    return _DEFAULTS[key]


def get_all_prompts() -> dict:
    """Return metadata + current text for every prompt key."""
    overrides = _load_overrides()
    result = {}
    for key, default in _DEFAULTS.items():
        result[key] = {
            "key": key,
            "label": _LABELS.get(key, key),
            "description": _DESCRIPTIONS.get(key, ""),
            "text": overrides.get(key) or default,
            "is_customized": key in overrides,
            "default": default,
        }
    return result


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

def _load_overrides() -> dict:
    if not _PROMPTS_FILE.exists():
        return {}
    try:
        return json.loads(_PROMPTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}
