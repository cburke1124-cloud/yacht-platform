from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Any
import os
import re
import json

import requests

router = APIRouter()


class ParseTextRequest(BaseModel):
    text: str
    user_id: Optional[int] = None


def _to_float(value: str | None) -> Optional[float]:
    if not value:
        return None
    cleaned = value.replace(",", "").strip()
    try:
        return float(cleaned)
    except Exception:
        return None


def _to_int(value: str | None) -> Optional[int]:
    number = _to_float(value)
    return int(number) if number is not None else None


def _first(patterns: list[str], text: str, flags: int = re.IGNORECASE) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match and match.group(1):
            return match.group(1).strip()
    return None


def _fallback_parse(text: str) -> dict[str, Any]:
    lines = [line.strip() for line in text.replace("\r", "").split("\n") if line.strip()]

    year = _first([r"\b(19\d{2}|20\d{2})\b"], text)
    title = lines[0] if lines else None

    price = _first([
        r"price\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d+)?)",
        r"\$\s*([\d,]+(?:\.\d+)?)",
    ], text)

    make = _first([
        r"\b(Azimut|Beneteau|Bertram|Boston\s*Whaler|Cabo|Carver|Chris\-Craft|Ferretti|Formula|Hatteras|Jeanneau|Leopard|Meridian|Monterey|Monte\s*Carlo|Nordhavn|Pershing|Princess|Regal|Riva|Sanlorenzo|Sea\s*Ray|Sunseeker|Tiara|Viking|Yamaha|Yellowfin|Mercury|MTU|MAN|Cummins|Volvo\s*Penta)\b"
    ], text)

    model = _first([r"model\s*[:\-]?\s*([^\n]+)"], text)

    length = _first([
        r"(?:loa|length(?:\s+overall)?)\s*[:\-]?\s*([\d.]+)",
        r"\b([\d.]+)\s*(?:ft|feet|')\b",
    ], text)

    beam = _first([r"beam\s*[:\-]?\s*([\d.]+)"], text)
    draft = _first([r"draft(?:\s*(?:max|min)?)?\s*[:\-]?\s*([\d.]+)"], text)

    cabins = _first([r"cabins?\s*[:\-]?\s*(\d+)"], text)
    berths = _first([r"(?:berths?|sleeps?|guests?)\s*[:\-]?\s*(\d+)"], text)
    heads = _first([r"heads?\s*[:\-]?\s*(\d+)"], text)

    max_speed = _first([r"max\s*speed\s*[:\-]?\s*([\d.]+)"], text)
    cruise_speed = _first([r"cruis(?:e|ing)\s*speed\s*[:\-]?\s*([\d.]+)"], text)

    fuel_capacity = _first([r"fuel\s*(?:tank|capacity)?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)"], text)
    water_capacity = _first([r"(?:fresh\s*water|water\s*tank|water\s*capacity)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)"], text)

    hull_material = _first([r"hull\s*material\s*[:\-]?\s*([^\n]+)"], text)
    hull_type = _first([r"hull\s*(?:shape|type)\s*[:\-]?\s*([^\n]+)"], text)
    fuel_type = _first([r"fuel\s*type\s*[:\-]?\s*([^\n]+)"], text)

    city_state = _first([r"located\s+in\s+([^\n]+)"], text)
    city = None
    state = None
    country = None
    if city_state:
        parts = [p.strip() for p in city_state.split(",") if p.strip()]
        if len(parts) >= 1:
            city = parts[0]
        if len(parts) >= 2:
            state = parts[1]
        if len(parts) >= 3:
            country = parts[2]

    engine_count = None
    headers = re.findall(r"engine\s*\d+", text, flags=re.IGNORECASE)
    if headers:
        engine_count = len(headers)
    elif re.search(r"\bquad\b", text, flags=re.IGNORECASE):
        engine_count = 4
    elif re.search(r"\btriple\b", text, flags=re.IGNORECASE):
        engine_count = 3
    elif re.search(r"\btwin\b", text, flags=re.IGNORECASE):
        engine_count = 2
    elif re.search(r"\bsingle\b", text, flags=re.IGNORECASE):
        engine_count = 1

    bullets = [
        re.sub(r"^[-•*]\s+", "", line).strip()
        for line in lines
        if re.match(r"^[-•*]\s+", line)
    ]

    return {
        "title": title,
        "description": text,
        "price": _to_float(price),
        "year": _to_int(year),
        "make": make,
        "model": model,
        "length_feet": _to_float(length),
        "beam_feet": _to_float(beam),
        "draft_feet": _to_float(draft),
        "cabins": _to_int(cabins),
        "berths": _to_int(berths),
        "heads": _to_int(heads),
        "max_speed_knots": _to_float(max_speed),
        "cruising_speed_knots": _to_float(cruise_speed),
        "fuel_capacity_gallons": _to_float(fuel_capacity),
        "water_capacity_gallons": _to_float(water_capacity),
        "hull_material": hull_material,
        "hull_type": hull_type,
        "fuel_type": fuel_type,
        "engine_count": engine_count,
        "city": city,
        "state": state,
        "country": country,
        "feature_bullets": bullets[:8] if bullets else None,
        "features": text,
    }


def _claude_extract_if_available(text: str) -> Optional[dict[str, Any]]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    prompt = f"""Extract yacht listing fields from this text and return JSON only.

Text:
{text[:12000]}

Fields:
- title, make, model, year, price
- length_feet, beam_feet, draft_feet
- cabins, berths, heads
- engine_make, engine_model, engine_type, engine_count, engine_hours
- fuel_type, fuel_capacity_gallons, water_capacity_gallons
- max_speed_knots, cruising_speed_knots
- city, state, country
- hull_material, hull_type
- feature_bullets (array of strings), features (string)
"""

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1200,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=25,
    )

    if not response.ok:
        return None

    payload = response.json()
    content = payload.get("content", [])
    if not content:
        return None

    text_blob = content[0].get("text", "").strip()
    text_blob = re.sub(r"^```json\s*", "", text_blob)
    text_blob = re.sub(r"\s*```$", "", text_blob)
    parsed = json.loads(text_blob)
    return parsed if isinstance(parsed, dict) else None


@router.post("/scraper/parse-text")
def parse_listing_text(data: ParseTextRequest):
    if not data.text or not data.text.strip():
        return {"success": False, "message": "Text is required"}

    try:
        ai_data = _claude_extract_if_available(data.text)
    except Exception:
        ai_data = None

    fallback = _fallback_parse(data.text)
    merged = {**fallback, **(ai_data or {})}

    return {"success": True, "data": merged}
