'use client';

import { useState, useEffect } from 'react';
import { Star, Ship, Plus, Sparkles, ZapOff } from 'lucide-react';
import Link from 'next/link';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface Listing {
  id: number;
  title: string;
  price?: number;
  status: string;
  featured: boolean;
  images?: Array<{ url: string }>;
}

export default function DashboardV2FeaturedPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl('/listings/my-listings?limit=100'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setListings(d.listings ?? d.results ?? d ?? []); })
      .finally(() => setLoading(false));
  }, []);

  async function toggleFeatured(listing: Listing) {
    if (!token) return;
    setTogglingId(listing.id);
    const res = await fetch(apiUrl(`/listings/${listing.id}`), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !listing.featured }),
    });
    if (res.ok) {
      setListings(ls => ls.map(l => l.id === listing.id ? { ...l, featured: !l.featured } : l));
      setToast(listing.featured ? 'Removed from featured' : 'Added to featured!');
      setTimeout(() => setToast(null), 2500);
    }
    setTogglingId(null);
  }

  const featured = listings.filter(l => l.featured);
  const available = listings.filter(l => !l.featured && l.status === 'active');

  function ListingRow({ l, isFeatured }: { l: Listing; isFeatured: boolean }) {
    return (
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/80 transition-colors group">
        <div className="w-16 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-100">
          {l.images?.[0]?.url ? (
            <img src={mediaUrl(l.images[0].url)} alt="" onError={onImgError} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#10214F]/5">
              <Ship size={14} className="text-[#10214F]/30" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{l.title}</p>
          {l.price != null && <p className="text-xs text-gray-400 mt-0.5">${l.price.toLocaleString()}</p>}
        </div>
        <button
          onClick={() => toggleFeatured(l)}
          disabled={togglingId === l.id}
          className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50 ${
            isFeatured
              ? 'border border-red-200 text-red-500 hover:bg-red-50'
              : 'bg-[#C9A84C] text-white shadow-sm shadow-[#C9A84C]/30 hover:bg-[#d4b35a]'
          }`}
        >
          {isFeatured ? (
            <><ZapOff size={12} /> Remove</>
          ) : (
            <><Star size={12} fill="currentColor" /> Feature</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl animate-fade-in">
          <Star size={14} className="text-[#C9A84C]" fill="currentColor" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-gray-900">Featured Listings</h1>
          <span className="bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-bold px-2.5 py-0.5 rounded-full">
            {featured.length} active
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Manage which listings are promoted on the front page</p>
      </div>

      {/* Currently featured */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
          <span className="block w-1 h-5 rounded-full bg-[#C9A84C]" />
          <div className="flex items-center gap-2">
            <Star size={14} className="text-[#C9A84C]" fill="currentColor" />
            <h2 className="font-semibold text-gray-900 text-sm">Currently Featured</h2>
          </div>
          <span className="ml-auto text-xs font-semibold text-gray-400">{featured.length}</span>
        </div>
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-16 h-12 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="w-20 h-8 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2.5">
            <div className="w-14 h-14 rounded-2xl bg-[#C9A84C]/10 flex items-center justify-center">
              <Star size={22} className="text-[#C9A84C]/50" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No featured listings</p>
            <p className="text-xs text-gray-400">Feature active listings below to promote them</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {featured.map(l => <ListingRow key={l.id} l={l} isFeatured={true} />)}
          </div>
        )}
      </div>

      {/* Available to feature */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
          <span className="block w-1 h-5 rounded-full bg-emerald-400" />
          <h2 className="font-semibold text-gray-900 text-sm">Active — Not Featured</h2>
          <span className="ml-auto text-xs font-semibold text-gray-400">{available.length}</span>
        </div>
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-16 h-12 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="w-20 h-8 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : available.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2.5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Ship size={20} className="text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500">All active listings are featured</p>
            <Link href="/dashboard/listings/create" className="text-xs text-[#10214F] font-semibold hover:underline">+ Add a new listing</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {available.map(l => <ListingRow key={l.id} l={l} isFeatured={false} />)}
          </div>
        )}
      </div>
    </div>
  );
}
