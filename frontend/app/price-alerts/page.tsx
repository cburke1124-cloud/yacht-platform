'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Trash2, TrendingDown, Check, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

interface PriceAlert {
  id: number;
  listing_id: number;
  target_price: number;
  original_price?: number;
  triggered: boolean;
  triggered_at?: string;
  active: boolean;
  created_at: string;
  listing?: {
    id: number;
    title: string;
    price: number;
    currency: string;
    images: Array<{ url: string }>;
  };
}

export default function PriceAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login?redirect=/price-alerts');
        return;
      }

      const response = await fetch(apiUrl('/price-alerts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      } else if (response.status === 401) {
        router.push('/login?redirect=/price-alerts');
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (alertId: number) => {
    if (!confirm('Delete this price alert?')) return;

    setDeletingId(alertId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/price-alerts/${alertId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
      alert('Failed to delete alert');
    } finally {
      setDeletingId(null);
    }
  };

  const calculateSavings = (alert: PriceAlert) => {
    if (!alert.listing || !alert.original_price) return null;
    const savings = alert.original_price - alert.listing.price;
    const percentSaved = (savings / alert.original_price) * 100;
    return { savings, percentSaved };
  };

  if (loading) {
    return (
      <div className="min-h-screen section-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => a.active && !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div className="min-h-screen section-light">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Bell size={32} className="text-primary" />
            <h1 className="text-3xl font-bold text-secondary">Price Alerts</h1>
          </div>
          <p className="text-dark/70">
            Get notified when yacht prices drop to your target
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Bell className="text-primary" size={24} />
              <span className="text-sm text-dark/70">Active Alerts</span>
            </div>
            <p className="text-3xl font-bold text-secondary">{activeAlerts.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="text-green-600" size={24} />
              <span className="text-sm text-dark/70">Price Drops</span>
            </div>
            <p className="text-3xl font-bold text-secondary">{triggeredAlerts.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Check className="text-purple-600" size={24} />
              <span className="text-sm text-dark/70">Total Alerts</span>
            </div>
            <p className="text-3xl font-bold text-secondary">{alerts.length}</p>
          </div>
        </div>

        {/* Triggered Alerts */}
        {triggeredAlerts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-secondary mb-4 flex items-center gap-2">
              <TrendingDown className="text-green-600" />
              Price Drops - Act Now!
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {triggeredAlerts.map((alert) => {
                const savings = calculateSavings(alert);
                return (
                  <div
                    key={alert.id}
                    className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-md overflow-hidden border-2 border-green-500"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <TrendingDown className="text-green-600" size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-800">PRICE DROP!</p>
                            <p className="text-xs text-green-600">
                              {alert.triggered_at && new Date(alert.triggered_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(alert.id)}
                          disabled={deletingId === alert.id}
                          className="p-2 text-dark/70 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>

                      <h3 className="text-lg font-bold text-secondary mb-3 line-clamp-2">
                        {alert.listing?.title || 'Listing'}
                      </h3>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-dark/70">Original Price:</span>
                          <span className="text-sm font-medium line-through text-dark/50">
                            ${alert.original_price?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-dark/70">Current Price:</span>
                          <span className="text-xl font-bold text-green-600">
                            ${alert.listing?.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-dark/70">Your Target:</span>
                          <span className="text-sm font-medium text-primary">
                            ${alert.target_price.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {savings && savings.savings > 0 && (
                        <div className="p-3 bg-green-100 rounded-lg mb-4">
                          <p className="text-sm font-bold text-green-800">
                            You could save ${savings.savings.toLocaleString()} ({savings.percentSaved.toFixed(1)}%)
                          </p>
                        </div>
                      )}

                      <a
                        href={`/listings/${alert.listing_id}`}
                        className="block px-4 py-2 bg-green-600 text-white text-center rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={18} />
                        View Listing Now
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-secondary mb-4 flex items-center gap-2">
              <Bell className="text-primary" />
              Active Price Alerts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <Bell className="text-primary" size={24} />
                      <button
                        onClick={() => handleDelete(alert.id)}
                        disabled={deletingId === alert.id}
                        className="p-2 text-dark/70 hover:text-red-600 transition-colors"
                      >
                        {deletingId === alert.id ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 size={20} />
                        )}
                      </button>
                    </div>

                    <h3 className="text-lg font-bold text-secondary mb-3 line-clamp-2">
                      {alert.listing?.title || 'Listing'}
                    </h3>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-dark/70">Current Price:</span>
                        <span className="text-lg font-bold text-secondary">
                          ${alert.listing?.price.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-dark/70">Target Price:</span>
                        <span className="text-lg font-bold text-primary">
                          ${alert.target_price.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-primary/5 rounded-lg mb-4">
                      <p className="text-xs text-dark">
                        {alert.listing && alert.listing.price > alert.target_price
                          ? `Waiting for ${((alert.listing.price - alert.target_price) / alert.listing.price * 100).toFixed(1)}% price drop`
                          : 'Price has reached your target!'}
                      </p>
                    </div>

                    <a
                      href={`/listings/${alert.listing_id}`}
                      className="block px-4 py-2 bg-gray-100 text-dark rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={18} />
                      View Listing
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {alerts.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <BellOff size={64} className="text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-secondary mb-2">No price alerts yet</h2>
            <p className="text-dark/70 mb-6">
              Set price alerts on listings to get notified when prices drop
            </p>
            <a
              href="/listings"
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Browse Yachts
            </a>
          </div>
        )}
      </div>
    </div>
  );
}