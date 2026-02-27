'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Bell, DollarSign, Search, Trash2, Eye, MessageSquare, Settings, TrendingDown } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import CommunicationPreferencesCard, { type AccountPreferences } from '@/app/account/components/CommunicationPreferencesCard';

interface SavedListing {
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
}

interface PriceAlert {
  id: number;
  listing_id: number;
  target_price: number;
  original_price: number;
  triggered: boolean;
  created_at: string;
  listing: {
    title: string;
    price: number;
  };
}

interface SearchAlert {
  id: number;
  name: string;
  search_criteria: any;
  frequency: string;
  created_at: string;
  active: boolean;
}

function BuyerDashboardContent() {
  const router = useRouter();
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
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Get user data
      const userResponse = await fetch(apiUrl('/auth/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
      }

      // Get saved listings
      const savedResponse = await fetch(apiUrl('/saved-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (savedResponse.ok) {
        const savedData = await savedResponse.json();
        setSavedListings(savedData);
      }

      // Get price alerts
      const alertsResponse = await fetch(apiUrl('/price-alerts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setPriceAlerts(alertsData);
      }

      // Get search alerts
      const searchResponse = await fetch(apiUrl('/search-alerts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        setSearchAlerts(searchData);
      }

      const prefsResponse = await fetch(apiUrl('/preferences'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (prefsResponse.ok) {
        const prefsData = await prefsResponse.json();
        setPreferences(prev => ({ ...prev, ...prefsData }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
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

  const handleRemoveSaved = async (savedId: number) => {
    if (!confirm('Remove this listing from saved?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(apiUrl(`/saved-listings/${savedId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSavedListings(prev => prev.filter(l => l.id !== savedId));
    } catch (error) {
      console.error('Failed to remove listing:', error);
    }
  };

  const handleDeletePriceAlert = async (alertId: number) => {
    if (!confirm('Delete this price alert?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(apiUrl(`/price-alerts/${alertId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPriceAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const handleDeleteSearchAlert = async (alertId: number) => {
    if (!confirm('Delete this search alert?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(apiUrl(`/search-alerts/${alertId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSearchAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const tabs = [
    { id: 'saved', label: 'Saved Yachts', icon: Heart, count: savedListings.length },
    { id: 'price-alerts', label: 'Price Alerts', icon: DollarSign, count: priceAlerts.length },
    { id: 'search-alerts', label: 'Search Alerts', icon: Bell, count: searchAlerts.length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dark">My Account</h1>
            <p className="text-dark/60 mt-1">
              Welcome back, {user?.first_name || 'Buyer'}!
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/messages"
              className="flex items-center gap-2 px-4 py-2 bg-soft text-dark rounded-lg hover:bg-primary/10 transition-colors"
            >
              <MessageSquare size={20} />
              Messages
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2 px-4 py-2 bg-soft text-dark rounded-lg hover:bg-primary/10 transition-colors"
            >
              <Settings size={20} />
              Settings
            </Link>
            <Link
              href="/listings"
              className="px-6 py-2 bg-primary text-light rounded-lg hover-primary transition-colors"
            >
              Browse Yachts
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark/60">Saved Yachts</p>
                <p className="text-3xl font-bold text-dark">{savedListings.length}</p>
              </div>
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Heart size={24} className="text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-accent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark/60">Price Alerts</p>
                <p className="text-3xl font-bold text-dark">{priceAlerts.length}</p>
              </div>
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                <TrendingDown size={24} className="text-accent" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-secondary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark/60">Search Alerts</p>
                <p className="text-3xl font-bold text-dark">{searchAlerts.length}</p>
              </div>
              <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center">
                <Bell size={24} className="text-secondary" />
              </div>
            </div>
          </div>
        </div>

        <CommunicationPreferencesCard
          preferences={preferences}
          saving={savingPreferences}
          onSave={savePreferences}
          onToggle={(field, value) => setPreferences({ ...preferences, [field]: value })}
          variant="brand"
        />

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-primary/20 flex flex-col md:flex-row">
          <div className="md:w-72 border-b md:border-b-0 md:border-r border-primary/20 bg-soft/30">
            <div className="p-3 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-dark/70 hover:bg-white hover:text-dark'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={18} />
                      {tab.label}
                    </span>
                    {tab.count > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-secondary/20 text-secondary text-xs rounded-full">
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
                {savedListings.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart size={48} className="text-secondary/20 mx-auto mb-4" />
                    <p className="text-dark text-lg mb-2">No saved yachts yet</p>
                    <p className="text-dark/60 text-sm mb-6">
                      Start browsing yachts and save your favorites!
                    </p>
                    <Link
                      href="/listings"
                      className="inline-block px-6 py-3 bg-primary text-light rounded-lg hover-primary transition-colors"
                    >
                      Browse Yachts
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedListings.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col md:flex-row gap-4 p-4 border border-primary/20 rounded-lg hover:border-primary/50 transition-colors"
                      >
                        <div className="w-full md:w-32 h-32 bg-soft rounded-lg flex-shrink-0">
                          {item.listing?.images?.[0] ? (
                            <img
                              src={item.listing.images[0]}
                              alt={item.listing.title}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-secondary/30 text-xs">
                              No image
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-dark mb-1">
                            {item.listing?.title || 'Yacht Listing'}
                          </h3>
                          <p className="text-lg font-bold text-primary mb-2">
                            ${item.listing?.price?.toLocaleString() || 'N/A'}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-dark/60 mb-2">
                            <span>{item.listing?.year}</span>
                            <span>•</span>
                            <span>{item.listing?.length_feet} ft</span>
                            <span>•</span>
                            <span>{item.listing?.city}, {item.listing?.state}</span>
                          </div>
                          {item.notes && (
                            <p className="text-sm text-dark/60 italic">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex md:flex-col gap-2">
                          <Link
                            href={`/listings/${item.listing_id}`}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors whitespace-nowrap"
                            title="View listing"
                          >
                            <Eye size={18} />
                            <span className="hidden md:inline">View</span>
                          </Link>
                          <button
                            onClick={() => handleRemoveSaved(item.id)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 transition-colors whitespace-nowrap"
                            title="Remove"
                          >
                            <Trash2 size={18} />
                            <span className="hidden md:inline">Remove</span>
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
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">
                            {alert.listing?.title || 'Listing'}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            Alert when price drops to ${alert.target_price.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            Current price: ${alert.listing?.price?.toLocaleString() || alert.original_price?.toLocaleString()}
                          </p>
                          <p className="text-sm mt-1">
                            Status: {alert.triggered ? (
                              <span className="text-green-600 font-medium">✓ Triggered</span>
                            ) : (
                              <span className="text-blue-600 font-medium">🔔 Active</span>
                            )}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleDeletePriceAlert(alert.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
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
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full capitalize">
                              {alert.frequency}
                            </span>
                            {!alert.active && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                Paused
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            Created {new Date(alert.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleDeleteSearchAlert(alert.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
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

        {/* Tips Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-3">💡 Buyer Tips</h4>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Save yachts you're interested in to compare them later</li>
            <li>• Set price alerts to get notified when prices drop</li>
            <li>• Create search alerts to be the first to know about new listings</li>
            <li>• Contact dealers directly through messages</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Main export - NO ROUTE GUARD (accessible to authenticated users)
export default function BuyerDashboard() {
  return <BuyerDashboardContent />;
}