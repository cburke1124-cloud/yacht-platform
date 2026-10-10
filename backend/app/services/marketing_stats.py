"""Market statistics over the site's own listings, for the marketing agent's data-backed posts.

Pure functions only (no database access) so the numbers are easy to test. A post such as "how much
does a 40-foot sailboat cost?" is only as trustworthy as these figures, so the rules are strict:
- only USD asking prices are summarised (others are counted and reported, never converted);
- listings with no price are counted separately and never treated as zero;
- a small sample is flagged so the agent doesn't present three boats as "the market".
"""
import statistics
from collections import Counter
from typing import Iterable, Optional

MIN_SAMPLE = 8
_TOP_MAKES = 8
_TOP_STATES = 6
_TOP_TYPES = 12


def _quartiles(values: list[float]) -> tuple[float, float, float]:
    if len(values) == 1:
        return values[0], values[0], values[0]
    q1, q2, q3 = statistics.quantiles(values, n=4, method="inclusive")
    return q1, q2, q3


def _top(rows: Iterable[dict], key: str, limit: int) -> list[dict]:
    counts = Counter((r.get(key) or "").strip() for r in rows)
    counts.pop("", None)
    return [{"name": name, "count": count} for name, count in counts.most_common(limit)]


def _range(values: list[float], digits: int = 1) -> Optional[dict]:
    if not values:
        return None
    return {
        "min": round(min(values), digits),
        "median": round(statistics.median(values), digits),
        "max": round(max(values), digits),
    }


def _example(row: dict, site_url: str) -> dict:
    return {
        "id": row["id"],
        "url": f"{site_url.rstrip('/')}/listings/{row['id']}",
        "title": row.get("title"),
        "price": row.get("price"),
        "year": row.get("year"),
        "length_feet": row.get("length_feet"),
        "boat_type": row.get("boat_type"),
        "city": row.get("city"),
        "state": row.get("state"),
    }


def summarize(rows: list[dict], site_url: str) -> dict:
    priced = [r for r in rows if (r.get("price") or 0) > 0]
    usd = [r for r in priced if (r.get("currency") or "USD").upper() == "USD"]

    price = None
    examples: list[dict] = []
    if usd:
        ordered = sorted(usd, key=lambda r: (r["price"], r["id"]))
        values = [r["price"] for r in ordered]
        q1, median, q3 = _quartiles(values)
        price = {
            "min": round(values[0]),
            "p25": round(q1),
            "median": round(median),
            "p75": round(q3),
            "max": round(values[-1]),
        }
        # three real boats spread across the range, so the post can link to concrete examples
        picks, seen = [], set()
        for fraction in (0.25, 0.5, 0.75):
            row = ordered[min(len(ordered) - 1, int(fraction * len(ordered)))]
            if row["id"] not in seen:
                seen.add(row["id"])
                picks.append(row)
        examples = [_example(r, site_url) for r in picks]

    years = [r["year"] for r in rows if r.get("year")]
    year_block = None
    if years:
        year_block = {"min": min(years), "median": round(statistics.median(years)), "max": max(years)}

    return {
        "total_listings": len(rows),
        "priced_listings": len(usd),
        "unpriced_listings": len(rows) - len(priced),
        "non_usd_listings": len(priced) - len(usd),
        "sample_small": len(usd) < MIN_SAMPLE,
        "price": price,
        "length_feet": _range([r["length_feet"] for r in rows if r.get("length_feet")]),
        "year": year_block,
        "top_makes": _top(rows, "make", _TOP_MAKES),
        "top_states": _top(rows, "state", _TOP_STATES),
        "boat_types": _top(rows, "boat_type", _TOP_TYPES),
        "examples": examples,
    }
