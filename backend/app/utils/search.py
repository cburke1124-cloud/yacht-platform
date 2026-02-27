import re

def sanitize_search_query(q: str) -> str:
    return re.sub(r"[^a-zA-Z0-9\s]", "", q).strip()


def create_tsquery(q: str) -> str:
    return " & ".join(q.split())


def calculate_relevance_score(listing, query: str) -> float:
    score = 0
    q = query.lower()

    if q in (listing.title or "").lower():
        score += 3
    if q in (listing.make or "").lower():
        score += 2
    if q in (listing.model or "").lower():
        score += 2
    if q in (listing.description or "").lower():
        score += 1

    return score