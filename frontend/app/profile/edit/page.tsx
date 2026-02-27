'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, Building, Save, X, Bell, Globe, DollarSign, Ruler } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  company_name: string;
  user_type: string;
  subscription_tier: string;
}

interface UserPreferences {
  language: string;
  currency: string;
  units: string;
  timezone: string;
}

interface NotificationSettings {
  email_new_message: boolean;
  email_new_inquiry: boolean;
  email_price_alert: boolean;
  email_new_listing_match: boolean;
  email_marketing: boolean;
}

export default function ProfileEditPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    language: 'en',
    currency: 'USD',
    units: 'imperial',
    timezone: 'America/New_York'
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email_new_message: true,
    email_new_inquiry: true,
    email_price_alert: true,
    email_new_listing_match: true,
    email_marketing: false
  });
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'notifications'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      // Fetch user profile
      const profileResponse = await fetch(apiUrl('/auth/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfile(profileData);
      }

      // Fetch preferences
      const prefsResponse = await fetch(apiUrl('/preferences'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (prefsResponse.ok) {
        const prefsData = await prefsResponse.json();
        setPreferences(prefsData);
      }

      // Fetch notification settings
      const settingsResponse = await fetch(apiUrl('/user/settings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setNotifications({
          email_new_message: settingsData.email_new_message ?? true,
          email_new_inquiry: settingsData.email_new_inquiry ?? true,
          email_price_alert: settingsData.email_price_alert ?? true,
          email_new_listing_match: settingsData.email_new_listing_match ?? true,
          email_marketing: settingsData.email_marketing ?? false
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      showMessage('error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/me'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        showMessage('success', 'Profile updated successfully!');
      } else {
        showMessage('error', 'Failed to update profile');
      }
    } catch (error) {
      console.error('Update failed:', error);
      showMessage('error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    setSaving(true);

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
        showMessage('success', 'Preferences updated successfully!');
      } else {
        showMessage('error', 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Update failed:', error);
      showMessage('error', 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationsUpdate = async () => {
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/user/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notifications)
      });

      if (response.ok) {
        showMessage('success', 'Notification settings updated!');
      } else {
        showMessage('error', 'Failed to update settings');
      }
    } catch (error) {
      console.error('Update failed:', error);
      showMessage('error', 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen section-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-light py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-secondary">Profile Settings</h1>
          <p className="text-dark/70 mt-1">Manage your account and preferences</p>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-current hover:opacity-70">
              <X size={18} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-dark/70 hover:text-dark'
              }`}
            >
              <User className="inline-block mr-2" size={20} />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'preferences'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-dark/70 hover:text-dark'
              }`}
            >
              <Globe className="inline-block mr-2" size={20} />
              Preferences
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-dark/70 hover:text-dark'
              }`}
            >
              <Bell className="inline-block mr-2" size={20} />
              Notifications
            </button>
          </div>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && profile && (
          <form onSubmit={handleProfileUpdate} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-secondary mb-6">Personal Information</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profile.first_name || ''}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profile.last_name || ''}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  <Mail className="inline mr-2" size={16} />
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-dark/70"
                />
                <p className="text-xs text-dark/70 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  <Phone className="inline mr-2" size={16} />
                  Phone
                </label>
                <input
                  type="tel"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {profile.user_type === 'dealer' && (
                <div>
                  <label className="block text-sm font-medium text-dark mb-2">
                    <Building className="inline mr-2" size={16} />
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={profile.company_name || ''}
                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              <div className="bg-primary/5 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-secondary">Account Type</p>
                    <p className="text-sm text-dark/70">{profile.user_type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary">Subscription</p>
                    <p className="text-sm text-dark/70 capitalize">{profile.subscription_tier}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-secondary mb-6">Display Preferences</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  <Globe className="inline mr-2" size={16} />
                  Language
                </label>
                <select
                  value={preferences.language}
                  onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="pt">Português</option>
                  <option value="zh">中文</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  <DollarSign className="inline mr-2" size={16} />
                  Currency
                </label>
                <select
                  value={preferences.currency}
                  onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="CNY">CNY - Chinese Yuan</option>
                  <option value="MXN">MXN - Mexican Peso</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  <Ruler className="inline mr-2" size={16} />
                  Measurement Units
                </label>
                <select
                  value={preferences.units}
                  onChange={(e) => setPreferences({ ...preferences, units: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="imperial">Imperial (feet, gallons, knots)</option>
                  <option value="metric">Metric (meters, liters, km/h)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Timezone
                </label>
                <select
                  value={preferences.timezone}
                  onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handlePreferencesUpdate}
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-secondary mb-6">Email Notifications</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div>
                  <p className="font-medium text-secondary">New Messages</p>
                  <p className="text-sm text-dark/70">Get notified when you receive a new message</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.email_new_message}
                    onChange={(e) => setNotifications({ ...notifications, email_new_message: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div>
                  <p className="font-medium text-secondary">New Inquiries</p>
                  <p className="text-sm text-dark/70">Get notified when someone inquires about your listing</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.email_new_inquiry}
                    onChange={(e) => setNotifications({ ...notifications, email_new_inquiry: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div>
                  <p className="font-medium text-secondary">Price Alerts</p>
                  <p className="text-sm text-dark/70">Get notified when a yacht's price drops</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.email_price_alert}
                    onChange={(e) => setNotifications({ ...notifications, email_price_alert: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div>
                  <p className="font-medium text-secondary">New Listing Matches</p>
                  <p className="text-sm text-dark/70">Get notified when new yachts match your saved searches</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.email_new_listing_match}
                    onChange={(e) => setNotifications({ ...notifications, email_new_listing_match: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div>
                  <p className="font-medium text-secondary">Marketing & Updates</p>
                  <p className="text-sm text-dark/70">Receive newsletters and promotional offers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.email_marketing}
                    onChange={(e) => setNotifications({ ...notifications, email_marketing: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleNotificationsUpdate}
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}