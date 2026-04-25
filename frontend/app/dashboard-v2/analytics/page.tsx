'use client';

import { useState, useEffect } from 'react';
import { Eye, MessageSquare, Ship, TrendingUp, BarChart3, Users } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface ListingAnalytics {
  id: number;
  title: string;
  views: number;
  inquiries: number;
  status: string;
}

export default function DashboardV2AnalyticsPage() {
  const [listings, setListings] = useState<ListingAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(apiUrl('/listings/my-listings?limit=50'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const all: ListingAnalytics[] = data.listings ?? data.results ?? data ?? [];
          setListings(all.sort((a, b) => b.views - a.views));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const totalViews = listings.reduce((s, l) => s + (l.views ?? 0), 0);
  const totalInquiries = listings.reduce((s, l) => s + (l.inquiries ?? 0), 0);
  const activeCount = listings.filter(l => l.status === 'active').length;
  const maxViews = listings[0]?.views || 1;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
          Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Performance across all your listings</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Views', value: totalViews.toLocaleString(), icon: <Eye size={18} />, color: '#10214F' },
          { label: 'Total Inquiries', value: totalInquiries.toLocaleString(), icon: <MessageSquare size={18} />, color: '#f59e0b' },
          { label: 'Active Listings', value: activeCount, icon: <Ship size={18} />, color: '#10b981' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${c.color}15`, color: c.color }}>
              {c.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Listing breakdown table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 size={16} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800 text-sm">Views by Listing</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : listings.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No listings found</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {listings.map(listing => (
              <div key={listing.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{listing.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {listing.inquiries} {listing.inquiries === 1 ? 'inquiry' : 'inquiries'}
                  </p>
                </div>
                <div className="w-40 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#10214F]"
                      style={{ width: `${(listing.views / maxViews) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-10 text-right">
                    {listing.views.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
