'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, AlertCircle, ExternalLink, Anchor, Upload } from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import AvailabilityCalendar, { type AvailabilityBlock } from '@/app/components/charter/AvailabilityCalendar';
import { CHARTER_FEATURES } from '@/app/lib/charterFeatures';

const authHeaders = () => ({
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});
const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  ...authHeaders(),
});

interface CharterListing {
  id: number;
  title: string;
  vessel_name: string;
  slug?: string;
  boat_type?: string;
  home_port_city?: string;
  home_port_state?: string;
  home_port_country?: string;
  max_guests?: number;
  crew_included: boolean;
  day_rate?: number;
  half_day_rate?: number;
  week_rate?: number;
  currency: string;
  charter_company_name?: string;
  status: string;
  created_at?: string;
  // edit form extras
  make?: string;
  model?: string;
  year?: number;
  length_feet?: number;
  description?: string;
  booking_url?: string;
  charter_company_email?: string;
  charter_company_phone?: string;
  charter_company_website?: string;
  amenities?: string[];
  crew_profiles?: CrewProfile[];
  min_charter_days?: number;
  max_charter_days?: number;
  operating_regions?: string;
  embarkation_ports?: string[];
  disembarkation_ports?: string[];
  one_way_allowed?: boolean;
  turnaround_days?: number;
  apa_percentage?: number;
  security_deposit?: number;
  tax_notes?: string;
  cancellation_policy?: string;
  included_items?: string[];
  excluded_items?: string[];
  images?: (string | { url: string })[];
  availability_blocks?: AvailabilityBlock[];
  seasonal_rates?: SeasonalRate[];
}

interface CrewProfile {
  name: string;
  role: string;
  bio?: string;
}

interface SeasonalRate {
  id: number;
  season_name: string;
  start_date?: string;
  end_date?: string;
  day_rate?: number;
  half_day_rate?: number;
  week_rate?: number;
  currency?: string;
  min_charter_days?: number;
  notes?: string;
}

function Toast({ ok, msg, onClose }: { ok: boolean; msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {ok ? <Check size={15} /> : <AlertCircle size={15} />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

const BOAT_TYPES = [
  'Motor Yacht', 'Mega Yacht', 'Trawler', 'Express Cruiser', 'Sport Fisher',
  'Sailing Yacht', 'Catamaran', 'Sloop', 'Power Catamaran', 'Pontoon',
  'Center Console', 'Deck Boat', 'Houseboat', 'Other',
];

const BLANK_CHARTER: Partial<CharterListing> = {
  title: '', vessel_name: '', boat_type: '', status: 'active', crew_included: true, currency: 'USD',
  charter_company_name: '', charter_company_email: '', charter_company_phone: '',
  home_port_city: '', home_port_state: '', home_port_country: 'USA',
  operating_regions: '', description: '', booking_url: '',
  embarkation_ports: [], disembarkation_ports: [], included_items: [], excluded_items: [],
  amenities: [], crew_profiles: [],
};

function CharterModal({ initial, onSave, onClose }: {
  initial?: CharterListing;
  onSave: (data: Partial<CharterListing>) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Partial<CharterListing>>(initial ?? BLANK_CHARTER);
  const [saving, setSaving] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(isEdit);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>(initial?.availability_blocks ?? []);
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[]>(initial?.seasonal_rates ?? []);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [seasonalSaving, setSeasonalSaving] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null);
  const [deletingRateId, setDeletingRateId] = useState<number | null>(null);
  // Controlled text states for comma-separated fields — only parsed on blur/submit
  const [includedText, setIncludedText] = useState((initial?.included_items ?? []).join(', '));
  const [excludedText, setExcludedText] = useState((initial?.excluded_items ?? []).join(', '));
  // Optional crew profiles — only appear on the listing if at least one is added
  const [crewProfiles, setCrewProfiles] = useState<CrewProfile[]>(initial?.crew_profiles ?? []);
  const [crewDraft, setCrewDraft] = useState<CrewProfile>({ name: '', role: '', bio: '' });
  // Image management
  const [charterImages, setCharterImages] = useState<string[]>(
    (initial?.images ?? []).map((img) => (typeof img === 'string' ? img : img.url)),
  );
  const [uploadingImages, setUploadingImages] = useState(false);
  const [availabilityForm, setAvailabilityForm] = useState({
    start_date: '',
    end_date: '',
    status: 'booked',
    source: 'manual',
    notes: '',
  });
  const [seasonalRateForm, setSeasonalRateForm] = useState({
    season_name: '',
    start_date: '',
    end_date: '',
    day_rate: '',
    half_day_rate: '',
    week_rate: '',
    min_charter_days: '',
    notes: '',
  });

  const set = (k: keyof CharterListing, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const toggleAmenity = (feature: string) => {
    setForm(f => {
      const current = f.amenities ?? [];
      const next = current.includes(feature) ? current.filter(a => a !== feature) : [...current, feature];
      return { ...f, amenities: next };
    });
  };

  const addCrewProfile = () => {
    if (!crewDraft.name.trim() || !crewDraft.role.trim()) return;
    setCrewProfiles(current => [...current, { ...crewDraft, name: crewDraft.name.trim(), role: crewDraft.role.trim(), bio: crewDraft.bio?.trim() || undefined }]);
    setCrewDraft({ name: '', role: '', bio: '' });
  };

  const removeCrewProfile = (index: number) => {
    setCrewProfiles(current => current.filter((_, i) => i !== index));
  };

  useEffect(() => {
    let cancelled = false;

    const loadDetails = async () => {
      if (!initial?.id) {
        setDetailsLoading(false);
        return;
      }

      setDetailsLoading(true);
      try {
        const res = await fetch(apiUrl(`/charter/${initial.id}`), { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load charter details');
        const data = await res.json();
        if (cancelled) return;
        setForm({ ...BLANK_CHARTER, ...data });
        setAvailabilityBlocks(data.availability_blocks ?? []);
        setSeasonalRates(data.seasonal_rates ?? []);
        setIncludedText((data.included_items ?? []).join(', '));
        setExcludedText((data.excluded_items ?? []).join(', '));
        setCrewProfiles(data.crew_profiles ?? []);
        setCharterImages(
          (data.images ?? []).map((img: string | { url: string }) =>
            typeof img === 'string' ? img : img.url,
          ),
        );
      } catch {
        if (!cancelled) {
          setAvailabilityBlocks(initial.availability_blocks ?? []);
          setSeasonalRates(initial.seasonal_rates ?? []);
        }
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    loadDetails();
    return () => { cancelled = true; };
  }, [initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      included_items: includedText.split(',').map(v => v.trim()).filter(Boolean),
      excluded_items: excludedText.split(',').map(v => v.trim()).filter(Boolean),
      crew_profiles: crewProfiles,
    });
    setSaving(false);
  };

  const addAvailabilityBlock = async () => {
    if (!initial?.id || !availabilityForm.start_date || !availabilityForm.end_date) return;
    setAvailabilitySaving(true);
    try {
      const res = await fetch(apiUrl(`/charter/${initial.id}/availability`), {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          ...availabilityForm,
          notes: availabilityForm.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const block: AvailabilityBlock = await res.json();
      setAvailabilityBlocks((current) => [...current, block].sort((left, right) => left.start_date.localeCompare(right.start_date)));
      setAvailabilityForm({ start_date: '', end_date: '', status: 'booked', source: 'manual', notes: '' });
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const removeAvailabilityBlock = async (blockId: number) => {
    if (!initial?.id) return;
    setDeletingBlockId(blockId);
    try {
      const res = await fetch(apiUrl(`/charter/${initial.id}/availability/${blockId}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setAvailabilityBlocks((current) => current.filter((block) => block.id !== blockId));
    } finally {
      setDeletingBlockId(null);
    }
  };

  const addSeasonalRate = async () => {
    if (!initial?.id || !seasonalRateForm.season_name.trim()) return;
    setSeasonalSaving(true);
    try {
      const res = await fetch(apiUrl(`/charter/${initial.id}/seasonal-rates`), {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          season_name: seasonalRateForm.season_name.trim(),
          start_date: seasonalRateForm.start_date || undefined,
          end_date: seasonalRateForm.end_date || undefined,
          day_rate: seasonalRateForm.day_rate ? Number(seasonalRateForm.day_rate) : undefined,
          half_day_rate: seasonalRateForm.half_day_rate ? Number(seasonalRateForm.half_day_rate) : undefined,
          week_rate: seasonalRateForm.week_rate ? Number(seasonalRateForm.week_rate) : undefined,
          currency: form.currency || 'USD',
          min_charter_days: seasonalRateForm.min_charter_days ? Number(seasonalRateForm.min_charter_days) : undefined,
          notes: seasonalRateForm.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const rate: SeasonalRate = await res.json();
      setSeasonalRates((current) => [...current, rate].sort((left, right) => `${left.start_date ?? ''}${left.season_name}`.localeCompare(`${right.start_date ?? ''}${right.season_name}`)));
      setSeasonalRateForm({ season_name: '', start_date: '', end_date: '', day_rate: '', half_day_rate: '', week_rate: '', min_charter_days: '', notes: '' });
    } finally {
      setSeasonalSaving(false);
    }
  };

  const removeSeasonalRate = async (rateId: number) => {
    if (!initial?.id) return;
    setDeletingRateId(rateId);
    try {
      const res = await fetch(apiUrl(`/charter/${initial.id}/seasonal-rates/${rateId}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setSeasonalRates((current) => current.filter((rate) => rate.id !== rateId));
    } finally {
      setDeletingRateId(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!initial?.id || !e.target.files?.length) return;
    setUploadingImages(true);
    const newUrls: string[] = [];
    try {
      for (const file of Array.from(e.target.files)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(apiUrl('/upload'), {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          newUrls.push(data.url);
        }
      }
      if (newUrls.length > 0) {
        const updated = [...charterImages, ...newUrls];
        const res = await fetch(apiUrl(`/charter/${initial.id}`), {
          method: 'PUT',
          headers: jsonHeaders(),
          body: JSON.stringify({ images: updated }),
        });
        if (res.ok) setCharterImages(updated);
      }
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleImageDelete = async (url: string) => {
    if (!initial?.id) return;
    const updated = charterImages.filter((u) => u !== url);
    const res = await fetch(apiUrl(`/charter/${initial.id}`), {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ images: updated }),
    });
    if (res.ok) setCharterImages(updated);
  };

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F] focus:border-transparent';
  const lbl = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center px-4 py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[#10214F]">{initial ? 'Edit Charter Listing' : 'New Charter Listing'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {detailsLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            <div className="mr-3 h-6 w-6 animate-spin rounded-full border-b-2 border-[#10214F]" />
            Loading charter details...
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Listing Title *</label>
              <input required className={inp} value={form.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="e.g. 60' Motor Yacht Charter — Miami" />
            </div>
            <div>
              <label className={lbl}>Vessel Name *</label>
              <input required className={inp} value={form.vessel_name ?? ''} onChange={e => set('vessel_name', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Boat Type</label>
              <select className={inp} value={form.boat_type ?? ''} onChange={e => set('boat_type', e.target.value)}>
                <option value="">— Select —</option>
                {BOAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Make</label>
              <input className={inp} value={form.make ?? ''} onChange={e => set('make', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Model</label>
              <input className={inp} value={form.model ?? ''} onChange={e => set('model', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Year</label>
              <input type="number" className={inp} value={form.year ?? ''} onChange={e => set('year', e.target.value ? Number(e.target.value) : undefined)} placeholder="2020" />
            </div>
            <div>
              <label className={lbl}>Length (ft)</label>
              <input type="number" className={inp} value={form.length_feet ?? ''} onChange={e => set('length_feet', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Home Port</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>City</label>
                <input className={inp} value={form.home_port_city ?? ''} onChange={e => set('home_port_city', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>State</label>
                <input className={inp} value={form.home_port_state ?? ''} onChange={e => set('home_port_state', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Country</label>
                <input className={inp} value={form.home_port_country ?? ''} onChange={e => set('home_port_country', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Charter specs */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Charter Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Max Guests</label>
                <input type="number" className={inp} value={form.max_guests ?? ''} onChange={e => set('max_guests', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className={lbl}>Min Charter Days</label>
                <input type="number" className={inp} value={form.min_charter_days ?? ''} onChange={e => set('min_charter_days', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className={lbl}>Max Charter Days</label>
                <input type="number" className={inp} value={form.max_charter_days ?? ''} onChange={e => set('max_charter_days', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="crew" checked={form.crew_included ?? true} onChange={e => set('crew_included', e.target.checked)} className="w-4 h-4 accent-[#10214F]" />
                <label htmlFor="crew" className="text-sm text-gray-700">Crew Included</label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="one_way_allowed" checked={form.one_way_allowed ?? false} onChange={e => set('one_way_allowed', e.target.checked)} className="w-4 h-4 accent-[#10214F]" />
                <label htmlFor="one_way_allowed" className="text-sm text-gray-700">One-way allowed</label>
              </div>
              <div>
                <label className={lbl}>Turnaround Days</label>
                <input type="number" className={inp} value={form.turnaround_days ?? ''} onChange={e => set('turnaround_days', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
          </div>

          {/* Crew Profiles — fully optional; only rendered on the listing page if at least one is added */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Crew Profiles (optional)</p>
            <p className="text-xs text-gray-400 mb-2">Add a captain, chef, or mate to show a "Meet the Crew" section on the listing. Leave empty to hide it entirely.</p>
            {crewProfiles.length > 0 && (
              <div className="space-y-2 mb-3">
                {crewProfiles.map((crew, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{crew.name} <span className="text-gray-400 font-normal">— {crew.role}</span></p>
                      {crew.bio && <p className="text-xs text-gray-500 mt-0.5">{crew.bio}</p>}
                    </div>
                    <button type="button" onClick={() => removeCrewProfile(i)} className="text-xs font-medium text-red-600 hover:text-red-700 flex-shrink-0">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <input className={inp} placeholder="Name" value={crewDraft.name} onChange={e => setCrewDraft(d => ({ ...d, name: e.target.value }))} />
              <input className={inp} placeholder="Role (e.g. Captain)" value={crewDraft.role} onChange={e => setCrewDraft(d => ({ ...d, role: e.target.value }))} />
              <input className={inp} placeholder="Short bio (optional)" value={crewDraft.bio ?? ''} onChange={e => setCrewDraft(d => ({ ...d, bio: e.target.value }))} />
            </div>
            <button type="button" onClick={addCrewProfile} disabled={!crewDraft.name.trim() || !crewDraft.role.trim()} className="mt-2 px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-40">
              + Add crew member
            </button>
          </div>

          {/* Operation region */}
          <div>
            <label className={lbl}>Operating Regions</label>
            <input className={inp} value={form.operating_regions ?? ''} onChange={e => set('operating_regions', e.target.value)} placeholder="Caribbean, Bahamas, Florida Keys" />
          </div>

          {/* Amenities & Features — same tags shown in the public /charter filter bar */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Amenities &amp; Features</p>
            <p className="text-xs text-gray-400 mb-2">Checked items appear on the listing page and let this charter show up when guests filter by that feature.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {CHARTER_FEATURES.map(feature => {
                const checked = (form.amenities ?? []).includes(feature);
                return (
                  <label key={feature} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${checked ? 'border-[#10214F] bg-[#10214F]/5 text-[#10214F]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleAmenity(feature)} className="w-4 h-4 accent-[#10214F]" />
                    {feature}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Charter inclusions */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Included / Excluded</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Included Items (comma separated)</label>
                <textarea
                  className={inp + ' resize-none'}
                  rows={3}
                  value={includedText}
                  onChange={e => setIncludedText(e.target.value)}
                  onBlur={e => set('included_items', e.target.value.split(',').map(v => v.trim()).filter(Boolean))}
                  placeholder="Crew, towels, water, soft drinks"
                />
              </div>
              <div>
                <label className={lbl}>Excluded Items (comma separated)</label>
                <textarea
                  className={inp + ' resize-none'}
                  rows={3}
                  value={excludedText}
                  onChange={e => setExcludedText(e.target.value)}
                  onBlur={e => set('excluded_items', e.target.value.split(',').map(v => v.trim()).filter(Boolean))}
                  placeholder="Fuel, gratuity, marina fees"
                />
              </div>
            </div>
          </div>

          {/* Rates */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rates (USD)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Half Day Rate</label>
                <input type="number" className={inp} value={form.half_day_rate ?? ''} onChange={e => set('half_day_rate', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className={lbl}>Day Rate</label>
                <input type="number" className={inp} value={form.day_rate ?? ''} onChange={e => set('day_rate', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className={lbl}>Week Rate</label>
                <input type="number" className={inp} value={form.week_rate ?? ''} onChange={e => set('week_rate', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className={lbl}>APA %</label>
                <input type="number" className={inp} value={form.apa_percentage ?? ''} onChange={e => set('apa_percentage', e.target.value ? Number(e.target.value) : undefined)} placeholder="30" />
              </div>
              <div>
                <label className={lbl}>Security Deposit</label>
                <input type="number" className={inp} value={form.security_deposit ?? ''} onChange={e => set('security_deposit', e.target.value ? Number(e.target.value) : undefined)} placeholder="5000" />
              </div>
              <div>
                <label className={lbl}>Min Charter Days (seasonal)</label>
                <input type="number" className={inp} value={form.min_charter_days ?? ''} onChange={e => set('min_charter_days', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={lbl}>Tax Notes</label>
                <textarea className={inp + ' resize-none'} rows={2} value={form.tax_notes ?? ''} onChange={e => set('tax_notes', e.target.value)} placeholder="VAT applies in EU waters" />
              </div>
              <div>
                <label className={lbl}>Cancellation Policy</label>
                <textarea className={inp + ' resize-none'} rows={2} value={form.cancellation_policy ?? ''} onChange={e => set('cancellation_policy', e.target.value)} placeholder="50% within 30 days" />
              </div>
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Charter Company</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Company Name</label>
                <input className={inp} value={form.charter_company_name ?? ''} onChange={e => set('charter_company_name', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" className={inp} value={form.charter_company_email ?? ''} onChange={e => set('charter_company_email', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input className={inp} value={form.charter_company_phone ?? ''} onChange={e => set('charter_company_phone', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Website</label>
                <input type="url" className={inp} value={form.charter_company_website ?? ''} onChange={e => set('charter_company_website', e.target.value)} placeholder="https://" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Booking URL (external)</label>
                <input type="url" className={inp} value={form.booking_url ?? ''} onChange={e => set('booking_url', e.target.value)} placeholder="https://" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description</label>
            <textarea rows={4} className={inp + ' resize-none'} value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Status */}
          <div>
            <label className={lbl}>Status</label>
            <select className={inp} value={form.status ?? 'active'} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {isEdit ? (
            <>
              {/* Images */}
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Images</p>
                    <h4 className="text-base font-semibold text-gray-900">Charter listing photos</h4>
                  </div>
                  <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#10214F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a3570] ${uploadingImages ? 'pointer-events-none opacity-50' : ''}`}>
                    <Upload size={13} />{uploadingImages ? 'Uploading…' : 'Add photos'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImages} />
                  </label>
                </div>
                {charterImages.length === 0 ? (
                  <p className="text-sm text-gray-500">No images uploaded yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {charterImages.map((url, i) => (
                      <div key={url} className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                        <img src={mediaUrl(url)} alt={`Charter image ${i + 1}`} onError={onImgError} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleImageDelete(url)}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                          title="Remove image"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Availability Calendar */}
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)]">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Availability Calendar</p>
                      <h4 className="text-base font-semibold text-gray-900">Blocked dates and tentative holds</h4>
                    </div>
                    <span className="text-xs text-gray-400">Booked, hold, option, maintenance, owner use</span>
                  </div>
                  <AvailabilityCalendar blocks={availabilityBlocks} monthsToShow={3} />
                </div>

                <div className="space-y-4 rounded-xl border border-gray-200 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add Availability Block</p>
                    <h4 className="text-base font-semibold text-gray-900">Create a manual booking or hold</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Start Date</label>
                      <input type="date" className={inp} value={availabilityForm.start_date} onChange={e => setAvailabilityForm((current) => ({ ...current, start_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>End Date</label>
                      <input type="date" className={inp} min={availabilityForm.start_date || undefined} value={availabilityForm.end_date} onChange={e => setAvailabilityForm((current) => ({ ...current, end_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>Status</label>
                      <select className={inp} value={availabilityForm.status} onChange={e => setAvailabilityForm((current) => ({ ...current, status: e.target.value }))}>
                        <option value="booked">Booked</option>
                        <option value="hold">Hold</option>
                        <option value="option">Option</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="owner_use">Owner Use</option>
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Source</label>
                      <select className={inp} value={availabilityForm.source} onChange={e => setAvailabilityForm((current) => ({ ...current, source: e.target.value }))}>
                        <option value="manual">Manual</option>
                        <option value="booking">Booking</option>
                        <option value="ical">iCal</option>
                        <option value="api">API</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={lbl}>Notes</label>
                      <textarea rows={2} className={inp + ' resize-none'} value={availabilityForm.notes} onChange={e => setAvailabilityForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Guest hold until deposit clears" />
                    </div>
                  </div>
                  <button type="button" onClick={addAvailabilityBlock} disabled={availabilitySaving || !availabilityForm.start_date || !availabilityForm.end_date} className="w-full rounded-lg bg-[#10214F] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a3570] disabled:opacity-50">
                    {availabilitySaving ? 'Saving block...' : 'Add availability block'}
                  </button>

                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Existing Blocks</p>
                    {availabilityBlocks.length === 0 ? (
                      <p className="text-sm text-gray-500">No blocked dates yet.</p>
                    ) : availabilityBlocks.map((block) => (
                      <div key={block.id ?? `${block.start_date}-${block.end_date}-${block.status}`} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium capitalize text-gray-900">{block.status.replace('_', ' ')}</p>
                          <p className="text-xs text-gray-500">{block.start_date} to {block.end_date}</p>
                        </div>
                        <button type="button" onClick={() => block.id && removeAvailabilityBlock(block.id)} disabled={deletingBlockId === block.id} className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                          {deletingBlockId === block.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.05fr)]">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Seasonal Rates</p>
                    <h4 className="text-base font-semibold text-gray-900">Add price windows for holidays, peak weeks, and shoulder season</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={lbl}>Season Name</label>
                      <input className={inp} value={seasonalRateForm.season_name} onChange={e => setSeasonalRateForm((current) => ({ ...current, season_name: e.target.value }))} placeholder="Holiday week" />
                    </div>
                    <div>
                      <label className={lbl}>Start Date</label>
                      <input type="date" className={inp} value={seasonalRateForm.start_date} onChange={e => setSeasonalRateForm((current) => ({ ...current, start_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>End Date</label>
                      <input type="date" className={inp} min={seasonalRateForm.start_date || undefined} value={seasonalRateForm.end_date} onChange={e => setSeasonalRateForm((current) => ({ ...current, end_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>Half Day Rate</label>
                      <input type="number" className={inp} value={seasonalRateForm.half_day_rate} onChange={e => setSeasonalRateForm((current) => ({ ...current, half_day_rate: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>Day Rate</label>
                      <input type="number" className={inp} value={seasonalRateForm.day_rate} onChange={e => setSeasonalRateForm((current) => ({ ...current, day_rate: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>Week Rate</label>
                      <input type="number" className={inp} value={seasonalRateForm.week_rate} onChange={e => setSeasonalRateForm((current) => ({ ...current, week_rate: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>Min Charter Days</label>
                      <input type="number" className={inp} value={seasonalRateForm.min_charter_days} onChange={e => setSeasonalRateForm((current) => ({ ...current, min_charter_days: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className={lbl}>Notes</label>
                      <textarea rows={2} className={inp + ' resize-none'} value={seasonalRateForm.notes} onChange={e => setSeasonalRateForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Applies to Christmas and New Year departures" />
                    </div>
                  </div>
                  <button type="button" onClick={addSeasonalRate} disabled={seasonalSaving || !seasonalRateForm.season_name.trim()} className="mt-4 w-full rounded-lg bg-[#10214F] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a3570] disabled:opacity-50">
                    {seasonalSaving ? 'Saving rate...' : 'Add seasonal rate'}
                  </button>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Seasonal Pricing</p>
                    <h4 className="text-base font-semibold text-gray-900">Published pricing windows</h4>
                  </div>
                  <div className="space-y-3">
                    {seasonalRates.length === 0 ? (
                      <p className="text-sm text-gray-500">No seasonal rates yet. Base pricing will stay visible publicly until you add one.</p>
                    ) : seasonalRates.map((rate) => {
                      const moneyPrefix = (rate.currency || form.currency || 'USD') === 'USD' ? '$' : (rate.currency || form.currency || 'USD');
                      return (
                        <div key={rate.id} className="rounded-xl border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{rate.season_name}</p>
                              <p className="text-xs text-gray-500">{rate.start_date || 'Open'}{rate.end_date ? ` to ${rate.end_date}` : ''}</p>
                            </div>
                            <button type="button" onClick={() => removeSeasonalRate(rate.id)} disabled={deletingRateId === rate.id} className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                              {deletingRateId === rate.id ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                            {rate.half_day_rate ? <span className="rounded-full bg-gray-100 px-2.5 py-1">Half day {moneyPrefix}{rate.half_day_rate.toLocaleString()}</span> : null}
                            {rate.day_rate ? <span className="rounded-full bg-gray-100 px-2.5 py-1">Day {moneyPrefix}{rate.day_rate.toLocaleString()}</span> : null}
                            {rate.week_rate ? <span className="rounded-full bg-gray-100 px-2.5 py-1">Week {moneyPrefix}{rate.week_rate.toLocaleString()}</span> : null}
                            {rate.min_charter_days ? <span className="rounded-full bg-gray-100 px-2.5 py-1">Min {rate.min_charter_days} days</span> : null}
                          </div>
                          {rate.notes ? <p className="mt-3 text-sm text-gray-600">{rate.notes}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Save this charter first, then reopen it to manage blocked dates and seasonal pricing.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-[#10214F] text-white rounded-lg text-sm font-medium hover:bg-[#1a3570] disabled:opacity-50">
              {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
        )}
      </div>
      </div>
    </div>
  );
}

export default function AdminCharterTab() {
  const [charters, setCharters] = useState<CharterListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState<'create' | CharterListing | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('q', search);
      // Admin fetches all statuses — we filter client-side by statusFilter
      const res = await fetch(apiUrl(`/charter/admin/all?${params}`), { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const all: CharterListing[] = data.results ?? data;
      setTotal(data.total ?? all.length);
      setCharters(all);
    } catch {
      // Fallback to public endpoint if admin endpoint not available yet
      try {
        const res = await fetch(apiUrl(`/charter?page=${page}&limit=${LIMIT}`));
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTotal(data.total ?? 0);
        setCharters(data.results ?? []);
      } catch {
        setCharters([]);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === 'all' ? charters : charters.filter(c => c.status === statusFilter);

  const handleSave = async (data: Partial<CharterListing>) => {
    try {
      const isEdit = typeof modal === 'object' && modal !== null;
      const url = isEdit ? apiUrl(`/charter/${(modal as CharterListing).id}`) : apiUrl('/charter');
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      setToast({ ok: true, msg: isEdit ? 'Charter updated' : 'Charter created' });
      setModal(null);
      load();
    } catch (e) {
      setToast({ ok: false, msg: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(apiUrl('/charter/export'), { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `charter-listings-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setToast({ ok: false, msg: 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const header = 'title,vessel_name,make,model,year,boat_type,hull_material,length_feet,beam_feet,draft_feet,cabins,berths,heads,max_guests,crew_included,crew_count,home_port_city,home_port_state,home_port_country,operating_regions,day_rate,half_day_rate,week_rate,currency,min_charter_days,max_charter_days,apa_percentage,security_deposit,amenities,included_items,excluded_items,description,charter_company_name,charter_company_email,charter_company_phone,charter_company_website,booking_url,status';
    const example = ',North Wind,Custom,Gulet,2023,Sailing Yacht,Wood,144,31.2,10.5,5,10,5,10,true,8,Bodrum,,Turkey,"Turkey, Bodrum, Marmaris",,,149188,EUR,,,35,,"Air Conditioning, Generator, Watermaker, WiFi","Crew","Fuel, Beverages, VAT","44m luxury gulet available for charter in Turkey.",Master Ocean Yacht Brokerage,,,,,draft';
    const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'charter-listings-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(apiUrl('/charter/import'), {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Import failed');
      setImportResult({ created: data.created, updated: data.updated, errors: data.errors ?? [] });
      load();
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this charter listing?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(apiUrl(`/charter/${id}`), { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      setToast({ ok: true, msg: 'Deleted' });
      load();
    } catch {
      setToast({ ok: false, msg: 'Delete failed' });
    } finally {
      setDeletingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      draft: 'bg-yellow-100 text-yellow-700',
      inactive: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  const fmtRate = (c: CharterListing) => {
    if (!c.day_rate && !c.week_rate) return '—';
    const sym = c.currency === 'USD' ? '$' : c.currency;
    if (c.day_rate) return `${sym}${c.day_rate.toLocaleString()}/day`;
    return `${sym}${c.week_rate!.toLocaleString()}/wk`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Charter Listings</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            title="Download a CSV template with the North Wind example pre-filled"
          >
            CSV Template
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <label className={`flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={14} /> {importing ? 'Importing…' : 'Import CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} disabled={importing} />
          </label>
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 bg-[#10214F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a3570] transition-colors"
          >
            <Plus size={15} /> New Charter
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg text-sm ${importResult.errors.length ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
          <div>
            <p className="font-medium">Import complete: {importResult.created} created, {importResult.updated} updated{importResult.errors.length ? `, ${importResult.errors.length} errors` : ''}.</p>
            {importResult.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {importResult.errors.slice(0, 10).map((err, i) => <li key={i}>• {err}</li>)}
                {importResult.errors.length > 10 && <li>… and {importResult.errors.length - 10} more</li>}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-700 flex-shrink-0"><X size={14} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search charters…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F] focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10214F]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#10214F] mr-3" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Anchor className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No charter listings found.</p>
            <button onClick={() => setModal('create')} className="mt-3 text-sm text-[#10214F] hover:underline">Add the first one</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Title', 'Type', 'Location', 'Guests', 'Rate', 'Company', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[200px]">{c.title}</div>
                      <div className="text-xs text-gray-400">{c.vessel_name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.boat_type || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {[c.home_port_city, c.home_port_state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.max_guests ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{fmtRate(c)}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[140px]">{c.charter_company_name || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(c.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a href={`/charter/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#10214F]" title="View listing">
                          <ExternalLink size={15} />
                        </a>
                        <button onClick={() => setModal(c)} className="text-gray-400 hover:text-[#10214F]" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center gap-3 justify-center text-sm text-gray-600">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span>Page {page} of {Math.ceil(total / LIMIT)}</span>
          <button disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}

      {modal && (
        <CharterModal
          initial={modal === 'create' ? undefined : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {toast && <Toast ok={toast.ok} msg={toast.msg} onClose={() => setToast(null)} />}
    </div>
  );
}
