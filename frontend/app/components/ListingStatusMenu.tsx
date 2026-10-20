'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { API_ROOT } from '@/app/lib/apiRoot';

export const LISTING_STATUS_CONFIG: Record<string, { label: string; hint: string; colorClass: string }> = {
  active:          { label: 'Published',         hint: 'Live and visible to buyers',        colorClass: 'bg-green-100 text-green-800' },
  draft:           { label: 'Draft',             hint: 'Hidden — only you can see it',      colorClass: 'bg-gray-200 text-gray-700' },
  awaiting_review: { label: 'Awaiting Approval', hint: 'Waiting for admin approval',        colorClass: 'bg-orange-100 text-orange-800' },
  sold:            { label: 'Sold',              hint: 'Shown as sold',                     colorClass: 'bg-blue-100 text-blue-800' },
  archived:        { label: 'Archived',          hint: 'Hidden and kept for your records',  colorClass: 'bg-red-100 text-red-700' },
};

const SELECTABLE = ['active', 'draft', 'sold', 'archived'] as const;

export function statusInfo(status?: string) {
  return LISTING_STATUS_CONFIG[status || ''] ?? { label: status || 'Unknown', hint: '', colorClass: 'bg-gray-200 text-gray-700' };
}

type Notice = { kind: 'success' | 'warning' | 'error'; text: string };

interface Props {
  listingId: number | string;
  status?: string;
  /** Only users allowed to edit the listing get the menu; everyone else sees a plain badge. */
  canManage: boolean;
  onChanged?: (status: string) => void;
  /**
   * Runs before the change (e.g. editor validation / saving pending edits first).
   * Return true to continue, false to cancel silently, or a string to cancel and show it as the error.
   */
  beforeChange?: (next: string) => Promise<boolean | string> | boolean | string;
  /** Dark = for the navy editor bar, light = for white pages. */
  tone?: 'dark' | 'light';
  /** Also render a prominent Publish (draft/other) or Unpublish (published) button next to the badge. */
  showQuickAction?: boolean;
}

/**
 * Status badge that opens a small menu to change a listing's status. Uses the
 * existing PATCH /listings/{id}/status endpoint (same permission checks as
 * quick-edit) and reports success or failure inline.
 */
export default function ListingStatusMenu({ listingId, status, canManage, onChanged, beforeChange, tone = 'dark', showQuickAction = false }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const info = statusInfo(status);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  async function change(next: string) {
    setOpen(false);
    if (next === status || busy) return;
    setNotice(null);
    setBusy(true);
    try {
      if (beforeChange) {
        const proceed = await beforeChange(next);
        if (typeof proceed === 'string') { setNotice({ kind: 'error', text: proceed }); return; }
        if (!proceed) return;
      }
      const token = localStorage.getItem('token');
      if (!token) { setNotice({ kind: 'error', text: 'Please sign in again to change the status.' }); return; }
      const res = await fetch(`${API_ROOT}/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof body?.detail === 'string' ? body.detail : body?.message;
        setNotice({ kind: 'error', text: detail || `Could not change status (error ${res.status}).` });
        return;
      }
      onChanged?.(body.status || next);
      if (body.warning) setNotice({ kind: 'warning', text: body.warning });
      else setNotice({ kind: 'success', text: `Status changed to ${statusInfo(body.status || next).label}.` });
    } catch {
      setNotice({ kind: 'error', text: 'Network error — the status was not changed. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const noticeColors = tone === 'dark'
    ? { success: 'text-green-300', warning: 'text-amber-300', error: 'text-red-300' }
    : { success: 'text-green-700', warning: 'text-amber-700', error: 'text-red-600' };

  return (
    <div ref={rootRef} className="relative flex items-center gap-3 flex-wrap">
      {canManage ? (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Click to change status"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ring-1 ring-black/10 hover:ring-[#01BBDC] disabled:opacity-60 transition ${info.colorClass}`}
        >
          {busy ? 'Saving…' : info.label}
          <ChevronDown size={12} />
        </button>
      ) : (
        <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${info.colorClass}`}>{info.label}</span>
      )}

      {canManage && showQuickAction && status !== 'sold' && (
        <button
          type="button"
          onClick={() => change(status === 'active' ? 'draft' : 'active')}
          disabled={busy}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold disabled:opacity-60 transition ${
            status === 'active'
              ? 'bg-white/90 text-[#10214F] ring-1 ring-black/10 hover:bg-white'
              : 'bg-[#01BBDC] text-white hover:opacity-90'
          }`}
        >
          {busy ? 'Saving…' : status === 'active' ? 'Unpublish' : 'Publish listing'}
        </button>
      )}

      {open && canManage && (
        <div role="menu" className="absolute left-0 top-full mt-2 w-64 bg-white text-[#10214F] rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-gray-400 border-b border-gray-100">Change status</div>
          {SELECTABLE.map(key => {
            const item = LISTING_STATUS_CONFIG[key];
            const current = key === status;
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => change(key)}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-gray-50 ${current ? 'bg-gray-50' : ''}`}
              >
                <span className="w-4 pt-0.5">{current && <Check size={14} className="text-[#01BBDC]" />}</span>
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-xs text-gray-500">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {notice && (
        <span role={notice.kind === 'error' ? 'alert' : 'status'} className={`text-xs font-medium ${noticeColors[notice.kind]}`}>
          {notice.text}
          {notice.kind === 'error' && (
            <button type="button" onClick={() => setNotice(null)} className="ml-2 underline">Dismiss</button>
          )}
        </span>
      )}
    </div>
  );
}
