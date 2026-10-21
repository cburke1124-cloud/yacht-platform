'use client';

import { useEffect, useReducer, useRef } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send } from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import { newSessionId, visitorHeaders } from '@/app/lib/visitorId';

interface ListingContext {
  id: number;
  title?: string;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface ForSaleResult {
  listing: {
    id: number;
    title: string;
    price: number;
    year: number;
    boat_type: string;
    length_feet: number;
    images: Array<{ url: string }>;
  };
  match_score: number;
}

interface CharterResult {
  charter: {
    id: number;
    title: string;
    day_rate?: number;
    week_rate?: number;
    boat_type: string;
    length_feet: number;
    images?: Array<{ url: string }>;
  };
  match_score: number;
}

type SearchResult = ForSaleResult | CharterResult;

function isCharterResult(r: SearchResult): r is CharterResult {
  return 'charter' in r;
}

interface ContactCollected {
  status: 'collecting' | 'submitted';
  missing_fields: string[];
  inquiry_id: number | null;
}

interface ChatbotResponse {
  reply: string;
  intent: 'general' | 'search' | 'contact_broker';
  search_results: { results: SearchResult[]; total_found: number } | null;
  contact_collected: ContactCollected | null;
  session_id?: string;
  // Set when the guest/account hit an AI usage cap instead of getting an answer.
  limit_reached?: 'signup_required' | 'daily_limit' | null;
}

interface DisplayMessage extends ChatTurn {
  searchResults?: SearchResult[];
  signupCta?: boolean;
  onAskBroker?: (listingId: number, title: string) => void;
}

interface State {
  open: boolean;
  messages: DisplayMessage[];
  input: string;
  loading: boolean;
  listingContext: ListingContext | null;
  // Page the visitor was on when they sent their first message — captured once
  // and held fixed for the rest of the conversation, so broker-routed inquiries
  // always show where the lead actually originated (not wherever they've
  // navigated to since, since the widget persists across route changes).
  originUrl: string | null;
}

type Action =
  | { type: 'toggle_open' }
  | { type: 'set_input'; value: string }
  | { type: 'send_start'; userMessage: DisplayMessage; originUrl: string }
  | { type: 'send_done'; assistantMessage: DisplayMessage }
  | { type: 'set_listing_context'; context: ListingContext | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'toggle_open':
      return { ...state, open: !state.open };
    case 'set_input':
      return { ...state, input: action.value };
    case 'send_start':
      return {
        ...state,
        messages: [...state.messages, action.userMessage],
        input: '',
        loading: true,
        originUrl: state.originUrl ?? action.originUrl,
      };
    case 'send_done':
      return { ...state, messages: [...state.messages, action.assistantMessage], loading: false };
    case 'set_listing_context':
      return { ...state, listingContext: action.context, open: true };
    default:
      return state;
  }
}

const initialState: State = {
  open: false,
  messages: [
    { role: 'assistant', content: "Hi! I can answer questions about YachtVersal, help you find a yacht, or get you in touch with a broker. What can I help with?" },
  ],
  input: '',
  loading: false,
  listingContext: null,
  originUrl: null,
};

export default function ChatbotWidget() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const scrollRef = useRef<HTMLDivElement>(null);
  // One server-side conversation per widget mount, matching the on-screen
  // transcript (which also resets on a full page reload).
  const sessionIdRef = useRef<string>(newSessionId());

  useEffect(() => {
    function handleOpenWithListing(e: Event) {
      const detail = (e as CustomEvent<ListingContext>).detail;
      if (detail) dispatch({ type: 'set_listing_context', context: detail });
    }
    window.addEventListener('chatbot:open-with-listing', handleOpenWithListing);
    return () => window.removeEventListener('chatbot:open-with-listing', handleOpenWithListing);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.messages, state.loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || state.loading) return;

    const userMessage: DisplayMessage = { role: 'user', content: text.trim() };
    const originUrl = state.originUrl ?? window.location.href;
    dispatch({ type: 'send_start', userMessage, originUrl });

    try {
      const res = await fetch(apiUrl('/chatbot/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...visitorHeaders() },
        body: JSON.stringify({
          message: text.trim(),
          session_id: sessionIdRef.current,
          listing_context: state.listingContext,
          page_url: originUrl,
        }),
      });

      if (!res.ok) throw new Error('Request failed');
      const data: ChatbotResponse = await res.json();
      if (data.session_id) sessionIdRef.current = data.session_id;

      const assistantMessage: DisplayMessage = {
        role: 'assistant',
        content: data.reply,
        signupCta: data.limit_reached === 'signup_required',
        searchResults: data.search_results?.results,
        onAskBroker: (listingId, title) => dispatch({ type: 'set_listing_context', context: { id: listingId, title } }),
      };
      dispatch({ type: 'send_done', assistantMessage });

      if (data.contact_collected?.status === 'submitted') {
        dispatch({ type: 'set_listing_context', context: null });
      }
    } catch {
      dispatch({
        type: 'send_done',
        assistantMessage: { role: 'assistant', content: "Sorry, I couldn't reach the assistant just now. Please try again in a moment." },
      });
    }
  };

  return (
    <>
      <button
        onClick={() => dispatch({ type: 'toggle_open' })}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105"
        aria-label={state.open ? 'Close chat assistant' : 'Open chat assistant'}
      >
        {state.open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {state.open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[28rem] w-[calc(100vw-3rem)] max-w-96 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-96">
          <div className="bg-secondary px-4 py-3 text-white">
            <p className="font-semibold">YachtVersal Assistant</p>
            {state.listingContext && (
              <p className="truncate text-xs text-white/70">
                Re: {state.listingContext.title || `Listing #${state.listingContext.id}`}
              </p>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {state.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {m.signupCta && (
                    <div className="mt-2 flex gap-2">
                      <Link href="/register" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                        Create free account
                      </Link>
                      <Link href="/login" className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white">
                        Sign in
                      </Link>
                    </div>
                  )}

                  {m.searchResults && m.searchResults.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {m.searchResults.map((r) => {
                        const charter = isCharterResult(r);
                        const item = charter ? r.charter : r.listing;
                        const href = charter ? `/charter/${item.id}` : `/listings/${item.id}`;
                        const image = item.images?.[0]?.url;
                        return (
                          <div key={`${charter ? 'c' : 'l'}-${item.id}`} className="rounded-lg border border-gray-200 bg-white p-2">
                            <div className="flex gap-2">
                              {image && (
                                <img
                                  src={mediaUrl(image)}
                                  alt={item.title}
                                  className="h-12 w-16 flex-shrink-0 rounded object-cover"
                                  onError={onImgError}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <Link href={href} className="block truncate text-xs font-semibold text-gray-900 hover:text-primary">
                                  {item.title}
                                </Link>
                                <p className="text-xs text-gray-500">
                                  {item.length_feet ? `${item.length_feet}ft` : ''} {item.boat_type || ''}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => m.onAskBroker?.(item.id, item.title)}
                              className="mt-1.5 w-full rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                            >
                              Ask the broker about this
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {state.loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-500">Thinking…</div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(state.input);
            }}
            className="flex items-center gap-2 border-t border-gray-200 p-3"
          >
            <input
              type="text"
              value={state.input}
              onChange={(e) => dispatch({ type: 'set_input', value: e.target.value })}
              placeholder="Ask a question…"
              disabled={state.loading}
              className="flex-1 rounded-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={state.loading || !state.input.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
