'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Search, Anchor, Eye, Trash2,
  CheckCircle, XCircle, Users, X,
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

type Status = 'active' | 'draft' | 'inactive';

interface CharterListing {
  id: number;
  title: string;
  vessel_name: string;
  day_rate?: number;
  week_rate?: number;
  max_guests?: number;
  status: Status;
  images: string[];
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'inactive', label: 'Inactive' },
];

const SC: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  draft: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50',
  inactive: 'bg-gray-100 text-gray-500',
};

const SL: Record<string, string> = {
  active: 'Active', draft: 'Draft', inactive: 'Inactive',
};

const EMPTY_FORM = {
  title: '', vessel_name: '', day_rate: '', week_rate: '', max_guests: '', description: '',
};

export default function DashboardV2CharterPage() {
  const [charters, setCharters] = useState<CharterListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCharters = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    fetch(apiUrl('/charter/my'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCharters(Array.isArray(d) ? d : []); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCharters(); }, []);

  const filtered = charters.filter(c => {
    if (tab !== 'all' && c.status !== tab) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByStatus = (s: string) => s === 'all' ? charters.length : charters.filter(c => c.status === s).length;
  const activeCount = charters.filter(c => c.status === 'active').length;

  async function toggleStatus(c: CharterListing) {
    const token = localStorage.getItem('token');
    if (!token) return;
    const newStatus = c.status === 'active' ? 'inactive' : 'active';
    setTogglingId(c.id);
    const res = await fetch(apiUrl(`/charter/${c.id}`), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) setCharters(prev => prev.map(item => item.id === c.id ? { ...item, status: newStatus } : item));
    setTogglingId(null);
  }

  async function deleteCharter(id: number) {
    if (!confirm('Delete this charter listing? This cannot be undone.')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setDeletingId(id);
    const res = await fetch(apiUrl(`/charter/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setCharters(prev => prev.filter(c => c.id !== id));
    setDeletingId(null);
  }

  async function createCharter(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim() || !form.vessel_name.trim()) {
      setFormError('Title and vessel name are required');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/charter'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          vessel_name: form.vessel_name,
          day_rate: form.day_rate ? Number(form.day_rate) : undefined,
          week_rate: form.week_rate ? Number(form.week_rate) : undefined,
          max_guests: form.max_guests ? Number(form.max_guests) : undefined,
          description: form.description || undefined,
          status: 'draft',
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm(EMPTY_FORM);
        loadCharters();
      } else {
        const err = await res.json().catch(() => null);
        setFormError(err?.detail || 'Failed to create charter listing');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-gray-900">Charter Listings</h1>
            <span className="bg-[#10214F]/[0.08] text-[#10214F] text-xs font-bold px-2.5 py-0.5 rounded-full">
              {activeCount} active
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{charters.length} total charter listings</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex-shrink-0 flex items-center gap-2 bg-[#10214F] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#1a3570] active:scale-95 transition-all"
        >
          <Plus size={15} strokeWidth={2.5} /> New Charter
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1 border border-gray-200/60">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none ${
                tab === t.key ? 'bg-[#10214F] text-white' : 'bg-gray-200/80 text-gray-500'
              }`}>
                {countByStatus(t.key)}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search charter listings…"
            className="h-9 pl-8 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 w-56 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-16 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="w-16 h-6 bg-gray-100 rounded-full hidden sm:block" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[#10214F]/5 flex items-center justify-center">
              <Anchor size={24} className="text-[#10214F]/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-600">{search ? 'No results found' : `No ${tab === 'all' ? '' : tab} charter listings`}</p>
              <p className="text-xs text-gray-400 mt-0.5">{search ? 'Try a different search term' : 'Add your first charter listing to get started'}</p>
            </div>
            {!search && (
              <button onClick={() => setShowCreate(true)} className="text-xs font-semibold text-[#10214F] bg-[#10214F]/5 hover:bg-[#10214F]/10 px-4 py-2 rounded-xl transition-colors">+ Add charter listing</button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_100px_90px_90px_100px] gap-4 items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Charter</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Day Rate</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Guests</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</p>
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map(charter => (
                <div key={charter.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/80 transition-colors group">
                  {/* Thumbnail */}
                  <div className="w-16 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-100">
                    <img src={mediaUrl(charter.images?.[0])} alt="" onError={onImgError} className="w-full h-full object-cover" />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{charter.title}</p>
                    <p className="text-xs text-gray-400 truncate">{charter.vessel_name}</p>
                  </div>
                  {/* Status */}
                  <div className="hidden sm:flex w-[100px] justify-center flex-shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SC[charter.status] ?? SC.draft}`}>
                      {SL[charter.status] ?? charter.status}
                    </span>
                  </div>
                  {/* Day rate */}
                  <div className="hidden sm:block w-[90px] text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-800">{charter.day_rate != null ? `$${charter.day_rate.toLocaleString()}` : '—'}</p>
                  </div>
                  {/* Guests */}
                  <div className="hidden sm:block w-[90px] text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-800 flex items-center justify-end gap-1"><Users size={12} className="text-gray-400" />{charter.max_guests ?? '—'}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={`/charter/${charter.id}`} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#10214F]/8 text-gray-400 hover:text-[#10214F] transition-colors" title="View public page">
                      <Eye size={14} />
                    </a>
                    <button onClick={() => toggleStatus(charter)} disabled={togglingId === charter.id} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors" title={charter.status === 'active' ? 'Deactivate' : 'Activate'}>
                      {charter.status === 'active' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    </button>
                    <button onClick={() => deleteCharter(charter.id)} disabled={deletingId === charter.id} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">New Charter Listing</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={createCharter} className="space-y-3">
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Vessel Name *</label>
                <input value={form.vessel_name} onChange={e => setForm({ ...form, vessel_name: e.target.value })} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Day Rate</label>
                  <input type="number" min="0" value={form.day_rate} onChange={e => setForm({ ...form, day_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Week Rate</label>
                  <input type="number" min="0" value={form.week_rate} onChange={e => setForm({ ...form, week_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Max Guests</label>
                  <input type="number" min="0" value={form.max_guests} onChange={e => setForm({ ...form, max_guests: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 outline-none resize-none" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-[#10214F] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#1a3570] active:scale-95 transition-all disabled:opacity-50">
                {submitting ? 'Creating…' : 'Create Charter Listing'}
              </button>
              <p className="text-xs text-gray-400 text-center">Created as a draft — activate it from the table once ready.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
