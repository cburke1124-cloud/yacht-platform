'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Search, User, Clock, TrendingUp, Filter } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type Stage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';

interface Inquiry {
  id: number;
  sender_name: string;
  sender_email: string;
  listing_title?: string | null;
  lead_stage: Stage;
  lead_score: number;
  assigned_to_name?: string | null;
  created_at: string;
}

const STAGE_META: Record<Stage, { label: string; pill: string; bar: string }> = {
  new:       { label: 'New',       pill: 'bg-[#10214F]/8 text-[#10214F]',     bar: 'bg-[#10214F]'  },
  contacted: { label: 'Contacted', pill: 'bg-sky-50 text-sky-700',            bar: 'bg-sky-500'    },
  qualified: { label: 'Qualified', pill: 'bg-amber-50 text-amber-700',        bar: 'bg-amber-500'  },
  proposal:  { label: 'Proposal',  pill: 'bg-violet-50 text-violet-700',      bar: 'bg-violet-500' },
  won:       { label: 'Won',       pill: 'bg-emerald-50 text-emerald-700',    bar: 'bg-emerald-500'},
  lost:      { label: 'Lost',      pill: 'bg-red-50 text-red-500',            bar: 'bg-red-400'    },
};

const ALL_STAGES: Stage[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ScoreDot({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score ?? 0));
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5" title={`Lead score: ${pct}`}>
      <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-gray-400">{pct}</span>
    </div>
  );
}

export default function DashboardV2InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<'all' | Stage>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    fetch(apiUrl('/inquiries?limit=100'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const all: Inquiry[] = d.inquiries ?? d.results ?? d ?? [];
          setInquiries(all);
          setTotal(d.total ?? all.length);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = inquiries.filter(i => {
    if (stage !== 'all' && i.lead_stage !== stage) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.sender_name.toLowerCase().includes(q) && !(i.listing_title ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const countByStage = (s: string) => s === 'all' ? inquiries.length : inquiries.filter(i => i.lead_stage === s).length;

  const newToday = inquiries.filter(i => {
    const d = new Date(i.created_at);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
  }).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-gray-900">Inquiries</h1>
            {newToday > 0 && (
              <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full ring-1 ring-amber-200/50">
                +{newToday} today
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{total} total inquiries from buyers</p>
        </div>
        <Link
          href="/dashboard/inquiries"
          className="flex-shrink-0 flex items-center gap-2 border border-[#10214F]/20 text-[#10214F] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#10214F]/5 transition-all"
        >
          Open full CRM →
        </Link>
      </div>

      {/* Stage strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ALL_STAGES.map(s => {
          const m = STAGE_META[s];
          const count = countByStage(s);
          const active = stage === s;
          return (
            <button
              key={s}
              onClick={() => setStage(active ? 'all' : s)}
              className={`rounded-xl p-3 text-left transition-all border ${
                active
                  ? 'border-[#10214F]/20 bg-[#10214F]/5 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <p className={`text-xl font-black tabular-nums ${active ? 'text-[#10214F]' : 'text-gray-800'}`}>{count}</p>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1.5 ${m.pill}`}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search + filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or listing…"
            className="w-full h-9 pl-8 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#10214F]/20 focus:border-[#10214F]/40 transition-all"
          />
        </div>
        {stage !== 'all' && (
          <button onClick={() => setStage('all')} className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
            Clear filter ×
          </button>
        )}
        <p className="ml-auto text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="w-16 h-5 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <MessageSquare size={24} className="text-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-600">{search ? 'No results found' : 'No inquiries yet'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{search ? 'Try a different search term' : 'Once buyers contact you, they will appear here'}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_140px_90px_120px_90px] gap-4 items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contact</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Stage</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Score</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Assigned</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Time</p>
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map(inq => {
                const m = STAGE_META[inq.lead_stage] ?? STAGE_META.new;
                return (
                  <Link
                    key={inq.id}
                    href="/dashboard/inquiries"
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#10214F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {inq.sender_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{inq.sender_name}</p>
                      {inq.listing_title && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{inq.listing_title}</p>
                      )}
                    </div>
                    {/* Stage */}
                    <div className="hidden sm:block w-[140px] flex-shrink-0">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${m.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.bar}`} />
                        {m.label}
                      </span>
                    </div>
                    {/* Score */}
                    <div className="hidden sm:block w-[90px] flex-shrink-0">
                      <ScoreDot score={inq.lead_score} />
                    </div>
                    {/* Assigned */}
                    <div className="hidden sm:block w-[120px] flex-shrink-0">
                      {inq.assigned_to_name ? (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <User size={11} /> {inq.assigned_to_name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">Unassigned</span>
                      )}
                    </div>
                    {/* Time */}
                    <div className="hidden sm:block w-[90px] text-right flex-shrink-0">
                      <span className="text-xs text-gray-400">{timeAgo(inq.created_at)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        For notes, messaging, pipeline management, and paperwork tracking —{' '}
        <Link href="/dashboard/inquiries" className="text-[#10214F] font-semibold hover:underline">Open full CRM →</Link>
      </p>
    </div>
  );
}
