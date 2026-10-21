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
import uuid
import requests as _requests

from app.db.session import get_db
from app.api.deps import get_optional_user
from app.exceptions import ValidationException
from app.models.user import User
from app.api.routes_ai_search import run_smart_search, AISearchRequest
from app.api.routes_inquiries import create_inquiry_and_notify
from app.services import chatbot_store as store
from app.services.ai_quota import AIQuotaExceeded, enforce_quota, get_client_ip, hash_ip, refund_quota
from app.services.ai_errors import AIUnavailableError, log_ai_failure

router = APIRouter()


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ListingContext(BaseModel):
    id: int
    title: Optional[str] = None


class ChatbotRequest(BaseModel):
    message: str
    # Kept for client compatibility; the server rebuilds history from its own
    # stored copy of the conversation instead of trusting this.
    history: List[ChatTurn] = []
    listing_context: Optional[ListingContext] = None
    page_url: Optional[str] = None
    session_id: Optional[str] = None


MAX_MESSAGE_CHARS = 1000
MAX_HISTORY_TURNS = 20


_CHATBOT_SYSTEM_FACTS = """You are the YachtVersal site assistant, embedded as a chat widget on yachtversal.com.

Core facts about YachtVersal (placeholder — refine as business details firm up):
- YachtVersal is a yacht marketplace for buying, selling, and chartering yachts.
- Visitors can browse for-sale listings and charter listings, or describe what they want in plain English and get matches back.
- Brokers/dealers list yachts for sale; charter operators list yachts for charter.
- Asking about a specific listing creates an inquiry that the assigned broker receives by email and in their dashboard — no account/login is required to send one.

Your job each turn:
1. Decide the visitor's intent: "general" (a question about the site or process), "search" (they want to find a yacht or charter), or "contact_broker" (they want to ask about a specific listing or get in touch with a broker).
2. On EVERY turn, scan the ENTIRE conversation so far (not just the latest message) for the visitor's name, email, and phone, and fill in contact_info with whatever has been supplied; leave fields null if not given. Also fill message_for_broker with what they want the broker to know when intent is "contact_broker".
3. Draft a natural, friendly reply:
   - "general": answer directly and concisely using the facts above. If you don't know, say so honestly.
   - "search": a short lead-in sentence like "Here are a few options I found:" — do not invent listings yourself, real results get attached separately.
   - "contact_broker": if sender_name or sender_email is still missing, ask for exactly the missing one(s). If both are present, write a brief acknowledgement (the app will override this with a deterministic confirmation once the inquiry is actually sent).
4. Lead capture: if "Known contact" below is "none" and the visitor has now asked 2 or more questions (or is clearly serious — mentions a budget, dates, a specific boat, or buying/selling/chartering soon), end your reply with ONE short, friendly invitation to share their name and email so a specialist can follow up. Ask at most once per conversation: check the transcript for an earlier invitation or a refusal and do not repeat it. Never pressure them, and still fully answer their question first.

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


UNAVAILABLE_CHAT_REPLY = (
    "I'm sorry — our assistant is temporarily unavailable. Please leave your name, "
    "email and a message below and a member of our team will get back to you personally."
)


def _fallback_response(listing_context: Optional[ListingContext] = None) -> dict:
    return {
        "intent": "general",
        "reply": UNAVAILABLE_CHAT_REPLY,
        "contact_info": None,
        "unavailable": True,
    }


def classify_and_respond(
    message: str,
    history: List[ChatTurn],
    listing_context: Optional[ListingContext],
    known_contact: Optional[str] = None,
    user_turns: int = 1,
) -> dict:
    """Single Claude call: classifies intent, extracts any volunteered contact
    info, and drafts a reply. Mirrors extract_unified_criteria's key
    resolution, prompt structure, and degrade-on-failure pattern."""

    api_key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        log_ai_failure("chatbot: no API key configured")
        return _fallback_response()

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
        f"Known contact: {known_contact or 'none'}\n"
        f"Questions the visitor has asked so far (including this one): {user_turns}\n\n"
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
            log_ai_failure("chatbot", response=response)
            return _fallback_response()
        payload = response.json()
        content_list = payload.get("content", [])
        text_block = next((b for b in content_list if b.get("type") == "text"), None)
        if not text_block:
            log_ai_failure("chatbot: no text block in response")
            return _fallback_response()
        content = text_block.get("text", "").strip()
        content = re.sub(r"^```json\s*|\s*```$", "", content).strip()
        result = json.loads(content)
        if result.get("intent") not in ("general", "search", "contact_broker"):
            result["intent"] = "general"
        result.setdefault("contact_info", None)
        return result
    except Exception as exc:
        log_ai_failure("chatbot", exc=exc)
        return _fallback_response()





def _result_refs(search_results: Optional[dict]) -> Optional[list]:
    if not search_results:
        return None
    refs = []
    for r in search_results.get("results", []):
        if "charter" in r:
            refs.append({"type": "charter", "id": r["charter"].get("id")})
        elif "listing" in r:
            refs.append({"type": "listing", "id": r["listing"].get("id")})
    return refs or None


@router.post("/chatbot/message")
async def chatbot_message(
    request: ChatbotRequest,
    http_request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if os.environ.get("CHATBOT_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found")

    message = (request.message or "").strip()[:MAX_MESSAGE_CHARS]
    if not message:
        raise HTTPException(status_code=422, detail="message is required")

    session_id = store.clean_session_id(request.session_id) or str(uuid.uuid4())
    response: dict = {
        "reply": "",
        "intent": "general",
        "search_results": None,
        "contact_collected": None,
        "session_id": session_id,
        "limit_reached": None,
        # True when the AI couldn't answer: the widget then shows a
        # "leave us a message" form that creates a lead for the team.
        "manual_request": False,
    }

    # Every message costs tokens: cap per visitor / account before doing any work.
    try:
        chat_event_id = enforce_quota(http_request, db, current_user, kind="chatbot")
    except AIQuotaExceeded as exc:
        response["reply"] = exc.message
        response["limit_reached"] = exc.details["code"]
        return response

    convo = store.get_or_create_conversation(
        db,
        session_id=session_id,
        user=current_user,
        ip_hash=hash_ip(get_client_ip(http_request)),
        page_url=request.page_url,
        listing_id=request.listing_context.id if request.listing_context else None,
    )
    store.add_message(db, convo, "user", message)

    # History comes from our own stored copy, never from the client.
    history = [
        ChatTurn(role=m.role, content=m.content[:1500])
        for m in convo.messages[-(MAX_HISTORY_TURNS + 1):-1]
    ]
    user_turns = sum(1 for m in convo.messages if m.role == "user")
    known_contact = (
        f"{convo.contact_name or 'name unknown'} <{convo.contact_email}>"
        if convo.contact_email
        else None
    )

    result = classify_and_respond(message, history, request.listing_context, known_contact, user_turns)
    response["reply"] = result["reply"]
    response["intent"] = result["intent"]

    if result.get("unavailable"):
        # No tokens were spent, so don't charge the visitor's allowance. Keep
        # the exchange so admins can see (and follow up on) what was asked.
        refund_quota(db, chat_event_id)
        response["manual_request"] = True
        store.add_message(db, convo, "assistant", response["reply"], intent="fallback")
        return response

    stored_intent = result["intent"]

    contact = result.get("contact_info") or {}
    volunteered_email = store.is_valid_email(contact.get("sender_email"))
    store.apply_contact_info(convo, contact)
    result_refs = None
    new_inquiry = None

    if result["intent"] == "search":
        search_event_id = None
        try:
            search_event_id = enforce_quota(http_request, db, current_user, kind="ai_search")
            response["search_results"] = await run_smart_search(
                AISearchRequest(query=message, max_results=4), db
            )
            result_refs = _result_refs(response["search_results"])
        except AIQuotaExceeded as exc:
            response["reply"] = exc.message
            response["limit_reached"] = exc.details["code"]
        except AIUnavailableError:
            refund_quota(db, search_event_id)
            response["manual_request"] = True
            response["reply"] = (
                "I couldn't run that search just now. Leave your details below and "
                "our team will personally find options for you."
            )
            stored_intent = "fallback"
        except Exception:
            response["reply"] += " (Search is temporarily unavailable — try the main search bar.)"

    elif result["intent"] == "contact_broker":
        sender_name = convo.contact_name
        sender_email = convo.contact_email
        missing = [f for f, v in (("sender_name", sender_name), ("sender_email", sender_email)) if not v]

        if missing:
            response["contact_collected"] = {"status": "collecting", "missing_fields": missing, "inquiry_id": None}
        else:
            try:
                message_for_broker = contact.get("message_for_broker") or message
                if request.page_url:
                    message_for_broker = f"{message_for_broker}\n\n(Chat started on: {request.page_url})"
                new_inquiry = create_inquiry_and_notify(
                    db=db,
                    background_tasks=background_tasks,
                    sender_name=sender_name,
                    sender_email=sender_email,
                    sender_phone=convo.contact_phone,
                    message=message_for_broker,
                    listing_id=request.listing_context.id if request.listing_context else None,
                )
                response["contact_collected"] = {
                    "status": "submitted",
                    "missing_fields": [],
                    "inquiry_id": new_inquiry.id,
                }
                first_name = sender_name.split()[0] if sender_name.split() else sender_name
                label = request.listing_context.title if request.listing_context and request.listing_context.title else "your inquiry"
                response["reply"] = (
                    f"Thanks {first_name}! I've sent your message about {label} to the broker "
                    f"— they'll follow up at {sender_email} soon."
                )
            except ValidationException:
                convo.contact_email = None
                response["contact_collected"] = {
                    "status": "collecting",
                    "missing_fields": ["sender_email"],
                    "inquiry_id": None,
                }
                response["reply"] = "That email doesn't look quite right — could you double check it?"

    # Any other chat where the visitor handed over an email becomes a lead too,
    # routed to the admin inbox (or the listing's broker when one is in context).
    elif volunteered_email and convo.inquiry_id is None and convo.contact_email:
        try:
            new_inquiry = create_inquiry_and_notify(
                db=db,
                background_tasks=background_tasks,
                sender_name=convo.contact_name or "Website chat visitor",
                sender_email=convo.contact_email,
                sender_phone=convo.contact_phone,
                message=f"[Website chat lead]\n\n{store.transcript_text(convo)}",
                listing_id=convo.listing_id,
            )
            response["reply"] += (
                f"\n\nThanks — I've passed your details to our team and someone will follow up at "
                f"{convo.contact_email}."
            )
        except ValidationException:
            convo.contact_email = None

    if new_inquiry is not None:
        store.mark_lead(convo, new_inquiry.id)
        store.notify_team_of_chat_lead(db, background_tasks, convo, new_inquiry)

    store.add_message(db, convo, "assistant", response["reply"], intent=stored_intent, result_refs=result_refs)
    return response
