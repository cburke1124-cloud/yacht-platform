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
    outcome: 'created' | 'updated' | 'sold' | 'archived' | 'error';
    listing_id?: number;
    title?: string;
    error?: string;
  }>;
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
}

// ─── Log panel ────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminScraperTab() {
  const [section, setSection] = useState<'jobs' | 'test' | 'review'>('jobs');

  // ── Jobs state ──
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [logOpenJob, setLogOpenJob] = useState<number | null>(null);
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
                                      {entry.listing_id && (
                                        <a
                                          href={`/admin/scraper-review`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 text-[#01BBDC] hover:underline text-[10px]"
                                        >
                                          #{entry.listing_id}
                                        </a>
                                      )}
                                    </div>
                                  ))}
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

