'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import { AdminRouteGuard } from '@/components/RouteGuard';
import AdminLayout from '@/app/components/admin/AdminLayout';
import AdminListingsTab from '@/app/components/admin/AdminListingsTab';
import AdminDealersTab from '@/app/components/admin/AdminDealersTab';
import AdminBlogTab from '@/app/components/admin/AdminBlogTab';
import AdminUsersTab from '@/app/components/admin/AdminUsersTab';
import AdminScraperTab from '@/app/components/admin/AdminScraperTab';
import AdminSettingsPage from '@/app/admin/settings/page';
import AdminSalesRepTab from '@/app/components/admin/AdminSalesRepTab';
import AdminMediaDashboard from '@/app/components/admin/AdminMediaDashboard';
import AdminSystemTab from '@/app/components/admin/AdminSystemTab';
import AdminDemoAccountsTab from '@/app/components/admin/AdminDemoAccountsTab';
import AdminSalesToolsTab from '@/app/components/admin/AdminSalesToolsTab';
import AdminPreviewListingsTab from '@/app/components/admin/AdminPreviewListingsTab';
import BulkImportExportTools from '@/app/components/BulkImportExportTools';
import AdminCatalogTab from '@/app/components/admin/AdminCatalogTab';
import AdminCharterTab from '@/app/components/admin/AdminCharterTab';
import AdminFoundingBrokerTab from '@/app/components/admin/AdminFoundingBrokerTab';
import { TrendingUp, Eye, Mail, DollarSign, Ship, Users, BarChart3, Link2, Copy, Check } from 'lucide-react';

function AdminPageContent() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'listings', label: 'Listings', icon: '🚤' },
    { id: 'bulk-tools', label: 'Bulk Tools', icon: '📦' },
    { id: 'dealers', label: 'Brokers', icon: '🏢' },
    { id: 'media', label: 'Media', icon: '🖼️' },
    { id: 'blog', label: 'Blog', icon: '📝' },
    { id: 'scraper', label: 'Scraper', icon: '🔍' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'demo-accounts', label: 'Demo Accounts', icon: '🎮' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'sales-reps', label: 'Sales Reps', icon: '💼' },
    { id: 'sales-tools', label: 'Sales Tools', icon: '🏷️' },
    { id: 'system', label: 'System', icon: '🛠️' },
    { id: 'preview-listings', label: 'Preview Listings', icon: '👁️' },
    { id: 'catalog', label: 'Catalog', icon: '📋' },
    { id: 'charter', label: 'Charter', icon: '⛵' },
    { id: 'founding-broker', label: 'Founding Broker', icon: '🤝' },
  ];

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage platform settings and data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
        <aside className="bg-white rounded-xl border border-gray-200 p-3 h-fit">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          {activeTab === 'dashboard' && <AdminDashboardOverview />}
          {activeTab === 'users' && <AdminUsersTab />}
          {activeTab === 'sales-reps' && <AdminSalesRepTabWrapper />}
          {activeTab === 'sales-tools' && <AdminSalesToolsTab />}
          {activeTab === 'listings' && <AdminListingsTab />}
          {activeTab === 'bulk-tools' && <BulkImportExportTools />}
          {activeTab === 'dealers' && <AdminDealersTab />}
          {activeTab === 'media' && <AdminMediaDashboardWrapper />}
          {activeTab === 'blog' && <AdminBlogTab />}
          {activeTab === 'scraper' && <AdminScraperTab />}
          {activeTab === 'analytics' && <AdminAnalyticsTab />}
          {activeTab === 'demo-accounts' && <AdminDemoAccountsTab />}
          {activeTab === 'settings' && <AdminSettingsPage />}
          {activeTab === 'system' && <AdminSystemTab />}
          {activeTab === 'preview-listings' && <AdminPreviewListingsTab />}
          {activeTab === 'catalog' && <AdminCatalogTab />}
          {activeTab === 'charter' && <AdminCharterTab />}
          {activeTab === 'founding-broker' && <AdminFoundingBrokerTab />}
        </section>
      </div>
    </AdminLayout>
  );
}

// Wrapper for AdminSalesRepTab with error handling
function AdminSalesRepTabWrapper() {
  try {
    return <AdminSalesRepTab />;
  } catch (error) {
    console.error('AdminSalesRepTab error:', error);
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Sales Representatives</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Unable to load sales rep data. Please check the backend API.</p>
          <p className="text-sm text-yellow-600 mt-2">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }
}

// Wrapper for AdminMediaDashboard with error handling
function AdminMediaDashboardWrapper() {
  try {
    return <AdminMediaDashboard />;
  } catch (error) {
    console.error('AdminMediaDashboard error:', error);
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Media Management</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Unable to load media dashboard. Please check the backend API.</p>
          <p className="text-sm text-yellow-600 mt-2">Make sure the media management endpoints are configured in your backend.</p>
        </div>
      </div>
    );
  }
}

interface AdminStats {
  users: { total: number; active: number; dealers: number; active_dealers: number; pct_change_30d: number | null };
  listings: { total: number; active: number; pending: number; total_views: number; pct_change_30d: number | null };
  all_listings: { total: number; active: number; total_views: number; pct_change_30d: number | null };
  revenue: { monthly: number; annual: number };
}

interface RecentUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  user_type: string;
  active: boolean;
  created_at?: string;
}

interface RecentListing {
  id: number;
  title: string;
  status: string;
  created_at?: string;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDelta(pct: number | null): string {
  if (pct === null) return 'No data for prior 30 days';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}% vs. previous 30 days`;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Dashboard Overview Component — previously all four stat cards and both
// "Recent" lists were hardcoded placeholder numbers/names (1,234 users,
// "User 1"..."User 5" all "Joined today", etc.), unconnected to any backend
// call. Now pulls from the same /admin/stats, /admin/users, and
// /listings/admin-list endpoints the Users/Listings tabs already use.
interface OutreachAnalytics {
  total_dealers: number;
  monthly_commission: number;
  total_private_referrals?: number;
  private_seller_commission_total?: number;
  affiliate?: {
    code: string;
    referral_link: string;
    private_referral_link: string;
    commission_rate: number;
    referred_signups: number;
  };
}

function AdminDashboardOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentListings, setRecentListings] = useState<RecentListing[]>([]);
  const [outreach, setOutreach] = useState<OutreachAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedPrivate, setCopiedPrivate] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(apiUrl('/admin/stats'), { headers }).then(r => r.ok ? r.json() : null),
      fetch(apiUrl('/admin/users?limit=5'), { headers }).then(r => r.ok ? r.json() : null),
      fetch(apiUrl('/listings/admin-list'), { headers }).then(r => r.ok ? r.json() : null),
      // Admin outreach — admins doing occasional broker/dealer outreach get the
      // same lightweight referral tracking sales reps use, without the full
      // sales-rep dashboard (deals, demo portal, etc. aren't needed here).
      fetch(apiUrl('/sales-rep/analytics'), { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([statsData, usersData, listingsData, outreachData]) => {
      if (statsData) setStats(statsData);
      if (usersData?.users) setRecentUsers(usersData.users);
      if (Array.isArray(listingsData)) setRecentListings(listingsData.slice(0, 5));
      if (outreachData) setOutreach(outreachData);
    }).finally(() => setLoading(false));
  }, []);

  const copyReferralLink = () => {
    if (!outreach?.affiliate) return;
    const link = `${window.location.origin}${outreach.affiliate.referral_link}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPrivateReferralLink = () => {
    if (!outreach?.affiliate) return;
    const link = `${window.location.origin}${outreach.affiliate.private_referral_link}`;
    navigator.clipboard.writeText(link);
    setCopiedPrivate(true);
    setTimeout(() => setCopiedPrivate(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">Total Users</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats ? stats.users.total.toLocaleString() : '—'}</div>
          <p className="text-sm text-gray-600">{stats ? fmtDelta(stats.users.pct_change_30d) : 'Unavailable'}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Ship className="text-green-600" size={24} />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">Total Listings</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats ? stats.all_listings.total.toLocaleString() : '—'}</div>
          <p className="text-sm text-gray-600">{stats ? fmtDelta(stats.all_listings.pct_change_30d) : 'Unavailable'}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Eye className="text-purple-600" size={24} />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">Total Views</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats ? fmtCompact(stats.all_listings.total_views) : '—'}</div>
          <p className="text-sm text-gray-600">Cumulative, for-sale listings only</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <DollarSign className="text-yellow-600" size={24} />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">Revenue (MRR)</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats ? `$${fmtCompact(stats.revenue.monthly)}` : '—'}</div>
          <p className="text-sm text-gray-600">Estimated from active subscription tiers</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Users</h3>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No users yet.</p>
          ) : (
            <div className="space-y-3">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="text-blue-600" size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{u.company_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</p>
                      <p className="text-xs text-gray-500">{timeAgo(u.created_at)} &middot; {u.user_type}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${u.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Listings</h3>
          {recentListings.length === 0 ? (
            <p className="text-sm text-gray-500">No listings yet.</p>
          ) : (
            <div className="space-y-3">
              {recentListings.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Ship className="text-green-600" size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{l.title}</p>
                      <p className="text-xs text-gray-500">{timeAgo(l.created_at)}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium capitalize flex-shrink-0">
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My Outreach — lightweight referral tracking for admins doing occasional
          broker outreach, mirroring what sales reps see (but condensed —
          admins aren't selling full time, so this skips deals/demo/resources). */}
      {outreach?.affiliate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Link2 size={18} className="text-primary" /> My Outreach</h3>
            <span className="text-xs text-gray-500">{outreach.affiliate.referred_signups} signup{outreach.affiliate.referred_signups === 1 ? '' : 's'}</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Referral Code</p>
              <p className="font-mono font-semibold text-gray-900">{outreach.affiliate.code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Brokers Referred</p>
              <p className="font-semibold text-gray-900">{outreach.total_dealers}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Commission Rate</p>
              <p className="font-semibold text-gray-900">{outreach.affiliate.commission_rate}%</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Broker Signup Link</p>
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 mb-3">
            <p className="text-sm font-mono text-primary flex-1 truncate">{typeof window !== 'undefined' ? `${window.location.origin}${outreach.affiliate.referral_link}` : outreach.affiliate.referral_link}</p>
            <button onClick={copyReferralLink} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 shrink-0 flex items-center gap-1">
              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Private Seller Signup Link</p>
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-mono text-primary flex-1 truncate">{typeof window !== 'undefined' ? `${window.location.origin}${outreach.affiliate.private_referral_link}` : outreach.affiliate.private_referral_link}</p>
            <button onClick={copyPrivateReferralLink} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 shrink-0 flex items-center gap-1">
              {copiedPrivate ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AnalyticsDealer {
  id: number;
  name: string;
  email: string;
  total_listings: number;
  total_views: number;
  total_inquiries: number;
}

// Admin Analytics Tab — previously every number here was either hardcoded
// (+156, 87.5%, 2,345) or generated with Math.random() on every render (the
// "Top Performing Dealers" table reshuffled to new fake values on each
// re-render). Now pulled from /admin/stats and /admin/dealers.
function AdminAnalyticsTab() {
  const [stats, setStats] = useState<AdminStats & { users: AdminStats['users'] & { new_last_30d: number; engagement_rate: number }; total_inquiries: number } | null>(null);
  const [topDealers, setTopDealers] = useState<AnalyticsDealer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(apiUrl('/admin/stats'), { headers }).then(r => r.ok ? r.json() : null),
      fetch(apiUrl('/admin/dealers?limit=100'), { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([statsData, dealersData]) => {
      if (statsData) setStats(statsData);
      if (dealersData?.dealers) {
        const sorted = [...dealersData.dealers].sort((a, b) => (b.total_views || 0) - (a.total_views || 0));
        setTopDealers(sorted.slice(0, 5));
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Platform Analytics</h2>
        <p className="text-gray-600">
          Platform-wide performance metrics and insights. This section shows aggregated data across all brokers and listings.
        </p>
      </div>

      {/* Platform Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BarChart3 className="text-white" size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">User Growth</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">+{stats?.users.new_last_30d ?? 0}</div>
          <p className="text-sm text-gray-700">New users in the last 30 days</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-600 p-2 rounded-lg">
              <TrendingUp className="text-white" size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Engagement Rate</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{stats?.users.engagement_rate ?? 0}%</div>
          <p className="text-sm text-gray-700">Active user percentage</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Mail className="text-white" size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Total Inquiries</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{(stats?.total_inquiries ?? 0).toLocaleString()}</div>
          <p className="text-sm text-gray-700">All-time, for-sale listings</p>
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Top Performing Brokers</h3>
          <p className="text-xs text-gray-500 mt-1">Ranked by total views across for-sale listings</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Broker</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inquiries</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topDealers.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">No broker activity yet.</td></tr>
              ) : topDealers.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{d.name}</div>
                    <div className="text-sm text-gray-500">{d.email}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{d.total_listings}</td>
                  <td className="px-6 py-4 text-gray-900">{d.total_views.toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-900">{d.total_inquiries}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {d.total_views > 0 ? ((d.total_inquiries / d.total_views) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Main export with Route Guard
export default function AdminPage() {
  return (
    <AdminRouteGuard>
      <AdminPageContent />
    </AdminRouteGuard>
  );
}