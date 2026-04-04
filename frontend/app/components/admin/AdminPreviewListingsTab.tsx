'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ExternalLink, Copy, Check, X, Loader2,
  Link as LinkIcon, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

// ── Types ────────────────────────────────────────────────────────────────────

interface PreviewListing {
  id: number;
  share_token: string;
  title: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  boat_type: string | null;
  length_feet: number | null;
  beam_feet: number | null;
  draft_feet: number | null;
  hull_material: string | null;
  hull_type: string | null;
  engine_count: number | null;
  engine_hours: number | null;
  fuel_type: string | null;
  max_speed_knots: number | null;
  cruising_speed_knots: number | null;
  cabins: number | null;
  berths: number | null;
  heads: number | null;
  fuel_capacity_gallons: number | null;
  water_capacity_gallons: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  description: string | null;
  feature_bullets: string[];
  seller_name: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  brokerage_name: string | null;
  brokerage_logo_url: string | null;
  brokerage_website: string | null;
  images: { url: string; is_primary?: boolean }[];
  source_url: string | null;
  internal_note: string | null;
  is_active: boolean;
  created_at: string;
}

type FieldKey = keyof Omit<PreviewListing, 'id' | 'share_token' | 'is_active' | 'created_at'>;

const EMPTY_FORM: Omit<PreviewListing, 'id' | 'share_token' | 'is_active' | 'created_at'> = {
  title: null,
  make: null,
  model: null,
  year: null,
  price: null,
  currency: 'USD',
  condition: null,
  boat_type: null,
  length_feet: null,
  beam_feet: null,
  draft_feet: null,
  hull_material: null,
  hull_type: null,
  engine_count: null,
  engine_hours: null,
  fuel_type: null,
  max_speed_knots: null,
  cruising_speed_knots: null,
  cabins: null,
  berths: null,
  heads: null,
  fuel_capacity_gallons: null,
  water_capacity_gallons: null,
  city: null,
  state: null,
  country: null,
  description: null,
  feature_bullets: [],
  seller_name: null,
  seller_email: null,
  seller_phone: null,
  brokerage_name: null,
  brokerage_logo_url: null,
  brokerage_website: null,
  images: [],
  source_url: null,
  internal_note: null,
};

const SHARE_BASE = 'https://yachtversal.com/listings/preview';

// ── Helpers ──────────────────────────────────────────────────────────────────

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

function Input({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
      />
    </div>
  );
}

function Textarea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent resize-y"
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminPreviewListingsTab() {
  const [listings, setListings] = useState<PreviewListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PreviewListing | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [copied, setCopied] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [bulletDraft, setBulletDraft] = useState('');
  const [imageDraft, setImageDraft] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/preview/listings'), { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      setListings(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);

  // ── Field helper ────────────────────────────────────────────────────────
  const setField = (key: FieldKey, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value === '' ? null : value }));
  };

  // ── Scrape ───────────────────────────────────────────────────────────────
  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setScrapeError('');
    try {
      const res = await fetch(apiUrl('/api/preview/listings/scrape'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Scrape failed');

      setForm((prev) => ({
        ...prev,
        source_url: scrapeUrl.trim(),
        title: data.title ?? prev.title,
        make: data.make ?? prev.make,
        model: data.model ?? prev.model,
        year: data.year ?? prev.year,
        price: data.price ?? prev.price,
        condition: data.condition ?? prev.condition,
        boat_type: data.boat_type ?? prev.boat_type,
        length_feet: data.length_feet ?? prev.length_feet,
        beam_feet: data.beam_feet ?? prev.beam_feet,
        draft_feet: data.draft_feet ?? prev.draft_feet,
        fuel_type: data.fuel_type ?? prev.fuel_type,
        engine_count: data.engine_count ?? prev.engine_count,
        engine_hours: data.engine_hours ?? prev.engine_hours,
        cabins: data.cabins ?? prev.cabins,
        city: data.city ?? prev.city,
        state: data.state ?? prev.state,
        country: data.country ?? prev.country,
        description: data.description ?? prev.description,
        feature_bullets: data.feature_bullets?.length ? data.feature_bullets : prev.feature_bullets,
        images: data.images?.length
          ? data.images.map((u: string) => ({ url: u }))
          : prev.images,
        seller_name: data.seller_name ?? prev.seller_name,
        seller_phone: data.seller_phone ?? prev.seller_phone,
        brokerage_name: data.brokerage_name ?? prev.brokerage_name,
        brokerage_website: data.brokerage_website ?? prev.brokerage_website,
      }));
    } catch (e: any) {
      setScrapeError(e.message);
    } finally {
      setScraping(false);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      const url = editTarget
        ? apiUrl(`/api/preview/listings/${editTarget.id}`)
        : apiUrl('/api/preview/listings');
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      await loadListings();
      closeModal();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this preview listing? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(apiUrl(`/api/preview/listings/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  // ── Copy link ────────────────────────────────────────────────────────────
  const copyLink = (listing: PreviewListing) => {
    const url = `${SHARE_BASE}/${listing.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(listing.id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ── Modal open/close ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setScrapeUrl('');
    setScrapeError('');
    setBulletDraft('');
    setImageDraft('');
    setShowAdvanced(false);
    setModalOpen(true);
  };

  const openEdit = (listing: PreviewListing) => {
    setEditTarget(listing);
    const { id, share_token, is_active, created_at, ...rest } = listing;
    setForm(rest);
    setScrapeUrl(listing.source_url || '');
    setScrapeError('');
    setBulletDraft('');
    setImageDraft('');
    setShowAdvanced(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setScrapeError('');
    setError('');
  };

  // ── Bullet helpers ───────────────────────────────────────────────────────
  const addBullet = () => {
    if (!bulletDraft.trim()) return;
    setForm((prev) => ({ ...prev, feature_bullets: [...prev.feature_bullets, bulletDraft.trim()] }));
    setBulletDraft('');
  };

  const removeBullet = (i: number) => {
    setForm((prev) => ({ ...prev, feature_bullets: prev.feature_bullets.filter((_, idx) => idx !== i) }));
  };

  // ── Image URL helpers ────────────────────────────────────────────────────
  const addImage = () => {
    if (!imageDraft.trim()) return;
    setForm((prev) => ({ ...prev, images: [...prev.images, { url: imageDraft.trim() }] }));
    setImageDraft('');
  };

  const removeImage = (i: number) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Preview Listings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create non-indexed shareable listing previews for prospective clients.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadListings}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className="text-gray-500" />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#10214F' }}
          >
            <Plus size={16} /> New Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <LinkIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No preview listings yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left py-2 pr-4 font-medium">Title</th>
                <th className="text-left py-2 pr-4 font-medium">Year / Make</th>
                <th className="text-left py-2 pr-4 font-medium">Price</th>
                <th className="text-left py-2 pr-4 font-medium">Created</th>
                <th className="text-left py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => {
                const shareUrl = `${SHARE_BASE}/${listing.share_token}`;
                const displayTitle = listing.title || [listing.year, listing.make, listing.model].filter(Boolean).join(' ') || '(Untitled)';
                return (
                  <tr key={listing.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => openEdit(listing)}
                        className="font-medium text-left hover:text-cyan-600 transition-colors"
                        style={{ color: '#10214F' }}
                      >
                        {displayTitle}
                      </button>
                      {listing.brokerage_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{listing.brokerage_name}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {[listing.year, listing.make].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {listing.price
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: listing.currency || 'USD', maximumFractionDigits: 0 }).format(listing.price)
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-400 text-xs">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {/* Copy link */}
                        <button
                          onClick={() => copyLink(listing)}
                          title="Copy share link"
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {copied === listing.id
                            ? <Check size={14} className="text-green-500" />
                            : <Copy size={14} className="text-gray-400" />}
                        </button>
                        {/* Open link */}
                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open preview"
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <ExternalLink size={14} className="text-gray-400" />
                        </a>
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(listing.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          disabled={deleting === listing.id}
                        >
                          {deleting === listing.id
                            ? <Loader2 size={14} className="animate-spin text-gray-300" />
                            : <Trash2 size={14} className="text-red-400" />}
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

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-8" onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 18 }}>
                {editTarget ? 'Edit Preview Listing' : 'Create Preview Listing'}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* ── Scrape section ─────────────────────────────────────── */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fill from URL</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    placeholder="https://www.yachtworld.com/boats/..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleScrape(); }}
                  />
                  <button
                    onClick={handleScrape}
                    disabled={scraping || !scrapeUrl.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#01BBDC' }}
                  >
                    {scraping ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {scraping ? 'Scraping…' : 'Fill from URL'}
                  </button>
                </div>
                {scrapeError && (
                  <p className="text-xs text-red-600 mt-2">{scrapeError}</p>
                )}
              </div>

              {/* ── Core fields ────────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Listing Details</p>
                <div className="space-y-3">
                  <Input label="Title" value={form.title || ''} onChange={(v) => setField('title', v)} placeholder="e.g. 2019 Azimut 55S" />
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="Year" value={form.year?.toString() || ''} onChange={(v) => setField('year', v ? parseInt(v) : null)} type="number" />
                    <Input label="Make" value={form.make || ''} onChange={(v) => setField('make', v)} />
                    <Input label="Model" value={form.model || ''} onChange={(v) => setField('model', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Price" value={form.price?.toString() || ''} onChange={(v) => setField('price', v ? parseFloat(v) : null)} type="number" />
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
                      <select
                        value={form.condition || ''}
                        onChange={(e) => setField('condition', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                      >
                        <option value="">—</option>
                        <option value="new">New</option>
                        <option value="used">Used</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="City" value={form.city || ''} onChange={(v) => setField('city', v)} />
                    <Input label="State" value={form.state || ''} onChange={(v) => setField('state', v)} />
                    <Input label="Country" value={form.country || ''} onChange={(v) => setField('country', v)} />
                  </div>
                </div>
              </div>

              {/* ── Description ────────────────────────────────────────── */}
              <Textarea label="Description" value={form.description || ''} onChange={(v) => setField('description', v)} rows={4} />

              {/* ── Seller / Brokerage ─────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Seller / Brokerage</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Seller Name" value={form.seller_name || ''} onChange={(v) => setField('seller_name', v)} />
                    <Input label="Seller Phone" value={form.seller_phone || ''} onChange={(v) => setField('seller_phone', v)} />
                  </div>
                  <Input label="Seller Email" value={form.seller_email || ''} onChange={(v) => setField('seller_email', v)} type="email" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Brokerage Name" value={form.brokerage_name || ''} onChange={(v) => setField('brokerage_name', v)} />
                    <Input label="Brokerage Website" value={form.brokerage_website || ''} onChange={(v) => setField('brokerage_website', v)} />
                  </div>
                  <Input label="Brokerage Logo URL" value={form.brokerage_logo_url || ''} onChange={(v) => setField('brokerage_logo_url', v)} placeholder="https://..." />
                </div>
              </div>

              {/* ── Images ─────────────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Images ({form.images.length})</p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={imageDraft}
                    onChange={(e) => setImageDraft(e.target.value)}
                    placeholder="https://... image URL"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImage(); } }}
                  />
                  <button
                    onClick={addImage}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {form.images.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {form.images.map((img, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                        <img src={img.url} alt="" className="w-10 h-7 object-cover rounded" />
                        <span className="flex-1 text-xs text-gray-600 truncate">{img.url}</span>
                        <button onClick={() => removeImage(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Feature bullets ────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Feature Bullets ({form.feature_bullets.length})</p>
                <div className="flex gap-2 mb-2">
                  <input
                    value={bulletDraft}
                    onChange={(e) => setBulletDraft(e.target.value)}
                    placeholder="e.g. Twin diesel engines"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBullet(); } }}
                  />
                  <button onClick={addBullet} className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
                    Add
                  </button>
                </div>
                {form.feature_bullets.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {form.feature_bullets.map((bullet, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 text-gray-700">{bullet}</span>
                        <button onClick={() => removeBullet(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Advanced specs (collapsible) ───────────────────────── */}
              <div>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors"
                >
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Advanced Specs
                </button>
                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Input label="Boat Type" value={form.boat_type || ''} onChange={(v) => setField('boat_type', v)} />
                    <Input label="Length (ft)" value={form.length_feet?.toString() || ''} onChange={(v) => setField('length_feet', v ? parseFloat(v) : null)} type="number" />
                    <Input label="Beam (ft)" value={form.beam_feet?.toString() || ''} onChange={(v) => setField('beam_feet', v ? parseFloat(v) : null)} type="number" />
                    <Input label="Draft (ft)" value={form.draft_feet?.toString() || ''} onChange={(v) => setField('draft_feet', v ? parseFloat(v) : null)} type="number" />
                    <Input label="Hull Material" value={form.hull_material || ''} onChange={(v) => setField('hull_material', v)} />
                    <Input label="Hull Type" value={form.hull_type || ''} onChange={(v) => setField('hull_type', v)} />
                    <Input label="Engine Count" value={form.engine_count?.toString() || ''} onChange={(v) => setField('engine_count', v ? parseInt(v) : null)} type="number" />
                    <Input label="Engine Hours" value={form.engine_hours?.toString() || ''} onChange={(v) => setField('engine_hours', v ? parseFloat(v) : null)} type="number" />
                    <Input label="Fuel Type" value={form.fuel_type || ''} onChange={(v) => setField('fuel_type', v)} />
                    <Input label="Max Speed (kts)" value={form.max_speed_knots?.toString() || ''} onChange={(v) => setField('max_speed_knots', v ? parseFloat(v) : null)} type="number" />
                    <Input label="Cruise Speed (kts)" value={form.cruising_speed_knots?.toString() || ''} onChange={(v) => setField('cruising_speed_knots', v ? parseFloat(v) : null)} type="number" />
                    <Input label="Fuel Cap (gal)" value={form.fuel_capacity_gallons?.toString() || ''} onChange={(v) => setField('fuel_capacity_gallons', v ? parseFloat(v) : null)} type="number" />
                    <Input label="Water Cap (gal)" value={form.water_capacity_gallons?.toString() || ''} onChange={(v) => setField('water_capacity_gallons', v ? parseFloat(v) : null)} type="number" />
                    <Input label="Cabins" value={form.cabins?.toString() || ''} onChange={(v) => setField('cabins', v ? parseInt(v) : null)} type="number" />
                    <Input label="Berths" value={form.berths?.toString() || ''} onChange={(v) => setField('berths', v ? parseInt(v) : null)} type="number" />
                    <Input label="Heads" value={form.heads?.toString() || ''} onChange={(v) => setField('heads', v ? parseInt(v) : null)} type="number" />
                  </div>
                )}
              </div>

              {/* ── Internal note ──────────────────────────────────────── */}
              <Textarea label="Internal Note (not shown to visitors)" value={form.internal_note || ''} onChange={(v) => setField('internal_note', v)} rows={2} />

            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#10214F' }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editTarget ? 'Save Changes' : 'Create Preview'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
