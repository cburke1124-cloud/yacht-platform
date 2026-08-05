'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit2, Trash2, ExternalLink, Eye, MessageSquare } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import PhoneInput from '@/app/components/PhoneInput';
import DealerProfileEditForm from '@/app/components/DealerProfileEditForm';

interface Account {
  id: number;
  user_type: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  verified: boolean;
  active: boolean;
  subscription_tier: string;
  created_at: string | null;
}

interface ManagedListing {
  id: number;
  title: string;
  status: string;
  price: number | null;
  currency: string;
  views: number;
  inquiries: number;
  created_at: string | null;
  updated_at: string | null;
  primary_image: string | null;
}

const authHeaders = () => ({
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});

export default function ManagedAccountPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = Number(params?.id);

  const [account, setAccount] = useState<Account | null>(null);
  const [listings, setListings] = useState<ManagedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  const [accountForm, setAccountForm] = useState({ first_name: '', last_name: '', phone: '', company_name: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountMsg, setAccountMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [busyListingId, setBusyListingId] = useState<number | null>(null);

  useEffect(() => {
    if (accountId) checkAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function checkAuthAndLoad() {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    try {
      const meRes = await fetch(apiUrl('/auth/me'), { headers: authHeaders() });
      if (!meRes.ok) throw new Error('not authenticated');
      const me = await meRes.json();
      if (me.user_type !== 'salesman') { alert('Sales rep access required'); router.push('/'); return; }
    } catch {
      router.push('/login');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Scoping check: let this call 403/404 rather than re-deriving
      // "does this rep manage this account" client-side.
      const accRes = await fetch(apiUrl(`/sales-rep/dealers/${accountId}`), { headers: authHeaders() });
      if (accRes.status === 403) { setError("You don't have access to manage this account."); setLoading(false); return; }
      if (accRes.status === 404) { setError('Account not found.'); setLoading(false); return; }
      if (!accRes.ok) throw new Error('load failed');
      const acc: Account = await accRes.json();
      setAccount(acc);
      setAccountForm({
        first_name: acc.first_name || '',
        last_name: acc.last_name || '',
        phone: acc.phone || '',
        company_name: acc.company_name || '',
      });

      const listingsRes = await fetch(apiUrl(`/sales-rep/dealers/${accountId}/listings`), { headers: authHeaders() });
      if (listingsRes.ok) {
        const data = await listingsRes.json();
        setListings(data.listings || []);
      }
    } catch {
      setError('Failed to load account.');
    } finally {
      setLoading(false);
    }
  }

  async function saveAccountFields() {
    setSavingAccount(true);
    setAccountMsg(null);
    try {
      const body: Record<string, any> = {
        first_name: accountForm.first_name,
        last_name: accountForm.last_name,
        phone: accountForm.phone,
      };
      if (account?.user_type === 'dealer') body.company_name = accountForm.company_name;

      const res = await fetch(apiUrl(`/sales-rep/dealers/${accountId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setAccountMsg({ type: 'success', text: 'Account updated' });
        setAccount(a => a ? { ...a, ...body } : a);
      } else {
        const err = await res.json().catch(() => ({}));
        setAccountMsg({ type: 'error', text: err.detail || 'Save failed' });
      }
    } catch {
      setAccountMsg({ type: 'error', text: 'Network error' });
    } finally {
      setSavingAccount(false);
    }
  }

  async function toggleListingStatus(listing: ManagedListing) {
    const newStatus = listing.status === 'active' ? 'draft' : 'active';
    setBusyListingId(listing.id);
    try {
      const res = await fetch(apiUrl(`/listings/${listing.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setListings(ls => ls.map(l => l.id === listing.id ? { ...l, status: newStatus } : l));
      } else {
        alert('Failed to update listing status');
      }
    } catch {
      alert('Network error');
    } finally {
      setBusyListingId(null);
    }
  }

  async function deleteListing(listing: ManagedListing) {
    if (!confirm(`Delete "${listing.title}"? This can be restored from Recently Deleted.`)) return;
    setBusyListingId(listing.id);
    try {
      const res = await fetch(apiUrl(`/listings/${listing.id}`), { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        setListings(ls => ls.filter(l => l.id !== listing.id));
      } else {
        alert('Failed to delete listing');
      }
    } catch {
      alert('Network error');
    } finally {
      setBusyListingId(null);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-dark/50">Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-dark/70">{error}</p>
        <Link href="/sales-rep" className="text-primary font-medium text-sm hover:text-primary/80">&larr; Back to Dashboard</Link>
      </div>
    );
  }

  if (!account) return null;

  const isDealer = account.user_type === 'dealer';

  return (
    <div className="min-h-screen bg-soft">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/sales-rep" className="inline-flex items-center gap-1 text-sm text-dark/60 hover:text-dark mb-4">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* Account header */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-secondary">
                {account.company_name || `${account.first_name} ${account.last_name}`}
              </h1>
              <p className="text-sm text-dark/60 mt-1">{account.email}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 capitalize">
                  {isDealer ? 'Broker' : 'Private Seller'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${account.verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {account.verified ? 'Verified' : 'Unverified'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${account.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {account.active ? 'Active' : 'Inactive'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 capitalize">
                  {account.subscription_tier}
                </span>
              </div>
            </div>
            {isDealer && (
              <button
                onClick={() => setEditingProfile(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium flex items-center gap-1.5"
              >
                <Edit2 size={16} /> Edit Broker Profile
              </button>
            )}
          </div>
        </div>

        {/* Account fields mini-form */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-bold text-secondary mb-4">Account Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-dark/60 mb-1">First Name</label>
              <input
                type="text"
                value={accountForm.first_name}
                onChange={e => setAccountForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-dark/60 mb-1">Last Name</label>
              <input
                type="text"
                value={accountForm.last_name}
                onChange={e => setAccountForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-dark/60 mb-1">Phone</label>
              <PhoneInput value={accountForm.phone} onChange={value => setAccountForm(f => ({ ...f, phone: value }))} />
            </div>
            {isDealer && (
              <div>
                <label className="block text-xs font-medium text-dark/60 mb-1">Company Name</label>
                <input
                  type="text"
                  value={accountForm.company_name}
                  onChange={e => setAccountForm(f => ({ ...f, company_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={saveAccountFields}
              disabled={savingAccount}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-60"
            >
              {savingAccount ? 'Saving...' : 'Save'}
            </button>
            {accountMsg && (
              <span className={`text-sm ${accountMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{accountMsg.text}</span>
            )}
          </div>
        </div>

        {/* Listings table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-bold text-secondary">Listings</h2>
            <p className="text-sm text-dark/60 mt-1">{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {listings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-dark/50">No listings yet.</td>
                  </tr>
                ) : listings.map(listing => (
                  <tr key={listing.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {listing.primary_image && (
                          <img src={listing.primary_image} alt="" className="w-12 h-9 object-cover rounded border border-gray-100" />
                        )}
                        <span className="font-medium text-secondary">{listing.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => toggleListingStatus(listing)}
                        disabled={busyListingId === listing.id}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize transition ${
                          listing.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {listing.status}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-sm text-secondary">
                      {listing.price != null ? `${listing.currency || 'USD'} ${listing.price.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm space-y-1">
                      <div className="flex items-center gap-2"><Eye size={14} className="text-gray-400" />{listing.views}</div>
                      <div className="flex items-center gap-2"><MessageSquare size={14} className="text-gray-400" />{listing.inquiries}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/listings/${listing.id}/edit`}
                          className="text-primary hover:text-primary/90 text-sm font-medium flex items-center gap-1"
                        >
                          <Edit2 size={14} /> Edit
                        </Link>
                        <a
                          href={`/listings/${listing.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-dark/60 hover:text-dark text-sm font-medium flex items-center gap-1"
                        >
                          <ExternalLink size={14} /> View
                        </a>
                        <button
                          onClick={() => deleteListing(listing)}
                          disabled={busyListingId === listing.id}
                          className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingProfile && (
        <DealerProfileEditForm
          dealerId={account.id}
          dealerName={account.company_name || `${account.first_name} ${account.last_name}`}
          apiBase="/sales-rep/dealers"
          showTrustToggles={false}
          onSaved={() => setEditingProfile(false)}
          onCancel={() => setEditingProfile(false)}
        />
      )}
    </div>
  );
}
