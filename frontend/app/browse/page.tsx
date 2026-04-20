'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Sparkles, Save, X, AlertTriangle, ChevronDown,
  SlidersHorizontal, MapPin, ChevronLeft, ChevronRight,
} from 'lucide-react';
import ListingCard from '../components/ListingCard';
import { apiUrl } from '@/app/lib/apiRoot';
import { COUNTRIES, STATES_BY_COUNTRY } from '@/app/lib/locationData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: number;
  title: string;
  price: number;
  currency: string;
  year: number;
  make: string;
  model: string;
  length_feet: number;
  boat_type: string;
  city: string;
  state: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  cabins?: number;
  images: Array<{ url: string } | string>;
  condition: string;
  featured: boolean;
  match_score?: number;
  match_reasons?: string[];
  warnings?: string[];
  dealer?: {
    name?: string;
    company_name?: string;
    slug?: string;
    logo_url?: string;
    photo?: string;
  };
}

// ─── Filter pill state ────────────────────────────────────────────────────────

const EMPTY_FILTERS = {
  search: '',
  boat_type: '',
  make: '',
  model: '',
  propulsion: '',
  min_price: '',
  max_price: '',
  min_length: '',
  max_length: '',
  min_year: '',
  max_year: '',
  state: '',
  city: '',
  condition: '',
  fuel: '',
  hull_material: '',
  engine: '',
  brokerage: '',
  country: '',
};

const POWER_TYPES = ['Motor Yacht', 'Mega Yacht', 'Superyacht', 'Trawler', 'Express Cruiser', 'Sport Fisher', 'Center Console'];
const SAIL_TYPES  = ['Sailing Yacht', 'Catamaran', 'Sloop', 'Ketch', 'Schooner', 'Motorsailer'];
const CURRENCIES  = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD', 'HKD', 'SGD', 'NOK', 'SEK', 'DKK', 'AED', 'BRL', 'MXN'];
const SORT_OPTIONS = [
  { value: 'nearest',    label: 'Nearest first' },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'year_desc',  label: 'Year: Newest first' },
  { value: 'year_asc',   label: 'Year: Oldest first' },
];
const PAGE_SIZE = 32;

// ─── Haversine ───────────────────────────────────────────────────────────────

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Active filter pill component ────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: 'rgba(1,187,220,0.1)',
        color: '#01BBDC',
        border: '1px solid rgba(1,187,220,0.3)',
        fontFamily: 'Poppins, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-[#01BBDC] hover:text-white transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X size={10} />
      </button>
    </span>
  );
}

// ─── Dropdown panel (used by each top-filter button) ─────────────────────────

function FilterDropdown({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
        style={{
          fontFamily: 'Poppins, sans-serif',
          border: active ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.15)',
          backgroundColor: active ? 'rgba(1,187,220,0.06)' : '#FFFFFF',
          color: active ? '#01BBDC' : '#10214F',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(16,33,79,0.12)',
            boxShadow: '0 8px 32px rgba(16,33,79,0.14)',
            minWidth: 220,
          }}
        >
          <div className="p-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Range input pair ─────────────────────────────────────────────────────────

function RangeInputs({
  minVal, maxVal, minPlaceholder, maxPlaceholder,
  onMinChange, onMaxChange,
}: {
  minVal: string; maxVal: string;
  minPlaceholder: string; maxPlaceholder: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={minVal}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder={minPlaceholder}
        className="flex-1 focus:outline-none"
        style={rangeInputStyle}
      />
      <span style={{ color: 'rgba(16,33,79,0.3)', fontSize: 12 }}>–</span>
      <input
        type="number"
        value={maxVal}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder={maxPlaceholder}
        className="flex-1 focus:outline-none"
        style={rangeInputStyle}
      />
    </div>
  );
}

const rangeInputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1.5px solid rgba(16,33,79,0.15)',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'Poppins, sans-serif',
  color: '#10214F',
  backgroundColor: '#FAFAFA',
};

// ─── Small toggle chips ───────────────────────────────────────────────────────

function ToggleChips({
  options, values, value, onChange,
}: {
  options: string[];
  values?: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = value ? value.split(',').filter(Boolean) : [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt, i) => {
        const val = values ? values[i] : opt.toLowerCase();
        const active = selected.includes(val);
        const toggle = () => {
          const next = active ? selected.filter((s) => s !== val) : [...selected, val];
          onChange(next.join(','));
        };
        return (
          <button
            key={val}
            type="button"
            onClick={toggle}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              fontFamily: 'Poppins, sans-serif',
              border: active ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.2)',
              backgroundColor: active ? '#01BBDC' : 'transparent',
              color: active ? '#FFFFFF' : '#10214F',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Searchable scroll list ───────────────────────────────────────────────────

function SearchableList({
  items, value, onChange, placeholder,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const selected = value ? value.split(',').filter(Boolean) : [];
  const filtered = q ? items.filter((it) => it.toLowerCase().includes(q.toLowerCase())) : items;

  return (
    <div>
      <div className="relative mb-2">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder ?? 'Search…'}
          className="w-full focus:outline-none pl-7"
          style={{ ...rangeInputStyle, paddingLeft: 28, fontSize: 12 }}
        />
      </div>
      <div style={{ maxHeight: 180, overflowY: 'auto' }} className="space-y-0.5">
        {filtered.map((item) => {
          const val = item.toLowerCase();
          const active = selected.includes(val) || selected.includes(item);
          const toggle = () => {
            // Try exact match first, fallback to lowercase
            const key = selected.includes(item) ? item : val;
            const next = active
              ? selected.filter((s) => s !== item && s !== val)
              : [...selected, item];
            onChange(next.join(','));
          };
          return (
            <button
              key={item}
              type="button"
              onClick={toggle}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left"
              style={{
                backgroundColor: active ? 'rgba(1,187,220,0.08)' : 'transparent',
                color: active ? '#01BBDC' : '#10214F',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  flexShrink: 0,
                  border: `1.5px solid ${active ? '#01BBDC' : 'rgba(16,33,79,0.3)'}`,
                  backgroundColor: active ? '#01BBDC' : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {active && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {item}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ fontSize: 12, color: 'rgba(16,33,79,0.4)', fontFamily: 'Poppins, sans-serif', padding: '4px 2px' }}>
            No results
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page Content ────────────────────────────────────────────────────────

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState<'basic' | 'ai'>('basic');
  const [aiQuery, setAiQuery] = useState('');
  const [sort, setSort] = useState<string>('nearest');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const isFirstRender = useRef(true);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [filters, setFilters] = useState({ ...EMPTY_FILTERS,
    search:     searchParams.get('search')     || '',
    boat_type:  searchParams.get('boat_type')  || '',
    make:       searchParams.get('make')       || '',
    model:      searchParams.get('model')      || '',
    propulsion: searchParams.get('propulsion') || '',
    min_price:  searchParams.get('min_price')  || '',
    max_price:  searchParams.get('max_price')  || '',
    min_length: searchParams.get('min_length') || '',
    max_length: searchParams.get('max_length') || '',
    min_year:   searchParams.get('min_year')   || '',
    max_year:   searchParams.get('max_year')   || '',
    state:      searchParams.get('state')      || '',
    city:       searchParams.get('city')       || '',
    condition:  searchParams.get('condition')  || '',
    fuel:       searchParams.get('fuel')       || '',
    hull_material: searchParams.get('hull_material') || '',
    engine:     searchParams.get('engine')     || '',
    brokerage:  searchParams.get('brokerage')  || '',
    country:    searchParams.get('country')    || '',
  });

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setAiQuery('');
    setSearchType('basic');
    setPage(0);
  };

  // Currency
  useEffect(() => {
    fetch(apiUrl('/currencies/rates'))
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.rates) setExchangeRates(data.rates); })
      .catch(() => {});
    const saved = localStorage.getItem('preferredCurrency');
    if (saved) setCurrency(saved);
  }, []);

  // Makes
  useEffect(() => {
    fetch(apiUrl('/listings/makes'))
      .then((r) => r.ok ? r.json() : [])
      .then((d: string[]) => setMakes(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Models when make changes
  useEffect(() => {
    if (!filters.make) { setModels([]); return; }
    fetch(apiUrl(`/listings/models?make=${encodeURIComponent(filters.make)}`))
      .then((r) => r.ok ? r.json() : [])
      .then((d: string[]) => setModels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [filters.make]); // eslint-disable-line react-hooks/exhaustive-deps

  // Geolocation
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, []);

  // Fetch
  const fetchListings = useCallback(async (isAI = false, pg = page, sr = sort, ps = pageSize) => {
    // Cancel any in-flight fetch so stale results never overwrite newer ones
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      let url: string;
      if (isAI && aiQuery) {
        url = apiUrl(`/ai/search?query=${encodeURIComponent(aiQuery)}`);
      } else {
        const isNearest = sr === 'nearest';
        const fetchLimit = isNearest ? 2000 : ps;
        const fetchSkip  = isNearest ? 0    : pg * ps;
        url = apiUrl(`/listings?status=active&limit=${fetchLimit}&skip=${fetchSkip}`);
        if (!isNearest) url += `&sort=${sr}`;
        Object.entries(filters).forEach(([k, v]) => {
          if (v) url += `&${k}=${encodeURIComponent(v)}`;
        });
      }
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      if (isAI) {
        const results = (data.results || []).map((r: any) => ({
          ...(r.listing || {}),
          match_score: r.match_score,
          match_reasons: r.match_reasons,
          warnings: r.warnings,
        }));
        setListings(results);
        setTotal(results.length);
      } else {
        const items: Listing[] = data.listings ?? (Array.isArray(data) ? data : []);
        setListings(items);
        setTotal(data.total ?? items.length);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // Ignore cancelled fetches
      setListings([]);
      setTotal(0);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters, aiQuery, page, sort, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchListings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-apply
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const t = setTimeout(() => fetchListings(searchType === 'ai', 0, sort), 400);
    return () => clearTimeout(t);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort + paginate
  const typeOptions =
    filters.propulsion === 'power' ? POWER_TYPES :
    filters.propulsion === 'sail'  ? SAIL_TYPES  :
    [...POWER_TYPES, ...SAIL_TYPES];

  let sorted = [...listings];
  if (sort === 'nearest' && userLat !== null && userLng !== null) {
    sorted.sort((a, b) => {
      const da = (a.latitude && a.longitude) ? haversineMiles(userLat, userLng, a.latitude, a.longitude) : Infinity;
      const db = (b.latitude && b.longitude) ? haversineMiles(userLat, userLng, b.latitude, b.longitude) : Infinity;
      return da - db;
    });
  }

  const featured = sorted.filter((l) => l.featured).slice(0, 4);
  const featuredIds = new Set(featured.map((l) => l.id));
  const regular = sorted.filter((l) => !featuredIds.has(l.id));
  const totalPages = sort === 'nearest'
    ? Math.ceil(regular.length / pageSize)
    : Math.ceil(total / pageSize);
  const paged = sort === 'nearest'
    ? regular.slice(page * pageSize, (page + 1) * pageSize)
    : regular;
  const displayTotal = sort === 'nearest' ? listings.length : total;

  const xr = currency !== 'USD' ? (exchangeRates[currency] ?? 1) : 1;

  const imgUrl = (img: { url: string } | string) => typeof img === 'string' ? img : img.url;

  const hasActiveFilters = Object.values(filters).some((v) => v);

  // Build active filter pills
  const filterPills: { label: string; clear: () => void }[] = [];
  if (filters.search)       filterPills.push({ label: `"${filters.search}"`,        clear: () => handleFilterChange('search', '') });
  if (filters.condition)    filterPills.push({ label: filters.condition,             clear: () => handleFilterChange('condition', '') });
  if (filters.propulsion)   filterPills.push({ label: filters.propulsion,           clear: () => handleFilterChange('propulsion', '') });
  if (filters.boat_type)    filterPills.push({ label: filters.boat_type,            clear: () => handleFilterChange('boat_type', '') });
  if (filters.make)         filterPills.push({ label: filters.make,                 clear: () => handleFilterChange('make', '') });
  if (filters.model)        filterPills.push({ label: filters.model,                clear: () => handleFilterChange('model', '') });
  if (filters.min_price || filters.max_price) filterPills.push({
    label: `$${filters.min_price || '0'} – $${filters.max_price || '∞'}`,
    clear: () => { handleFilterChange('min_price', ''); handleFilterChange('max_price', ''); },
  });
  if (filters.min_length || filters.max_length) filterPills.push({
    label: `${filters.min_length || '0'}–${filters.max_length || '∞'} ft`,
    clear: () => { handleFilterChange('min_length', ''); handleFilterChange('max_length', ''); },
  });
  if (filters.min_year || filters.max_year) filterPills.push({
    label: `${filters.min_year || ''}–${filters.max_year || ''}`,
    clear: () => { handleFilterChange('min_year', ''); handleFilterChange('max_year', ''); },
  });
  if (filters.country)      filterPills.push({ label: filters.country,              clear: () => handleFilterChange('country', '') });
  if (filters.state)        filterPills.push({ label: filters.state,                clear: () => handleFilterChange('state', '') });
  if (filters.city)         filterPills.push({ label: filters.city,                 clear: () => handleFilterChange('city', '') });
  if (filters.fuel)         filterPills.push({ label: `Fuel: ${filters.fuel}`,      clear: () => handleFilterChange('fuel', '') });
  if (filters.hull_material) filterPills.push({ label: filters.hull_material,       clear: () => handleFilterChange('hull_material', '') });

  const handleSaveSearch = async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch(apiUrl('/search-alerts'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Search: ${filters.search || filters.boat_type || 'All Yachts'}`, filters }),
      });
      alert(res.ok ? 'Search saved!' : 'Failed to save search');
    } catch { alert('Failed to save search'); }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F9FC' }}>

      {/* ══════ COMPACT AI SEARCH BAR ══════ */}
      <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid rgba(16,33,79,0.06)' }}>
        <div className="mx-auto" style={{ maxWidth: 1440, padding: '14px 24px' }}>
          {/* Heading — centred */}
          <h2
            className="text-center"
            style={{
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
              fontSize: 'clamp(17px, 1.4vw, 22px)',
              fontWeight: 400,
              color: '#10214F',
              lineHeight: 1.2,
              maxWidth: 960,
              margin: '0 auto 8px auto',
            }}
          >
            Skip the Filters
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); if (aiQuery.trim()) { setPage(0); fetchListings(true, 0, sort); } }}
            className="flex items-center gap-2 mx-auto"
            style={{ maxWidth: 960 }}
            role="search"
            aria-label="AI yacht search"
          >
            <div className="relative flex-1">
              <input
                type="search"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (aiQuery.trim()) { setPage(0); fetchListings(true, 0, sort); } } }}
                placeholder="Describe your ideal yacht — size, lifestyle, budget, cruising plans…"
                className="w-full focus:outline-none"
                style={{
                  height: 40,
                  border: '1.5px solid #E2E8F0',
                  borderRadius: 999,
                  backgroundColor: '#F8FAFC',
                  paddingLeft: 20,
                  paddingRight: 48,
                  fontSize: 13,
                  fontFamily: 'Poppins, sans-serif',
                  color: '#10214F',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
                  <path d="M15 3C15 3 17.25 10.5 22.5 12.75C17.25 15 15 22.5 15 22.5C15 22.5 12.75 15 7.5 12.75C12.75 10.5 15 3 15 3Z" fill="#01BBDC" />
                  <path d="M23.5 17.5C23.5 17.5 24.5 21 26.5 22C24.5 23 23.5 26.5 23.5 26.5C23.5 26.5 22.5 23 20.5 22C22.5 21 23.5 17.5 23.5 17.5Z" fill="#01BBDC" opacity="0.6" />
                  <path d="M6 4C6 4 6.75 6.75 8.5 7.5C6.75 8.25 6 11 6 11C6 11 5.25 8.25 3.5 7.5C5.25 6.75 6 4 6 4Z" fill="#01BBDC" opacity="0.4" />
                </svg>
              </span>
            </div>
            <button
              type="submit"
              aria-label="Search with AI"
              className="text-white font-medium transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{
                backgroundColor: '#01BBDC',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 999,
                height: 40,
                paddingLeft: 20,
                paddingRight: 20,
                flexShrink: 0,
              }}
            >
              AI Search
            </button>
          </form>
          {/* Badge — centred below search input */}
          <div className="flex justify-center" style={{ maxWidth: 960, margin: '7px auto 0 auto' }}>
            <span
              className="inline-flex items-center gap-1.5"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 11,
                color: '#01BBDC',
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <path d="M15 3C15 3 17.25 10.5 22.5 12.75C17.25 15 15 22.5 15 22.5C15 22.5 12.75 15 7.5 12.75C12.75 10.5 15 3 15 3Z" fill="#01BBDC" />
                <path d="M23.5 17.5C23.5 17.5 24.5 21 26.5 22C24.5 23 23.5 26.5 23.5 26.5C23.5 26.5 22.5 23 20.5 22C22.5 21 23.5 17.5 23.5 17.5Z" fill="#01BBDC" opacity="0.6" />
                <path d="M6 4C6 4 6.75 6.75 8.5 7.5C6.75 8.25 6 11 6 11C6 11 5.25 8.25 3.5 7.5C5.25 6.75 6 4 6 4Z" fill="#01BBDC" opacity="0.4" />
              </svg>
              Powered by YachtVersal AI — understands natural language queries
            </span>
          </div>
        </div>
      </div>

      {/* ══════ STICKY SEARCH + FILTER BAR ══════ */}
      <div
        ref={searchBarRef}
        className="sticky top-0 z-40"
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid rgba(16,33,79,0.08)',
          boxShadow: '0 2px 12px rgba(16,33,79,0.06)',
        }}
      >
        <div
          className="mx-auto"
          style={{ maxWidth: 1440, padding: '12px 24px' }}
        >
          {/* Filter + controls — single row */}
          <div className="flex items-start gap-3">
            {/* Filter chips */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {/* Condition */}
            <FilterDropdown
              label="Condition"
              active={!!filters.condition}
            >
              <ToggleChips
                options={['New', 'Used']}
                values={['new', 'used']}
                value={filters.condition}
                onChange={(v) => handleFilterChange('condition', v)}
              />
            </FilterDropdown>

            {/* Power / Sail */}
            <FilterDropdown
              label="Power / Sail"
              active={!!filters.propulsion}
            >
              <ToggleChips
                options={['Power', 'Sail']}
                values={['power', 'sail']}
                value={filters.propulsion}
                onChange={(v) => { handleFilterChange('propulsion', v); handleFilterChange('boat_type', ''); }}
              />
            </FilterDropdown>

            {/* Type */}
            <FilterDropdown
              label={filters.boat_type || 'Type'}
              active={!!filters.boat_type}
            >
              <SearchableList
                items={typeOptions}
                value={filters.boat_type}
                onChange={(v) => handleFilterChange('boat_type', v)}
                placeholder="Search types…"
              />
            </FilterDropdown>

            {/* Make */}
            <FilterDropdown
              label={filters.make || 'Make'}
              active={!!filters.make}
            >
              <SearchableList
                items={makes}
                value={filters.make}
                onChange={(v) => { handleFilterChange('make', v); handleFilterChange('model', ''); }}
                placeholder="Search makes…"
              />
            </FilterDropdown>

            {/* Model */}
            <FilterDropdown
              label={filters.model || 'Model'}
              active={!!filters.model}
            >
              {filters.make ? (
                <SearchableList
                  items={models}
                  value={filters.model}
                  onChange={(v) => handleFilterChange('model', v)}
                  placeholder="Search models…"
                />
              ) : (
                <p style={{ fontSize: 13, color: 'rgba(16,33,79,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                  Select a make first
                </p>
              )}
            </FilterDropdown>

            {/* Price */}
            <FilterDropdown
              label="Price"
              active={!!(filters.min_price || filters.max_price)}
            >
              <p style={{ fontSize: 11, color: 'rgba(16,33,79,0.5)', fontFamily: 'Poppins, sans-serif', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price (USD)</p>
              <RangeInputs
                minVal={filters.min_price} maxVal={filters.max_price}
                minPlaceholder="Min" maxPlaceholder="Max"
                onMinChange={(v) => handleFilterChange('min_price', v)}
                onMaxChange={(v) => handleFilterChange('max_price', v)}
              />
            </FilterDropdown>

            {/* Length */}
            <FilterDropdown
              label="Length"
              active={!!(filters.min_length || filters.max_length)}
            >
              <p style={{ fontSize: 11, color: 'rgba(16,33,79,0.5)', fontFamily: 'Poppins, sans-serif', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Length (ft)</p>
              <RangeInputs
                minVal={filters.min_length} maxVal={filters.max_length}
                minPlaceholder="Min ft" maxPlaceholder="Max ft"
                onMinChange={(v) => handleFilterChange('min_length', v)}
                onMaxChange={(v) => handleFilterChange('max_length', v)}
              />
            </FilterDropdown>

            {/* Year */}
            <FilterDropdown
              label="Year"
              active={!!(filters.min_year || filters.max_year)}
            >
              <p style={{ fontSize: 11, color: 'rgba(16,33,79,0.5)', fontFamily: 'Poppins, sans-serif', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year Built</p>
              <RangeInputs
                minVal={filters.min_year} maxVal={filters.max_year}
                minPlaceholder="From" maxPlaceholder="To"
                onMinChange={(v) => handleFilterChange('min_year', v)}
                onMaxChange={(v) => handleFilterChange('max_year', v)}
              />
            </FilterDropdown>

            {/* Location */}
            <FilterDropdown
              label="Location"
              active={!!(filters.country || filters.state || filters.city)}
            >
              <div className="space-y-3" style={{ minWidth: 240 }}>
                <div>
                  <label style={dropdownLabelStyle}>Country</label>
                  <select
                    value={filters.country}
                    onChange={(e) => { handleFilterChange('country', e.target.value); handleFilterChange('state', ''); }}
                    className="w-full focus:outline-none"
                    style={rangeInputStyle}
                  >
                    <option value="">Any country</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={dropdownLabelStyle}>State / Province</label>
                  {filters.country && STATES_BY_COUNTRY[filters.country] ? (
                    <select
                      value={filters.state}
                      onChange={(e) => handleFilterChange('state', e.target.value)}
                      className="w-full focus:outline-none"
                      style={rangeInputStyle}
                    >
                      <option value="">Any state</option>
                      {STATES_BY_COUNTRY[filters.country].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={filters.state}
                      onChange={(e) => handleFilterChange('state', e.target.value)}
                      placeholder="State / Province"
                      className="w-full focus:outline-none"
                      style={rangeInputStyle}
                    />
                  )}
                </div>
                <div>
                  <label style={dropdownLabelStyle}>City</label>
                  <input
                    type="text"
                    value={filters.city}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    placeholder="City"
                    className="w-full focus:outline-none"
                    style={rangeInputStyle}
                  />
                </div>
              </div>
            </FilterDropdown>

            {/* More filters — opens left drawer */}
            <button
              type="button"
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                fontFamily: 'Poppins, sans-serif',
                border: (filters.fuel || filters.hull_material || filters.engine || filters.brokerage)
                  ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.15)',
                backgroundColor: (filters.fuel || filters.hull_material || filters.engine || filters.brokerage)
                  ? 'rgba(1,187,220,0.06)' : '#FFFFFF',
                color: (filters.fuel || filters.hull_material || filters.engine || filters.brokerage)
                  ? '#01BBDC' : '#10214F',
              }}
            >
              <SlidersHorizontal size={13} />
              More
            </button>

            {/* Divider */}
            {hasActiveFilters && (
              <div style={{ width: 1, height: 20, backgroundColor: 'rgba(16,33,79,0.12)', flexShrink: 0 }} />
            )}

            {/* Clear all */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium px-2 transition-opacity hover:opacity-70 flex-shrink-0"
                style={{ color: 'rgba(16,33,79,0.5)', fontFamily: 'Poppins, sans-serif' }}
              >
                Clear all
              </button>
            )}
            </div>{/* end filter chips */}

            {/* Controls: currency · sort · save */}
            <div className="flex items-center gap-2 flex-shrink-0 self-start">
              <select
                value={currency}
                onChange={(e) => { setCurrency(e.target.value); localStorage.setItem('preferredCurrency', e.target.value); }}
                className="focus:outline-none"
                style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, border: '1.5px solid rgba(16,33,79,0.15)', borderRadius: 6, padding: '6px 10px', color: '#10214F', backgroundColor: '#FAFAFA' }}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={sort}
                onChange={(e) => { const newSort = e.target.value; setSort(newSort); setPage(0); fetchListings(false, 0, newSort, pageSize); }}
                className="focus:outline-none"
                style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, border: '1.5px solid rgba(16,33,79,0.15)', borderRadius: 6, padding: '6px 10px', color: '#10214F', backgroundColor: '#FAFAFA' }}
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                onClick={handleSaveSearch}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-90 flex-shrink-0"
                style={{ backgroundColor: '#10214F', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
              >
                <Save size={13} />
                Save
              </button>
            </div>
          </div>{/* end filter+controls row */}

          {/* Active filter pills */}
          {filterPills.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {filterPills.map((pill) => (
                <FilterPill key={pill.label} label={pill.label} onRemove={pill.clear} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════ RESULTS ══════ */}
      <div
        className="mx-auto"
        style={{ maxWidth: 1440, padding: '24px 24px 80px' }}
      >
        {/* Result count + AI badge */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 14,
                color: 'rgba(16,33,79,0.6)',
              }}
            >
              <strong style={{ color: '#10214F' }}>{displayTotal.toLocaleString()}</strong> yacht{displayTotal !== 1 ? 's' : ''}
              {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
            </span>
            {searchType === 'ai' && (
              <span
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(1,187,220,0.1)',
                  color: '#01BBDC',
                  border: '1px solid rgba(1,187,220,0.3)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                <Sparkles size={11} />
                AI-Ranked
              </span>
            )}
          </div>
          {searchType === 'ai' && (
            <button
              onClick={() => { setSearchType('basic'); setAiQuery(''); fetchListings(false); }}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'rgba(16,33,79,0.5)', fontFamily: 'Poppins, sans-serif' }}
            >
              <X size={12} /> Clear AI search
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div
              className="animate-spin rounded-full border-b-2"
              style={{ width: 44, height: 44, borderColor: '#01BBDC' }}
            />
            <p className="mt-4 text-sm" style={{ color: 'rgba(16,33,79,0.5)', fontFamily: 'Poppins, sans-serif' }}>
              Searching…
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-32 rounded-2xl"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(16,33,79,0.08)' }}
          >
            <Search size={52} style={{ color: '#d1d5db', marginBottom: 16 }} />
            <h3
              style={{
                color: '#10214F',
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 22,
                marginBottom: 8,
              }}
            >
              No yachts found
            </h3>
            <p style={{ color: 'rgba(16,33,79,0.55)', fontFamily: 'Poppins, sans-serif', fontSize: 14 }}>
              Try adjusting your filters or switch to AI search.
            </p>
          </div>
        ) : (
          <>
            {/* Featured strip */}
            {featured.length > 0 && page === 0 && (
              <div className="mb-8">
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                >
                  ★ Featured
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 14 }}>
                  {featured.map((l) => (
                    <ListingCard
                      key={`f-${l.id}`}
                      id={l.id}
                      title={l.title}
                      price={l.price}
                      year={l.year}
                      make={l.make}
                      model={l.model}
                      boatType={l.boat_type}
                      cabins={l.cabins}
                      length={l.length_feet}
                      city={l.city}
                      state={l.state}
                      images={l.images.map(imgUrl)}
                      condition={l.condition}
                      featured={l.featured}
                      currencyCode={currency}
                      exchangeRate={xr}
                      dealerInfo={l.dealer ? {
                        name: l.dealer.name || '',
                        company: l.dealer.company_name || '',
                        slug: l.dealer.slug,
                        logoUrl: l.dealer.logo_url,
                        photo: l.dealer.photo,
                      } : undefined}
                    />
                  ))}
                </div>
                <div style={{ borderBottom: '1px solid rgba(16,33,79,0.07)', marginTop: 20, marginBottom: 24 }} />
              </div>
            )}

            {/* AI info banner */}
            {searchType === 'ai' && (
              <div
                className="flex items-start gap-3 p-4 rounded-2xl mb-5"
                style={{ backgroundColor: 'rgba(1,187,220,0.06)', border: '1px solid rgba(1,187,220,0.2)' }}
              >
                <Sparkles size={16} style={{ color: '#01BBDC', flexShrink: 0, marginTop: 2 }} />
                <p style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 13, lineHeight: '20px' }}>
                  <strong>AI-Powered Results</strong> — ranked by how well they match your request. Refine further using the filters above.
                </p>
              </div>
            )}

            {/* 4-across grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4" style={{ gap: 16 }}>
              {paged.map((l) => (
                <div key={l.id} className="relative">
                  {l.match_score !== undefined && (
                    <div
                      className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg"
                      style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #01BBDC', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                    >
                      <span
                        className="font-bold text-sm"
                        style={{
                          color: l.match_score >= 90 ? '#01BBDC'
                            : l.match_score >= 75 ? '#f59e0b'
                            : 'rgba(16,33,79,0.5)',
                          fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                        }}
                      >
                        {l.match_score}%
                      </span>
                      <span style={{ color: 'rgba(0,0,0,0.4)', fontSize: 11, fontFamily: 'Poppins, sans-serif' }}>match</span>
                    </div>
                  )}
                  <ListingCard
                    id={l.id}
                    title={l.title}
                    price={l.price}
                    year={l.year}
                    make={l.make}
                    model={l.model}
                    boatType={l.boat_type}
                    cabins={l.cabins}
                    length={l.length_feet}
                    city={l.city}
                    state={l.state}
                    images={l.images.map(imgUrl)}
                    condition={l.condition}
                    featured={l.featured}
                    currencyCode={currency}
                    exchangeRate={xr}
                    dealerInfo={l.dealer ? {
                      name: l.dealer.name || '',
                      company: l.dealer.company_name || '',
                      slug: l.dealer.slug,
                      logoUrl: l.dealer.logo_url,
                      photo: l.dealer.photo,
                    } : undefined}
                  />
                  {l.match_reasons && l.match_reasons.length > 0 && (
                    <div
                      className="mt-1.5 px-2.5 py-2 rounded-xl"
                      style={{ backgroundColor: 'rgba(1,187,220,0.05)', border: '1px solid rgba(1,187,220,0.15)' }}
                    >
                      <ul className="space-y-0.5">
                        {l.match_reasons.slice(0, 2).map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1" style={{ color: 'rgba(16,33,79,0.75)', fontFamily: 'Poppins, sans-serif' }}>
                            <span style={{ color: '#01BBDC' }}>•</span>
                            {r.replace('✓ ', '')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {l.warnings && l.warnings.length > 0 && (
                    <div
                      className="mt-1.5 px-2.5 py-2 rounded-xl"
                      style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      <p className="text-xs flex items-center gap-1" style={{ color: '#f59e0b', fontFamily: 'Poppins, sans-serif' }}>
                        <AlertTriangle size={11} /> {l.warnings[0]}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center gap-3 mt-10">
                {/* Navigation row with per-page dropdown far right */}
                <div className="relative w-full flex items-center justify-center">
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {/* Skip to first */}
                    <button
                      onClick={() => { setPage(0); fetchListings(false, 0, sort, pageSize); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page === 0}
                      title="First page"
                      className="flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                      style={{ backgroundColor: '#FFFFFF', border: '1.5px solid rgba(16,33,79,0.12)', color: '#10214F', fontFamily: 'Poppins, sans-serif' }}
                    >
                      «
                    </button>

                    <button
                      onClick={() => { const np = Math.max(0, page - 1); setPage(np); fetchListings(false, np, sort, pageSize); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page === 0}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                      style={{ backgroundColor: '#FFFFFF', border: '1.5px solid rgba(16,33,79,0.12)', color: '#10214F', fontFamily: 'Poppins, sans-serif' }}
                    >
                      <ChevronLeft size={15} /> Prev
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => {
                        if (Math.abs(i - page) > 2) return null;
                        return (
                          <button
                            key={i}
                            onClick={() => { setPage(i); fetchListings(false, i, sort, pageSize); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="w-8 h-8 rounded-lg text-sm font-medium transition-all"
                            style={{
                              fontFamily: 'Poppins, sans-serif',
                              backgroundColor: i === page ? '#01BBDC' : '#FFFFFF',
                              color: i === page ? '#FFFFFF' : 'rgba(16,33,79,0.6)',
                              border: i === page ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.12)',
                            }}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                      {/* Always show last page if not in window */}
                      {page < totalPages - 3 && (
                        <>
                          {page < totalPages - 4 && (
                            <span style={{ color: 'rgba(16,33,79,0.3)', fontSize: 13, padding: '0 2px' }}>…</span>
                          )}
                          <button
                            onClick={() => { setPage(totalPages - 1); fetchListings(false, totalPages - 1, sort, pageSize); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="w-8 h-8 rounded-lg text-sm font-medium transition-all"
                            style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: '#FFFFFF', color: 'rgba(16,33,79,0.6)', border: '1.5px solid rgba(16,33,79,0.12)' }}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => { const np = Math.min(totalPages - 1, page + 1); setPage(np); fetchListings(false, np, sort, pageSize); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page >= totalPages - 1}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                      style={{ backgroundColor: '#FFFFFF', border: '1.5px solid rgba(16,33,79,0.12)', color: '#10214F', fontFamily: 'Poppins, sans-serif' }}
                    >
                      Next <ChevronRight size={15} />
                    </button>

                    {/* Skip to last */}
                    <button
                      onClick={() => { setPage(totalPages - 1); fetchListings(false, totalPages - 1, sort, pageSize); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page >= totalPages - 1}
                      title="Last page"
                      className="flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                      style={{ backgroundColor: '#FFFFFF', border: '1.5px solid rgba(16,33,79,0.12)', color: '#10214F', fontFamily: 'Poppins, sans-serif' }}
                    >
                      »
                    </button>
                  </div>

                  {/* Per-page dropdown — far right */}
                  <div
                    className="absolute right-0 flex items-center gap-2"
                    style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'rgba(16,33,79,0.5)' }}
                  >
                    <span>Show</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { const ps = Number(e.target.value); setPageSize(ps); setPage(0); fetchListings(false, 0, sort, ps); }}
                      className="focus:outline-none"
                      style={{
                        border: '1.5px solid rgba(16,33,79,0.15)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 13,
                        fontFamily: 'Poppins, sans-serif',
                        color: '#10214F',
                        backgroundColor: '#FAFAFA',
                      }}
                    >
                      <option value={20}>20</option>
                      <option value={48}>48</option>
                      <option value={96}>96</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ Filter drawer — slides in from the left ══════════════════════════ */}
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200"
        style={{ opacity: moreFiltersOpen ? 1 : 0, pointerEvents: moreFiltersOpen ? 'auto' : 'none' }}
        onClick={() => setMoreFiltersOpen(false)}
      />
      {/* Panel */}
      <div
        className="fixed left-0 top-0 h-full z-50 overflow-y-auto"
        style={{
          width: 340,
          backgroundColor: '#FFFFFF',
          boxShadow: '4px 0 30px rgba(16,33,79,0.15)',
          transform: moreFiltersOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between sticky top-0 bg-white z-10"
          style={{ padding: '16px 20px', borderBottom: '1px solid rgba(16,33,79,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} style={{ color: '#10214F' }} />
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#10214F' }}>
              All Filters
            </span>
            {filterPills.length > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: '#01BBDC', color: '#FFF', fontFamily: 'Poppins, sans-serif' }}
              >
                {filterPills.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setMoreFiltersOpen(false)}
            style={{ color: 'rgba(16,33,79,0.4)', padding: 4 }}
            aria-label="Close filters"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={dropdownLabelStyle}>Condition</label>
            <ToggleChips options={['New', 'Used']} values={['new', 'used']} value={filters.condition} onChange={(v) => handleFilterChange('condition', v)} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Propulsion</label>
            <ToggleChips options={['Power', 'Sail']} values={['power', 'sail']} value={filters.propulsion} onChange={(v) => { handleFilterChange('propulsion', v); handleFilterChange('boat_type', ''); }} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Type</label>
            <div className="flex flex-wrap gap-1.5">
              {typeOptions.map((opt) => {
                const active = filters.boat_type === opt || filters.boat_type.split(',').includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleFilterChange('boat_type', active ? '' : opt)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={{ fontFamily: 'Poppins, sans-serif', border: active ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.2)', backgroundColor: active ? '#01BBDC' : 'transparent', color: active ? '#FFF' : '#10214F' }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={dropdownLabelStyle}>Make</label>
            <SearchableList items={makes} value={filters.make} onChange={(v) => { handleFilterChange('make', v); handleFilterChange('model', ''); }} placeholder="Search makes…" />
          </div>
          {filters.make && (
            <div>
              <label style={dropdownLabelStyle}>Model</label>
              <SearchableList items={models} value={filters.model} onChange={(v) => handleFilterChange('model', v)} placeholder="Search models…" />
            </div>
          )}
          <div>
            <label style={dropdownLabelStyle}>Price (USD)</label>
            <RangeInputs minVal={filters.min_price} maxVal={filters.max_price} minPlaceholder="Min" maxPlaceholder="Max" onMinChange={(v) => handleFilterChange('min_price', v)} onMaxChange={(v) => handleFilterChange('max_price', v)} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Length (ft)</label>
            <RangeInputs minVal={filters.min_length} maxVal={filters.max_length} minPlaceholder="Min ft" maxPlaceholder="Max ft" onMinChange={(v) => handleFilterChange('min_length', v)} onMaxChange={(v) => handleFilterChange('max_length', v)} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Year</label>
            <RangeInputs minVal={filters.min_year} maxVal={filters.max_year} minPlaceholder="From" maxPlaceholder="To" onMinChange={(v) => handleFilterChange('min_year', v)} onMaxChange={(v) => handleFilterChange('max_year', v)} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Country</label>
            <select value={filters.country} onChange={(e) => { handleFilterChange('country', e.target.value); handleFilterChange('state', ''); }} className="w-full focus:outline-none" style={rangeInputStyle}>
              <option value="">Any country</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={dropdownLabelStyle}>State / Province</label>
            {filters.country && STATES_BY_COUNTRY[filters.country] ? (
              <select value={filters.state} onChange={(e) => handleFilterChange('state', e.target.value)} className="w-full focus:outline-none" style={rangeInputStyle}>
                <option value="">Any state</option>
                {STATES_BY_COUNTRY[filters.country].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input type="text" value={filters.state} onChange={(e) => handleFilterChange('state', e.target.value)} placeholder="State / Province" className="w-full focus:outline-none" style={rangeInputStyle} />
            )}
          </div>
          <div>
            <label style={dropdownLabelStyle}>City</label>
            <input type="text" value={filters.city} onChange={(e) => handleFilterChange('city', e.target.value)} placeholder="City" className="w-full focus:outline-none" style={rangeInputStyle} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Fuel Type</label>
            <ToggleChips options={['Diesel', 'Gasoline', 'Electric', 'Hybrid', 'Other']} value={filters.fuel} onChange={(v) => handleFilterChange('fuel', v)} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Hull Material</label>
            <ToggleChips options={['Fiberglass', 'Steel', 'Aluminum', 'Carbon Fiber', 'Wood', 'Composite']} value={filters.hull_material} onChange={(v) => handleFilterChange('hull_material', v)} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Engine Details</label>
            <input type="text" value={filters.engine} onChange={(e) => handleFilterChange('engine', e.target.value)} placeholder="e.g. Twin diesel" className="w-full focus:outline-none" style={rangeInputStyle} />
          </div>
          <div>
            <label style={dropdownLabelStyle}>Brokerage</label>
            <input type="text" value={filters.brokerage} onChange={(e) => handleFilterChange('brokerage', e.target.value)} placeholder="Any brokerage" className="w-full focus:outline-none" style={rangeInputStyle} />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { clearFilters(); setMoreFiltersOpen(false); }}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: 'rgba(16,33,79,0.05)', color: '#10214F', fontFamily: 'Poppins, sans-serif', border: '1.5px solid rgba(16,33,79,0.15)' }}
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Label style ─────────────────────────────────────────────────────────────

const dropdownLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'rgba(16,33,79,0.45)',
  fontFamily: 'Poppins, sans-serif',
  marginBottom: 6,
};

// ─── Export ───────────────────────────────────────────────────────────────────

function BrowseLoading() {
  return <div className="min-h-screen" style={{ backgroundColor: '#F8F9FC' }} />;
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<BrowseLoading />}>
      <BrowseContent />
    </Suspense>
  );
}
