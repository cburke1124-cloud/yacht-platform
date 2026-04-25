'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Ship, Eye, MessageSquare, Star, TrendingUp, TrendingDown,
  ArrowRight, Plus, Clock, CheckCircle, AlertCircle, Zap,
  DollarSign, Users, BarChart3, Activity, ExternalLink, Anchor
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface Stats {
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalInquiries: number;
  featuredListings: number;
  newInquiriesToday: number;
}

interface RecentInquiry {
  id: number;
  sender_name: string;
  listing_title?: string;
  lead_stage: string;
  created_at: string;
}

interface RecentListing {
  id: number;
  title: string;
  price?: number;
  status: string;
  views?: number;
  images?: Array<{ url: string }>;
}

function StatCard({ label, value, sub, icon, trend, href, color = '#10214F' }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  href?: string;
  color?: string;
}) {
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend.value >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {trend.value >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {href && (
        <div className="flex items-center gap-1 text-xs font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }}>
          View all <ArrowRight size={11} />
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    new: 'bg-blue-50 text-blue-600 border-blue-100',
    contacted: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    qualified: 'bg-purple-50 text-purple-600 border-purple-100',
    negotiating: 'bg-orange-50 text-orange-600 border-orange-100',
    closed: 'bg-green-50 text-green-600 border-green-100',
    lost: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[stage] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {stage}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardV2Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [inquiries, setInquiries] = useState<RecentInquiry[]>([]);
  const [listings, setListings] = useState<RecentListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(apiUrl('/listings/my-listings?limit=5&sort=created_at'), { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(apiUrl('/inquiries?limit=6'), { headers: h }).then(r => r.ok ? r.json() : null),
    ]).then(([listingsData, inquiriesData]) => {
      if (listingsData) {
        const all: RecentListing[] = listingsData.listings ?? listingsData.results ?? listingsData ?? [];
        setListings(all.slice(0, 5));
        const active = all.filter((l: any) => l.status === 'active').length;
        const views = all.reduce((s: number, l: any) => s + (l.views ?? 0), 0);
        setStats({
          totalListings: listingsData.total ?? all.length,
          activeListings: active,
          totalViews: views,
          totalInquiries: 0,
          featuredListings: all.filter((l: any) => l.featured).length,
          newInquiriesToday: 0,
        });
      }
      if (inquiriesData) {
        const inqs: RecentInquiry[] = inquiriesData.inquiries ?? inquiriesData.results ?? inquiriesData ?? [];
        setInquiries(inqs.slice(0, 6));
        setStats(s => s ? {
          ...s,
          totalInquiries: inquiriesData.total ?? inqs.length,
          newInquiriesToday: inqs.filter((i: any) => {
            const d = new Date(i.created_at);
            const today = new Date();
            return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
          }).length,
        } : s);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Overview
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/dashboard-v2/listings/new"
          className="flex items-center gap-2 bg-[#10214F] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1a3570] transition-colors"
        >
          <Plus size={15} /> New Listing
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Listings"
          value={stats?.totalListings ?? 0}
          sub={`${stats?.activeListings ?? 0} active`}
          icon={<Ship size={20} />}
          href="/dashboard-v2/listings"
        />
        <StatCard
          label="Total Views"
          value={(stats?.totalViews ?? 0).toLocaleString()}
          icon={<Eye size={20} />}
          color="#6366f1"
        />
        <StatCard
          label="Inquiries"
          value={stats?.totalInquiries ?? 0}
          sub={stats?.newInquiriesToday ? `+${stats.newInquiriesToday} today` : undefined}
          icon={<MessageSquare size={20} />}
          href="/dashboard-v2/inquiries"
          color="#f59e0b"
        />
        <StatCard
          label="Featured"
          value={stats?.featuredListings ?? 0}
          sub="active placements"
          icon={<Star size={20} />}
          href="/dashboard-v2/featured"
          color="#C9A84C"
        />
      </div>

      {/* Main content: recent listings + recent inquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Recent listings */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Recent Listings</h2>
            <Link href="/dashboard-v2/listings" className="text-xs text-[#10214F] hover:underline font-medium flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Anchor size={28} className="opacity-30 mb-2" />
                <p className="text-sm">No listings yet</p>
                <Link href="/dashboard-v2/listings/new" className="mt-2 text-xs text-[#10214F] hover:underline">Add your first listing</Link>
              </div>
            ) : listings.map(listing => (
              <Link
                key={listing.id}
                href={`/dashboard/listings/${listing.id}/edit`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-12 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {listing.images?.[0]?.url ? (
                    <img src={mediaUrl(listing.images[0].url)} alt="" onError={onImgError} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Ship size={14} className="text-gray-300" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{listing.title}</p>
                  <p className="text-xs text-gray-400">
                    {listing.price ? `$${listing.price.toLocaleString()}` : 'Price TBD'}
                    {listing.views ? ` · ${listing.views} views` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    listing.status === 'active' ? 'bg-green-50 text-green-600'
                    : listing.status === 'draft' ? 'bg-yellow-50 text-yellow-600'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {listing.status}
                  </span>
                  <ExternalLink size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent inquiries */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Recent Inquiries</h2>
            <Link href="/dashboard-v2/inquiries" className="text-xs text-[#10214F] hover:underline font-medium flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {inquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <MessageSquare size={28} className="opacity-30 mb-2" />
                <p className="text-sm">No inquiries yet</p>
              </div>
            ) : inquiries.map(inq => (
              <Link
                key={inq.id}
                href={`/dashboard-v2/inquiries`}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#10214F]/10 flex items-center justify-center text-[#10214F] text-xs font-bold flex-shrink-0 mt-0.5">
                  {inq.sender_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{inq.sender_name}</p>
                  {inq.listing_title && (
                    <p className="text-xs text-gray-400 truncate">{inq.listing_title}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <StageBadge stage={inq.lead_stage} />
                    <span className="text-xs text-gray-400">{timeAgo(inq.created_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Add Listing', href: '/dashboard/listings', icon: <Plus size={16} />, color: '#10214F' },
          { label: 'View Messages', href: '/dashboard-v2/inquiries', icon: <MessageSquare size={16} />, color: '#6366f1' },
          { label: 'Manage Team', href: '/dashboard-v2/team', icon: <Users size={16} />, color: '#f59e0b' },
          { label: 'Analytics', href: '/dashboard-v2/analytics', icon: <BarChart3 size={16} />, color: '#10b981' },
        ].map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${a.color}15`, color: a.color }}>
              {a.icon}
            </span>
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
