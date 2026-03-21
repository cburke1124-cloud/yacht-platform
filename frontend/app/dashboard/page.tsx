"use client";

import { useState, useEffect } from 'react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import DealerFeaturedTab from '@/app/components/DealerFeaturedTab';
import LeadsManager from '@/app/dashboard/inquiries/LeadsManager';
import {
  PlusCircle, Eye, Edit, Trash2, Star, Users, Settings, User,
  BarChart3, MessageSquare, Bell, Globe, Heart, Search,
  CheckSquare, X, Archive, RefreshCw, Image, DollarSign,
  Building2, Link2, Link, Upload, CreditCard, Key, CheckCircle,
  XCircle, Check, Zap
} from 'lucide-react';

type TabId = 'listings' | 'leads' | 'featured' | 'media' | 'bulk' | 'team' | 'analytics' | 'crm' | 'billing' | 'account' | 'profile' | 'api-keys' | 'salesman-profile';

interface Listing {
  id: number;
  title: string;
  price?: number;
  status: string;
  year?: number;
  length_feet?: number;
  city?: string;
  state?: string;
  views?: number;
  inquiries?: number;
  featured?: boolean;
  featured_until?: string;
  images?: Array<{ url: string }>;
}

interface DashboardStats {
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalInquiries: number;
  featuredListings: number;
}

interface QuickEditDraft {
  title: string;
  price: string;
  status: string;
}

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

type AnalyticsRange = '7d' | '30d' | '90d';

type TeamPerformanceMember = {
  id: number;
  name: string;
  email: string;
  role?: string;
  listings_total: number;
  listings_active: number;
  views_total: number;
  listing_inquiries_total: number;
  inquiries_total: number;
  inquiries_current_period: number;
  pending_inquiries: number;
  replied_inquiries: number;
  response_rate: number;
  avg_response_hours: number | null;
  last_message_at: string | null;
  joined_at: string | null;
  active: boolean;
};

type TeamPerformanceData = {
  range_days: number;
  summary: {
    team_members: number;
    period_leads: number;
    previous_period_leads: number;
    lead_delta: number;
    lead_delta_percent: number;
    pending_inquiries: number;
    average_response_rate: number;
  };
  members: TeamPerformanceMember[];
};

export default function EnhancedDealerDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListings, setSelectedListings] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<DashboardStats>({
    totalListings: 0,
    activeListings: 0,
    totalViews: 0,
    totalInquiries: 0,
    featuredListings: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [quickEdits, setQuickEdits] = useState<Record<number, QuickEditDraft>>({});
  const [savingQuickEditId, setSavingQuickEditId] = useState<number | null>(null);
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('30d');
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformanceData | null>(null);
  const [teamPerformanceLoading, setTeamPerformanceLoading] = useState(false);

  // CRM State
  const [crmConnected, setCrmConnected] = useState(false);
  const [crmType, setCrmType] = useState('');
  const [crmLoading, setCrmLoading] = useState(true);
  const [crmConnecting, setCrmConnecting] = useState(false);
  const [crmStatus, setCrmStatus] = useState<CRMStatus | null>(null);
  const [selectedCRM, setSelectedCRM] = useState<'hubspot' | 'gohighlevel' | 'pipedrive' | 'zoho' | 'activecampaign' | 'salesforce'>('hubspot');
  const [credentials, setCredentials] = useState<Credentials>({
    api_key: '',
    access_token: '',
    account_id: '',
    portal_id: '',
    instance_url: '',
    api_endpoint: ''
  });
  const [crmSyncSettings, setCrmSyncSettings] = useState<SyncSettings>({
    sync_enabled: true,
    sync_leads: true,
    sync_contacts: true,
    sync_messages: true
  });

  useEffect(() => {
    fetchDashboardData();
    fetchCRMStatus();
    const token = localStorage.getItem('token');
    if (token) {
      fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setCurrentUser(data); })
        .catch(() => {});
    }

    // Confirm Stripe checkout session immediately when redirected back from Stripe
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('payment') === 'success' && sessionId && token) {
      fetch(apiUrl('/payments/confirm-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            // Refresh user so subscription_tier reflects the new plan
            return fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : null)
              .then(me => { if (me) setCurrentUser(me); });
          }
        })
        .catch(() => {});
      // Remove payment query params from URL without reloading
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
    }
  }, []);

  useEffect(() => {
    const days = analyticsRange === '7d' ? 7 : analyticsRange === '90d' ? 90 : 30;
    fetchTeamPerformance(days);
  }, [analyticsRange]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/my-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) {
          setLoading(false);
          return;
        }
        throw new Error(`Failed to load listings: ${response.status}`);
      }
      const data = await response.json();
      const listings = Array.isArray(data) ? data : [];
      setListings(listings);
      setQuickEdits(
        listings.reduce((acc: Record<number, QuickEditDraft>, listing: Listing) => {
          acc[listing.id] = {
            title: listing.title || '',
            price: listing.price != null ? String(listing.price) : '',
            status: listing.status || 'draft'
          };
          return acc;
        }, {})
      );

      const totalViews = listings.reduce((sum: number, l: Listing) => sum + (l.views || 0), 0);
      const totalInquiries = listings.reduce((sum: number, l: Listing) => sum + (l.inquiries || 0), 0);
      const featuredCount = listings.filter((l: Listing) => l.featured).length;

      setStats({
        totalListings: listings.length,
        activeListings: listings.filter((l: Listing) => l.status === 'active').length,
        totalViews,
        totalInquiries,
        featuredListings: featuredCount
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleListingSelection = (listingId: number) => {
    const newSelected = new Set(selectedListings);
    if (newSelected.has(listingId)) {
      newSelected.delete(listingId);
    } else {
      newSelected.add(listingId);
    }
    setSelectedListings(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedListings.size} listings?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/bulk-delete'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: Array.from(selectedListings) })
      });

      if (response.ok) {
        await fetchDashboardData();
        setSelectedListings(new Set());
        alert('Listings deleted successfully');
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Failed to delete listings');
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/bulk-status'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          ids: Array.from(selectedListings),
          status 
        })
      });

      if (response.ok) {
        await fetchDashboardData();
        setSelectedListings(new Set());
        alert(`Status changed to ${status}`);
      }
    } catch (error) {
      console.error('Bulk status change failed:', error);
      alert('Failed to change status');
    }
  };

  const updateQuickEditField = (listingId: number, field: keyof QuickEditDraft, value: string) => {
    setQuickEdits(prev => ({
      ...prev,
      [listingId]: {
        ...(prev[listingId] || { title: '', price: '', status: 'draft' }),
        [field]: value
      }
    }));
  };

  const saveQuickEdit = async (listingId: number) => {
    const draft = quickEdits[listingId];
    if (!draft) return;

    const payload: Record<string, unknown> = {
      title: draft.title.trim(),
      status: draft.status
    };

    if (draft.price.trim() === '') {
      payload.price = null;
    } else {
      const parsed = Number(draft.price);
      if (Number.isNaN(parsed)) {
        alert('Please enter a valid price');
        return;
      }
      payload.price = parsed;
    }

    setSavingQuickEditId(listingId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${listingId}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        alert(error.detail || 'Failed to save quick edit');
        return;
      }

      setListings(prev => prev.map((listing) =>
        listing.id === listingId
          ? {
              ...listing,
              title: String(payload.title ?? listing.title),
              status: String(payload.status ?? listing.status),
              price: payload.price == null ? undefined : Number(payload.price)
            }
          : listing
      ));
    } catch (error) {
      console.error('Quick edit failed:', error);
      alert('Failed to save quick edit');
    } finally {
      setSavingQuickEditId(null);
    }
  };

  const fetchTeamPerformance = async (days: number) => {
    setTeamPerformanceLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/team/performance?days=${days}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        setTeamPerformance(null);
        return;
      }

      const data = await response.json();
      setTeamPerformance(data);
    } catch (error) {
      console.error('Failed to fetch team performance:', error);
      setTeamPerformance(null);
    } finally {
      setTeamPerformanceLoading(false);
    }
  };

  // CRM Functions
  const fetchCRMStatus = async () => {
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
          } : crmSyncSettings,
          last_sync: data[0]?.last_sync
        };
        
        setCrmStatus(statusData);
        setCrmConnected(statusData.connected);
        if (statusData.connected && statusData.crm_type) {
          setCrmType(statusData.crm_type);
          setCrmSyncSettings(statusData.settings || crmSyncSettings);
        }
      }
      setCrmLoading(false);
    } catch (error) {
      console.error('Failed to fetch CRM status:', error);
      setCrmLoading(false);
    }
  };

  const handleCrmConnect = async () => {
    setCrmConnecting(true);
    
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
        setCrmConnecting(false);
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
        fetchCRMStatus();
        setCredentials({ api_key: '', access_token: '', account_id: '', portal_id: '', instance_url: '', api_endpoint: '' });
      } else {
        alert('Failed to connect CRM');
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect CRM');
    } finally {
      setCrmConnecting(false);
    }
  };

  const getCrmCredentialValid = () => {
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

  const handleCrmUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/settings'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(crmSyncSettings)
      });
      
      if (response.ok) {
        alert('Settings updated!');
        fetchCRMStatus();
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update settings');
    }
  };

  const handleCrmDisconnect = async () => {
    if (!confirm('Disconnect CRM? This will stop all syncing.')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/disconnect'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('CRM disconnected');
        fetchCRMStatus();
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Permission helpers — handles both 'create_listings' and 'can_create_listings' key formats
  const isDealer = !currentUser || currentUser.user_type === 'dealer' || currentUser.user_type === 'admin';
  const isTeamMember = currentUser?.user_type === 'team_member';
  const teamMemberCan = (perm: string): boolean => {
    if (!currentUser || isDealer) return isDealer;
    const p = currentUser.permissions as Record<string, boolean> | undefined;
    if (!p) return false;
    const raw = perm.startsWith('can_') ? perm.slice(4) : perm;
    const can = perm.startsWith('can_') ? perm : `can_${perm}`;
    return !!(p[perm] ?? p[raw] ?? p[can]);
  };

  const tabs = [
    { id: 'listings', label: 'My Listings', icon: BarChart3 },
    { id: 'leads', label: 'Leads', icon: MessageSquare },
    { id: 'media', label: 'Media Gallery', icon: Image },
    ...(isDealer || teamMemberCan('create_listings') ? [{ id: 'bulk', label: 'Bulk Tools', icon: Archive }] : []),
    ...(isDealer || teamMemberCan('view_analytics') ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3 }] : []),
    ...(isDealer || teamMemberCan('manage_team') ? [{ id: 'team', label: 'Team', icon: Users }] : []),
    ...(isDealer ? [{ id: 'crm', label: 'CRM', icon: Link2 }] : []),
    ...(isDealer ? [{ id: 'billing', label: 'Billing', icon: CreditCard }] : []),
    { id: 'account', label: 'Account', icon: Settings },
    ...(isDealer ? [{ id: 'profile', label: 'Broker Page', icon: Building2 }] : []),
    ...(isTeamMember ? [{ id: 'salesman-profile', label: 'My Profile', icon: User }] : []),
    ...(isDealer ? [{ id: 'api-keys', label: 'API Keys', icon: Key }] : []),
  ] as { id: TabId; label: string; icon: any }[];

  const paidTiers = new Set(['basic','plus','pro','premium','private_basic','private_plus','private_pro']);
  const paymentLapsed = currentUser &&
    (currentUser.user_type === 'dealer' || currentUser.user_type === 'private') &&
    !currentUser.always_free &&
    !paidTiers.has(currentUser.subscription_tier || '');

  return (
    <div className="min-h-screen bg-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Payment lapsed banner */}
        {paymentLapsed && (
          <div className="mb-6 flex items-start justify-between gap-4 p-4 bg-red-50 border border-red-300 rounded-xl">
            <div>
              <p className="font-semibold text-red-700">Subscription inactive — action required</p>
              <p className="text-sm text-red-600 mt-0.5">Your listings are suspended and new listings cannot be created until payment is complete. Update your payment method to restore access.</p>
            </div>
            <button
              onClick={() => setActiveTab('billing')}
              className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Update payment
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-secondary">Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your yacht listings and business</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {(isDealer || teamMemberCan('create_listings')) && (
              <button
                onClick={() => window.location.href = '/listings/create'}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-light rounded-lg hover-primary transition-colors hover-lift font-semibold"
              >
                <PlusCircle size={20} />
                Create Listing
              </button>
            )}
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => window.location.href = '/dashboard/media'}
            className="glass-card p-4 text-left hover-lift"
          >
            <div className="flex items-center gap-3">
              <Image className="text-primary" size={24} />
              <div>
                <p className="text-sm text-gray-600">Media</p>
                <p className="text-lg font-bold text-secondary">Gallery</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('listings')}
            className="glass-card p-4 text-left hover-lift"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="text-primary" size={24} />
              <div>
                <p className="text-sm text-gray-600">My</p>
                <p className="text-lg font-bold text-secondary">Listings</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className="glass-card p-4 text-left hover-lift"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="text-secondary" size={24} />
              <div>
                <p className="text-sm text-gray-600">Performance</p>
                <p className="text-lg font-bold text-secondary">Analytics</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className="glass-card p-4 text-left hover-lift"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="text-accent" size={24} />
              <div>
                <p className="text-sm text-gray-600">Inbound</p>
                <p className="text-lg font-bold text-secondary">Leads</p>
              </div>
            </div>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <BarChart3 className="text-primary" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Total Listings</p>
            </div>
            <p className="text-3xl font-bold text-secondary">{stats.totalListings}</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Eye className="text-primary" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Active</p>
            </div>
            <p className="text-3xl font-bold text-primary">{stats.activeListings}</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Star className="text-accent fill-accent" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Featured</p>
            </div>
            <p className="text-3xl font-bold text-accent">{stats.featuredListings}</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-cyan-50 rounded-lg">
                <Eye className="text-primary" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Total Views</p>
            </div>
            <p className="text-3xl font-bold text-primary">{stats.totalViews.toLocaleString()}</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <MessageSquare className="text-secondary" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Inquiries</p>
            </div>
            <p className="text-3xl font-bold text-secondary">{stats.totalInquiries}</p>
          </div>
        </div>

        {/* Tabs + Content */}
        <div className="mb-20 flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-64 xl:w-72 shrink-0">
            <div className="glass-card p-3 lg:sticky lg:top-6">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabId)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
                        activeTab === tab.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-600 hover:bg-soft hover:text-secondary'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
          {/* Listings Tab */}
          {activeTab === 'listings' && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary">Listings</h3>
                  <p className="text-sm text-gray-600">Use Quick Edit Mode to update title, price, and status safely.</p>
                </div>
                <button
                  onClick={() => setQuickEditMode((prev) => !prev)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${quickEditMode ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-primary text-white hover:bg-primary/90'}`}
                >
                  {quickEditMode ? 'Exit Quick Edit Mode' : 'Enter Quick Edit Mode'}
                </button>
              </div>
              <div>
                <table className="w-full table-fixed">
                  <thead className="bg-soft">
                    <tr>
                      <th className="px-3 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selectedListings.size === listings.length && listings.length > 0}
                          onChange={() => {
                            if (selectedListings.size === listings.length) {
                              setSelectedListings(new Set());
                            } else {
                              setSelectedListings(new Set(listings.map(l => l.id)));
                            }
                          }}
                          className="w-5 h-5 rounded"
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[36%]">
                        Yacht
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[16%]">
                        Price
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[14%]">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[10%]">
                        Views
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[24%]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {listings.map((listing) => (
                      <tr 
                        key={listing.id}
                        className={selectedListings.has(listing.id) ? 'bg-cyan-50' : 'hover:bg-soft'}
                      >
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={selectedListings.has(listing.id)}
                            onChange={() => toggleListingSelection(listing.id)}
                            className="w-5 h-5 rounded"
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-3">
                            {listing.images && listing.images.length > 0 ? (
                              <img 
                                src={mediaUrl(listing.images[0].url)} 
                                alt={listing.title}
                                className="w-12 h-12 object-cover rounded-lg"
                                onError={onImgError}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-400 text-xs">No image</span>
                              </div>
                            )}
                            <div className="min-w-0 w-full">
                              {quickEditMode ? (
                                <input
                                  type="text"
                                  value={quickEdits[listing.id]?.title ?? listing.title}
                                  onChange={(e) => updateQuickEditField(listing.id, 'title', e.target.value)}
                                  className="font-semibold text-secondary rounded px-2 py-1 border border-gray-200 bg-white w-full"
                                />
                              ) : (
                                <p className="font-semibold text-secondary truncate pr-2">
                                  {quickEdits[listing.id]?.title ?? listing.title}
                                </p>
                              )}
                              <p className="text-sm text-gray-600">
                                {[listing.city, listing.state].filter(Boolean).join(', ') || 'Location not set'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-secondary">$</span>
                            {quickEditMode ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={quickEdits[listing.id]?.price ?? (listing.price != null ? String(listing.price) : '')}
                                onChange={(e) => updateQuickEditField(listing.id, 'price', e.target.value)}
                                className="rounded px-2 py-1 w-full border border-gray-200 bg-white"
                                placeholder="Price"
                              />
                            ) : (
                              <span className="text-secondary font-medium truncate">
                                {quickEdits[listing.id]?.price ?? (listing.price != null ? String(listing.price) : 'N/A')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            (quickEdits[listing.id]?.status || listing.status) === 'active' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-soft text-dark'
                          }`}>
                            {quickEdits[listing.id]?.status || listing.status}
                          </span>
                          {quickEditMode && (
                            <select
                              value={quickEdits[listing.id]?.status ?? listing.status}
                              onChange={(e) => updateQuickEditField(listing.id, 'status', e.target.value)}
                              className="mt-2 block text-sm border border-gray-200 rounded px-2 py-1"
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="sold">Sold</option>
                              <option value="archived">Archived</option>
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <Eye size={16} className="text-gray-400" />
                            <span className="text-gray-900">{listing.views || 0}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => window.location.href = `/listings/${listing.id}`}
                              className="p-2 text-primary hover:bg-cyan-50 rounded transition-colors"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => window.location.href = `/listings/${listing.id}/edit`}
                              className="p-2 text-secondary hover:bg-soft rounded transition-colors"
                            >
                              <Edit size={18} />
                            </button>
                            {quickEditMode && (
                              <button
                                onClick={() => saveQuickEdit(listing.id)}
                                disabled={savingQuickEditId === listing.id}
                                className="px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:bg-gray-400"
                              >
                                {savingQuickEditId === listing.id ? 'Saving...' : 'Save'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Leads Tab */}
          {activeTab === 'leads' && (
            <LeadsManager />
          )}

          {/* Featured Tab — hidden until feature is ready */}

          {/* Media Gallery Tab */}
          {activeTab === 'media' && (
            <div className="glass-card p-8">
              <div className="text-center mb-6">
                <Image className="mx-auto text-primary mb-4" size={64} />
                <h2 className="text-2xl font-bold text-secondary mb-2">Media Gallery</h2>
                <p className="text-gray-600 mb-6">Manage your photos, videos, and documents in one place</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="border border-primary/10 rounded-lg p-4 text-center hover-lift">
                  <Image className="mx-auto text-primary mb-2" size={32} />
                  <p className="font-semibold text-secondary">Images</p>
                  <p className="text-sm text-gray-600">Upload & organize yacht photos</p>
                </div>
                <div className="border border-primary/10 rounded-lg p-4 text-center hover-lift">
                  <Globe className="mx-auto text-secondary mb-2" size={32} />
                  <p className="font-semibold text-secondary">Videos</p>
                  <p className="text-sm text-gray-600">Add video tours & walkthroughs</p>
                </div>
                <div className="border border-primary/10 rounded-lg p-4 text-center hover-lift">
                  <Archive className="mx-auto text-primary mb-2" size={32} />
                  <p className="font-semibold text-secondary">Documents</p>
                  <p className="text-sm text-gray-600">Store brochures & PDFs</p>
                </div>
              </div>
              <button
                onClick={() => window.location.href = '/dashboard/media'}
                className="mt-6 w-full px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors"
              >
                Open Media Manager
              </button>
            </div>
          )}

          {/* Bulk Tools Tab */}
          {activeTab === 'bulk' && (
            <div className="glass-card p-6">
              <h2 className="text-2xl font-bold text-secondary mb-6">Bulk Import/Export Tools</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Import */}
                <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <Upload className="text-primary mx-auto mb-4" size={48} />
                  <h3 className="font-bold text-lg text-secondary mb-2">Import Listings</h3>
                  <p className="text-gray-600 mb-4">Upload a CSV file to create multiple listings at once</p>
                  <button 
                    onClick={() => window.location.href = '/dashboard/bulk-tools'}
                    className="px-6 py-2 bg-primary text-light rounded-lg hover-primary transition-colors"
                  >
                    Import CSV
                  </button>
                </div>

                {/* Export */}
                <div className="border-2 border-dashed border-secondary/30 rounded-lg p-8 text-center hover:border-secondary transition-colors">
                  <Archive className="text-secondary mx-auto mb-4" size={48} />
                  <h3 className="font-bold text-lg text-secondary mb-2">Export Listings</h3>
                  <p className="text-gray-600 mb-4">Download all your listings as a CSV file</p>
                  <button 
                    onClick={() => window.location.href = '/dashboard/bulk-tools'}
                    className="px-6 py-2 bg-secondary text-light rounded-lg hover-secondary transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-cyan-50 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-secondary">
                  <strong>💡 Tip:</strong> Use bulk tools to quickly import yacht inventory from other platforms or export for backup purposes.
                </p>
              </div>
            </div>
          )}

          {/* CRM Tab */}
          {activeTab === 'crm' && (
            <div className="space-y-6">
              {crmConnected ? (
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-primary/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="text-primary" size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-secondary">
                          Connected to {crmType === 'hubspot' ? 'HubSpot' : crmType.charAt(0).toUpperCase() + crmType.slice(1).replace(/([A-Z])/g, ' $1')}
                        </h2>
                        <p className="text-sm text-gray-600">
                          Last sync: {crmStatus?.last_sync ? new Date(crmStatus.last_sync).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleCrmDisconnect} 
                      className="px-5 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium flex items-center gap-2"
                    >
                      <XCircle size={18} />
                      Disconnect
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-secondary text-lg">Sync Settings</h3>
                    
                    {[
                      { key: 'sync_enabled', label: 'Enable Auto-Sync', desc: 'Automatically sync new data' },
                      { key: 'sync_leads', label: 'Sync Leads', desc: 'Create leads/contacts from inquiries' },
                      { key: 'sync_contacts', label: 'Sync Contacts', desc: 'Keep contact information updated' },
                      { key: 'sync_messages', label: 'Sync Messages', desc: 'Add messages as notes/activities' }
                    ].map(setting => (
                      <div key={setting.key} className="flex items-center justify-between p-4 bg-soft rounded-xl border border-gray-200">
                        <div>
                          <p className="font-semibold text-secondary">{setting.label}</p>
                          <p className="text-sm text-gray-600">{setting.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={crmSyncSettings[setting.key as keyof SyncSettings]}
                            onChange={(e) => setCrmSyncSettings({ ...crmSyncSettings, [setting.key]: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    ))}

                    <button 
                      onClick={handleCrmUpdateSettings} 
                      className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 font-semibold transition-all shadow-lg mt-4"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-8">
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-secondary mb-3">Connect Your CRM</h2>
                    <p className="text-gray-600 mb-6">Automatically sync leads, contacts, and messages with your CRM</p>

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
                            <h3 className="font-bold text-secondary text-sm">{crm.name}</h3>
                            <p className="text-xs text-gray-600 mt-1">{crm.desc}</p>
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
                        <label className="block text-sm font-semibold text-secondary mb-2">Access Token *</label>
                        <input
                          type="password"
                          value={credentials.access_token}
                          onChange={(e) => setCredentials({ ...credentials, access_token: e.target.value })}
                          placeholder="pat-na1-..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from HubSpot Settings → Integrations → Private Apps
                        </p>
                      </div>
                    ) : selectedCRM === 'gohighlevel' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">API Key *</label>
                        <input
                          type="password"
                          value={credentials.api_key}
                          onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                          placeholder="Your GoHighLevel API key"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from GHL Settings → API
                        </p>
                      </div>
                    ) : selectedCRM === 'pipedrive' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">API Token *</label>
                        <input
                          type="password"
                          value={credentials.api_key}
                          onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                          placeholder="Your Pipedrive API token"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from Pipedrive Settings → Personal Preferences → API
                        </p>
                      </div>
                    ) : selectedCRM === 'zoho' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">OAuth Token *</label>
                        <input
                          type="password"
                          value={credentials.api_key}
                          onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                          placeholder="Your Zoho OAuth token"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from Zoho Settings → Integrations → Connections
                        </p>
                      </div>
                    ) : selectedCRM === 'activecampaign' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">API Token *</label>
                        <input
                          type="password"
                          value={credentials.api_key}
                          onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                          placeholder="Your ActiveCampaign API token"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from ActiveCampaign Settings → Integrations → API
                        </p>
                      </div>
                    ) : selectedCRM === 'salesforce' ? (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-secondary mb-2">Instance URL *</label>
                          <input
                            type="text"
                            value={credentials.instance_url}
                            onChange={(e) => setCredentials({ ...credentials, instance_url: e.target.value })}
                            placeholder="https://yourinstance.salesforce.com"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-secondary mb-2">Access Token *</label>
                          <input
                            type="password"
                            value={credentials.access_token}
                            onChange={(e) => setCredentials({ ...credentials, access_token: e.target.value })}
                            placeholder="Your Salesforce access token"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                          />
                        </div>
                        <p className="text-xs text-gray-600 flex items-start gap-2">
                          <span>💡</span>
                          Get from Salesforce Setup → Apps → App Manager → Create OAuth app
                        </p>
                      </>
                    ) : null}

                    <button
                      onClick={handleCrmConnect}
                      disabled={crmConnecting || !getCrmCredentialValid()}
                      className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      {crmConnecting ? (
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

              {/* Info Box */}
              <div className="glass-card p-6 bg-gradient-to-br from-primary/10 to-soft">
                <h3 className="font-bold text-secondary mb-4 flex items-center gap-2">
                  <Zap size={22} className="text-primary" />
                  How CRM Integration Works
                </h3>
                <ul className="space-y-3 text-sm text-gray-700">
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
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="glass-card p-8">
              <div className="text-center mb-6">
                <CreditCard className="mx-auto text-primary mb-4" size={64} />
                <h2 className="text-2xl font-bold text-secondary mb-2">Subscription & Billing</h2>
                <p className="text-gray-600 mb-6">Manage your subscription plan and payment methods</p>
              </div>
              <div className="space-y-4 mb-6">
                <div className="border border-primary/10 rounded-lg p-6 hover-lift">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-secondary">Current Plan</h3>
                      <p className="text-gray-600">Premium Broker - $99/month</p>
                    </div>
                    <span className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold">
                      Active
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-primary/10">
                    <div>
                      <p className="text-2xl font-bold text-primary">∞</p>
                      <p className="text-sm text-gray-600">Listings</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">50GB</p>
                      <p className="text-sm text-gray-600">Storage</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">5</p>
                      <p className="text-sm text-gray-600">Team Members</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => window.location.href = '/dashboard/billing'}
                  className="flex-1 px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors hover-lift"
                >
                  Manage Billing
                </button>
              </div>
            </div>
          )}

          {/* Account Settings Tab */}
          {activeTab === 'account' && (
            <div className="glass-card p-8">
              <div className="text-center mb-6">
                <Settings className="mx-auto text-primary mb-4" size={64} />
                <h2 className="text-2xl font-bold text-secondary mb-2">Account Settings</h2>
                <p className="text-gray-600 mb-6">Update your business information and credentials</p>
              </div>
              <div className="space-y-4 mb-6">
                <div className="border border-primary/10 rounded-lg p-4 flex items-center justify-between hover:bg-soft transition-colors hover-lift">
                  <div>
                    <p className="font-semibold text-secondary">Password</p>
                    <p className="text-sm text-gray-600">Change your password</p>
                  </div>
                  <Edit className="text-primary" size={20} />
                </div>
                <div className="border border-primary/10 rounded-lg p-4 flex items-center justify-between hover:bg-soft transition-colors hover-lift">
                  <div>
                    <p className="font-semibold text-secondary">Logo & Branding</p>
                    <p className="text-sm text-gray-600">Upload your company logo</p>
                  </div>
                  <Upload className="text-primary" size={20} />
                </div>
              </div>
              <button 
                onClick={() => window.location.href = '/settings'}
                className="w-full px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors hover-lift"
              >
                Edit Account Settings
              </button>
            </div>
          )}

          {/* Broker Profile Tab */}
          {activeTab === 'profile' && (
            <div className="glass-card p-8">
              <div className="text-center mb-6">
                <Building2 className="mx-auto text-primary mb-4" size={64} />
                <h2 className="text-2xl font-bold text-secondary mb-2">Customize Broker Page</h2>
                <p className="text-gray-600 mb-6">Customize how your dealership appears to potential buyers</p>
              </div>
              <div className="space-y-4 mb-6">
                <div className="border border-primary/10 rounded-lg p-4 flex items-center justify-between hover:bg-soft transition-colors hover-lift">
                  <div>
                    <p className="font-semibold text-secondary">Cover Photo</p>
                    <p className="text-sm text-gray-600">Hero image for your broker page</p>
                  </div>
                  <Upload className="text-primary" size={20} />
                </div>
                <div className="border border-primary/10 rounded-lg p-4 flex items-center justify-between hover:bg-soft transition-colors hover-lift">
                  <div>
                    <p className="font-semibold text-secondary">About Your Business</p>
                    <p className="text-sm text-gray-600">Tell buyers about your dealership</p>
                  </div>
                  <Edit className="text-primary" size={20} />
                </div>
                <div className="border border-primary/10 rounded-lg p-4 flex items-center justify-between hover:bg-soft transition-colors hover-lift">
                  <div>
                    <p className="font-semibold text-secondary">Contact Information</p>
                    <p className="text-sm text-gray-600">Phone, email, website</p>
                  </div>
                  <Edit className="text-primary" size={20} />
                </div>
                <div className="border border-primary/10 rounded-lg p-4 flex items-center justify-between hover:bg-soft transition-colors hover-lift">
                  <div>
                    <p className="font-semibold text-secondary">Location & Hours</p>
                    <p className="text-sm text-gray-600">Address and business hours</p>
                  </div>
                  <Edit className="text-primary" size={20} />
                </div>
                <div className="border border-primary/10 rounded-lg p-4 flex items-center justify-between hover:bg-soft transition-colors hover-lift">
                  <div>
                    <p className="font-semibold text-secondary">Social Media Links</p>
                    <p className="text-sm text-gray-600">Facebook, Instagram, etc.</p>
                  </div>
                  <Link2 className="text-primary" size={20} />
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => window.location.href = '/dashboard/dealer-profile'}
                  className="flex-1 px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors"
                >
                  Open Customize Page
                </button>
                <button 
                  onClick={() => window.location.href = '/dashboard/dealer-profile'}
                  className="flex-1 px-6 py-3 bg-soft text-secondary rounded-lg hover:bg-primary/10 font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye size={20} />
                  Preview Broker Page
                </button>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="glass-card p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-secondary">Performance Analytics</h2>
                    <p className="text-sm text-gray-600 mt-1">Track leads achieved and compare performance over time.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {([
                      { id: '7d', label: 'Last 7 days' },
                      { id: '30d', label: 'Last 30 days' },
                      { id: '90d', label: 'Last 90 days' },
                    ] as const).map((range) => (
                      <button
                        key={range.id}
                        onClick={() => setAnalyticsRange(range.id)}
                        className={`px-3 py-2 text-sm rounded-lg border ${analyticsRange === range.id ? 'bg-primary text-white border-primary' : 'bg-white text-secondary border-gray-200 hover:bg-soft'}`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Leads Achieved</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{teamPerformance?.summary.period_leads ?? stats.totalInquiries}</p>
                    <p className="text-xs text-gray-500 mt-1">{analyticsRange === '7d' ? 'week over week' : analyticsRange === '30d' ? 'month over month' : 'period over period'}</p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Lead Change</p>
                    <p className={`text-2xl font-bold mt-1 ${(teamPerformance?.summary.lead_delta ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {(teamPerformance?.summary.lead_delta ?? 0) >= 0 ? '+' : ''}{teamPerformance?.summary.lead_delta ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{(teamPerformance?.summary.lead_delta_percent ?? 0).toFixed(1)}%</p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Team Response Rate</p>
                    <p className="text-2xl font-bold text-primary mt-1">{(teamPerformance?.summary.average_response_rate ?? 0).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-1">Replied inquiries across team</p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Pending Follow-ups</p>
                    <p className={`text-2xl font-bold mt-1 ${(teamPerformance?.summary.pending_inquiries ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {teamPerformance?.summary.pending_inquiries ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Unanswered inquiries</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="font-semibold text-secondary mb-4">Top Listings by Lead Volume</h3>
                  <div className="space-y-3">
                    {[...listings]
                      .sort((a, b) => (b.inquiries || 0) - (a.inquiries || 0))
                      .slice(0, 5)
                      .map((listing) => (
                        <div key={listing.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-secondary truncate flex-1">{listing.title}</span>
                          <span className="text-sm font-semibold text-primary">{listing.inquiries || 0} leads</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-semibold text-secondary mb-4">Team Snapshot</h3>
                  {teamPerformanceLoading ? (
                    <p className="text-sm text-gray-600">Loading team metrics...</p>
                  ) : teamPerformance && teamPerformance.members.length > 0 ? (
                    <div className="space-y-3">
                      {teamPerformance.members.slice(0, 5).map((member) => (
                        <div key={member.id} className="flex items-center justify-between gap-3 border border-primary/10 rounded-lg p-3">
                          <div className="min-w-0">
                            <p className="font-medium text-secondary truncate">{member.name}</p>
                            <p className="text-xs text-gray-600 truncate">{member.pending_inquiries} pending · {member.inquiries_current_period} leads</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${member.response_rate >= 70 ? 'bg-emerald-100 text-emerald-700' : member.response_rate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {member.response_rate.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No team data available yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <div className="glass-card p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-secondary">Sales Team Snapshot</h2>
                    <p className="text-gray-600">Monitor team responsiveness and lead handling in one place.</p>
                  </div>
                  <button
                    onClick={() => window.location.href = '/dashboard/team'}
                    className="px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors"
                  >
                    Open Full Team Manager
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Team Members</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{teamPerformance?.summary.team_members ?? 0}</p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Leads ({teamPerformance?.range_days ?? 30}d)</p>
                    <p className="text-2xl font-bold text-primary mt-1">{teamPerformance?.summary.period_leads ?? 0}</p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Pending Inquiries</p>
                    <p className={`text-2xl font-bold mt-1 ${(teamPerformance?.summary.pending_inquiries ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {teamPerformance?.summary.pending_inquiries ?? 0}
                    </p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Avg Team Response</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{(teamPerformance?.summary.average_response_rate ?? 0).toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-secondary">Rep Performance</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAnalyticsRange('7d')}
                      className={`px-3 py-1.5 text-sm rounded ${analyticsRange === '7d' ? 'bg-primary text-white' : 'bg-soft text-secondary'}`}
                    >
                      7d
                    </button>
                    <button
                      onClick={() => setAnalyticsRange('30d')}
                      className={`px-3 py-1.5 text-sm rounded ${analyticsRange === '30d' ? 'bg-primary text-white' : 'bg-soft text-secondary'}`}
                    >
                      30d
                    </button>
                    <button
                      onClick={() => setAnalyticsRange('90d')}
                      className={`px-3 py-1.5 text-sm rounded ${analyticsRange === '90d' ? 'bg-primary text-white' : 'bg-soft text-secondary'}`}
                    >
                      90d
                    </button>
                  </div>
                </div>

                {teamPerformanceLoading ? (
                  <div className="p-6 text-sm text-gray-600">Loading team snapshot...</div>
                ) : !teamPerformance || teamPerformance.members.length === 0 ? (
                  <div className="p-6 text-sm text-gray-600">No team members found yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-soft">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Rep</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Listings</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Leads</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Pending</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Response Rate</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Avg Response</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {teamPerformance.members.map((member) => (
                          <tr key={member.id} className="hover:bg-soft">
                            <td className="px-4 py-3">
                              <p className="font-medium text-secondary">{member.name}</p>
                              <p className="text-xs text-gray-600">{member.email}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary">{member.listings_active} active / {member.listings_total} total</td>
                            <td className="px-4 py-3 text-sm text-secondary">{member.inquiries_current_period} ({teamPerformance.range_days}d)</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${member.pending_inquiries > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {member.pending_inquiries}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-secondary">{member.response_rate.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-sm text-secondary">{member.avg_response_hours != null ? `${member.avg_response_hours.toFixed(1)}h` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api-keys' && (
            <div className="glass-card p-8">
              <div className="text-center mb-6">
                <Key className="mx-auto text-primary mb-4" size={64} />
                <h2 className="text-2xl font-bold text-secondary mb-2">API Keys</h2>
                <p className="text-gray-600 mb-6">Manage your API keys for programmatic access</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => window.location.href = '/dashboard/api-keys'}
                  className="border border-primary/10 rounded-lg p-6 text-center hover-lift"
                >
                  <div className="text-4xl mb-3">🔑</div>
                  <h3 className="font-bold text-secondary mb-2">Access Keys</h3>
                  <p className="text-sm text-gray-600">View and manage your API keys</p>
                </button>
                <button
                  onClick={() => window.location.href = '/api/docs'}
                  className="border border-primary/10 rounded-lg p-6 text-center hover-lift"
                >
                  <div className="text-4xl mb-3">📚</div>
                  <h3 className="font-bold text-secondary mb-2">Documentation</h3>
                  <p className="text-sm text-gray-600">Learn how to use the API</p>
                </button>
              </div>
            </div>
          )}

          {/* Salesman Profile Tab */}
          {activeTab === 'salesman-profile' && (
            <div className="glass-card p-8">
              <div className="text-center mb-6">
                <User className="mx-auto text-primary mb-4" size={64} />
                <h2 className="text-2xl font-bold text-secondary mb-2">My Profile</h2>
                <p className="text-gray-600 mb-6">Manage your public profile, bio, and social links</p>
              </div>
              <button
                onClick={() => window.location.href = '/dashboard/salesman-profile'}
                className="w-full px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors"
              >
                Edit My Profile
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedListings.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="glass-card rounded-xl shadow-2xl border-2 border-primary p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-cyan-100 rounded-lg">
                <CheckSquare className="text-primary" size={20} />
                <span className="font-semibold text-secondary">
                  {selectedListings.size} selected
                </span>
              </div>

              <div className="h-8 w-px bg-primary/20" />

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button className="px-4 py-2 bg-soft hover:bg-primary/10 rounded-lg font-medium text-secondary transition-colors">
                    Change Status
                  </button>
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-white rounded-lg shadow-xl border border-primary/10 py-2 w-40">
                    {['active', 'draft', 'archived'].map(status => (
                      <button
                        key={status}
                        onClick={() => handleBulkStatusChange(status)}
                        className="w-full px-4 py-2 text-left hover:bg-soft text-secondary capitalize transition-colors"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 rounded-lg font-medium text-red-800 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>

              <div className="h-8 w-px bg-primary/20" />

              <button
                onClick={() => setSelectedListings(new Set())}
                className="p-2 hover:bg-soft rounded-lg transition-colors text-secondary"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}