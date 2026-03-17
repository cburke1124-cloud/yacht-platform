'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Trash2, Bell, ExternalLink, MapPin, Ruler, CalendarDays } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const FALLBACK = '/images/listing-fallback.png';

type SavedListing = {
  id: number;
  listing_id: number;
  notes: string;
  created_at: string;
  listing: {
    id: number;
    title: string;
    price: number;
    year: number;
    length_feet: number;
    city: string;
    state: string;
    images: string[];
  };
};

export default function SavedListingsPage() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkAuthAndFetch(); }, []);

  const checkAuthAndFetch = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const res = await fetch(apiUrl('/saved-listings'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSaved(await res.json());
      else if (res.status === 401) router.push('/login');
    } catch (err) { console.error('Failed to fetch saved listings:', err); }
    finally { setLoading(false); }
  };

  const handleRemove = async (savedId: number) => {
    if (!confirm('Remove this yacht from your saved list?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(apiUrl(`/saved-listings/${savedId}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setSaved(prev => prev.filter(s => s.id !== savedId));
  };

  const handleCreateAlert = async (listingId: number, currentPrice: number) => {
    const raw = prompt(`Set price alert (current: $${currentPrice.toLocaleString()})\nEnter your target price:`);
    if (!raw) return;
    const token = localStorage.getItem('token');
    const res = await fetch(apiUrl('/price-alerts'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId, target_price: parseFloat(raw), original_price: currentPrice }),
    });
    alert(res.ok ? "Price alert set! You'll be notified when the price drops." : 'Failed to create alert.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#01BBDC]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/listings" className="text-sm text-[#01BBDC] hover:underline mb-4 inline-block font-medium">
            Browse Yachts
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <div className="w-14 h-14 rounded-2xl bg-[#01BBDC]/10 flex items-center justify-center flex-shrink-0">
              <Heart size={28} className="text-[#01BBDC]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#10214F]">Saved Yachts</h1>
              <p className="text-gray-500 mt-0.5">{saved.length} yacht{saved.length !== 1 ? 's' : ''} saved</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {saved.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-16 text-center">
            <Heart size={64} className="mx-auto mb-5 text-gray-200" />
            <h3 className="text-2xl font-bold text-[#10214F] mb-2">No saved yachts yet</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Save yachts you are interested in and they will appear here for easy access.
            </p>
            <Link href="/listings" className="inline-block px-8 py-3 bg-[#01BBDC] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity shadow-md">
              Browse Yachts
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {saved.map((item) => {
              const img = item.listing?.images?.[0] || FALLBACK;
              return (
                <div key={item.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row">
                    <Link href={`/listings/${item.listing_id}`} className="md:w-72 lg:w-80 flex-shrink-0 block">
                      <img
                        src={img}
                        alt={item.listing?.title || 'Yacht'}
                        className="w-full h-56 md:h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }}
                      />
                    </Link>
                    <div className="flex-1 p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <Link href={`/listings/${item.listing_id}`} className="text-xl font-bold text-[#10214F] hover:text-[#01BBDC] transition-colors leading-tight">
                            {item.listing?.title || 'Unknown Yacht'}
                          </Link>
                          <p className="text-2xl font-bold text-[#01BBDC] flex-shrink-0">
                            {item.listing?.price ? `$${item.listing.price.toLocaleString()}` : 'Price N/A'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3 mb-4 text-sm text-gray-600">
                          {item.listing?.year && <span className="flex items-center gap-1"><CalendarDays size={14} className="text-[#01BBDC]" />{item.listing.year}</span>}
                          {item.listing?.length_feet && <span className="flex items-center gap-1"><Ruler size={14} className="text-[#01BBDC]" />{item.listing.length_feet} ft</span>}
                          {(item.listing?.city || item.listing?.state) && (
                            <span className="flex items-center gap-1"><MapPin size={14} className="text-[#01BBDC]" />{[item.listing.city, item.listing.state].filter(Boolean).join(', ')}</span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="mb-4 px-4 py-3 bg-[#01BBDC]/5 border border-[#01BBDC]/20 rounded-2xl text-sm text-gray-700">
                            <span className="font-semibold text-[#10214F]">Notes: </span>{item.notes}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mb-5">
                          Saved {new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link href={`/listings/${item.listing_id}`} className="flex items-center gap-2 px-5 py-2.5 bg-[#01BBDC] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity shadow-sm text-sm">
                          <ExternalLink size={15} /> View Listing
                        </Link>
                        {item.listing?.price && (
                          <button onClick={() => handleCreateAlert(item.listing_id, item.listing.price)} className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#01BBDC] text-[#01BBDC] rounded-2xl font-semibold hover:bg-[#01BBDC] hover:text-white transition-all text-sm">
                            <Bell size={15} /> Price Alert
                          </button>
                        )}
                        <button onClick={() => handleRemove(item.id)} className="flex items-center gap-2 px-5 py-2.5 border-2 border-red-200 text-red-500 rounded-2xl font-semibold hover:bg-red-50 transition-colors ml-auto text-sm">
                          <Trash2 size={15} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-10 bg-white rounded-3xl border border-[#01BBDC]/20 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#01BBDC]/10 flex items-center justify-center flex-shrink-0">
              <Bell size={20} className="text-[#01BBDC]" />
            </div>
            <div>
              <h4 className="font-bold text-[#10214F] mb-2">Stay on top of your shortlist</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>Set price alerts to be notified when a yacht drops in price</li>
                <li>Add notes to remember what you liked about each listing</li>
                <li>Use Compare on any listing page to compare yachts side-by-side</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
