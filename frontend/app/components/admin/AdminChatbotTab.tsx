'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import { ThumbsUp, ThumbsDown, Download, CheckCircle2, Search } from 'lucide-react';

interface Stats {
  conversations_total: number;
  conversations_7d: number;
  leads_total: number;
  leads_7d: number;
  lead_rate_pct: number;
  unreviewed: number;
  rated_messages: number;
  ai_usage_24h: {
    ai_search_guests: number;
    ai_search_accounts: number;
    chatbot_guests: number;
    chatbot_accounts: number;
  };
}

interface ConversationSummary {
  id: number;
  session_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_lead: boolean;
  inquiry_id: number | null;
  message_count: number;
  page_url: string | null;
  reviewed: boolean;
  admin_notes: string | null;
  created_at: string | null;
  last_message_at: string | null;
  preview?: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  intent: string | null;
  results: Array<{ type: string; id: number; title: string | null }>;
  admin_rating: number | null;
  admin_note: string | null;
  created_at: string | null;
}

interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

type Filter = 'all' | 'leads' | 'unreviewed';

const PAGE_SIZE = 25;

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmt(date: string | null): string {
  if (!date) return '';
  // Backend timestamps are naive UTC.
  return new Date(date.endsWith('Z') ? date : `${date}Z`).toLocaleString();
}

export default function AdminChatbotTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Deep link from the lead alert: /admin?tab=chatbot&conversation=ID
    const id = Number(new URLSearchParams(window.location.search).get('conversation'));
    if (id) setSelectedId(id);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/admin/chatbot/stats'), { headers: authHeaders() });
      if (res.ok) setStats(await res.json());
    } catch {
      /* stats are non-critical */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE), filter });
      if (query) params.set('q', query);
      const res = await fetch(apiUrl(`/admin/chatbot/conversations?${params}`), { headers: authHeaders() });
      if (!res.ok) throw new Error(`Failed to load conversations (${res.status})`);
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [page, filter, query]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(apiUrl(`/admin/chatbot/conversations/${id}`), { headers: authHeaders() });
      if (!res.ok) throw new Error(`Failed to load conversation (${res.status})`);
      const data: ConversationDetail = await res.json();
      setDetail(data);
      setNotes(data.admin_notes || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation');
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  const patch = async (path: string, body: object) => {
    const res = await fetch(apiUrl(path), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) setError(`Save failed (${res.status})`);
    return res.ok;
  };

  const rate = async (m: ChatMessage, rating: 1 | -1) => {
    const next = m.admin_rating === rating ? 0 : rating;
    if (await patch(`/admin/chatbot/messages/${m.id}`, { admin_rating: next })) {
      setDetail((d) => d && { ...d, messages: d.messages.map((x) => (x.id === m.id ? { ...x, admin_rating: next || null } : x)) });
      loadStats();
    }
  };

  const saveMessageNote = async (m: ChatMessage, note: string) => {
    if (note === (m.admin_note || '')) return;
    if (await patch(`/admin/chatbot/messages/${m.id}`, { admin_note: note })) {
      setDetail((d) => d && { ...d, messages: d.messages.map((x) => (x.id === m.id ? { ...x, admin_note: note || null } : x)) });
    }
  };

  const saveConversation = async (changes: { reviewed?: boolean; admin_notes?: string }) => {
    if (!detail) return;
    if (await patch(`/admin/chatbot/conversations/${detail.id}`, changes)) {
      setDetail({ ...detail, ...changes });
      setItems((list) => list.map((c) => (c.id === detail.id ? { ...c, ...changes } : c)));
      loadStats();
    }
  };

  const exportTranscripts = async (ratedOnly: boolean) => {
    const res = await fetch(apiUrl(`/admin/chatbot/export?rated_only=${ratedOnly}`), { headers: authHeaders() });
    if (!res.ok) { setError(`Export failed (${res.status})`); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chatbot-transcripts.jsonl';
    a.click();
    URL.revokeObjectURL(url);
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Chatbot</h2>
          <p className="text-sm text-gray-600">Every conversation, captured leads, and answer quality review.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportTranscripts(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={14} /> Export rated
          </button>
          <button onClick={() => exportTranscripts(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={14} /> Export all
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Conversations" value={stats.conversations_total} sub={`${stats.conversations_7d} in last 7 days`} />
          <StatCard label="Leads captured" value={stats.leads_total} sub={`${stats.leads_7d} in last 7 days · ${stats.lead_rate_pct}% of chats`} />
          <StatCard label="Unreviewed" value={stats.unreviewed} sub={`${stats.rated_messages} answers rated`} />
          <StatCard
            label="AI calls (24h)"
            value={stats.ai_usage_24h.ai_search_guests + stats.ai_usage_24h.ai_search_accounts + stats.ai_usage_24h.chatbot_guests + stats.ai_usage_24h.chatbot_accounts}
            sub={`Search: ${stats.ai_usage_24h.ai_search_guests} guest / ${stats.ai_usage_24h.ai_search_accounts} acct · Chat: ${stats.ai_usage_24h.chatbot_guests} / ${stats.ai_usage_24h.chatbot_accounts}`}
          />
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Conversation list */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="space-y-3 border-b border-gray-200 p-3">
            <div className="flex gap-2">
              {(['all', 'leads', 'unreviewed'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(0); }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${filter === f ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(search.trim()); }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search messages, names, emails…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">Search</button>
            </form>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No conversations yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full p-3 text-left hover:bg-gray-50 ${selectedId === c.id ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {c.contact_name || c.contact_email || `Visitor #${c.id}`}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {c.is_lead && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Lead</span>}
                        {!c.reviewed && <span className="h-2 w-2 rounded-full bg-amber-400" title="Unreviewed" />}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-gray-600">{c.preview || '—'}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{c.message_count} messages · {fmt(c.last_message_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-gray-200 p-3 text-sm text-gray-600">
            <span>{total} total</span>
            <div className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
              <span>{page + 1} / {pages}</span>
              <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="rounded-xl border border-gray-200 bg-white">
          {!detail ? (
            <p className="p-6 text-sm text-gray-500">Select a conversation to read the transcript.</p>
          ) : (
            <div className="flex flex-col">
              <div className="space-y-1 border-b border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{detail.contact_name || 'Anonymous visitor'}</h3>
                  <button
                    onClick={() => saveConversation({ reviewed: !detail.reviewed })}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${detail.reviewed ? 'bg-green-100 text-green-800' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <CheckCircle2 size={14} /> {detail.reviewed ? 'Reviewed' : 'Mark reviewed'}
                  </button>
                </div>
                {detail.contact_email && (
                  <p className="text-sm text-gray-700">
                    <a className="text-primary underline" href={`mailto:${detail.contact_email}`}>{detail.contact_email}</a>
                    {detail.contact_phone && <span className="ml-3">{detail.contact_phone}</span>}
                  </p>
                )}
                {detail.page_url && <p className="truncate text-xs text-gray-500">Started on {detail.page_url}</p>}
                {detail.is_lead && <p className="text-xs font-medium text-green-700">Lead captured (inquiry #{detail.inquiry_id})</p>}
              </div>

              <div className="max-h-[32rem] space-y-4 overflow-y-auto p-4">
                {detail.messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                    <div className={`inline-block max-w-[90%] rounded-2xl px-3 py-2 text-left text-sm ${m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.results.length > 0 && (
                        <ul className="mt-2 space-y-0.5 border-t border-gray-300 pt-2 text-xs">
                          {m.results.map((r) => (
                            <li key={`${r.type}-${r.id}`}>
                              <a className="underline" target="_blank" rel="noreferrer" href={r.type === 'charter' ? `/charter/${r.id}` : `/listings/${r.id}`}>
                                {r.title || `${r.type} #${r.id}`}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {fmt(m.created_at)}{m.intent ? ` · ${m.intent}` : ''}
                    </p>
                    {m.role === 'assistant' && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button onClick={() => rate(m, 1)} aria-label="Good answer" className={`rounded p-1 ${m.admin_rating === 1 ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:text-green-700'}`}>
                          <ThumbsUp size={14} />
                        </button>
                        <button onClick={() => rate(m, -1)} aria-label="Bad answer" className={`rounded p-1 ${m.admin_rating === -1 ? 'bg-red-100 text-red-700' : 'text-gray-400 hover:text-red-700'}`}>
                          <ThumbsDown size={14} />
                        </button>
                        <input
                          key={`${m.id}-${m.admin_note || ''}`}
                          defaultValue={m.admin_note || ''}
                          onBlur={(e) => saveMessageNote(m, e.target.value.trim())}
                          placeholder="Note on this answer (what should it say?)"
                          className="min-w-[12rem] flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 p-4">
                <label className="mb-1 block text-xs font-medium text-gray-600">Internal notes / follow-up</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => notes !== (detail.admin_notes || '') && saveConversation({ admin_notes: notes })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{sub}</p>
    </div>
  );
}
