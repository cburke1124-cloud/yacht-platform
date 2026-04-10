'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle, XCircle, Clock, User, ExternalLink, RefreshCw,
  AlertTriangle, Pencil, Save, X, Building2, ChevronDown, ChevronUp,
  Trash2, Eye,
} from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface Salesperson {
  id: number;
  name: string;
  email: string;
}

interface DealerInfo {
  id: number | null;
  name: string | null;
  email: string | null;
  company_name: string | null;
}

interface ScrapedListing {
  id: number;
  title: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  currency: string;
  length_feet: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string;
  source_url: string | null;
  assigned_salesman_id: number | null;
  detected_agent_name: string | null;
  images: string[];
  created_at: string | null;
  dealer: DealerInfo;
  salespeople: Salesperson[];
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});

function fmt(val: number | null) {
  if (!val) return '—';
  return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function ScraperReviewPage() {
  const router = useRouter();
  const [listings, setListings] = useState<ScrapedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('awaiting_review');
  const [dealerFilter, setDealerFilter] = useState('');
  const [dealers, setDealers] = useState<{ id: number; name: string; count: number }[]>([]);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editSalesmanId, setEditSalesmanId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/admin/scraper/listings?status=${statusFilter}`;
      if (dealerFilter) url += `&dealer_id=${dealerFilter}`;
      const res = await fetch(apiUrl(url), { headers: authHeaders() });
      const data = await res.json();
      setListings(data.listings || []);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dealerFilter]);

  const loadDealers = useCallback(async (status: string) => {
    try {
      // Fetch all accounts for this status (no dealer filter) to compute per-account counts
      const [usersRes, countsRes] = await Promise.all([
        fetch(apiUrl('/admin/users?user_type=dealer&limit=500'), { headers: authHeaders() }),
        fetch(apiUrl(`/admin/scraper/listings?status=${status}`), { headers: authHeaders() }),
      ]);
      const usersData = await usersRes.json();
      const countsData = await countsRes.json();
      const allListings: ScrapedListing[] = countsData.listings || [];
      const countMap: Record<number, number> = {};
      for (const l of allListings) {
        if (l.dealer.id != null) countMap[l.dealer.id] = (countMap[l.dealer.id] || 0) + 1;
      }
      const list = (usersData.users || usersData || []) as any[];
      const populated = list
        .map((d: any) => ({
          id: d.id,
          name: d.dealer_profile?.company_name || d.company_name ||
            `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.email,
          count: countMap[d.id] || 0,
        }))
        .filter(d => d.count > 0); // only show accounts that have listings in this status
      setDealers(populated);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDealers(statusFilter); }, [statusFilter, loadDealers]);

  async function patch(id: number, updates: Record<string, any>) {
    setSaving(s => ({ ...s, [id]: true }));
    try {
      await fetch(apiUrl(`/admin/scraper/listings/${id}`), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      await load();
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
      setEditingId(null);
    }
  }

  function startEdit(l: ScrapedListing) {
    setEditingId(l.id);
    setEditTitle(l.title || '');
    setEditPrice(l.price != null ? String(l.price) : '');
    setEditSalesmanId(l.assigned_salesman_id != null ? String(l.assigned_salesman_id) : '');
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(l: ScrapedListing) {
    const updates: Record<string, any> = {};
    if (editTitle !== (l.title || '')) updates.title = editTitle;
    const priceNum = editPrice ? parseFloat(editPrice) : null;
    if (priceNum !== l.price) updates.price = priceNum;
    const spId = editSalesmanId ? parseInt(editSalesmanId) : null;
    if (spId !== l.assigned_salesman_id) updates.assigned_salesman_id = spId;
    if (Object.keys(updates).length > 0) {
      await patch(l.id, updates);
    } else {
      setEditingId(null);
    }
  }

  async function bulkDelete() {
    if (!selectedIds.size || !confirm(`Permanently delete ${selectedIds.size} listing(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        [...selectedIds].map(id =>
          fetch(apiUrl(`/listings/${id}`), { method: 'DELETE', headers: authHeaders() })
        )
      );
      setSelectedIds(new Set());
      await load();
    } finally {
      setBulkDeleting(false);
    }
  }

  const statusCounts = listings.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="text-[#10214F]" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-[#10214F]">Scraped Listing Review</h2>
            <p className="text-sm text-gray-600">
              Review and approve scraped listings before they go live
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#10214F] text-white rounded-lg hover:bg-[#1a3470] transition-colors text-sm font-medium disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Account filter + status tabs */}
      <div className="px-6 pt-4 pb-3 border-b space-y-3">
        {/* Dealer / account filter */}
        <div className="flex items-center gap-3">
          <Building2 size={15} className="text-gray-400 shrink-0" />
          <select
            value={dealerFilter}
            onChange={e => setDealerFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-[#01BBDC] focus:border-[#01BBDC]"
          >
            <option value="">All Accounts</option>
            {dealers.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.count})
              </option>
            ))}
          </select>
          {dealerFilter && (
            <button
              onClick={() => setDealerFilter('')}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'awaiting_review', label: 'Awaiting Review', activeClass: 'bg-[#10214F] text-white' },
            { key: 'active',          label: 'Active',           activeClass: 'bg-green-600 text-white' },
            { key: 'draft',           label: 'Draft',            activeClass: 'bg-gray-600 text-white' },
            { key: 'sold',            label: 'Sold',             activeClass: 'bg-amber-600 text-white' },
            { key: 'archived',        label: 'Archived',         activeClass: 'bg-rose-700 text-white' },
          ] as const).map(({ key: s, label, activeClass }) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                statusFilter === s ? activeClass : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
              {statusCounts[s] != null && <span className="ml-1.5 opacity-80">({statusCounts[s]})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Listing table */}
      <div className="p-4">
        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading…</div>
        ) : listings.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
            No listings in this queue.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Bulk action bar */}
            <div className="flex items-center justify-between px-1 py-1">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.size === listings.length && listings.length > 0}
                  onChange={e =>
                    setSelectedIds(e.target.checked ? new Set(listings.map(l => l.id)) : new Set())
                  }
                />
                Select all ({listings.length})
              </label>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
                  <button
                    onClick={bulkDelete}
                    disabled={bulkDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                  >
                    <Trash2 size={13} /> {bulkDeleting ? 'Deleting…' : 'Delete Selected'}
                  </button>
                </div>
              )}
            </div>
            {listings.map(l => {
              const isEditing = editingId === l.id;
              const isSaving = saving[l.id];
              const isExpanded = expandedId === l.id;
              return (
                <div
                  key={l.id}
                  className="border border-gray-200 rounded-xl p-4 hover:border-[#01BBDC]/60 transition-colors"
                >
                  {/* Top row: thumbnail + info + actions */}
                  <div className="flex gap-4 items-start">
                    {/* Row checkbox */}
                    <input
                      type="checkbox"
                      className="mt-1 flex-shrink-0 cursor-pointer"
                      checked={selectedIds.has(l.id)}
                      onChange={e => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(l.id) : next.delete(l.id);
                          return next;
                        });
                      }}
                    />
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-gray-100">
                      {l.images[0] ? (
                        <img src={l.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-2 py-1 border border-[#01BBDC] rounded text-sm font-semibold text-[#10214F] mb-1"
                        />
                      ) : (
                        <p className="font-semibold text-[#10214F] truncate">
                          {l.title || <span className="italic text-gray-400">No title</span>}
                        </p>
                      )}

                      <p className="text-xs text-gray-500">
                        {[l.year, l.make, l.model].filter(Boolean).join(' ')}
                        {l.length_feet ? ` · ${l.length_feet}ft` : ''}
                        {(l.city || l.state || l.country)
                          ? ` · ${[l.city, l.state, l.country].filter(Boolean).join(', ')}`
                          : ''}
                      </p>

                      {/* Price row */}
                      <div className="flex items-center gap-3 mt-1">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            placeholder="Price"
                            className="w-36 px-2 py-1 border border-[#01BBDC] rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm font-bold text-[#01BBDC]">
                            {l.price ? `${l.currency} ${fmt(l.price)}` : '—'}
                          </span>
                        )}

                        {/* Dealer */}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                          {l.dealer.company_name || l.dealer.name || l.dealer.email || '—'}
                        </span>

                        {/* Source URL */}
                        {l.source_url && (
                          <a
                            href={l.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#01BBDC] hover:underline flex items-center gap-1"
                          >
                            Source <ExternalLink size={11} />
                          </a>
                        )}
                      </div>

                      {/* Detected agent name */}
                      {l.detected_agent_name && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 w-fit">
                          <AlertTriangle size={11} />
                          Detected agent: <strong>{l.detected_agent_name}</strong>
                          {!l.assigned_salesman_id && ' — unmatched, assign below'}
                        </div>
                      )}

                      {/* Salesperson assignment */}
                      <div className="mt-2 flex items-center gap-2">
                        <User size={13} className="text-gray-400 flex-shrink-0" />
                        {isEditing ? (
                          <select
                            value={editSalesmanId}
                            onChange={e => setEditSalesmanId(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-[#01BBDC]"
                          >
                            <option value="">— No salesperson —</option>
                            {l.salespeople.map(sp => (
                              <option key={sp.id} value={sp.id}>{sp.name} ({sp.email})</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-600">
                            {l.assigned_salesman_id
                              ? (l.salespeople.find(s => s.id === l.assigned_salesman_id)?.name
                                ?? `Salesperson #${l.assigned_salesman_id}`)
                              : <span className="italic text-gray-400">No salesperson assigned</span>}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(l)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10214F] text-white rounded-lg text-xs font-medium hover:bg-[#1a3470] disabled:opacity-60"
                          >
                            <Save size={13} /> Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
                          >
                            <X size={13} /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Status change — works for all statuses incl. sold & archived */}
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5 ml-0.5">Change Status</label>
                            <select
                              value={l.status}
                              onChange={e => patch(l.id, { status: e.target.value })}
                              disabled={isSaving}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:ring-1 focus:ring-[#01BBDC] disabled:opacity-60 w-full cursor-pointer"
                            >
                              <option value="awaiting_review">Awaiting Review</option>
                              <option value="active">Active</option>
                              <option value="draft">Draft</option>
                              <option value="sold">Sold</option>
                              <option value="archived">Archived</option>
                            </select>
                          </div>
                          <button
                            onClick={() => startEdit(l)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#01BBDC]/10 text-[#10214F] rounded-lg text-xs font-medium hover:bg-[#01BBDC]/20"
                          >
                            <Pencil size={13} /> Quick Edit
                          </button>
                          <a
                            href={`/listings/${l.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 border border-indigo-200"
                          >
                            <Eye size={13} /> Preview
                          </a>
                          <button
                            onClick={() => router.push(`/admin/listings/${l.id}/edit`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900"
                          >
                            <Pencil size={13} /> Full Edit
                          </button>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : l.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 border border-gray-200"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            Details
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expand detail panel */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-700 space-y-2">
                      {/* All images */}
                      {l.images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {l.images.map((img, i) => (
                            <img key={i} src={img} alt="" className="w-20 h-14 object-cover rounded-md border border-gray-200" />
                          ))}
                        </div>
                      )}
                      {/* Spec fields */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1">
                        {l.make && <span><span className="text-gray-400">Make:</span> {l.make}</span>}
                        {l.model && <span><span className="text-gray-400">Model:</span> {l.model}</span>}
                        {l.year && <span><span className="text-gray-400">Year:</span> {l.year}</span>}
                        {l.length_feet && <span><span className="text-gray-400">Length:</span> {l.length_feet} ft</span>}
                        {l.city && <span><span className="text-gray-400">City:</span> {l.city}</span>}
                        {l.state && <span><span className="text-gray-400">State/Prov:</span> {l.state}</span>}
                        {l.country && <span><span className="text-gray-400">Country:</span> {l.country}</span>}
                        {(l as any).hull_material && <span><span className="text-gray-400">Hull:</span> {(l as any).hull_material}</span>}
                        {(l as any).fuel_type && <span><span className="text-gray-400">Fuel:</span> {(l as any).fuel_type}</span>}
                        {(l as any).hours != null && <span><span className="text-gray-400">Hours:</span> {(l as any).hours}</span>}
                        {(l as any).condition && <span><span className="text-gray-400">Condition:</span> {(l as any).condition}</span>}
                        {l.currency && <span><span className="text-gray-400">Currency:</span> {l.currency}</span>}
                      </div>
                      {/* Description */}
                      {(l as any).description && (
                        <div>
                          <span className="text-gray-400 font-medium">Description:</span>
                          <p className="mt-0.5 text-gray-600 whitespace-pre-wrap line-clamp-6">{(l as any).description}</p>
                        </div>
                      )}
                      {/* Source URL */}
                      {l.source_url && (
                        <div>
                          <span className="text-gray-400">Source: </span>
                          <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="text-[#01BBDC] hover:underline break-all">
                            {l.source_url}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
