import { useState, useEffect } from 'react';
import { Star, TrendingUp, Eye, MousePointer, DollarSign, Calendar, AlertCircle, Award, BarChart3, Clock } from 'lucide-react';
import { apiUrl, mediaUrl } from '@/app/lib/apiRoot';

type FeaturedListing = {
  id: number;
  listing_id: number;
  listing_title: string;
  listing_image: string;
  plan: string;
  price_paid: number;
  started_at: string;
  expires_at: string;
  impressions: number;
  clicks: number;
  active: boolean;
  days_remaining: number;
};

type AvailableListing = {
  id: number;
  title: string;
  price: number;
  images: string[];
  city: string;
  state: string;
  views: number;
};

type PricingPlan = {
  name: string;
  price: number;
  days: number;
  description?: string;
};

export default function DealerFeaturedTab() {
  const [activeFeatured, setActiveFeatured] = useState<FeaturedListing[]>([]);
  const [expiredFeatured, setExpiredFeatured] = useState<FeaturedListing[]>([]);
  const [availableListings, setAvailableListings] = useState<AvailableListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<AvailableListing | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'available'>('active');
  const [plans, setPlans] = useState<Record<string, PricingPlan>>({
    '7day': { name: '7 Days', price: 49, days: 7, description: 'Perfect for quick sales' },
    '30day': { name: '30 Days', price: 149, days: 30, description: 'Most popular choice' },
    '90day': { name: '90 Days', price: 399, days: 90, description: 'Maximum exposure' }
  });
  const [selectedPlan, setSelectedPlan] = useState<string>('30day');
  const [quote, setQuote] = useState<any>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchFeaturedListings();
    fetchAvailableListings();
    fetchPricingOptions();
  }, []);

  const fetchPricingOptions = async () => {
    try {
      const response = await fetch(apiUrl('/featured-listings/pricing-options'));
      if (response.ok) {
        const data = await response.json();
        if (data?.plans) {
          setPlans(data.plans);
        }
      }
    } catch (error) {
      console.error('Failed to fetch featured pricing options:', error);
    }
  };

  const fetchFeaturedListings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/my-featured-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const now = new Date();
        
        const active = data.filter((f: FeaturedListing) => {
          const expiresAt = new Date(f.expires_at);
          const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          f.days_remaining = daysRemaining;
          return f.active && daysRemaining > 0;
        });
        
        const expired = data.filter((f: FeaturedListing) => {
          const expiresAt = new Date(f.expires_at);
          return !f.active || expiresAt < now;
        });

        setActiveFeatured(active);
        setExpiredFeatured(expired);
      }
    } catch (error) {
      console.error('Failed to fetch featured listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableListings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/featured-listings/available'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableListings(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch available listings:', error);
    }
  };

  const getTotalSpend = () => {
    return activeFeatured.reduce((sum, f) => sum + f.price_paid, 0) +
           expiredFeatured.reduce((sum, f) => sum + f.price_paid, 0);
  };

  const getTotalImpressions = () => {
    return activeFeatured.reduce((sum, f) => sum + f.impressions, 0);
  };

  const getTotalClicks = () => {
    return activeFeatured.reduce((sum, f) => sum + f.clicks, 0);
  };

  const getCTR = () => {
    const impressions = getTotalImpressions();
    const clicks = getTotalClicks();
    return impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
  };

  const handleFeatureListing = (listing: AvailableListing) => {
    setSelectedListing(listing);
    const firstPlan = Object.keys(plans)[0] || '30day';
    setSelectedPlan(firstPlan);
    setQuote(null);
    setShowPurchaseModal(true);
  };

  const loadQuote = async (listingId: number, planId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/featured-listings/quote?listing_id=${listingId}&plan=${planId}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setQuote(data);
      }
    } catch (error) {
      console.error('Failed to load quote:', error);
    }
  };

  const handlePurchase = async () => {
    if (!selectedListing) return;

    setPurchasing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/featured-listings/purchase'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listing_id: selectedListing.id,
          plan: selectedPlan
        })
      });

      if (response.ok) {
        alert('Listing is now featured!');
        setShowPurchaseModal(false);
        setSelectedListing(null);
        await Promise.all([fetchFeaturedListings(), fetchAvailableListings()]);
      } else {
        const error = await response.json().catch(() => ({}));
        alert(error.detail || 'Failed to feature listing');
      }
    } catch (error) {
      console.error('Failed to purchase featured listing:', error);
      alert('Failed to feature listing');
    } finally {
      setPurchasing(false);
    }
  };

  useEffect(() => {
    if (showPurchaseModal && selectedListing && selectedPlan) {
      loadQuote(selectedListing.id, selectedPlan);
    }
  }, [showPurchaseModal, selectedListing, selectedPlan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Featured Listings</h2>
          <p className="text-gray-600 mt-1">Boost your listings with premium placement</p>
        </div>
        <button
          onClick={() => setActiveTab('available')}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 font-semibold shadow-lg"
        >
          <Star size={20} className="fill-white" />
          Feature a Listing
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <Award className="text-blue-600" size={32} />
          </div>
          <div className="text-3xl font-bold text-blue-900 mb-1">
            {activeFeatured.length}
          </div>
          <p className="text-sm text-blue-700">Active Featured</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <Eye className="text-green-600" size={32} />
          </div>
          <div className="text-3xl font-bold text-green-900 mb-1">
            {getTotalImpressions().toLocaleString()}
          </div>
          <p className="text-sm text-green-700">Total Impressions</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <MousePointer className="text-purple-600" size={32} />
          </div>
          <div className="text-3xl font-bold text-purple-900 mb-1">
            {getTotalClicks().toLocaleString()}
          </div>
          <p className="text-sm text-purple-700">
            Total Clicks <span className="font-semibold">({getCTR()}% CTR)</span>
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-yellow-600" size={32} />
          </div>
          <div className="text-3xl font-bold text-yellow-900 mb-1">
            ${getTotalSpend().toLocaleString()}
          </div>
          <p className="text-sm text-yellow-700">Total Investment</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Featured ({activeFeatured.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            History ({expiredFeatured.length})
          </button>
          <button
            onClick={() => setActiveTab('available')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'available'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Available to Feature ({availableListings.length})
          </button>
        </nav>
      </div>

      {/* Active Featured Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeFeatured.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Star size={64} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Featured Listings</h3>
              <p className="text-gray-600 mb-6">Feature a listing to get 10x more visibility</p>
              <button
                onClick={() => setActiveTab('available')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Feature a Listing
              </button>
            </div>
          ) : (
            activeFeatured.map((featured) => (
              <div key={featured.id} className="bg-white rounded-xl shadow-md border-2 border-yellow-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start gap-6">
                    {/* Image */}
                    <div className="relative w-48 h-32 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={mediaUrl(featured.listing_image) || '/images/listing-fallback.png'}
                        alt={featured.listing_title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                        <Star size={12} className="fill-white" />
                        FEATURED
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {featured.listing_title}
                      </h3>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Plan</p>
                          <p className="font-semibold text-gray-900">
                            {plans[featured.plan as keyof typeof plans]?.name || featured.plan}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Days Left</p>
                          <p className={`font-semibold ${
                            featured.days_remaining <= 3 ? 'text-red-600' :
                            featured.days_remaining <= 7 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {featured.days_remaining} days
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Impressions</p>
                          <p className="font-semibold text-blue-600">
                            {featured.impressions.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Clicks</p>
                          <p className="font-semibold text-purple-600">
                            {featured.clicks.toLocaleString()}
                            <span className="text-xs text-gray-500 ml-1">
                              ({featured.impressions > 0 ? ((featured.clicks / featured.impressions) * 100).toFixed(1) : '0'}% CTR)
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Started: {new Date(featured.started_at).toLocaleDateString()}</span>
                          <span>Expires: {new Date(featured.expires_at).toLocaleDateString()}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              featured.days_remaining <= 3 ? 'bg-red-500' :
                              featured.days_remaining <= 7 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{
                              width: `${(((plans[featured.plan as keyof typeof plans]?.days || 1) - featured.days_remaining) / (plans[featured.plan as keyof typeof plans]?.days || 1)) * 100}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => window.open(`/listings/${featured.listing_id}`, '_blank')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          View Listing
                        </button>
                        <button
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                        >
                          View Analytics
                        </button>
                        {featured.days_remaining <= 7 && (
                          <button
                            className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 text-sm font-medium flex items-center gap-2"
                          >
                            <Clock size={16} />
                            Renew Now
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Investment Badge */}
                    <div className="text-right">
                      <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                        <p className="text-xs font-medium">Investment</p>
                        <p className="text-2xl font-bold">${featured.price_paid}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {expiredFeatured.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No featured listing history yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impressions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CTR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {expiredFeatured.map((featured) => {
                    const ctr = featured.impressions > 0 ? ((featured.clicks / featured.impressions) * 100).toFixed(2) : '0.00';
                    const cpm = featured.impressions > 0 ? ((featured.price_paid / featured.impressions) * 1000).toFixed(2) : '0.00';
                    
                    return (
                      <tr key={featured.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{featured.listing_title}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {plans[featured.plan as keyof typeof plans]?.name || featured.plan}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(featured.started_at).toLocaleDateString()} - {new Date(featured.expires_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {featured.impressions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {featured.clicks.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                          {ctr}%
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          ${featured.price_paid}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          ${cpm}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Available Listings Tab */}
      {activeTab === 'available' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableListings.length === 0 ? (
            <div className="col-span-3 text-center py-12 bg-gray-50 rounded-lg">
              <AlertCircle size={64} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">All your active listings are already featured!</p>
            </div>
          ) : (
            availableListings.map((listing) => (
              <div key={listing.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
                <div className="relative h-48">
                  <img
                    src={mediaUrl(listing.images[0]) || '/images/listing-fallback.png'}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                    {listing.title}
                  </h3>
                  <p className="text-2xl font-bold text-blue-600 mb-2">
                    ${listing.price.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    📍 {listing.city}, {listing.state}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Eye size={14} />
                      {listing.views} views
                    </span>
                  </div>
                  <button
                    onClick={() => handleFeatureListing(listing)}
                    className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 font-medium flex items-center justify-center gap-2"
                  >
                    <Star size={16} className="fill-white" />
                    Feature This Listing
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Purchase Modal (Import your FeatureListingModal component) */}
      {showPurchaseModal && selectedListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6">
            <h3 className="text-2xl font-bold mb-4">Feature: {selectedListing.title}</h3>
            <p className="text-gray-600 mb-6">Select a plan to boost this listing's visibility</p>

            <div className="grid md:grid-cols-3 gap-3 mb-6">
              {Object.entries(plans).map(([planId, plan]) => (
                <button
                  key={planId}
                  onClick={() => setSelectedPlan(planId)}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    selectedPlan === planId ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">{plan.name}</p>
                  <p className="text-sm text-gray-600">{plan.days} days</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">${plan.price.toFixed(2)}</p>
                </button>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Pricing Quote</h4>
              {quote ? (
                <div className="space-y-1 text-sm text-gray-700">
                  <div className="flex justify-between"><span>Base price</span><span>${quote.base_price?.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Demand multiplier</span><span>{quote.breakdown?.demand_multiplier}x</span></div>
                  <div className="flex justify-between"><span>Value multiplier</span><span>{quote.breakdown?.value_multiplier}x</span></div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-gray-900">
                    <span>Final price</span><span>${quote.final_price?.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Calculating quote...</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 disabled:opacity-60"
              >
                {purchasing ? 'Processing...' : 'Confirm Feature'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
