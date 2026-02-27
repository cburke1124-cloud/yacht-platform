'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Trash2, Check, X } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type PriceAlert = {
  id: number;
  listing_id: number;
  target_price: number;
  original_price: number;
  triggered: boolean;
  triggered_at: string | null;
  active: boolean;
  created_at: string;
  listing?: {
    title: string;
    price: number;
  };
};

type SearchAlert = {
  id: number;
  name: string;
  search_criteria: any;
  frequency: string;
  last_sent: string | null;
  active: boolean;
  created_at: string;
};

export default function AlertsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'price' | 'search'>('price');
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [searchAlerts, setSearchAlerts] = useState<SearchAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Fetch price alerts
      const priceRes = await fetch(apiUrl('/price-alerts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        setPriceAlerts(priceData);
      }

      // Fetch search alerts
      const searchRes = await fetch(apiUrl('/search-alerts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        setSearchAlerts(searchData);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePriceAlert = async (alertId: number) => {
    if (!confirm('Delete this price alert?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/price-alerts/${alertId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setPriceAlerts(priceAlerts.filter(a => a.id !== alertId));
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const deleteSearchAlert = async (alertId: number) => {
    if (!confirm('Delete this search alert?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/search-alerts/${alertId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSearchAlerts(searchAlerts.filter(a => a.id !== alertId));
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="text-xl text-dark">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-soft">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
            <Link href="/account" className="text-primary hover:text-primary/90">
              ← Back to Account
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">
            Alerts & Notifications
          </h1>
          <p className="text-dark/60">
            Manage your price drop alerts and saved searches
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b mb-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('price')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'price'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-dark/60 hover:text-dark'
              }`}
            >
              💰 Price Alerts ({priceAlerts.length})
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'search'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-dark/60 hover:text-dark'
              }`}
            >
              🔍 Saved Searches ({searchAlerts.length})
            </button>
          </div>
        </div>

        {/* Price Alerts Tab */}
        {activeTab === 'price' && (
          <div>
            {priceAlerts.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Bell size={64} className="mx-auto mb-4 text-secondary/20" />
                <h3 className="text-2xl font-bold text-dark mb-2">
                  No price alerts yet
                </h3>
                <p className="text-dark/60 mb-6">
                  Set price alerts on yachts you're interested in to get notified when prices drop
                </p>
                <Link
                  href="/account/saved"
                  className="inline-block px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium"
                >
                  Go to Saved Yachts
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {priceAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`bg-white rounded-lg shadow p-6 ${
                      alert.triggered ? 'border-2 border-accent/40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">
                            {alert.listing?.title || `Listing #${alert.listing_id}`}
                          </h3>
                          {alert.triggered ? (
                            <span className="flex items-center gap-1 px-3 py-1 bg-accent/20 text-accent/80 rounded-full text-sm font-semibold">
                              <Check size={14} />
                              Triggered!
                            </span>
                          ) : alert.active ? (
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold">
                              Active
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-soft text-dark rounded-full text-sm font-semibold">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                          <p>
                            <strong>Original Price:</strong> ${alert.original_price?.toLocaleString() || 'N/A'}
                          </p>
                          <p>
                            <strong>Target Price:</strong> ${alert.target_price.toLocaleString()}
                          </p>
                          <p>
                            <strong>Current Price:</strong> ${alert.listing?.price?.toLocaleString() || 'N/A'}
                          </p>
                          {alert.triggered && alert.triggered_at && (
                            <p className="text-green-600">
                              <strong>✅ Triggered on:</strong> {new Date(alert.triggered_at).toLocaleDateString()}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            Created {new Date(alert.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/listings/${alert.listing_id}`}
                          className="px-4 py-2 bg-primary text-light rounded-lg hover-primary text-sm text-center"
                        >
                          View Listing
                        </Link>
                        <button
                          onClick={() => deletePriceAlert(alert.id)}
                          className="px-4 py-2 bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 text-sm flex items-center gap-2"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Alerts Tab */}
        {activeTab === 'search' && (
          <div>
            {searchAlerts.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Bell size={64} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  No saved searches yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Save your search criteria to get notified when new matching yachts are listed
                </p>
                <Link
                  href="/search"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Create Search Alert
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {searchAlerts.map((alert) => (
                  <div key={alert.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">
                            {alert.name}
                          </h3>
                          {alert.active ? (
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                              Active
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="mb-3">
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Frequency:</strong> {alert.frequency}
                          </p>
                          {alert.last_sent && (
                            <p className="text-sm text-gray-600">
                              <strong>Last notification:</strong> {new Date(alert.last_sent).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-2">Search Criteria:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(alert.search_criteria).map(([key, value]) => (
                              <span key={key} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-3">
                          Created {new Date(alert.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        onClick={() => deleteSearchAlert(alert.id)}
                        className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-3">📧 Email Notifications</h4>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• You'll receive email alerts when price alerts are triggered</li>
            <li>• Saved search alerts send new matching listings based on your frequency preference</li>
            <li>• Manage notification preferences in your account settings</li>
            <li>• All alerts can be paused or deleted at any time</li>
          </ul>
        </div>
      </main>
    </div>
  );
}