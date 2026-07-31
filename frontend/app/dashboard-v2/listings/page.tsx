'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Ship, Edit2, Eye, Trash2,
  CheckCircle, XCircle, MapPin, Star,
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

type Status = 'active' | 'draft' | 'archived' | 'sold' | 'awaiting_review';

interface Listing {
  id: number;
  title: string;
  price?: number;
  year?: number;
  city?: string;
  state?: string;
  status: Status;
  views: number;
  inquiries: number;
  featured: boolean;
  created_at: string;
  images: Array<{ url: string }>;
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'archived', label: 'Archived' },
  { key: 'sold', label: 'Sold' },
];

const SC: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  draft: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50',
  archived: 'bg-gray-100 text-gray-500',
  sold: 'bg-blue-50 text-blue-700',
  awaiting_review: 'bg-violet-50 text-violet-700',
};

const SL: Record<string, string> = {
  active: 'Active', draft: 'Draft', archived: 'Archived', sold: 'Sold', awaiting_review: 'In Review',
};

export default function DashboardV2ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    fetch(apiUrl('/listings/my-listings?limit=100'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const all: Listing[] = d.listings ?? d.results ?? d ?? [];
          setListings(all);
          setTotal(d.total ?? all.length);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = listings.filter(l => {
    if (tab !== 'all' && l.status !== tab) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByStatus = (s: string) => s === 'all' ? listings.length : listings.filter(l => l.status === s).length;
  const activeCount = listings.filter(l => l.status === 'active').length;

  async function toggleStatus(l: Listing) {
    const token = localStorage.getItem('token');
    if (!token) return;
    const newStatus = l.status === 'active' ? 'draft' : 'active';
    setTogglingId(l.id);
    const res = await fetch(apiUrl(`/listings/${l.id}`), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) setListings(prev => prev.map(item => item.id === l.id ? { ...item, status: newStatus } : item));
    setTogglingId(null);
  }

  async function deleteListing(id: number) {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setDeletingId(id);
    const res = await fetch(apiUrl(`/listings/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setListings(prev => prev.filter(l => l.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-gray-900">Listings</h1>
            <span className="bg-[#10214F]/[0.08] text-[#10214F] text-xs font-bold px-2.5 py-0.5 rounded-full">
              {activeCount} active
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{total} total listings in your inventory</p>
        </div>
        <Link
          href="/dashboard/listings/create"
          className="flex-shrink-0 flex items-center gap-2 bg-[#10214F] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#1a3570] active:scale-95 transition-all"
        >
          <Plus size={15} strokeWidth={2.5} /> New Listing
        </Link>
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
            placeholder="Search listings…"
            className="h-9 pl-8 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 w-56 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-16 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="w-16 h-6 bg-gray-100 rounded-full hidden sm:block" />
                <div className="w-10 h-6 bg-gray-100 rounded hidden sm:block" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[#10214F]/5 flex items-center justify-center">
              <Ship size={24} className="text-[#10214F]/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-600">{search ? 'No results found' : `No ${tab === 'all' ? '' : tab} listings`}</p>
              <p className="text-xs text-gray-400 mt-0.5">{search ? 'Try a different search term' : 'Add your first listing to get started'}</p>
            </div>
            {!search && (
              <Link href="/dashboard/listings/create" className="text-xs font-semibold text-[#10214F] bg-[#10214F]/5 hover:bg-[#10214F]/10 px-4 py-2 rounded-xl transition-colors">+ Add listing</Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_100px_80px_90px_100px] gap-4 items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Listing</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Views</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Inquiries</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</p>
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map(listing => {
                const location = [listing.city, listing.state].filter(Boolean).join(', ');
                return (
                  <div key={listing.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/80 transition-colors group">
                    {/* Thumbnail */}
                    <div className="w-16 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-100">
                      {listing.images?.[0]?.url ? (
                        <img src={mediaUrl(listing.images[0].url)} alt="" onError={onImgError} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#10214F]/5">
                          <Ship size={14} className="text-[#10214F]/30" />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
                        {listing.featured && (
                          <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded-md">
                            <Star size={8} fill="currentColor" /> Featured
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 mt-0.5">
                        {listing.price != null && <span className="text-xs text-gray-600 font-medium">${listing.price.toLocaleString()}</span>}
                        {listing.year && <span className="text-xs text-gray-400">{listing.year}</span>}
                        {location && <span className="flex items-center gap-0.5 text-xs text-gray-400"><MapPin size={10} />{location}</span>}
                      </div>
                    </div>
                    {/* Status */}
                    <div className="hidden sm:flex w-[100px] justify-center flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SC[listing.status] ?? SC.draft}`}>
                        {SL[listing.status] ?? listing.status}
                      </span>
                    </div>
                    {/* Views */}
                    <div className="hidden sm:block w-20 text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">{(listing.views ?? 0).toLocaleString()}</p>
                      <p className="text-[11px] text-gray-400">views</p>
                    </div>
                    {/* Inquiries */}
                    <div className="hidden sm:block w-[90px] text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">{listing.inquiries ?? 0}</p>
                      <p className="text-[11px] text-gray-400">inquiries</p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/listings/${listing.id}/edit`} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#10214F]/8 text-gray-400 hover:text-[#10214F] transition-colors" title="Edit">
                        <Edit2 size={14} />
                      </Link>
                      <Link href={`/listings/${listing.id}`} target="_blank" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#10214F]/8 text-gray-400 hover:text-[#10214F] transition-colors" title="View public page">
                        <Eye size={14} />
                      </Link>
                      <button onClick={() => toggleStatus(listing)} disabled={togglingId === listing.id} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors" title={listing.status === 'active' ? 'Deactivate' : 'Activate'}>
                        {listing.status === 'active' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                      </button>
                      <button onClick={() => deleteListing(listing.id)} disabled={deletingId === listing.id} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        Need bulk actions, quick edit, or salesman assignment?{' '}
        <Link href="/dashboard/listings" className="text-[#10214F] font-semibold hover:underline">Open full listings manager →</Link>
      </p>
    </div>
  );
}
