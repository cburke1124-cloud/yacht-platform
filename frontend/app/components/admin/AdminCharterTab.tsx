'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, AlertCircle, ExternalLink, Anchor } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const authHeaders = () => ({
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});
const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  ...authHeaders(),
});

interface CharterListing {
  id: number;
  title: string;
  vessel_name: string;
  slug?: string;
  boat_type?: string;
  home_port_city?: string;
  home_port_state?: string;
  home_port_country?: string;
  max_guests?: number;
  crew_included: boolean;
  day_rate?: number;
  week_rate?: number;
  currency: string;
  charter_company_name?: string;
  status: string;
  created_at?: string;
  // edit form extras
  make?: string;
  model?: string;
  year?: number;
  length_feet?: number;
  description?: string;
  booking_url?: string;
  charter_company_email?: string;
  charter_company_phone?: string;
  charter_company_website?: string;
  amenities?: string[];
  min_charter_days?: number;
}

function Toast({ ok, msg, onClose }: { ok: boolean; msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {ok ? <Check size={15} /> : <AlertCircle size={15} />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

const BOAT_TYPES = [
  'Motor Yacht', 'Mega Yacht', 'Trawler', 'Express Cruiser', 'Sport Fisher',
  'Sailing Yacht', 'Catamaran', 'Sloop', 'Power Catamaran', 'Pontoon',
  'Center Console', 'Deck Boat', 'Houseboat', 'Other',
];

function CharterModal({ initial, onSave, onClose }: {
  initial?: CharterListing;
  onSave: (data: Partial<CharterListing>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: Partial<CharterListing> = {
    title: '', vessel_name: '', boat_type: '', status: 'active', crew_included: true, currency: 'USD',
    charter_company_name: '', charter_company_email: '', charter_company_phone: '',
    home_port_city: '', home_port_state: '', home_port_country: 'USA',
    description: '', booking_url: '',
  };
  const [form, setForm] = useState<Partial<CharterListing>>(initial ?? blank);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof CharterListing, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F] focus:border-transparent';
  const lbl = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[#10214F]">{initial ? 'Edit Charter Listing' : 'New Charter Listing'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Listing Title *</label>
              <input required className={inp} value={form.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="e.g. 60' Motor Yacht Charter — Miami" />
            </div>
            <div>
              <label className={lbl}>Vessel Name *</label>
              <input required className={inp} value={form.vessel_name ?? ''} onChange={e => set('vessel_name', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Boat Type</label>
              <select className={inp} value={form.boat_type ?? ''} onChange={e => set('boat_type', e.target.value)}>
                <option value="">— Select —</option>
                {BOAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Make</label>
              <input className={inp} value={form.make ?? ''} onChange={e => set('make', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Model</label>
              <input className={inp} value={form.model ?? ''} onChange={e => set('model', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Year</label>
              <input type="number" className={inp} value={form.year ?? ''} onChange={e => set('year', e.target.value ? Number(e.target.value) : undefined)} placeholder="2020" />
            </div>
            <div>
              <label className={lbl}>Length (ft)</label>
              <input type="number" className={inp} value={form.length_feet ?? ''} onChange={e => set('length_feet', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Home Port</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>City</label>
                <input className={inp} value={form.home_port_city ?? ''} onChange={e => set('home_port_city', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>State</label>
                <input className={inp} value={form.home_port_state ?? ''} onChange={e => set('home_port_state', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Country</label>
                <input className={inp} value={form.home_port_country ?? ''} onChange={e => set('home_port_country', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Charter specs */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Charter Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Max Guests</label>
                <input type="number" className={inp} value={form.max_guests ?? ''} onChange={e => set('max_guests', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className={lbl}>Min Charter Days</label>
                <input type="number" className={inp} value={form.min_charter_days ?? ''} onChange={e => set('min_charter_days', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="crew" checked={form.crew_included ?? true} onChange={e => set('crew_included', e.target.checked)} className="w-4 h-4 accent-[#10214F]" />
                <label htmlFor="crew" className="text-sm text-gray-700">Crew Included</label>
              </div>
            </div>
          </div>

          {/* Rates */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rates (USD)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Half Day Rate</label>
                <input type="number" className={inp} value={form.half_day_rate ?? ''} onChange={e => set('half_day_rate', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className={lbl}>Day Rate</label>
                <input type="number" className={inp} value={form.day_rate ?? ''} onChange={e => set('day_rate', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className={lbl}>Week Rate</label>
                <input type="number" className={inp} value={form.week_rate ?? ''} onChange={e => set('week_rate', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Charter Company</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Company Name</label>
                <input className={inp} value={form.charter_company_name ?? ''} onChange={e => set('charter_company_name', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" className={inp} value={form.charter_company_email ?? ''} onChange={e => set('charter_company_email', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input className={inp} value={form.charter_company_phone ?? ''} onChange={e => set('charter_company_phone', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Website</label>
                <input type="url" className={inp} value={form.charter_company_website ?? ''} onChange={e => set('charter_company_website', e.target.value)} placeholder="https://" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Booking URL (external)</label>
                <input type="url" className={inp} value={form.booking_url ?? ''} onChange={e => set('booking_url', e.target.value)} placeholder="https://" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description</label>
            <textarea rows={4} className={inp + ' resize-none'} value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Status */}
          <div>
            <label className={lbl}>Status</label>
            <select className={inp} value={form.status ?? 'active'} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-[#10214F] text-white rounded-lg text-sm font-medium hover:bg-[#1a3570] disabled:opacity-50">
              {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCharterTab() {
  const [charters, setCharters] = useState<CharterListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState<'create' | CharterListing | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('q', search);
      // Admin fetches all statuses — we filter client-side by statusFilter
      const res = await fetch(apiUrl(`/charter/admin/all?${params}`), { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const all: CharterListing[] = data.results ?? data;
      setTotal(data.total ?? all.length);
      setCharters(all);
    } catch {
      // Fallback to public endpoint if admin endpoint not available yet
      try {
        const res = await fetch(apiUrl(`/charter?page=${page}&limit=${LIMIT}`));
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTotal(data.total ?? 0);
        setCharters(data.results ?? []);
      } catch {
        setCharters([]);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === 'all' ? charters : charters.filter(c => c.status === statusFilter);

  const handleSave = async (data: Partial<CharterListing>) => {
    try {
      const isEdit = typeof modal === 'object' && modal !== null;
      const url = isEdit ? apiUrl(`/charter/${(modal as CharterListing).id}`) : apiUrl('/charter');
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      setToast({ ok: true, msg: isEdit ? 'Charter updated' : 'Charter created' });
      setModal(null);
      load();
    } catch (e) {
      setToast({ ok: false, msg: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this charter listing?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(apiUrl(`/charter/${id}`), { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      setToast({ ok: true, msg: 'Deleted' });
      load();
    } catch {
      setToast({ ok: false, msg: 'Delete failed' });
    } finally {
      setDeletingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      draft: 'bg-yellow-100 text-yellow-700',
      inactive: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  const fmtRate = (c: CharterListing) => {
    if (!c.day_rate && !c.week_rate) return '—';
    const sym = c.currency === 'USD' ? '$' : c.currency;
    if (c.day_rate) return `${sym}${c.day_rate.toLocaleString()}/day`;
    return `${sym}${c.week_rate!.toLocaleString()}/wk`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Charter Listings</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-[#10214F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a3570] transition-colors"
        >
          <Plus size={15} /> New Charter
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search charters…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F] focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#10214F] mr-3" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Anchor className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No charter listings found.</p>
            <button onClick={() => setModal('create')} className="mt-3 text-sm text-[#10214F] hover:underline">Add the first one</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Title', 'Type', 'Location', 'Guests', 'Rate', 'Company', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[200px]">{c.title}</div>
                      <div className="text-xs text-gray-400">{c.vessel_name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.boat_type || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {[c.home_port_city, c.home_port_state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.max_guests ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{fmtRate(c)}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[140px]">{c.charter_company_name || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(c.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a href={`/charter/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#10214F]" title="View listing">
                          <ExternalLink size={15} />
                        </a>
                        <button onClick={() => setModal(c)} className="text-gray-400 hover:text-[#10214F]" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center gap-3 justify-center text-sm text-gray-600">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span>Page {page} of {Math.ceil(total / LIMIT)}</span>
          <button disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}

      {modal && (
        <CharterModal
          initial={modal === 'create' ? undefined : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {toast && <Toast ok={toast.ok} msg={toast.msg} onClose={() => setToast(null)} />}
    </div>
  );
}
