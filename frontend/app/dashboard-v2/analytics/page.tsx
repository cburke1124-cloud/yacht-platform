'use client';

import { useState, useEffect } from 'react';
import { Eye, MessageSquare, Ship, TrendingUp } from 'lucide-react';
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
          setListings(all.sort((a, b) => (b.views ?? 0) - (a.views ?? 0)));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const totalViews = listings.reduce((s, l) => s + (l.views ?? 0), 0);
  const totalInquiries = listings.reduce((s, l) => s + (l.inquiries ?? 0), 0);
  const activeCount = listings.filter(l => l.status === 'active').length;
  const maxViews = listings[0]?.views || 1;
  const convRate = totalViews > 0 ? ((totalInquiries / totalViews) * 100).toFixed(1) : '0.0';

  const summaryCards = [
    { label: 'Total Views', value: totalViews.toLocaleString(), icon: <Eye size={20} strokeWidth={1.75} />, color: '#10214F', sub: 'across all listings' },
    { label: 'Total Inquiries', value: totalInquiries.toLocaleString(), icon: <MessageSquare size={20} strokeWidth={1.75} />, color: '#f59e0b', sub: 'from buyers' },
    { label: 'Active Listings', value: activeCount, icon: <Ship size={20} strokeWidth={1.75} />, color: '#10b981', sub: `of ${listings.length} total` },
    { label: 'Conversion Rate', value: `${convRate}%`, icon: <TrendingUp size={20} strokeWidth={1.75} />, color: '#6366f1', sub: 'views to inquiries' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Performance overview across all your listings</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all duration-200">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `linear-gradient(135deg, ${c.color}22, ${c.color}0d)`, color: c.color }}
            >
              {c.icon}
            </div>
            <p className="text-4xl font-black text-gray-900 leading-none tracking-tight tabular-nums">{c.value}</p>
            <p className="text-sm font-medium text-gray-500 mt-2">{c.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Views table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
          <span className="block w-1 h-5 rounded-full bg-[#10214F]" />
          <h2 className="font-semibold text-gray-900 text-sm">Views by Listing</h2>
          <span className="ml-auto text-xs text-gray-400">{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="flex-1 h-3.5 bg-gray-200 rounded" />
                <div className="w-40 h-2 bg-gray-100 rounded-full" />
                <div className="w-10 h-3.5 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#10214F]/5 flex items-center justify-center">
              <Ship size={20} className="text-[#10214F]/30" />
            </div>
            <p className="text-sm font-medium text-gray-500">No listings found</p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_200px_80px_80px] gap-4 items-center px-5 py-3 bg-gray-50/50 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Listing</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Views</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Count</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Inquiries</p>
            </div>
            <div className="divide-y divide-gray-50">
              {listings.map((l, idx) => {
                const pct = Math.round(((l.views ?? 0) / maxViews) * 100);
                return (
                  <div key={l.id} className="px-5 py-3.5 flex items-center gap-4 group hover:bg-gray-50/60 transition-colors">
                    {/* Rank */}
                    <span className="text-xs font-bold text-gray-300 w-5 flex-shrink-0 tabular-nums">{idx + 1}</span>
                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{l.title}</p>
                      <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${
                        l.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                      }`}>{l.status}</span>
                    </div>
                    {/* Bar */}
                    <div className="hidden sm:flex items-center gap-3 w-[200px] flex-shrink-0">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#10214F] to-[#1e3a8a]"
                          style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                        />
                      </div>
                    </div>
                    {/* Views count */}
                    <div className="hidden sm:block w-20 text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">{(l.views ?? 0).toLocaleString()}</p>
                    </div>
                    {/* Inquiries */}
                    <div className="hidden sm:block w-20 text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-500">{l.inquiries ?? 0}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
