'use client';

import { useState, useEffect, useCallback } from 'react';
import { Globe, AlertCircle, CheckCircle, Play, Pause, Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  const [section, setSection] = useState<'jobs' | 'test'>('jobs');

  // ── Jobs state ──
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [runningJob, setRunningJob] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  // ── Add/Edit job form ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingJob, setEditingJob] = useState<ScraperJob | null>(null);
  const [form, setForm] = useState({ dealer_id: '', salesman_id: '', site_name: '', broker_url: '', schedule_hours: '24', notes: '', enabled: true as boolean });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formTeamMembers, setFormTeamMembers] = useState<TeamMember[]>([]);

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
      setTimeout(loadJobs, 2000);
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
    setShowAddForm(true);
  }

  function handleCancelForm() {
    setShowAddForm(false);
    setEditingJob(null);
    setForm({ dealer_id: '', salesman_id: '', site_name: '', broker_url: '', schedule_hours: '24', notes: '', enabled: true });
    setFormTeamMembers([]);
    setFormError('');
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
    setSingleLoading(true); setSingleError(''); setSingleResult(null); setImportResult(null); setImportError('');
    try {
      const res = await fetch(apiUrl('/scraper/single'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: singleUrl }) });
      const data = await res.json();
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
    setBrokerLoading(true); setBrokerError(''); setBrokerResult(null);
    try {
      const res = await fetch(apiUrl('/scraper/broker'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: brokerUrl, preview_count: 3 }) });
      const data = await res.json();
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
                        {job.notes && <p className="text-xs text-gray-600 italic">Notes: {job.notes}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

