'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, CheckCircle, RefreshCw, Zap, Link, XCircle, Check } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type SyncSettings = {
  sync_enabled: boolean;
  sync_leads: boolean;
  sync_contacts: boolean;
  sync_messages: boolean;
};

type RecentSync = {
  type: string;
  status: string;
  synced_at: string;
};

type CRMStatus = {
  connected: boolean;
  crm_type?: string;
  settings?: SyncSettings;
  last_sync?: string;
  recent_syncs?: RecentSync[];
};

type Credentials = {
  api_key: string;
  access_token: string;
  account_id: string;
  portal_id: string;
  instance_url: string;
  api_endpoint: string;
};

type SettingConfig = {
  key: keyof SyncSettings;
  label: string;
  desc: string;
};

export default function CRMSettings() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

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
  const [crmType, setCrmType] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<CRMStatus | null>(null);
  
  const [selectedCRM, setSelectedCRM] = useState<'hubspot' | 'gohighlevel' | 'pipedrive' | 'zoho' | 'activecampaign' | 'salesforce'>('hubspot');
  const [credentials, setCredentials] = useState<Credentials>({
    api_key: '',
    access_token: '',
    account_id: '',
    portal_id: '',
    instance_url: '',
    api_endpoint: ''
  });
  
  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookFormat, setWebhookFormat] = useState<'json' | 'adf_xml'>('json');
  const [webhookAuthType, setWebhookAuthType] = useState<'none' | 'api_key' | 'bearer' | 'basic'>('none');
  const [webhookAuthToken, setWebhookAuthToken] = useState('');
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [webhookTestPassed, setWebhookTestPassed] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'crm' | 'webhook'>('crm');
  
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    sync_enabled: true,
    sync_leads: true,
    sync_contacts: true,
    sync_messages: true
  });

  useEffect(() => {
    fetchStatus();
    fetchWebhookConfig();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/integrations'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const statusData: CRMStatus = {
          connected: data.length > 0,
          crm_type: data[0]?.crm_type,
          settings: data[0] ? {
            sync_enabled: data[0].active,
            sync_leads: data[0].sync_leads,
            sync_contacts: data[0].sync_contacts,
            sync_messages: data[0].sync_messages
          } : syncSettings,
          last_sync: data[0]?.last_sync
        };
        
        setStatus(statusData);
        setConnected(statusData.connected);
        if (statusData.connected && statusData.crm_type) {
          setCrmType(statusData.crm_type);
          setSyncSettings(statusData.settings || syncSettings);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch CRM status:', error);
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      let apiKey = '';
      
      switch(selectedCRM) {
        case 'hubspot':
          apiKey = credentials.access_token;
          break;
        case 'gohighlevel':
          apiKey = credentials.api_key;
          break;
        case 'pipedrive':
          apiKey = credentials.api_key;
          break;
        case 'zoho':
          apiKey = credentials.api_key;
          break;
        case 'activecampaign':
          apiKey = credentials.api_key;
          break;
        case 'salesforce':
          apiKey = `${credentials.instance_url}|${credentials.access_token}`;
          break;
        default:
          apiKey = '';
      }
      
      if (!apiKey || apiKey === '|') {
        alert('Please provide valid credentials');
        setConnecting(false);
        return;
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/integrations'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          crm_type: selectedCRM,
          api_key: apiKey,
          sync_leads: true,
          sync_contacts: true,
          sync_messages: true
        })
      });
      
      if (response.ok) {
        alert('CRM connected successfully!');
        fetchStatus();
        setCredentials({ api_key: '', access_token: '', account_id: '', portal_id: '', instance_url: '', api_endpoint: '' });
      } else {
        alert('Failed to connect CRM');
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect CRM');
    } finally {
      setConnecting(false);
    }
  };

  const getCredentialValid = () => {
    switch(selectedCRM) {
      case 'hubspot':
        return !!credentials.access_token;
      case 'gohighlevel':
        return !!credentials.api_key;
      case 'pipedrive':
        return !!credentials.api_key;
      case 'zoho':
        return !!credentials.api_key;
      case 'activecampaign':
        return !!credentials.api_key;
      case 'salesforce':
        return !!credentials.instance_url && !!credentials.access_token;
      default:
        return false;
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/settings'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncSettings)
      });
      
      if (response.ok) {
        alert('Settings updated!');
        fetchStatus();
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update settings');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect CRM? This will stop all syncing.')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/disconnect'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('CRM disconnected');
        fetchStatus();
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const fetchWebhookConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/webhooks/config'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setWebhookUrl(data.webhook_url);
          setWebhookFormat(data.format_type || 'json');
          setWebhookAuthType(data.auth_type || 'none');
          setWebhookConfigured(true);
          setWebhookTestPassed(data.test_passed);
        }
      }
    } catch (error) {
      console.error('Failed to fetch webhook config:', error);
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookUrl.trim()) {
      alert('Webhook URL is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/webhooks/config'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhook_url: webhookUrl,
          format_type: webhookFormat,
          auth_type: webhookAuthType,
          auth_token: webhookAuthToken
        })
      });

      if (response.ok) {
        alert('Webhook configuration saved!');
        setWebhookConfigured(true);
      } else {
        alert('Failed to save webhook configuration');
      }
    } catch (error) {
      console.error('Error saving webhook:', error);
      alert('Error saving webhook configuration');
    }
  };

  const handleTestWebhook = async () => {
    setWebhookTesting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/webhooks/test'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        setWebhookTestPassed(true);
        alert(`✅ Test webhook delivered successfully!`);
      } else {
        alert(`❌ Test webhook failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      alert('Error testing webhook');
    } finally {
      setWebhookTesting(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!confirm('Delete webhook configuration? Leads will no longer be sent to your DMS.')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/webhooks/config'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Webhook configuration deleted');
        setWebhookConfigured(false);
        setWebhookUrl('');
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const settingConfigs: SettingConfig[] = [
    { key: 'sync_enabled', label: 'Enable Auto-Sync', desc: 'Automatically sync new data' },
    { key: 'sync_leads', label: 'Sync Leads', desc: 'Create leads/contacts from inquiries' },
    { key: 'sync_contacts', label: 'Sync Contacts', desc: 'Keep contact information updated' },
    { key: 'sync_messages', label: 'Sync Messages', desc: 'Add messages as notes/activities' }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Settings size={32} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-dark">CRM Integration</h1>
          <p className="text-dark/70">Sync leads and contacts with your CRM</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-8 border-b-2 border-gray-200">
        <button
          onClick={() => setActiveTab('crm')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'crm'
              ? 'border-b-2 border-primary text-primary -mb-0.5'
              : 'text-dark/70 hover:text-dark'
          }`}
        >
          📊 CRM Integration
        </button>
        <button
          onClick={() => setActiveTab('webhook')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'webhook'
              ? 'border-b-2 border-primary text-primary -mb-0.5'
              : 'text-dark/70 hover:text-dark'
          }`}
        >
          🪝 Direct Webhook
        </button>
      </div>

      {/* CRM Tab Content */}
      {activeTab === 'crm' ? (
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="text-primary" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark">
                  Connected to {crmType === 'hubspot' ? 'HubSpot' : 'GoHighLevel'}
                </h2>
                <p className="text-sm text-dark/60">
                  Last sync: {status?.last_sync ? new Date(status.last_sync).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleDisconnect} 
              className="px-5 py-2.5 text-white bg-secondary hover:bg-secondary/90 rounded-lg transition-colors font-medium flex items-center gap-2"
            >
              <XCircle size={18} />
              Disconnect
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-dark text-lg">Sync Settings</h3>
            
            {settingConfigs.map(setting => (
              <div key={setting.key} className="flex items-center justify-between p-4 bg-soft rounded-xl border border-gray-200">
                <div>
                  <p className="font-semibold text-dark">{setting.label}</p>
                  <p className="text-sm text-dark/60">{setting.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncSettings[setting.key]}
                    onChange={(e) => setSyncSettings({ ...syncSettings, [setting.key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            ))}

            <button 
              onClick={handleUpdateSettings} 
              className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 font-semibold transition-all shadow-lg mt-4"
            >
              Save Settings
            </button>
          </div>

          {status?.recent_syncs && status.recent_syncs.length > 0 && (
            <div className="pt-6 border-t border-gray-200 mt-6">
              <h3 className="font-semibold text-dark mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {status.recent_syncs.map((sync: RecentSync, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm p-3 bg-soft rounded-lg border border-gray-200">
                    <span className="text-dark/80 font-medium">{sync.type} - {sync.status}</span>
                    <span className="text-dark/50 text-xs">{new Date(sync.synced_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 mb-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-dark mb-3">Connect Your CRM</h2>
            <p className="text-dark/70 mb-6">Automatically sync leads, contacts, and messages with your CRM</p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { id: 'hubspot', emoji: '🟠', name: 'HubSpot', desc: 'Connect with HubSpot CRM' },
                { id: 'gohighlevel', emoji: '⚡', name: 'GoHighLevel', desc: 'Connect with GHL' },
                { id: 'pipedrive', emoji: '📊', name: 'Pipedrive', desc: 'Sales-focused CRM' },
                { id: 'zoho', emoji: '🎯', name: 'Zoho CRM', desc: 'Feature-rich platform' },
                { id: 'activecampaign', emoji: '✉️', name: 'ActiveCampaign', desc: 'CRM + automation' },
                { id: 'salesforce', emoji: '☁️', name: 'Salesforce', desc: 'Enterprise CRM' }
              ].map((crm) => (
                <button
                  key={crm.id}
                  onClick={() => setSelectedCRM(crm.id as any)}
                  className={`p-5 border-2 rounded-xl transition-all ${
                    selectedCRM === crm.id 
                      ? 'border-primary bg-primary/5 shadow-lg' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-2">{crm.emoji}</div>
                    <h3 className="font-bold text-dark text-sm">{crm.name}</h3>
                    <p className="text-xs text-dark/60 mt-1">{crm.desc}</p>
                    {selectedCRM === crm.id && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 text-primary text-xs font-semibold">
                          <Check size={14} /> Selected
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            {selectedCRM === 'hubspot' ? (
              <div>
                <label className="block text-sm font-semibold text-dark mb-2">Access Token *</label>
                <input
                  type="password"
                  value={credentials.access_token}
                  onChange={(e) => setCredentials({ ...credentials, access_token: e.target.value })}
                  placeholder="pat-na1-..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                />
                <p className="text-xs text-dark/60 mt-2 flex items-start gap-2">
                  <span className="text-primary">💡</span>
                  Get from HubSpot Settings → Integrations → Private Apps
                </p>
              </div>
            ) : selectedCRM === 'gohighlevel' ? (
              <div>
                <label className="block text-sm font-semibold text-dark mb-2">API Key *</label>
                <input
                  type="password"
                  value={credentials.api_key}
                  onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                  placeholder="Your GoHighLevel API key"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                />
                <p className="text-xs text-dark/60 mt-2 flex items-start gap-2">
                  <span className="text-primary">💡</span>
                  Get from GHL Settings → API
                </p>
              </div>
            ) : selectedCRM === 'pipedrive' ? (
              <div>
                <label className="block text-sm font-semibold text-dark mb-2">API Token *</label>
                <input
                  type="password"
                  value={credentials.api_key}
                  onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                  placeholder="Your Pipedrive API token"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                />
                <p className="text-xs text-dark/60 mt-2 flex items-start gap-2">
                  <span className="text-primary">💡</span>
                  Get from Pipedrive Settings → Personal Preferences → API
                </p>
              </div>
            ) : selectedCRM === 'zoho' ? (
              <div>
                <label className="block text-sm font-semibold text-dark mb-2">OAuth Token *</label>
                <input
                  type="password"
                  value={credentials.api_key}
                  onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                  placeholder="Your Zoho OAuth token"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                />
                <p className="text-xs text-dark/60 mt-2 flex items-start gap-2">
                  <span className="text-primary">💡</span>
                  Get from Zoho Settings → Integrations → Connections
                </p>
              </div>
            ) : selectedCRM === 'activecampaign' ? (
              <div>
                <label className="block text-sm font-semibold text-dark mb-2">API Token *</label>
                <input
                  type="password"
                  value={credentials.api_key}
                  onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                  placeholder="Your ActiveCampaign API token"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                />
                <p className="text-xs text-dark/60 mt-2 flex items-start gap-2">
                  <span className="text-primary">💡</span>
                  Get from ActiveCampaign Settings → Integrations → API
                </p>
              </div>
            ) : selectedCRM === 'salesforce' ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-dark mb-2">Instance URL *</label>
                  <input
                    type="text"
                    value={credentials.instance_url}
                    onChange={(e) => setCredentials({ ...credentials, instance_url: e.target.value })}
                    placeholder="https://yourinstance.salesforce.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark mb-2">Access Token *</label>
                  <input
                    type="password"
                    value={credentials.access_token}
                    onChange={(e) => setCredentials({ ...credentials, access_token: e.target.value })}
                    placeholder="Your Salesforce access token"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                  />
                </div>
                <p className="text-xs text-dark/60 flex items-start gap-2">
                  <span className="text-primary">💡</span>
                  Get from Salesforce Setup → Apps → App Manager → Create OAuth app
                </p>
              </>
            ) : null}

            <button
              onClick={handleConnect}
              disabled={connecting || !getCredentialValid()}
              className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              {connecting ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link size={20} />
                  Connect {selectedCRM.charAt(0).toUpperCase() + selectedCRM.slice(1).replace(/([A-Z])/g, ' $1')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Webhook Tab Content */}
      {activeTab === 'webhook' && (
        <div>
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="text-primary" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark">
                  {webhookConfigured ? '✅ Webhook Configured' : '🪝 Configure Direct Webhook'}
                </h2>
                <p className="text-sm text-dark/60">
                  Send leads directly to your DMS, CRM, or custom system via webhook
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-dark mb-2">Webhook URL *</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-dms.com/webhook/leads"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                />
                <p className="text-xs text-dark/60 mt-2 flex items-start gap-2">
                  <span className="text-primary">💡</span>
                  Enter the webhook URL from your DMS or CRM system
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark mb-2">Format Type</label>
                  <select
                    value={webhookFormat}
                    onChange={(e) => setWebhookFormat(e.target.value as 'json' | 'adf_xml')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                  >
                    <option value="json">JSON (Standard)</option>
                    <option value="adf_xml">ADF XML (DMS Standard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-dark mb-2">Authentication</label>
                  <select
                    value={webhookAuthType}
                    onChange={(e) => setWebhookAuthType(e.target.value as any)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                  >
                    <option value="none">None</option>
                    <option value="api_key">API Key (X-API-Key header)</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                </div>
              </div>

              {webhookAuthType !== 'none' && (
                <div>
                  <label className="block text-sm font-semibold text-dark mb-2">
                    {webhookAuthType === 'api_key' ? 'API Key' : webhookAuthType === 'bearer' ? 'Token' : 'Credentials'}
                  </label>
                  <input
                    type="password"
                    value={webhookAuthToken}
                    onChange={(e) => setWebhookAuthToken(e.target.value)}
                    placeholder={
                      webhookAuthType === 'api_key'
                        ? 'Your API key'
                        : webhookAuthType === 'bearer'
                        ? 'Bearer token'
                        : 'base64 encoded credentials'
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-dark"
                  />
                </div>
              )}

              <div className="bg-primary/10 border-l-4 border-primary p-4 rounded-lg">
                <p className="text-sm text-dark/80">
                  <strong>Supported Format:</strong> {webhookFormat === 'adf_xml' ? 'ADF XML' : 'JSON'} with vehicle/lead data
                </p>
                <p className="text-xs text-dark/60 mt-2">
                  Each new inquiry will POST to your webhook URL with buyer contact info and listing details.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveWebhook}
                  className="flex-1 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 font-semibold transition-all"
                >
                  💾 Save Configuration
                </button>
                <button
                  onClick={handleTestWebhook}
                  disabled={!webhookUrl || webhookTesting}
                  className="flex-1 px-6 py-3 bg-secondary text-white rounded-xl hover:bg-secondary/90 disabled:bg-gray-300 font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {webhookTesting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      🧪 Test Webhook
                    </>
                  )}
                </button>
              </div>

              {webhookTestPassed && (
                <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl text-green-800 flex items-center gap-2">
                  <CheckCircle size={20} />
                  <span>✅ Test passed! Webhook is working correctly.</span>
                </div>
              )}

              {webhookConfigured && (
                <button
                  onClick={handleDeleteWebhook}
                  className="w-full px-6 py-3 border-2 border-secondary text-secondary rounded-xl hover:bg-secondary/10 font-semibold transition-all"
                >
                  🗑️ Delete Configuration
                </button>
              )}
            </div>
          </div>

          {/* Webhook Documentation */}
          <div className="bg-gradient-to-br from-primary/10 to-soft rounded-2xl border-2 border-primary/20 p-6">
            <h3 className="font-bold text-dark mb-4 flex items-center gap-2">
              <Zap size={22} className="text-primary" />
              How Webhooks Work
            </h3>
            <ul className="space-y-3 text-sm text-dark/80">
              <li className="flex items-start gap-3">
                <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                <span>When a buyer submits an inquiry, we POST the lead data to your webhook URL</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                <span>Choose JSON format for custom integrations, or ADF XML for DMS compatibility</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                <span>Includes buyer contact info (name, email, phone) and yacht listing details</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                <span>Authenticate with API key, Bearer token, or Basic auth if needed</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                <span>Real-time delivery with automatic retry on failure</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Info Box - CRM Tab Only */}
      {activeTab === 'crm' && (
      <div className="bg-gradient-to-br from-primary/10 to-soft rounded-2xl border-2 border-primary/20 p-6">
        <h3 className="font-bold text-dark mb-4 flex items-center gap-2">
          <Zap size={22} className="text-primary" />
          How CRM Integration Works
        </h3>
        <ul className="space-y-3 text-sm text-dark/80">
          <li className="flex items-start gap-3">
            <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
            <span>New inquiries automatically create contacts/leads in your CRM</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
            <span>Deals/opportunities are created with yacht details and pricing</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
            <span>Messages are added as notes/activities on contact records</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
            <span>All syncing happens in real-time in the background</span>
          </li>
        </ul>
      </div>
      )}
    </div>
  );
}