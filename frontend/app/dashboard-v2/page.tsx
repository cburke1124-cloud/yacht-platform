'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Ship, Eye, MessageSquare, Star, TrendingUp, TrendingDown,
  ArrowRight, Plus, Users, BarChart3, ExternalLink, Anchor,
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface Stats {
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalInquiries: number;
  featuredListings: number;
  newInquiriesToday: number;
  totalCharterListings: number;
  activeCharterListings: number;
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

function getGreeting(name?: string) {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${salutation}, ${name.split(' ')[0]}` : salutation;
}

function StatCard({
  label, value, sub, icon, trend, href, color = '#10214F',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  href?: string;
  color?: string;
}) {
  const inner = (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 h-full">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${color}22, ${color}0d)`, color }}
        >
          {icon}
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend.value >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          }`}>
            {trend.value >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="text-4xl font-black text-gray-900 leading-none tracking-tight tabular-nums">{value}</p>
      <p className="text-sm text-gray-500 font-medium mt-2">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {href && (
        <p className="flex items-center gap-1 text-xs font-semibold mt-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }}>
          View all <ArrowRight size={11} />
        </p>
      )}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    new: 'bg-blue-50 text-blue-600 border-blue-100',
    contacted: 'bg-amber-50 text-amber-600 border-amber-100',
    qualified: 'bg-violet-50 text-violet-600 border-violet-100',
    negotiating: 'bg-orange-50 text-orange-600 border-orange-100',
    closed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    lost: 'bg-gray-100 text-gray-400 border-gray-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[stage] ?? 'bg-gray-100 text-gray-400 border-gray-200'}`}>
      {stage}
    </span>
  );
}

function timeAgo(dateStr: string) {
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
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    fetch(apiUrl('/auth/me'), { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.name) setUserName(u.name); })
      .catch(() => {});

    Promise.all([
      fetch(apiUrl('/listings/my-listings?limit=5&sort=created_at'), { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(apiUrl('/inquiries?limit=6'), { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(apiUrl('/charter/my'), { headers: h }).then(r => r.ok ? r.json() : null),
    ]).then(([listingsData, inquiriesData, charterData]) => {
      const charters: any[] = Array.isArray(charterData) ? charterData : [];
      if (listingsData) {
        const all: RecentListing[] = listingsData.listings ?? listingsData.results ?? listingsData ?? [];
        setListings(all.slice(0, 5));
        setStats({
          totalListings: listingsData.total ?? all.length,
          activeListings: all.filter((l: any) => l.status === 'active').length,
          totalViews: all.reduce((s: number, l: any) => s + (l.views ?? 0), 0),
          totalInquiries: 0,
          featuredListings: all.filter((l: any) => l.featured).length,
          newInquiriesToday: 0,
          totalCharterListings: charters.length,
          activeCharterListings: charters.filter((c: any) => c.status === 'active').length,
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
      <div className="p-6 lg:p-8 space-y-6 animate-pulse">
        <div className="h-28 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-gray-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="h-80 bg-gray-200 rounded-2xl" />
          <div className="space-y-6">
            <div className="h-52 bg-gray-200 rounded-2xl" />
            <div className="h-24 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-[#10214F] px-7 py-6 text-white">
        <div className="pointer-events-none absolute -top-14 -right-14 w-56 h-56 rounded-full bg-white/[0.03]" />
        <div className="pointer-events-none absolute -bottom-12 right-24 w-72 h-72 rounded-full bg-[#C9A84C]/[0.07]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 85% 50%, rgba(201,168,76,0.09) 0%, transparent 55%)' }}
        />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-white/55 text-sm font-medium">{getGreeting(userName)}</p>
            <h1 className="text-2xl font-bold mt-0.5 tracking-tight">Dashboard Overview</h1>
            <p className="text-white/40 text-xs mt-1.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <Link
            href="/dashboard/listings"
            className="flex-shrink-0 flex items-center gap-2 bg-[#C9A84C] text-[#10214F] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#d4b35a] active:scale-95 transition-all shadow-lg shadow-[#C9A84C]/20"
          >
            <Plus size={15} strokeWidth={2.5} /> New Listing
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Listings"
          value={stats?.totalListings ?? 0}
          sub={`${stats?.activeListings ?? 0} active`}
          icon={<Ship size={20} strokeWidth={1.75} />}
          href="/dashboard-v2/listings"
          color="#10214F"
        />
        <StatCard
          label="Charter Listings"
          value={stats?.totalCharterListings ?? 0}
          sub={`${stats?.activeCharterListings ?? 0} active`}
          icon={<Anchor size={20} strokeWidth={1.75} />}
          href="/dashboard-v2/charter"
          color="#0891b2"
        />
        <StatCard
          label="Total Views"
          value={(stats?.totalViews ?? 0).toLocaleString()}
          icon={<Eye size={20} strokeWidth={1.75} />}
          color="#6366f1"
        />
        <StatCard
          label="Inquiries"
          value={stats?.totalInquiries ?? 0}
          sub={stats?.newInquiriesToday ? `+${stats.newInquiriesToday} today` : 'None today'}
          icon={<MessageSquare size={20} strokeWidth={1.75} />}
          href="/dashboard-v2/inquiries"
          color="#f59e0b"
        />
        <StatCard
          label="Featured"
          value={stats?.featuredListings ?? 0}
          sub="active placements"
          icon={<Star size={20} strokeWidth={1.75} />}
          href="/dashboard-v2/featured"
          color="#C9A84C"
        />
      </div>

      {/* Main row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

        {/* Recent Listings */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <span className="block w-1 h-5 rounded-full bg-[#10214F]" />
              <h2 className="font-semibold text-gray-900 text-sm">Recent Listings</h2>
            </div>
            <Link href="/dashboard-v2/listings" className="inline-flex items-center gap-1 text-xs font-medium text-[#10214F] hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#10214F]/5 flex items-center justify-center">
                  <Anchor size={22} className="text-[#10214F]/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-600">No listings yet</p>
                  <p className="text-xs text-gray-400 mt-0.5">Add your first listing to get started</p>
                </div>
                <Link
                  href="/dashboard/listings"
                  className="text-xs font-semibold text-[#10214F] bg-[#10214F]/5 hover:bg-[#10214F]/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Add listing
                </Link>
              </div>
            ) : listings.map(listing => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}/edit`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
              >
                <div className="w-14 h-11 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-100">
                  {listing.images?.[0]?.url ? (
                    <img src={mediaUrl(listing.images[0].url)} alt="" onError={onImgError} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#10214F]/5">
                      <Ship size={14} className="text-[#10214F]/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {listing.price != null ? `$${listing.price.toLocaleString()}` : 'Price TBD'}
                    {listing.views != null ? ` · ${listing.views.toLocaleString()} views` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    listing.status === 'active' ? 'bg-emerald-50 text-emerald-600'
                    : listing.status === 'draft' ? 'bg-amber-50 text-amber-600'
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

        {/* Right column */}
        <div className="flex flex-col gap-6">

          {/* Recent Inquiries */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="block w-1 h-5 rounded-full bg-amber-400" />
                <h2 className="font-semibold text-gray-900 text-sm">Recent Inquiries</h2>
              </div>
              <Link href="/dashboard-v2/inquiries" className="inline-flex items-center gap-1 text-xs font-medium text-[#10214F] hover:underline">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {inquiries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <MessageSquare size={18} className="text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No inquiries yet</p>
                </div>
              ) : inquiries.map(inq => (
                <Link
                  key={inq.id}
                  href="/dashboard-v2/inquiries"
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#10214F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    {inq.sender_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{inq.sender_name}</p>
                    {inq.listing_title && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{inq.listing_title}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <StageBadge stage={inq.lead_stage} />
                      <span className="text-xs text-gray-400">{timeAgo(inq.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="block w-1 h-5 rounded-full bg-violet-400" />
                <h2 className="font-semibold text-gray-900 text-sm">Quick Actions</h2>
              </div>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Add Listing', href: '/dashboard/listings', icon: <Plus size={16} />, color: '#10214F' },
                { label: 'Add Charter', href: '/dashboard-v2/charter', icon: <Anchor size={16} />, color: '#0891b2' },
                { label: 'Messages', href: '/dashboard-v2/inquiries', icon: <MessageSquare size={16} />, color: '#6366f1' },
                { label: 'Manage Team', href: '/dashboard-v2/team', icon: <Users size={16} />, color: '#f59e0b' },
                { label: 'Analytics', href: '/dashboard-v2/analytics', icon: <BarChart3 size={16} />, color: '#10b981' },
              ].map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors group"
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${a.color}15`, color: a.color }}
                  >
                    {a.icon}
                  </span>
                  <span className="text-xs font-semibold text-gray-600">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
