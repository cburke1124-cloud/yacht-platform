"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Send, User, StickyNote, Settings2, Trash2 } from "lucide-react";
import { apiUrl } from "@/app/lib/apiRoot";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

interface LeadNote {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

interface MessageEntry {
  id: number;
  body: string;
  sender_name: string;
  is_from_buyer: boolean;
  created_at: string;
}

interface Inquiry {
  id: number;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  message: string;
  lead_stage: Stage;
  lead_score: number;
  notes: string;
  paperwork_status: string;
  listing_id: number | null;
  listing_title: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  // These are populated only from the detail endpoint (GET /inquiries/{id})
  lead_notes?: LeadNote[];
  message_id?: number | null;
  message_thread?: MessageEntry[];
  created_at: string;
  updated_at: string | null;
}

interface StageSummary {
  stage: Stage;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_META: Record<Stage, { label: string; color: string; bg: string }> = {
  new:       { label: "New",       color: "text-gray-700",   bg: "bg-gray-100" },
  contacted: { label: "Contacted", color: "text-blue-700",   bg: "bg-blue-100" },
  qualified: { label: "Qualified", color: "text-yellow-700", bg: "bg-yellow-100" },
  proposal:  { label: "Proposal",  color: "text-orange-700", bg: "bg-orange-100" },
  won:       { label: "Won",       color: "text-green-700",  bg: "bg-green-100" },
  lost:      { label: "Lost",      color: "text-red-700",    bg: "bg-red-100" },
};

const ALL_STAGES: Stage[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];

function StageBadge({ stage }: { stage: Stage }) {
  const { label, color, bg } = STAGE_META[stage] ?? STAGE_META.new;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${bg} ${color}`}>
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}</span>
    </div>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const normalised = path.replace(/^\/api\//, "/");
  const res = await fetch(apiUrl(normalised), {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Detail Panel (CRM-style slide-over) ──────────────────────────────────────

type Tab = "conversation" | "notes" | "details";

function DetailPanel({
  inquiry,
  onClose,
  onUpdate,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onUpdate: (updated: Partial<Inquiry>) => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("conversation");

  // CRM fields
  const [stage, setStage] = useState<Stage>(inquiry.lead_stage ?? "new");
  const [score, setScore] = useState(inquiry.lead_score ?? 0);
  const [saving, setSaving] = useState(false);

  // Notes
  const [noteList, setNoteList] = useState<LeadNote[]>(inquiry.lead_notes ?? []);
  const [newNote, setNewNote] = useState("");
  const [noteError, setNoteError] = useState("");

  // Conversation
  const [messageThread, setMessageThread] = useState<MessageEntry[]>(inquiry.message_thread ?? []);
  const [messageId, setMessageId] = useState<number | null>(inquiry.message_id ?? null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Fetch full detail on mount
  useEffect(() => {
    async function fetchDetail() {
      setLoadingDetail(true);
      try {
        const data = await apiFetch(`/api/inquiries/${inquiry.id}`);
        if (data.lead_notes) setNoteList(data.lead_notes);
        if (data.message_thread !== undefined) setMessageThread(data.message_thread);
        if (data.message_id !== undefined) setMessageId(data.message_id);
      } catch (e) {
        console.error("Failed to load inquiry detail", e);
      } finally {
        setLoadingDetail(false);
      }
    }
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry.id]);

  useEffect(() => {
    if (activeTab === "conversation") {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageThread, activeTab]);

  async function saveChanges() {
    setSaving(true);
    try {
      await apiFetch(`/api/inquiries/${inquiry.id}`, {
        method: "PUT",
        body: JSON.stringify({ lead_stage: stage, lead_score: score }),
      });
      onUpdate({ lead_stage: stage, lead_score: score });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !messageId) return;
    setSendingReply(true);
    setReplyError("");
    try {
      await apiFetch(`/api/messages/${messageId}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: replyText.trim() }),
      });
      const data = await apiFetch(`/api/inquiries/${inquiry.id}`);
      if (data.message_thread !== undefined) setMessageThread(data.message_thread);
      setReplyText("");
    } catch (e: unknown) {
      setReplyError("Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setNoteError("");
    try {
      const data = await apiFetch(`/api/inquiries/${inquiry.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: newNote.trim() }),
      });
      setNoteList((prev) => [...prev, data]);
      setNewNote("");
    } catch (e: unknown) {
      setNoteError("Failed to add note");
    }
  }

  async function deleteNote(noteId: number) {
    try {
      await apiFetch(`/api/inquiries/${inquiry.id}/notes/${noteId}`, { method: "DELETE" });
      setNoteList((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e: unknown) {
      console.error(e);
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "conversation", label: "Conversation", icon: <Send size={13} /> },
    { id: "notes",        label: `Notes (${noteList.length})`, icon: <StickyNote size={13} /> },
    { id: "details",      label: "Details",      icon: <Settings2 size={13} /> },
  ];

  return (
    <div className="fixed top-16 inset-x-0 bottom-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col border-l border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Slide-over header ── */}
        <div className="flex-shrink-0 bg-secondary px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">{inquiry.sender_name}</h2>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {inquiry.sender_email && (
                  <a href={`mailto:${inquiry.sender_email}`} className="text-xs text-white/70 hover:text-white truncate">
                    {inquiry.sender_email}
                  </a>
                )}
                {inquiry.sender_phone && (
                  <a href={`tel:${inquiry.sender_phone}`} className="text-xs text-white/70 hover:text-white">
                    {inquiry.sender_phone}
                  </a>
                )}
              </div>
              {inquiry.listing_title && (
                <p className="text-xs text-white/50 mt-0.5 truncate">Re: {inquiry.listing_title}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StageBadge stage={inquiry.lead_stage ?? "new"} />
              <button onClick={onClose} className="text-white/60 hover:text-white text-xl font-bold leading-none">×</button>
            </div>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex-shrink-0 flex border-b bg-white">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {activeTab === "conversation" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : messageThread.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-6">
                <Send size={36} className="mb-3 text-gray-200" />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs mt-1 text-center">The buyer&apos;s initial inquiry will appear here once you receive one.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messageThread.map((entry) => (
                  <div key={entry.id} className={`flex gap-2 ${entry.is_from_buyer ? "" : "flex-row-reverse"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${entry.is_from_buyer ? "bg-gray-200" : "bg-primary"}`}>
                      <User size={12} className={entry.is_from_buyer ? "text-gray-500" : "text-white"} />
                    </div>
                    <div className={`max-w-[78%] ${entry.is_from_buyer ? "" : "items-end flex flex-col"}`}>
                      <div className={`flex items-baseline gap-2 mb-1 ${entry.is_from_buyer ? "" : "flex-row-reverse"}`}>
                        <span className="text-xs font-semibold text-gray-700">{entry.sender_name}</span>
                        <span className="text-[10px] text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        entry.is_from_buyer
                          ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                          : "bg-primary text-white rounded-tr-sm"
                      }`}>
                        {entry.body}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={threadEndRef} />
              </div>
            )}

            {/* Reply box */}
            <div className="flex-shrink-0 px-4 py-3 border-t bg-gray-50">
              {messageId ? (
                <>
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }}
                      rows={3}
                      placeholder="Type your reply… (Ctrl+Enter to send)"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover-primary disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={13} />
                      {sendingReply ? "…" : "Send"}
                    </button>
                  </div>
                  {replyError && <p className="text-red-500 text-xs mt-1">{replyError}</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400 text-center italic">No linked message thread — reply once an inquiry is received.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {noteList.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center mt-8">No notes yet. Add your first note below.</p>
              ) : (
                noteList.map((n) => (
                  <div key={n.id} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-gray-700 flex-1 whitespace-pre-wrap">{n.content}</p>
                      <button onClick={() => deleteNote(n.id)} className="text-red-300 hover:text-red-500 flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="text-gray-400 text-[10px] mt-1.5">
                      {n.author_name} · {new Date(n.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="flex-shrink-0 px-4 py-3 border-t bg-gray-50">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                  placeholder="Add a note…"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                />
                <button
                  onClick={addNote}
                  disabled={!newNote.trim()}
                  className="self-end px-3 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {noteError && <p className="text-red-500 text-xs mt-1">{noteError}</p>}
            </div>
          </div>
        )}

        {activeTab === "details" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pipeline Stage</h3>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as Stage)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {ALL_STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_META[s].label}</option>
                ))}
              </select>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Lead Score <span className="ml-1 font-bold text-gray-700">{score}</span>
              </h3>
              <input
                type="range"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <ScoreBar score={score} />
            </section>

            <button
              onClick={saveChanges}
              disabled={saving}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover-primary disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>

            <section className="border-t pt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact</h3>
              <div className="text-sm space-y-1.5">
                <p><span className="text-gray-400 w-16 inline-block">Name</span> {inquiry.sender_name}</p>
                {inquiry.sender_email && (
                  <p>
                    <span className="text-gray-400 w-16 inline-block">Email</span>
                    <a href={`mailto:${inquiry.sender_email}`} className="text-primary hover:underline">{inquiry.sender_email}</a>
                  </p>
                )}
                {inquiry.sender_phone && (
                  <p>
                    <span className="text-gray-400 w-16 inline-block">Phone</span>
                    <a href={`tel:${inquiry.sender_phone}`} className="text-primary hover:underline">{inquiry.sender_phone}</a>
                  </p>
                )}
                {inquiry.assigned_to_name && (
                  <p><span className="text-gray-400 w-16 inline-block">Assigned</span> {inquiry.assigned_to_name}</p>
                )}
              </div>
            </section>

            {inquiry.listing_title && (
              <section className="border-t pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Listing</h3>
                <p className="text-sm text-gray-700">{inquiry.listing_title}</p>
              </section>
            )}

            <section className="border-t pt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Paperwork</h3>
              <p className="text-xs text-gray-400 italic">
                Status: {inquiry.paperwork_status ?? "none"} · Paperwork management coming soon.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
  
// ─── LeadsManager (embeddable) ────────────────────────────────────────────────

export default function LeadsManager() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [summary, setSummary] = useState<StageSummary[]>([]);
  const [activeStage, setActiveStage] = useState<Stage | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (activeStage !== "all") params.set("stage", activeStage);
      if (search) params.set("search", search);

      const [list, rawSum] = await Promise.all([
        apiFetch(`/api/inquiries?${params}`),
        apiFetch("/api/inquiries-summary"),
      ]);
      setInquiries(list.items ?? list);
      // Backend returns { new: 5, contacted: 2, ... } — convert to array
      const sum: StageSummary[] = Object.entries(rawSum as Record<string, number>).map(
        ([stage, count]) => ({ stage: stage as Stage, count })
      );
      setSummary(sum);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  }, [activeStage, search]);

  useEffect(() => {
    load();
  }, [load]);

  function handleUpdate(id: number, patch: Partial<Inquiry>) {
    setInquiries((prev) => prev.map((inq) => (inq.id === id ? { ...inq, ...patch } : inq)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  const stageTotal = (stage: Stage) => summary.find((s) => s.stage === stage)?.count ?? 0;

  return (
    <div className="bg-gray-50 rounded-xl">
      {/* Header */}
      <div className="bg-white border-b rounded-t-xl px-6 py-4">
        <h2 className="text-xl font-bold text-gray-900">Leads</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage inquiries, track pipeline progress, and add notes.</p>
      </div>

      {/* Stage pipeline bar */}
      <div className="px-6 py-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setActiveStage("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeStage === "all"
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            All ({summary.reduce((a, s) => a + s.count, 0)})
          </button>
          {ALL_STAGES.map((stage) => {
            const { label, bg, color } = STAGE_META[stage];
            const cnt = stageTotal(stage);
            const active = activeStage === stage;
            return (
              <button
                key={stage}
                onClick={() => setActiveStage(stage)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active
                    ? `${bg} ${color} border-current`
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {label} ({cnt})
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="px-6 pb-3">
        <input
          type="text"
          placeholder="Search by name, email, or listing…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">{error}</div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No inquiries found.</div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Contact", "Listing", "Stage", "Score", "Note", "Assigned To", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inquiries.map((inq) => (
                  <tr
                    key={inq.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(inq)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{inq.sender_name}</p>
                      <p className="text-gray-500 text-xs">{inq.sender_email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">
                      {inq.listing_title ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={inq.lead_stage ?? "new"} />
                    </td>
                    <td className="px-4 py-3 min-w-[100px]">
                      <ScoreBar score={inq.lead_score ?? 0} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                      {inq.notes || <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {inq.assigned_to_name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(inq.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          inquiry={selected}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => handleUpdate(selected.id, patch)}
        />
      )}
    </div>
  );
}
