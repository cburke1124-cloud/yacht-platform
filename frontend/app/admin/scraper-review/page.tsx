'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, Clock, User, ExternalLink, RefreshCw,
  AlertTriangle, Pencil, Save, X,
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
  const [listings, setListings] = useState<ScrapedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('awaiting_review');
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editSalesmanId, setEditSalesmanId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/admin/scraper/listings?status=${statusFilter}`),
        { headers: authHeaders() },
      );
      const data = await res.json();
      setListings(data.listings || []);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

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

      {/* Filter tabs */}
      <div className="flex gap-2 px-6 pt-4 pb-3 border-b">
        {(['awaiting_review', 'active', 'draft'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-[#10214F] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'awaiting_review' ? 'Awaiting Review' : s.charAt(0).toUpperCase() + s.slice(1)}
            {statusCounts[s] != null && <span className="ml-1.5 opacity-80">({statusCounts[s]})</span>}
          </button>
        ))}
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
            {listings.map(l => {
              const isEditing = editingId === l.id;
              const isSaving = saving[l.id];
              return (
                <div
                  key={l.id}
                  className="border border-gray-200 rounded-xl p-4 flex gap-4 items-start hover:border-[#01BBDC]/60 transition-colors"
                >
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
                        {l.status !== 'active' && (
                          <button
                            onClick={() => patch(l.id, { status: 'active' })}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-60"
                          >
                            <CheckCircle size={13} /> Approve
                          </button>
                        )}
                        {l.status !== 'draft' && (
                          <button
                            onClick={() => patch(l.id, { status: 'draft' })}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-60"
                          >
                            <XCircle size={13} /> Draft
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(l)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#01BBDC]/10 text-[#10214F] rounded-lg text-xs font-medium hover:bg-[#01BBDC]/20"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
