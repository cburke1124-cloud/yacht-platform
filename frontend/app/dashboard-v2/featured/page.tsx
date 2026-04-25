'use client';

import { useState, useEffect } from 'react';
import { Star, Ship, Plus, ArrowRight } from 'lucide-react';
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
      setToast(listing.featured ? 'Removed from featured' : 'Added to featured');
      setTimeout(() => setToast(null), 2500);
    }
    setTogglingId(null);
  }

  const featured = listings.filter(l => l.featured);
  const notFeatured = listings.filter(l => !l.featured && l.status === 'active');

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
          Featured Listings
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage which listings are promoted on the front page</p>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Currently featured */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Star size={15} className="text-[#C9A84C] fill-[#C9A84C]" />
          <h2 className="font-semibold text-gray-800 text-sm">Currently Featured ({featured.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : featured.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No featured listings. Add some below.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {featured.map(l => (
              <div key={l.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-12 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {l.images?.[0]?.url ? (
                    <img src={mediaUrl(l.images[0].url)} alt="" onError={onImgError} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Ship size={14} className="text-gray-300" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                  {l.price && <p className="text-xs text-gray-400">${l.price.toLocaleString()}</p>}
                </div>
                <button
                  onClick={() => toggleFeatured(l)}
                  disabled={togglingId === l.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available to feature */}
      {notFeatured.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Active Listings — Not Featured</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {notFeatured.map(l => (
              <div key={l.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-12 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {l.images?.[0]?.url ? (
                    <img src={mediaUrl(l.images[0].url)} alt="" onError={onImgError} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Ship size={14} className="text-gray-300" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                  {l.price && <p className="text-xs text-gray-400">${l.price.toLocaleString()}</p>}
                </div>
                <button
                  onClick={() => toggleFeatured(l)}
                  disabled={togglingId === l.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors flex items-center gap-1"
                >
                  <Plus size={11} /> Feature
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

