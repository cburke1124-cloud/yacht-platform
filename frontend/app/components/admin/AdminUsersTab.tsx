'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';

const PAID_TIERS = new Set([
  'basic', 'plus', 'pro', 'premium',
  'private_basic', 'private_plus', 'private_pro',
]);

function getSubscriptionBadge(user: any) {
  const isBrokerOrPrivate = user.user_type === 'dealer' || user.user_type === 'private';
  if (!isBrokerOrPrivate) return null;

  if (user.always_free) return { label: 'Always Free', bg: 'bg-purple-100', text: 'text-purple-700' };
  if (user.trial_active) return { label: 'Trial', bg: 'bg-blue-100', text: 'text-blue-700' };
  if (PAID_TIERS.has(user.subscription_tier)) return { label: user.subscription_tier, bg: 'bg-green-100', text: 'text-green-700' };
  if (user.stripe_subscription_id) return { label: 'Lapsed', bg: 'bg-red-100', text: 'text-red-700' };
  if (user.stripe_customer_id) return { label: 'Never Activated', bg: 'bg-orange-100', text: 'text-orange-700' };
  return { label: 'No Payment', bg: 'bg-gray-100', text: 'text-gray-600' };
}

export default function AdminUsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSubStatus, setFilterSubStatus] = useState('');

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    user_type: 'admin',
    company_name: '',
  });

  // Inline actions
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: number; type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (id: number, type: 'success' | 'error', text: string) => {
    setActionMsg({ id, type, text });
    setTimeout(() => setActionMsg(null), 5000);
  };

  const fetchUsers = useCallback(async (overridePage?: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const skip = (overridePage ?? page) * PAGE_SIZE;

      const params = new URLSearchParams({ skip: String(skip), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (filterType) params.set('user_type', filterType);
      if (filterSubStatus) params.set('subscription_status', filterSubStatus);

      const response = await fetch(apiUrl(`/admin/users?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.users ?? []);
        setUsers(list);
        setTotal(data.total ?? list.length);
      } else {
        setUsers([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterSubStatus, page]);

  useEffect(() => {
    setPage(0);
    fetchUsers(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterType, filterSubStatus]);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Actions

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, agree_terms: true, agree_communications: true }),
      });
      if (res.ok) {
        alert('User created successfully');
        setShowCreateForm(false);
        setFormData({ email: '', password: '', first_name: '', last_name: '', phone: '', user_type: 'admin', company_name: '' });
        fetchUsers();
      } else {
        const err = await res.json();
        alert(`Failed to create user: ${err.detail}`);
      }
    } catch {
      alert('Failed to create user');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/users/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
        setTotal(t => t - 1);
      } else {
        alert('Failed to delete user');
      }
    } catch {
      alert('Failed to delete user');
    }
  };

  const handleSendReset = async (user: any) => {
    setActionLoading(user.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: user.email }),
      });
      showMsg(user.id, res.ok ? 'success' : 'error', res.ok ? `Reset link sent to ${user.email}` : 'Failed to send reset link');
    } catch {
      showMsg(user.id, 'error', 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeEmail = async (user: any) => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      showMsg(user.id, 'error', 'Enter a valid email address');
      return;
    }
    setActionLoading(user.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/users/${user.id}/email`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.map(u => u.id === user.id ? { ...u, email: data.email } : u));
        setEditingEmailId(null);
        setNewEmail('');
        showMsg(user.id, 'success', 'Email updated');
      } else {
        showMsg(user.id, 'error', data.error?.message || data.detail || 'Failed to update email');
      }
    } catch {
      showMsg(user.id, 'error', 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncStripe = async (user: any) => {
    setActionLoading(user.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/users/${user.id}/sync-stripe`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated = data.user;
        setUsers(users.map(u => u.id === user.id ? { ...u, ...updated } : u));
        const changes = Object.keys(data.updated || {});
        showMsg(user.id, 'success', changes.length ? `Synced: ${changes.join(', ')} updated` : 'Already up-to-date');
      } else {
        showMsg(user.id, 'error', data.detail || 'Sync failed');
      }
    } catch {
      showMsg(user.id, 'error', 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-secondary">User Management</h2>
          {!loading && <p className="text-xs text-dark/50 mt-0.5">{total.toLocaleString()} user{total !== 1 ? 's' : ''} found</p>}
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition"
        >
          {showCreateForm ? 'Cancel' : '+ Create Admin User'}
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search name, email, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
        >
          <option value="">All Account Types</option>
          <option value="admin">Admin</option>
          <option value="dealer">Broker / Dealer</option>
          <option value="private">Private Seller</option>
          <option value="salesman">Sales Rep</option>
        </select>
        <select
          value={filterSubStatus}
          onChange={e => setFilterSubStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
        >
          <option value="">All Subscription States</option>
          <option value="active">Active Subscription</option>
          <option value="lapsed">Lapsed / Cancelled</option>
          <option value="trial">Trial</option>
          <option value="never_paid">Never Paid</option>
          <option value="always_free">Always Free</option>
        </select>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-semibold text-secondary mb-4">Create New Admin User</h3>
          <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-4">
            {[
              { label: 'First Name *', key: 'first_name', type: 'text' },
              { label: 'Last Name *', key: 'last_name', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-dark/70 mb-1">{label}</label>
                <input type={type} required value={(formData as any)[key]}
                  onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-dark/70 mb-1">Email *</label>
              <input type="email" required value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-dark/70 mb-1">Password *</label>
              <input type="password" required value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Phone</label>
              <input type="tel" value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">User Type *</label>
              <select value={formData.user_type}
                onChange={e => setFormData({ ...formData, user_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                <option value="admin">Admin</option>
                <option value="dealer">Dealer / Broker</option>
                <option value="private">Private Seller</option>
              </select>
            </div>
            <div className="col-span-2">
              <button type="submit" className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition">
                Create User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-dark/50 text-sm">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-dark/50 text-sm">No users match the current filters.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['User', 'Email', 'Type', 'Subscription', 'Account', 'Created', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${i === 6 ? 'text-right pr-6' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {users.map(user => {
                const subBadge = getSubscriptionBadge(user);
                const isBrokerRow = user.user_type === 'dealer' || user.user_type === 'private';

                return (
                  <>
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="font-medium text-secondary text-sm">{user.first_name} {user.last_name}</div>
                        {user.company_name && <div className="text-xs text-dark/50">{user.company_name}</div>}
                        {isBrokerRow && user.stripe_subscription_id && (
                          <div className="text-[10px] text-dark/30 font-mono mt-0.5 truncate max-w-[130px]" title={user.stripe_subscription_id}>
                            sub: …{user.stripe_subscription_id.slice(-8)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-dark/80 min-w-[180px]">{user.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          user.user_type === 'admin' ? 'bg-purple-100 text-purple-700'
                          : user.user_type === 'dealer' ? 'bg-primary/10 text-primary'
                          : user.user_type === 'private' ? 'bg-teal-100 text-teal-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{user.user_type}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap min-w-[130px]">
                        {subBadge ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${subBadge.bg} ${subBadge.text}`}>
                            {subBadge.label}
                          </span>
                        ) : (
                          <span className="text-xs text-dark/30">—</span>
                        )}
                        {isBrokerRow && user.trial_end_date && user.trial_active && (
                          <div className="text-[10px] text-dark/40 mt-0.5">
                            ends {new Date(user.trial_end_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {user.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-dark/50 whitespace-nowrap">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleSendReset(user)}
                            disabled={actionLoading === user.id}
                            title="Send password reset email"
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition disabled:opacity-50"
                          >
                            {actionLoading === user.id ? '...' : 'Reset Link'}
                          </button>
                          <button
                            onClick={() => { setEditingEmailId(editingEmailId === user.id ? null : user.id); setNewEmail(user.email); }}
                            className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100 transition"
                          >
                            {editingEmailId === user.id ? 'Cancel' : 'Email'}
                          </button>
                          {isBrokerRow && (user.stripe_customer_id || user.stripe_subscription_id) && (
                            <button
                              onClick={() => handleSyncStripe(user)}
                              disabled={actionLoading === user.id}
                              title="Pull latest subscription status from Stripe"
                              className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition disabled:opacity-50"
                            >
                              Sync Stripe
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {actionMsg?.id === user.id && (
                      <tr key={`msg-${user.id}`}>
                        <td colSpan={7} className="px-4 pb-2 pt-0">
                          <div className={`text-xs px-3 py-1.5 rounded-md ${
                            actionMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>{actionMsg.text}</div>
                        </td>
                      </tr>
                    )}
                    {editingEmailId === user.id && (
                      <tr key={`email-${user.id}`} className="bg-amber-50/40">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-dark/60 shrink-0">
                              New email for <span className="font-semibold text-secondary">{user.first_name} {user.last_name}</span>:
                            </span>
                            <input
                              type="email"
                              value={newEmail}
                              onChange={e => setNewEmail(e.target.value)}
                              placeholder="new@email.com"
                              className="flex-1 px-3 py-1.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                              onKeyDown={e => { if (e.key === 'Enter') handleChangeEmail(user); if (e.key === 'Escape') { setEditingEmailId(null); setNewEmail(''); } }}
                            />
                            <button
                              onClick={() => handleChangeEmail(user)}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition"
                            >
                              {actionLoading === user.id ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-dark/50">Page {page + 1} of {totalPages} · {total.toLocaleString()} total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
            >← Prev</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
            >Next →</button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-primary/5 border border-primary/15 rounded-xl p-4">
        <h4 className="font-semibold text-secondary mb-2 text-sm">ℹ️ Subscription Statuses</h4>
        <ul className="text-xs text-dark/60 space-y-1">
          <li><span className="font-semibold text-green-700">Active</span> — paid subscription on a current plan</li>
          <li><span className="font-semibold text-red-700">Lapsed</span> — previously subscribed; payment failed or subscription cancelled in Stripe</li>
          <li><span className="font-semibold text-orange-700">Never Activated</span> — Stripe customer exists but no subscription was completed</li>
          <li><span className="font-semibold text-blue-700">Trial</span> — on a free trial</li>
          <li><span className="font-semibold text-gray-600">No Payment</span> — no Stripe record at all</li>
          <li><span className="font-semibold text-purple-700">Always Free</span> — manually overridden to never require payment</li>
          <li className="pt-1">Use <span className="font-medium">Sync Stripe</span> to pull the latest subscription state from Stripe for any broker/seller account.</li>
        </ul>
      </div>
    </div>
  );
}
