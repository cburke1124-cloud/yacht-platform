'use client';

import { useState, useEffect } from 'react';
import { Heart, Bell, DollarSign, Search, Trash2, Eye, Calendar, TrendingDown } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import CommunicationPreferencesCard, { type AccountPreferences } from '@/app/account/components/CommunicationPreferencesCard';

interface SavedListing {
  id: number;
  listing_id: number;
  title: string;
  price: number;
  notes: string;
  created_at: string;
}

interface PriceAlert {
  id: number;
  listing_id: number;
  target_price: number;
  triggered: boolean;
  created_at: string;
}

interface SearchAlert {
  id: number;
  name: string;
  search_criteria: any;
  frequency: string;
  created_at: string;
}

export default function BuyerDashboard() {
  const [activeTab, setActiveTab] = useState<'saved' | 'price-alerts' | 'search-alerts'>('saved');
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [searchAlerts, setSearchAlerts] = useState<SearchAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [preferences, setPreferences] = useState<AccountPreferences>({
    marketing_opt_in: false,
    communication_email: true,
    communication_sms: false,
    communication_push: true,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchSavedListings();
    fetchPriceAlerts();
    fetchSearchAlerts();
    fetchPreferences();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUser(data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchSavedListings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/saved-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSavedListings(data);
    } catch (error) {
      console.error('Failed to fetch saved listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/price-alerts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPriceAlerts(data);
    } catch (error) {
      console.error('Failed to fetch price alerts:', error);
    }
  };

  const fetchSearchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/search-alerts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSearchAlerts(data);
    } catch (error) {
      console.error('Failed to fetch search alerts:', error);
    }
  };

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/preferences'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPreferences(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
  };

  const savePreferences = async () => {
    setSavingPreferences(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/preferences'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        alert('Communication preferences saved');
      } else {
        alert('Failed to save communication preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save communication preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const removeSavedListing = async (id: number) => {
    if (!confirm('Remove this listing from saved?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(apiUrl(`/saved-listings/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSavedListings(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Failed to remove listing:', error);
    }
  };

  const tabs = [
    { id: 'saved', label: 'Saved Listings', icon: Heart, count: savedListings.length },
    { id: 'price-alerts', label: 'Price Alerts', icon: DollarSign, count: priceAlerts.length },
    { id: 'search-alerts', label: 'Search Alerts', icon: Bell, count: searchAlerts.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user?.first_name || 'Buyer'}!
              </p>
            </div>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Browse Yachts
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Saved Listings</p>
                <p className="text-3xl font-bold text-gray-900">{savedListings.length}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Heart size={24} className="text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Price Alerts</p>
                <p className="text-3xl font-bold text-gray-900">{priceAlerts.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingDown size={24} className="text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Search Alerts</p>
                <p className="text-3xl font-bold text-gray-900">{searchAlerts.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Bell size={24} className="text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <CommunicationPreferencesCard
          preferences={preferences}
          saving={savingPreferences}
          onSave={savePreferences}
          onToggle={(field, value) => setPreferences({ ...preferences, [field]: value })}
          variant="blue"
        />

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col md:flex-row">
          <div className="md:w-72 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50">
            <div className="p-3 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-white hover:text-gray-900'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={18} />
                      {tab.label}
                    </span>
                    {tab.count > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 flex-1">
            {/* Saved Listings Tab */}
            {activeTab === 'saved' && (
              <div>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : savedListings.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg mb-2">No saved listings yet</p>
                    <p className="text-gray-500 text-sm mb-6">
                      Start browsing yachts and save your favorites!
                    </p>
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Browse Yachts
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedListings.map((listing) => (
                      <div
                        key={listing.id}
                        className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0">
                          <img
                            src="/images/listing-fallback.png"
                            alt={listing.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {listing.title}
                          </h3>
                          <p className="text-lg font-bold text-blue-600 mb-2">
                            ${listing.price.toLocaleString()}
                          </p>
                          {listing.notes && (
                            <p className="text-sm text-gray-600 italic">
                              Note: {listing.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`/listings/${listing.listing_id}`}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="View listing"
                          >
                            <Eye size={20} />
                          </a>
                          <button
                            onClick={() => removeSavedListing(listing.id)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title="Remove from saved"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Price Alerts Tab */}
            {activeTab === 'price-alerts' && (
              <div>
                {priceAlerts.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg mb-2">No price alerts set</p>
                    <p className="text-gray-500 text-sm">
                      Set alerts to get notified when prices drop!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {priceAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">
                            Alert when price drops to ${alert.target_price.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            Status: {alert.triggered ? (
                              <span className="text-green-600 font-medium">✓ Triggered</span>
                            ) : (
                              <span className="text-blue-600 font-medium">🔔 Active</span>
                            )}
                          </p>
                        </div>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search Alerts Tab */}
            {activeTab === 'search-alerts' && (
              <div>
                {searchAlerts.length === 0 ? (
                  <div className="text-center py-12">
                    <Search size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg mb-2">No search alerts</p>
                    <p className="text-gray-500 text-sm">
                      Save your searches to get notifications about new listings!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{alert.name}</h3>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {alert.frequency}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Criteria: {JSON.stringify(alert.search_criteria).substring(0, 100)}...
                          </p>
                        </div>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
