"use client";

import { useState, useEffect } from 'react';
import { Key, Copy, Trash2, Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw, Shield, Lock } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type APIKey = {
  id: number;
  key: string;
  key_preview: string;
  dealer_id: number;
  dealer_name: string;
  created_at: string;
  last_used: string | null;
  request_count: number;
  active: boolean;
  rate_limit: number;
};

type ListingSyndicationSetting = {
  listing_id: number;
  listing_title: string;
  listing_image: string;
  allow_api_access: boolean;
  blocked_keys: string[];
};

export default function AdminAPIKeyManagement() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'keys' | 'syndication'>('keys');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<number | null>(null);
  const [newKeyResponse, setNewKeyResponse] = useState<{key: string, dealer: string} | null>(null);
  const [syndicationSettings, setSyndicationSettings] = useState<ListingSyndicationSetting[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAPIKeys();
    fetchDealers();
    if (activeTab === 'syndication') {
      fetchSyndicationSettings();
    }
  }, [activeTab]);

  const fetchAPIKeys = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/api-keys'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDealers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/users?user_type=dealer'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDealers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch dealers:', error);
    }
  };

  const fetchSyndicationSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/syndication-settings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSyndicationSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch syndication settings:', error);
    }
  };

  const generateAPIKey = async () => {
    if (!selectedDealer) {
      alert('Please select a dealer');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/api-keys/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dealer_id: selectedDealer,
          rate_limit: 1000 // requests per hour
        })
      });

      if (response.ok) {
        const data = await response.json();
        setNewKeyResponse({
          key: data.api_key,
          dealer: dealers.find(d => d.id === selectedDealer)?.company_name || 'Unknown'
        });
        fetchAPIKeys();
      } else {
        alert('Failed to generate API key');
      }
    } catch (error) {
      console.error('Failed to generate API key:', error);
      alert('Failed to generate API key');
    }
  };

  const revokeAPIKey = async (keyId: number) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/api-keys/${keyId}/revoke`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchAPIKeys();
      }
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  const toggleListingSyndication = async (listingId: number, allow: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/listings/${listingId}/syndication`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ allow_api_access: allow })
      });

      if (response.ok) {
        setSyndicationSettings(prev =>
          prev.map(s => s.listing_id === listingId ? { ...s, allow_api_access: allow } : s)
        );
      }
    } catch (error) {
      console.error('Failed to update syndication:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const filteredSettings = syndicationSettings.filter(s =>
    s.listing_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">API Access Management</h2>
          <p className="text-gray-600 mt-1">Manage dealer API keys and listing syndication settings</p>
        </div>
        <button
          onClick={() => {
            setSelectedDealer(null);
            setShowNewKeyModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          <Key size={20} />
          Generate New API Key
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('keys')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'keys'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🔑 API Keys ({apiKeys.length})
          </button>
          <button
            onClick={() => setActiveTab('syndication')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'syndication'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🔒 Syndication Controls
          </button>
        </nav>
      </div>

      {/* API Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Key size={64} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No API Keys Generated</h3>
              <p className="text-gray-600 mb-6">Generate API keys for dealers to access listings via API</p>
              <button
                onClick={() => setShowNewKeyModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Generate First API Key
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dealer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Key</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{key.dealer_name}</div>
                        <div className="text-sm text-gray-500">ID: {key.dealer_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                            {key.key_preview}
                          </code>
                          <button
                            onClick={() => copyToClipboard(key.key)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Copy full key"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          key.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {key.active ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{key.request_count.toLocaleString()} requests</div>
                        <div className="text-xs text-gray-500">Limit: {key.rate_limit}/hr</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(key.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {key.active && (
                          <button
                            onClick={() => revokeAPIKey(key.id)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Syndication Controls Tab */}
      {activeTab === 'syndication' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search listings..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">About Syndication Controls</p>
                <p>Dealers can choose to block their listings from being accessed via API. This prevents third-party websites from syndicating their listings while still allowing them to appear on your platform.</p>
              </div>
            </div>
          </div>

          {/* Listings Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dealer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Access</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSettings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No listings found
                    </td>
                  </tr>
                ) : (
                  filteredSettings.map((setting) => (
                    <tr key={setting.listing_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={setting.listing_image || '/placeholder-yacht.jpg'}
                            alt={setting.listing_title}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                          <div>
                            <div className="font-medium text-gray-900">{setting.listing_title}</div>
                            <div className="text-sm text-gray-500">ID: {setting.listing_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {/* Would show dealer name here */}
                        Dealer Name
                      </td>
                      <td className="px-6 py-4">
                        {setting.allow_api_access ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle size={18} />
                            <span className="text-sm font-medium">Allowed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-600">
                            <Lock size={18} />
                            <span className="text-sm font-medium">Blocked</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleListingSyndication(setting.listing_id, !setting.allow_api_access)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            setting.allow_api_access
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {setting.allow_api_access ? 'Block API Access' : 'Allow API Access'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate API Key Modal */}
      {showNewKeyModal && !newKeyResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold mb-4">Generate API Key</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Dealer
              </label>
              <select
                value={selectedDealer || ''}
                onChange={(e) => setSelectedDealer(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Choose a dealer...</option>
                {dealers.map(dealer => (
                  <option key={dealer.id} value={dealer.id}>
                    {dealer.company_name || `${dealer.first_name} ${dealer.last_name}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-900">
                ⚠️ The API key will only be shown once. Make sure to copy it and send it to the dealer securely.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewKeyModal(false);
                  setSelectedDealer(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={generateAPIKey}
                disabled={!selectedDealer}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Key Generated Modal */}
      {newKeyResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">API Key Generated!</h3>
                <p className="text-gray-600">For {newKeyResponse.dealer}</p>
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-red-900 mb-2">⚠️ IMPORTANT - Copy This Key Now!</p>
              <p className="text-sm text-red-800">This key will only be shown once and cannot be retrieved later.</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-sm font-mono break-all border-2 border-gray-300">
                  {newKeyResponse.key}
                </code>
                <button
                  onClick={() => copyToClipboard(newKeyResponse.key)}
                  className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  title="Copy to clipboard"
                >
                  <Copy size={20} />
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900">
                <strong>Usage:</strong> Include this key in API requests as a header:<br/>
                <code className="text-xs bg-white px-2 py-1 rounded mt-2 inline-block">
                  X-API-Key: {newKeyResponse.key}
                </code>
              </p>
            </div>

            <button
              onClick={() => {
                setNewKeyResponse(null);
                setShowNewKeyModal(false);
                setSelectedDealer(null);
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
