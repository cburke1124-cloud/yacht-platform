'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, AlertCircle, CheckCircle, Play, Pause, Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Pencil, X, Terminal } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import ScraperReviewPage from '@/app/admin/scraper-review/page';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogLine {
  t: string;
  level: string;
  logger: string;
  msg: string;
}

interface ScraperJob {
  id: number;
  dealer_id: number;
  salesman_id?: number;
  site_name?: string;
  broker_url: string;
  enabled: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed';
  schedule_hours: number;
  next_run_at?: string;
  last_run_at?: string;
  listings_found: number;
  listings_created: number;
  listings_updated: number;
  listings_removed: number;
  total_runs: number;
  last_error?: string;
  notes?: string;
  created_at?: string;
  last_run_log?: Array<{
    url: string;
    outcome: 'created' | 'updated' | 'sold' | 'archived' | 'error' | 'skipped' | 'failed';
    listing_id?: number;
    title?: string;
    error?: string;
    confidence?: number;
    ai_used?: boolean;
  }>;
}

interface RawPage {
  id: number;
  job_id: number;
  source_url: string;
  stage: 'intake' | 'normalized' | 'ai_parsed' | 'validated' | 'failed';
  skip_reason?: string;
  confidence_score?: number;
  ai_used?: boolean;
  normalized_data?: Record<string, unknown>;
  ai_data?: Record<string, unknown>;
  merged_data?: Record<string, unknown>;
  /** Full pool of images extracted during normalization — always the complete set pre-curation. */
  all_images?: string[];
  fetched_at?: string;
  validated_at?: string;
  has_raw_html: boolean;
  has_raw_text: boolean;
}

interface Dealer {
  id: number;
  company_name?: string;
  name: string;
  email: string;
}

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role?: string;
}

interface SiteTemplate {
  listing_link_selector?: string;
  next_page_selector?: string;
  title_selector?: string;
  price_selector?: string;
  description_selector?: string;
  year_selector?: string;
  make_selector?: string;
  model_selector?: string;
  length_selector?: string;
  location_selector?: string;
  images_selector?: string;
  agent_name_selector?: string;
  agent_photo_selector?: string;
  broker_email_selector?: string;
  broker_phone_selector?: string;
  hull_material_selector?: string;
  fuel_type_selector?: string;
  hours_selector?: string;
  condition_selector?: string;
  sections?: { name: string; selector: string }[];
  label_map?: Record<string, string>;
  field_rules?: { field: string; pattern: string; type: string }[];
}

// ─── Manual Import Section ────────────────────────────────────────────────────

type QueueItem = {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'done' | 'error';
  listingId?: number;
  title?: string;
  error?: string;
  logs?: Array<{ t: string; level: string; logger: string; msg: string }>;
};

function ManualImportSection({
  dealers,
  apiUrl: _apiUrl,
  authHeaders: _authHeaders,
}: {
  dealers: Dealer[];
  apiUrl: (path: string) => string;
  authHeaders: () => Record<string, string>;
}) {
  const [dealerId, setDealerId] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const addUrls = () => {
    const lines = urlInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('http'));
    if (!lines.length) return;
    const newItems: QueueItem[] = lines.map((url) => ({
      id: `${Date.now()}-${Math.random()}`,
      url,
      status: 'pending',
    }));
    setQueue((prev) => [...prev, ...newItems]);
    setUrlInput('');
  };

  const removeItem = (id: string) =>
    setQueue((prev) => prev.filter((q) => q.id !== id));

  const clearDone = () =>
    setQueue((prev) => prev.filter((q) => q.status !== 'done' && q.status !== 'error'));

  const runQueue = async () => {
    if (!dealerId) { setBatchMsg('Please select a broker first.'); return; }
    const pending = queue.filter((q) => q.status === 'pending');
    if (!pending.length) { setBatchMsg('No pending URLs in queue.'); return; }
    setRunning(true);
    setBatchMsg('');

    for (const item of pending) {
      setQueue((prev) =>
        prev.map((q) => q.id === item.id ? { ...q, status: 'running' } : q)
      );
      try {
        const res = await fetch(_apiUrl('/scraper/import-single'), {
          method: 'POST',
          headers: _authHeaders(),
          body: JSON.stringify({ url: item.url, dealer_id: Number(dealerId) }),
        });
        const data = await res.json();
        if (data.success) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, status: 'done', listingId: data.listing_id, title: data.title, logs: data.logs }
                : q
            )
          );
        } else {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id ? { ...q, status: 'error', error: data.error || 'Import failed', logs: data.logs } : q
            )
          );
        }
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'error', error: err.message || 'Network error' } : q
          )
        );
      }
    }

    setRunning(false);
    setBatchMsg('Queue finished.');
  };

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const doneCount = queue.filter((q) => q.status === 'done').length;
  const errorCount = queue.filter((q) => q.status === 'error').length;

  const statusIcon = (status: QueueItem['status']) => {
    if (status === 'pending') return <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />;
    if (status === 'running') return <span className="w-2 h-2 rounded-full bg-blue-400 inline-block animate-pulse" />;
    if (status === 'done') return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
    return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />;
  };

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">Manual Listing Import</h3>
        <p className="text-sm text-gray-500">
          Pick a broker, paste one or more listing page URLs, then run the queue. Each URL is scraped individually using AI and imported as an <em>awaiting review</em> listing.
        </p>
      </div>

      {/* Step 1 — Broker */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          1 · Select Broker
        </label>
        <select
          value={dealerId}
          onChange={(e) => setDealerId(e.target.value)}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">— Choose a broker —</option>
          {dealers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.company_name || d.name} ({d.email})
            </option>
          ))}
        </select>
      </div>

      {/* Step 2 — Add URLs */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          2 · Paste Listing URLs
        </label>
        <p className="text-xs text-gray-400 mb-2">One URL per line, or comma-separated. Must start with http.</p>
        <textarea
          rows={5}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://broker.com/listing/1&#10;https://broker.com/listing/2&#10;https://broker.com/listing/3"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={addUrls}
            disabled={!urlInput.trim()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40"
          >
            + Add to Queue
          </button>
          {queue.length > 0 && (
            <button
              onClick={clearDone}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Step 3 — Queue */}
      {queue.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              3 · Queue ({queue.length} URL{queue.length !== 1 ? 's' : ''})
            </label>
            <span className="text-xs text-gray-400">
              {pendingCount} pending · {doneCount} done · {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {queue.map((item) => (
              <div key={item.id} className="border-b border-gray-100 last:border-b-0">
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <span className="mt-1 flex-shrink-0">{statusIcon(item.status)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-700 truncate">{item.url}</p>
                    {item.status === 'done' && (
                      <p className="text-xs text-green-700 mt-0.5">
                        ✓ Imported{item.title ? `: ${item.title}` : ''}{item.listingId ? ` (#${item.listingId})` : ''}
                      </p>
                    )}
                    {item.status === 'error' && (
                      <p className="text-xs text-red-600 mt-0.5">✗ {item.error}</p>
                    )}
                  </div>
                  {item.logs && item.logs.length > 0 && (item.status === 'done' || item.status === 'error') && (
                    <button
                      onClick={() => setExpandedLogId(expandedLogId === item.id ? null : item.id)}
                      className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                      title="Toggle scrape logs"
                    >
                      <span>Logs</span>
                      <span style={{ fontSize: 10 }}>{expandedLogId === item.id ? '▲' : '▼'}</span>
                    </button>
                  )}
                  {item.status === 'pending' && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {expandedLogId === item.id && item.logs && item.logs.length > 0 && (
                  <div
                    className="mx-3 mb-2 rounded overflow-y-auto"
                    style={{ maxHeight: 180, backgroundColor: '#0f172a', padding: '8px 10px' }}
                  >
                    {item.logs.map((line, i) => (
                      <div key={i} className="flex gap-2 text-xs font-mono leading-relaxed">
                        <span style={{ color: '#64748b', flexShrink: 0 }}>{line.t}</span>
                        <span style={{
                          flexShrink: 0,
                          color: line.level === 'ERROR' ? '#f87171' : line.level === 'WARNING' ? '#fbbf24' : '#94a3b8',
                        }}>
                          {line.level.slice(0, 4)}
                        </span>
                        <span style={{ color: '#cbd5e1', wordBreak: 'break-all' }}>{line.msg}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={runQueue}
              disabled={running || pendingCount === 0 || !dealerId}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40"
            >
              <Play size={14} />
              {running ? 'Running…' : `Run Queue (${pendingCount} pending)`}
            </button>
            {batchMsg && (
              <span className="text-xs text-gray-600">{batchMsg}</span>
            )}
          </div>
        </div>
      )}

      {queue.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
          <p className="text-sm">No URLs in queue. Paste listing URLs above and click <strong>Add to Queue</strong>.</p>
        </div>
      )}
    </div>
  );
}



// ─── AI Prompt Editor ─────────────────────────────────────────────────────────

interface PromptData {
  key: string;
  label: string;
  description: string;
  text: string;
  is_customized: boolean;
  default: string;
}

function PromptEditorSection({
  apiUrl: _apiUrl,
  authHeaders: _authHeaders,
}: {
  apiUrl: (path: string) => string;
  authHeaders: () => Record<string, string>;
}) {
  const [prompts, setPrompts] = useState<Record<string, PromptData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null);

  const flash = (key: string, text: string, ok = true) => {
    setMsg({ key, text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  useEffect(() => {
    setLoading(true);
    fetch(_apiUrl('/scraper/prompts'), { headers: _authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPrompts(d.prompts);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    const text = edited[key] ?? prompts?.[key]?.text ?? '';
    if (!text.trim()) return;
    setSaving(key);
    try {
      const res = await fetch(_apiUrl(`/scraper/prompts/${key}`), {
        method: 'PUT',
        headers: _authHeaders(),
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (d.success) {
        setPrompts(d.prompts);
        setEdited((prev) => { const copy = { ...prev }; delete copy[key]; return copy; });
        flash(key, 'Prompt saved.', true);
      } else {
        flash(key, d.detail || 'Save failed.', false);
      }
    } catch {
      flash(key, 'Network error.', false);
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (key: string) => {
    if (!confirm('Reset this prompt to the built-in default?')) return;
    setResetting(key);
    try {
      const res = await fetch(_apiUrl(`/scraper/prompts/${key}`), {
        method: 'DELETE',
        headers: _authHeaders(),
      });
      const d = await res.json();
      if (d.success) {
        setPrompts(d.prompts);
        setEdited((prev) => { const copy = { ...prev }; delete copy[key]; return copy; });
        flash(key, 'Reset to default.', true);
      } else {
        flash(key, d.detail || 'Reset failed.', false);
      }
    } catch {
      flash(key, 'Network error.', false);
    } finally {
      setResetting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500 animate-pulse">Loading prompts…</div>
    );
  }

  if (!prompts) {
    return <div className="p-6 text-sm text-red-500">Failed to load prompts.</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">AI Prompt Editor</h3>
        <p className="text-sm text-gray-500 mt-1">
          These are the instructions sent to Claude when scraping yacht listings. Changes take
          effect on the next scrape — no restart required.
        </p>
      </div>

      {(['full', 'partial'] as const).map((key) => {
        const p = prompts[key];
        const isDirty = key in edited && edited[key] !== p.text;
        const currentText = edited[key] ?? p.text;
        return (
          <div key={key} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{p.label}</span>
                  {p.is_customized ? (
                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                      Custom
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      Default
                    </span>
                  )}
                  {isDirty && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                      Unsaved changes
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {p.is_customized && (
                  <button
                    onClick={() => handleReset(key)}
                    disabled={resetting === key}
                    className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {resetting === key ? 'Resetting…' : 'Reset to Default'}
                  </button>
                )}
                <button
                  onClick={() => handleSave(key)}
                  disabled={saving === key || !isDirty}
                  className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 font-medium"
                >
                  {saving === key ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="p-3 bg-white">
              <textarea
                rows={14}
                value={currentText}
                onChange={(e) => setEdited((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y bg-gray-50"
                spellCheck={false}
              />
            </div>

            {/* Flash message */}
            {msg && msg.key === key && (
              <div
                className={`px-4 py-2 text-xs font-medium ${msg.ok ? 'bg-green-50 text-green-700 border-t border-green-200' : 'bg-red-50 text-red-700 border-t border-red-200'}`}
              >
                {msg.text}
              </div>
            )}
          </div>
        );
      })}

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
        <strong>Note:</strong> The URL and page content are always appended automatically by the
        scraper — you only edit the instruction text above. If you break something, use
        &ldquo;Reset to Default&rdquo; to restore the built-in prompt.
      </div>
    </div>
  );
}


function LogPanel({ logs, loading }: { logs: LogLine[]; loading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  if (!loading && logs.length === 0) return null;

  const levelClass = (level: string) => {
    if (level === 'ERROR') return 'text-red-400';
    if (level === 'WARNING') return 'text-yellow-300';
    if (level === 'DEBUG') return 'text-gray-500';
    return 'text-green-400';
  };

  const loggerColor = (logger: string) => {
    if (logger === 'scraper') return 'text-blue-400';
    if (logger === 'connectionpool') return 'text-gray-500';
    return 'text-purple-400';
  };

  return (
    <div className="mt-4 rounded-lg overflow-hidden border border-gray-700 bg-gray-950">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700">
        <Terminal size={12} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-400">Scrape Log</span>
        {loading && <span className="text-xs text-blue-400 animate-pulse ml-auto">● running…</span>}
        {!loading && logs.length > 0 && <span className="text-xs text-gray-500 ml-auto">{logs.length} entries</span>}
      </div>
      <div className="p-2 overflow-y-auto max-h-80 font-mono text-xs space-y-0.5">
        {loading && logs.length === 0 && (
          <p className="text-gray-500 py-2 text-center animate-pulse">Waiting for scraper output…</p>
        )}
        {logs.map((line, i) => (
          <div key={i} className="flex gap-2 leading-5 hover:bg-gray-900/50 px-1 rounded">
            <span className="text-gray-600 shrink-0 select-none">{line.t}</span>
            <span className={`shrink-0 select-none ${levelClass(line.level)}`}>[{line.level.padEnd(5)}]</span>
            <span className={`shrink-0 select-none ${loggerColor(line.logger)}`}>[{line.logger}]</span>
            <span className="text-gray-200 break-all">{line.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

function StatusBadge({ status }: { status: ScraperJob['status'] }) {
  const styles: Record<string, string> = {
    idle: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700 animate-pulse',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.idle}`}>
      {status}
    </span>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Feed Jobs Section (YachtWorld / Boats Group REST API) ───────────────────

interface YWJob {
  id: number;
  dealer_id: number;
  salesman_id?: number;
  site_name?: string;
  api_endpoint: string;
  api_key_set: boolean;
  feed_type: 'boats_group' | 'iyba';
  schedule_hours: number;
  enabled: boolean;
  status: string;
  notes?: string;
  listings_found: number;
  listings_created: number;
  listings_updated: number;
  listings_removed: number;
  total_runs: number;
  last_error?: string;
  last_run_at?: string;
  next_run_at?: string;
  created_at?: string;
}

// ── BulkEnrichSection ─────────────────────────────────────────────────────

interface EnrichJob {
  status: 'running' | 'done';
  total: number;
  done: number;
  updated: number;
  errors: number;
  log: string[];
}

const ENRICH_JOB_STORAGE_KEY = 'enrich_job_id';

function BulkEnrichSection({ dealers, apiUrl, authHeaders }: { dealers: Dealer[]; apiUrl: (path: string) => string; authHeaders: () => Record<string, string> }) {
  const [source, setSource] = useState<string>('scraped');
  const [dealerId, setDealerId] = useState<string>('');
  const [limit, setLimit] = useState<number>(200);
  const [onlyIncomplete, setOnlyIncomplete] = useState(true);
  const [rewriteDescriptions, setRewriteDescriptions] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<EnrichJob | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const beginPolling = (jid: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const r2 = await fetch(apiUrl(`/scraper/listings/bulk-ai-enrich/${jid}`), { headers: authHeaders() });
        if (!r2.ok) return;
        const data: EnrichJob = await r2.json();
        setProgress(data);
        if (data.status === 'done') {
          stopPolling();
          setRunning(false);
          localStorage.removeItem(ENRICH_JOB_STORAGE_KEY);
        }
      } catch { /* ignore poll errors */ }
    }, 2500);
  };

  // On mount: check localStorage for a job left in progress
  useEffect(() => {
    const saved = localStorage.getItem(ENRICH_JOB_STORAGE_KEY);
    if (saved) setSavedJobId(saved);
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reconnect = async () => {
    if (!savedJobId) return;
    setError('');
    setRunning(true);
    try {
      const r = await fetch(apiUrl(`/scraper/listings/bulk-ai-enrich/${savedJobId}`), { headers: authHeaders() });
      if (!r.ok) throw new Error('Job not found — the backend may have restarted.');
      const data: EnrichJob = await r.json();
      setJobId(savedJobId);
      setSavedJobId(null);
      setProgress(data);
      if (data.status === 'running') {
        beginPolling(savedJobId);
      } else {
        setRunning(false);
        localStorage.removeItem(ENRICH_JOB_STORAGE_KEY);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      localStorage.removeItem(ENRICH_JOB_STORAGE_KEY);
      setSavedJobId(null);
      setRunning(false);
    }
  };

  const dismissSaved = () => {
    localStorage.removeItem(ENRICH_JOB_STORAGE_KEY);
    setSavedJobId(null);
  };

  const startEnrich = async () => {
    setError('');
    setProgress(null);
    setSavedJobId(null);
    setRunning(true);
    try {
      const res = await fetch(apiUrl('/scraper/listings/bulk-ai-enrich'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          source: source || null,
          dealer_id: dealerId ? parseInt(dealerId) : null,
          limit,
          only_incomplete: rewriteDescriptions ? false : onlyIncomplete,
          rewrite_descriptions: rewriteDescriptions,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `HTTP ${res.status}`);
      }
      const { job_id } = await res.json();
      localStorage.setItem(ENRICH_JOB_STORAGE_KEY, job_id);
      setJobId(job_id);
      beginPolling(job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  };

  useEffect(() => () => stopPolling(), []);

  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl">
      <p className="text-sm text-gray-600 mb-6">
        Run Claude AI over existing listings to fill in missing specs, engine details, generators, and feature bullets. Use <strong>Rewrite existing descriptions</strong> to replace wordy or marketing-heavy copy with clean, professional text. Only empty fields are updated in standard mode — existing data is never overwritten unless you opt in.
      </p>

      {/* Reconnect banner */}
      {savedJobId && !running && (
        <div className="flex items-center gap-3 p-4 mb-5 bg-yellow-50 border border-yellow-300 rounded-xl text-sm">
          <span className="text-yellow-800 flex-1">
            A job (<code className="font-mono">{savedJobId}</code>) was started in a previous session and may still be running on the server.
          </span>
          <button onClick={reconnect}
            className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-medium hover:bg-yellow-700 transition-colors whitespace-nowrap">
            Reconnect
          </button>
          <button onClick={dismissSaved}
            className="px-3 py-1.5 bg-white border border-yellow-300 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-50 transition-colors whitespace-nowrap">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source filter</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="scraped">Scraped (HTML scraper)</option>
              <option value="">All sources</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dealer (optional)</label>
            <select value={dealerId} onChange={e => setDealerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">All dealers</option>
              {dealers.map(d => <option key={d.id} value={d.id}>{d.name || `Dealer #${d.id}`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max listings</label>
            <input type="number" min={1} max={1000} value={limit} onChange={e => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={onlyIncomplete} onChange={e => setOnlyIncomplete(e.target.checked)}
            disabled={rewriteDescriptions}
            className="w-4 h-4 rounded border-gray-300 text-emerald-600 disabled:opacity-40" />
          <span className={rewriteDescriptions ? 'opacity-40' : ''}>
            Skip listings that already have engines + a real description
            <span className="text-xs text-gray-400 ml-1">(recommended — avoids re-spending tokens)</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={rewriteDescriptions} onChange={e => setRewriteDescriptions(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-orange-600 mt-0.5" />
          <span>
            Rewrite existing descriptions
            <span className="text-xs text-gray-500 block mt-0.5">Overwrites all descriptions longer than 80 chars with a clean, professional AI-written version. Only run this on listings with wordy or marketing-heavy copy. <span className="text-orange-600 font-medium">Cannot be undone.</span></span>
          </span>
        </label>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <button onClick={startEnrich} disabled={running}
          className="px-5 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
          {running ? 'Running…' : 'Start AI Enrichment'}
        </button>
      </div>

      {progress && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-800">
              {progress.status === 'done' ? 'Complete' : 'Running…'}
            </span>
            <span className="text-sm text-gray-500">
              {progress.done}/{progress.total} processed · {progress.updated} updated · {progress.errors} errors
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div
              className={`h-2 rounded-full transition-all ${progress.status === 'done' ? 'bg-emerald-600' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Log */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-0.5">
            {progress.log.length === 0 && <span className="text-gray-400">Waiting for results…</span>}
            {[...progress.log].reverse().map((line, i) => (
              <div key={i} className={
                line.startsWith('✓') ? 'text-emerald-700' :
                line.startsWith('✗') ? 'text-red-600' :
                'text-gray-500'
              }>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedJobsSection({ dealers, apiUrl: _apiUrl, authHeaders: _authHeaders }: { dealers: Dealer[]; apiUrl: (path: string) => string; authHeaders: () => Record<string, string> }) {
  const [jobs, setJobs] = useState<YWJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [editingJob, setEditingJob] = useState<YWJob | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ dealer_id: '', salesman_id: '', site_name: '', api_endpoint: '', api_key: '', feed_type: 'boats_group' as 'boats_group' | 'iyba', schedule_hours: '24', notes: '', enabled: true as boolean });
  const [logOpenId, setLogOpenId] = useState<number | null>(null);
  const [logData, setLogData] = useState<Record<number, { status: string; last_error?: string; started_at?: string; completed_at?: string; log: Array<{ t: string; level: string; msg: string }> }>>({});
  const [logLoading, setLogLoading] = useState<number | null>(null);

  async function loadJobs(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const r = await fetch(_apiUrl('/yachtworld/jobs'), { headers: _authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      setJobs(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load feed jobs');
    } finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { loadJobs(); }, []);

  function handleStartEdit(job: YWJob) {
    setEditingJob(job);
    setForm({ dealer_id: String(job.dealer_id), salesman_id: job.salesman_id ? String(job.salesman_id) : '', site_name: job.site_name || '', api_endpoint: job.api_endpoint, api_key: '', feed_type: job.feed_type || 'boats_group', schedule_hours: String(job.schedule_hours), notes: job.notes || '', enabled: job.enabled });
    setFormError('');
    setShowForm(true);
  }

  function handleCancelForm() {
    setShowForm(false); setEditingJob(null);
    setForm({ dealer_id: '', salesman_id: '', site_name: '', api_endpoint: '', api_key: '', feed_type: 'boats_group', schedule_hours: '24', notes: '', enabled: true });
    setFormError('');
  }

  async function handleSaveJob(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dealer_id) { setFormError('Please select a dealer'); return; }
    if (!form.api_endpoint) { setFormError('Feed URL is required'); return; }
    if (form.feed_type === 'boats_group' && !editingJob && !form.api_key) { setFormError('API key is required for Boats Group feeds'); return; }
    setFormSaving(true); setFormError('');
    try {
      const body: Record<string, unknown> = {
        dealer_id: parseInt(form.dealer_id),
        salesman_id: form.salesman_id ? parseInt(form.salesman_id) : null,
        site_name: form.site_name || form.api_endpoint,
        api_endpoint: form.api_endpoint,
        feed_type: form.feed_type,
        schedule_hours: parseInt(form.schedule_hours) || 24,
        notes: form.notes || null,
        enabled: form.enabled,
      };
      if (form.api_key.trim()) body.api_key = form.api_key.trim();

      const url = editingJob ? _apiUrl(`/yachtworld/jobs/${editingJob.id}`) : _apiUrl('/yachtworld/jobs');
      const method = editingJob ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { ..._authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      await loadJobs();
      handleCancelForm();
      setActionMsg(editingJob ? 'Feed job updated.' : 'Feed job created.');
      setTimeout(() => setActionMsg(''), 4000);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally { setFormSaving(false); }
  }

  const [runningId, setRunningId] = useState<number | null>(null);
  const [rawSampleId, setRawSampleId] = useState<number | null>(null);
  const [rawSampleLoading, setRawSampleLoading] = useState<number | null>(null);
  const [rawSampleData, setRawSampleData] = useState<Record<number, unknown>>({});

  async function handleRawSample(job: YWJob) {
    if (rawSampleId === job.id) { setRawSampleId(null); return; }
    setRawSampleId(job.id);
    if (rawSampleData[job.id]) return;
    setRawSampleLoading(job.id);
    try {
      const r = await fetch(_apiUrl(`/yachtworld/jobs/${job.id}/raw-sample`), { headers: _authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setRawSampleData(prev => ({ ...prev, [job.id]: data }));
    } catch (e: unknown) {
      setRawSampleData(prev => ({ ...prev, [job.id]: { error: e instanceof Error ? e.message : 'Failed' } }));
    } finally { setRawSampleLoading(null); }
  }

  // When log panel is open and job is running, refresh the log every 5s
  useEffect(() => {
    if (logOpenId === null) return;
    const jobIsRunning = jobs.find(j => j.id === logOpenId)?.status === 'running';
    if (!jobIsRunning) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(_apiUrl(`/yachtworld/jobs/${logOpenId}/log`), { headers: _authHeaders() });
        if (r.ok) {
          const d = await r.json();
          setLogData(prev => ({ ...prev, [logOpenId]: d }));
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [logOpenId, jobs]);

  async function handleRunJob(job: YWJob) {
    if (runningId === job.id) return;
    setRunningId(job.id);
    setLogData(prev => { const n = { ...prev }; delete n[job.id]; return n; });
    setLogOpenId(job.id);  // auto-open log so user sees progress
    try {
      const r = await fetch(_apiUrl(`/yachtworld/jobs/${job.id}/run`), { method: 'POST', headers: _authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      setActionMsg(`Running "${job.site_name || job.api_endpoint}"…`);
      let polls = 0;
      const poll = async () => {
        polls++;
        try {
          // Silent refresh — no loading spinner flash
          const listRes = await fetch(_apiUrl('/yachtworld/jobs'), { headers: _authHeaders() });
          if (!listRes.ok) { setRunningId(null); return; }
          const freshJobs: YWJob[] = await listRes.json();
          setJobs(freshJobs);
          const current = freshJobs.find(j => j.id === job.id);
          if (current && current.status === 'running' && polls < 40) {
            setTimeout(poll, 3000);
          } else {
            setRunningId(null);
            if (current) {
              setActionMsg(current.status === 'completed'
                ? `Sync complete — ${current.listings_created ?? 0} created, ${current.listings_updated ?? 0} updated`
                : `Sync ${current.status}`);
              setTimeout(() => setActionMsg(''), 6000);
            }
          }
        } catch {
          setRunningId(null);
        }
      };
      setTimeout(poll, 2000);
    } catch (e: unknown) {
      setRunningId(null);
      setActionMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  async function handleToggleJob(job: YWJob) {
    try {
      const r = await fetch(_apiUrl(`/yachtworld/jobs/${job.id}/toggle`), { method: 'POST', headers: _authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      await loadJobs();
    } catch (e: unknown) {
      setActionMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  async function handleResetJob(job: YWJob) {
    try {
      const r = await fetch(_apiUrl(`/yachtworld/jobs/${job.id}/reset`), { method: 'POST', headers: _authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      setActionMsg(`Job reset to idle.`);
      setTimeout(() => setActionMsg(''), 4000);
      await loadJobs();
    } catch (e: unknown) {
      setActionMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  async function handleDeleteJob(job: YWJob) {
    if (!confirm(`Delete feed job "${job.site_name || job.api_endpoint}"?\nThis will not remove already-imported listings.`)) return;
    try {
      const r = await fetch(_apiUrl(`/yachtworld/jobs/${job.id}`), { method: 'DELETE', headers: _authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      await loadJobs();
    } catch (e: unknown) {
      setActionMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  async function handleViewLog(job: YWJob) {
    if (logOpenId === job.id) { setLogOpenId(null); return; }
    setLogOpenId(job.id);
    if (logData[job.id]) return; // already loaded
    setLogLoading(job.id);
    try {
      const r = await fetch(_apiUrl(`/yachtworld/jobs/${job.id}/log`), { headers: _authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setLogData(prev => ({ ...prev, [job.id]: data }));
    } catch (e: unknown) {
      setLogData(prev => ({ ...prev, [job.id]: { status: 'error', last_error: e instanceof Error ? e.message : 'Failed to load log', log: [] } }));
    } finally { setLogLoading(null); }
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = { idle: 'bg-gray-100 text-gray-600', running: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Feed Jobs — Boats Group &amp; IYBA</h3>
          <p className="text-xs text-gray-500 mt-0.5">Pull listings directly from the Boats Group REST API or an IYBA XML feed.</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingJob(null); }}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800">
            + New Feed Job
          </button>
        )}
      </div>

      {actionMsg && <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">{actionMsg}</div>}

      {showForm && (
        <form onSubmit={handleSaveJob} className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">{editingJob ? 'Edit Feed Job' : 'New Feed Job'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dealer *</label>
              <select value={form.dealer_id} onChange={e => setForm(f => ({ ...f, dealer_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">— Select a dealer —</option>
                {dealers.map(d => <option key={d.id} value={d.id}>{d.company_name || d.name} ({d.email})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Site Label</label>
              <input type="text" value={form.site_name} onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                placeholder="e.g. Terraglio Fleet"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Feed Type *</label>
              <select value={form.feed_type} onChange={e => setForm(f => ({ ...f, feed_type: e.target.value as 'boats_group' | 'iyba' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="boats_group">Boats Group / YachtWorld REST API</option>
                <option value="iyba">IYBA / YachtBroker.org JSON Feed</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {form.feed_type === 'iyba'
                  ? 'Fetches listings from the IYBA / YachtBroker.org JSON API (api.yachtbroker.org). Requires an API key.'
                  : 'Fetches listings from the Boats Group / YachtWorld REST API. Requires an API key.'}
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {form.feed_type === 'iyba' ? 'IYBA API Endpoint URL *' : 'API Endpoint URL *'}
              </label>
              <input type="url" value={form.api_endpoint} onChange={e => setForm(f => ({ ...f, api_endpoint: e.target.value }))}
                placeholder={form.feed_type === 'iyba' ? 'https://api.yachtbroker.org/vessel?id=MEMBER_ID' : 'https://www.yachtworld.com/api/inventory/search'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              {form.feed_type === 'boats_group' && (
                <p className="text-xs text-gray-400 mt-1">The Boats Group REST API search endpoint. Provided by Terraglio / your Boats Group rep.</p>
              )}
              {form.feed_type === 'iyba' && (
                <p className="text-xs text-gray-400 mt-1">IYBA / YachtBroker.org vessel API. Endpoint must include the broker's member ID: <span className="font-mono">https://api.yachtbroker.org/vessel?id=MEMBER_ID</span></p>
              )}
            </div>
            {(form.feed_type === 'boats_group' || form.feed_type === 'iyba') && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  API Key {editingJob ? <span className="text-gray-400 font-normal">(leave blank to keep existing)</span> : '*'}
                </label>
                <input type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                  placeholder={editingJob?.api_key_set ? '••••••••••••••••' : (form.feed_type === 'iyba' ? 'IYBA / YachtBroker.org API token' : 'Boats Group / YachtWorld API key')}
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono" />
                {editingJob?.api_key_set && !form.api_key && (
                  <p className="text-xs text-green-600 mt-1">✓ API key already saved — enter a new value only to rotate it.</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Stored server-side. Never returned to the browser after saving.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sync Frequency</label>
              <select value={form.schedule_hours} onChange={e => setForm(f => ({ ...f, schedule_hours: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="6">Every 6 hours</option>
                <option value="12">Every 12 hours</option>
                <option value="24">Daily (every 24 hours)</option>
                <option value="48">Every 2 days</option>
                <option value="168">Weekly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Admin Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Permission on file from Terraglio"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button type="button" onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} className="flex items-center gap-2 text-sm text-gray-700">
              <span className={`inline-block w-10 h-5 rounded-full transition-colors ${form.enabled ? 'bg-green-500' : 'bg-gray-300'} relative`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </span>
              {form.enabled ? 'Enabled — runs on schedule' : 'Disabled — won\'t run automatically'}
            </button>
          </div>
          {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 mt-4">
            <button type="submit" disabled={formSaving}
              className="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {formSaving ? 'Saving...' : editingJob ? 'Save Changes' : 'Create Feed Job'}
            </button>
            <button type="button" onClick={handleCancelForm}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading feed jobs...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No feed jobs yet. Add one above to pull listings from the Boats Group or IYBA API.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const dealer = dealers.find(d => d.id === job.dealer_id);
            const isIyba = job.feed_type === 'iyba';
            return (
              <div key={job.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{job.site_name || job.api_endpoint}</span>
                      {isIyba
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">IYBA JSON Feed</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">YW API Feed</span>
                      }
                      <StatusBadge status={job.status} />
                      {!job.enabled && <span className="text-xs text-gray-400 italic">paused</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>Dealer: <span className="text-gray-700">{dealer?.company_name || dealer?.name || `#${job.dealer_id}`}</span></span>
                      <span>Every {job.schedule_hours}h</span>
                      <span>Runs: {job.total_runs}</span>
                      {job.last_run_at && <span>Last: {fmtDate(job.last_run_at)}</span>}
                      {job.next_run_at && job.enabled && <span>Next: {fmtDate(job.next_run_at)}</span>}
                    </div>
                    {job.total_runs > 0 && (
                      <div className="mt-1 flex gap-3 text-xs text-gray-500">
                        <span className="text-green-700">+{job.listings_created} created</span>
                        <span className="text-blue-700">{job.listings_updated} updated</span>
                        <span className="text-gray-500">{job.listings_removed} archived</span>
                      </div>
                    )}
                    {job.last_error && <p className="mt-1 text-xs text-red-600 truncate">{job.last_error}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Stuck-job reset — only visible when status=running but not triggered this session */}
                    {job.status === 'running' && runningId !== job.id && (
                      <button
                        onClick={() => handleResetJob(job)}
                        title="Job is stuck running — click to reset it"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 font-medium">
                        ✕ Reset stuck job
                      </button>
                    )}
                    {/* Run button — primary action */}
                    <button
                      onClick={() => handleRunJob(job)}
                      disabled={runningId === job.id || job.status === 'running'}
                      title="Run sync now"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium disabled:opacity-60 disabled:cursor-not-allowed">
                      {runningId === job.id || job.status === 'running'
                        ? <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Running…</>
                        : <>▶ Run</>}
                    </button>
                    {/* Log button */}
                    <button onClick={() => handleViewLog(job)} title="View last run log"
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium ${logOpenId === job.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {logLoading === job.id ? '…' : 'Log'}
                    </button>
                    {/* Enabled toggle */}
                    <button
                      onClick={() => handleToggleJob(job)}
                      title={job.enabled ? 'Click to disable auto-sync' : 'Click to enable auto-sync'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium border ${
                        job.enabled
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${job.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {job.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button onClick={() => handleStartEdit(job)} title="Edit"
                      className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Edit</button>
                    <button onClick={() => handleRawSample(job)} title="Fetch 1 raw record from the API to inspect field names"
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium ${rawSampleId === job.id ? 'bg-purple-800 text-white' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'}`}>
                      {rawSampleLoading === job.id ? '…' : 'Raw'}
                    </button>
                    <button onClick={() => handleDeleteJob(job)} title="Delete"
                      className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium">Delete</button>
                  </div>
                </div>

                {/* Raw sample panel */}
                {rawSampleId === job.id && (
                  <div className="mt-3 pt-3 border-t border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-purple-800">Raw API record (field names &amp; values)</span>
                      <button onClick={() => { setRawSampleData(prev => { const n = { ...prev }; delete n[job.id]; return n; }); handleRawSample(job); }}
                        className="ml-auto text-xs text-purple-600 hover:underline">Refresh</button>
                      <button onClick={() => setRawSampleId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                    {rawSampleLoading === job.id ? (
                      <p className="text-xs text-gray-400">Fetching…</p>
                    ) : rawSampleData[job.id] ? (
                      <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">{JSON.stringify(rawSampleData[job.id], null, 2)}</pre>
                    ) : null}
                  </div>
                )}

                {/* Log panel */}
                {logOpenId === job.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {logLoading === job.id ? (
                      <p className="text-xs text-gray-400">Loading log…</p>
                    ) : logData[job.id] ? (
                      <>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-semibold text-gray-700">Last run log</span>
                          {logData[job.id].started_at && <span className="text-xs text-gray-400">{logData[job.id].started_at?.substring(0, 19).replace('T', ' ')} UTC</span>}
                          <button onClick={() => { setLogData(prev => { const n = { ...prev }; delete n[job.id]; return n; }); handleViewLog(job); }}
                            className="ml-auto text-xs text-blue-600 hover:underline">Refresh</button>
                        </div>
                        {logData[job.id].log.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No log entries yet. Run the job to generate a log.</p>
                        ) : (
                          <div className="bg-gray-900 rounded-lg p-3 max-h-72 overflow-y-auto font-mono text-xs leading-5">
                            {logData[job.id].log.map((entry, i) => (
                              <div key={i} className={`${entry.level === 'error' ? 'text-red-400' : entry.level === 'warn' ? 'text-yellow-400' : 'text-green-300'}`}>
                                <span className="text-gray-500 select-none">{entry.t} </span>
                                <span className={`font-semibold uppercase text-[10px] mr-1.5 ${entry.level === 'error' ? 'text-red-500' : entry.level === 'warn' ? 'text-yellow-500' : 'text-gray-400'}`}>{entry.level}</span>
                                {entry.msg}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Master Ocean API ── */}
      <MasterOceanSection dealers={dealers} apiUrl={_apiUrl} authHeaders={_authHeaders} />
    </div>
  );
}

// ─── Master Ocean Section ─────────────────────────────────────────────────────

function MasterOceanSection({ dealers, apiUrl: _apiUrl, authHeaders: _authHeaders }: { dealers: Dealer[]; apiUrl: (p: string) => string; authHeaders: () => Record<string, string> }) {
  const [moJob, setMoJob] = useState<{ id: number; status: string; schedule_hours: number; last_run_at?: string; next_run_at?: string; listings_found: number; listings_created: number; listings_updated: number; listings_removed: number; total_runs: number; last_error?: string; enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ dealer_id: '', api_key: '', sync_types: ['Charter'] as string[], schedule_hours: '24' });
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [runMsg, setRunMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [logEntries, setLogEntries] = useState<Array<{ url?: string; outcome?: string; error?: string; listing_id?: number }>>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawData, setRawData] = useState<unknown>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ schedule_hours: '24', enabled: true });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function loadMoJob(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(_apiUrl('/scraper/jobs'), { headers: _authHeaders() });
      const d = await r.json();
      if (d.success && Array.isArray(d.jobs)) {
        const found = d.jobs.find((j: any) => {
          try { return JSON.parse(j.site_template || '{}').api_type === 'master_ocean'; } catch { return false; }
        }) ?? d.jobs.find((j: any) => j.broker_url?.startsWith('https://master-ocean.com') || j.site_name?.toLowerCase().includes('master ocean'));
        setMoJob(found ?? null);
      }
    } catch { /* ignore */ } finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { loadMoJob(); }, []);

  function toggleSyncType(t: string) {
    setForm(f => ({ ...f, sync_types: f.sync_types.includes(t) ? f.sync_types.filter(x => x !== t) : [...f.sync_types, t] }));
  }

  async function handleTest() {
    if (!form.api_key.trim()) { setTestResult({ ok: false, text: 'Enter an API key first' }); return; }
    setTestLoading(true); setTestResult(null);
    try {
      const r = await fetch(_apiUrl('/scraper/master-ocean/test'), { method: 'POST', headers: _authHeaders(), body: JSON.stringify({ api_key: form.api_key.trim() }) });
      const d = await r.json();
      setTestResult(d.success ? { ok: true, text: `Connected — ${d.total_found ?? d.count ?? '?'} listings available` } : { ok: false, text: d.detail || d.message || 'Connection failed' });
    } catch (e: any) { setTestResult({ ok: false, text: e.message }); } finally { setTestLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dealer_id) { setSaveMsg({ ok: false, text: 'Select a dealer' }); return; }
    if (!form.api_key.trim()) { setSaveMsg({ ok: false, text: 'Enter the API key' }); return; }
    if (!form.sync_types.length) { setSaveMsg({ ok: false, text: 'Select at least one type to sync' }); return; }
    setSaving(true); setSaveMsg(null);
    try {
      const r = await fetch(_apiUrl('/scraper/master-ocean/jobs'), { method: 'POST', headers: _authHeaders(), body: JSON.stringify({ api_key: form.api_key.trim(), sync_types: form.sync_types, schedule_hours: Number(form.schedule_hours), dealer_id: Number(form.dealer_id) }) });
      const d = await r.json();
      if (d.success) { setSaveMsg({ ok: true, text: `Job #${d.job?.id} created` }); setShowForm(false); loadMoJob(); }
      else setSaveMsg({ ok: false, text: d.detail || d.message || 'Failed' });
    } catch (e: any) { setSaveMsg({ ok: false, text: e.message }); } finally { setSaving(false); }
  }

  async function handleRun(jobId: number) {
    setRunningId(jobId); setRunMsg('Starting sync…');
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      const r = await fetch(_apiUrl(`/scraper/jobs/${jobId}/run`), { method: 'POST', headers: _authHeaders() });
      const d = await r.json();
      if (!d.success) { setRunMsg(d.message || 'Failed to start'); setRunningId(null); return; }
      setRunMsg('Syncing — this may take a few minutes…');
      pollRef.current = setInterval(async () => {
        await loadMoJob(true);
        const r2 = await fetch(_apiUrl(`/scraper/jobs/${jobId}`), { headers: _authHeaders() });
        const d2 = await r2.json();
        if (d2.success && d2.job?.status !== 'running') {
          clearInterval(pollRef.current!); pollRef.current = null;
          setRunningId(null);
          const j = d2.job;
          setRunMsg(j.status === 'completed' ? `Done — found ${j.listings_found ?? 0}, created ${j.listings_created ?? 0}, updated ${j.listings_updated ?? 0}` : `Finished with status: ${j.status}`);
          loadMoJob(true);
        }
      }, 4000);
    } catch (e: any) { setRunMsg(e.message); setRunningId(null); }
  }

  async function handleViewLog() {
    if (!moJob) return;
    if (showLog) { setShowLog(false); return; }
    setShowLog(true); setShowRaw(false); setLogLoading(true);
    try {
      const r = await fetch(_apiUrl(`/scraper/jobs/${moJob.id}`), { headers: _authHeaders() });
      const d = await r.json();
      setLogEntries(d.success ? (d.job?.last_run_log ?? []) : []);
    } catch { setLogEntries([]); } finally { setLogLoading(false); }
  }

  async function handleViewRaw() {
    if (!moJob) return;
    if (showRaw) { setShowRaw(false); return; }
    setShowRaw(true); setShowLog(false);
    try {
      const r = await fetch(_apiUrl(`/scraper/jobs/${moJob.id}`), { headers: _authHeaders() });
      const d = await r.json();
      setRawData(d.success ? d.job : d);
    } catch (e: any) { setRawData({ error: e.message }); }
  }

  function handleStartEdit() {
    if (!moJob) return;
    setEditForm({ schedule_hours: String(moJob.schedule_hours ?? 24), enabled: moJob.enabled });
    setEditMsg(null);
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    if (!moJob) return;
    setEditSaving(true); setEditMsg(null);
    try {
      const r = await fetch(_apiUrl(`/scraper/jobs/${moJob.id}`), {
        method: 'PUT', headers: _authHeaders(),
        body: JSON.stringify({ schedule_hours: Number(editForm.schedule_hours), enabled: editForm.enabled }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.detail || 'Failed to save');
      setEditMsg({ ok: true, text: 'Saved' });
      setShowEdit(false);
      loadMoJob();
    } catch (e: any) { setEditMsg({ ok: false, text: e.message }); } finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!moJob) return;
    if (!confirm('Delete the Master Ocean sync job? This will not remove already-imported listings.')) return;
    setDeleting(true);
    try {
      const r = await fetch(_apiUrl(`/scraper/jobs/${moJob.id}`), { method: 'DELETE', headers: _authHeaders() });
      const d = await r.json();
      if (!d.success) throw new Error(d.detail || 'Failed to delete');
      setMoJob(null); setShowLog(false); setShowRaw(false); setShowEdit(false);
    } catch (e: any) { alert(e.message); } finally { setDeleting(false); }
  }

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Master Ocean API</h3>
          <p className="text-xs text-gray-500 mt-0.5">Sync charter and/or sale listings directly from the Master Ocean REST API.</p>
        </div>
        {!showForm && !moJob && !loading && (
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800">
            + Set Up Master Ocean
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-gray-400">Loading…</p>}

      {/* Existing job card */}
      {!loading && moJob && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900">Master Ocean</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">MO API Feed</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${moJob.status === 'completed' ? 'bg-green-100 text-green-700' : moJob.status === 'running' ? 'bg-blue-100 text-blue-700' : moJob.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{moJob.status}</span>
                {!moJob.enabled && <span className="text-xs text-gray-400 italic">paused</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                <span>Every {moJob.schedule_hours}h</span>
                <span>Runs: {moJob.total_runs}</span>
                {moJob.last_run_at && <span>Last: {fmtDate(moJob.last_run_at)}</span>}
                {moJob.next_run_at && moJob.enabled && <span>Next: {fmtDate(moJob.next_run_at)}</span>}
              </div>
              {moJob.total_runs > 0 && (
                <div className="mt-1 flex gap-3 text-xs">
                  <span className="text-green-700">+{moJob.listings_created} created</span>
                  <span className="text-blue-700">{moJob.listings_updated} updated</span>
                  <span className="text-gray-500">{moJob.listings_removed} archived</span>
                </div>
              )}
              {moJob.last_error && <p className="mt-1 text-xs text-red-600 truncate">{moJob.last_error}</p>}
              {runMsg && <p className="mt-1 text-xs text-blue-600">{runMsg}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => handleRun(moJob.id)} disabled={runningId === moJob.id || moJob.status === 'running'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium disabled:opacity-60">
                {runningId === moJob.id || moJob.status === 'running'
                  ? <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Running…</>
                  : <>▶ Run</>}
              </button>
              <button onClick={handleViewLog} title="View last run log" className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                {logLoading ? '…' : 'Log'}
              </button>
              <button onClick={handleStartEdit} title="Edit schedule / enabled" className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Edit</button>
              <button onClick={handleViewRaw} title="View raw job record" className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium">Raw</button>
              <button onClick={handleDelete} disabled={deleting} title="Delete" className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium disabled:opacity-50">
                {deleting ? '…' : 'Delete'}
              </button>
            </div>
          </div>

          {/* Log panel */}
          {showLog && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Last run log</p>
              {logLoading ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : logEntries.length === 0 ? (
                <p className="text-xs text-gray-400">No log entries yet — run the job to populate this.</p>
              ) : (
                <div className="max-h-64 overflow-auto space-y-1">
                  {logEntries.map((entry, i) => (
                    <div key={i} className="text-xs px-2 py-1 rounded bg-gray-50 flex items-start gap-2">
                      <span className={`font-medium flex-shrink-0 ${entry.outcome === 'error' ? 'text-red-600' : entry.outcome === 'created' ? 'text-green-700' : entry.outcome === 'updated' ? 'text-blue-700' : 'text-gray-500'}`}>
                        {entry.outcome ?? '—'}
                      </span>
                      <span className="text-gray-600 truncate">{entry.error || entry.url || (entry.listing_id ? `listing #${entry.listing_id}` : '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Raw panel */}
          {showRaw && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-purple-800 mb-2">Raw job record</p>
              <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">{JSON.stringify(rawData, null, 2)}</pre>
            </div>
          )}

          {/* Edit panel */}
          {showEdit && (
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
              <p className="text-xs font-semibold text-gray-600">Edit Master Ocean job</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sync schedule</label>
                  <select value={editForm.schedule_hours} onChange={e => setEditForm(f => ({ ...f, schedule_hours: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="6">Every 6 hours</option>
                    <option value="12">Every 12 hours</option>
                    <option value="24">Daily</option>
                    <option value="48">Every 2 days</option>
                    <option value="168">Weekly</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, enabled: !f.enabled }))} className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                    <span className={`inline-block w-10 h-5 rounded-full transition-colors ${editForm.enabled ? 'bg-green-500' : 'bg-gray-300'} relative`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </span>
                    {editForm.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
              {editMsg && <p className={`text-xs ${editMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{editMsg.text}</p>}
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={editSaving} className="px-4 py-1.5 bg-blue-700 text-white rounded-lg text-xs font-medium hover:bg-blue-800 disabled:opacity-50">
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowEdit(false)} className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Setup form */}
      {showForm && (
        <form onSubmit={handleCreate} className="p-5 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Configure Master Ocean Sync</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assign listings to dealer *</label>
              <select value={form.dealer_id} onChange={e => setForm(f => ({ ...f, dealer_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">— Select dealer —</option>
                {dealers.map(d => <option key={d.id} value={d.id}>{d.company_name || d.name} ({d.email})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sync schedule</label>
              <select value={form.schedule_hours} onChange={e => setForm(f => ({ ...f, schedule_hours: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="6">Every 6 hours</option>
                <option value="12">Every 12 hours</option>
                <option value="24">Daily</option>
                <option value="48">Every 2 days</option>
                <option value="168">Weekly</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">API Key *</label>
              <div className="flex gap-2">
                <input type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                  placeholder="Paste Master Ocean API key" autoComplete="off"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={handleTest} disabled={testLoading || !form.api_key.trim()}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-40">
                  {testLoading ? 'Testing…' : 'Test'}
                </button>
              </div>
              {testResult && (
                <p className={`mt-1 text-xs ${testResult.ok ? 'text-green-700' : 'text-red-600'}`}>
                  {testResult.ok ? '✓' : '✗'} {testResult.text}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">Stored server-side. Never returned to the browser after saving.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-2">What to sync *</label>
              <div className="flex gap-3">
                {['Charter', 'Sale'].map(t => (
                  <button key={t} type="button" onClick={() => toggleSyncType(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.sync_types.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                    {t} listings
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Charter → charter listings table. Sale → boats-for-sale table.</p>
            </div>
          </div>

          {saveMsg && <p className={`text-sm ${saveMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{saveMsg.ok ? '✓' : '✗'} {saveMsg.text}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Sync Job'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setSaveMsg(null); setTestResult(null); }}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Charter Scraper Section (single URL, manual) ─────────────────────────────

interface CharterPreview {
  title?: string;
  vessel_name?: string;
  make?: string;
  model?: string;
  year?: number;
  boat_type?: string;
  hull_material?: string;
  length_feet?: number;
  beam_feet?: number;
  draft_feet?: number;
  cabins?: number;
  berths?: number;
  heads?: number;
  home_port_city?: string;
  home_port_state?: string;
  home_port_country?: string;
  description?: string;
  images?: string[];
  status?: string;
  currency?: string;
  day_rate?: string;
  week_rate?: string;
  charter_company_name?: string;
  charter_company_email?: string;
  charter_company_phone?: string;
}

function CharterScraperSection({ apiUrl: _apiUrl, authHeaders: _authHeaders }: { apiUrl: (p: string) => string; authHeaders: () => Record<string, string> }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [preview, setPreview] = useState<CharterPreview | null>(null);
  const [priceHint, setPriceHint] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500';
  const lbl = 'block text-xs font-medium text-gray-600 mb-1';

  const set = (k: keyof CharterPreview, v: unknown) => setPreview(p => (p ? { ...p, [k]: v } : p));

  async function handleScrape() {
    if (!url.trim()) { setError('Please enter a URL'); return; }
    setLoading(true); setError(''); setPreview(null); setPriceHint(null); setLogs([]); setSaveMsg(null);
    try {
      const res = await fetch(_apiUrl('/scraper/charter-preview'), {
        method: 'POST', headers: _authHeaders(), body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      setLogs(data.logs || []);
      if (!data.success) { setError(data.error || 'Failed to scrape this page'); return; }
      setPreview({ ...data.charter, day_rate: '', week_rate: '', currency: data.charter.currency || 'USD' });
      setPriceHint(data.scraped_price_hint ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!preview) return;
    setSaving(true); setSaveMsg(null);
    try {
      const payload: Record<string, unknown> = { ...preview };
      // Empty rate fields shouldn't overwrite as "0" — strip them
      if (!payload.day_rate) delete payload.day_rate; else payload.day_rate = Number(payload.day_rate);
      if (!payload.week_rate) delete payload.week_rate; else payload.week_rate = Number(payload.week_rate);
      const res = await fetch(_apiUrl('/charter'), {
        method: 'POST',
        headers: { ..._authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create listing');
      setSaveMsg({ ok: true, text: `Created charter listing #${data.id} — ${data.title}` });
      setPreview(null);
      setUrl('');
    } catch (err) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to create listing' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-900">
          <strong>Manual charter scrape.</strong> Paste a single charter listing URL — it reuses the same page-fetch and extraction engine as the for-sale scraper, then maps the result onto the charter schema. Rates couldn&apos;t reliably be classified as day vs. week automatically, so confirm those manually below before creating the listing.
        </p>
      </div>

      <div className="flex gap-2 mb-5">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/charter/north-wind"
          className={inp}
        />
        <button
          onClick={handleScrape}
          disabled={loading}
          className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex-shrink-0"
        >
          {loading ? 'Scraping…' : 'Scrape & Preview'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>}

      {logs.length > 0 && (
        <details className="mb-4">
          <summary className="text-xs text-gray-500 cursor-pointer">Scrape logs ({logs.length})</summary>
          <pre className="mt-2 bg-gray-900 text-green-300 text-xs rounded-lg p-3 overflow-auto max-h-48">{logs.join('\n')}</pre>
        </details>
      )}

      {preview && (
        <div className="rounded-xl border border-gray-200 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Review before creating</h4>

          {priceHint != null && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              Found a price of <strong>{priceHint.toLocaleString()}</strong> on the page — enter it as either Day Rate or Week Rate below (whichever it represents).
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Title</label>
              <input className={inp} value={preview.title ?? ''} onChange={e => { set('title', e.target.value); set('vessel_name', e.target.value); }} />
            </div>
            <div><label className={lbl}>Make</label><input className={inp} value={preview.make ?? ''} onChange={e => set('make', e.target.value)} /></div>
            <div><label className={lbl}>Model</label><input className={inp} value={preview.model ?? ''} onChange={e => set('model', e.target.value)} /></div>
            <div><label className={lbl}>Year</label><input type="number" className={inp} value={preview.year ?? ''} onChange={e => set('year', e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><label className={lbl}>Boat Type</label><input className={inp} value={preview.boat_type ?? ''} onChange={e => set('boat_type', e.target.value)} /></div>
            <div><label className={lbl}>Length (ft)</label><input type="number" className={inp} value={preview.length_feet ?? ''} onChange={e => set('length_feet', e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><label className={lbl}>Cabins</label><input type="number" className={inp} value={preview.cabins ?? ''} onChange={e => set('cabins', e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><label className={lbl}>Berths</label><input type="number" className={inp} value={preview.berths ?? ''} onChange={e => set('berths', e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><label className={lbl}>Heads</label><input type="number" className={inp} value={preview.heads ?? ''} onChange={e => set('heads', e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><label className={lbl}>Home Port City</label><input className={inp} value={preview.home_port_city ?? ''} onChange={e => set('home_port_city', e.target.value)} /></div>
            <div><label className={lbl}>Home Port Country</label><input className={inp} value={preview.home_port_country ?? ''} onChange={e => set('home_port_country', e.target.value)} /></div>

            <div>
              <label className={lbl}>Currency</label>
              <select className={inp} value={preview.currency ?? 'USD'} onChange={e => set('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div />
            <div><label className={lbl}>Day Rate</label><input type="number" className={inp} value={preview.day_rate ?? ''} onChange={e => set('day_rate', e.target.value)} placeholder="Leave blank if not applicable" /></div>
            <div><label className={lbl}>Week Rate</label><input type="number" className={inp} value={preview.week_rate ?? ''} onChange={e => set('week_rate', e.target.value)} placeholder="Leave blank if not applicable" /></div>

            <div className="col-span-2"><label className={lbl}>Charter Company Name</label><input className={inp} value={preview.charter_company_name ?? ''} onChange={e => set('charter_company_name', e.target.value)} /></div>
            <div className="col-span-2">
              <label className={lbl}>Description</label>
              <textarea rows={4} className={inp + ' resize-none'} value={preview.description ?? ''} onChange={e => set('description', e.target.value)} />
            </div>
          </div>

          {preview.images && preview.images.length > 0 && (
            <p className="text-xs text-gray-500">{preview.images.length} image(s) found and will be attached automatically.</p>
          )}

          {saveMsg && (
            <div className={`p-3 rounded-lg text-sm ${saveMsg.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              {saveMsg.text}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving} className="px-5 py-2 bg-[#10214F] text-white rounded-lg text-sm font-medium hover:bg-[#1a3570] disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Charter Listing (as Draft)'}
            </button>
            <button onClick={() => { setPreview(null); setSaveMsg(null); }} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminScraperTab() {
  const [section, setSection] = useState<'jobs' | 'test' | 'review' | 'specs' | 'manual' | 'prompt' | 'feeds' | 'enrich' | 'charters'>('jobs');

  // ── Jobs state ──
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [logOpenJob, setLogOpenJob] = useState<number | null>(null);
  const [rawPagesOpenJob, setRawPagesOpenJob] = useState<number | null>(null);
  const [rawPagesData, setRawPagesData] = useState<Record<number, RawPage[]>>({});
  const [rawPagesLoading, setRawPagesLoading] = useState<number | null>(null);
  const [reparsing, setReparsing] = useState<number | null>(null);
  const [dataOpenPage, setDataOpenPage] = useState<number | null>(null);
  const [pageEdits, setPageEdits] = useState<Record<number, Record<string, unknown>>>({});
  const [dataSaving, setDataSaving] = useState<number | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [applyResults, setApplyResults] = useState<Record<number, { listing_id: number; action: string }>>({});
  const [runningJob, setRunningJob] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  // ── Add/Edit job form ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingJob, setEditingJob] = useState<ScraperJob | null>(null);
  const [form, setForm] = useState({ dealer_id: '', salesman_id: '', site_name: '', broker_url: '', schedule_hours: '24', notes: '', enabled: true as boolean });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formTeamMembers, setFormTeamMembers] = useState<TeamMember[]>([]);

  // Field selector template state (edit mode only)
  const EMPTY_TMPL: SiteTemplate = {
    listing_link_selector: '', next_page_selector: '',
    title_selector: '', price_selector: '', description_selector: '',
    year_selector: '', make_selector: '', model_selector: '',
    length_selector: '', location_selector: '', images_selector: '',
    agent_name_selector: '', agent_photo_selector: '',
    broker_email_selector: '', broker_phone_selector: '',
    hull_material_selector: '', fuel_type_selector: '', hours_selector: '', condition_selector: '',
    sections: [],
    label_map: {},
    field_rules: [],
  };
  const [tmpl, setTmpl] = useState<SiteTemplate>(EMPTY_TMPL);
  const [tmplExpanded, setTmplExpanded] = useState(false);
  const [tmplSaving, setTmplSaving] = useState(false);
  const [tmplMsg, setTmplMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tmplTestUrl, setTmplTestUrl] = useState('');
  const [tmplTesting, setTmplTesting] = useState(false);
  const [tmplTestResult, setTmplTestResult] = useState<any>(null);
  const [tmplTestError, setTmplTestError] = useState('');
  const [tmplImportJson, setTmplImportJson] = useState('');
  const [tmplImportError, setTmplImportError] = useState('');

  async function loadRawPages(jobId: number) {
    setRawPagesLoading(jobId);
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${jobId}/raw-pages`), { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setRawPagesData(prev => ({ ...prev, [jobId]: data.pages }));
    } catch { /* non-critical */ } finally {
      setRawPagesLoading(null);
    }
  }

  async function handleReparse(rawPageId: number, jobId: number) {
    setReparsing(rawPageId);
    try {
      const res = await fetch(apiUrl(`/scraper/raw-pages/${rawPageId}/reparse`), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setRawPagesData(prev => ({
          ...prev,
          [jobId]: (prev[jobId] || []).map(p => p.id === rawPageId ? data.page : p),
        }));
        // Reset edits to fresh reparsed data
        setPageEdits(prev => ({ ...prev, [rawPageId]: data.page.merged_data || {} }));
      }
    } catch { /* non-critical */ } finally {
      setReparsing(null);
    }
  }

  async function handleSavePageData(pageId: number, jobId: number) {
    const edits = pageEdits[pageId];
    if (!edits) return;
    setDataSaving(pageId);
    // Strip the internal _all_images working key before sending to the server
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _all_images, ...mergedToSave } = edits as Record<string, unknown> & { _all_images?: unknown };
    try {
      const res = await fetch(apiUrl(`/scraper/raw-pages/${pageId}`), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ merged_data: mergedToSave }),
      });
      const data = await res.json();
      if (data.success) {
        setRawPagesData(prev => ({
          ...prev,
          [jobId]: (prev[jobId] || []).map(p => p.id === pageId ? data.page : p),
        }));
      }
    } catch { /* non-critical */ } finally {
      setDataSaving(null);
    }
  }

  async function handleApply(pageId: number, jobId: number, dealerId: number) {
    setApplying(pageId);
    // Save any pending edits first
    if (pageEdits[pageId]) await handleSavePageData(pageId, jobId);
    try {
      const res = await fetch(apiUrl(`/scraper/raw-pages/${pageId}/apply`), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ dealer_id: dealerId }),
      });
      const data = await res.json();
      if (data.success) {
        setApplyResults(prev => ({ ...prev, [pageId]: { listing_id: data.listing_id, action: data.action } }));
      }
    } catch { /* non-critical */ } finally {
      setApplying(null);
    }
  }

  async function loadTemplate(jobId: number) {
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${jobId}/template`), { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setTmpl({ ...EMPTY_TMPL, ...(data.template || {}) });
    } catch { /* non-critical */ }
  }

  async function saveTemplate(jobId: number) {
    setTmplSaving(true); setTmplMsg(null);
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${jobId}/template`), {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(tmpl),
      });
      const data = await res.json();
      setTmplMsg(data.success
        ? { ok: true, text: 'Selectors saved — will take effect on next sync.' }
        : { ok: false, text: data.detail || 'Save failed' });
    } catch { setTmplMsg({ ok: false, text: 'Network error' }); }
    finally { setTmplSaving(false); }
  }

  async function runTemplateTest() {
    if (!tmplTestUrl) return;
    setTmplTesting(true); setTmplTestResult(null); setTmplTestError('');
    try {
      const res = await fetch(apiUrl('/scraper/test-with-template'), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ url: tmplTestUrl, template: tmpl }),
      });
      const data = await res.json();
      if (data.success) setTmplTestResult(data.data);
      else setTmplTestError(data.error || data.detail || 'Test failed');
    } catch (e: any) { setTmplTestError(e.message || 'Network error'); }
    finally { setTmplTesting(false); }
  }

  function importTemplateJson() {
    setTmplImportError('');
    try {
      const parsed = JSON.parse(tmplImportJson.trim());
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object');
      setTmpl({ ...EMPTY_TMPL, ...parsed });
      setTmplImportJson('');
      setTmplMsg({ ok: true, text: 'Template imported — review fields above then click Save.' });
    } catch (e: any) {
      setTmplImportError(e.message || 'Invalid JSON');
    }
  }

  function getBookmarkletUrl(job: ScraperJob) {
    // API_ROOT already ends with /api — just append the route path directly.
    // We build it at runtime so we always use the correct origin.
    const root = typeof window !== 'undefined'
      ? apiUrl('/scraper/bookmarklet.js').replace(/\?.*$/, '')
      : 'https://yacht-platform.onrender.com/api/scraper/bookmarklet.js';
    return `${root}?job=${job.id}&name=${encodeURIComponent(job.site_name || '')}`;
  }

  function getBookmarkletHref(job: ScraperJob) {
    // Avoid single-quotes inside the javascript: string — browsers URL-encode
    // them as %27 which breaks the JS when the bookmark is clicked.
    // Use encodeURIComponent around the src string and decode at runtime instead.
    const src = getBookmarkletUrl(job);
    // eslint-disable-next-line no-script-url
    return `javascript:void(function(){var s=document.createElement("script");s.src="${src}&_="+Date.now();document.head.appendChild(s)}())`;
  }

  // ── Test tools state ──
  const [testTab, setTestTab] = useState<'single' | 'broker'>('single');
  const [singleUrl, setSingleUrl] = useState('');
  const [singleDealerId, setSingleDealerId] = useState('');
  const [singleSalesmanId, setSingleSalesmanId] = useState('');
  const [singleTeamMembers, setSingleTeamMembers] = useState<TeamMember[]>([]);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [singleError, setSingleError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ listing_id: number; title: string } | null>(null);
  const [importError, setImportError] = useState('');
  const [brokerUrl, setBrokerUrl] = useState('');
  const [brokerLoading, setBrokerLoading] = useState(false);
  const [brokerResult, setBrokerResult] = useState<any>(null);
  const [brokerError, setBrokerError] = useState('');
  const [brokerLogs, setBrokerLogs] = useState<LogLine[]>([]);
  const [singleLogs, setSingleLogs] = useState<LogLine[]>([]);

  // ── Data loading ──
  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError('');
    try {
      const res = await fetch(apiUrl('/scraper/jobs'), { headers: authHeaders() });
      if (!res.ok) {
        const text = await res.text();
        setJobsError(`Server error ${res.status}: ${text.slice(0, 300)}`);
        return;
      }
      const data = await res.json();
      if (data.success) setJobs(data.jobs);
      else setJobsError(data.detail || 'Failed to load jobs');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setJobsError(`Request failed: ${msg}`);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const loadDealers = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/admin/dealers?limit=200'), { headers: authHeaders() });
      const data = await res.json();
      if (data.dealers) setDealers(data.dealers);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadJobs(); loadDealers(); }, [loadJobs, loadDealers]);

  async function loadTeamMembers(dealerId: string, setter: (m: TeamMember[]) => void) {
    if (!dealerId) { setter([]); return; }
    try {
      const res = await fetch(apiUrl(`/scraper/team-members/${dealerId}`), { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setter(data.members);
    } catch { /* non-critical */ }
  }

  function flash(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3500);
  }

  // ── Job actions ──
  async function handleRunNow(job: ScraperJob) {
    setRunningJob(job.id);
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${job.id}/run`), { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      flash(data.message || `Job "${job.site_name}" started`);
      // Poll every 5 seconds until the job is no longer running, then refresh the full list
      const pollTimer = setInterval(async () => {
        try {
          const r = await fetch(apiUrl(`/scraper/jobs/${job.id}`), { headers: authHeaders() });
          const d = await r.json();
          if (d.success && d.job) {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, ...d.job } : j));
            if (d.job.status !== 'running') {
              clearInterval(pollTimer);
              loadJobs();
            }
          }
        } catch { clearInterval(pollTimer); }
      }, 5000);
      // Safety valve: stop polling after 60 minutes
      setTimeout(() => clearInterval(pollTimer), 60 * 60 * 1000);
    } catch { flash('Failed to start job'); }
    finally { setRunningJob(null); }
  }

  async function handleToggle(job: ScraperJob) {
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${job.id}/toggle`), { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, enabled: data.enabled } : j));
        flash(`Job ${data.enabled ? 'enabled' : 'paused'}`);
      }
    } catch { flash('Failed to toggle job'); }
  }

  async function handleDelete(job: ScraperJob) {
    if (!confirm(`Delete scraper job for "${job.site_name || job.broker_url}"?\nThis will also remove all scraped listing records.`)) return;
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${job.id}`), { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (data.success) { setJobs(prev => prev.filter(j => j.id !== job.id)); flash('Job deleted'); }
    } catch { flash('Failed to delete job'); }
  }

  function handleStartEdit(job: ScraperJob) {
    setEditingJob(job);
    setForm({
      dealer_id: String(job.dealer_id),
      salesman_id: job.salesman_id ? String(job.salesman_id) : '',
      site_name: job.site_name || '',
      broker_url: job.broker_url,
      schedule_hours: String(job.schedule_hours),
      notes: job.notes || '',
      enabled: job.enabled,
    });
    loadTeamMembers(String(job.dealer_id), setFormTeamMembers);
    setFormError('');
    setTmpl(EMPTY_TMPL); setTmplMsg(null); setTmplExpanded(false);
    setTmplTestUrl(''); setTmplTestResult(null); setTmplTestError('');
    setTmplImportJson(''); setTmplImportError('');
    loadTemplate(job.id);
    setShowAddForm(true);
  }

  function handleCancelForm() {
    setShowAddForm(false);
    setEditingJob(null);
    setForm({ dealer_id: '', salesman_id: '', site_name: '', broker_url: '', schedule_hours: '24', notes: '', enabled: true });
    setFormTeamMembers([]);
    setFormError('');
    setTmpl(EMPTY_TMPL); setTmplMsg(null); setTmplExpanded(false);
    setTmplTestUrl(''); setTmplTestResult(null); setTmplTestError('');
    setTmplImportJson(''); setTmplImportError('');
  }

  async function handleSaveJob(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dealer_id) { setFormError('Please select a dealer'); return; }
    if (!form.broker_url) { setFormError('Broker URL is required'); return; }
    setFormSaving(true); setFormError('');
    try {
      const body = {
        dealer_id: parseInt(form.dealer_id),
        salesman_id: form.salesman_id ? parseInt(form.salesman_id) : null,
        site_name: form.site_name || form.broker_url,
        broker_url: form.broker_url,
        schedule_hours: parseInt(form.schedule_hours) || 24,
        notes: form.notes || null,
        enabled: form.enabled,
      };
      const isEdit = !!editingJob;
      const res = await fetch(
        isEdit ? apiUrl(`/scraper/jobs/${editingJob!.id}`) : apiUrl('/scraper/jobs'),
        { method: isEdit ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (data.success) {
        if (isEdit) {
          setJobs(prev => prev.map(j => j.id === editingJob!.id ? data.job : j));
          flash('Job updated');
        } else {
          setJobs(prev => [data.job, ...prev]);
          flash('Scraper job created');
        }
        handleCancelForm();
      } else { setFormError(data.detail || 'Failed to save job'); }
    } catch { setFormError('Network error'); }
    finally { setFormSaving(false); }
  }

  // ── Test tools ──
  async function handleScrapeSingle() {
    if (!singleUrl) { setSingleError('Please enter a URL'); return; }
    setSingleLoading(true); setSingleError(''); setSingleResult(null); setImportResult(null); setImportError(''); setSingleLogs([]);
    try {
      const res = await fetch(apiUrl('/scraper/single'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: singleUrl }) });
      const data = await res.json();
      setSingleLogs(data.logs || []);
      if (data.success) setSingleResult(data.data);
      else setSingleError(data.error || 'Failed to scrape');
    } catch (err: any) { setSingleError(err.message || 'Network error'); }
    finally { setSingleLoading(false); }
  }

  async function handleImportSingle() {
    if (!singleResult || !singleDealerId) return;
    setImportLoading(true); setImportError(''); setImportResult(null);
    try {
      const res = await fetch(apiUrl('/scraper/import-single'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          url: singleUrl,
          dealer_id: parseInt(singleDealerId),
          salesman_id: singleSalesmanId ? parseInt(singleSalesmanId) : null,
        }),
      });
      const data = await res.json();
      if (data.success) setImportResult({ listing_id: data.listing_id, title: data.title });
      else setImportError(data.error || data.detail || 'Import failed');
    } catch (err: any) { setImportError(err.message || 'Network error'); }
    finally { setImportLoading(false); }
  }

  async function handleScrapeBroker() {
    if (!brokerUrl) { setBrokerError('Please enter a broker URL'); return; }
    setBrokerLoading(true); setBrokerError(''); setBrokerResult(null); setBrokerLogs([]);
    try {
      const res = await fetch(apiUrl('/scraper/broker'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: brokerUrl, preview_count: 3 }) });
      const data = await res.json();
      setBrokerLogs(data.logs || []);
      if (data.success) setBrokerResult(data);
      else setBrokerError(data.message || 'Failed to scrape');
    } catch (err: any) { setBrokerError(err.message || 'Network error'); }
    finally { setBrokerLoading(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Globe className="text-primary" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Broker Listing Sync</h2>
            <p className="text-gray-500 text-sm">Automatically import and sync listings from enrolled broker websites</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSection('jobs')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'jobs' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Sync Jobs
          </button>
          <button onClick={() => setSection('test')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'test' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Test Tools
          </button>
          <button onClick={() => setSection('review')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'review' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Review Queue
          </button>
          <button onClick={() => setSection('specs')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'specs' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Specs DB
          </button>
          <button onClick={() => setSection('manual')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'manual' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Manual Import
          </button>
          <button onClick={() => setSection('prompt')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'prompt' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            AI Prompts
          </button>
          <button onClick={() => setSection('feeds')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'feeds' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Feed Jobs
          </button>
          <button onClick={() => setSection('enrich')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'enrich' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            AI Enrich
          </button>
          <button onClick={() => setSection('charters')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === 'charters' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Charters
          </button>
        </div>
      </div>

      {/* Flash message */}
      {actionMsg && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-2">
          <CheckCircle size={16} /> {actionMsg}
        </div>
      )}

      {/* ══ SYNC JOBS ══════════════════════════════════════════════════════ */}
      {section === 'jobs' && (
        <div className="p-6">
          <div className="flex items-start justify-between mb-5 gap-4">
            <p className="text-sm text-gray-600 max-w-xl">
              Each job monitors a broker's inventory page and automatically creates, updates, or archives listings as their site changes. Jobs run on the scheduler every 30 minutes and execute if they're past their due time.
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={loadJobs} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button onClick={() => { handleCancelForm(); setShowAddForm(v => !v); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
                <Plus size={16} /> Add Job
              </button>
            </div>
          </div>

          {/* Add / Edit Job Form */}
          {showAddForm && (
            <form onSubmit={handleSaveJob} className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{editingJob ? `Edit Job #${editingJob.id}` : 'New Scraper Job'}</h3>
                <button type="button" onClick={handleCancelForm} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Broker / Dealer *</label>
                  <select value={form.dealer_id} onChange={e => { setForm(f => ({ ...f, dealer_id: e.target.value, salesman_id: '' })); loadTeamMembers(e.target.value, setFormTeamMembers); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary">
                    <option value="">— Select a dealer —</option>
                    {dealers.map(d => (
                      <option key={d.id} value={d.id}>{d.company_name || d.name} ({d.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Assign Salesman <span className="text-gray-400">(optional)</span></label>
                  <select value={form.salesman_id} onChange={e => setForm(f => ({ ...f, salesman_id: e.target.value }))}
                    disabled={!form.dealer_id || formTeamMembers.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400">
                    <option value="">{formTeamMembers.length === 0 ? (form.dealer_id ? 'No team members' : 'Select dealer first') : '— All listings (no specific salesman) —'}</option>
                    {formTeamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role || 'salesperson'})</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Pin all scraped listings to a specific team member.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Site Label</label>
                  <input type="text" value={form.site_name} onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                    placeholder="e.g. Suntex Marina Fleet"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Broker Inventory URL *</label>
                  <input type="url" value={form.broker_url} onChange={e => setForm(f => ({ ...f, broker_url: e.target.value }))}
                    placeholder="https://broker-website.com/inventory"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                  <p className="text-xs text-gray-500 mt-1">The broker's main listings/inventory page. The scraper crawls it to discover all individual listing URLs.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sync Frequency</label>
                  <select value={form.schedule_hours} onChange={e => setForm(f => ({ ...f, schedule_hours: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary">
                    <option value="6">Every 6 hours</option>
                    <option value="12">Every 12 hours</option>
                    <option value="24">Daily (every 24 hours)</option>
                    <option value="48">Every 2 days</option>
                    <option value="168">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Admin Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Permission on file, contact: John"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button type="button" onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className={`inline-block w-10 h-5 rounded-full transition-colors ${form.enabled ? 'bg-green-500' : 'bg-gray-300'} relative`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </span>
                  {form.enabled ? 'Enabled — runs on schedule' : 'Disabled — won\'t run automatically'}
                </button>
              </div>
              <div className="flex gap-3 mt-4">
                <button type="submit" disabled={formSaving}
                  className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {formSaving ? 'Saving...' : editingJob ? 'Save Changes' : 'Create Job'}
                </button>
                <button type="button" onClick={handleCancelForm}
                  className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                  Cancel
                </button>
              </div>

              {/* Field Selectors — edit mode only */}
              {editingJob && (
                <div className="mt-5 border-t border-gray-200 pt-4">
                  <button type="button" onClick={() => setTmplExpanded(v => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary w-full text-left">
                    <span className="text-base leading-none">{tmplExpanded ? '▾' : '▸'}</span>
                    🎯 Field Selectors
                    <span className="ml-1 text-xs font-normal text-gray-400">(configure once for precision scraping)</span>
                    {Object.values(tmpl).some(v => v && (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.length > 0 : false)) && (
                      <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">configured</span>
                    )}
                  </button>

                  {tmplExpanded && (
                    <div className="mt-4 space-y-5">
                      {/* Bookmarklet helper */}
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900">
                        <p className="font-semibold mb-2">🔖 Visual Picker — Install as a Bookmark</p>
                        <p className="mb-1">Click <strong>📋 Copy Bookmarklet URL</strong>, then create a new bookmark in your browser and paste it as the URL.</p>
                        <p className="mb-2 text-indigo-700">Chrome/Edge: right-click bookmarks bar → <em>Add Page…</em> → paste URL. Firefox: Bookmarks menu → <em>Manage Bookmarks</em> → New Bookmark → paste URL.</p>
                        {editingJob && (
                          <button
                            type="button"
                            onClick={() => {
                              const url = getBookmarkletHref(editingJob);
                              navigator.clipboard?.writeText(url).catch(() => {
                                const el = document.createElement('textarea');
                                el.value = url;
                                document.body.appendChild(el);
                                el.select();
                                document.execCommand('copy');
                                document.body.removeChild(el);
                              });
                            }}
                            className="px-3 py-1.5 bg-indigo-700 text-white rounded font-medium hover:bg-indigo-800">
                            📋 Copy Bookmarklet URL
                          </button>
                        )}
                        <p className="mt-2 text-indigo-700"><strong>Step 2:</strong> Navigate to any broker listing page, click your new bookmark, then click elements to tag them. Click <strong>Copy JSON</strong> in the sidebar, then paste below.</p>
                      </div>

                      {/* Import JSON from bookmarklet */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Import from Bookmarklet JSON</p>
                        <textarea
                          rows={3}
                          value={tmplImportJson}
                          onChange={e => setTmplImportJson(e.target.value)}
                          placeholder='Paste the JSON from the "Copy JSON" button in the selector picker panel…'
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary resize-none"
                        />
                        {tmplImportError && <p className="text-xs text-red-600 mt-0.5">{tmplImportError}</p>}
                        <button type="button" onClick={importTemplateJson} disabled={!tmplImportJson.trim()}
                          className="mt-1.5 px-4 py-1.5 bg-indigo-700 text-white rounded-lg text-xs font-medium hover:bg-indigo-800 disabled:opacity-50">
                          ↑ Import JSON
                        </button>
                      </div>

                      {([
                        { group: 'Discovery', fields: [
                          { key: 'listing_link_selector', label: 'Listing Links',  hint: '<a> tags to individual listings on the inventory page' },
                          { key: 'next_page_selector',    label: 'Next Page',      hint: 'Pagination next link (e.g. a.next-page)' },
                        ]},
                        { group: 'Listing Fields', fields: [
                          { key: 'title_selector',       label: 'Title',          hint: 'Boat name / headline' },
                          { key: 'price_selector',       label: 'Price',          hint: 'Asking price element' },
                          { key: 'description_selector', label: 'Description',    hint: 'Main description text' },
                          { key: 'year_selector',        label: 'Year',           hint: 'Model year' },
                          { key: 'make_selector',        label: 'Make',           hint: 'Manufacturer / brand' },
                          { key: 'model_selector',       label: 'Model',          hint: 'Model name' },
                          { key: 'length_selector',      label: 'Length',         hint: 'LOA / length' },
                          { key: 'location_selector',    label: 'Location',       hint: 'Marina / city / port' },
                          { key: 'images_selector',      label: 'Gallery Images', hint: '<img> tags in photo gallery (e.g. .gallery img)' },
                          { key: 'hull_material_selector', label: 'Hull Material', hint: 'Hull type (fibreglass / aluminium / steel…)' },
                          { key: 'fuel_type_selector',   label: 'Fuel Type',      hint: 'Fuel type (diesel / petrol / electric…)' },
                          { key: 'hours_selector',       label: 'Engine Hours',   hint: 'Engine hours meter reading' },
                          { key: 'condition_selector',   label: 'Condition',      hint: 'New or Used designation' },
                        ]},
                        { group: 'Agent / Broker', fields: [
                          { key: 'agent_name_selector',  label: 'Agent Name',   hint: 'Agent name text element' },
                          { key: 'agent_photo_selector', label: 'Agent Photo',  hint: 'Agent headshot <img> tag' },
                          { key: 'broker_email_selector', label: 'Broker Email', hint: 'Broker or agent email address' },
                          { key: 'broker_phone_selector', label: 'Broker Phone', hint: 'Broker or agent phone number' },
                        ]},
                      ] as { group: string; fields: { key: string; label: string; hint: string }[] }[]).map(({ group, fields }) => (
                        <div key={group}>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {fields.map(({ key, label, hint }) => (
                              <div key={key}>
                                <label className="block text-xs font-medium text-gray-700 mb-0.5">{label}</label>
                                <input
                                  type="text"
                                  value={(tmpl as any)[key] || ''}
                                  onChange={e => setTmpl(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="CSS selector…"
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary"
                                />
                                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{hint}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Named sections from bookmarklet */}
                      {(tmpl.sections && tmpl.sections.length > 0) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Named Sections (from Bookmarklet)</p>
                          <div className="space-y-2">
                            {tmpl.sections.map((sec, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded-lg text-xs">
                                <span className="font-semibold text-purple-800 min-w-[80px]">{sec.name}</span>
                                <code className="flex-1 text-purple-700 font-mono truncate">{sec.selector}</code>
                                <button type="button" onClick={() => setTmpl(prev => ({ ...prev, sections: prev.sections?.filter((_, j) => j !== i) }))}
                                  className="text-gray-400 hover:text-red-500 text-sm leading-none">&times;</button>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">All fields in each container are auto-extracted during scraping.</p>
                        </div>
                      )}

                      {/* ── Label Map — broker-specific spec-label overrides ── */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🏷 Label Mapping</p>
                        <p className="text-xs text-gray-400 mb-2">
                          Teach the scraper how this broker's spec table labels map to fields.
                          Format: <code className="bg-gray-100 px-1 rounded">Raw Label → field_name</code> (one per line, e.g. <code className="bg-gray-100 px-1 rounded">Asking Price (CAD) → price</code>)
                        </p>
                        <textarea
                          rows={5}
                          value={Object.entries(tmpl.label_map || {}).map(([k, v]) => `${k} → ${v}`).join('\n')}
                          onChange={e => {
                            const map: Record<string, string> = {};
                            e.target.value.split('\n').forEach(line => {
                              const sep = line.indexOf(' → ');
                              if (sep > 0) {
                                const k = line.slice(0, sep).trim();
                                const v = line.slice(sep + 3).trim();
                                if (k && v) map[k] = v;
                              }
                            });
                            setTmpl(prev => ({ ...prev, label_map: map }));
                          }}
                          placeholder={`Asking Price (CAD) → price\nLOA (Feet) → length_feet\nEngine Hours → engine_hours\nYear Built → year`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-0.5">
                          Valid target fields: title, make, model, year, price, length_feet, beam_feet, draft_feet, engine_hours, engine_count, cabins, heads, fuel_type, hull_material, city, state, country
                        </p>
                      </div>

                      {/* ── Field Rules — regex extraction rules ── */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🔍 Extraction Rules</p>
                        <p className="text-xs text-gray-400 mb-2">
                          Regex patterns to extract specific fields from the page text when selectors aren't enough.
                          Format: <code className="bg-gray-100 px-1 rounded">field_name | pattern | type</code> (type = text, number, int)
                        </p>
                        <textarea
                          rows={4}
                          value={(tmpl.field_rules || []).map(r => `${r.field} | ${r.pattern} | ${r.type}`).join('\n')}
                          onChange={e => {
                            const rules = e.target.value.split('\n').flatMap(line => {
                              const parts = line.split(' | ');
                              if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
                                return [{ field: parts[0].trim(), pattern: parts[1].trim(), type: (parts[2] || 'text').trim() }];
                              }
                              return [];
                            });
                            setTmpl(prev => ({ ...prev, field_rules: rules }));
                          }}
                          placeholder={`engine_hours | Engine\\s*Hours[:\\s]+(\\d[\\d,]+) | int\nprice | Price[:\\s]+\\$?([\\d,]+) | number`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary resize-none"
                        />
                      </div>

                      {tmplMsg && (
                        <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
                          tmplMsg.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
                        }`}>
                          {tmplMsg.ok
                            ? <CheckCircle size={15} className="shrink-0 mt-0.5" />
                            : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
                          {tmplMsg.text}
                        </div>
                      )}

                      <button type="button" onClick={() => saveTemplate(editingJob.id)} disabled={tmplSaving}
                        className="px-5 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                        {tmplSaving ? 'Saving…' : '💾 Save Field Selectors'}
                      </button>

                      {/* ── Live test widget ── */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Test Saved Selectors</p>
                        <p className="text-xs text-gray-400 mb-2">Enter a single <em>listing</em> URL to preview what the saved selectors extract.</p>
                        <div className="flex gap-2">
                          <input type="url" value={tmplTestUrl} onChange={e => setTmplTestUrl(e.target.value)}
                            placeholder="https://broker.com/listing/yacht-name-123"
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary" />
                          <button type="button" onClick={runTemplateTest} disabled={tmplTesting || !tmplTestUrl}
                            className="px-4 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50 whitespace-nowrap">
                            {tmplTesting ? 'Testing…' : '▶ Run Test'}
                          </button>
                        </div>
                        {tmplTestError && <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{tmplTestError}</div>}
                        {tmplTestResult && (
                          <div className="mt-3 space-y-3">
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs">
                              <p className="font-semibold text-green-800 mb-2">✓ Core fields</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-green-900">
                                {(['title', 'make', 'model', 'year', 'price', 'length_feet', 'location', 'detected_agent_name'] as const).map(f =>
                                  tmplTestResult[f] ? <p key={f}><strong className="capitalize">{f.replace(/_/g, ' ')}:</strong> {String(tmplTestResult[f])}</p> : null
                                )}
                                {(tmplTestResult.images?.length ?? 0) > 0 && <p><strong>Images:</strong> {tmplTestResult.images.length} found</p>}
                              </div>
                            </div>
                            {tmplTestResult._tmpl_sections && typeof tmplTestResult._tmpl_sections === 'object' && Object.keys(tmplTestResult._tmpl_sections).length > 0 && (
                              Object.entries(tmplTestResult._tmpl_sections as Record<string, any>).map(([secName, secData]) => {
                                const isList = Array.isArray(secData);
                                const isObj = secData && typeof secData === 'object' && !isList;
                                const fieldCount = isObj ? Object.keys(secData).length : 0;
                                return (
                                  <div key={secName} className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                                    <p className="font-semibold text-blue-800 mb-2">📌 {secName} ({isList ? `${(secData as string[]).length} items` : isObj ? `${fieldCount} fields` : 'no data'})</p>
                                    {isList ? (
                                      <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto text-blue-900">
                                        {(secData as string[]).slice(0, 30).map((item, i) => <li key={i}>{String(item)}</li>)}
                                      </ul>
                                    ) : isObj ? (
                                      <div className="space-y-0.5 max-h-48 overflow-y-auto text-blue-900">
                                        {Object.entries(secData as Record<string, string>).map(([k, v]) => (
                                          <p key={k}><strong>{k}:</strong> {String(v)}</p>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          {/* Jobs List */}
          {jobsLoading ? (
            <div className="text-center py-12 text-gray-500 text-sm">Loading sync jobs...</div>
          ) : jobsError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{jobsError}</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-xl">
              <Globe className="mx-auto mb-3 text-gray-300" size={40} />
              <p className="text-gray-600 font-medium">No sync jobs configured</p>
              <p className="text-sm text-gray-400 mt-1">Add a job to start automatically syncing a broker's listings</p>
              <button onClick={() => setShowAddForm(true)} className="mt-4 px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
                + Add First Job
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => {
                const dealer = dealers.find(d => d.id === job.dealer_id);
                const isExpanded = expandedJob === job.id;
                return (
                  <div key={job.id} className={`border rounded-xl overflow-hidden ${job.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <button onClick={() => setExpandedJob(isExpanded ? null : job.id)} className="mt-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{job.site_name || job.broker_url}</span>
                            <StatusBadge status={job.status} />
                            {!job.enabled && <span className="text-xs text-gray-400 italic">paused</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>Dealer: <span className="text-gray-700">{dealer?.company_name || dealer?.name || `#${job.dealer_id}`}</span></span>
                            <span>Every {job.schedule_hours}h</span>
                            <span>Runs: {job.total_runs}</span>
                            {job.last_run_at && <span>Last: {fmtDate(job.last_run_at)}</span>}
                            {job.next_run_at && job.enabled && <span>Next: {fmtDate(job.next_run_at)}</span>}
                          </div>
                          {job.total_runs > 0 && (
                            <div className="mt-2 flex gap-3 text-xs">
                              <span className="text-blue-600">Found: {job.listings_found}</span>
                              <span className="text-green-600">Created: {job.listings_created}</span>
                              <span className="text-yellow-600">Updated: {job.listings_updated}</span>
                              <span className="text-gray-500">Archived: {job.listings_removed}</span>
                            </div>
                          )}
                          {job.last_error && (
                            <p className="mt-1 text-xs text-red-600 truncate">⚠ {job.last_error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleRunNow(job)}
                            disabled={job.status === 'running' || runningJob === job.id}
                            title="Run now"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
                            <RefreshCw size={16} className={job.status === 'running' ? 'animate-spin' : ''} />
                          </button>
                          <button onClick={() => handleStartEdit(job)} title="Edit job"
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleToggle(job)}
                            title={job.enabled ? 'Pause job' : 'Enable job'}
                            className={`p-2 rounded-lg ${job.enabled ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}>
                            {job.enabled ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                          <button onClick={() => handleDelete(job)} title="Delete job"
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-2">
                          <div>
                            <p className="text-gray-500 mb-0.5">Inventory URL</p>
                            <a href={job.broker_url} target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:underline break-all">{job.broker_url}</a>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-0.5">Last run</p>
                            <p className="text-gray-800">{fmtDate(job.last_run_at)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-0.5">Frequency</p>
                            <p className="text-gray-800">Every {job.schedule_hours} hours</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-0.5">Job created</p>
                            <p className="text-gray-800">{fmtDate(job.created_at)}</p>
                          </div>
                        </div>
                        {job.notes && <p className="text-xs text-gray-600 italic mb-2">Notes: {job.notes}</p>}

                        {/* Last run log */}
                        {(job.last_run_log && job.last_run_log.length > 0) && (() => {
                          const isLogOpen = logOpenJob === job.id;
                          const outcomeColor = (o: string) => {
                            if (o === 'created') return 'text-green-700 bg-green-50 border-green-200';
                            if (o === 'updated') return 'text-blue-700 bg-blue-50 border-blue-200';
                            if (o === 'sold')    return 'text-amber-700 bg-amber-50 border-amber-200';
                            if (o === 'archived') return 'text-gray-600 bg-gray-100 border-gray-200';
                            if (o === 'error')   return 'text-red-700 bg-red-50 border-red-200';
                            if (o === 'skipped') return 'text-gray-500 bg-gray-50 border-gray-200';
                            if (o === 'failed')  return 'text-orange-700 bg-orange-50 border-orange-200';
                            return 'text-gray-600 bg-gray-50 border-gray-200';
                          };
                          return (
                            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => setLogOpenJob(isLogOpen ? null : job.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors"
                              >
                                <Terminal size={12} />
                                Last Run Log ({job.last_run_log.length} URLs)
                                <span className="ml-auto">{isLogOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                              </button>
                              {isLogOpen && (
                                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                                  {job.last_run_log.map((entry, i) => (
                                    <div key={i} className="px-3 py-1.5 text-xs flex items-start gap-3 hover:bg-gray-50">
                                      <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${outcomeColor(entry.outcome)}`}>
                                        {entry.outcome}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        {entry.title && <p className="font-medium text-gray-800 truncate">{entry.title}</p>}
                                        <p className="text-gray-400 truncate">{entry.url}</p>
                                        {entry.error && <p className="text-red-600 mt-0.5">{entry.error}</p>}
                                      </div>
                                      <div className="shrink-0 flex flex-col items-end gap-1">
                                        {entry.confidence != null && (
                                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${entry.confidence >= 0.6 ? 'bg-green-100 text-green-700' : entry.confidence >= 0.3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                            {Math.round(entry.confidence * 100)}%
                                          </span>
                                        )}
                                        {entry.ai_used && (
                                          <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">AI</span>
                                        )}
                                        {entry.listing_id && (
                                          <a
                                            href={`/admin/scraper-review`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#01BBDC] hover:underline text-[10px]"
                                          >
                                            #{entry.listing_id}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Pipeline Details (RawScrapedPage records) */}
                        {(() => {
                          const isOpen = rawPagesOpenJob === job.id;
                          const pages = rawPagesData[job.id] || [];
                          const stageColor = (s: string) => {
                            if (s === 'validated') return 'text-green-700 bg-green-50 border-green-200';
                            if (s === 'ai_parsed') return 'text-purple-700 bg-purple-50 border-purple-200';
                            if (s === 'normalized') return 'text-blue-700 bg-blue-50 border-blue-200';
                            if (s === 'failed') return 'text-orange-700 bg-orange-50 border-orange-200';
                            return 'text-gray-600 bg-gray-50 border-gray-200';
                          };
                          return (
                            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={async () => {
                                  if (isOpen) { setRawPagesOpenJob(null); return; }
                                  setRawPagesOpenJob(job.id);
                                  if (!rawPagesData[job.id]) await loadRawPages(job.id);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 transition-colors"
                              >
                                <RefreshCw size={12} />
                                Pipeline Details
                                {pages.length > 0 && <span className="text-gray-400">({pages.length} URLs)</span>}
                                {rawPagesLoading === job.id && <span className="text-gray-400 ml-1">Loading…</span>}
                                <span className="ml-auto">{isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                              </button>
                              {isOpen && (
                                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                                  {pages.length === 0 && rawPagesLoading !== job.id && (
                                    <p className="px-3 py-3 text-xs text-gray-400 text-center">No pipeline data for this job yet.</p>
                                  )}
                                  {pages.map(page => {
                                    const isDataOpen = dataOpenPage === page.id;
                                    const edits = pageEdits[page.id] ?? (page.merged_data as Record<string, unknown> ?? {});
                                    const setField = (k: string, v: unknown) =>
                                      setPageEdits(prev => ({ ...prev, [page.id]: { ...edits, [k]: v } }));
                                    const applyDone = applyResults[page.id];
                                    return (
                                    <div key={page.id} className="text-xs">
                                      {/* Summary row */}
                                      <div className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50">
                                        <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${stageColor(page.stage)}`}>
                                          {page.stage}
                                        </span>
                                        {page.confidence_score != null && (
                                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${page.confidence_score >= 0.6 ? 'bg-green-100 text-green-700' : page.confidence_score >= 0.3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                            {Math.round(page.confidence_score * 100)}%
                                          </span>
                                        )}
                                        {page.ai_used && (
                                          <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">AI</span>
                                        )}
                                        {page.skip_reason && (
                                          <span className="text-[9px] text-gray-400 italic">{page.skip_reason}</span>
                                        )}
                                        <div className="ml-auto flex items-center gap-1">
                                          <button
                                            onClick={() => {
                                              if (!isDataOpen) {
                                                // Initialise edits from merged_data, but seed images
                                                // from the full pool (all_images) so the user sees
                                                // every candidate. If merged_data already has a curated
                                                // subset, that subset stays pre-selected.
                                                const base = (page.merged_data as Record<string, unknown>) ?? {};
                                                const pool = page.all_images ?? (base['images'] as string[] ?? []);
                                                const curated = base['images'] as string[] | undefined;
                                                setPageEdits(prev => ({
                                                  ...prev,
                                                  [page.id]: {
                                                    ...base,
                                                    // _all_images is our working pool — stripped before save
                                                    _all_images: pool,
                                                    // images = selected subset (curated if exists, else all)
                                                    images: curated && curated.length > 0 ? curated : pool,
                                                  },
                                                }));
                                              }
                                              setDataOpenPage(isDataOpen ? null : page.id);
                                            }}
                                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${isDataOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'}`}
                                          >
                                            {isDataOpen ? '▲ Data' : '▼ Data'}
                                          </button>
                                          <button
                                            onClick={() => handleReparse(page.id, job.id)}
                                            disabled={reparsing === page.id}
                                            className="text-[10px] px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 transition-colors"
                                          >
                                            {reparsing === page.id ? 'Reparsing…' : 'Reparse'}
                                          </button>
                                        </div>
                                      </div>
                                      <p className="px-3 pb-1.5 text-gray-400 truncate">{page.source_url}</p>

                                      {/* ── Data editor ── */}
                                      {isDataOpen && (
                                        <div className="mx-3 mb-3 border border-blue-200 rounded-lg overflow-hidden bg-blue-50/30">
                                          <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-blue-800">Extracted Data — edit & correct any wrong fields</span>
                                            {applyDone && (
                                              <span className="text-[10px] text-green-700 font-semibold">
                                                ✓ {applyDone.action === 'created' ? 'Created' : 'Updated'} listing #{applyDone.listing_id}
                                              </span>
                                            )}
                                          </div>

                                          {/* Field grid */}
                                          <div className="p-3 grid grid-cols-2 gap-x-3 gap-y-2">
                                            {([
                                              ['title',        'Title',          'text'],
                                              ['make',         'Make',           'text'],
                                              ['model',        'Model',          'text'],
                                              ['year',         'Year',           'number'],
                                              ['price',        'Price',          'number'],
                                              ['boat_type',    'Boat Type',      'text'],
                                              ['length_feet',  'Length (ft)',     'number'],
                                              ['beam_feet',    'Beam (ft)',       'number'],
                                              ['draft_feet',   'Draft (ft)',      'number'],
                                              ['hull_material','Hull Material',   'text'],
                                              ['hull_type',    'Hull Type',       'text'],
                                              ['fuel_type',    'Fuel Type',       'text'],
                                              ['engine_count', 'Engine Count',    'number'],
                                              ['engine_hours', 'Engine Hours',    'number'],
                                              ['cabins',       'Cabins',          'number'],
                                              ['heads',        'Heads',           'number'],
                                              ['city',         'City',            'text'],
                                              ['state',        'State / Region',  'text'],
                                              ['country',      'Country',         'text'],
                                            ] as [string, string, string][]).map(([key, label, type]) => (
                                              <div key={key}>
                                                <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
                                                <input
                                                  type={type}
                                                  value={String(edits[key] ?? '')}
                                                  onChange={e => setField(key, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                                                  className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                                  placeholder="—"
                                                />
                                              </div>
                                            ))}
                                          </div>

                                          {/* Description */}
                                          <div className="px-3 pb-2">
                                            <label className="block text-[10px] text-gray-500 mb-0.5">Description</label>
                                            <textarea
                                              rows={3}
                                              value={String(edits['description'] ?? '')}
                                              onChange={e => setField('description', e.target.value)}
                                              className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none resize-none"
                                              placeholder="—"
                                            />
                                          </div>

                                          {/* ── Image selection gallery ── */}
                                          {(() => {
                                            const allImgs = (edits['_all_images'] as string[]) ?? (edits['images'] as string[] ?? []);
                                            const selectedSet = new Set<string>((edits['images'] as string[]) ?? []);
                                            const total = allImgs.length;
                                            const selectedCount = selectedSet.size;
                                            if (total === 0) return null;
                                            return (
                                              <div className="px-3 pb-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <p className="text-[10px] font-semibold text-gray-600">
                                                    Images{' '}
                                                    <span className={`font-normal ${
                                                      selectedCount === 0 ? 'text-red-500' :
                                                      selectedCount < total ? 'text-yellow-600' : 'text-green-600'
                                                    }`}>
                                                      {selectedCount} of {total} selected
                                                    </span>
                                                  </p>
                                                  <button type="button"
                                                    onClick={() => setField('images', allImgs)}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                                                    All
                                                  </button>
                                                  <button type="button"
                                                    onClick={() => setField('images', [])}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                                                    None
                                                  </button>
                                                  <a href={page.source_url} target="_blank" rel="noopener noreferrer"
                                                    className="ml-auto text-[9px] text-blue-500 hover:underline">
                                                    Open page ↗
                                                  </a>
                                                </div>
                                                <div className="grid grid-cols-4 gap-1.5 max-h-72 overflow-y-auto">
                                                  {allImgs.map((url, i) => {
                                                    const isChecked = selectedSet.has(url);
                                                    return (
                                                      <button
                                                        key={i}
                                                        type="button"
                                                        title={url}
                                                        onClick={() => {
                                                          const next = isChecked
                                                            ? ((edits['images'] as string[]) ?? []).filter(u => u !== url)
                                                            : [...((edits['images'] as string[]) ?? []), url];
                                                          setField('images', next);
                                                        }}
                                                        className={`relative rounded overflow-hidden border-2 transition-all ${
                                                          isChecked
                                                            ? 'border-blue-500 opacity-100'
                                                            : 'border-transparent opacity-40 hover:opacity-70'
                                                        }`}
                                                      >
                                                        <img
                                                          src={url}
                                                          alt=""
                                                          className="w-full h-16 object-cover block"
                                                          onError={e => {
                                                            const wrapper = (e.target as HTMLImageElement).parentElement;
                                                            if (wrapper) wrapper.style.display = 'none';
                                                          }}
                                                        />
                                                        {isChecked && (
                                                          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                                                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                                              <path d="M1.5 4L3 5.5L6.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                          </span>
                                                        )}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          {/* Action buttons */}
                                          <div className="px-3 pb-3 flex items-center gap-2">
                                            <button
                                              onClick={() => handleSavePageData(page.id, job.id)}
                                              disabled={dataSaving === page.id}
                                              className="text-[11px] px-3 py-1.5 rounded bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 font-medium transition-colors"
                                            >
                                              {dataSaving === page.id ? 'Saving…' : '💾 Save Corrections'}
                                            </button>
                                            <button
                                              onClick={() => handleApply(page.id, job.id, job.dealer_id)}
                                              disabled={applying === page.id || dataSaving === page.id}
                                              className="text-[11px] px-3 py-1.5 rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors"
                                            >
                                              {applying === page.id ? 'Applying…' : '→ Apply to Listing'}
                                            </button>
                                            <span className="ml-auto text-[10px] text-gray-400">{Object.keys(edits).filter(k => edits[k] != null && edits[k] !== '').length} fields</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ REVIEW QUEUE ══════════════════════════════════════════════════ */}
      {section === 'review' && (
        <div className="p-6">
          <ScraperReviewPage />
        </div>
      )}

      {/* ══ SPECS DATABASE ═════════════════════════════════════════════════ */}
      {section === 'specs' && <BoatSpecsSection apiUrl={apiUrl} authHeaders={authHeaders} />}

      {/* ══ MANUAL IMPORT ══════════════════════════════════════════════════ */}
      {section === 'manual' && <ManualImportSection dealers={dealers} apiUrl={apiUrl} authHeaders={authHeaders} />}

      {/* ══ AI PROMPTS ═════════════════════════════════════════════════════ */}
      {section === 'prompt' && <PromptEditorSection apiUrl={apiUrl} authHeaders={authHeaders} />}

      {/* ══ FEED JOBS (YachtWorld / Boats Group REST API) ══════════════════ */}
      {section === 'feeds' && <FeedJobsSection dealers={dealers} apiUrl={apiUrl} authHeaders={authHeaders} />}

      {/* ══ AI ENRICH ══════════════════════════════════════════════════════ */}
      {section === 'enrich' && <BulkEnrichSection dealers={dealers} apiUrl={apiUrl} authHeaders={authHeaders} />}

      {/* ══ CHARTERS — single-URL scrape for charter listings ═══════════════ */}
      {section === 'charters' && <CharterScraperSection apiUrl={apiUrl} authHeaders={authHeaders} />}

      {/* ══ TEST TOOLS ═════════════════════════════════════════════════════ */}
      {section === 'test' && (
        <div className="p-6">
          <div className="mb-5 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-900">⚠ For Testing Only</p>
            <p className="text-xs text-yellow-800 mt-1">Use these to validate a broker's site before creating a sync job. Only test sites where the broker has given explicit permission.</p>
          </div>
          <div className="flex gap-3 mb-6">
            <button onClick={() => setTestTab('single')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${testTab === 'single' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              Single Listing
            </button>
            <button onClick={() => setTestTab('broker')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${testTab === 'broker' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              Broker Inventory Preview
            </button>
          </div>

          {testTab === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Listing URL</label>
              <input type="url" value={singleUrl} onChange={e => setSingleUrl(e.target.value)}
                placeholder="https://broker-website.com/listings/yacht-123"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm" />

              {singleError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
                  <AlertCircle size={16} /> {singleError}
                </div>
              )}

              <button onClick={handleScrapeSingle} disabled={singleLoading || !singleUrl}
                className="mt-4 w-full px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                {singleLoading ? 'Scraping...' : '🔍 Scrape & Preview'}
              </button>

              <LogPanel logs={singleLogs} loading={singleLoading} />

              {singleResult && (
                <div className="mt-4 space-y-4">
                  {/* Scraped data preview */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="text-green-600" size={16} />
                      <span className="font-medium text-green-800">Successfully extracted!</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-green-900 text-xs">
                      {[['Title', singleResult.title], ['Make/Model', `${singleResult.make || ''} ${singleResult.model || ''}`],
                        ['Year', singleResult.year], ['Price', singleResult.price ? `$${singleResult.price.toLocaleString()}` : ''],
                        ['Length', singleResult.length_feet ? `${singleResult.length_feet} ft` : ''],
                        ['Location', [singleResult.city, singleResult.state].filter(Boolean).join(', ')]
                      ].map(([k, v]) => v ? <p key={k as string}><strong>{k}:</strong> {v}</p> : null)}
                    </div>
                    {singleResult.detected_agent_name && (
                      <div className="mt-3 pt-3 border-t border-green-300">
                        <p className="text-xs font-semibold text-green-900 mb-0.5">🧑‍💼 Detected Listing Agent</p>
                        <p className="text-sm font-medium text-green-800 bg-green-100 inline-block px-2 py-0.5 rounded">{singleResult.detected_agent_name}</p>
                        <p className="text-xs text-green-700 mt-1">Verify this matches a team member below before importing.</p>
                      </div>
                    )}
                  </div>

                  {/* Import panel */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm font-semibold text-gray-800 mb-3">Import to Database</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Assign to Broker *</label>
                        <select
                          value={singleDealerId}
                          onChange={e => { setSingleDealerId(e.target.value); setSingleSalesmanId(''); loadTeamMembers(e.target.value, setSingleTeamMembers); }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary">
                          <option value="">— Select dealer —</option>
                          {dealers.map(d => (
                            <option key={d.id} value={d.id}>{d.company_name || d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Assign Salesman
                          {singleResult.detected_agent_name && <span className="ml-1 text-yellow-600">(detected: {singleResult.detected_agent_name})</span>}
                        </label>
                        <select
                          value={singleSalesmanId}
                          onChange={e => setSingleSalesmanId(e.target.value)}
                          disabled={!singleDealerId || singleTeamMembers.length === 0}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400">
                          <option value="">{singleTeamMembers.length === 0 ? (singleDealerId ? 'No team members' : 'Select dealer first') : '— Unassigned —'}</option>
                          {singleTeamMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {importError && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
                        <AlertCircle size={16} /> {importError}
                      </div>
                    )}
                    {importResult && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2">
                        <CheckCircle size={16} className="text-blue-600" />
                        Imported! Listing #{importResult.listing_id} — &quot;{importResult.title}&quot;
                      </div>
                    )}

                    <button
                      onClick={handleImportSingle}
                      disabled={importLoading || !singleDealerId}
                      className="mt-3 w-full px-6 py-2.5 bg-secondary text-white rounded-lg font-medium hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                      {importLoading ? 'Importing...' : '⬆ Import to Database'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {testTab === 'broker' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Broker Inventory Page URL</label>
              <input type="url" value={brokerUrl} onChange={e => setBrokerUrl(e.target.value)}
                placeholder="https://broker-website.com/inventory"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm" />
              <p className="text-xs text-gray-500 mt-1">Discovers all listing URLs and previews the first 3 results</p>
              {brokerError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
                  <AlertCircle size={16} /> {brokerError}
                </div>
              )}
              {brokerResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="text-green-600" size={16} />
                    <span className="font-medium text-green-800">Found {brokerResult.total_found} listing URLs</span>
                  </div>
                  {brokerResult.previews?.map((p: any, i: number) => (
                    <div key={i} className="mt-2 p-2 bg-white border border-green-200 rounded text-xs">
                      <p className="text-gray-500 truncate">{p.url}</p>
                      {p.data ? (
                        <p className="text-gray-800 mt-0.5">{p.data.title || `${p.data.make} ${p.data.model}`} — {p.data.price ? `$${p.data.price.toLocaleString()}` : 'price unknown'}</p>
                      ) : <p className="text-red-600">{p.error}</p>}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={handleScrapeBroker} disabled={brokerLoading || !brokerUrl}
                className="mt-4 w-full px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                {brokerLoading ? 'Scanning...' : '🚀 Preview Broker Inventory'}
              </button>

              <LogPanel logs={brokerLogs} loading={brokerLoading} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Boat Specs Database sub-component ───────────────────────────────────────

interface BoatSpec {
  id: number;
  make: string;
  model: string;
  year_from?: number;
  year_to?: number;
  boat_type?: string;
  length_feet?: number;
  beam_feet?: number;
  draft_feet?: number;
  hull_material?: string;
  hull_type?: string;
  fuel_capacity_gallons?: number;
  water_capacity_gallons?: number;
  cabins?: number;
  berths?: number;
  heads?: number;
  max_speed_knots?: number;
  cruising_speed_knots?: number;
  notes?: string;
}

const EMPTY_SPEC: Omit<BoatSpec, 'id'> = {
  make: '', model: '', year_from: undefined, year_to: undefined,
  boat_type: '', length_feet: undefined, beam_feet: undefined, draft_feet: undefined,
  hull_material: '', hull_type: '', fuel_capacity_gallons: undefined,
  water_capacity_gallons: undefined, cabins: undefined, berths: undefined,
  heads: undefined, max_speed_knots: undefined, cruising_speed_knots: undefined,
  notes: '',
};

function BoatSpecsSection({ apiUrl, authHeaders }: { apiUrl: (p: string) => string; authHeaders: () => Record<string, string> }) {
  const [specs, setSpecs] = useState<BoatSpec[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<BoatSpec | null>(null);
  const [form, setForm] = useState<Omit<BoatSpec, 'id'>>(EMPTY_SPEC);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load(search = q) {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/scraper/boat-specs?q=${encodeURIComponent(search)}&limit=100`), { headers: authHeaders() });
      const data = await res.json();
      if (data.success) { setSpecs(data.specs); setTotal(data.total); }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startNew() { setEditing(null); setForm(EMPTY_SPEC); setMsg(''); }
  function startEdit(s: BoatSpec) { setEditing(s); setForm({ ...s }); setMsg(''); }

  function setF(k: keyof typeof form, v: unknown) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.make.trim() || !form.model.trim()) { setMsg('Make and Model are required.'); return; }
    setSaving(true); setMsg('');
    try {
      const url = editing ? apiUrl(`/scraper/boat-specs/${editing.id}`) : apiUrl('/scraper/boat-specs');
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(editing ? 'Saved.' : 'Created.');
        setEditing(data.spec);
        load();
      } else { setMsg('Error saving.'); }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this spec record?')) return;
    await fetch(apiUrl(`/scraper/boat-specs/${id}`), { method: 'DELETE', headers: authHeaders() });
    if (editing?.id === id) { setEditing(null); setForm(EMPTY_SPEC); }
    load();
  }

  const numField = (label: string, k: keyof typeof form, step = '0.1') => (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      <input type="number" step={step} value={form[k] !== undefined && form[k] !== null ? String(form[k]) : ''}
        onChange={e => setF(k, e.target.value === '' ? undefined : Number(e.target.value))}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-400 focus:outline-none" placeholder="—" />
    </div>
  );
  const txtField = (label: string, k: keyof typeof form) => (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      <input type="text" value={String(form[k] ?? '')}
        onChange={e => setF(k, e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-400 focus:outline-none" placeholder="—" />
    </div>
  );

  return (
    <div className="p-6 flex gap-6 h-full min-h-0">
      {/* ── Left: list ── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Boat Specs Database</h3>
          <button onClick={startNew} className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">+ New</button>
        </div>
        <p className="text-xs text-gray-500">
          Reference specs for production boats. The scraper fills in blank fields (length, beam, hull material, etc.) automatically when make + model are matched.
          Engines are intentionally excluded.
        </p>
        <div className="flex gap-2">
          <input type="text" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(q)}
            placeholder="Search make or model…"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-400 focus:outline-none" />
          <button onClick={() => load(q)} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Search</button>
        </div>
        <p className="text-xs text-gray-400">{total} record{total !== 1 ? 's' : ''}</p>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
          {loading && <p className="p-3 text-xs text-gray-400 text-center">Loading…</p>}
          {!loading && specs.length === 0 && <p className="p-3 text-xs text-gray-400 text-center">No records yet.</p>}
          {specs.map(s => (
            <div key={s.id}
              onClick={() => startEdit(s)}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between gap-2 ${editing?.id === s.id ? 'bg-teal-50' : ''}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.make} {s.model}</p>
                <p className="text-xs text-gray-400">
                  {s.year_from && s.year_to ? `${s.year_from}–${s.year_to}` : s.year_from ? `${s.year_from}+` : 'All years'}
                  {s.length_feet ? ` · ${s.length_feet}ft` : ''}
                </p>
              </div>
              <button onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                className="text-gray-300 hover:text-red-500 flex-shrink-0 text-lg leading-none">&times;</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: form ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="font-semibold text-gray-800 mb-4">{editing ? `Edit: ${editing.make} ${editing.model}` : 'New Spec Record'}</h4>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {txtField('Make *', 'make')}
            {txtField('Model *', 'model')}
            {txtField('Boat Type', 'boat_type')}
            {numField('Year From', 'year_from', '1')}
            {numField('Year To', 'year_to', '1')}
            <div /> {/* spacer */}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Physical Dimensions</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {numField('Length (ft)', 'length_feet')}
            {numField('Beam (ft)', 'beam_feet')}
            {numField('Draft (ft)', 'draft_feet')}
            {txtField('Hull Material', 'hull_material')}
            {txtField('Hull Type', 'hull_type')}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Capacities &amp; Layout</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {numField('Fuel (gal)', 'fuel_capacity_gallons')}
            {numField('Water (gal)', 'water_capacity_gallons')}
            <div />
            {numField('Cabins', 'cabins', '1')}
            {numField('Berths', 'berths', '1')}
            {numField('Heads', 'heads', '1')}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Performance</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {numField('Max Speed (kts)', 'max_speed_knots')}
            {numField('Cruising Speed (kts)', 'cruising_speed_knots')}
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
            <textarea rows={2} value={String(form.notes ?? '')} onChange={e => setF('notes', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-400 focus:outline-none resize-none" placeholder="Optional notes…" />
          </div>

          {msg && <p className="text-xs text-teal-700 mb-3">{msg}</p>}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Record'}
            </button>
            {editing && (
              <button onClick={startNew} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                + New
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

