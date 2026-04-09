'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Trash2, Star, Upload, X, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const authHeaders = () => ({
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});

const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});

type Tab = 'basic' | 'specs' | 'media' | 'admin';

export default function AdminListingEditPage() {
  const router = useRouter();
  const params = useParams();
  const listingId = Number(params?.id);

  const [listing, setListing] = useState<any>(null);
  const [dealers, setDealers] = useState<any[]>([]);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('basic');
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!listingId) return;
    Promise.all([
      fetch(apiUrl(`/listings/${listingId}`), { headers: authHeaders() }).then(r => r.json()),
      fetch(apiUrl('/admin/users?user_type=dealer&limit=500'), { headers: authHeaders() }).then(r => r.json()),
    ]).then(([lData, uData]) => {
      setListing(lData);
      const dealerList = uData.users || [];
      setDealers(dealerList);
      // Load salespeople for the listing's dealer
      if (lData?.user_id) loadSalespeople(lData.user_id);
    });
  }, [listingId]);

  async function loadSalespeople(dealerId: number) {
    try {
      const res = await fetch(apiUrl(`/admin/users/${dealerId}/team`), { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSalespeople(data.team || data || []);
      }
    } catch { /* silent */ }
  }

  function set(field: string, value: any) {
    setListing((prev: any) => ({ ...prev, [field]: value }));
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        title: listing.title,
        make: listing.make,
        model: listing.model,
        year: listing.year ? Number(listing.year) : null,
        price: listing.price ? Number(listing.price) : null,
        currency: listing.currency || 'USD',
        condition: listing.condition,
        description: listing.description,
        city: listing.city,
        state: listing.state,
        country: listing.country,
        status: listing.status,
        featured: listing.featured,
        length_feet: listing.length_feet ? Number(listing.length_feet) : null,
        beam_feet: listing.beam_feet ? Number(listing.beam_feet) : null,
        draft_feet: listing.draft_feet ? Number(listing.draft_feet) : null,
        boat_type: listing.boat_type,
        hull_material: listing.hull_material,
        engine_make: listing.engine_make,
        engine_model: listing.engine_model,
        engine_type: listing.engine_type,
        engine_hours: listing.engine_hours ? Number(listing.engine_hours) : null,
        fuel_type: listing.fuel_type,
        cabins: listing.cabins ? Number(listing.cabins) : null,
        berths: listing.berths ? Number(listing.berths) : null,
        heads: listing.heads ? Number(listing.heads) : null,
        assigned_salesman_id: listing.assigned_salesman_id ? Number(listing.assigned_salesman_id) : null,
      };
      const res = await fetch(apiUrl(`/listings/${listingId}`), {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(true, 'Listing saved successfully');
      } else {
        const err = await res.json();
        showToast(false, err.detail || 'Save failed');
      }
    } catch (e: any) {
      showToast(false, e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete listing #${listingId}? This cannot be undone.`)) return;
    const res = await fetch(apiUrl(`/listings/${listingId}`), { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      router.push('/admin');
    } else {
      showToast(false, 'Delete failed');
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setUploadingImages(true);
    const urls: string[] = [];
    try {
      for (const file of Array.from(e.target.files)) {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch(apiUrl('/upload'), { method: 'POST', headers: authHeaders(), body: fd });
        if (r.ok) { const d = await r.json(); urls.push(d.url); }
      }
      if (urls.length) {
        await fetch(apiUrl(`/listings/${listingId}/images`), {
          method: 'POST', headers: jsonHeaders(), body: JSON.stringify(urls),
        });
        const fresh = await fetch(apiUrl(`/listings/${listingId}`), { headers: authHeaders() }).then(r => r.json());
        setListing(fresh);
        showToast(true, `${urls.length} image(s) uploaded`);
      }
    } catch { showToast(false, 'Image upload failed'); }
    finally { setUploadingImages(false); }
  }

  async function deleteImage(imageId: number) {
    if (!confirm('Delete this image?')) return;
    const r = await fetch(apiUrl(`/listings/${listingId}/images/${imageId}`), { method: 'DELETE', headers: authHeaders() });
    if (r.ok) {
      setListing((prev: any) => ({ ...prev, images: prev.images?.filter((i: any) => i.id !== imageId) }));
    }
  }

  async function setPrimary(imageId: number) {
    await fetch(apiUrl(`/listings/${listingId}/images/${imageId}/set-primary`), { method: 'POST', headers: authHeaders() });
    setListing((prev: any) => ({
      ...prev,
      images: prev.images?.map((i: any) => ({ ...i, is_primary: i.id === imageId })),
    }));
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading listing…</div>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F] focus:border-[#10214F]';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#10214F]">
              {listing.title || `Listing #${listingId}`}
            </h1>
            <p className="text-xs text-gray-500">
              ID #{listingId}
              {listing.source_url && (
                <> · <a href={listing.source_url} target="_blank" rel="noreferrer" className="text-[#01BBDC] hover:underline inline-flex items-center gap-0.5">Source <ExternalLink size={10} /></a></>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#10214F] text-white text-sm font-medium rounded-lg hover:bg-[#1a3470] disabled:opacity-60"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex border-b mb-6 bg-white rounded-t-lg shadow-sm px-4">
          {([
            ['basic', 'Basic Info'],
            ['specs', 'Specifications'],
            ['media', 'Photos'],
            ['admin', 'Admin Fields'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id ? 'border-[#10214F] text-[#10214F]' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">

          {/* ── BASIC INFO ── */}
          {tab === 'basic' && (
            <>
              <div>
                <label className={labelCls}>Title</label>
                <input className={inputCls} value={listing.title || ''} onChange={e => set('title', e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Make</label>
                  <input className={inputCls} value={listing.make || ''} onChange={e => set('make', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Model</label>
                  <input className={inputCls} value={listing.model || ''} onChange={e => set('model', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Year</label>
                  <input type="number" className={inputCls} value={listing.year || ''} onChange={e => set('year', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Price</label>
                  <input type="number" className={inputCls} value={listing.price ?? ''} onChange={e => set('price', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Currency</label>
                  <select className={inputCls} value={listing.currency || 'USD'} onChange={e => set('currency', e.target.value)}>
                    {['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Condition</label>
                  <select className={inputCls} value={listing.condition || 'used'} onChange={e => set('condition', e.target.value)}>
                    <option value="new">New</option>
                    <option value="used">Used</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea className={inputCls} rows={8} value={listing.description || ''} onChange={e => set('description', e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={listing.city || ''} onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>State / Province</label>
                  <input className={inputCls} value={listing.state || ''} onChange={e => set('state', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <input className={inputCls} value={listing.country || ''} onChange={e => set('country', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={listing.status || 'draft'} onChange={e => set('status', e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="sold">Sold</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={!!listing.featured} onChange={e => set('featured', e.target.checked)} />
                    <span className="text-sm font-medium text-gray-700">Featured Listing</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* ── SPECS ── */}
          {tab === 'specs' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Length (ft)</label>
                  <input type="number" step="0.1" className={inputCls} value={listing.length_feet ?? ''} onChange={e => set('length_feet', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Beam (ft)</label>
                  <input type="number" step="0.1" className={inputCls} value={listing.beam_feet ?? ''} onChange={e => set('beam_feet', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Draft (ft)</label>
                  <input type="number" step="0.1" className={inputCls} value={listing.draft_feet ?? ''} onChange={e => set('draft_feet', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Boat Type</label>
                  <input className={inputCls} placeholder="e.g. Motor Yacht" value={listing.boat_type || ''} onChange={e => set('boat_type', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Hull Material</label>
                  <input className={inputCls} placeholder="e.g. Fiberglass" value={listing.hull_material || ''} onChange={e => set('hull_material', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Engine Make</label>
                  <input className={inputCls} value={listing.engine_make || ''} onChange={e => set('engine_make', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Engine Model</label>
                  <input className={inputCls} value={listing.engine_model || ''} onChange={e => set('engine_model', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Engine Type</label>
                  <input className={inputCls} placeholder="e.g. Inboard Diesel" value={listing.engine_type || ''} onChange={e => set('engine_type', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Engine Hours</label>
                  <input type="number" className={inputCls} value={listing.engine_hours ?? ''} onChange={e => set('engine_hours', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Fuel Type</label>
                  <input className={inputCls} placeholder="e.g. Diesel" value={listing.fuel_type || ''} onChange={e => set('fuel_type', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Cabins</label>
                  <input type="number" className={inputCls} value={listing.cabins ?? ''} onChange={e => set('cabins', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Berths</label>
                  <input type="number" className={inputCls} value={listing.berths ?? ''} onChange={e => set('berths', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Heads</label>
                  <input type="number" className={inputCls} value={listing.heads ?? ''} onChange={e => set('heads', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── PHOTOS ── */}
          {tab === 'media' && (
            <>
              <div>
                <label className={labelCls}>Upload Photos</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#01BBDC] transition-colors">
                  <input type="file" multiple accept="image/*" id="img-upload" className="hidden" disabled={uploadingImages} onChange={handleImageUpload} />
                  <label htmlFor="img-upload" className="cursor-pointer flex flex-col items-center gap-2 text-sm text-gray-500">
                    <Upload size={32} className="text-gray-300" />
                    {uploadingImages ? 'Uploading…' : 'Click to upload images'}
                  </label>
                </div>
              </div>

              <div>
                <p className={labelCls}>Current Photos ({listing.images?.length || 0})</p>
                {(!listing.images || listing.images.length === 0) ? (
                  <p className="text-sm text-gray-400 italic">No photos yet.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {listing.images.map((img: any) => (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                        <img src={img.url || img.thumbnail_url} alt="" className="w-full h-28 object-cover" />
                        {img.is_primary && (
                          <span className="absolute top-1 left-1 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">Primary</span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {!img.is_primary && (
                            <button onClick={() => setPrimary(img.id)} title="Set as primary" className="p-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                              <Star size={13} />
                            </button>
                          )}
                          <button onClick={() => deleteImage(img.id)} title="Delete" className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── ADMIN FIELDS ── */}
          {tab === 'admin' && (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                These fields are only visible to admins and affect platform-level behaviour.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Owner (Dealer Account)</label>
                  <select
                    className={inputCls}
                    value={listing.user_id || ''}
                    onChange={e => {
                      set('user_id', Number(e.target.value));
                      setSalespeople([]);
                      if (e.target.value) loadSalespeople(Number(e.target.value));
                    }}
                  >
                    <option value="">— Select dealer —</option>
                    {dealers.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.company_name || `${d.first_name} ${d.last_name}`.trim()} (#{d.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Assigned Salesperson</label>
                  <select
                    className={inputCls}
                    value={listing.assigned_salesman_id || ''}
                    onChange={e => set('assigned_salesman_id', e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">— None —</option>
                    {salespeople.map((sp: any) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.first_name} {sp.last_name} ({sp.email})
                      </option>
                    ))}
                  </select>
                  {!listing.user_id && <p className="text-xs text-gray-400 mt-0.5">Select an owner first to see their team.</p>}
                </div>
              </div>

              <div>
                <label className={labelCls}>Source URL <span className="text-gray-400 font-normal">(scraped from)</span></label>
                <input className={inputCls} value={listing.source_url || ''} onChange={e => set('source_url', e.target.value)} placeholder="https://…" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Listing ID</label>
                  <input className={inputCls} value={listingId} disabled />
                </div>
                <div>
                  <label className={labelCls}>Created At</label>
                  <input className={inputCls} value={listing.created_at ? new Date(listing.created_at).toLocaleString() : '—'} disabled />
                </div>
              </div>

              {listing.source_url && (
                <div>
                  <a
                    href={listing.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[#01BBDC] hover:underline"
                  >
                    <ExternalLink size={14} /> View original listing source
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom save bar */}
        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Listings
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#10214F] text-white font-medium rounded-lg hover:bg-[#1a3470] disabled:opacity-60"
          >
            <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
