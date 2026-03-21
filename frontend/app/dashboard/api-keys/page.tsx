'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, AlertTriangle, Check, Key, RefreshCw } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  is_active: boolean;
  rate_limit: number;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
}

const sortApiKeys = (keys: APIKey[]) => {
  return [...keys].sort((left, right) => {
    if (left.is_active !== right.is_active) {
      return left.is_active ? -1 : 1;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
};

export default function APIKeysPage() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u || (u.user_type !== 'dealer' && u.user_type !== 'admin')) {
          router.replace('/dashboard');
        }
      });
  }, []);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newKeyName, setNewKeyName] = useState('Primary API Key');
  const [creating, setCreating] = useState(false);
  const [fullKeys, setFullKeys] = useState<Record<number, string>>({});
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/api-keys'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setApiKeys(sortApiKeys(data));
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      alert('Please enter a key name');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/api-keys'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newKeyName.trim() })
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || 'Failed to create API key');
        return;
      }

      const createdKey: APIKey = {
        id: result.id,
        name: result.name,
        key_prefix: result.key_prefix,
        is_active: true,
        rate_limit: 1000,
        created_at: result.created_at,
      };

      setApiKeys((prev) => sortApiKeys([createdKey, ...prev]));
      setFullKeys((prev) => ({ ...prev, [result.id]: result.key }));
      alert('New API key created. Copy it now—this is the only time the full key is shown.');
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRegenerateKey = async (key: APIKey) => {
    if (!confirm(`Regenerate "${key.name}"? The old key will be deactivated immediately.`)) {
      return;
    }

    setRegeneratingId(key.id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api-keys/${key.id}/regenerate`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || 'Failed to regenerate API key');
        return;
      }

      setApiKeys((prev) => {
        const updated = prev.map((item) =>
          item.id === result.old_key_id ? { ...item, is_active: false } : item
        );
        const newEntry: APIKey = {
          id: result.id,
          name: result.name,
          key_prefix: result.key_prefix,
          is_active: result.is_active,
          rate_limit: result.rate_limit,
          created_at: result.created_at,
          expires_at: result.expires_at,
        };
        return sortApiKeys([newEntry, ...updated]);
      });

      setFullKeys((prev) => ({ ...prev, [result.id]: result.key }));
      alert('API key regenerated. Copy the new full key now.');
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
      alert('Failed to regenerate API key');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleToggleActive = async (key: APIKey) => {
    setTogglingId(key.id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api-keys/${key.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !key.is_active })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(result.detail || 'Failed to update key status');
        return;
      }

      setApiKeys((prev) => sortApiKeys(prev.map((item) =>
        item.id === key.id ? { ...item, is_active: !item.is_active } : item
      )));
    } catch (error) {
      console.error('Failed to toggle key status:', error);
      alert('Failed to update key status');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-dark mb-2">API Keys</h1>
        <p className="text-dark/70">
          Manage your YachtVersal API keys for programmatic access
        </p>
      </div>

      <div className="glass-card p-4 mb-6">
        <p className="text-sm text-gray-600 mb-3">Create a new key (full key shown once at creation)</p>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
            placeholder="Key name"
          />
          <button
            onClick={handleCreateKey}
            disabled={creating}
            className="px-6 py-2 bg-primary text-light rounded-lg hover-primary disabled:bg-gray-400"
          >
            {creating ? 'Creating...' : 'Create API Key'}
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-dark/80">
              <strong>Important:</strong> Full API keys are only shown once when a key is created. Existing keys are stored securely and can only be displayed by prefix.
            </p>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 bg-soft rounded-2xl border-2 border-gray-200">
            <Key className="w-12 h-12 text-dark/40 mx-auto mb-4" />
            <p className="text-dark/70 font-medium">No API keys found</p>
            <p className="text-sm text-dark/50 mt-2">
              API keys are automatically generated when you create an account
            </p>
          </div>
        ) : (
          apiKeys.map((key) => (
            <div 
              key={key.id} 
              className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Key Name */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center min-w-0">
                      <h3 className="text-lg font-semibold text-dark truncate">{key.name}</h3>
                      <span className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${
                      key.is_active 
                        ? 'bg-primary/10 text-primary border border-primary/20' 
                        : 'bg-gray-100 text-dark/60 border border-gray-200'
                    }`}>
                      {key.is_active ? 'Active' : 'Inactive'}
                    </span>
                    </div>
                    <button
                      onClick={() => handleRegenerateKey(key)}
                      disabled={regeneratingId === key.id}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-soft border border-gray-200 text-secondary rounded-lg hover:bg-primary/10 disabled:opacity-60"
                    >
                      <RefreshCw size={14} className={regeneratingId === key.id ? 'animate-spin' : ''} />
                      {regeneratingId === key.id ? 'Regenerating...' : 'Regenerate'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(key)}
                      disabled={togglingId === key.id}
                      className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border disabled:opacity-60 ${key.is_active ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}
                    >
                      {togglingId === key.id ? 'Saving...' : key.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>

                  {/* Key Prefix */}
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-dark/60 uppercase tracking-wide block mb-2">
                      API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="bg-soft px-4 py-3 rounded-lg font-mono text-sm flex-1 text-dark border border-gray-200">
                        {fullKeys[key.id] || `${key.key_prefix}••••••••••••••••••••••••••`}
                      </code>
                      <button
                        onClick={() => copyToClipboard(fullKeys[key.id] || key.key_prefix, key.id)}
                        className="p-3 text-dark/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all border border-gray-200"
                        title="Copy key"
                      >
                        {copiedId === key.id ? (
                          <Check className="w-5 h-5 text-primary" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {copiedId === key.id && (
                      <p className="text-xs text-emerald-700 mt-2">Copied to clipboard.</p>
                    )}
                  </div>

                  {/* Key Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-soft p-3 rounded-lg border border-gray-200">
                      <span className="text-dark/60 block mb-1 text-xs font-medium">Created:</span>
                      <p className="text-dark font-semibold">
                        {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="bg-soft p-3 rounded-lg border border-gray-200">
                      <span className="text-dark/60 block mb-1 text-xs font-medium">Rate Limit:</span>
                      <p className="text-dark font-semibold">
                        {key.rate_limit.toLocaleString()} req/hr
                      </p>
                    </div>
                    {key.last_used_at && (
                      <div className="bg-soft p-3 rounded-lg border border-gray-200">
                        <span className="text-dark/60 block mb-1 text-xs font-medium">Last Used:</span>
                        <p className="text-dark font-semibold">
                          {new Date(key.last_used_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {key.expires_at && (
                      <div className="bg-soft p-3 rounded-lg border border-gray-200">
                        <span className="text-dark/60 block mb-1 text-xs font-medium">Expires:</span>
                        <p className="text-dark font-semibold">
                          {new Date(key.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Documentation Link */}
      <div className="mt-8 bg-primary/5 border-2 border-primary/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-dark mb-2 flex items-center gap-2">
          <span className="text-2xl">📚</span>
          API Documentation
        </h3>
        <p className="text-dark/70 mb-4">
          Learn how to use your API key to access YachtVersal programmatically
        </p>
        <a 
          href="/api/docs" 
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-primary hover:text-primary/80 font-semibold transition-colors"
        >
          View API Documentation
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Usage Example */}
      <div className="mt-6 bg-[#10214F] rounded-2xl p-6 border-2 border-[#10214F]">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span className="text-xl">💻</span>
          Usage Example
        </h4>
        <pre className="text-primary text-sm overflow-x-auto bg-[#0a1329] p-4 rounded-lg">
{`curl https://api.yachtversal.com/api/listings \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
        </pre>
      </div>
    </div>
  );
}