'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import { Edit2 } from 'lucide-react';
import ImageCropModal from '../ImageCropModal';

const PAID_TIERS = new Set([
  'basic', 'plus', 'pro', 'premium',
  'private_basic', 'private_plus', 'private_pro',
]);

function getSubscriptionBadge(dealer: any) {
  if (dealer.always_free) return { label: 'Always Free', bg: 'bg-purple-100', text: 'text-purple-700' };
  if (dealer.trial_active) return { label: 'Trial', bg: 'bg-blue-100', text: 'text-blue-700' };
  if (PAID_TIERS.has(dealer.subscription_tier)) return { label: dealer.subscription_tier, bg: 'bg-green-100', text: 'text-green-700' };
  if (dealer.stripe_subscription_id) return { label: 'Lapsed', bg: 'bg-red-100', text: 'text-red-700' };
  if (dealer.stripe_customer_id) return { label: 'Never Activated', bg: 'bg-orange-100', text: 'text-orange-700' };
  return { label: 'No Payment', bg: 'bg-gray-100', text: 'text-gray-600' };
}

export default function AdminDealersTab() {
  const [dealers, setDealers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [filterSubStatus, setFilterSubStatus] = useState('');

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', company_name: '', email: '', phone: '',
    city: '', state: '', country: 'USA', verified: false, active: true,
  });

  // Per-row action state
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: number; type: 'success' | 'error'; text: string } | null>(null);

  // Edit profile modal state
  const [editingProfile, setEditingProfile] = useState<{ dealerId: number; dealerName: string } | null>(null);
  const [profileForm, setProfileForm] = useState<Record<string, any>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState<Record<string, boolean>>({});
  // Only used for the "Edit" flow on an already-uploaded logo/banner — new
  // uploads go straight through (see handleFileSelected below).
  const [pendingCropFile, setPendingCropFile] = useState<{ key: string; file: File; mediaId: number } | null>(null);

  // Team accordion state: dealerId → member list (null = not yet loaded)
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [teamData, setTeamData] = useState<Record<number, any[]>>({});
  const [teamLoading, setTeamLoading] = useState<number | null>(null);

  const toggleTeam = async (dealerId: number) => {
    if (expandedTeam === dealerId) {
      setExpandedTeam(null);
      return;
    }
    setExpandedTeam(dealerId);
    if (teamData[dealerId]) return; // already fetched
    setTeamLoading(dealerId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/dealers/${dealerId}/team`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeamData(prev => ({ ...prev, [dealerId]: data.team ?? [] }));
      } else {
        setTeamData(prev => ({ ...prev, [dealerId]: [] }));
      }
    } catch {
      setTeamData(prev => ({ ...prev, [dealerId]: [] }));
    } finally {
      setTeamLoading(null);
    }
  };

  const showMsg = (id: number, type: 'success' | 'error', text: string) => {
    setActionMsg({ id, type, text });
    setTimeout(() => setActionMsg(null), 5000);
  };

  const fetchDealers = useCallback(async (overridePage?: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const skip = (overridePage ?? page) * PAGE_SIZE;
      const params = new URLSearchParams({ skip: String(skip), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (filterSubStatus) params.set('subscription_status', filterSubStatus);

      const res = await fetch(apiUrl(`/admin/dealers?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.dealers ?? []);
        setDealers(list);
        setTotal(data.total ?? list.length);
      } else {
        setDealers([]);
        setTotal(0);
      }
    } catch {
      setDealers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, filterSubStatus, page]);

  useEffect(() => {
    setPage(0);
    fetchDealers(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterSubStatus]);

  useEffect(() => {
    fetchDealers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleCreateDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/admin/dealers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const result = await res.json();
        alert(result.message || 'Broker created successfully. A password-setup email has been sent.');
        setShowCreateForm(false);
        setFormData({ name: '', company_name: '', email: '', phone: '', city: '', state: '', country: 'USA', verified: false, active: true });
        fetchDealers();
      } else {
        const err = await res.json();
        alert(`Failed to create broker: ${err.detail}`);
      }
    } catch {
      alert('Failed to create broker');
    }
  };

  const handleDeleteDealer = async (id: number) => {
    if (!confirm('Are you sure you want to delete this broker?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/dealers/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDealers(dealers.filter(d => d.id !== id));
        setTotal(t => t - 1);
      } else {
        alert('Failed to delete broker');
      }
    } catch {
      alert('Failed to delete broker');
    }
  };

  const handleToggleVerified = async (dealer: any) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/dealers/${dealer.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ verified: !dealer.verified }),
      });
      if (res.ok) {
        setDealers(dealers.map(d => d.id === dealer.id ? { ...d, verified: !dealer.verified } : d));
      }
    } catch {
      console.error('Failed to update dealer');
    }
  };

  const handleMediaUpload = async (key: string, file: File) => {
    setMediaUploading(prev => ({ ...prev, [key]: true }));
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      // Attribute the upload to the dealer whose profile this is, not the
      // admin doing the editing — otherwise it lands in the admin's own
      // personal media library instead of this dealer's.
      if (editingProfile) fd.append('as_dealer_id', String(editingProfile.dealerId));
      const res = await fetch(apiUrl('/media/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setProfileForm((f: Record<string, any>) => ({ ...f, [key]: data.media.url }));
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setMediaUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Logo/banner are single-file uploads — upload immediately, no forced
  // crop modal. Use the "Edit" button on an existing logo/banner to crop it.
  const handleFileSelected = (key: string, file: File) => {
    handleMediaUpload(key, file);
  };

  // Edit an already-uploaded logo/banner. profileForm only stores the plain
  // URL, so first recover the MediaFile id by matching against the org's
  // media library, then re-open the crop modal on the full-res image.
  const startEditLogoBanner = async (key: string, url: string) => {
    setMediaUploading(prev => ({ ...prev, [key]: true }));
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ limit: '200' });
      if (editingProfile) params.append('as_dealer_id', String(editingProfile.dealerId));
      const res = await fetch(apiUrl(`/media/my-media?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      let mediaId: number | null = null;
      if (res.ok) {
        const data = await res.json();
        const match = (data.media || []).find((m: any) => m.url === url);
        if (match) mediaId = match.id;
      }
      if (mediaId == null) {
        alert('Could not find this photo in the media library to edit it.');
        return;
      }
      const imgRes = await fetch(url);
      const blob = await imgRes.blob();
      const file = new File([blob], `${key}.jpg`, { type: blob.type || 'image/jpeg' });
      setPendingCropFile({ key, file, mediaId });
    } catch {
      alert('Could not load this photo for editing');
    } finally {
      setMediaUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  const finishEditLogoBanner = async (edited: File[]) => {
    if (!pendingCropFile) return;
    const { key, mediaId } = pendingCropFile;
    setPendingCropFile(null);
    if (!edited[0]) return;

    setMediaUploading(prev => ({ ...prev, [key]: true }));
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', edited[0]);
      if (editingProfile) fd.append('as_dealer_id', String(editingProfile.dealerId));
      const r = await fetch(apiUrl(`/media/${mediaId}/replace`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (r.ok) {
        const data = await r.json();
        setProfileForm((f: Record<string, any>) => ({ ...f, [key]: data.media.url }));
      } else {
        alert('Failed to save edited photo');
      }
    } catch {
      alert('Failed to save edited photo');
    } finally {
      setMediaUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  const openEditProfile = async (dealer: any) => {
    setEditingProfile({ dealerId: dealer.id, dealerName: dealer.name || dealer.company_name || dealer.email });
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/dealers/${dealer.id}/profile`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfileForm(data);
      }
    } catch { /* swallow */ }
    finally { setProfileLoading(false); }
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    setProfileSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/dealers/${editingProfile.dealerId}/profile`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        showMsg(editingProfile.dealerId, 'success', 'Profile updated');
        setEditingProfile(null);
      } else {
        const err = await res.json();
        showMsg(editingProfile.dealerId, 'error', err.detail || 'Save failed');
      }
    } catch {
      if (editingProfile) showMsg(editingProfile.dealerId, 'error', 'Network error');
    } finally { setProfileSaving(false); }
  };

  const handleSyncStripe = async (dealer: any) => {    setActionLoading(dealer.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/users/${dealer.id}/sync-stripe`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDealers(dealers.map(d => d.id === dealer.id ? { ...d, ...data.user } : d));
        const changes = Object.keys(data.updated || {});
        showMsg(dealer.id, 'success', changes.length ? `Synced: ${changes.join(', ')} updated` : 'Already up-to-date');
      } else {
        showMsg(dealer.id, 'error', data.detail || 'Sync failed');
      }
    } catch {
      showMsg(dealer.id, 'error', 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-secondary">Broker Management</h2>
          {!loading && <p className="text-xs text-dark/50 mt-0.5">{total.toLocaleString()} broker{total !== 1 ? 's' : ''} found</p>}
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition"
        >
          {showCreateForm ? 'Cancel' : '+ Add Broker'}
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
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

      {/* Create Dealer Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-semibold text-secondary mb-4">Create New Broker</h3>
          <form onSubmit={handleCreateDealer} className="grid grid-cols-2 gap-4">
            {[
              { label: 'Name *', key: 'name', type: 'text', required: true },
              { label: 'Company Name', key: 'company_name', type: 'text', required: false },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-dark/70 mb-1">{label}</label>
                <input type={type} required={required} value={(formData as any)[key]}
                  onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Email *</label>
              <input type="email" required value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="broker@example.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Phone</label>
              <input type="tel" value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">City</label>
              <input type="text" value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">State</label>
              <input type="text" value={formData.state}
                onChange={e => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div className="col-span-2 flex gap-6">
              <label className="flex items-center gap-2 text-sm text-dark/70 cursor-pointer">
                <input type="checkbox" checked={formData.verified}
                  onChange={e => setFormData({ ...formData, verified: e.target.checked })}
                  className="rounded border-gray-300" />
                Verified
              </label>
              <label className="flex items-center gap-2 text-sm text-dark/70 cursor-pointer">
                <input type="checkbox" checked={formData.active}
                  onChange={e => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-gray-300" />
                Active
              </label>
            </div>
            <div className="col-span-2">
              <button type="submit" className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition">
                Create Broker
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dealers Table */}
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-dark/50 text-sm">Loading brokers...</div>
        ) : dealers.length === 0 ? (
          <div className="text-center py-12 text-dark/50 text-sm">No brokers match the current filters.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['', 'Broker', 'Contact', 'Subscription', 'Listings', 'Verified', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${i === 6 ? 'text-right pr-6' : ''} ${i === 0 ? 'w-8' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {dealers.map(dealer => {
                const subBadge = getSubscriptionBadge(dealer);
                return (
                  <>
                    <tr key={dealer.id} className="hover:bg-gray-50 transition">
                      {/* Expand toggle */}
                      <td className="pl-3 pr-1 py-3 w-8">
                        <button
                          onClick={() => toggleTeam(dealer.id)}
                          title="Toggle team members"
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition text-gray-400"
                        >
                          <svg className={`w-3.5 h-3.5 transition-transform ${expandedTeam === dealer.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      {/* Dealer name/company */}
                      <td className="px-4 py-3 min-w-[160px]">
                        <div className="font-medium text-secondary text-sm">{dealer.name}</div>
                        {dealer.company_name && <div className="text-xs text-dark/50">{dealer.company_name}</div>}
                        {dealer.stripe_subscription_id && (
                          <div className="text-[10px] text-dark/30 font-mono mt-0.5 truncate max-w-[150px]" title={dealer.stripe_subscription_id}>
                            sub: …{dealer.stripe_subscription_id.slice(-8)}
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 min-w-[160px]">
                        <div className="text-sm text-dark/80">{dealer.email}</div>
                        {dealer.phone && <div className="text-xs text-dark/50">{dealer.phone}</div>}
                        <div className="text-xs text-dark/40 mt-0.5">
                          {new Date(dealer.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Subscription */}
                      <td className="px-4 py-3 whitespace-nowrap min-w-[130px]">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${subBadge.bg} ${subBadge.text}`}>
                          {subBadge.label}
                        </span>
                        {dealer.trial_active && dealer.trial_end_date && (
                          <div className="text-[10px] text-dark/40 mt-0.5">
                            ends {new Date(dealer.trial_end_date).toLocaleDateString()}
                          </div>
                        )}
                        <div className={`text-[10px] mt-0.5 ${dealer.active ? 'text-green-600' : 'text-red-500'}`}>
                          account {dealer.active ? 'active' : 'inactive'}
                        </div>
                      </td>

                      {/* Listings */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary">{dealer.active_listings}</div>
                        <div className="text-xs text-dark/40">{dealer.total_listings} total</div>
                      </td>

                      {/* Verified toggle */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleVerified(dealer)}
                          className={`px-2 py-0.5 rounded text-xs font-semibold transition ${
                            dealer.verified
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {dealer.verified ? '✓ Verified' : 'Unverified'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => openEditProfile(dealer)}
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition"
                          >
                            Edit Profile
                          </button>
                          {(dealer.stripe_customer_id || dealer.stripe_subscription_id) && (
                            <button
                              onClick={() => handleSyncStripe(dealer)}
                              disabled={actionLoading === dealer.id}
                              title="Pull latest subscription status from Stripe"
                              className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition disabled:opacity-50"
                            >
                              {actionLoading === dealer.id ? '...' : 'Sync Stripe'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDealer(dealer.id)}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Per-row feedback */}
                    {actionMsg?.id === dealer.id && actionMsg && (
                      <tr key={`msg-${dealer.id}`}>
                        <td colSpan={7} className="px-4 pb-2 pt-0">
                          <div className={`text-xs px-3 py-1.5 rounded-md ${
                            actionMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>{actionMsg.text}</div>
                        </td>
                      </tr>
                    )}

                    {/* Team accordion */}
                    {expandedTeam === dealer.id && (
                      <tr key={`team-${dealer.id}`}>
                        <td colSpan={7} className="px-0 py-0 bg-slate-50 border-b border-gray-100">
                          <div className="px-6 py-4">
                            <div className="flex items-center gap-2 mb-3">
                              <svg className="w-4 h-4 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                              </svg>
                              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Team Members</span>
                            </div>

                            {teamLoading === dealer.id ? (
                              <p className="text-xs text-dark/40 py-2">Loading...</p>
                            ) : !teamData[dealer.id] || teamData[dealer.id].length === 0 ? (
                              <p className="text-xs text-dark/40 py-2">No team members under this account.</p>
                            ) : (
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="text-dark/40 uppercase tracking-wider">
                                    {['Name', 'Email', 'Phone', 'Role / Type', 'Account', 'Joined'].map(col => (
                                      <th key={col} className="pr-6 pb-2 text-left font-semibold">{col}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {teamData[dealer.id].map((member: any) => (
                                    <tr key={member.id} className="hover:bg-white/60 transition">
                                      <td className="pr-6 py-2 font-medium text-secondary">
                                        {member.first_name} {member.last_name}
                                      </td>
                                      <td className="pr-6 py-2 text-dark/70">{member.email}</td>
                                      <td className="pr-6 py-2 text-dark/50">{member.phone || '—'}</td>
                                      <td className="pr-6 py-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                          member.user_type === 'salesman' ? 'bg-amber-100 text-amber-700'
                                          : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          {member.role || member.user_type}
                                        </span>
                                      </td>
                                      <td className="pr-6 py-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                          member.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                        }`}>
                                          {member.active ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td className="py-2 text-dark/40">
                                        {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
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

      {/* Edit Broker Profile Modal */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-secondary">Edit Broker Profile</h2>
                <p className="text-xs text-dark/50 mt-0.5">{editingProfile.dealerName}</p>
              </div>
              <button onClick={() => setEditingProfile(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {profileLoading ? (
              <div className="p-12 text-center text-sm text-dark/40">Loading profile...</div>
            ) : Object.keys(profileForm).length === 0 ? (
              <div className="p-12 text-center text-sm text-dark/40">No profile found for this broker.</div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Basic info */}
                <div>
                  <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Business Info</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Display Name', key: 'name' },
                      { label: 'Company Name', key: 'company_name' },
                      { label: 'Email', key: 'email' },
                      { label: 'Phone', key: 'phone' },
                      { label: 'Website', key: 'website' },
                      { label: 'Primary Color', key: 'primary_color' },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-dark/60 mb-1">{label}</label>
                        <input
                          type="text"
                          value={profileForm[key] ?? ''}
                          onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Location</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Address', key: 'address' },
                      { label: 'City', key: 'city' },
                      { label: 'State', key: 'state' },
                      { label: 'Country', key: 'country' },
                      { label: 'Zip Code', key: 'zip_code' },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-dark/60 mb-1">{label}</label>
                        <input
                          type="text"
                          value={profileForm[key] ?? ''}
                          onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social */}
                <div>
                  <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Social / Media</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Logo and Banner — include file upload button */}
                    {(['logo_url', 'banner_url'] as const).map((key) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-dark/60 mb-1">
                          {key === 'logo_url' ? 'Logo URL' : 'Banner URL'}
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={profileForm[key] ?? ''}
                            onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                            className="flex-1 min-w-0 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="https://..."
                          />
                          <label
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                              mediaUploading[key]
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-secondary/10 text-secondary hover:bg-secondary/20 cursor-pointer'
                            }`}
                          >
                            {mediaUploading[key] ? '...' : '↑ Upload'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={!!mediaUploading[key]}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleFileSelected(key, f);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                        {profileForm[key] && (
                          <div className="relative mt-1.5 inline-block">
                            <img
                              src={profileForm[key]}
                              alt=""
                              className="h-8 max-w-[120px] object-contain rounded border border-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => startEditLogoBanner(key, profileForm[key])}
                              disabled={!!mediaUploading[key]}
                              title="Edit photo"
                              className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-black/50 text-white hover:bg-[#10214F] disabled:opacity-50"
                            >
                              <Edit2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Social links */}
                    {[
                      { label: 'Facebook URL', key: 'facebook_url' },
                      { label: 'Instagram URL', key: 'instagram_url' },
                      { label: 'Twitter URL', key: 'twitter_url' },
                      { label: 'LinkedIn URL', key: 'linkedin_url' },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-dark/60 mb-1">{label}</label>
                        <input
                          type="text"
                          value={profileForm[key] ?? ''}
                          onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Text areas */}
                <div>
                  <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Content</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Description', key: 'description' },
                      { label: 'About Section', key: 'about_section' },
                      { label: 'Meta Title', key: 'meta_title' },
                      { label: 'Meta Description', key: 'meta_description' },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-dark/60 mb-1">{label}</label>
                        <textarea
                          rows={key === 'description' || key === 'about_section' ? 3 : 2}
                          value={profileForm[key] ?? ''}
                          onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div>
                  <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Settings</h3>
                  <div className="flex flex-wrap gap-5">
                    {[
                      { label: 'Co-brokering enabled', key: 'cobrokering_enabled' },
                      { label: 'Show team on profile', key: 'show_team_on_profile' },
                      { label: 'Verified', key: 'verified' },
                      { label: 'Active', key: 'active' },
                    ].map(({ label, key }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-dark/70 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!profileForm[key]}
                          onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <button onClick={() => setEditingProfile(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSaveProfile} disabled={profileSaving} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-60">
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {pendingCropFile && (
        <ImageCropModal
          files={[pendingCropFile.file]}
          aspect={pendingCropFile.key === 'logo_url' ? 1 : undefined}
          onComplete={finishEditLogoBanner}
          onCancel={() => setPendingCropFile(null)}
        />
      )}
    </div>
  );
}
