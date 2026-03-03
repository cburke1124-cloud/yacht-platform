'use client';

import { useState } from 'react';
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
import BulkImportExportTools from '@/app/components/BulkImportExportTools';
import { TrendingUp, Eye, Mail, DollarSign, Ship, Users, BarChart3 } from 'lucide-react';

function AdminPageContent() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'listings', label: 'Listings', icon: '🚤' },
    { id: 'bulk-tools', label: 'Bulk Tools', icon: '📦' },
    { id: 'dealers', label: 'Dealers', icon: '🏢' },
    { id: 'media', label: 'Media', icon: '🖼️' },
    { id: 'blog', label: 'Blog', icon: '📝' },
    { id: 'scraper', label: 'Scraper', icon: '🔍' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'sales-reps', label: 'Sales Reps', icon: '💼' },
    { id: 'system', label: 'System', icon: '🛠️' }
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
          {activeTab === 'listings' && <AdminListingsTab />}
          {activeTab === 'bulk-tools' && <BulkImportExportTools />}
          {activeTab === 'dealers' && <AdminDealersTab />}
          {activeTab === 'media' && <AdminMediaDashboardWrapper />}
          {activeTab === 'blog' && <AdminBlogTab />}
          {activeTab === 'scraper' && <AdminScraperTab />}
          {activeTab === 'analytics' && <AdminAnalyticsTab />}
          {activeTab === 'settings' && <AdminSettingsPage />}
          {activeTab === 'system' && <AdminSystemTab />}
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

// Dashboard Overview Component
function AdminDashboardOverview() {
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
          <div className="text-3xl font-bold text-gray-900 mb-1">1,234</div>
          <p className="text-sm text-gray-600">+12% from last month</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Ship className="text-green-600" size={24} />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">Total Listings</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">5,678</div>
          <p className="text-sm text-gray-600">+8% from last month</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Eye className="text-purple-600" size={24} />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">Total Views</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">45.2K</div>
          <p className="text-sm text-gray-600">+15% from last month</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <DollarSign className="text-yellow-600" size={24} />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">Revenue (MRR)</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">$12.4K</div>
          <p className="text-sm text-gray-600">+22% from last month</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Users</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">User {i}</p>
                    <p className="text-xs text-gray-500">Joined today</p>
                  </div>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Listings</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Ship className="text-green-600" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Yacht Listing {i}</p>
                    <p className="text-xs text-gray-500">Posted 2h ago</p>
                  </div>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Admin Analytics Tab Component
function AdminAnalyticsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Platform Analytics</h2>
        <p className="text-gray-600">
          Platform-wide performance metrics and insights. This section shows aggregated data across all dealers and listings.
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
          <div className="text-3xl font-bold text-gray-900 mb-2">+156</div>
          <p className="text-sm text-gray-700">New users this month</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-600 p-2 rounded-lg">
              <TrendingUp className="text-white" size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Engagement Rate</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">87.5%</div>
          <p className="text-sm text-gray-700">Active user percentage</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Mail className="text-white" size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Total Inquiries</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">2,345</div>
          <p className="text-sm text-gray-700">This month</p>
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Top Performing Dealers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dealer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inquiries</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">Dealer Name {i}</div>
                    <div className="text-sm text-gray-500">dealer{i}@example.com</div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{Math.floor(Math.random() * 50) + 10}</td>
                  <td className="px-6 py-4 text-gray-900">{Math.floor(Math.random() * 5000) + 1000}</td>
                  <td className="px-6 py-4 text-gray-900">{Math.floor(Math.random() * 200) + 50}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {(Math.random() * 5 + 2).toFixed(1)}%
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