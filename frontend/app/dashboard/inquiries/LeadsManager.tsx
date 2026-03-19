"use client";

import { useEffect, useState, useCallback } from "react";
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
  lead_notes: LeadNote[];
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

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  inquiry,
  onClose,
  onUpdate,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onUpdate: (updated: Partial<Inquiry>) => void;
}) {
  const [stage, setStage] = useState<Stage>(inquiry.lead_stage ?? "new");
  const [score, setScore] = useState(inquiry.lead_score ?? 0);
  const [notes, setNotes] = useState(inquiry.notes ?? "");
  const [newNote, setNewNote] = useState("");
  const [noteList, setNoteList] = useState<LeadNote[]>(inquiry.lead_notes ?? []);
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

  async function saveChanges() {
    setSaving(true);
    try {
      await apiFetch(`/api/inquiries/${inquiry.id}`, {
        method: "PUT",
        body: JSON.stringify({ lead_stage: stage, lead_score: score, notes }),
      });
      onUpdate({ lead_stage: stage, lead_score: score, notes });
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setSaving(false);
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
      await apiFetch(`/api/inquiries/${inquiry.id}/notes/${noteId}`, {
        method: "DELETE",
      });
      setNoteList((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e: unknown) {
      console.error(e);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800 truncate">
            {inquiry.sender_name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
            ×
          </button>
        </div>

        <div className="flex-1 p-4 space-y-5 overflow-y-auto">
          {/* Contact info */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact</h3>
            <div className="text-sm space-y-1">
              {inquiry.sender_email && (
                <p>
                  <span className="text-gray-400">Email: </span>
                  <a href={`mailto:${inquiry.sender_email}`} className="text-blue-600 hover:underline">
                    {inquiry.sender_email}
                  </a>
                </p>
              )}
              {inquiry.sender_phone && (
                <p>
                  <span className="text-gray-400">Phone: </span>
                  <a href={`tel:${inquiry.sender_phone}`} className="text-blue-600 hover:underline">
                    {inquiry.sender_phone}
                  </a>
                </p>
              )}
            </div>
          </section>

          {inquiry.listing_title && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Listing</h3>
              <p className="text-sm text-gray-700">{inquiry.listing_title}</p>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{inquiry.message}</p>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Stage</h3>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_META[s].label}</option>
              ))}
            </select>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lead Score</h3>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full"
            />
            <ScoreBar score={score} />
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Note</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Short inline note (visible on list view)…"
              className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </section>

          <button
            onClick={saveChanges}
            disabled={saving}
            className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Notes ({noteList.length})
            </h3>
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
              {noteList.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No notes yet.</p>
              ) : (
                noteList.map((n) => (
                  <div key={n.id} className="bg-gray-50 rounded-md p-3 text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-gray-700 flex-1 whitespace-pre-wrap">{n.content}</p>
                      <button
                        onClick={() => deleteNote(n.id)}
                        className="text-red-400 hover:text-red-600 text-xs shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">
                      {n.author_name} · {new Date(n.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className="flex-1 border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addNote}
                className="self-end px-3 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700"
              >
                Add
              </button>
            </div>
            {noteError && <p className="text-red-500 text-xs mt-1">{noteError}</p>}
          </section>

          <section className="border-t pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Paperwork</h3>
            <p className="text-xs text-gray-400 italic">
              Status: {inquiry.paperwork_status ?? "none"} · Paperwork management coming soon.
            </p>
          </section>
        </div>
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
