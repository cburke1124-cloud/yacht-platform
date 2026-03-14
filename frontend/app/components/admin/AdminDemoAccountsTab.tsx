'use client';

import React, { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import { Plus, Trash2, RotateCcw, Eye, Copy, Check } from 'lucide-react';

interface DemoAccount {
  id: number;
  email: string;
  company_name: string;
  sales_rep_id: number;
  sales_rep_name: string;
  listings: number;
  created_at: string;
}

interface SalesRep {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export default function AdminDemoAccountsTab() {
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch demo accounts and sales reps
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/admin/demo-accounts'), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDemoAccounts(data.demo_accounts || []);
      }

      // Fetch sales reps
      const repsResponse = await fetch(apiUrl('/admin/users?user_type=salesman&limit=1000'), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (repsResponse.ok) {
        const repsData = await repsResponse.json();
        setSalesReps(repsData.users || []);
      }
    } catch (err) {
      setError(`Failed to fetch data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Create demo account
  const handleCreateDemo = async () => {
    if (!selectedRepId) {
      setError('Please select a sales representative');
      return;
    }

    setCreatingDemo(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(apiUrl('/admin/demo-account/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ sales_rep_id: parseInt(selectedRepId) }),
      });

      if (response.ok) {
        const data = await response.json();
        setCredentials({
          email: data.demo_account.email,
          password: data.demo_account.password,
        });
        setShowCredentials(parseInt(selectedRepId));
        setSuccess(`Demo account created successfully! ${data.listings_created} listings created.`);
        setSelectedRepId('');
        await fetchData();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to create demo account');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreatingDemo(false);
    }
  };

  // Reset demo account
  const handleResetDemo = async (demoAccountId: number) => {
    if (!confirm('Are you sure? This will delete all current listings and restore the sample listings.')) return;

    try {
      const response = await fetch(apiUrl(`/admin/demo-account/${demoAccountId}/reset`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.ok) {
        setSuccess('Demo account reset successfully');
        await fetchData();
      } else {
        setError('Failed to reset demo account');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Delete demo account
  const handleDeleteDemo = async (demoAccountId: number) => {
    if (!confirm('Are you sure? This will permanently delete the demo account and all data.')) return;

    try {
      const response = await fetch(apiUrl(`/admin/demo-account/${demoAccountId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.ok) {
        setSuccess('Demo account deleted successfully');
        await fetchData();
      } else {
        setError('Failed to delete demo account');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(type);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Get sales rep name
  const getRepName = (repId: number) => {
    const rep = salesReps.find(r => r.id === repId);
    return rep ? `${rep.first_name} ${rep.last_name}` : 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Demo Account Management</h2>
        <p className="text-gray-600 mb-6">Create and manage demo accounts for sales representatives</p>

        {/* Create Demo Account Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-cyan-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-cyan-600" />
            Create New Demo Account
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Sales Representative</label>
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">-- Select a sales rep --</option>
                {salesReps.length > 0 ? (
                  salesReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.first_name} {rep.last_name} ({rep.email})
                    </option>
                  ))
                ) : (
                  <option disabled>No sales representatives found</option>
                )}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleCreateDemo}
                disabled={creatingDemo || !selectedRepId}
                className="w-full px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                {creatingDemo ? 'Creating...' : 'Create Demo Account'}
              </button>
            </div>
          </div>
        </div>

        {/* Credentials Display */}
        {credentials && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 relative">
            <h4 className="font-semibold text-green-900 mb-3">📋 Demo Account Credentials</h4>
            <div className="space-y-2 bg-white rounded p-3 font-mono text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Email:</p>
                  <p className="text-gray-900 font-semibold break-all">{credentials.email}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(credentials.email, 'email')}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  {copiedEmail === 'email' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Password:</p>
                  <p className="text-gray-900 font-semibold break-all">{credentials.password}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(credentials.password, 'password')}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  {copiedEmail === 'password' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <p className="text-xs text-green-700 mt-3">⚠️ Save these credentials securely. The password will not be shown again.</p>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="text-xs text-green-600 hover:text-green-800 mt-1 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Demo Accounts List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Active Demo Accounts ({demoAccounts.length})
          </h3>
        </div>

        {demoAccounts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-600 mb-2">No demo accounts created yet</p>
            <p className="text-sm text-gray-500">Create one above to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Sales Rep</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Listings</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {demoAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-mono text-gray-900">{account.email}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{account.company_name}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {account.sales_rep_name || getRepName(account.sales_rep_id)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{account.listings}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {new Date(account.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right text-sm space-x-2">
                      <button
                        onClick={() => handleResetDemo(account.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded transition-colors"
                        title="Reset demo to pristine state"
                      >
                        <RotateCcw size={14} />
                        Reset
                      </button>
                      <button
                        onClick={() => handleDeleteDemo(account.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                        title="Delete demo account"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
