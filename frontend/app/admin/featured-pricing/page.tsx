'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Save, Star, TrendingUp, Calendar } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface FeaturedPlan {
  plan_id: string;
  name: string;
  days: number;
  price: number;
  description: string;
}

export default function AdminFeaturedPricingPage() {
  const [plans, setPlans] = useState<FeaturedPlan[]>([
    { plan_id: '7day', name: '7 Days', days: 7, price: 49, description: 'Perfect for quick sales' },
    { plan_id: '30day', name: '30 Days', days: 30, price: 149, description: 'Most popular choice' },
    { plan_id: '90day', name: '90 Days', days: 90, price: 399, description: 'Maximum exposure' }
  ]);
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeFeatured: 0,
    totalFeatured: 0,
    averagePrice: 0
  });
  
  const [saving, setSaving] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [algorithm, setAlgorithm] = useState({
    base_multiplier: 1,
    demand_weight: 0.08,
    value_weight: 0.06,
    max_multiplier: 2,
  });
  const [teamControls, setTeamControls] = useState({
    allow_salesman_to_feature_own: true,
    allow_salesman_to_feature_all: false,
  });

  useEffect(() => {
    fetchPricingConfig();
    fetchFeaturedStats();
    fetchRecentPurchases();
  }, []);

  const fetchPricingConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/featured-pricing'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.plans_list)) {
          setPlans(data.plans_list);
        }
        if (data.algorithm) {
          setAlgorithm({ ...algorithm, ...data.algorithm });
        }
        if (data.team_controls) {
          setTeamControls({ ...teamControls, ...data.team_controls });
        }
      }
    } catch (error) {
      console.error('Failed to fetch featured pricing config:', error);
    }
  };

  const fetchFeaturedStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/featured-stats'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchRecentPurchases = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/featured-purchases'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentPurchases(data);
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
    }
  };

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/featured-pricing'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plans, algorithm, team_controls: teamControls })
      });

      if (response.ok) {
        alert('Pricing updated successfully!');
        await fetchPricingConfig();
      } else {
        alert('Failed to update pricing');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  const updatePlanPrice = (planId: string, newPrice: number) => {
    setPlans(plans.map(p => 
      p.plan_id === planId ? { ...p, price: newPrice } : p
    ));
  };

  const calculateDailyRate = (price: number, days: number) => {
    return (price / days).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Star className="text-yellow-500 fill-yellow-500" size={32} />
            Featured Listing Pricing
          </h1>
          <p className="text-gray-600 mt-1">Manage featured listing plans and pricing</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="text-green-600" size={24} />
              <span className="text-sm text-gray-600">Total Revenue</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">${stats.totalRevenue.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Star className="text-yellow-600 fill-yellow-600" size={24} />
              <span className="text-sm text-gray-600">Active Featured</span>
            </div>
            <p className="text-3xl font-bold text-yellow-600">{stats.activeFeatured}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="text-blue-600" size={24} />
              <span className="text-sm text-gray-600">Total Purchases</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.totalFeatured}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="text-purple-600" size={24} />
              <span className="text-sm text-gray-600">Avg. Price</span>
            </div>
            <p className="text-3xl font-bold text-purple-600">${stats.averagePrice.toFixed(2)}</p>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-semibold">Pricing Plans</h2>
            <button
              onClick={handleSavePricing}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div key={plan.plan_id} className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-all">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <p className="text-sm text-gray-600">{plan.description}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                          $
                        </span>
                        <input
                          type="number"
                          value={plan.price}
                          onChange={(e) => updatePlanPrice(plan.plan_id, parseFloat(e.target.value))}
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-bold"
                          step="1"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-semibold">{plan.days} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Daily Rate:</span>
                        <span className="font-semibold">${calculateDailyRate(plan.price, plan.days)}/day</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Weekly Rate:</span>
                        <span className="font-semibold">${((plan.price / plan.days) * 7).toFixed(2)}/week</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-blue-800 mb-1">Estimated Value</p>
                        <p className="text-lg font-bold text-blue-600">
                          {plan.days === 7 ? '1,000+' : plan.days === 30 ? '5,000+' : '15,000+'} views
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Price changes will affect new purchases immediately. Existing featured listings will continue at their original pricing.
              </p>
            </div>

            <div className="mt-8 pt-8 border-t">
              <h3 className="text-lg font-semibold mb-4">Pricing Algorithm Controls</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="3"
                    value={algorithm.base_multiplier}
                    onChange={(e) => setAlgorithm({ ...algorithm, base_multiplier: parseFloat(e.target.value || '1') })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="4"
                    value={algorithm.max_multiplier}
                    onChange={(e) => setAlgorithm({ ...algorithm, max_multiplier: parseFloat(e.target.value || '2') })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Demand Weight</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={algorithm.demand_weight}
                    onChange={(e) => setAlgorithm({ ...algorithm, demand_weight: parseFloat(e.target.value || '0.08') })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Value Weight</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={algorithm.value_weight}
                    onChange={(e) => setAlgorithm({ ...algorithm, value_weight: parseFloat(e.target.value || '0.06') })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <h3 className="text-lg font-semibold mt-6 mb-4">Team Feature Permissions Defaults</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm text-gray-700">Allow salesmen to feature their own listings</span>
                  <input
                    type="checkbox"
                    checked={teamControls.allow_salesman_to_feature_own}
                    onChange={(e) => setTeamControls({ ...teamControls, allow_salesman_to_feature_own: e.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm text-gray-700">Allow salesmen to feature any dealer listing</span>
                  <input
                    type="checkbox"
                    checked={teamControls.allow_salesman_to_feature_all}
                    onChange={(e) => setTeamControls({ ...teamControls, allow_salesman_to_feature_all: e.target.checked })}
                  />
                </label>
              </div>

              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(apiUrl('/admin/featured-pricing'), {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ plans, algorithm, team_controls: teamControls })
                    });
                    if (response.ok) {
                      alert('Algorithm and team controls updated');
                    } else {
                      alert('Failed to update algorithm controls');
                    }
                  } catch (error) {
                    console.error('Failed to update algorithm controls:', error);
                    alert('Failed to update algorithm controls');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="mt-6 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-black disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Algorithm & Permissions'}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Recent Purchases</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dealer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No featured listings purchased yet
                    </td>
                  </tr>
                ) : (
                  recentPurchases.map((purchase: any) => (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(purchase.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-900">{purchase.listing_title}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {purchase.dealer_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-semibold">
                          {purchase.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ${purchase.price_paid.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(purchase.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          purchase.active 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {purchase.active ? 'Active' : 'Expired'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}