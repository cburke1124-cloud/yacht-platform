'use client';

import { useState, useEffect } from 'react';
import { Search, Trash2, Edit, Bell, BellOff, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

interface SearchAlert {
  id: number;
  name: string;
  search_criteria: any;
  frequency: string;
  last_sent?: string;
  active: boolean;
  created_at: string;
}

export default function SearchAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login?redirect=/search-alerts');
        return;
      }

      const response = await fetch(apiUrl('/search-alerts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      } else if (response.status === 401) {
        router.push('/login?redirect=/search-alerts');
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (alertId: number) => {
    if (!confirm('Delete this search alert?')) return;

    setDeletingId(alertId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/search-alerts/${alertId}`), {
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

  const toggleActive = async (alertId: number, currentActive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/search-alerts/${alertId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !currentActive })
      });

      if (response.ok) {
        setAlerts(prev =>
          prev.map(alert =>
            alert.id === alertId ? { ...alert, active: !currentActive } : alert
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle alert:', error);
    }
  };

  const formatCriteria = (criteria: any) => {
    const parts = [];
    if (criteria.boat_type) parts.push(`Type: ${criteria.boat_type}`);
    if (criteria.min_price) parts.push(`Min: $${criteria.min_price.toLocaleString()}`);
    if (criteria.max_price) parts.push(`Max: $${criteria.max_price.toLocaleString()}`);
    if (criteria.min_length) parts.push(`${criteria.min_length}+ ft`);
    if (criteria.continent) parts.push(criteria.continent);
    if (criteria.country) parts.push(criteria.country);
    if (criteria.states?.length) parts.push(`${criteria.states.length} states`);
    return parts.length > 0 ? parts.join(' • ') : 'All listings';
  };

  const getFrequencyBadge = (frequency: string) => {
    const colors = {
      instant: 'bg-red-100 text-red-800',
      daily: 'bg-blue-100 text-blue-800',
      weekly: 'bg-green-100 text-green-800'
    };
    return colors[frequency as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#01BBDC]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Search size={32} className="text-[#01BBDC]" />
                <h1 className="text-3xl font-bold text-[#10214F]">Saved Searches</h1>
              </div>
              <p className="text-gray-600">
                Get notified about new yachts matching your criteria
              </p>
            </div>
            <a
              href="/search/advanced"
              className="px-6 py-3 bg-[#01BBDC] text-white rounded-lg hover:bg-[#00a5c4] transition-colors"
            >
              Create New Alert
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Search size={64} className="text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#10214F] mb-2">No saved searches yet</h2>
            <p className="text-gray-600 mb-6">
              Save your searches to get notified about new listings that match your criteria
            </p>
            <a
              href="/search/advanced"
              className="inline-block px-6 py-3 bg-[#01BBDC] text-white rounded-lg hover:bg-[#00a5c4] transition-colors"
            >
              Create Search Alert
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow ${
                  !alert.active ? 'opacity-60' : ''
                }`}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-[#10214F]">{alert.name}</h3>
                      {alert.active ? (
                        <Bell className="text-[#01BBDC]" size={18} />
                        ) : (
                          <BellOff className="text-gray-400" size={18} />
                        )}
                      </div>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getFrequencyBadge(
                          alert.frequency
                        )}`}
                      >
                        {alert.frequency.charAt(0).toUpperCase() + alert.frequency.slice(1)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      disabled={deletingId === alert.id}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      {deletingId === alert.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                      ) : (
                        <Trash2 size={20} />
                      )}
                    </button>
                  </div>

                  {/* Search Criteria */}
                  <div className="mb-4 p-4 bg-[#F5F7FA] rounded-lg">
                    <p className="text-sm font-medium text-[#10214F] mb-2">Search Criteria:</p>
                    <p className="text-sm text-gray-600">{formatCriteria(alert.search_criteria)}</p>
                  </div>

                  {/* Last Sent */}
                  {alert.last_sent && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                      <Mail size={16} />
                      <span>
                        Last notification: {new Date(alert.last_sent).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleActive(alert.id, alert.active)}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        alert.active
                          ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-300'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-300'
                      }`}
                    >
                      {alert.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => {
                        // Navigate to advanced search with these criteria pre-filled
                        const params = new URLSearchParams(alert.search_criteria);
                        router.push(`/search/advanced?${params.toString()}`);
                      }}
                      className="flex-1 px-4 py-2 bg-[#01BBDC]/10 text-[#01BBDC] rounded-lg font-medium hover:bg-[#01BBDC]/20 border border-[#01BBDC]/30 transition-colors"
                    >
                      Run Search
                    </button>
                  </div>

                  {/* Created Date */}
                  <div className="mt-4 text-xs text-gray-500">
                    Created {new Date(alert.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-[#01BBDC]/5 border border-[#01BBDC]/20 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Bell className="text-[#01BBDC] flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="font-bold text-[#10214F] mb-2">How Search Alerts Work</h3>
              <ul className="space-y-1 text-sm text-[#10214F]">
                <li>• <strong>Instant:</strong> Get notified immediately when a matching yacht is listed</li>
                <li>• <strong>Daily:</strong> Receive a daily summary of new matching listings</li>
                <li>• <strong>Weekly:</strong> Get a weekly roundup of all new matching yachts</li>
              </ul>
              <p className="mt-3 text-sm text-[#10214F]">
                You can pause or delete alerts at any time. Create multiple alerts with different criteria!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}