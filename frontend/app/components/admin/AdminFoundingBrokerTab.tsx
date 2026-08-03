'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, Phone, Globe, Mail, MessageSquare, X } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import { formatPhoneDisplay } from '@/app/lib/formatPhoneDisplay';

const authHeaders = () => ({
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
  'Content-Type': 'application/json',
});

type Status = 'new' | 'contacted' | 'approved' | 'declined';

interface Signup {
  id: number;
  name: string;
  email: string;
  company_name: string;
  website?: string;
  phone?: string;
  years_experience?: string;
  message?: string;
  status: Status;
  notes?: string;
  created_at?: string;
}

const STATUS_STYLES: Record<Status, string> = {
  new:       'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  declined:  'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<Status, string> = {
  new:       'New',
  contacted: 'Contacted',
  approved:  'Approved',
  declined:  'Declined',
};

export default function AdminFoundingBrokerTab() {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Signup | null>(null);
  const [saving, setSaving] = useState(false);
  const [patchStatus, setPatchStatus] = useState<Status>('new');
  const [patchNotes, setPatchNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/admin/founding-broker-signups'), { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data: Signup[] = await res.json();
      setSignups(data);
    } catch {
      setSignups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = (s: Signup) => {
    setSelected(s);
    setPatchStatus(s.status);
    setPatchNotes(s.notes ?? '');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/admin/founding-broker-signups/${selected.id}`), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: patchStatus, notes: patchNotes }),
      });
      if (!res.ok) throw new Error();
      setSignups(prev => prev.map(s => s.id === selected.id ? { ...s, status: patchStatus, notes: patchNotes } : s));
      setSelected(prev => prev ? { ...prev, status: patchStatus, notes: patchNotes } : null);
    } finally {
      setSaving(false);
    }
  };

  const filtered = signups.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.company_name.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = (['new', 'contacted', 'approved', 'declined'] as Status[]).reduce((acc, st) => {
    acc[st] = signups.filter(s => s.status === st).length;
    return acc;
  }, {} as Record<Status, number>);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Founding Broker Signups</h2>
          <p className="text-sm text-gray-500 mt-0.5">{signups.length} total submissions</p>
        </div>
        <button onClick={load} className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
          Refresh
        </button>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['new', 'contacted', 'approved', 'declined'] as Status[]).map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(statusFilter === st ? 'all' : st)}
            className={`rounded-xl border p-3 text-left transition-all ${statusFilter === st ? 'border-[#10214F] bg-[#10214F]/5' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            <p className="text-xs text-gray-500 uppercase tracking-wide">{STATUS_LABELS[st]}</p>
            <p className="text-2xl font-bold text-[#10214F] mt-0.5">{counts[st]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search name, email, or company…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full sm:max-w-xs px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F] focus:border-transparent"
      />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#10214F] mr-3" />Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CheckCircle2 className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No signups found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Company', 'Email', 'Experience', 'Submitted', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.company_name}</td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${s.email}`} className="text-[#01BBDC] hover:underline">{s.email}</a>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.years_experience ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s.status]}`}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(s)} className="text-xs text-[#10214F] hover:underline font-medium">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" onClick={() => setSelected(null)}>
          <div className="flex min-h-full items-start justify-center px-4 py-10">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#10214F]">{selected.name}</h3>
                  <p className="text-sm text-gray-500">{selected.company_name}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>

              <div className="space-y-2 text-sm mb-5">
                <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-[#01BBDC] hover:underline">
                  <Mail size={14} />{selected.email}
                </a>
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                    <Phone size={14} />{formatPhoneDisplay(selected.phone)}
                  </a>
                )}
                {selected.website && (
                  <a href={selected.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                    <Globe size={14} />{selected.website}
                  </a>
                )}
                {selected.years_experience && (
                  <p className="flex items-center gap-2 text-gray-600">
                    <Clock size={14} />{selected.years_experience} years experience
                  </p>
                )}
                {selected.message && (
                  <div className="flex items-start gap-2 text-gray-600 mt-2">
                    <MessageSquare size={14} className="mt-0.5 flex-shrink-0" />
                    <p className="whitespace-pre-wrap">{selected.message}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={patchStatus}
                    onChange={e => setPatchStatus(e.target.value as Status)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10214F]"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="approved">Approved</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes</label>
                  <textarea
                    rows={3}
                    value={patchNotes}
                    onChange={e => setPatchNotes(e.target.value)}
                    placeholder="Add notes visible only to admins…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#10214F] resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setSelected(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-[#10214F] text-white rounded-lg text-sm font-medium hover:bg-[#1a3570] disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
