'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ListingEditor from './ListingEditor';
import { apiUrl } from '@/app/lib/apiRoot';

interface QuickEditDraft {
  title: string;
  price: string;
  status: string;
}

export default function AdminListingsTab() {
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editingListing, setEditingListing] = useState<any>(null);
  const [quickEdits, setQuickEdits] = useState<Record<number, QuickEditDraft>>({});
  const [savingQuickEditId, setSavingQuickEditId] = useState<number | null>(null);
  const [quickEditMode, setQuickEditMode] = useState(false);

  useEffect(() => {
    fetchListings();
  }, [filter]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const statuses = filter === 'all' 
        ? ['active', 'draft', 'archived'] 
        : [filter];
      
      const allListings: any[] = [];
      
      for (const status of statuses) {
        const response = await fetch(
          apiUrl(`/listings?status=${status}&limit=1000`),
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          allListings.push(...data);
        }
      }
      
      setListings(allListings);
      setQuickEdits(
        allListings.reduce((acc: Record<number, QuickEditDraft>, listing: any) => {
          acc[listing.id] = {
            title: listing.title || '',
            price: listing.price != null ? String(listing.price) : '',
            status: listing.status || 'draft'
          };
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (listing: any) => {
    // Fetch full listing details including images
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${listing.id}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const fullListing = await response.json();
        setEditingListing(fullListing);
      }
    } catch (error) {
      console.error('Failed to fetch listing:', error);
      setEditingListing(listing); // Fallback to basic data
    }
  };

  const handleCloseEditor = () => {
    setEditingListing(null);
  };

  const handleSaveEditor = () => {
    setEditingListing(null);
    fetchListings();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setListings(listings.filter(l => l.id !== id));
        alert('Listing deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete listing:', error);
      alert('Failed to delete listing');
    }
  };

  const handleToggleFeatured = async (listing: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/featured-listings/manual-status'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_id: listing.id,
          featured: !listing.featured,
          duration_days: 30,
          plan: 'courtesy'
        })
      });

      if (response.ok) {
        fetchListings();
        alert(listing.featured ? 'Listing removed from featured' : 'Listing featured for free');
      }
    } catch (error) {
      console.error('Failed to update listing:', error);
      alert('Failed to update listing');
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

  const saveQuickEdit = async (id: number) => {
    const draft = quickEdits[id];
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

    setSavingQuickEditId(id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setListings(prev => prev.map((listing) =>
          listing.id === id
            ? {
                ...listing,
                title: String(payload.title ?? listing.title),
                status: String(payload.status ?? listing.status),
                price: payload.price == null ? undefined : Number(payload.price)
              }
            : listing
        ));
        alert('Quick edit saved');
      }
    } catch (error) {
      console.error('Failed to save quick edit:', error);
      alert('Failed to save quick edit');
    } finally {
      setSavingQuickEditId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading listings...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Listing Management</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuickEditMode((prev) => !prev)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${quickEditMode ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-primary text-white hover:bg-primary/90'}`}
          >
            {quickEditMode ? 'Exit Quick Edit Mode' : 'Enter Quick Edit Mode'}
          </button>
          <button
            onClick={() => window.location.href = '/listings/create'}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            + Create New Listing
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'active', 'draft', 'archived'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg capitalize ${
              filter === status
                      ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status} ({listings.filter(l => status === 'all' || l.status === status).length})
          </button>
        ))}
      </div>

      {/* Listings Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Listing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Featured
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Views
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {listings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No listings found
                </td>
              </tr>
            ) : (
              listings.map((listing) => (
                <tr key={listing.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {listing.images?.[0] && (
                        <img
                          src={listing.images[0].url}
                          alt={listing.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div>
                        {quickEditMode ? (
                          <input
                            type="text"
                            value={quickEdits[listing.id]?.title ?? listing.title}
                            onChange={(e) => updateQuickEditField(listing.id, 'title', e.target.value)}
                            className="font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 w-72"
                          />
                        ) : (
                          <a
                            href={`/listings/${listing.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            {listing.title || `${listing.year || ''} ${listing.make || ''} ${listing.model || ''}`.trim() || `Listing #${listing.id}`}
                          </a>
                        )}
                        {!quickEditMode && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {[listing.year, listing.make, listing.model].filter(Boolean).join(' ')}
                            {listing.city ? ` · ${listing.city}${listing.state ? ', ' + listing.state : ''}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {quickEditMode ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={quickEdits[listing.id]?.price ?? (listing.price != null ? String(listing.price) : '')}
                          onChange={(e) => updateQuickEditField(listing.id, 'price', e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 w-32"
                          placeholder="Price"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-gray-900">
                        {listing.price != null ? `$${Number(listing.price).toLocaleString()}` : <span className="text-gray-400">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {quickEditMode ? (
                      <select
                        value={quickEdits[listing.id]?.status ?? listing.status}
                        onChange={(e) => updateQuickEditField(listing.id, 'status', e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="sold">Sold</option>
                        <option value="archived">Archived</option>
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        listing.status === 'active' ? 'bg-green-100 text-green-800' :
                        listing.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        listing.status === 'archived' ? 'bg-gray-100 text-gray-600' :
                        listing.status === 'sold' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {listing.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleFeatured(listing)}
                      className={`px-2 py-1 rounded text-xs ${
                        listing.featured
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {listing.featured ? '⭐ Featured' : 'Feature'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {listing.views || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {quickEditMode && (
                      <button
                        onClick={() => saveQuickEdit(listing.id)}
                        disabled={savingQuickEditId === listing.id}
                        className="text-primary hover:text-secondary mr-4 disabled:text-gray-400"
                      >
                        {savingQuickEditId === listing.id ? 'Saving...' : 'Save'}
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(listing)}
                      className="text-green-600 hover:text-green-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(listing.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingListing && (
        <ListingEditor
          listing={editingListing}
          onClose={handleCloseEditor}
          onSave={handleSaveEditor}
        />
      )}
    </div>
  );
}