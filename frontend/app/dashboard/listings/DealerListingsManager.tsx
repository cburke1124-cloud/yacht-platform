'use client';

import { useState, useEffect } from 'react';
import { Edit, Eye, Trash2, ToggleLeft, ToggleRight, UserPlus, Check, X, MapPin, ScanEye, User, Upload } from 'lucide-react';
import Link from 'next/link';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import ListingPreviewModal from '@/app/components/ListingPreviewModal';

interface Listing {
  id: number;
  title: string;
  price?: number;
  year?: number;
  make?: string;
  model?: string;
  status: 'draft' | 'active' | 'archived' | 'sold';
  views: number;
  inquiries: number;
  featured: boolean;
  assigned_salesman_id?: number;
  guest_salesman_id?: number;
  created_at: string;
  images: Array<{ url: string }>;
  city?: string;
  state?: string;
}

interface TeamMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface GuestBroker {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  photo_url?: string;
}

interface QuickEditDraft {
  title: string;
  price: string;
  status: Listing['status'];
}

interface DealerListingsManagerProps {
  onStatsUpdate?: () => void;
}

export default function DealerListingsManager({ onStatsUpdate }: DealerListingsManagerProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [guestBrokers, setGuestBrokers] = useState<GuestBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigningSalesman, setAssigningSalesman] = useState<number | null>(null);
  const [quickEdits, setQuickEdits] = useState<Record<number, QuickEditDraft>>({});
  const [savingQuickEditId, setSavingQuickEditId] = useState<number | null>(null);
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [previewListing, setPreviewListing] = useState<Listing | null>(null);

  // Quick-create guest broker inside the assign modal
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ first_name: '', last_name: '', email: '', phone: '', title: '' });
  const [savingGuest, setSavingGuest] = useState(false);

  useEffect(() => {
    fetchListings();
    fetchTeamMembers();
    fetchGuestBrokers();
  }, [statusFilter]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = statusFilter === 'all'
        ? apiUrl('/listings/my-listings')
        : apiUrl(`/listings/my-listings?status=${statusFilter}`);
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setListings(data);
        setQuickEdits(
          data.reduce((acc: Record<number, QuickEditDraft>, listing: Listing) => {
            acc[listing.id] = {
              title: listing.title || '',
              price: listing.price != null ? String(listing.price) : '',
              status: listing.status || 'draft'
            };
            return acc;
          }, {})
        );
        
        // Notify parent to update stats
        if (onStatsUpdate) {
          onStatsUpdate();
        }
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/team/members'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch team:', error);
    }
  };

  const fetchGuestBrokers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/team/guest-brokers'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGuestBrokers(data);
      }
    } catch (error) {
      console.error('Failed to fetch guest brokers:', error);
    }
  };

  const updateListingStatus = async (listingId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${listingId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setListings(listings.map(l => 
          l.id === listingId ? { ...l, status: newStatus as any } : l
        ));
      } else {
        alert('Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status');
    }
  };

  const assignSalesman = async (listingId: number, salesmanId: number | null, isGuest = false) => {
    try {
      const token = localStorage.getItem('token');
      const body = isGuest
        ? { guest_salesman_id: salesmanId }
        : { salesman_id: salesmanId };
      const response = await fetch(apiUrl(`/listings/${listingId}/assign-salesman`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setListings(listings.map(l =>
          l.id === listingId
            ? {
                ...l,
                assigned_salesman_id: isGuest ? undefined : (salesmanId || undefined),
                guest_salesman_id: isGuest ? (salesmanId || undefined) : undefined,
              }
            : l
        ));
        setAssigningSalesman(null);
      } else {
        alert('Failed to assign salesman');
      }
    } catch (error) {
      console.error('Failed to assign salesman:', error);
      alert('Failed to assign salesman');
    }
  };

  const createAndAssignGuest = async (listingId: number) => {
    if (!newGuest.first_name.trim()) { alert('First name is required'); return; }
    setSavingGuest(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/team/guest-brokers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newGuest),
      });
      if (!res.ok) { alert('Failed to create broker'); return; }
      const created: GuestBroker = await res.json();
      setGuestBrokers(prev => [...prev, created]);
      await assignSalesman(listingId, created.id, true);
      setNewGuest({ first_name: '', last_name: '', email: '', phone: '', title: '' });
      setShowAddGuest(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingGuest(false);
    }
  };

  const updateQuickEditField = (listingId: number, field: keyof QuickEditDraft, value: string) => {
    const normalizedValue = field === 'status' ? (value as Listing['status']) : value;
    setQuickEdits(prev => ({
      ...prev,
      [listingId]: {
        ...(prev[listingId] || { title: '', price: '', status: 'draft' }),
        [field]: normalizedValue
      }
    }));
  };

  const saveQuickEdit = async (listingId: number) => {
    const draft = quickEdits[listingId];
    if (!draft) return;

    const payload: {
      title: string;
      status: Listing['status'];
      price?: number | null;
    } = {
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
              title: payload.title,
              status: payload.status,
              price: payload.price == null ? undefined : Number(payload.price)
            }
          : listing
      ));

      if (onStatsUpdate) {
        onStatsUpdate();
      }
    } catch (error) {
      console.error('Failed to save quick edit:', error);
      alert('Failed to save quick edit');
    } finally {
      setSavingQuickEditId(null);
    }
  };

  const deleteListing = async (listingId: number) => {
    if (!confirm('Are you sure you want to archive this listing?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${listingId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchListings();
      }
    } catch (error) {
      console.error('Failed to delete listing:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sold': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAssignedSalesman = (listing: Listing) => {
    if (listing.guest_salesman_id) {
      const g = guestBrokers.find(b => b.id === listing.guest_salesman_id);
      if (g) return { name: `${g.first_name} ${g.last_name}`.trim(), isGuest: true };
    }
    if (listing.assigned_salesman_id) {
      const m = teamMembers.find(m => m.id === listing.assigned_salesman_id);
      if (m) return { name: `${m.first_name} ${m.last_name}`, isGuest: false };
    }
    return null;
  };

  if (loading) {
    return <div className="text-center py-12">Loading listings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">My Listings</h2>
          <p className="text-gray-600 mt-1">{listings.length} total listings</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/listings/create"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            + Create a Listing
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'all', label: 'All' },
          { id: 'draft', label: 'Draft' },
          { id: 'active', label: 'Active' },
          { id: 'sold', label: 'Sold' },
          { id: 'archived', label: 'Archived' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              statusFilter === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            <span className="ml-2 text-sm">
              ({tab.id === 'all' ? listings.length : listings.filter(l => l.status === tab.id).length})
            </span>
          </button>
        ))}
      </div>

      {/* Listings Table */}
      {listings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">No listings found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-[800px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Listing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {listings.map((listing) => {
                const assignedSalesman = getAssignedSalesman(listing);
                
                return (
                  <tr key={listing.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-16 w-16 flex-shrink-0 mr-4">
                          <img
                            src={mediaUrl(listing.images[0]?.url)}
                            alt={listing.title}
                            className="h-16 w-16 rounded-lg object-cover"
                            onError={onImgError}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={quickEdits[listing.id]?.title ?? listing.title}
                            onChange={(e) => updateQuickEditField(listing.id, 'title', e.target.value)}
                            readOnly={!quickEditMode}
                            className={`text-sm font-medium text-gray-900 rounded px-2 py-1 w-64 ${quickEditMode ? 'border border-gray-300 bg-white' : 'border border-transparent bg-transparent pointer-events-none'}`}
                          />
                          <div className="text-sm text-gray-500">
                            {listing.year && `${listing.year} `}
                            {listing.make && `${listing.make} `}
                            {listing.model}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {listing.city && listing.state && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <MapPin size={14} />
                            <span className="text-sm">{listing.city}, {listing.state}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(quickEdits[listing.id]?.status || listing.status)}`}>
                          {quickEdits[listing.id]?.status || listing.status}
                        </span>
                        {quickEditMode && (
                          <select
                            value={quickEdits[listing.id]?.status ?? listing.status}
                            onChange={(e) => updateQuickEditField(listing.id, 'status', e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="sold">Sold</option>
                            <option value="archived">Archived</option>
                          </select>
                        )}

                        {listing.status === 'draft' && (
                          <button
                            onClick={() => updateListingStatus(listing.id, 'active')}
                            className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                          >
                            <ToggleRight size={14} />
                            Publish
                          </button>
                        )}
                        {listing.status === 'active' && (
                          <button
                            onClick={() => updateListingStatus(listing.id, 'draft')}
                            className="text-xs text-gray-600 hover:text-gray-700 font-medium flex items-center gap-1"
                          >
                            <ToggleLeft size={14} />
                            Unpublish
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={quickEdits[listing.id]?.price ?? (listing.price != null ? String(listing.price) : '')}
                          onChange={(e) => updateQuickEditField(listing.id, 'price', e.target.value)}
                          disabled={!quickEditMode}
                          className={`text-sm rounded px-2 py-1 w-28 ${quickEditMode ? 'border border-gray-300 bg-white' : 'border border-transparent bg-transparent pointer-events-none'}`}
                          placeholder="Price"
                        />
                      </div>
                      {assigningSalesman === listing.id ? (
                        <div className="space-y-2 min-w-[190px]">
                          {/* Team member accounts */}
                          {teamMembers.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Team Members</p>
                              {teamMembers.map(member => (
                                <button key={member.id}
                                  onClick={() => assignSalesman(listing.id, member.id, false)}
                                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                >
                                  {member.first_name} {member.last_name}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Guest / external brokers */}
                          {guestBrokers.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 mt-2">External Brokers</p>
                              {guestBrokers.map(broker => (
                                <button key={broker.id}
                                  onClick={() => assignSalesman(listing.id, broker.id, true)}
                                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                >
                                  {broker.first_name} {broker.last_name}
                                  {broker.title && <span className="text-gray-400 ml-1">· {broker.title}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Quick-add new guest broker */}
                          {showAddGuest ? (
                            <div className="border-t pt-2 space-y-1.5">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">New External Broker</p>
                              <input placeholder="First name *" value={newGuest.first_name}
                                onChange={e => setNewGuest(g => ({ ...g, first_name: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                              <input placeholder="Last name" value={newGuest.last_name}
                                onChange={e => setNewGuest(g => ({ ...g, last_name: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                              <input placeholder="Email" value={newGuest.email}
                                onChange={e => setNewGuest(g => ({ ...g, email: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                              <input placeholder="Phone" value={newGuest.phone}
                                onChange={e => setNewGuest(g => ({ ...g, phone: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                              <input placeholder="Title (e.g. Senior Broker)" value={newGuest.title}
                                onChange={e => setNewGuest(g => ({ ...g, title: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                              <div className="flex gap-1.5">
                                <button onClick={() => createAndAssignGuest(listing.id)} disabled={savingGuest}
                                  className="flex-1 text-xs bg-primary text-white rounded px-2 py-1 disabled:opacity-60">
                                  {savingGuest ? 'Saving…' : 'Save & Assign'}
                                </button>
                                <button onClick={() => setShowAddGuest(false)} className="text-xs text-gray-500 hover:text-gray-700 px-1">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setShowAddGuest(true)}
                              className="w-full text-left text-xs text-primary hover:underline mt-1 flex items-center gap-1 px-2">
                              <UserPlus size={12} /> Add external broker…
                            </button>
                          )}
                          <div className="flex gap-2 border-t pt-2">
                            <button onClick={() => assignSalesman(listing.id, null)}
                              className="text-xs text-red-500 hover:text-red-700">
                              Unassign
                            </button>
                            <button onClick={() => { setAssigningSalesman(null); setShowAddGuest(false); }}
                              className="ml-auto text-xs text-gray-500 hover:text-gray-700">
                              <X size={12} className="inline" /> Close
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {assignedSalesman ? (
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{assignedSalesman.name}</span>
                              {assignedSalesman.isGuest && (
                                <span className="text-[10px] text-emerald-600 font-medium">External</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Unassigned</span>
                          )}
                          <button
                            onClick={() => { setAssigningSalesman(listing.id); setShowAddGuest(false); }}
                            className="text-blue-600 hover:text-blue-700"
                            title="Assign broker"
                          >
                            <UserPlus size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col gap-1">
                        <span>{listing.views || 0} views</span>
                        <span>{listing.inquiries || 0} inquiries</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewListing(listing)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Preview listing as buyer"
                        >
                          <ScanEye size={18} />
                        </button>
                        <Link
                          href={`/listings/${listing.id}`}
                          target="_blank"
                          className="text-gray-600 hover:text-gray-900"
                          title="View live listing"
                        >
                          <Eye size={18} />
                        </Link>
                        <Link
                          href={`/dealer/listings/${listing.id}/edit`}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit listing"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => saveQuickEdit(listing.id)}
                          disabled={!quickEditMode || savingQuickEditId === listing.id}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                          title="Save quick edits"
                        >
                          {savingQuickEditId === listing.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => deleteListing(listing.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Archive listing"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ListingPreviewModal
        listing={previewListing}
        onClose={() => setPreviewListing(null)}
      />

      {/* Quick Edit toggle — subtle, bottom of page */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => setQuickEditMode((prev) => !prev)}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          {quickEditMode ? 'Exit Quick Edit Mode' : 'Enable Quick Edit Mode'}
        </button>
      </div>
    </div>
  );
}