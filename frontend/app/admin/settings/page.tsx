'use client';

import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

// ─── Shared types ─────────────────────────────────────────────────────────────

type TierConfig = {
  name: string;
  price: number;
  listings: number;
  images_per_listing: number;
  videos_per_listing: number;
  features: string[];
  trial_days: number;
  active: boolean;
};

type TiersRecord = Record<string, TierConfig>;

// ─── Default dealer tiers — fallback if DB fetch fails ───────────────────────
// The 'name' field here is what's shown on pricing pages and in registration.
// It is FULLY EDITABLE in the admin UI below — changes are saved to the
// subscription_tiers table (user_type='dealer') and served via the API.
// Internal keys (basic, plus, pro) are stable identifiers used by Stripe and
// the backend — never change these keys once subscriptions are live.
const DEFAULT_DEALER_TIERS: TiersRecord = {
  basic: {
    name: 'Basic',
    price: 29,
    listings: 25,
    images_per_listing: 15,
    videos_per_listing: 1,
    features: ['25 active listings', '15 images per listing', '1 video per listing', 'Enhanced search visibility', 'Priority email support', 'Analytics dashboard'],
    trial_days: 14,
    active: true,
  },
  plus: {
    name: 'Plus',
    price: 59,
    listings: 75,
    images_per_listing: 30,
    videos_per_listing: 3,
    features: ['75 active listings', '30 images per listing', '3 videos per listing', 'Priority search placement', 'Featured dealer badge', 'Priority support', 'Advanced analytics'],
    trial_days: 14,
    active: true,
  },
  pro: {
    name: 'Pro',
    price: 99,
    listings: 999999,
    images_per_listing: 50,
    videos_per_listing: 5,
    features: ['Unlimited listings', '50 images per listing', '5 videos per listing', 'Top search placement', 'Featured dealer badge', 'Dedicated account manager', 'Advanced analytics', 'AI scraper tools'],
    trial_days: 30,
    active: true,
  },
};

// ─── Default private seller tiers — fallback if DB fetch fails ───────────────
// The 'name' field is FULLY EDITABLE in the admin UI — changes saved to
// subscription_tiers table (user_type='private'). Internal keys (private_basic,
// private_plus, private_pro) must never change once subscribers are live.
const DEFAULT_PRIVATE_TIERS: TiersRecord = {
  private_basic: {
    name: 'Basic',
    price: 9,
    listings: 1,
    images_per_listing: 20,
    videos_per_listing: 0,
    features: ['1 active listing', '20 photos per listing', 'Standard search visibility', 'Email support'],
    trial_days: 7,
    active: true,
  },
  private_plus: {
    name: 'Plus',
    price: 19,
    listings: 3,
    images_per_listing: 35,
    videos_per_listing: 1,
    features: ['3 active listings', '35 photos per listing', '1 video per listing', 'Priority search placement', 'Listing analytics'],
    trial_days: 7,
    active: true,
  },
  private_pro: {
    name: 'Pro',
    price: 39,
    listings: 10,
    images_per_listing: 50,
    videos_per_listing: 3,
    features: ['10 active listings', '50 photos per listing', '3 videos per listing', 'Top search placement', 'Featured badge', 'Priority support', 'Social media promotion'],
    trial_days: 14,
    active: true,
  },
};

// ─── Stripe price ID hints shown in the admin UI as reminders ────────────────
const STRIPE_KEY_HINTS: Record<string, string> = {
  basic:         'STRIPE_PRICE_DEALER_BASIC env var',
  plus:          'STRIPE_PRICE_DEALER_PLUS env var',
  pro:           'STRIPE_PRICE_DEALER_PRO env var',
  private_basic: 'STRIPE_PRICE_PRIVATE_BASIC env var',
  private_plus:  'STRIPE_PRICE_PRIVATE_PLUS env var',
  private_pro:   'STRIPE_PRICE_PRIVATE_PRO env var',
};

// ─── Reusable Tier Editor component ──────────────────────────────────────────

function TierEditor({
  tiers,
  onUpdate,
  onDelete,
  saving,
  onSave,
  saveEndpoint,
  userTypeLabel,
}: {
  tiers: TiersRecord;
  onUpdate: (id: string, field: keyof TierConfig, value: any) => void;
  onDelete: (id: string) => void;
  saving: boolean;
  onSave: () => void;
  saveEndpoint: string;
  userTypeLabel: string;
}) {
  const updateFeature = (tierId: string, idx: number, value: string) => {
    const updated = [...tiers[tierId].features];
    updated[idx] = value;
    onUpdate(tierId, 'features', updated);
  };

  const addFeature = (tierId: string) => {
    onUpdate(tierId, 'features', [...tiers[tierId].features, '']);
  };

  const removeFeature = (tierId: string, idx: number) => {
    const updated = tiers[tierId].features.filter((_, i) => i !== idx);
    onUpdate(tierId, 'features', updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Configure pricing and features for {userTypeLabel}. Changes save to{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">{saveEndpoint}</code>
        </p>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-400 text-sm font-medium transition-colors"
        >
          <Save size={16} />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {Object.entries(tiers).map(([tierId, tier]) => (
          <div
            key={tierId}
            className={`bg-white border-2 rounded-xl p-6 space-y-5 ${
              tier.active ? 'border-primary/30' : 'border-gray-200 opacity-60'
            }`}
          >
            {/* Tier header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-gray-400 block mb-1">{tierId}</span>
                <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Active toggle */}
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tier.active}
                    onChange={(e) => onUpdate(tierId, 'active', e.target.checked)}
                    className="w-4 h-4 text-primary rounded"
                  />
                  Active
                </label>
                <button
                  onClick={() => onDelete(tierId)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                  title="Delete tier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Stripe hint */}
            {STRIPE_KEY_HINTS[tierId] && (
              <div className="flex items-start gap-2 p-2 bg-primary/10 rounded-lg text-xs text-primary">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{STRIPE_KEY_HINTS[tierId]}</span>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
              <input
                type="text"
                value={tier.name}
                onChange={(e) => onUpdate(tierId, 'name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Price (USD/month)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={tier.price}
                  onChange={(e) => onUpdate(tierId, 'price', parseFloat(e.target.value) || 0)}
                  min={1}
                  step={1}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Limits row */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Listings</label>
                <input
                  type="number"
                  value={tier.listings === 999999 ? '' : tier.listings}
                  placeholder="∞"
                  onChange={(e) => onUpdate(tierId, 'listings', e.target.value === '' ? 999999 : parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Photos</label>
                <input
                  type="number"
                  value={tier.images_per_listing}
                  onChange={(e) => onUpdate(tierId, 'images_per_listing', parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Videos</label>
                <input
                  type="number"
                  value={tier.videos_per_listing}
                  onChange={(e) => onUpdate(tierId, 'videos_per_listing', parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Trial days */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trial Days</label>
              <input
                type="number"
                value={tier.trial_days}
                onChange={(e) => onUpdate(tierId, 'trial_days', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              />
              {tier.trial_days > 0 && (
                <p className="text-xs text-primary mt-1">{tier.trial_days}-day free trial shown on pricing pages</p>
              )}
            </div>

            {/* Features */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Features</label>
                <button
                  onClick={() => addFeature(tierId)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/90"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-1.5">
                {tier.features.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={f}
                      onChange={(e) => updateFeature(tierId, idx, e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-primary"
                      placeholder="Feature description…"
                    />
                    <button
                      onClick={() => removeFeature(tierId, idx)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <strong>Important:</strong> Price changes apply to new subscribers immediately. Existing subscribers
        continue at their original price until their next billing cycle or they manually upgrade/downgrade.
        Stripe price IDs are set via environment variables — update them in your server config when changing prices.
      </div>
    </div>
  );
}

// ─── Toast helper ─────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  return { toast, show };
}

// ─── Main AdminSettingsPage ───────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'banner' | 'dealer_subs' | 'private_subs'>('banner');

  // Banner
  const [bannerSettings, setBannerSettings] = useState({
    active: false,
    text: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'promotion',
    target: 'all' as 'all' | 'dealers' | 'buyers' | 'private',
  });

  // Dealer tiers
  const [dealerTiers, setDealerTiers] = useState<TiersRecord>(DEFAULT_DEALER_TIERS);
  const [savingDealer, setSavingDealer] = useState(false);

  // Private seller tiers
  const [privateTiers, setPrivateTiers] = useState<TiersRecord>(DEFAULT_PRIVATE_TIERS);
  const [savingPrivate, setSavingPrivate] = useState(false);

  const [bannerLoading, setBannerLoading] = useState(false);
  const { toast, show: showToast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const authHeader = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Banner
      const bannerRes = await fetch(apiUrl('/admin/settings'), { headers });
      if (bannerRes.ok) {
        const d = await bannerRes.json();
        if (d.banner) setBannerSettings({ active: d.banner.active || false, text: d.banner.text || '', type: d.banner.type || 'info', target: d.banner.target || 'all' });
      }

      // Dealer tiers
      const dealerRes = await fetch(apiUrl('/admin/subscription-config'), { headers });
      if (dealerRes.ok) {
        const d = await dealerRes.json();
        if (d.tiers) setDealerTiers(d.tiers);
      }

      // Private seller tiers — separate endpoint
      const privateRes = await fetch(apiUrl('/admin/subscription-config/private'), { headers });
      if (privateRes.ok) {
        const d = await privateRes.json();
        if (d.tiers) setPrivateTiers(d.tiers);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // ── Banner save ──────────────────────────────────────────────────────────
  const handleSaveBanner = async () => {
    setBannerLoading(true);
    try {
      const res = await fetch(apiUrl('/admin/settings/banner'), {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify(bannerSettings),
      });
      res.ok ? showToast('Banner settings saved.') : showToast('Failed to save banner settings.', 'error');
    } catch {
      showToast('Failed to save banner settings.', 'error');
    } finally {
      setBannerLoading(false);
    }
  };

  // ── Dealer tier helpers ──────────────────────────────────────────────────
  const updateDealerTier = (id: string, field: keyof TierConfig, value: any) => {
    setDealerTiers((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const deleteDealerTier = (id: string) => {
    if (!confirm(`Delete dealer tier "${dealerTiers[id].name}"?`)) return;
    setDealerTiers((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSaveDealerTiers = async () => {
    setSavingDealer(true);
    try {
      const res = await fetch(apiUrl('/admin/subscription-config'), {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify({ tiers: dealerTiers }),
      });
      res.ok
        ? showToast('Dealer subscription tiers saved.')
        : showToast('Failed to save dealer tiers.', 'error');
    } catch {
      showToast('Failed to save dealer tiers.', 'error');
    } finally {
      setSavingDealer(false);
    }
  };

  // ── Private seller tier helpers ──────────────────────────────────────────
  const updatePrivateTier = (id: string, field: keyof TierConfig, value: any) => {
    setPrivateTiers((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const deletePrivateTier = (id: string) => {
    if (!confirm(`Delete private seller tier "${privateTiers[id].name}"?`)) return;
    setPrivateTiers((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSavePrivateTiers = async () => {
    setSavingPrivate(true);
    try {
      const res = await fetch(apiUrl('/admin/subscription-config/private'), {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify({ tiers: privateTiers }),
      });
      res.ok
        ? showToast('Private seller subscription tiers saved.')
        : showToast('Failed to save private seller tiers.', 'error');
    } catch {
      showToast('Failed to save private seller tiers.', 'error');
    } finally {
      setSavingPrivate(false);
    }
  };

  const tabs = [
    { id: 'banner', label: '📢 Banner Settings' },
    { id: 'dealer_subs', label: '🏢 Dealer Subscriptions' },
    { id: 'private_subs', label: '👤 Private Seller Subscriptions' },
  ] as const;

  return (
    <div className="relative">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Site Settings</h1>
        <p className="text-gray-600 mt-1">Configure global platform settings, banners, and subscription pricing</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Banner Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'banner' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Site-Wide Banner</h2>

          <div className="space-y-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={bannerSettings.active}
                onChange={(e) => setBannerSettings({ ...bannerSettings, active: e.target.checked })}
                className="w-4 h-4 text-primary rounded"
              />
              <span className="text-sm font-medium text-gray-700">Show banner on site</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Banner Text</label>
              <input
                type="text"
                value={bannerSettings.text}
                onChange={(e) => setBannerSettings({ ...bannerSettings, text: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="e.g., 🎉 New feature: AI-powered listing import!"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Banner Type</label>
                <select
                  value={bannerSettings.type}
                  onChange={(e) => setBannerSettings({ ...bannerSettings, type: e.target.value as typeof bannerSettings.type })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="warning">Warning (Yellow)</option>
                  <option value="success">Success (Green)</option>
                  <option value="promotion">Promotion (Purple)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Show To</label>
                <select
                  value={bannerSettings.target}
                  onChange={(e) => setBannerSettings({ ...bannerSettings, target: e.target.value as typeof bannerSettings.target })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Everyone</option>
                  <option value="dealers">Dealers Only</option>
                  <option value="private">Private Sellers Only</option>
                  <option value="buyers">Buyers Only</option>
                </select>
              </div>
            </div>

            {bannerSettings.active && bannerSettings.text && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                <div className={`p-4 rounded-lg text-center font-medium ${
                  bannerSettings.type === 'info' ? 'bg-blue-50 text-blue-900 border border-blue-200' :
                  bannerSettings.type === 'warning' ? 'bg-yellow-50 text-yellow-900 border border-yellow-200' :
                  bannerSettings.type === 'success' ? 'bg-green-50 text-green-900 border border-green-200' :
                  'bg-purple-50 text-purple-900 border border-purple-200'
                }`}>
                  {bannerSettings.text}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <button
                onClick={handleSaveBanner}
                disabled={bannerLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-400 font-medium text-sm"
              >
                <Save size={16} />
                {bannerLoading ? 'Saving…' : 'Save Banner Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dealer Subscriptions Tab ─────────────────────────────────────── */}
      {activeTab === 'dealer_subs' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Dealer Subscription Tiers</h2>
            <p className="text-sm text-gray-500 mt-1">
              These tiers are shown on the <strong>/sell/list-brokers</strong> pricing page and in the
              dealer registration flow. Stripe price IDs for <code className="bg-gray-100 px-1 rounded text-xs">basic</code> and{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">premium</code> must match{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">STRIPE_PRICE_BASIC</code> /{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">STRIPE_PRICE_PREMIUM</code> env vars.
            </p>
          </div>
          <TierEditor
            tiers={dealerTiers}
            onUpdate={updateDealerTier}
            onDelete={deleteDealerTier}
            saving={savingDealer}
            onSave={handleSaveDealerTiers}
            saveEndpoint="PUT /api/admin/subscription-config"
            userTypeLabel="dealer accounts"
          />
        </div>
      )}

      {/* ── Private Seller Subscriptions Tab ─────────────────────────────── */}
      {activeTab === 'private_subs' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Private Seller Subscription Tiers</h2>
            <p className="text-sm text-gray-500 mt-1">
              These tiers are shown on the <strong>/sell/private</strong> pricing page and in the
              private seller registration flow. They are <strong>completely independent</strong> from dealer
              tiers — different prices, different features, different Stripe price IDs.
              Set <code className="bg-gray-100 px-1 rounded text-xs">STRIPE_PRICE_PRIVATE_BASIC</code> /{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">STRIPE_PRICE_PRIVATE_PREMIUM</code> env vars
              in your server config.
            </p>
          </div>
          <TierEditor
            tiers={privateTiers}
            onUpdate={updatePrivateTier}
            onDelete={deletePrivateTier}
            saving={savingPrivate}
            onSave={handleSavePrivateTiers}
            saveEndpoint="PUT /api/admin/subscription-config/private"
            userTypeLabel="private seller accounts"
          />
        </div>
      )}
    </div>
  );
}