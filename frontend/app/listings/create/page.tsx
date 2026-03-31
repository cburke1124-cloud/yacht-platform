'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MediaUpload from '@/app/components/MediaUpload';
import MediaLibraryPicker from '@/app/components/MediaLibraryPicker';
import ScraperModal from '@/app/components/ScraperModal';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Highlighter, Heading2, Heading3, Pilcrow, Quote, GripVertical, Star, FileText, Film, ArrowLeft } from 'lucide-react';
import { API_ROOT, mediaUrl } from '@/app/lib/apiRoot';
import { COUNTRIES, STATES_BY_COUNTRY, COUNTRY_TO_CONTINENT } from '@/app/lib/locationData';

const TABS = ['basic', 'specs', 'engine', 'media'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  basic:  'Basic Info',
  specs:  'Specifications',
  engine: 'Engine',
  media:  'Photos & Media',
};

type ExtraEngine = {
  make: string;
  model: string;
  type: string;
  hours: string;
  horsepower: string;
  notes: string;
};

type Generator = {
  brand: string;
  model: string;
  hours: string;
  kw: string;
  notes: string;
};

export type ListingEditorMode = 'create' | 'edit';

interface ListingEditorPageProps {
  mode?: ListingEditorMode;
  listingId?: string;
}

function deriveFeatureBullets(form: {
  feature_bullets: string[];
  features_text: string;
  length_feet: string;
  boat_type: string;
  engine_count: string;
  cabins: string;
  berths: string;
  fuel_capacity_gallons: string;
  condition: string;
}) {
  const manual = (form.feature_bullets || []).map(b => b.trim()).filter(Boolean);
  if (manual.length > 0) return manual.slice(0, 8);

  const parsed = (form.features_text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
  if (parsed.length > 0) return parsed.slice(0, 8);

  return [
    `${form.length_feet || '—'} ft ${form.boat_type || 'yacht'} layout`,
    `${form.engine_count || 'Twin'} engine power setup`,
    `${form.cabins || 'Spacious'} cabin configuration`,
    `${form.fuel_capacity_gallons || 'Large'} gallon fuel capacity`,
    `${form.condition === 'new' ? 'Factory-new condition' : 'Well-kept pre-owned condition'}`,
  ].filter(Boolean);
}

export function ListingEditorPage({ mode = 'create', listingId }: ListingEditorPageProps) {
  const router = useRouter();
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const isEditMode = mode === 'edit' && !!listingId;
  const [accessChecking, setAccessChecking] = useState(true);
  const [hasListingAccess, setHasListingAccess] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [initializing, setInitializing] = useState(isEditMode);
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [activeTab, setActiveTab]       = useState<Tab>('basic');
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [showScraperModal, setShowScraperModal] = useState(false);
  // Tracks whether this dealer has co-brokering enabled at account level.
  // Fetched after access check; defaults true so the toggle is hidden until we know.
  const [dealerCobrokingEnabled, setDealerCobrokingEnabled] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);

  // Power/Sail selector for boat type filtering (UI only — not a saved field)
  const SAIL_BOAT_TYPES = ['Sailing Yacht', 'Catamaran', 'Sloop', 'Ketch', 'Schooner', 'Motorsailer'];
  const POWER_BOAT_TYPES = ['Motor Yacht', 'Mega Yacht', 'Superyacht', 'Trawler', 'Express Cruiser', 'Sport Fisher', 'Center Console'];
  const ALL_BOAT_TYPES = [...POWER_BOAT_TYPES, ...SAIL_BOAT_TYPES];

  const derivePropulsion = (bt: string) => SAIL_BOAT_TYPES.includes(bt) ? 'sail' : bt ? 'power' : 'power';
  const [propulsion, setPropulsion] = useState('power');
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const moveMedia = (from: number, to: number) => {
    setUploadedMedia(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const setPrimaryMedia = (idx: number) => {
    setUploadedMedia(prev => {
      const arr = [...prev];
      const [item] = arr.splice(idx, 1);
      return [item, ...arr];
    });
  };

  const [form, setForm] = useState({
    // Basic
    title:           '',
    description:     '',
    price:           '',
    currency:        'USD',
    year:            '',
    make:            '',
    model:           '',
    bin:             '',
    condition:       'used',
    status:          'draft',
    allow_cobrokering: true,
    // Location
    city:            '',
    state:           '',
    country:         'United States',
    zip_code:        '',
    continent:       '',
    // Specs
    length_feet:     '',
    beam_feet:       '',
    draft_feet:      '',
    boat_type:       '',
    hull_material:   '',
    hull_type:       '',
    cabins:          '',
    berths:          '',
    heads:           '',
    previous_owners: '',
    // Engine & performance
    engine_count:    '',
    fuel_type:       '',
    max_speed_knots: '',
    cruising_speed_knots: '',
    // Capacity
    fuel_capacity_gallons:  '',
    water_capacity_gallons: '',
    // Additional specs
    displacement_lbs: '',
    dry_weight_lbs: '',
    bridge_clearance_feet: '',
    deadrise_degrees: '',
    cruising_range_nm: '',
    fuel_burn_gph: '',
    holding_tank_gallons: '',
    // Enhanced listing details
    feature_bullets: ['', '', '', '', ''],
    features_text: '',
    additional_engines: [] as ExtraEngine[],
    generators: [] as Generator[],
  });

  // Scope the draft key to the current user so drafts never bleed across accounts.
  // (kept for legacy cleanup only — no longer written)
  const draftStorageKey = `listing-editor-draft:${userId ?? 'anon'}:${isEditMode ? `edit:${listingId}` : 'create'}`;

  // Tracks the server-assigned draft ID created by the first autosave in create mode.
  // Once set, autosave PUTs to this ID rather than POSTing a new draft every time.
  const savedDraftIdRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkListingAccess = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.replace('/register?user_type=dealer&subscription_tier=basic');
          return;
        }

        const response = await fetch(`${API_ROOT}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          router.replace('/login?redirect=/listings/create');
          return;
        }

        const me = await response.json();
        setUserId(me.id ?? null);
        const userType = String(me.user_type || '').toLowerCase();
        const tier = String(me.subscription_tier || '').toLowerCase();

        const paidDealerTiers = new Set(['basic', 'plus', 'pro', 'premium']);
        const paidPrivateTiers = new Set(['private_basic', 'private_plus', 'private_pro']);

        const isAdmin = userType === 'admin';
        const isPaidDealer = userType === 'dealer' && paidDealerTiers.has(tier);
        const isPaidPrivate = userType === 'private' && paidPrivateTiers.has(tier);
        const hasPermission = me.permissions?.can_create_listings === true;

        // If trial has expired (webhook may not have fired yet), send to billing
        const trialExpired = me.trial_active && me.trial_end_date && new Date(me.trial_end_date) < new Date();
        if (trialExpired && !isAdmin) {
          router.replace('/dashboard/billing?payment=required');
          return;
        }

        if (isAdmin || isPaidDealer || isPaidPrivate || hasPermission) {
          setHasListingAccess(true);
          // Fetch dealer profile to check if account-level co-brokering is enabled
          if (userType === 'dealer' || isAdmin) {
            try {
              const profileRes = await fetch(`${API_ROOT}/dealer-profile`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (profileRes.ok) {
                const profileData = await profileRes.json();
                // cobrokering_enabled defaults true; only hide toggle if explicitly false
                setDealerCobrokingEnabled(profileData.cobrokering_enabled !== false);
              }
            } catch {
              // Keep default (true) if profile fetch fails
            }
          }
          return;
        }

        router.replace('/sell');
      } catch {
        router.replace('/login?redirect=/listings/create');
      } finally {
        setAccessChecking(false);
      }
    };

    checkListingAccess();
  }, [router]);

  useEffect(() => {
    if (!isEditMode || !listingId) {
      setInitializing(false);
      return;
    }

    const loadListing = async () => {
      try {
        const token = localStorage.getItem('token');
        const [listingRes, mediaRes] = await Promise.all([
          fetch(`${API_ROOT}/listings/${listingId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
          fetch(`${API_ROOT}/listings/${listingId}/media`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
        ]);

        if (listingRes.ok) {
          const listing = await listingRes.json();
          const extra = listing.additional_specs || {};
          setForm(p => ({
            ...p,
            title: listing.title || '',
            description: listing.description || '',
            price: listing.price != null ? String(listing.price) : '',
            currency: listing.currency || 'USD',
            year: listing.year != null ? String(listing.year) : '',
            make: listing.make || '',
            model: listing.model || '',
            bin: listing.bin || '',
            condition: listing.condition || 'used',
            status: listing.status || 'draft',
            city: listing.city || '',
            state: listing.state || '',
            country: listing.country || 'United States',
            zip_code: listing.zip_code || '',
            continent: listing.continent || '',
            length_feet: listing.length_feet != null ? String(listing.length_feet) : '',
            beam_feet: listing.beam_feet != null ? String(listing.beam_feet) : '',
            draft_feet: listing.draft_feet != null ? String(listing.draft_feet) : '',
            boat_type: listing.boat_type || '',
            hull_material: listing.hull_material || '',
            hull_type: listing.hull_type || '',
            cabins: listing.cabins != null ? String(listing.cabins) : '',
            berths: listing.berths != null ? String(listing.berths) : '',
            heads: listing.heads != null ? String(listing.heads) : '',
            previous_owners: listing.previous_owners != null ? String(listing.previous_owners) : '',
            engine_count: listing.engine_count != null ? String(listing.engine_count) : '',
            fuel_type: listing.fuel_type || '',
            max_speed_knots: listing.max_speed_knots != null ? String(listing.max_speed_knots) : '',
            cruising_speed_knots: listing.cruising_speed_knots != null ? String(listing.cruising_speed_knots) : '',
            fuel_capacity_gallons: listing.fuel_capacity_gallons != null ? String(listing.fuel_capacity_gallons) : '',
            water_capacity_gallons: listing.water_capacity_gallons != null ? String(listing.water_capacity_gallons) : '',
            displacement_lbs: extra.displacement_lbs != null ? String(extra.displacement_lbs) : '',
            dry_weight_lbs: extra.dry_weight_lbs != null ? String(extra.dry_weight_lbs) : '',
            bridge_clearance_feet: extra.bridge_clearance_feet != null ? String(extra.bridge_clearance_feet) : '',
            deadrise_degrees: extra.deadrise_degrees != null ? String(extra.deadrise_degrees) : '',
            cruising_range_nm: extra.cruising_range_nm != null ? String(extra.cruising_range_nm) : '',
            fuel_burn_gph: extra.fuel_burn_gph != null ? String(extra.fuel_burn_gph) : '',
            holding_tank_gallons: extra.holding_tank_gallons != null ? String(extra.holding_tank_gallons) : '',
            feature_bullets: listing.feature_bullets?.length ? listing.feature_bullets : ['', '', '', '', ''],
            features_text: listing.features || '',
            allow_cobrokering: listing.allow_cobrokering !== false,
            additional_engines: listing.additional_engines?.length
              ? listing.additional_engines
                  .map((engine: any) => ({
                    make: engine.make || '',
                    model: engine.model || '',
                    type: engine.type || '',
                    hours: engine.hours != null ? String(engine.hours) : '',
                    horsepower: engine.horsepower != null ? String(engine.horsepower) : '',
                    notes: engine.notes || '',
                  }))
                  .filter((e: ExtraEngine) => e.make || e.model || e.type || e.hours || e.horsepower || e.notes)
              : p.additional_engines,
            generators: listing.generators?.length
              ? listing.generators.map((generator: any) => ({
                  brand: generator.brand || '',
                  model: generator.model || '',
                  hours: generator.hours != null ? String(generator.hours) : '',
                  kw: generator.kw != null ? String(generator.kw) : '',
                  notes: generator.notes || '',
                }))
              : p.generators,
          }));
          if (listing.boat_type) setPropulsion(derivePropulsion(listing.boat_type));
        }

        if (mediaRes.ok) {
          const mediaPayload = await mediaRes.json();
          setUploadedMedia(mediaPayload.media || []);
        }
      } catch (error) {
        console.error('Failed to load listing for editing:', error);
      } finally {
        setInitializing(false);
      }
    };

    loadListing();
  }, [isEditMode, listingId]);

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const setFeatureBullet = (index: number, value: string) => {
    setForm(p => {
      const next = [...p.feature_bullets];
      next[index] = value;
      return { ...p, feature_bullets: next };
    });
  };

  const setExtraEngine = (index: number, field: keyof ExtraEngine, value: string) => {
    setForm(p => {
      const next = [...p.additional_engines];
      next[index] = { ...next[index], [field]: value };
      return { ...p, additional_engines: next };
    });
  };

  const setGenerator = (index: number, field: keyof Generator, value: string) => {
    setForm(p => {
      const next = [...p.generators];
      next[index] = { ...next[index], [field]: value };
      return { ...p, generators: next };
    });
  };

  const addExtraEngine = () => {
    setForm(p => {
      // Allow up to 3 additional engines (primary engine + up to 3 = 4 total)
      if (p.additional_engines.length >= 3) return p;
      return {
        ...p,
        additional_engines: [...p.additional_engines, { make: '', model: '', type: '', hours: '', horsepower: '', notes: '' }],
      };
    });
  };

  const addGenerator = () => {
    setForm(p => {
      // Allow up to 2 generators
      if (p.generators.length >= 2) return p;
      return {
        ...p,
        generators: [...p.generators, { brand: '', model: '', hours: '', kw: '', notes: '' }],
      };
    });
  };

  const removeExtraEngine = (index: number) => {
    setForm(p => ({
      ...p,
      additional_engines: p.additional_engines.filter((_, i) => i !== index),
    }));
  };

  const removeGenerator = (index: number) => {
    setForm(p => ({
      ...p,
      generators: p.generators.filter((_, i) => i !== index),
    }));
  };

  const wrapDescriptionSelection = (before: string, after = '') => {
    const input = descriptionRef.current;
    if (!input) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const selected = form.description.slice(start, end);
    const next = `${form.description.slice(0, start)}${before}${selected}${after}${form.description.slice(end)}`;
    setForm(p => ({ ...p, description: next }));
    requestAnimationFrame(() => {
      input.focus();
      input.selectionStart = start + before.length;
      input.selectionEnd = start + before.length + selected.length;
    });
  };

  const aiGenerateDescription = () => {
    const title = form.title || 'This yacht';
    const vessel = [form.year, form.make, form.model].filter(Boolean).join(' ') || title;
    const location = [form.city, form.state, form.country].filter(Boolean).join(', ');
    const bullets = form.feature_bullets.filter(Boolean).map(item => `<li>${item}</li>`).join('');

    const html = [
      `<h2>${vessel}</h2>`,
      `<p>${title} offers a refined blend of performance and onboard comfort${location ? ` in ${location}` : ''}.</p>`,
      `<h3>Highlights</h3>`,
      bullets ? `<ul>${bullets}</ul>` : '<ul><li>Well-maintained vessel</li><li>Ready for immediate use</li><li>Contact seller for full spec sheet</li></ul>',
      '<p>This listing is presented in good faith and can be customized with additional operational history, recent upgrades, and service records.</p>',
    ].join('\n');

    setForm(p => ({ ...p, description: html }));
  };

  const aiPolishDescription = () => {
    if (!form.description.trim()) return;
    const polished = form.description
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\bi\b/g, 'I')
      .trim();
    setForm(p => ({ ...p, description: polished }));
  };

  const aiGenerateFeatureBullets = () => {
    const suggested = deriveFeatureBullets(form);
    setForm(p => ({ ...p, feature_bullets: suggested }));
  };

  const aiGenerateFeaturesText = () => {
    const vessel = [form.year, form.make, form.model].filter(Boolean).join(' ') || form.title || 'This vessel';
    const location = [form.city, form.state, form.country].filter(Boolean).join(', ');
    const bullets = deriveFeatureBullets(form);

    const text = [
      `${vessel}${location ? ` — ${location}` : ''}`,
      '',
      'Highlights:',
      ...bullets.map(b => `- ${b}`),
      '',
      'Notable details:',
      `- Hull: ${form.hull_material || 'N/A'} ${form.hull_type ? `(${form.hull_type})` : ''}`,
      `- Engines: ${form.engine_count || 'N/A'} main engines`.trim(),
      `- Accommodation: ${form.cabins || 'N/A'} cabins, ${form.berths || 'N/A'} berths`,
    ].join('\n');

    setForm(p => ({ ...p, features_text: text }));
  };

  /**
   * Normalizes an AI-returned state/province string to match the exact casing
   * in STATES_BY_COUNTRY for dropdown countries, or returns as-is for others.
   */
  const normalizeStateForCountry = (state: string | null | undefined, country: string | null | undefined): string => {
    if (!state) return '';
    const options = country ? STATES_BY_COUNTRY[country] : undefined;
    if (!options) return state;
    const lower = state.toLowerCase();
    return options.find(s => s.toLowerCase() === lower) ?? state;
  };

  /**
   * Given a partial form object (from AI or local parse), fills in any
   * boat_type / hull_material / hull_type / beam_feet / draft_feet that
   * can be deduced from a known make+model combination.
   */
  const inferMissingFields = (data: Record<string, any>) => {
    const make = (data.make || '').toLowerCase();
    const model = (data.model || '').toLowerCase();
    const combined = `${make} ${model}`;

    // --- Boat type inference ---
    if (!data.boat_type) {
      if (/catamaran|cat\b|leopard|lagoon|fountaine pajot|outremer|excess|bali/.test(combined)) {
        data.boat_type = 'Catamaran';
      } else if (/trawler|nordic|nordhavn|defever|grand banks|beneteau swift trawler/.test(combined)) {
        data.boat_type = 'Trawler';
      } else if (/mega.?yacht|superyacht|explorer/.test(combined)) {
        data.boat_type = 'Mega Yacht';
      } else if (/sailing|sloop|ketch|schooner|jeanneau sun|beneteau oceanis|hanse|bavaria|hallberg/.test(combined)) {
        data.boat_type = 'Sailing Yacht';
      } else if (/center.?console|cc\b/.test(combined)) {
        data.boat_type = 'Center Console';
      } else if (/sport.?fish|fishing|bertram|viking|hatteras/.test(combined)) {
        data.boat_type = 'Sport Fisher';
      } else if (/express.?cruiser|sundancer|sea ray|four winns/.test(combined)) {
        data.boat_type = 'Express Cruiser';
      } else if (/azimut|sunseeker|princess|ferretti|riva|sanlorenzo|pershing|prestige|cranchi|galeon|bavaria motor/.test(combined)) {
        data.boat_type = 'Motor Yacht';
      }
    }

    // --- Hull material inference ---
    if (!data.hull_material) {
      if (/aluminum|alloy|alum/.test(combined)) {
        data.hull_material = 'Aluminum';
      } else if (/carbon|carbon fiber/.test(combined)) {
        data.hull_material = 'Carbon Fiber';
      } else if (/steel/.test(combined)) {
        data.hull_material = 'Steel';
      } else if (/wood|classic|timber/.test(combined)) {
        data.hull_material = 'Wood';
      } else if (/composite/.test(combined)) {
        data.hull_material = 'Composite';
      } else if (data.boat_type) {
        // Most production yachts/powerboats are fiberglass
        data.hull_material = 'Fiberglass';
      }
    }

    // --- Hull shape inference ---
    if (!data.hull_type) {
      const bt = (data.boat_type || '').toLowerCase();
      if (/catamaran/.test(bt)) {
        data.hull_type = 'Catamaran';
      } else if (/trawler/.test(bt)) {
        data.hull_type = 'Displacement';
      } else if (/sailing/.test(bt)) {
        data.hull_type = 'Monohull';
      } else if (/motor yacht|express cruiser|sport fish|mega|super/.test(bt)) {
        data.hull_type = 'Planing';
      }
    }

    // --- Dimension inference from well-known model families ---
    // Only fill in when completely absent — these are best-guess defaults.
    const len = Number(data.length_feet) || 0;
    if (!data.beam_feet && len > 0) {
      // Approximate beam as ~28–32% of LOA for most production powerboats/sail
      const bt = (data.boat_type || '').toLowerCase();
      if (/catamaran/.test(bt)) {
        data.beam_feet = String(Math.round(len * 0.44 * 10) / 10); // catamarans are ~44% LOA
      } else {
        data.beam_feet = String(Math.round(len * 0.30 * 10) / 10);
      }
    }
    if (!data.draft_feet && len > 0) {
      const bt = (data.boat_type || '').toLowerCase();
      if (/catamaran/.test(bt)) {
        data.draft_feet = String(Math.round(len * 0.07 * 10) / 10);
      } else if (/sailing/.test(bt)) {
        data.draft_feet = String(Math.round(len * 0.12 * 10) / 10);
      } else {
        data.draft_feet = String(Math.round(len * 0.08 * 10) / 10);
      }
    }

    return data;
  };

  const parseListingTextLocal = (text: string) => {
    const raw = text || '';
    const normalized = raw.replace(/\r/g, '');
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

    const firstMatch = (patterns: RegExp[]) => {
      for (const re of patterns) {
        const m = normalized.match(re);
        if (m?.[1]) return m[1].trim();
      }
      return '';
    };
    const toNumString = (value: string) => {
      if (!value) return '';
      const parsed = Number(String(value).replace(/[,\s]/g, ''));
      return Number.isFinite(parsed) ? String(parsed) : '';
    };

    const titleCandidate = lines[0] || '';
    const year = firstMatch([/\b(19\d{2}|20\d{2})\b/]);
    const price = firstMatch([/price\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d+)?)/i, /\$\s*([\d,]+(?:\.\d+)?)/]);
    const length = firstMatch([/(?:loa|length(?:\s+overall)?)\s*[:\-]?\s*([\d.]+)/i, /\b([\d.]+)\s*(?:ft|')\b/i]);
    const beam = firstMatch([/beam\s*[:\-]?\s*([\d.]+)/i]);
    const draft = firstMatch([/draft(?:\s*(?:max|min)?)?\s*[:\-]?\s*([\d.]+)/i]);
    const cabins = firstMatch([/cabins?\s*[:\-]?\s*(\d+)/i]);
    const berths = firstMatch([/(?:berths?|sleeps?|guests?)\s*[:\-]?\s*(\d+)/i]);
    const heads = firstMatch([/heads?\s*[:\-]?\s*(\d+)/i]);
    const maxSpeed = firstMatch([/max\s*speed\s*[:\-]?\s*([\d.]+)/i]);
    const cruiseSpeed = firstMatch([/cruis(?:e|ing)\s*speed\s*[:\-]?\s*([\d.]+)/i]);
    const fuelTank = firstMatch([/fuel\s*(?:tank|capacity)?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i]);
    const waterTank = firstMatch([/(?:fresh\s*water|water\s*tank|water\s*capacity)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i]);
    const holdingTank = firstMatch([/holding\s*tank\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i]);
    const displacement = firstMatch([/displacement\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i]);
    const hullMaterial = firstMatch([/hull\s*material\s*[:\-]?\s*([^\n]+)/i]);
    const hullType = firstMatch([/hull\s*(?:shape|type)\s*[:\-]?\s*([^\n]+)/i]);
    const make = firstMatch([/\b(Azimut|Beneteau|Bertram|Boston\s*Whaler|Cabo|Carver|Chris\-Craft|Ferretti|Formula|Hatteras|Jeanneau|Leopard|Meridian|Monterey|Monte\s*Carlo|Nordhavn|Pershing|Princess|Regal|Riva|Sanlorenzo|Sea\s*Ray|Sunseeker|Tiara|Viking|Yamaha|Yellowfin)\b/i]);
    const model = firstMatch([/model\s*[:\-]?\s*([^\n]+)/i]);
    let engineCount = '';
    const engineHeaders = normalized.match(/engine\s*\d+/gi);
    if (engineHeaders?.length) engineCount = String(engineHeaders.length);
    if (!engineCount) {
      if (/\btriple\b/i.test(normalized)) engineCount = '3';
      else if (/\bquad\b/i.test(normalized)) engineCount = '4';
      else if (/\btwin\b/i.test(normalized)) engineCount = '2';
      else if (/\bsingle\b/i.test(normalized)) engineCount = '1';
    }

    const cityState = firstMatch([/located\s+in\s+([^\n]+)/i]);
    let city = '';
    let state = '';
    if (cityState.includes(',')) {
      const [c, s] = cityState.split(',').map(v => v.trim());
      city = c || '';
      state = s || '';
    }

    const bulletLines = lines
      .filter(line => /^[-•*]\s+/.test(line))
      .map(line => line.replace(/^[-•*]\s+/, '').trim())
      .filter(Boolean)
      .slice(0, 5);

    const base = {
      title: form.title || titleCandidate,
      year: year || form.year,
      price: toNumString(price) || form.price,
      length_feet: toNumString(length) || form.length_feet,
      beam_feet: toNumString(beam) || form.beam_feet,
      draft_feet: toNumString(draft) || form.draft_feet,
      cabins: cabins || form.cabins,
      berths: berths || form.berths,
      heads: heads || form.heads,
      max_speed_knots: toNumString(maxSpeed) || form.max_speed_knots,
      cruising_speed_knots: toNumString(cruiseSpeed) || form.cruising_speed_knots,
      fuel_capacity_gallons: toNumString(fuelTank) || form.fuel_capacity_gallons,
      water_capacity_gallons: toNumString(waterTank) || form.water_capacity_gallons,
      make: make || form.make,
      model: model || form.model,
      engine_count: engineCount || form.engine_count,
      city: city || form.city,
      state: state || form.state,
      hull_material: hullMaterial || form.hull_material,
      hull_type: hullType || form.hull_type,
      displacement_lbs: toNumString(displacement) || form.displacement_lbs,
      holding_tank_gallons: toNumString(holdingTank) || form.holding_tank_gallons,
      description: form.description || raw,
      feature_bullets: bulletLines.length ? [...bulletLines, ...Array(Math.max(0, 5 - bulletLines.length)).fill('')] : form.feature_bullets,
      features_text: form.features_text || raw,
    };
    return inferMissingFields(base);
  };

  const importFromListingText = async () => {
    if (!importText.trim()) {
      alert('Paste listing text first.');
      return;
    }

    setImportBusy(true);
    try {
      const token = localStorage.getItem('token');
      let merged: any = null;

      try {
        const res = await fetch(`${API_ROOT}/scraper/parse-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text: importText }),
        });
        const data = await res.json();
        if (res.ok && data?.success && data?.data) {
          const ai = data.data;
          merged = {
            title: ai.title || form.title,
            description: ai.description || form.description || importText,
            price: ai.price != null ? String(ai.price) : form.price,
            year: ai.year != null ? String(ai.year) : form.year,
            make: ai.make || form.make,
            model: ai.model || form.model,
            length_feet: ai.length_feet != null ? String(ai.length_feet) : form.length_feet,
            beam_feet: ai.beam_feet != null ? String(ai.beam_feet) : form.beam_feet,
            draft_feet: ai.draft_feet != null ? String(ai.draft_feet) : form.draft_feet,
            boat_type: ai.boat_type || form.boat_type,
            hull_material: ai.hull_material || form.hull_material,
            hull_type: ai.hull_type || form.hull_type,
            engine_count: ai.engine_count != null ? String(ai.engine_count) : form.engine_count,
            fuel_type: ai.fuel_type || form.fuel_type,
            max_speed_knots: ai.max_speed_knots != null ? String(ai.max_speed_knots) : form.max_speed_knots,
            cruising_speed_knots: ai.cruising_speed_knots != null ? String(ai.cruising_speed_knots) : form.cruising_speed_knots,
            fuel_capacity_gallons: ai.fuel_capacity_gallons != null ? String(ai.fuel_capacity_gallons) : form.fuel_capacity_gallons,
            water_capacity_gallons: ai.water_capacity_gallons != null ? String(ai.water_capacity_gallons) : form.water_capacity_gallons,
            cabins: ai.cabins != null ? String(ai.cabins) : form.cabins,
            berths: ai.berths != null ? String(ai.berths) : form.berths,
            heads: ai.heads != null ? String(ai.heads) : form.heads,
            city: ai.city || form.city,
            state: normalizeStateForCountry(ai.state, ai.country) || form.state,
            country: ai.country || form.country,
            continent: ai.continent ||
              (ai.country ? COUNTRY_TO_CONTINENT[ai.country] : '') ||
              form.continent,
            feature_bullets: ai.feature_bullets?.length ? ai.feature_bullets : form.feature_bullets,
            features_text: ai.features || form.features_text,
          };

          // Infer missing fields from make+model knowledge
          merged = inferMissingFields(merged);

          // Populate extra engines/generators from AI response
      if (ai.additional_engines?.length) {
            merged.additional_engines = ai.additional_engines.map((e: any) => ({
              make: e.make || '', model: e.model || '', type: e.type || '',
              hours: e.hours != null ? String(e.hours) : '',
              horsepower: e.horsepower != null ? String(e.horsepower) : '',
              notes: e.notes || '',
            }));
          } else if (ai.engine_count && Number(ai.engine_count) > 0 && !form.additional_engines.length) {
            // AI returned engine count but no detail — pre-populate blank slots for all engines
            const count = Math.min(Number(ai.engine_count), 4);
            merged.additional_engines = Array.from({ length: count }, () => ({
              make: '', model: '', type: '', hours: '', horsepower: '', notes: '',
            }));
          }
          if (ai.generators?.length) {
            merged.generators = ai.generators.map((g: any) => ({
              brand: g.brand || '', model: g.model || '',
              hours: g.hours != null ? String(g.hours) : '',
              kw: g.kw != null ? String(g.kw) : '',
              notes: g.notes || '',
            }));
          }
        }
      } catch {
        // fall back to local parse
      }

      if (!merged) {
        merged = parseListingTextLocal(importText);
      }

      setForm(p => ({ ...p, ...merged }));
      alert('Listing details imported. Please review and adjust as needed.');
    } finally {
      setImportBusy(false);
    }
  };

  const applyExtractedListingData = (ai: any) => {
    const base: any = {
      title: ai.title || undefined,
      description: ai.description || undefined,
      price: ai.price != null ? String(ai.price) : undefined,
      year: ai.year != null ? String(ai.year) : undefined,
      make: ai.make || undefined,
      model: ai.model || undefined,
      length_feet: ai.length_feet != null ? String(ai.length_feet) : undefined,
      beam_feet: ai.beam_feet != null ? String(ai.beam_feet) : undefined,
      draft_feet: ai.draft_feet != null ? String(ai.draft_feet) : undefined,
      boat_type: ai.boat_type || undefined,
      hull_material: ai.hull_material || undefined,
      hull_type: ai.hull_type || undefined,
      engine_count: ai.engine_count != null ? String(ai.engine_count) : undefined,
      fuel_type: ai.fuel_type || undefined,
      max_speed_knots: ai.max_speed_knots != null ? String(ai.max_speed_knots) : undefined,
      cruising_speed_knots: ai.cruising_speed_knots != null ? String(ai.cruising_speed_knots) : undefined,
      fuel_capacity_gallons: ai.fuel_capacity_gallons != null ? String(ai.fuel_capacity_gallons) : undefined,
      water_capacity_gallons: ai.water_capacity_gallons != null ? String(ai.water_capacity_gallons) : undefined,
      cabins: ai.cabins != null ? String(ai.cabins) : undefined,
      berths: ai.berths != null ? String(ai.berths) : undefined,
      heads: ai.heads != null ? String(ai.heads) : undefined,
      city: ai.city || undefined,
      state: normalizeStateForCountry(ai.state, ai.country) || undefined,
      country: ai.country || undefined,
      continent: ai.continent || (ai.country ? COUNTRY_TO_CONTINENT[ai.country] : undefined),
      feature_bullets: ai.feature_bullets?.length ? ai.feature_bullets : undefined,
      features_text: ai.features || undefined,
    };
    // Strip undefined so we don't overwrite existing form values with nothing
    const cleaned = Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined));
    const inferred = inferMissingFields(cleaned);

    setForm(p => {
      const next = { ...p, ...inferred };
      // Extra engines
      if (ai.additional_engines?.length) {
        next.additional_engines = ai.additional_engines.map((e: any) => ({
          make: e.make || '', model: e.model || '', type: e.type || '',
          hours: e.hours != null ? String(e.hours) : '',
          horsepower: e.horsepower != null ? String(e.horsepower) : '',
          notes: e.notes || '',
        }));
      } else if (inferred.engine_count && Number(inferred.engine_count) > 0 && !p.additional_engines.length) {
        // AI returned engine count but no detail — pre-populate blank slots for all engines
        const count = Math.min(Number(inferred.engine_count), 4);
        next.additional_engines = Array.from({ length: count }, () => ({
          make: '', model: '', type: '', hours: '', horsepower: '', notes: '',
        }));
      }
      // Generators
      if (ai.generators?.length) {
        next.generators = ai.generators.map((g: any) => ({
          brand: g.brand || '', model: g.model || '',
          hours: g.hours != null ? String(g.hours) : '',
          kw: g.kw != null ? String(g.kw) : '',
          notes: g.notes || '',
        }));
      }
      return next;
    });
  };

  const insertLink = () => {
    const input = descriptionRef.current;
    if (!input) return;

    const selected = form.description.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0).trim();
    const url = prompt('Enter link URL (https://...)');
    if (!url) return;
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const label = selected || prompt('Enter link text') || safeUrl;
    wrapDescriptionSelection(`<a href=\"${safeUrl}\" target=\"_blank\" rel=\"noopener noreferrer\">${label}</a>`);
  };

  // ── Save as Draft (server-side) ────────────────────────────────────────────
  // ── Silent autosave (no redirect, no alert) ─────────────────────────────
  const silentSaveDraft = async () => {
    if (!form.title.trim()) return; // need a title to save
    const token = localStorage.getItem('token');
    if (!token) return;
    if (autosaveState === 'saving') return;
    setAutosaveState('saving');
    try {
      const num = (v: string) => v ? parseFloat(v) : null;
      const int = (v: string) => v ? parseInt(v) : null;
      const payload = {
        title: form.title,
        description: form.description || null,
        price: num(form.price),
        currency: form.currency,
        year: int(form.year),
        make: form.make || null,
        model: form.model || null,
        bin: form.bin || '',
        condition: form.condition,
        status: 'draft',
        allow_cobrokering: form.allow_cobrokering,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        zip_code: form.zip_code || null,
        continent: form.continent || null,
        length_feet: num(form.length_feet),
        beam_feet: num(form.beam_feet),
        draft_feet: num(form.draft_feet),
        boat_type: form.boat_type || null,
        hull_material: form.hull_material || null,
        hull_type: form.hull_type || null,
        cabins: int(form.cabins),
        berths: int(form.berths),
        heads: int(form.heads),
        previous_owners: int(form.previous_owners),
        engine_count: int(form.engine_count),
        fuel_type: form.fuel_type || null,
        max_speed_knots: num(form.max_speed_knots),
        cruising_speed_knots: num(form.cruising_speed_knots),
        fuel_capacity_gallons: num(form.fuel_capacity_gallons),
        water_capacity_gallons: num(form.water_capacity_gallons),
        additional_specs: {
          displacement_lbs: num(form.displacement_lbs),
          dry_weight_lbs: num(form.dry_weight_lbs),
          bridge_clearance_feet: num(form.bridge_clearance_feet),
          deadrise_degrees: num(form.deadrise_degrees),
          cruising_range_nm: num(form.cruising_range_nm),
          fuel_burn_gph: num(form.fuel_burn_gph),
          holding_tank_gallons: num(form.holding_tank_gallons),
        },
        feature_bullets: deriveFeatureBullets(form),
        features: [
          ...deriveFeatureBullets(form).map(b => `- ${b}`),
          form.features_text.trim() ? `\n${form.features_text.trim()}` : '',
        ].filter(Boolean).join('\n'),
        additional_engines: form.additional_engines
          .map(e => ({ make: e.make || null, model: e.model || null, type: e.type || null, hours: num(e.hours), horsepower: num(e.horsepower), notes: e.notes || null }))
          .filter(e => Object.values(e).some(v => v !== null && v !== '')),
        generators: form.generators
          .map(g => ({ brand: g.brand || null, model: g.model || null, hours: num(g.hours), kw: num(g.kw), notes: g.notes || null }))
          .filter(g => Object.values(g).some(v => v !== null && v !== '')),
      };

      // In create mode: POST once, then PUT to the same draft ID from then on.
      const existingId = isEditMode ? Number(listingId) : savedDraftIdRef.current;
      const endpoint = existingId ? `${API_ROOT}/listings/${existingId}` : `${API_ROOT}/listings/`;
      const method = existingId ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setAutosaveState('idle');
        return;
      }
      const result = await res.json();
      if (!existingId && result.id) {
        savedDraftIdRef.current = result.id;
        // Silently update URL to edit route so page refreshes land on the right draft
        window.history.replaceState(null, '', `/dealer/listings/${result.id}/edit`);
      }
      if (typeof window !== 'undefined') localStorage.removeItem(draftStorageKey);
      setAutosaveState('saved');
      setLastSavedAt(new Date());
      window.setTimeout(() => setAutosaveState('idle'), 2000);
    } catch {
      setAutosaveState('idle');
    }
  };

  // Debounced autosave: fires 3 s after the user stops editing
  useEffect(() => {
    if (!hasListingAccess) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { silentSaveDraft(); }, 3000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, hasListingAccess]);

  const saveAsDraft = async () => {
    if (!form.title.trim()) {
      alert('Please enter a title before saving your draft.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    setAutosaveState('saving');
    try {
      const num = (v: string) => v ? parseFloat(v) : null;
      const int = (v: string) => v ? parseInt(v) : null;
      const payload = {
        title:           form.title,
        description:     form.description || null,
        price:           num(form.price),
        currency:        form.currency,
        year:            int(form.year),
        make:            form.make     || null,
        model:           form.model    || null,
        bin:             form.bin      || '',
        condition:       form.condition,
        status:          'draft',
        allow_cobrokering: form.allow_cobrokering,
        city:            form.city     || null,
        state:           form.state    || null,
        country:         form.country  || null,
        zip_code:        form.zip_code || null,
        continent:       form.continent || null,
        length_feet:     num(form.length_feet),
        beam_feet:       num(form.beam_feet),
        draft_feet:      num(form.draft_feet),
        boat_type:       form.boat_type       || null,
        hull_material:   form.hull_material   || null,
        hull_type:       form.hull_type       || null,
        cabins:          int(form.cabins),
        berths:          int(form.berths),
        heads:           int(form.heads),
        previous_owners: int(form.previous_owners),
        engine_count:    int(form.engine_count),
        fuel_type:       form.fuel_type    || null,
        max_speed_knots: num(form.max_speed_knots),
        cruising_speed_knots: num(form.cruising_speed_knots),
        fuel_capacity_gallons:  num(form.fuel_capacity_gallons),
        water_capacity_gallons: num(form.water_capacity_gallons),
        additional_specs: {
          displacement_lbs:      num(form.displacement_lbs),
          dry_weight_lbs:        num(form.dry_weight_lbs),
          bridge_clearance_feet: num(form.bridge_clearance_feet),
          deadrise_degrees:      num(form.deadrise_degrees),
          cruising_range_nm:     num(form.cruising_range_nm),
          fuel_burn_gph:         num(form.fuel_burn_gph),
          holding_tank_gallons:  num(form.holding_tank_gallons),
        },
        feature_bullets: deriveFeatureBullets(form),
        features: [
          ...deriveFeatureBullets(form).map(b => `- ${b}`),
          form.features_text.trim() ? `\n${form.features_text.trim()}` : '',
        ].filter(Boolean).join('\n'),
        additional_engines: form.additional_engines
          .map(e => ({ make: e.make || null, model: e.model || null, type: e.type || null, hours: num(e.hours), horsepower: num(e.horsepower), notes: e.notes || null }))
          .filter(e => Object.values(e).some(v => v !== null && v !== '')),
        generators: form.generators
          .map(g => ({ brand: g.brand || null, model: g.model || null, hours: num(g.hours), kw: num(g.kw), notes: g.notes || null }))
          .filter(g => Object.values(g).some(v => v !== null && v !== '')),
      };

      const endpoint = isEditMode ? `${API_ROOT}/listings/${listingId}` : `${API_ROOT}/listings/`;
      const res = await fetch(endpoint, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Failed to save draft'); }
      const result = await res.json();
      const resolvedId = isEditMode ? Number(listingId) : result.id;

      // Attach any already-uploaded media
      const mediaIds = uploadedMedia.map(m => m?.id).filter(Boolean);
      if (mediaIds.length > 0) {
        await fetch(`${API_ROOT}/listings/${resolvedId}/media/attach`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_ids: mediaIds }),
        });
      }

      if (typeof window !== 'undefined') localStorage.removeItem(draftStorageKey);
      if (!isEditMode) {
        // Redirect to edit so further saves use PUT
        router.push(`/dealer/listings/${resolvedId}/edit`);
      } else {
        setAutosaveState('saved');
        setLastSavedAt(new Date());
        window.setTimeout(() => setAutosaveState('idle'), 2000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save draft');
      setAutosaveState('idle');
    }
  };

  // ── Tab completion indicators ──────────────────────────────────────────────
  const tabComplete: Record<Tab, boolean> = {
    basic:  !!(form.title && form.price && form.year && form.bin),
    specs:  !!(form.length_feet),
    engine: true, // optional
    media:  uploadedMedia.length > 0,
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent | null, statusOverride?: 'draft' | 'active') {
    e?.preventDefault();
    const submitStatus = statusOverride ?? (form.status as 'draft' | 'active') ?? 'active';
    const isDraft = submitStatus === 'draft';

    if (!isDraft) {
      if (!isEditMode && uploadedMedia.length === 0) {
        alert('Please upload at least one image');
        setActiveTab('media');
        return;
      }
      if (!form.boat_type) {
        alert('Please select a Boat Type in the Specifications tab');
        setActiveTab('specs');
        return;
      }
      if (propulsion !== 'sail' && !form.fuel_type) {
        alert('Please select a Fuel Type in the Engine tab');
        setActiveTab('engine');
        return;
      }
      if (!form.hull_material) {
        alert('Please select a Hull Material in the Specifications tab');
        setActiveTab('specs');
        return;
      }
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }

      // Helper: parse or null
      const num  = (v: string) => v ? parseFloat(v)  : null;
      const int  = (v: string) => v ? parseInt(v)     : null;

      const payload = {
        title:           form.title,
        description:     form.description || null,
        price:           num(form.price),
        currency:        form.currency,
        year:            int(form.year),
        make:            form.make     || null,
        model:           form.model    || null,
        bin:             form.bin,
        condition:       form.condition,
        status:          submitStatus,
        allow_cobrokering: form.allow_cobrokering,
        // Location
        city:            form.city     || null,
        state:           form.state    || null,
        country:         form.country  || 'USA',
        zip_code:        form.zip_code || null,
        continent:       form.continent || null,
        // Specs
        length_feet:     num(form.length_feet),
        beam_feet:       num(form.beam_feet),
        draft_feet:      num(form.draft_feet),
        boat_type:       form.boat_type       || null,
        hull_material:   form.hull_material   || null,
        hull_type:       form.hull_type       || null,
        cabins:          int(form.cabins),
        berths:          int(form.berths),
        heads:           int(form.heads),
        previous_owners: int(form.previous_owners),
        // Engine
        engine_count:    int(form.engine_count),
        fuel_type:       form.fuel_type    || null,
        max_speed_knots: num(form.max_speed_knots),
        cruising_speed_knots: num(form.cruising_speed_knots),
        fuel_capacity_gallons:  num(form.fuel_capacity_gallons),
        water_capacity_gallons: num(form.water_capacity_gallons),
        additional_specs: {
          displacement_lbs: num(form.displacement_lbs),
          dry_weight_lbs: num(form.dry_weight_lbs),
          bridge_clearance_feet: num(form.bridge_clearance_feet),
          deadrise_degrees: num(form.deadrise_degrees),
          cruising_range_nm: num(form.cruising_range_nm),
          fuel_burn_gph: num(form.fuel_burn_gph),
          holding_tank_gallons: num(form.holding_tank_gallons),
        },
        // Features / structured details
        feature_bullets: deriveFeatureBullets(form),
        features: [
          ...deriveFeatureBullets(form).map(b => `- ${b}`),
          form.features_text.trim() ? `\n${form.features_text.trim()}` : '',
        ].filter(Boolean).join('\n'),
        additional_engines: form.additional_engines
          .map(engine => ({
            make: engine.make || null,
            model: engine.model || null,
            type: engine.type || null,
            hours: num(engine.hours),
            horsepower: num(engine.horsepower),
            notes: engine.notes || null,
          }))
          .filter(engine => Object.values(engine).some(v => v !== null && v !== '')),
        generators: form.generators
          .map(generator => ({
            brand: generator.brand || null,
            model: generator.model || null,
            hours: num(generator.hours),
            kw: num(generator.kw),
            notes: generator.notes || null,
          }))
          .filter(generator => Object.values(generator).some(v => v !== null && v !== '')),
      };

      const endpoint = isEditMode ? `${API_ROOT}/listings/${listingId}` : `${API_ROOT}/listings/`;
      const res = await fetch(endpoint, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Failed to create listing'); }
      const result = await res.json();
      const resolvedListingId = isEditMode ? Number(listingId) : result.id;

      // Attach media (images/videos/pdfs). PDFs are ordered last by backend.
      const mediaIds = uploadedMedia.map(m => m?.id).filter(Boolean);
      if (mediaIds.length > 0) {
        await fetch(`${API_ROOT}/listings/${resolvedListingId}/media/attach`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_ids: mediaIds }),
        });
      }

      if (typeof window !== 'undefined') localStorage.removeItem(draftStorageKey);
      router.push(`/listings/${resolvedListingId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  }

  // ── Input class ────────────────────────────────────────────────────────────
  const inp = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] focus:border-transparent transition';
  const lbl = 'block text-sm font-medium mb-1.5' as const;

  if (accessChecking || initializing) {
    return (
      <div className="min-h-screen py-8 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            Loading listing…
          </div>
        </div>
      </div>
    );
  }

  if (!hasListingAccess) {
    return null;
  }

  return (
    <div className="min-h-screen py-8 bg-white">
      <ScraperModal
        isOpen={showScraperModal}
        onClose={() => setShowScraperModal(false)}
        onDataExtracted={applyExtractedListingData}
        userId={0}
      />
      <div className="max-w-5xl mx-auto px-4">
        {/* Back button */}
        {!isEditMode && (
          <Link
            href="/listings/add"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-secondary transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            Back to Add a Listing
          </Link>
        )}
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>

          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 28, fontWeight: 600, color: '#10214F', marginBottom: 4 }}>
                {isEditMode ? 'Edit Listing' : 'Create New Listing'}
              </h1>
              <p className="text-sm" style={{ color: 'rgba(16,33,79,0.5)' }}>
                {isEditMode ? 'Update vessel details and media' : 'Fill in the details of your vessel'}
              </p>
            </div>
            {!isEditMode && (
              <button
                type="button"
                onClick={() => setShowScraperModal(true)}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: '#01BBDC' }}
              >
                <span>✨</span> AI Listing Assistant
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mb-6 text-xs" style={{ color: 'rgba(16,33,79,0.6)' }}>
            <span>
              {autosaveState === 'saving'
                ? 'Saving…'
                : autosaveState === 'saved'
                  ? 'Draft saved ✓'
                  : lastSavedAt
                    ? `Last saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : form.title.trim() ? 'Unsaved changes' : 'Start typing to autosave'}
            </span>
            <button type="button" onClick={saveAsDraft} disabled={autosaveState === 'saving'} className="px-3 py-1.5 rounded-md text-white disabled:opacity-60" style={{ background: '#10214F' }}>
              {autosaveState === 'saving' ? 'Saving…' : 'Save Draft'}
            </button>
          </div>

          {/* Tab strip */}
          <div className="border-b mb-8" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <div className="flex gap-0.5">
              {TABS.map(tab => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-[#01BBDC] text-[#01BBDC]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {TAB_LABELS[tab]}
                  {tabComplete[tab] && <span className="ml-1.5 text-green-500 text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={e => handleSubmit(e)}>

            {/* ─── BASIC INFO ─────────────────────────────────────────────── */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div>
                  <label className={lbl} style={{ color: '#10214F' }}>Title *</label>
                  <input name="title" value={form.title} onChange={set} required
                    className={inp} placeholder="e.g. 2021 Sunseeker 65 Sport Yacht" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Make *</label>
                    <input name="make" value={form.make} onChange={set} required className={inp} placeholder="Sunseeker" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Model *</label>
                    <input name="model" value={form.model} onChange={set} required className={inp} placeholder="65 Sport Yacht" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Year *</label>
                    <input name="year" type="number" value={form.year} onChange={set} required
                      min="1900" max={new Date().getFullYear() + 1} className={inp} placeholder="2021" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Price *</label>
                    <input name="price" type="number" value={form.price} onChange={set} required
                      min="0" step="1000" className={inp} placeholder="500000" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Currency</label>
                    <select name="currency" value={form.currency} onChange={set} className={inp}>
                      {['USD', 'EUR', 'GBP', 'AUD', 'CAD'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Condition</label>
                    <select name="condition" value={form.condition} onChange={set} className={inp}>
                      <option value="new">New</option>
                      <option value="used">Used</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>BIN (Boat ID Number) *</label>
                    <input name="bin" value={form.bin} onChange={set} required className={inp} placeholder="US-ABC12345K617" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Previous Owners</label>
                    <input name="previous_owners" type="number" value={form.previous_owners} onChange={set}
                      min="0" className={inp} placeholder="1" />
                  </div>
                </div>

                <div>
                  <label className={lbl} style={{ color: '#10214F' }}>Description *</label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" title="Heading" onClick={() => wrapDescriptionSelection('<h2>', '</h2>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Heading2 size={14} /></button>
                      <button type="button" title="Subheading" onClick={() => wrapDescriptionSelection('<h3>', '</h3>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Heading3 size={14} /></button>
                      <button type="button" title="Bold" onClick={() => wrapDescriptionSelection('<strong>', '</strong>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Bold size={14} /></button>
                      <button type="button" title="Italic" onClick={() => wrapDescriptionSelection('<em>', '</em>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Italic size={14} /></button>
                      <button type="button" title="Underline" onClick={() => wrapDescriptionSelection('<u>', '</u>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Underline size={14} /></button>
                      <button type="button" title="Highlight" onClick={() => wrapDescriptionSelection('<mark>', '</mark>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Highlighter size={14} /></button>
                      <button type="button" title="Link" onClick={insertLink} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Link2 size={14} /></button>
                      <button type="button" title="Bulleted list" onClick={() => wrapDescriptionSelection('<ul>\n  <li>', '</li>\n</ul>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><List size={14} /></button>
                      <button type="button" title="Numbered list" onClick={() => wrapDescriptionSelection('<ol>\n  <li>', '</li>\n</ol>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><ListOrdered size={14} /></button>
                      <button type="button" title="Quote" onClick={() => wrapDescriptionSelection('<blockquote>', '</blockquote>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Quote size={14} /></button>
                      <button type="button" title="Paragraph" onClick={() => wrapDescriptionSelection('<p>', '</p>')} className="p-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"><Pilcrow size={14} /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button type="button" onClick={aiGenerateDescription} title="Generates a boilerplate description template using the specs, location, and feature bullets you've already entered" className="px-3 py-1.5 text-xs rounded-md text-white" style={{ background: '#01BBDC' }}>Draft from Specs</button>
                      <button type="button" onClick={aiPolishDescription} title="Collapses extra whitespace and fixes line breaks in the current description" className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50">Fix Spacing</button>
                      <span className="text-xs text-gray-400">Builds from fields you've already filled in</span>
                    </div>
                    <textarea
                      ref={descriptionRef}
                      name="description"
                      value={form.description}
                      onChange={set}
                      required
                      rows={10}
                      className={inp}
                      placeholder="Use plain text or HTML (h2, h3, p, ul, li, strong, em, mark)…"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>City *</label>
                    <input name="city" value={form.city} onChange={set} required className={inp} placeholder="Miami" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>State / Province</label>
                    {STATES_BY_COUNTRY[form.country] ? (
                      <select name="state" value={form.state} onChange={(e) => { setForm(f => ({ ...f, state: e.target.value })); }} className={inp}>
                        <option value="">Select…</option>
                        {STATES_BY_COUNTRY[form.country].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <input name="state" value={form.state} onChange={set} className={inp} placeholder="State / Province" />
                    )}
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Zip / Post</label>
                    <input name="zip_code" value={form.zip_code} onChange={set} className={inp} placeholder="33101" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Country *</label>
                    <select name="country" value={form.country} onChange={(e) => { const c = e.target.value; setForm(f => ({ ...f, country: c, state: '', continent: COUNTRY_TO_CONTINENT[c] || f.continent })); }} required className={inp}>
                      <option value="">Select…</option>
                      {COUNTRIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={lbl} style={{ color: '#10214F' }}>Continent</label>
                  <select name="continent" value={form.continent} onChange={set} className={inp}>
                    <option value="">Select…</option>
                    {['North America','South America','Europe','Caribbean','Mediterranean','Asia Pacific','Middle East','Africa'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Co-Brokering opt-out — only shown when dealer has account-level co-brokering ON */}
                {dealerCobrokingEnabled && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#10214F' }}>Co-Brokering for this listing</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          When enabled, this listing is accessible to other licensed brokers via the platform API.
                          Turn off to keep this listing private to your brokerage only.
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setForm(p => ({ ...p, allow_cobrokering: !p.allow_cobrokering }))}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${
                            form.allow_cobrokering ? 'bg-[#01BBDC]' : 'bg-gray-300'
                          }`}
                          aria-pressed={form.allow_cobrokering}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                              form.allow_cobrokering ? 'translate-x-8' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className={`text-xs font-semibold ${form.allow_cobrokering ? 'text-[#01BBDC]' : 'text-gray-400'}`}>
                          {form.allow_cobrokering ? 'Allowed' : 'Opted out'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── SPECIFICATIONS ─────────────────────────────────────────── */}
            {activeTab === 'specs' && (
              <div className="space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#01BBDC' }}>Dimensions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Length (feet) *</label>
                    <input name="length_feet" type="number" value={form.length_feet} onChange={set} required
                      min="0" step="0.1" className={inp} placeholder="65.0" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Beam (feet)</label>
                    <input name="beam_feet" type="number" value={form.beam_feet} onChange={set}
                      min="0" step="0.1" className={inp} placeholder="18.5" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Draft (feet)</label>
                    <input name="draft_feet" type="number" value={form.draft_feet} onChange={set}
                      min="0" step="0.1" className={inp} placeholder="5.2" />
                  </div>
                </div>

                <h3 className="text-sm font-semibold uppercase tracking-wide pt-2" style={{ color: '#01BBDC' }}>Hull</h3>

                {/* Power / Sail toggle — filters boat type options */}
                <div className="flex gap-2 mb-1">
                  {['power', 'sail'].map((p) => (
                    <button key={p} type="button"
                      onClick={() => {
                        setPropulsion(p);
                        // Clear boat_type if it no longer belongs to the new category
                        if (p === 'power' && SAIL_BOAT_TYPES.includes(form.boat_type)) setForm(f => ({ ...f, boat_type: '' }));
                        if (p === 'sail' && POWER_BOAT_TYPES.includes(form.boat_type)) setForm(f => ({ ...f, boat_type: '' }));
                      }}
                      className="px-3 py-1 rounded-full text-xs font-semibold transition-all border"
                      style={{
                        backgroundColor: propulsion === p ? '#01BBDC' : 'transparent',
                        color: propulsion === p ? '#fff' : '#10214F',
                        borderColor: propulsion === p ? '#01BBDC' : 'rgba(16,33,79,0.2)',
                      }}>
                      {p === 'power' ? 'Power' : 'Sail'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Boat Type <span style={{ color: '#e53e3e' }}>*</span></label>
                    <select name="boat_type" value={form.boat_type} onChange={(e) => {
                      set(e);
                      setPropulsion(derivePropulsion(e.target.value));
                    }} className={inp} required>
                      <option value="">Select…</option>
                      {(propulsion === 'power' ? POWER_BOAT_TYPES : propulsion === 'sail' ? SAIL_BOAT_TYPES : ALL_BOAT_TYPES).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Hull Material <span style={{ color: '#e53e3e' }}>*</span></label>
                    <select name="hull_material" value={form.hull_material} onChange={set} className={inp} required>
                      <option value="">Select…</option>
                      {['Fiberglass', 'Aluminum', 'Steel', 'Wood', 'Carbon Fiber', 'Composite', 'Other'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Hull Shape</label>
                    <select name="hull_type" value={form.hull_type} onChange={set} className={inp}>
                      <option value="">Select…</option>
                      {['Monohull','Catamaran','Trimaran','Semi-Displacement','Planing','Displacement'].map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <h3 className="text-sm font-semibold uppercase tracking-wide pt-2" style={{ color: '#01BBDC' }}>Accommodation</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Cabins</label>
                    <input name="cabins" type="number" value={form.cabins} onChange={set} min="0" className={inp} placeholder="3" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Berths / Guests</label>
                    <input name="berths" type="number" value={form.berths} onChange={set} min="0" className={inp} placeholder="6" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Heads (Bathrooms)</label>
                    <input name="heads" type="number" value={form.heads} onChange={set} min="0" className={inp} placeholder="3" />
                  </div>
                </div>

                <h3 className="text-sm font-semibold uppercase tracking-wide pt-2" style={{ color: '#01BBDC' }}>Feature Bullets</h3>
                <p className="text-xs -mt-3" style={{ color: 'rgba(16,33,79,0.5)' }}>
                  These appear beneath Key Specifications on the public listing page.
                </p>
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={aiGenerateFeatureBullets}
                        title="Derives highlight bullets from the specs you've filled in (engine count, hull, dimensions, etc.)"
                        className="px-3 py-1.5 text-xs rounded-md text-white"
                        style={{ background: '#01BBDC' }}>
                        Auto-Fill Bullets
                      </button>
                      <button
                        type="button"
                        onClick={aiGenerateFeaturesText}
                        title="Compiles your entered specs into a plain-text features summary"
                        className="px-3 py-1.5 text-xs rounded-md text-white"
                        style={{ background: '#10214F' }}>
                        Build Features Summary
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 -mt-1">Bullets = short highlights shown beneath key specs. Features = expanded specs/equipment text shown in the full details section. Both buttons derive content from fields you've already filled in — no external AI.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {form.feature_bullets.map((bullet, index) => (
                      <input
                        key={index}
                        value={bullet}
                        onChange={e => setFeatureBullet(index, e.target.value)}
                        className={inp}
                        placeholder={`Feature bullet ${index + 1}`}
                      />
                    ))}
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Extended Features / Equipment Notes</label>
                    <textarea
                      name="features_text"
                      value={form.features_text}
                      onChange={set}
                      rows={5}
                      className={inp}
                      placeholder="Optional extra features and equipment details shown in the full Features section"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── ENGINE & VIDEOS ─────────────────────────────────────────── */}
            {activeTab === 'engine' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Engine Count</label>
                    <input name="engine_count" type="number" value={form.engine_count} onChange={set} min="1" className={inp} placeholder="2" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Fuel Type {propulsion !== 'sail' && <span style={{ color: '#e53e3e' }}>*</span>}</label>
                    <select name="fuel_type" value={form.fuel_type} onChange={set} className={inp} required={propulsion !== 'sail'}>
                      <option value="">Select…</option>
                      {['Diesel', 'Gasoline', 'Electric', 'Hybrid', 'Other'].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <h3 className="text-sm font-semibold uppercase tracking-wide pt-2" style={{ color: '#01BBDC' }}>Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Max Speed (knots)</label>
                    <input name="max_speed_knots" type="number" value={form.max_speed_knots} onChange={set} step="0.1" className={inp} placeholder="28" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Cruise Speed (knots)</label>
                    <input name="cruising_speed_knots" type="number" value={form.cruising_speed_knots} onChange={set} step="0.1" className={inp} placeholder="22" />
                  </div>
                </div>

                <h3 className="text-sm font-semibold uppercase tracking-wide pt-2" style={{ color: '#01BBDC' }}>Capacities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Fuel Tank (gallons)</label>
                    <input name="fuel_capacity_gallons" type="number" value={form.fuel_capacity_gallons} onChange={set} step="1" className={inp} placeholder="2500" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Fresh Water (gallons)</label>
                    <input name="water_capacity_gallons" type="number" value={form.water_capacity_gallons} onChange={set} step="1" className={inp} placeholder="800" />
                  </div>
                </div>

                <h3 className="text-sm font-semibold uppercase tracking-wide pt-2" style={{ color: '#01BBDC' }}>Additional Specs</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Displacement (lbs)</label>
                    <input name="displacement_lbs" type="number" value={form.displacement_lbs} onChange={set} className={inp} placeholder="72000" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Dry Weight (lbs)</label>
                    <input name="dry_weight_lbs" type="number" value={form.dry_weight_lbs} onChange={set} className={inp} placeholder="64000" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Bridge Clearance (ft)</label>
                    <input name="bridge_clearance_feet" type="number" step="0.1" value={form.bridge_clearance_feet} onChange={set} className={inp} placeholder="19.8" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Deadrise (°)</label>
                    <input name="deadrise_degrees" type="number" step="0.1" value={form.deadrise_degrees} onChange={set} className={inp} placeholder="17" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Cruising Range (nm)</label>
                    <input name="cruising_range_nm" type="number" step="1" value={form.cruising_range_nm} onChange={set} className={inp} placeholder="300" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Fuel Burn (gph)</label>
                    <input name="fuel_burn_gph" type="number" step="0.1" value={form.fuel_burn_gph} onChange={set} className={inp} placeholder="56" />
                  </div>
                  <div>
                    <label className={lbl} style={{ color: '#10214F' }}>Holding Tank (gal)</label>
                    <input name="holding_tank_gallons" type="number" step="1" value={form.holding_tank_gallons} onChange={set} className={inp} placeholder="160" />
                  </div>
                </div>

                <h3 className="text-sm font-semibold uppercase tracking-wide pt-2" style={{ color: '#01BBDC' }}>Motors</h3>
                <div className="space-y-4">
                  {form.additional_engines.map((engine, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold" style={{ color: '#10214F' }}>Motor {index + 1}</p>
                        <button type="button" onClick={() => removeExtraEngine(index)} className="text-xs text-red-500 hover:text-red-600">Delete</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input value={engine.make} onChange={e => setExtraEngine(index, 'make', e.target.value)} className={inp} placeholder="Make" />
                        <input value={engine.model} onChange={e => setExtraEngine(index, 'model', e.target.value)} className={inp} placeholder="Model" />
                        <input value={engine.type} onChange={e => setExtraEngine(index, 'type', e.target.value)} className={inp} placeholder="Type" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={engine.hours} onChange={e => setExtraEngine(index, 'hours', e.target.value)} type="number" className={inp} placeholder="Hours" />
                        <input value={engine.horsepower} onChange={e => setExtraEngine(index, 'horsepower', e.target.value)} type="number" className={inp} placeholder="Horsepower" />
                      </div>
                      <textarea value={engine.notes} onChange={e => setExtraEngine(index, 'notes', e.target.value)} rows={3} className={inp} placeholder="Notes" />
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={addExtraEngine} disabled={form.additional_engines.length >= 3} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">+ Add Motor</button>
                    {form.additional_engines.length >= 3 && (
                      <p className="text-xs text-gray-500">Max 4 engines supported (primary + 3 extras)</p>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-semibold uppercase tracking-wide pt-2" style={{ color: '#01BBDC' }}>Generators</h3>
                <div className="space-y-4">
                  {form.generators.map((generator, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold" style={{ color: '#10214F' }}>Generator {index + 1}</p>
                        <button type="button" onClick={() => removeGenerator(index)} className="text-xs text-red-500 hover:text-red-600">Delete</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={generator.brand} onChange={e => setGenerator(index, 'brand', e.target.value)} className={inp} placeholder="Brand" />
                        <input value={generator.model} onChange={e => setGenerator(index, 'model', e.target.value)} className={inp} placeholder="Model" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={generator.hours} onChange={e => setGenerator(index, 'hours', e.target.value)} type="number" className={inp} placeholder="Hours" />
                        <input value={generator.kw} onChange={e => setGenerator(index, 'kw', e.target.value)} type="number" className={inp} placeholder="kW" />
                      </div>
                      <textarea value={generator.notes} onChange={e => setGenerator(index, 'notes', e.target.value)} rows={3} className={inp} placeholder="Notes" />
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={addGenerator} disabled={form.generators.length >= 2} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">+ Add Generator</button>
                    {form.generators.length === 0 && (
                      <p className="text-xs text-gray-400">No generators added</p>
                    )}
                    {form.generators.length >= 2 && (
                      <p className="text-xs text-gray-500">Max 2 generators supported</p>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ─── MEDIA ──────────────────────────────────────────────────── */}
            {activeTab === 'media' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <MediaUpload
                      onUploadComplete={(m: any[]) => setUploadedMedia(p => [...p, ...m])}
                      maxFiles={20}
                      maxFileSize={50}
                      acceptImages
                      acceptVideos
                      acceptDocuments
                      showAltText={false}
                      showCaption={false}
                    />
                  </div>
                </div>

                <div className="text-center -mt-2">
                  <span className="text-xs text-gray-400">— or —</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLibraryPicker(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-[#01BBDC]/40 rounded-xl text-sm font-medium hover:border-[#01BBDC] hover:bg-cyan-50 transition"
                  style={{ color: '#01BBDC' }}
                >
                  Choose from Media Library
                </button>

                {showLibraryPicker && (
                  <MediaLibraryPicker
                    multiple
                    accept="all"
                    onSelect={picked => {
                      setUploadedMedia(prev => {
                        const existingIds = new Set(prev.map((m: any) => m.id));
                        return [...prev, ...picked.filter(p => !existingIds.has(p.id))];
                      });
                    }}
                    onClose={() => setShowLibraryPicker(false)}
                  />
                )}

                {uploadedMedia.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium" style={{ color: '#10214F' }}>
                        Photos & Media ({uploadedMedia.length})
                      </h3>
                      <p className="text-xs text-gray-400">Drag to reorder · First image is the primary photo</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {uploadedMedia.map((m, i) => {
                        const isImg = !m.file_type || m.file_type === 'image';
                        const isVideo = m.file_type === 'video';
                        const isPrimary = i === 0 && isImg;
                        return (
                          <div
                            key={m.id ?? i}
                            draggable
                            onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                            onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                            onDragLeave={() => setDragOverIdx(null)}
                            onDrop={e => {
                              e.preventDefault();
                              const from = Number(e.dataTransfer.getData('text/plain'));
                              if (from !== i) moveMedia(from, i);
                              setDragOverIdx(null);
                            }}
                            onDragEnd={() => setDragOverIdx(null)}
                            className={`relative group rounded-xl overflow-hidden border-2 transition cursor-grab active:cursor-grabbing ${
                              dragOverIdx === i ? 'border-[#01BBDC] scale-[1.02]' : isPrimary ? 'border-[#01BBDC]' : 'border-transparent'
                            }`}
                          >
                            {isImg ? (
                              <img
                                src={mediaUrl(m.url || m.thumbnail_url)}
                                alt={`Media ${i + 1}`}
                                className="w-full h-28 object-cover"
                              />
                            ) : isVideo ? (
                              <div className="w-full h-28 bg-gray-100 flex flex-col items-center justify-center gap-1">
                                <Film size={24} className="text-gray-400" />
                                <span className="text-xs text-gray-500 truncate max-w-[90%]">{m.url?.split('/').pop()}</span>
                              </div>
                            ) : (
                              <div className="w-full h-28 bg-gray-100 flex flex-col items-center justify-center gap-1">
                                <FileText size={24} className="text-gray-400" />
                                <span className="text-xs text-gray-500 truncate max-w-[90%]">{m.url?.split('/').pop()}</span>
                              </div>
                            )}

                            {/* Primary badge */}
                            {isPrimary && (
                              <span className="absolute top-1.5 left-1.5 bg-[#01BBDC] text-white text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                                <Star size={10} fill="white" /> Primary
                              </span>
                            )}

                            {/* Drag handle */}
                            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition">
                              <GripVertical size={16} className="text-white drop-shadow" />
                            </div>

                            {/* Set Primary button (images only, not already primary) */}
                            {isImg && !isPrimary && (
                              <button
                                type="button"
                                onClick={() => setPrimaryMedia(i)}
                                title="Set as primary photo"
                                className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition bg-black/60 hover:bg-[#01BBDC] text-white rounded px-1.5 py-0.5 text-[10px] flex items-center gap-0.5"
                              >
                                <Star size={10} /> Set Primary
                              </button>
                            )}

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => setUploadedMedia(p => p.filter((_, j) => j !== i))}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Navigation ─────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-8 mt-8 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              {activeTab !== 'basic' && (
                <button type="button"
                  onClick={() => setActiveTab(TABS[TABS.indexOf(activeTab) - 1])}
                  className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  ← Previous
                </button>
              )}
              {activeTab !== 'media' ? (
                <button type="button"
                  onClick={() => setActiveTab(TABS[TABS.indexOf(activeTab) + 1])}
                  className="flex-1 px-6 py-3 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition"
                  style={{ background: '#01BBDC' }}>
                  Next →
                </button>
              ) : isEditMode ? (
                <button type="submit" disabled={loading}
                  className="flex-1 px-6 py-3 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  style={{ background: '#10214F' }}>
                  {loading ? 'Saving changes…' : 'Save Changes'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSubmit(null, 'draft')}
                    className="flex-1 px-6 py-3 rounded-xl text-sm font-semibold border-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    style={{ borderColor: '#10214F', color: '#10214F' }}>
                    {loading ? 'Saving…' : 'Save as Draft'}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSubmit(null, 'active')}
                    className="flex-1 px-6 py-3 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    style={{ background: '#01BBDC' }}>
                    {loading ? 'Publishing…' : 'Publish Listing'}
                  </button>
                </>
              )}
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

export default function CreateListing() {
  return <ListingEditorPage mode="create" />;
}