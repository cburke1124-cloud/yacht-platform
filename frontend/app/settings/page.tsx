'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Save, Shield, Globe, DollarSign } from 'lucide-react';
import SecuritySettings from '@/app/components/SecuritySettings';
import ActivityLog from '@/app/components/ActivityLog';
import { apiUrl } from '@/app/lib/apiRoot';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'preferences' | 'security' | 'activity'>('preferences');

  const [settings, setSettings] = useState({
    // Email Notifications
    email_new_message: true,
    email_new_inquiry: true,
    email_price_alert: true,
    email_new_listing_match: true,
    email_marketing: false,
    
    // Preferences
    language: 'en',
    currency: 'USD',
    units: 'imperial',
    timezone: 'America/New_York'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab === 'preferences') fetchSettings();
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/user/settings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/user/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        // lightweight UX feedback
        // eslint-disable-next-line no-alert
        alert('Settings saved successfully!');
      } else {
        // eslint-disable-next-line no-alert
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      // eslint-disable-next-line no-alert
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen section-light py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary">Account Settings</h1>
          <p className="text-dark/70 mt-1">Manage your account preferences, security, and activity</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'preferences'
                ? 'border-primary text-primary'
                : 'border-transparent text-dark/70 hover:text-dark'
            }`}
          >
            Preferences
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Security
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Activity Log
          </button>
        </div>

        {/* Content */}
        {activeTab === 'preferences' && (
          <>
            {/* Email Notifications */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <Bell size={24} className="text-primary" />
                <h2 className="text-xl font-bold text-secondary">Email Notifications</h2>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'email_new_message', label: 'New messages and replies', desc: 'Get notified when someone sends you a message' },
                  { key: 'email_new_inquiry', label: 'New inquiries on your listings', desc: 'Receive alerts when buyers inquire about your yachts' },
                  { key: 'email_price_alert', label: 'Price drop alerts', desc: 'Get notified when saved listings drop in price' },
                  { key: 'email_new_listing_match', label: 'New listing matches', desc: 'Receive alerts for new listings matching your saved searches' },
                  { key: 'email_marketing', label: 'Marketing emails', desc: 'Promotional offers and platform updates' }
                ].map((item) => (
                  <label key={item.key} className="flex items-start gap-3 p-4 hover:bg-section-light rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[item.key as keyof typeof settings] as boolean}
                      onChange={(e) => setSettings({...settings, [item.key]: e.target.checked})}
                      className="mt-1 rounded text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-secondary">{item.label}</p>
                      <p className="text-sm text-dark/70">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <Globe size={24} className="text-primary" />
                <h2 className="text-xl font-bold text-secondary">Preferences</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark mb-2">Language</label>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings({...settings, language: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-2">Currency</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({...settings, currency: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-2">Units</label>
                  <select
                    value={settings.units}
                    onChange={(e) => setSettings({...settings, units: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="imperial">Imperial (ft, mph)</option>
                    <option value="metric">Metric (m, km/h)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-2">Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-400 font-medium flex items-center gap-2"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </>
        )}

        {activeTab === 'security' && (
          <div className="mt-6">
            <SecuritySettings />
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="mt-6">
            <ActivityLog />
          </div>
        )}
      </div>
    </div>
  );
}