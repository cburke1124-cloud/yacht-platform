'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe, AlertCircle, CheckCircle, Play, Trash2, Plus, RefreshCw,
  Settings, ToggleLeft, ToggleRight, Clock, ChevronDown, ChevronUp, Cpu
} from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface ScraperJob {
  id: number;
  dealer_id: number;
  salesman_id: number | null;
  site_name: string;
  broker_url: string;
  enabled: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed';
  schedule_hours: number;
  next_run_at: string | null;
  last_run_at: string | null;
  listings_found: number;
  listings_created: number;
  listings_updated: number;
  listings_removed: number;
  total_runs: number;
  last_error: string | null;
  notes: string | null;
  completed_at: string | null;
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
}

interface Dealer {
  id: number;
  email: string;
  company_name: string | null;
  first_name: string;
  last_name: string;
}

interface Salesman {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});

const statusColor: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function scheduleLabel(hours: number) {
  if (hours === 6) return 'Every 6 hours';
  if (hours === 12) return 'Every 12 hours';
  if (hours === 24) return 'Daily';
  if (hours === 48) return 'Every 2 days';
  if (hours === 168) return 'Weekly';
  return `Every ${hours}h`;
}

// ── Parsed data card — shown in test results ──────────────────────────────────
const FIELD_GROUPS = [
  { label: 'Basic Info', fields: [
    { key: 'title',         label: 'Title' },
    { key: 'year',          label: 'Year' },
    { key: 'make',          label: 'Make' },
    { key: 'model',         label: 'Model' },
    { key: 'length_feet',   label: 'Length (ft)' },
    { key: 'condition',     label: 'Condition' },
  ]},
  { label: 'Price & Location', fields: [
    { key: 'price',    label: 'Price' },
    { key: 'currency', label: 'Currency' },
    { key: 'city',     label: 'City' },
    { key: 'state',    label: 'State / Province' },
    { key: 'country',  label: 'Country' },
    { key: 'location', label: 'Location (raw)' },
  ]},
  { label: 'Vessel Details', fields: [
    { key: 'hull_material', label: 'Hull Material' },
    { key: 'fuel_type',     label: 'Fuel Type' },
    { key: 'hours',         label: 'Engine Hours' },
    { key: 'engine_count',  label: 'Engine Count' },
  ]},
  { label: 'Agent / Broker', fields: [
    { key: 'detected_agent_name', label: 'Agent Name' },
    { key: 'broker_email',        label: 'Broker Email' },
    { key: 'broker_phone',        label: 'Broker Phone' },
  ]},
];

function ScrapedDataCard({ data }: { data: any }) {
  const [showRaw, setShowRaw] = useState(false);
  const imageCount = (data.images || []).length;
  const firstImage = data.images?.[0];
  const sections = Array.isArray(data.sections) ? data.sections : [];

  return (
    <div className="text-xs text-gray-700 space-y-3">
      {/* Image preview */}
      {firstImage && (
        <div className="flex gap-2 items-start">
          <img src={firstImage} alt="" className="w-20 h-14 object-cover rounded border flex-shrink-0" />
          <p className="text-gray-500 mt-1">{imageCount} image{imageCount !== 1 ? 's' : ''} found</p>
        </div>
      )}
      {!firstImage && imageCount > 0 && (
        <p className="text-gray-500">{imageCount} image{imageCount !== 1 ? 's' : ''} found</p>
      )}

      {/* Grouped fields */}
      {FIELD_GROUPS.map(group => {
        const present = group.fields.filter(f => data[f.key] != null && data[f.key] !== '');
        if (present.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{group.label}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {present.map(f => (
                <div key={f.key} className="flex gap-1 min-w-0">
                  <span className="text-gray-400 shrink-0">{f.label}:</span>
                  <span className="font-medium text-gray-800 truncate">{String(data[f.key])}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Description */}
      {data.description && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
          <p className="text-gray-700 leading-relaxed line-clamp-4">{data.description}</p>
        </div>
      )}

      {/* Named sections */}
      {sections.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Named Sections ({sections.length})</p>
          {sections.map((s: any, i: number) => (
            <div key={i} className="mb-1 p-2 bg-purple-50 border border-purple-100 rounded">
              <span className="font-semibold text-purple-800">{s.name}: </span>
              {typeof s.data === 'object' && s.data != null
                ? Object.entries(s.data).slice(0, 6).map(([k, v]) => (
                    <span key={k} className="mr-2 text-purple-700"><span className="text-gray-500">{k}:</span> {String(v)}</span>
                  ))
                : <span className="text-purple-700">{String(s.data ?? '—')}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Raw JSON toggle */}
      <div>
        <button onClick={() => setShowRaw(r => !r)} className="text-[11px] text-gray-400 hover:text-gray-600 underline">
          {showRaw ? 'Hide' : 'View'} raw JSON
        </button>
        {showRaw && (
          <pre className="mt-1 text-[10px] bg-white p-2 rounded border overflow-auto max-h-56">{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

export default function AdminScraperPage() {
  const [tab, setTab] = useState<'jobs' | 'new' | 'test'>('jobs');

  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);

  const [editingJob, setEditingJob] = useState<ScraperJob | null>(null);
  const [formDealerId, setFormDealerId] = useState('');
  const [formSalesmanId, setFormSalesmanId] = useState('');
  const [formSiteName, setFormSiteName] = useState('');
  const [formBrokerUrl, setFormBrokerUrl] = useState('');
  const [formSchedule, setFormSchedule] = useState('24');
  const [formNotes, setFormNotes] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [jobSubTab, setJobSubTab] = useState<'basic' | 'selectors'>('basic');

  // Field selector template state
  const EMPTY_TEMPLATE: SiteTemplate = {
    listing_link_selector: '', next_page_selector: '',
    title_selector: '', price_selector: '', description_selector: '',
    year_selector: '', make_selector: '', model_selector: '',
    length_selector: '', location_selector: '', images_selector: '',
    agent_name_selector: '', agent_photo_selector: '',
  };
  const [tmpl, setTmpl] = useState<SiteTemplate>(EMPTY_TEMPLATE);
  const [tmplLoading, setTmplLoading] = useState(false);
  const [tmplSaving, setTmplSaving] = useState(false);
  const [tmplMsg, setTmplMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadTemplate(jobId: number) {
    setTmplLoading(true);
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${jobId}/template`), { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setTmpl({ ...EMPTY_TEMPLATE, ...(data.template || {}) });
    } catch (e) { console.error(e); } finally { setTmplLoading(false); }
  }

  async function saveTemplate() {
    if (!editingJob) return;
    setTmplSaving(true); setTmplMsg(null);
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${editingJob.id}/template`), {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(tmpl),
      });
      const data = await res.json();
      if (data.success) setTmplMsg({ ok: true, text: 'Selectors saved!' });
      else setTmplMsg({ ok: false, text: data.detail || 'Save failed' });
    } catch (e: any) { setTmplMsg({ ok: false, text: e.message }); } finally { setTmplSaving(false); }
  }

  const [testTab, setTestTab] = useState<'single' | 'broker'>('single');
  const [singleUrl, setSingleUrl] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [singleError, setSingleError] = useState('');
  const [brokerUrl, setBrokerUrl] = useState('');
  const [brokerLoading, setBrokerLoading] = useState(false);
  const [brokerResult, setBrokerResult] = useState<any>(null);
  const [brokerError, setBrokerError] = useState('');

  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [brokerExpandedPreviews, setBrokerExpandedPreviews] = useState<Set<number>>(new Set());
  const [actionMsg, setActionMsg] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const pollingRef = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  // Poll a single job until it leaves 'running' state, updating live stats
  const pollJob = useCallback((jobId: number) => {
    if (pollingRef.current[jobId]) return; // already polling
    pollingRef.current[jobId] = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/scraper/jobs/${jobId}`), { headers: authHeaders() });
        const data = await res.json();
        if (data.success && data.job) {
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...data.job } : j));
          if (data.job.status !== 'running') {
            clearInterval(pollingRef.current[jobId]);
            delete pollingRef.current[jobId];
            setActionMsg({ id: jobId, msg: data.job.status === 'completed' ? '✓ Completed' : `Status: ${data.job.status}`, ok: data.job.status === 'completed' });
            setTimeout(() => setActionMsg(null), 5000);
          }
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
  }, []);

  // Clean up intervals on unmount
  useEffect(() => {
    const refs = pollingRef.current;
    return () => { Object.values(refs).forEach(clearInterval); };
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await fetch(apiUrl('/scraper/jobs'), { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setJobs(data.jobs);
    } catch (e) { console.error(e); } finally { setJobsLoading(false); }
  }, []);

  const loadDealers = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/users?user_type=dealer&limit=200'), { headers: authHeaders() });
      const data = await res.json();
      setDealers(data.users || data || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadSalesmen = useCallback(async (dealerId: string) => {
    if (!dealerId) { setSalesmen([]); return; }
    try {
      const res = await fetch(apiUrl(`/users?parent_dealer_id=${dealerId}&user_type=salesman&limit=100`), { headers: authHeaders() });
      const data = await res.json();
      setSalesmen(data.users || data || []);
    } catch (e) { setSalesmen([]); }
  }, []);

  useEffect(() => { loadJobs(); loadDealers(); }, [loadJobs, loadDealers]);
  // On mount, start polling any jobs that are already in 'running' state
  useEffect(() => {
    jobs.forEach(j => { if (j.status === 'running') pollJob(j.id); });
  }, [jobs.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadSalesmen(formDealerId); }, [formDealerId, loadSalesmen]);

  function startEdit(job: ScraperJob) {
    setEditingJob(job);
    setFormDealerId(String(job.dealer_id));
    setFormSalesmanId(job.salesman_id ? String(job.salesman_id) : '');
    setFormSiteName(job.site_name || '');
    setFormBrokerUrl(job.broker_url);
    setFormSchedule(String(job.schedule_hours));
    setFormNotes(job.notes || '');
    setFormEnabled(job.enabled);
    setFormError(''); setFormSuccess('');
    setJobSubTab('basic');
    setTmpl(EMPTY_TEMPLATE); setTmplMsg(null);
    loadTemplate(job.id);
    setTab('new');
  }

  function resetForm() {
    setEditingJob(null);
    setFormDealerId(''); setFormSalesmanId(''); setFormSiteName('');
    setFormBrokerUrl(''); setFormSchedule('24'); setFormNotes('');
    setFormEnabled(true); setFormError(''); setFormSuccess('');
    setJobSubTab('basic'); setTmpl(EMPTY_TEMPLATE); setTmplMsg(null);
  }

  async function handleSaveJob() {
    if (!formDealerId) { setFormError('Select a dealer'); return; }
    if (!formBrokerUrl) { setFormError('Enter a broker URL'); return; }
    setFormLoading(true); setFormError(''); setFormSuccess('');
    try {
      const body = {
        dealer_id: Number(formDealerId),
        salesman_id: formSalesmanId ? Number(formSalesmanId) : null,
        site_name: formSiteName || formBrokerUrl,
        broker_url: formBrokerUrl,
        schedule_hours: Number(formSchedule),
        notes: formNotes || null,
        enabled: formEnabled,
      };
      const method = editingJob ? 'PUT' : 'POST';
      const url = editingJob ? apiUrl(`/scraper/jobs/${editingJob.id}`) : apiUrl('/scraper/jobs');
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setFormSuccess(editingJob ? 'Job updated!' : 'Job created!');
        loadJobs();
        setTimeout(() => { resetForm(); setTab('jobs'); }, 1000);
      } else {
        setFormError(data.detail || data.message || 'Save failed');
      }
    } catch (e: any) { setFormError(e.message || 'Network error'); } finally { setFormLoading(false); }
  }

  async function toggleJob(job: ScraperJob) {
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${job.id}/toggle`), { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.success) loadJobs();
    } catch (e) { console.error(e); }
  }

  async function runJobNow(job: ScraperJob) {
    setActionMsg({ id: job.id, msg: 'Starting…', ok: true });
    // Immediately show running state so spinner appears at once
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'running' } : j));
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${job.id}/run`), { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ id: job.id, msg: 'Running…', ok: true });
        pollJob(job.id);
      } else {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'idle' } : j));
        setActionMsg({ id: job.id, msg: data.message || 'Error starting job', ok: false });
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (e: any) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'idle' } : j));
      setActionMsg({ id: job.id, msg: e.message, ok: false });
      setTimeout(() => setActionMsg(null), 4000);
    }
  }

  async function deleteJob(job: ScraperJob) {
    if (!confirm(`Delete job "${job.site_name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(apiUrl(`/scraper/jobs/${job.id}`), { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (data.success) loadJobs();
    } catch (e) { console.error(e); }
  }

  async function handleScrapeSingle() {
    if (!singleUrl) { setSingleError('Enter a URL'); return; }
    setSingleLoading(true); setSingleError(''); setSingleResult(null);
    try {
      const res = await fetch(apiUrl('/scraper/single'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: singleUrl }),
      });
      const data = await res.json();
      if (data.success) setSingleResult(data.data);
      else setSingleError(data.error || data.message || 'Failed');
    } catch (e: any) { setSingleError(e.message); } finally { setSingleLoading(false); }
  }

  async function handleScrapeBroker() {
    if (!brokerUrl) { setBrokerError('Enter a URL'); return; }
    setBrokerLoading(true); setBrokerError(''); setBrokerResult(null);
    try {
      const res = await fetch(apiUrl('/scraper/broker'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: brokerUrl, preview_count: 2 }),
      });
      const data = await res.json();
      if (data.success) setBrokerResult(data);
      else setBrokerError(data.message || 'Failed');
    } catch (e: any) { setBrokerError(e.message); } finally { setBrokerLoading(false); }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b flex items-center gap-3">
        <Globe className="text-blue-600" size={32} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Scraper Manager</h2>
          <p className="text-sm text-gray-600">Schedule automatic listing imports from broker websites</p>
        </div>
      </div>

      <div className="flex border-b px-6">
        {([['jobs', 'Scheduled Jobs'], ['new', editingJob ? 'Edit Job' : 'New Job'], ['test', 'Test Tools']] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { if (key !== 'new') resetForm(); setTab(key as any); }}
            className={`px-5 py-3 font-medium transition-colors ${tab === key ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-6">

        {tab === 'jobs' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">{jobs.length} configured job{jobs.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <button onClick={loadJobs} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
                  <RefreshCw size={14} /> Refresh
                </button>
                <button onClick={() => { resetForm(); setTab('new'); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Plus size={14} /> New Job
                </button>
              </div>
            </div>

            {jobsLoading && <p className="text-gray-500 text-sm py-4">Loading…</p>}
            {!jobsLoading && jobs.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Globe size={40} className="mx-auto mb-2 opacity-30" />
                <p>No scraper jobs configured yet.</p>
                <button onClick={() => setTab('new')} className="mt-3 text-blue-600 text-sm hover:underline">Create your first job →</button>
              </div>
            )}

            <div className="space-y-3">
              {jobs.map((job) => {
                const expanded = expandedJobs.has(job.id);
                const msg = actionMsg?.id === job.id ? actionMsg : null;
                return (
                  <div key={job.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <button onClick={() => toggleJob(job)} title={job.enabled ? 'Disable' : 'Enable'}>
                        {job.enabled
                          ? <ToggleRight size={24} className="text-green-500" />
                          : <ToggleLeft size={24} className="text-gray-400" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 truncate">{job.site_name || job.broker_url}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusColor[job.status] || statusColor.idle}`}>
                            {job.status === 'running' && <RefreshCw size={10} className="animate-spin" />}
                            {job.status}
                          </span>
                          {!job.enabled && <span className="text-xs text-gray-400">(disabled)</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex gap-3 flex-wrap">
                          <span><Clock size={10} className="inline mr-1" />{scheduleLabel(job.schedule_hours)}</span>
                          {job.last_run_at && <span>Last run: {fmt(job.last_run_at)}</span>}
                          {(job.status === 'running' || job.total_runs > 0) && (
                            <span className={job.status === 'running' ? 'text-blue-600 font-medium' : ''}>
                              {job.status === 'running' ? '⟳ ' : ''}
                              Found: {job.listings_found ?? 0}
                              {' · '}Created: {job.listings_created ?? 0}
                              {' · '}Updated: {job.listings_updated ?? 0}
                              {' · '}Archived: {job.listings_removed ?? 0}
                            </span>
                          )}
                        </div>
                        {msg && <p className={`text-xs mt-1 ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.msg}</p>}
                        {job.last_error && !msg && <p className="text-xs text-red-500 mt-1 truncate">Error: {job.last_error}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => runJobNow(job)} disabled={job.status === 'running'} title="Run now" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-40"><Play size={16} /></button>
                        <button onClick={() => startEdit(job)} title="Edit" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Settings size={16} /></button>
                        <button onClick={() => deleteJob(job)} title="Delete" className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        <button onClick={() => setExpandedJobs(prev => { const n = new Set(prev); n.has(job.id) ? n.delete(job.id) : n.add(job.id); return n; })} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-4 pb-4 pt-2 border-t bg-gray-50 text-sm text-gray-700 space-y-1">
                        <p><span className="font-medium">URL:</span> <a href={job.broker_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{job.broker_url}</a></p>
                        <p><span className="font-medium">Dealer ID:</span> {job.dealer_id}{job.salesman_id ? ` · Salesman ID: ${job.salesman_id}` : ''}</p>
                        <p><span className="font-medium">Next run:</span> {fmt(job.next_run_at)}</p>
                        {job.notes && <p><span className="font-medium">Notes:</span> {job.notes}</p>}
                        {job.last_error && <p className="text-red-600"><span className="font-medium">Last error:</span> {job.last_error}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'new' && (
          <div className="max-w-xl space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">{editingJob ? `Edit Job #${editingJob.id}` : 'New Scraper Job'}</h3>

            {/* Sub-tabs shown only when editing an existing job */}
            {editingJob && (
              <div className="flex border-b">
                {(['basic', 'selectors'] as const).map(t => (
                  <button key={t} onClick={() => setJobSubTab(t)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      jobSubTab === t ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-800'
                    }`}>
                    {t === 'basic' ? 'Basic Settings' : '🎯 Field Selectors'}
                  </button>
                ))}
              </div>
            )}

            {/* ── BASIC SETTINGS ── */}
            {jobSubTab === 'basic' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dealer *</label>
                  <select value={formDealerId} onChange={e => setFormDealerId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select dealer —</option>
                    {dealers.map(d => <option key={d.id} value={d.id}>{d.company_name || `${d.first_name} ${d.last_name}`} (#{d.id})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salesman <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select value={formSalesmanId} onChange={e => setFormSalesmanId(e.target.value)} disabled={!formDealerId} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                    <option value="">— No specific salesman —</option>
                    {salesmen.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} (#{s.id})</option>)}
                  </select>
                  {!formDealerId && <p className="text-xs text-gray-400 mt-1">Select a dealer first</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
                  <input type="text" value={formSiteName} onChange={e => setFormSiteName(e.target.value)} placeholder="e.g. Suntex Marina Fleet" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Broker Inventory URL *</label>
                  <input type="url" value={formBrokerUrl} onChange={e => setFormBrokerUrl(e.target.value)} placeholder="https://broker-website.com/yachts-for-sale" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">The inventory listing page — the scraper crawls it to discover individual listing URLs.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sync Schedule</label>
                  <select value={formSchedule} onChange={e => setFormSchedule(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="6">Every 6 hours</option>
                    <option value="12">Every 12 hours</option>
                    <option value="24">Daily (every 24 hours)</option>
                    <option value="48">Every 2 days</option>
                    <option value="168">Weekly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(internal)</span></label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="e.g. Permission granted 2024-01, contact: john@broker.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => setFormEnabled(v => !v)}>
                    {formEnabled ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} className="text-gray-400" />}
                  </button>
                  <span className="text-sm text-gray-700">{formEnabled ? 'Enabled — will run on schedule' : 'Disabled — will not run automatically'}</span>
                </div>

                {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-800"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {formError}</div>}
                {formSuccess && <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-sm text-green-800"><CheckCircle size={16} className="shrink-0 mt-0.5" /> {formSuccess}</div>}

                <div className="flex gap-3">
                  <button onClick={handleSaveJob} disabled={formLoading} className="flex-1 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium">
                    {formLoading ? 'Saving…' : editingJob ? 'Save Changes' : 'Create Job'}
                  </button>
                  <button onClick={() => { resetForm(); setTab('jobs'); }} className="px-5 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
                </div>
              </div>
            )}

            {/* ── FIELD SELECTORS (edit mode only) ── */}
            {jobSubTab === 'selectors' && editingJob && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                  <strong>How it works:</strong> Enter a CSS selector for each field you want the scraper to extract directly from the broker’s page. Leave fields blank to let the scraper auto-detect them. Configure once per broker — the selectors are reused on every sync.
                  <br /><span className="text-xs opacity-75 mt-1 block">Example selectors: <code>h1.listing-title</code>, <code>.price-wrapper span</code>, <code>.gallery img</code></span>
                </div>

                {tmplLoading && <p className="text-sm text-gray-400">Loading saved selectors…</p>}

                {([
                  { group: 'Discovery', fields: [
                    { key: 'listing_link_selector', label: 'Listing Link Selector', hint: 'CSS to find <a> tags linking to individual listings on the inventory page (e.g. a.listing-card, .boat-item a)' },
                    { key: 'next_page_selector',    label: 'Next Page Selector',    hint: 'CSS to find the “Next” pagination link, if any (e.g. a.next-page, li.next > a)' },
                  ]},
                  { group: 'Listing Details', fields: [
                    { key: 'title_selector',       label: 'Title',       hint: 'Boat name / listing headline (e.g. h1.listing-title)' },
                    { key: 'price_selector',       label: 'Price',       hint: 'Asking price element (e.g. .asking-price, span.price)' },
                    { key: 'description_selector', label: 'Description', hint: 'Main listing description text block' },
                    { key: 'year_selector',        label: 'Year',        hint: 'Model year' },
                    { key: 'make_selector',        label: 'Make',        hint: 'Manufacturer / brand' },
                    { key: 'model_selector',       label: 'Model',       hint: 'Model name' },
                    { key: 'length_selector',      label: 'Length',      hint: 'LOA / length overall' },
                    { key: 'location_selector',    label: 'Location',    hint: 'Marina / city / port' },
                    { key: 'images_selector',      label: 'Gallery Images', hint: 'CSS matching <img> tags in the photo gallery (e.g. .gallery img, .swiper-slide img)' },
                  ]},
                  { group: 'Agent / Broker', fields: [
                    { key: 'agent_name_selector',  label: 'Agent Name',  hint: 'Agent or broker name text' },
                    { key: 'agent_photo_selector', label: 'Agent Photo', hint: 'Agent headshot <img> tag' },
                  ]},
                ] as { group: string; fields: { key: string; label: string; hint: string }[] }[]).map(({ group, fields }) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</p>
                    <div className="space-y-3">
                      {fields.map(({ key, label, hint }) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700 mb-0.5">{label}</label>
                          <input
                            type="text"
                            value={(tmpl as any)[key] || ''}
                            onChange={e => setTmpl(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder="CSS selector…"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {tmplMsg && (
                  <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
                    tmplMsg.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    {tmplMsg.ok ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                    {tmplMsg.text}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={saveTemplate} disabled={tmplSaving}
                    className="flex-1 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2">
                    <Cpu size={16} /> {tmplSaving ? 'Saving selectors…' : 'Save Field Selectors'}
                  </button>
                  <button onClick={() => { resetForm(); setTab('jobs'); }} className="px-5 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Done</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'test' && (
          <div>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900">
              ⚠️ Test tools only — nothing is saved to the database.
            </div>

            <div className="flex border-b mb-5">
              {(['single', 'broker'] as const).map(t => (
                <button key={t} onClick={() => setTestTab(t)} className={`px-5 py-2 font-medium transition-colors capitalize ${testTab === t ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
                  {t === 'single' ? 'Single Listing' : 'Broker Inventory'}
                </button>
              ))}
            </div>

            {testTab === 'single' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Listing URL</label>
                <input type="url" value={singleUrl} onChange={e => setSingleUrl(e.target.value)} placeholder="https://broker-site.com/listings/yacht-123" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                {singleError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-800"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {singleError}</div>}
                {singleResult && (
                  <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <div className="flex items-center gap-2 mb-3 text-green-800 font-medium"><CheckCircle size={16} /> Scraped successfully</div>
                    <ScrapedDataCard data={singleResult} />
                  </div>
                )}
                <button onClick={handleScrapeSingle} disabled={singleLoading || !singleUrl} className="mt-4 w-full px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium">
                  {singleLoading ? 'Scraping…' : '🔍 Scrape Listing'}
                </button>
              </div>
            )}

            {testTab === 'broker' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Broker Inventory Page URL</label>
                <input type="url" value={brokerUrl} onChange={e => setBrokerUrl(e.target.value)} placeholder="https://broker-site.com/inventory" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-500 mt-1">Crawls the page, discovers listing URLs, and previews the first 2.</p>
                {brokerError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-800"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {brokerError}</div>}
                {brokerResult && (
                  <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg text-sm space-y-3">
                    <div className="flex items-center gap-2 text-green-800 font-medium"><CheckCircle size={16} /> Found {brokerResult.total_found} listing URLs</div>
                    {brokerResult.previews?.map((p: any, i: number) => {
                      const expanded = brokerExpandedPreviews.has(i);
                      return (
                        <div key={i} className="bg-white p-3 rounded border text-gray-700">
                          <a href={p.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 hover:underline truncate block mb-2">{p.url}</a>
                          {p.data ? (
                            <>
                              {/* Summary row always visible */}
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mb-2">
                                {(['title', 'make', 'model', 'year', 'price'] as const).map(f => p.data[f] ? (
                                  <span key={f}><span className="text-gray-400">{f}:</span> <span className="font-medium">{String(p.data[f])}</span></span>
                                ) : null)}
                                {p.data.images?.length > 0 && (
                                  <span><span className="text-gray-400">images:</span> <span className="font-medium">{p.data.images.length}</span></span>
                                )}
                              </div>
                              {/* Expand toggle */}
                              <button
                                onClick={() => setBrokerExpandedPreviews(prev => {
                                  const next = new Set(prev);
                                  next.has(i) ? next.delete(i) : next.add(i);
                                  return next;
                                })}
                                className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {expanded ? 'Hide' : 'Show all'} parsed fields
                              </button>
                              {expanded && (
                                <div className="mt-2 pt-2 border-t">
                                  <ScrapedDataCard data={p.data} />
                                </div>
                              )}
                            </>
                          ) : <p className="text-xs text-red-500">{p.error || 'Could not scrape'}</p>}
                        </div>
                      );
                    })}
                    <details>
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">All {brokerResult.all_urls?.length} URLs</summary>
                      <ul className="mt-2 text-xs space-y-1 max-h-48 overflow-auto">
                        {brokerResult.all_urls?.map((u: string) => <li key={u}><a href={u} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block">{u}</a></li>)}
                      </ul>
                    </details>
                  </div>
                )}
                <button onClick={handleScrapeBroker} disabled={brokerLoading || !brokerUrl} className="mt-4 w-full px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium">
                  {brokerLoading ? 'Crawling inventory…' : '📦 Discover Listings'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
