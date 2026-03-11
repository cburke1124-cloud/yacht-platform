'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';

interface TierConfig {
  name: string;
  price: number;
  listings: number;
  images_per_listing: number;
  videos_per_listing: number;
  features: string[];
  trial_days: number;
  active: boolean;
  is_custom_pricing?: boolean;
}

const DEFAULT_TIERS: Record<string, TierConfig> = {
  free: {
    name: 'Free',
    price: 0,
    listings: 5,
    images_per_listing: 5,
    videos_per_listing: 0,
    features: ['5 active listings', '5 images per listing', 'Basic search visibility', 'Email support'],
    trial_days: 0,
    active: true
  },
  basic: {
    name: 'Basic',
    price: 29,
    listings: 25,
    images_per_listing: 15,
    videos_per_listing: 1,
    features: ['25 active listings', '15 images per listing', '1 video per listing', 'Enhanced search visibility', 'Priority email support', 'Analytics dashboard'],
    trial_days: 14,
    active: true
  },
  premium: {
    name: 'Premium',
    price: 99,
    listings: 999999,
    images_per_listing: 50,
    videos_per_listing: 5,
    features: ['Unlimited listings', '50 images per listing', '5 videos per listing', 'Top search placement', 'Featured dealer badge', 'Priority support', 'Advanced analytics', 'AI scraper tools'],
    trial_days: 30,
    active: true
  },
  ultimate: {
    name: 'Ultimate',
    price: 0,
    listings: 999999,
    images_per_listing: 999999,
    videos_per_listing: 999999,
    features: ['Unlimited listings', 'Unlimited images & video', 'White-glove onboarding', 'Dedicated account manager', 'Custom API integrations', 'Branded micro-site', 'Premium search placement', 'Co-brokering network access'],
    trial_days: 0,
    active: true,
    is_custom_pricing: true,
  }
};

export default function AdminSubscriptionTab() {
  const [tiers, setTiers] = useState<Record<string, TierConfig>>(DEFAULT_TIERS);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [formData, setFormData] = useState<TierConfig | null>(null);

  useEffect(() => {
    loadTierConfig();
  }, []);

  const loadTierConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/subscription-config'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTiers(data.tiers || DEFAULT_TIERS);
      }
    } catch (error) {
      console.error('Failed to load tier config:', error);
      // Use defaults if backend doesn't have endpoint yet
    }
  };

  const handleEdit = (tierId: string) => {
    setEditingTier(tierId);
    setFormData({ ...tiers[tierId] });
  };

  const handleSave = async () => {
    if (!editingTier || !formData) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/subscription-config'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tier_id: editingTier,
          config: formData
        })
      });

      if (response.ok) {
        setTiers({ ...tiers, [editingTier]: formData });
        setEditingTier(null);
        setFormData(null);
        alert('Subscription tier updated successfully!');
      } else {
        alert('Failed to update tier. Make sure backend endpoint exists.');
      }
    } catch (error) {
      console.error('Failed to save tier:', error);
      alert('Failed to save tier configuration');
    }
  };

  const handleCancel = () => {
    setEditingTier(null);
    setFormData(null);
  };

  const addFeature = () => {
    if (formData) {
      setFormData({
        ...formData,
        features: [...formData.features, '']
      });
    }
  };

  const updateFeature = (index: number, value: string) => {
    if (formData) {
      const newFeatures = [...formData.features];
      newFeatures[index] = value;
      setFormData({ ...formData, features: newFeatures });
    }
  };

  const removeFeature = (index: number) => {
    if (formData) {
      setFormData({
        ...formData,
        features: formData.features.filter((_, i) => i !== index)
      });
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Subscription Tier Management</h2>
        <p className="text-gray-600">
          Configure pricing, limits, and features for each subscription tier
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(tiers).map(([tierId, tier]) => (
          <div
            key={tierId}
            className={`bg-white rounded-xl shadow-lg p-6 ${
              tierId === 'ultimate'
                ? 'border-2 border-secondary ring-2 ring-secondary/20'
                : tierId === 'premium'
                ? 'border-2 border-primary'
                : ''
            }`}
          >
            {/* Tier Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                {tierId === 'ultimate' && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded text-secondary" style={{ backgroundColor: '#D4AF37' }}>ENTERPRISE</span>
                )}
              </div>
              {!tier.active && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                  Inactive
                </span>
              )}
            </div>

            {/* Price */}
            <div className="mb-6">
              {tier.is_custom_pricing ? (
                <div>
                  <span className="text-2xl font-bold text-secondary">Custom</span>
                  <span className="text-gray-500 ml-1 text-sm">pricing</span>
                </div>
              ) : (
                <div>
                  <span className="text-4xl font-bold text-gray-900">${tier.price}</span>
                  <span className="text-gray-600">/month</span>
                </div>
              )}
            </div>

            {/* Limits */}
            <div className="mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Listings:</span>
                <span className="font-semibold">
                  {tier.listings === 999999 ? 'Unlimited' : tier.listings}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Images/listing:</span>
                <span className="font-semibold">{tier.images_per_listing}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Videos/listing:</span>
                <span className="font-semibold">{tier.videos_per_listing}</span>
              </div>
              {tier.trial_days > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Free trial:</span>
                  <span className="font-semibold">{tier.trial_days} days</span>
                </div>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-6">
              {tier.features.slice(0, 4).map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
              {tier.features.length > 4 && (
                <li className="text-sm text-gray-500">
                  +{tier.features.length - 4} more features
                </li>
              )}
            </ul>

            {/* Edit Button */}
            <button
              onClick={() => handleEdit(tierId)}
              className="w-full py-2 px-4 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 font-medium"
            >
              Edit Tier
            </button>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingTier && formData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-2xl font-bold mb-6">
                Edit {formData.name} Tier
              </h3>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tier Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price ($/month)
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Listings Limit
                    </label>
                    <input
                      type="number"
                      value={formData.listings}
                      onChange={(e) => setFormData({ ...formData, listings: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="999999 = unlimited"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Images/Listing
                    </label>
                    <input
                      type="number"
                      value={formData.images_per_listing}
                      onChange={(e) => setFormData({ ...formData, images_per_listing: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Videos/Listing
                    </label>
                    <input
                      type="number"
                      value={formData.videos_per_listing}
                      onChange={(e) => setFormData({ ...formData, videos_per_listing: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Trial Days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Free Trial Days
                  </label>
                  <input
                    type="number"
                    value={formData.trial_days}
                    onChange={(e) => setFormData({ ...formData, trial_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0 = no trial"
                  />
                </div>

                {/* Features */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Features
                    </label>
                    <button
                      type="button"
                      onClick={addFeature}
                      className="text-sm text-primary hover:text-primary/90"
                    >
                      + Add Feature
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => updateFeature(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Feature description"
                        />
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Status */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Tier is active (visible to users)
                    </span>
                  </label>
                </div>

                {/* Custom Pricing */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!formData.is_custom_pricing}
                      onChange={(e) => setFormData({ ...formData, is_custom_pricing: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Custom / enterprise pricing (hides Stripe, shows "Contact Us")
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-primary/10 border border-primary/20 rounded-lg p-6">
        <h4 className="font-semibold text-secondary mb-3">ℹ️ Subscription Managgement</h4>
        <ul className="text-sm text-primary space-y-2">
          <li>• Changes take effect immediately for new subscriptions</li>
          <li>• Existing subscribers keep their current tier limits until renewal</li>
          <li>• Free trial applies only to new signups for paid tiers</li>
          <li>• Set listings to 999999 for "unlimited"</li>
          <li>• Inactive tiers won't show in registration but existing users keep access</li>
        </ul>
      </div>
    </div>
  );
}