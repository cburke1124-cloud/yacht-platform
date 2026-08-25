"""
Site-wide AI chat assistant.

Multi-purpose: answers general site questions, runs conversational yacht
search (delegates to the existing /ai/smart-search logic), and routes
listing-specific questions to a broker through the existing Inquiry pipeline.

Gated behind CHATBOT_ENABLED so it 404s unless explicitly turned on — the
widget itself is also gated client-side (NEXT_PUBLIC_ENABLE_CHATBOT), giving
defense-in-depth until the assistant is ready to launch.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import json
import os
import re
import requests as _requests

from app.db.session import get_db
from app.exceptions import ValidationException
from app.api.routes_ai_search import ai_smart_search, AISearchRequest
from app.api.routes_inquiries import create_inquiry_and_notify

router = APIRouter()


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ListingContext(BaseModel):
    id: int
    title: Optional[str] = None


class ChatbotRequest(BaseModel):
    message: str
    history: List[ChatTurn] = []
    listing_context: Optional[ListingContext] = None
    page_url: Optional[str] = None


_CHATBOT_SYSTEM_FACTS = """You are the YachtVersal site assistant, embedded as a chat widget on yachtversal.com.

Core facts about YachtVersal (placeholder — refine as business details firm up):
- YachtVersal is a yacht marketplace for buying, selling, and chartering yachts.
- Visitors can browse for-sale listings and charter listings, or describe what they want in plain English and get matches back.
- Brokers/dealers list yachts for sale; charter operators list yachts for charter.
- Asking about a specific listing creates an inquiry that the assigned broker receives by email and in their dashboard — no account/login is required to send one.

Your job each turn:
1. Decide the visitor's intent: "general" (a question about the site or process), "search" (they want to find a yacht or charter), or "contact_broker" (they want to ask about a specific listing or get in touch with a broker).
2. If intent is "contact_broker", scan the ENTIRE conversation so far (not just the latest message) for the visitor's name, email, and phone (if given) and what they want the broker to know. Fill in contact_info with whatever has been supplied; leave fields null if not yet given.
3. Draft a natural, friendly reply:
   - "general": answer directly and concisely using the facts above. If you don't know, say so honestly.
   - "search": a short lead-in sentence like "Here are a few options I found:" — do not invent listings yourself, real results get attached separately.
   - "contact_broker": if sender_name or sender_email is still missing, ask for exactly the missing one(s). If both are present, write a brief acknowledgement (the app will override this with a deterministic confirmation once the inquiry is actually sent).

Respond with ONLY a JSON object, no markdown fences, in this exact shape:
{{
  "intent": "general" | "search" | "contact_broker",
  "reply": "string",
  "contact_info": {{
    "sender_name": "string or null",
    "sender_email": "string or null",
    "sender_phone": "string or null",
    "message_for_broker": "string or null"
  }}
}}"""


def _fallback_response(listing_context: Optional[ListingContext]) -> dict:
    if listing_context:
        reply = (
            "I'm having trouble understanding right now — you can use the "
            "\"Contact Seller\" button on this listing to reach the broker directly."
        )
    else:
        reply = (
            "I'm having trouble understanding right now — try the search bar above, "
            "or visit our Contact Us page to reach our team directly."
        )
    return {"intent": "general", "reply": reply, "contact_info": None}


def classify_and_respond(
    message: str,
    history: List[ChatTurn],
    listing_context: Optional[ListingContext],
) -> dict:
    """Single Claude call: classifies intent, extracts any volunteered contact
    info, and drafts a reply. Mirrors extract_unified_criteria's key
    resolution, prompt structure, and degrade-on-failure pattern."""

    api_key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        return _fallback_response(listing_context)

    transcript = "\n".join(f"{turn.role}: {turn.content}" for turn in history)
    context_line = (
        f"\nThe visitor is currently viewing listing #{listing_context.id}"
        + (f" ({listing_context.title})" if listing_context.title else "")
        + "."
        if listing_context
        else ""
    )
    prompt = (
        f"{_CHATBOT_SYSTEM_FACTS}\n\n"
        f"Conversation so far:\n{transcript}\n"
        f"{context_line}\n"
        f"Latest visitor message: {message}"
    )

    try:
        response = _requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-5",
                "max_tokens": 800,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=20,
        )
        if not response.ok:
            return _fallback_response(listing_context)
        payload = response.json()
        content_list = payload.get("content", [])
        text_block = next((b for b in content_list if b.get("type") == "text"), None)
        if not text_block:
            return _fallback_response(listing_context)
        content = text_block.get("text", "").strip()
        content = re.sub(r"^```json\s*|\s*```$", "", content).strip()
        result = json.loads(content)
        if result.get("intent") not in ("general", "search", "contact_broker"):
            result["intent"] = "general"
        result.setdefault("contact_info", None)
        return result
    except Exception:
        return _fallback_response(listing_context)


@router.post("/chatbot/message")
async def chatbot_message(
    request: ChatbotRequest,
    http_request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if os.environ.get("CHATBOT_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found")

    result = classify_and_respond(request.message, request.history, request.listing_context)
    response: dict = {
        "reply": result["reply"],
        "intent": result["intent"],
        "search_results": None,
        "contact_collected": None,
    }

    if result["intent"] == "search":
        try:
            response["search_results"] = await ai_smart_search(
                http_request, AISearchRequest(query=request.message, max_results=4), db
            )
        except Exception:
            response["reply"] += " (Search is temporarily unavailable — try the main search bar.)"

    elif result["intent"] == "contact_broker":
        contact = result.get("contact_info") or {}
        sender_name = contact.get("sender_name")
        sender_email = contact.get("sender_email")
        missing = [f for f, v in (("sender_name", sender_name), ("sender_email", sender_email)) if not v]

        if missing:
            response["contact_collected"] = {"status": "collecting", "missing_fields": missing, "inquiry_id": None}
        else:
            try:
                message_for_broker = contact.get("message_for_broker") or request.message
                if request.page_url:
                    message_for_broker = f"{message_for_broker}\n\n(Chat started on: {request.page_url})"
                inquiry = create_inquiry_and_notify(
                    db=db,
                    background_tasks=background_tasks,
                    sender_name=sender_name,
                    sender_email=sender_email,
                    sender_phone=contact.get("sender_phone"),
                    message=message_for_broker,
                    listing_id=request.listing_context.id if request.listing_context else None,
                )
                response["contact_collected"] = {
                    "status": "submitted",
                    "missing_fields": [],
                    "inquiry_id": inquiry.id,
                }
                first_name = sender_name.split()[0] if sender_name.split() else sender_name
                label = request.listing_context.title if request.listing_context and request.listing_context.title else "your inquiry"
                response["reply"] = (
                    f"Thanks {first_name}! I've sent your message about {label} to the broker "
                    f"— they'll follow up at {sender_email} soon."
                )
            except ValidationException:
                response["contact_collected"] = {
                    "status": "collecting",
                    "missing_fields": ["sender_email"],
                    "inquiry_id": None,
                }
                response["reply"] = "That email doesn't look quite right — could you double check it?"

    return response
