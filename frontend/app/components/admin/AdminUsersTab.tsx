'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function AdminUsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    user_type: 'admin',
    company_name: ''
  });

  // Inline email editing
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: number; type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/users'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : (data.users ?? []));
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (id: number, type: 'success' | 'error', text: string) => {
    setActionMsg({ id, type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...formData, agree_terms: true, agree_communications: true })
      });
      if (response.ok) {
        alert('User created successfully');
        setShowCreateForm(false);
        setFormData({ email: '', password: '', first_name: '', last_name: '', phone: '', user_type: 'admin', company_name: '' });
        fetchUsers();
      } else {
        const error = await response.json();
        alert(`Failed to create user: ${error.detail}`);
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('Failed to create user');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/users/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const handleSendReset = async (user: any) => {
    setActionLoading(user.id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: user.email })
      });
      if (response.ok) {
        showMsg(user.id, 'success', `Reset link sent to ${user.email}`);
      } else {
        showMsg(user.id, 'error', 'Failed to send reset link');
      }
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
      const response = await fetch(apiUrl(`/admin/users/${user.id}/email`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail.trim().toLowerCase() })
      });
      const data = await response.json();
      if (response.ok) {
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

  if (loading) {
    return <div className="text-center py-8 text-dark/60">Loading users...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-secondary">User Management</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition"
        >
          {showCreateForm ? 'Cancel' : '+ Create Admin User'}
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-semibold text-secondary mb-4">Create New Admin User</h3>
          <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-4">
            {[
              { label: 'First Name *', key: 'first_name', type: 'text', required: true },
              { label: 'Last Name *', key: 'last_name', type: 'text', required: true },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-dark/70 mb-1">{label}</label>
                <input type={type} required={required} value={(formData as any)[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-dark/70 mb-1">Email *</label>
              <input type="email" required value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-dark/70 mb-1">Password *</label>
              <input type="password" required value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Phone</label>
              <input type="tel" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">User Type *</label>
              <select value={formData.user_type}
                onChange={(e) => setFormData({ ...formData, user_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                <option value="admin">Admin</option>
                <option value="dealer">Dealer</option>
                <option value="private">Private</option>
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
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['User', 'Email', 'Type', 'Status', 'Created', 'Actions'].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${i === 5 ? 'text-right pr-6' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-dark/50 text-sm">No users found.</td>
              </tr>
            ) : (
              users.map((user) => (
                <>
                  <tr key={user.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-secondary text-sm">{user.first_name} {user.last_name}</div>
                      {user.company_name && <div className="text-xs text-dark/50">{user.company_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-dark/80">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        user.user_type === 'admin' ? 'bg-purple-100 text-purple-700'
                        : user.user_type === 'dealer' ? 'bg-primary/10 text-primary'
                        : 'bg-gray-100 text-gray-700'
                      }`}>{user.user_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-dark/50">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Send Password Reset */}
                        <button
                          onClick={() => handleSendReset(user)}
                          disabled={actionLoading === user.id}
                          title="Send password reset email"
                          className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition disabled:opacity-50"
                        >
                          {actionLoading === user.id ? '...' : 'Reset Link'}
                        </button>
                        {/* Change Email */}
                        <button
                          onClick={() => {
                            setEditingEmailId(editingEmailId === user.id ? null : user.id);
                            setNewEmail(user.email);
                          }}
                          className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100 transition"
                        >
                          {editingEmailId === user.id ? 'Cancel' : 'Email'}
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline feedback */}
                  {actionMsg?.id === user.id && (
                    <tr key={`msg-${user.id}`}>
                      <td colSpan={6} className="px-4 pb-2 pt-0">
                        <div className={`text-xs px-3 py-1.5 rounded-md ${
                          actionMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>{actionMsg.text}</div>
                      </td>
                    </tr>
                  )}

                  {/* Change Email inline editor */}
                  {editingEmailId === user.id && (
                    <tr key={`email-${user.id}`} className="bg-amber-50/40">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-dark/60 shrink-0">New email for <span className="font-semibold text-secondary">{user.first_name} {user.last_name}</span>:</span>
                          <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="new@email.com"
                            className="flex-1 px-3 py-1.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 bg-white"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleChangeEmail(user); if (e.key === 'Escape') { setEditingEmailId(null); setNewEmail(''); } }}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-primary/5 border border-primary/15 rounded-xl p-4">
        <h4 className="font-semibold text-secondary mb-2 text-sm">ℹ️ About User Management</h4>
        <ul className="text-xs text-dark/60 space-y-1">
          <li>• <span className="font-medium">Reset Link</span> — sends a password reset email to the user's address</li>
          <li>• <span className="font-medium">Email</span> — change the user's login email address</li>
          <li>• Only admin users can access the admin panel</li>
          <li>• Dealer users get access to the dealer dashboard</li>
        </ul>
      </div>
    </div>
  );
}

