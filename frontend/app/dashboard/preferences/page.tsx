'use client';

import { useState, useEffect } from 'react';
import { Globe, DollarSign, Ruler, Clock, Save } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type Preferences = {
  language: string;
  currency: string;
  units: string;
  timezone: string;
  marketing_opt_in: boolean;
  communication_email: boolean;
  communication_sms: boolean;
  communication_push: boolean;
};

type CurrencyRate = {
  [key: string]: number;
};

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState<Preferences>({
    language: 'en',
    currency: 'USD',
    units: 'imperial',
    timezone: 'America/New_York',
    marketing_opt_in: false,
    communication_email: true,
    communication_sms: false,
    communication_push: true
  });
  const [rates, setRates] = useState<CurrencyRate>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'zh', name: '中文', flag: '🇨🇳' }
  ];

  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso' }
  ];

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney'
  ];

  useEffect(() => {
    fetchPreferences();
    fetchRates();
  }, []);

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/preferences'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences((prev) => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRates = async () => {
    try {
      const response = await fetch(apiUrl('/currencies/rates'));
      if (response.ok) {
        const data = await response.json();
        setRates(data.rates);
      }
    } catch (error) {
      console.error('Failed to fetch rates:', error);
    }
  };

  const handleSave = async () => {
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
        alert('✅ Preferences saved! Reload the page to see changes.');
      } else {
        alert('Failed to save preferences');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const convertExample = (amount: number, from: string, to: string) => {
    if (!rates[to]) return amount;
    const rate = rates[to];
    return (amount * rate).toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Regional Preferences</h1>
        <p className="text-gray-600">Customize language, currency, and units for your region</p>
      </div>

      <div className="space-y-6">
        {/* Language */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Language</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => setPreferences({ ...preferences, language: lang.code })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  preferences.language === lang.code
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">{lang.flag}</div>
                <div className="font-medium text-sm">{lang.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="text-green-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Currency</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {currencies.map(curr => (
              <button
                key={curr.code}
                onClick={() => setPreferences({ ...preferences, currency: curr.code })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  preferences.currency === curr.code
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl font-bold mb-1">{curr.symbol}</div>
                <div className="font-medium text-sm">{curr.code}</div>
                <div className="text-xs text-gray-600">{curr.name}</div>
              </button>
            ))}
          </div>

          {/* Currency Preview */}
          {preferences.currency !== 'USD' && rates[preferences.currency] && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">💱 Currency Conversion Example:</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold">$100,000 USD</span>
                <span className="text-gray-500">→</span>
                <span className="font-semibold text-green-600">
                  {convertExample(100000, 'USD', preferences.currency)} {preferences.currency}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Exchange rate: 1 USD = {rates[preferences.currency]?.toFixed(4)} {preferences.currency}
              </p>
            </div>
          )}
        </div>

        {/* Units */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Ruler className="text-purple-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Measurement Units</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPreferences({ ...preferences, units: 'imperial' })}
              className={`p-6 rounded-lg border-2 transition-all ${
                preferences.units === 'imperial'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">📏</div>
              <div className="font-semibold text-lg mb-2">Imperial</div>
              <div className="text-sm text-gray-600">
                Feet, Gallons, Knots
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Common in USA
              </div>
            </button>

            <button
              onClick={() => setPreferences({ ...preferences, units: 'metric' })}
              className={`p-6 rounded-lg border-2 transition-all ${
                preferences.units === 'metric'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">📐</div>
              <div className="font-semibold text-lg mb-2">Metric</div>
              <div className="text-sm text-gray-600">
                Meters, Liters, Km/h
              </div>
              <div className="text-xs text-gray-500 mt-2">
                International standard
              </div>
            </button>
          </div>

          {/* Units Preview */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">🔄 Unit Conversion Examples:</p>
            <div className="space-y-1 text-sm">
              {preferences.units === 'metric' ? (
                <>
                  <div className="flex justify-between">
                    <span>80 feet</span>
                    <span className="font-semibold text-purple-600">→ 24.38 meters</span>
                  </div>
                  <div className="flex justify-between">
                    <span>500 gallons</span>
                    <span className="font-semibold text-purple-600">→ 1,893 liters</span>
                  </div>
                  <div className="flex justify-between">
                    <span>30 knots</span>
                    <span className="font-semibold text-purple-600">→ 55.6 km/h</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>24 meters</span>
                    <span className="font-semibold text-purple-600">→ 78.7 feet</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2000 liters</span>
                    <span className="font-semibold text-purple-600">→ 528 gallons</span>
                  </div>
                  <div className="flex justify-between">
                    <span>50 km/h</span>
                    <span className="font-semibold text-purple-600">→ 27 knots</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Timezone */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="text-orange-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Timezone</h2>
          </div>
          
          <select
            value={preferences.timezone}
            onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            {timezones.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {/* Communication Preferences */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Communication Preferences</h2>
          <p className="text-sm text-gray-600 mb-5">
            Manage how YachtVersal can contact you about account activity and updates.
          </p>

          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={preferences.communication_email}
                onChange={(e) => setPreferences({ ...preferences, communication_email: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <div>
                <p className="font-medium text-gray-900">Account Emails</p>
                <p className="text-sm text-gray-600">Receive important account and marketplace emails.</p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={preferences.communication_sms}
                onChange={(e) => setPreferences({ ...preferences, communication_sms: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <div>
                <p className="font-medium text-gray-900">Text Messages (SMS)</p>
                <p className="text-sm text-gray-600">Allow SMS notifications for urgent account updates. Data rates may apply.</p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={preferences.communication_push}
                onChange={(e) => setPreferences({ ...preferences, communication_push: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-600">Enable push notifications for the web and future mobile app.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 pt-2 border-t border-gray-100">
              <input
                type="checkbox"
                checked={preferences.marketing_opt_in}
                onChange={(e) => setPreferences({ ...preferences, marketing_opt_in: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <div>
                <p className="font-medium text-gray-900">Marketing Emails (Optional)</p>
                <p className="text-sm text-gray-600">Product updates, promotions, and listing growth tips.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-lg flex items-center justify-center gap-3"
          >
            {saving ? (
              'Saving...'
            ) : (
              <>
                <Save size={20} />
                Save Preferences
              </>
            )}
          </button>
          <p className="text-sm text-gray-600 text-center mt-3">
            Changes will take effect after you reload the page
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-3">💡 How Preferences Work</h4>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• All yacht prices will be converted to your selected currency automatically</li>
            <li>• Measurements (length, capacity, speed) will display in your chosen units</li>
            <li>• The interface will display in your selected language</li>
            <li>• Exchange rates are updated daily for accurate pricing</li>
            <li>• Your preferences are saved across all devices</li>
          </ul>
        </div>
      </div>
    </div>
  );
}