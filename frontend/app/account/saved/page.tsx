'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Trash2, Bell, ExternalLink } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type SavedListing = {
  id: number;
  listing_id: number | null;
  charter_id: number | null;
  item_type: 'listing' | 'charter';
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
  } | null;
  charter: {
    id: number;
    title: string;
    day_rate?: number;
    week_rate?: number;
    currency?: string;
    home_port_city?: string;
    home_port_state?: string;
    images: string[];
  } | null;
};

export default function SavedListingsPage() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSaved();
  }, []);

  const fetchSaved = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(apiUrl('/saved-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSaved(data);
      }
    } catch (error) {
      console.error('Failed to fetch saved listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (savedId: number) => {
    if (!confirm('Remove this yacht from your saved list?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/saved-listings/${savedId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSaved(saved.filter(s => s.id !== savedId));
      }
    } catch (error) {
      console.error('Failed to remove:', error);
    }
  };

  const handleCreateAlert = async (listingId: number, currentPrice: number) => {
    const targetPrice = prompt(`Set price alert (current price: $${currentPrice.toLocaleString()})`);
    if (!targetPrice) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/price-alerts'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listing_id: listingId,
          target_price: parseFloat(targetPrice),
          original_price: currentPrice
        })
      });

      if (response.ok) {
        alert('✅ Price alert created! You\'ll be notified when the price drops.');
      }
    } catch (error) {
      console.error('Failed to create alert:', error);
      alert('Failed to create alert');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-900">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/account" className="text-blue-600 hover:text-blue-700">
              ← Back to Account
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Saved Yachts
          </h1>
          <p className="text-gray-600">
            {saved.length} yacht{saved.length !== 1 ? 's' : ''} saved
          </p>
        </div>

        {saved.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Heart size={64} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              No saved yachts yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start saving yachts you're interested in to keep track of them here
            </p>
            <Link
              href="/listings"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Browse Yachts
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {saved.map((item) => {
              const isCharter = item.item_type === 'charter';
              const title = isCharter ? item.charter?.title : item.listing?.title;
              const image = (isCharter ? item.charter?.images?.[0] : item.listing?.images?.[0]) || null;
              const city = isCharter ? item.charter?.home_port_city : item.listing?.city;
              const state = isCharter ? item.charter?.home_port_state : item.listing?.state;
              const price = isCharter ? (item.charter?.week_rate || item.charter?.day_rate) : item.listing?.price;
              const priceLabel = isCharter ? (item.charter?.week_rate ? '/week' : item.charter?.day_rate ? '/day' : '') : '';
              const viewHref = isCharter ? `/charter/${item.charter_id}` : `/listings/${item.listing_id}`;

              return (
                <div key={item.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="md:w-80 h-64 bg-gray-200">
                      {image ? (
                        <img
                          src={image}
                          alt={title || 'Yacht'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            {title || 'Unknown Yacht'}
                            {isCharter && <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Charter</span>}
                          </h3>
                          <div className="flex items-center gap-4 text-gray-600 text-sm">
                            {!isCharter && <><span>{item.listing?.year}</span><span>•</span><span>{item.listing?.length_feet} ft</span><span>•</span></>}
                            <span>{city}{city && state ? ', ' : ''}{state}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-blue-600">
                            {price ? `$${price.toLocaleString()}${priceLabel}` : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {item.notes && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Notes:</strong> {item.notes}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
                        <span>Saved {new Date(item.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={viewHref}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink size={16} />
                          View Listing
                        </Link>

                        {!isCharter && item.listing && (
                          <button
                            onClick={() => handleCreateAlert(item.listing_id!, item.listing!.price)}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
                          >
                            <Bell size={16} />
                            Create Price Alert
                          </button>
                        )}

                        <button
                          onClick={() => handleRemove(item.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <Trash2 size={16} />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-3">💡 Pro Tips</h4>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Set price alerts to get notified when a yacht's price drops</li>
            <li>• Add notes to remember why you saved each yacht</li>
            <li>• Compare saved yachts side-by-side</li>
            <li>• Contact brokers directly from your saved list</li>
          </ul>
        </div>
      </main>
    </div>
  );
}