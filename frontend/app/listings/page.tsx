'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Search, Sparkles, Save, SlidersHorizontal, X, AlertTriangle, ChevronDown } from 'lucide-react';
import ListingCard from '../components/ListingCard';
import { apiUrl } from '@/app/lib/apiRoot';

const ListingsMap = dynamic(() => import('../components/ListingsMap'), { ssr: false });

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
  images: Array<{ url: string }>;
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
  };
}

// ─── AI Search Box (same design as homepage) ─────────────────────────────────

function AISearchBox({
  query,
  setQuery,
  onSearch,
}: {
  query: string;
  setQuery: (v: string) => void;
  onSearch: () => void;
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <div
      className="bg-secondary w-full"
      style={{
        boxShadow: '0px 1px 10.2px rgba(0,0,0,0.15)',
        borderRadius: 24,
        padding: 'clamp(20px, 3vw, 36px) clamp(16px, 3vw, 40px)',
      }}
    >
      {/* Heading */}
      <h2
        className="text-center font-normal"
        style={{
          color: '#FFFFFF',
          fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
          fontSize: 'clamp(22px, 2.5vw, 40px)',
          lineHeight: '1.2',
          fontWeight: 400,
          marginBottom: 10,
        }}
      >
        Find the Yacht - Skip the Filters
      </h2>

      <p
        className="text-center"
        style={{
          color: '#FFFFFF',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          lineHeight: '24px',
          marginBottom: 28,
        }}
      >
        Our AI-powered search goes beyond basic filters. Tell us what you want—size, lifestyle, budget, cruising plans—and YachtVersal AI matches you with yachts that fit your vision.
      </p>

      {/* Search row */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 mx-auto"
        style={{ maxWidth: 799 }}
        role="search"
        aria-label="Yacht AI search"
      >
        <label htmlFor="listing-ai-search" className="sr-only">
          Describe your ideal yacht
        </label>
        <div className="relative flex-1">
          <input
            id="listing-ai-search"
            type="search"
            placeholder="Describe your ideal yacht..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full focus:outline-none"
            style={{
              height: 56,
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.08)',
              paddingLeft: 20,
              paddingRight: 52,
              fontSize: 14,
              lineHeight: '21px',
              fontFamily: 'Poppins, sans-serif',
              color: '#FFFFFF',
            }}
          />
          {/* Spark icon */}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <path d="M15 3C15 3 17.25 10.5 22.5 12.75C17.25 15 15 22.5 15 22.5C15 22.5 12.75 15 7.5 12.75C12.75 10.5 15 3 15 3Z" fill="#01BBDC" />
              <path d="M23.5 17.5C23.5 17.5 24.5 21 26.5 22C24.5 23 23.5 26.5 23.5 26.5C23.5 26.5 22.5 23 20.5 22C22.5 21 23.5 17.5 23.5 17.5Z" fill="#01BBDC" opacity="0.6" />
              <path d="M6 4C6 4 6.75 6.75 8.5 7.5C6.75 8.25 6 11 6 11C6 11 5.25 8.25 3.5 7.5C5.25 6.75 6 4 6 4Z" fill="#01BBDC" opacity="0.4" />
            </svg>
          </span>
        </div>

        <button
          type="submit"
          aria-label="AI search for yachts"
          className="text-white font-medium transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{
            backgroundColor: '#01BBDC',
            fontFamily: 'Poppins, sans-serif',
            fontSize: 16,
            lineHeight: '24px',
            fontWeight: 500,
            borderRadius: 12,
            width: 121,
            height: 56,
            flexShrink: 0,
          }}
        >
          Search
        </button>
      </form>

      {/* AI tag line */}
      <p
        className="text-center flex items-center justify-center gap-2"
        style={{
          color: '#FFFFFF',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          lineHeight: '24px',
          marginTop: 24,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2C12 2 13.5 7 17 8.5C13.5 10 12 15 12 15C12 15 10.5 10 7 8.5C10.5 7 12 2 12 2Z" fill="#01BBDC" />
          <path d="M19 14C19 14 19.75 16.5 21.5 17.25C19.75 18 19 20.5 19 20.5C19 20.5 18.25 18 16.5 17.25C18.25 16.5 19 14 19 14Z" fill="#01BBDC" opacity="0.6" />
          <path d="M5 3C5 3 5.5 4.75 7 5.5C5.5 6.25 5 8 5 8C5 8 4.5 6.25 3 5.5C4.5 4.75 5 3 5 3Z" fill="#01BBDC" opacity="0.4" />
        </svg>
        Powered by YachtVersal AI — understands natural language queries
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function UnifiedListingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchType, setSearchType] = useState<'basic' | 'ai'>('basic');
  const [aiQuery, setAiQuery] = useState('');
  const [sort, setSort] = useState<'nearest' | 'price_asc' | 'price_desc' | 'year_desc' | 'year_asc'>('nearest');
  const [sortOpen, setSortOpen] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    boat_type: searchParams.get('boat_type') || '',
    make: searchParams.get('make') || '',
    model: searchParams.get('model') || '',
    propulsion: searchParams.get('propulsion') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    min_length: searchParams.get('min_length') || '',
    max_length: searchParams.get('max_length') || '',
    min_year: searchParams.get('min_year') || '',
    max_year: searchParams.get('max_year') || '',
    state: searchParams.get('state') || '',
    city: searchParams.get('city') || '',
    condition: searchParams.get('condition') || '',
    fuel: searchParams.get('fuel') || '',
    hull_material: searchParams.get('hull_material') || '',
    engine: searchParams.get('engine') || '',
    brokerage: searchParams.get('brokerage') || '',
    country: searchParams.get('country') || '',
    location_query: searchParams.get('location_query') || '',
    max_distance: searchParams.get('max_distance') || '',
  });

  const POWER_TYPES = ['Motor Yacht', 'Mega Yacht', 'Trawler', 'Express Cruiser', 'Sport Fisher', 'Center Console'];
  const SAIL_TYPES  = ['Sailing Yacht', 'Catamaran', 'Sloop', 'Ketch', 'Schooner'];
  const typeOptions =
    filters.propulsion === 'power' ? POWER_TYPES :
    filters.propulsion === 'sail'  ? SAIL_TYPES  :
    [...POWER_TYPES, ...SAIL_TYPES];

  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [makeSearch, setMakeSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    fetch(apiUrl('/listings/makes'))
      .then((r) => r.ok ? r.json() : [])
      .then((data: string[]) => setMakes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filters.make) { setModels([]); return; }
    fetch(apiUrl(`/listings/models?make=${encodeURIComponent(filters.make)}`))
      .then((r) => r.ok ? r.json() : [])
      .then((data: string[]) => setModels(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [filters.make]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchListings(); }, []);

  // Request browser geolocation for nearest-first sort
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, []);

  const fetchListings = async (isAISearch = false) => {
    setLoading(true);
    try {
      let url = apiUrl('/listings?status=active');
      if (isAISearch && aiQuery) {
        url = apiUrl(`/ai/search?query=${encodeURIComponent(aiQuery)}`);
      } else {
        const skipKeys = new Set(['location_query', 'max_distance']);
        Object.entries(filters).forEach(([key, value]) => {
          if (value && !skipKeys.has(key)) url += `&${key}=${encodeURIComponent(value)}`;
        });
      }
      const response = await fetch(url);
      const data = await response.json();
      setListings(isAISearch ? (data.results || []) : (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('Error fetching listings:', error);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const geocodeLocation = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'YachtVersal/1.0' } }
      );
      const data = await res.json();
      if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch { /* ignore */ }
    return null;
  };

  const applyFilters = async () => {
    if (filters.location_query && filters.max_distance) {
      const coords = await geocodeLocation(filters.location_query);
      setCenterLat(coords ? coords.lat : null);
      setCenterLng(coords ? coords.lng : null);
    } else {
      setCenterLat(null);
      setCenterLng(null);
    }
    fetchListings(searchType === 'ai');
  };

  const clearFilters = () => {
    setFilters({ search: '', boat_type: '', make: '', model: '', propulsion: '', min_price: '', max_price: '', min_length: '', max_length: '', min_year: '', max_year: '', state: '', city: '', condition: '', fuel: '', hull_material: '', engine: '', brokerage: '', country: '', location_query: '', max_distance: '' });
    setCenterLat(null); setCenterLng(null);
    setAiQuery('');
    setSearchType('basic');
    fetchListings(false);
  };

  const handleAISearch = () => {
    if (aiQuery.trim()) {
      setSearchType('ai');
      fetchListings(true);
    }
  };

  const switchToBasicSearch = () => {
    setSearchType('basic');
    setAiQuery('');
    fetchListings(false);
  };

  const handleSaveSearch = async () => {
    const token = localStorage.getItem('token');
    if (!token) { alert('Please log in to save searches'); router.push('/login'); return; }
    try {
      const response = await fetch(apiUrl('/search-alerts'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Search: ${filters.search || filters.boat_type || 'All Yachts'}`, filters }),
      });
      alert(response.ok ? 'Search saved successfully!' : 'Failed to save search');
    } catch { alert('Failed to save search'); }
  };

  const SORT_OPTIONS = [
    { value: 'nearest',    label: 'Nearest First' },
    { value: 'price_asc',  label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'year_desc',  label: 'Year: Newest First' },
    { value: 'year_asc',   label: 'Year: Oldest First' },
  ];

  const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  let processedListings = [...listings];
  if (centerLat !== null && centerLng !== null && filters.max_distance) {
    const maxDist = parseFloat(filters.max_distance);
    processedListings = processedListings.filter((l) =>
      (!l.latitude || !l.longitude) ? true : haversineMiles(centerLat!, centerLng!, l.latitude, l.longitude) <= maxDist
    );
  }
  processedListings.sort((a, b) => {
    if (sort === 'nearest' && userLat !== null && userLng !== null) {
      const da = (a.latitude && a.longitude) ? haversineMiles(userLat, userLng, a.latitude, a.longitude) : Infinity;
      const db = (b.latitude && b.longitude) ? haversineMiles(userLat, userLng, b.latitude, b.longitude) : Infinity;
      return da - db;
    }
    if (sort === 'price_asc')  return (a.price || 0) - (b.price || 0);
    if (sort === 'price_desc') return (b.price || 0) - (a.price || 0);
    if (sort === 'year_desc')  return (b.year  || 0) - (a.year  || 0);
    if (sort === 'year_asc')   return (a.year  || 0) - (b.year  || 0);
    return 0;
  });
  const pinnedFeatured = processedListings.filter((l) => l.featured).slice(0, 4);
  const pinnedIds = new Set(pinnedFeatured.map((l) => l.id));
  const regularListings = processedListings.filter((l) => !pinnedIds.has(l.id));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>

      {/* ══════════════════════════════════════════════════════════════════
          AI SEARCH CARD — sits at top of page, no hero above it
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="mx-auto"
        style={{
          maxWidth: 1296,
          paddingLeft: 'clamp(16px, 2vw, 0px)',
          paddingRight: 'clamp(16px, 2vw, 0px)',
          paddingTop: 40,
          paddingBottom: 40,
        }}
      >
        <AISearchBox query={aiQuery} setQuery={setAiQuery} onSearch={handleAISearch} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CONTENT — filters sidebar + 3-col results grid
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="mx-auto"
        style={{
          maxWidth: 1296,
          paddingLeft: 'clamp(16px, 4vw, 0px)',
          paddingRight: 'clamp(16px, 4vw, 0px)',
          paddingBottom: 80,
        }}
      >
        {/* Top bar: result count + sort + action buttons */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#000000',
              }}
            >
              {processedListings.length.toLocaleString()} yacht{processedListings.length !== 1 ? 's' : ''} found
            </span>
            {searchType === 'ai' && (
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(1,187,220,0.1)',
                  color: '#01BBDC',
                  border: '1px solid rgba(1,187,220,0.3)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                <Sparkles size={12} />
                AI-Ranked
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {searchType === 'ai' && (
              <button
                onClick={switchToBasicSearch}
                className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
                style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}
              >
                <X size={14} /> Clear AI Search
              </button>
            )}
            <button
              onClick={handleSaveSearch}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: '#01BBDC',
                color: '#FFFFFF',
                borderRadius: 12,
                fontFamily: 'Poppins, sans-serif',
                fontSize: 14,
              }}
            >
              <Save size={15} />
              Save Search
            </button>
            {/* Mobile filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center gap-2 px-4 py-2 text-sm font-medium"
              style={{
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 12,
                color: '#10214F',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <SlidersHorizontal size={15} />
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>
          </div>
        </div>

        {/* Two-column layout: sidebar + results */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── FILTERS SIDEBAR ── */}
          <div
            className={`flex-shrink-0 w-full lg:w-[306px] ${showFilters ? 'block' : 'hidden lg:block'}`}
          >
            <div
              className="sticky"
              style={{
                top: 16,
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 6,
              }}
            >
              <div className="p-4">

                {/* ── Sort dropdown ── */}
                <div className="relative mb-2">
                  <button
                    type="button"
                    onClick={() => setSortOpen((v) => !v)}
                    className="w-full flex items-center justify-between py-2.5 px-4 font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#01BBDC', color: '#FFFFFF', borderRadius: 12, fontFamily: 'Poppins, sans-serif', fontSize: 14 }}
                  >
                    <span>{SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort By'}</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {sortOpen && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl overflow-hidden z-50"
                      style={{ border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                          style={{
                            fontFamily: 'Poppins, sans-serif',
                            color: sort === opt.value ? '#01BBDC' : '#10214F',
                            fontWeight: sort === opt.value ? 600 : 400,
                          }}
                          onClick={() => { setSort(opt.value as typeof sort); setSortOpen(false); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Apply Filters ── */}
                <button
                  onClick={applyFilters}
                  className="w-full py-3 font-medium transition-opacity hover:opacity-90 mb-1"
                  style={{ backgroundColor: '#10214F', color: '#FFFFFF', borderRadius: 12, fontFamily: 'Poppins, sans-serif', fontSize: 15 }}
                >
                  Apply Filters
                </button>
                {Object.values(filters).some((v) => v) && (
                  <button
                    onClick={clearFilters}
                    className="w-full text-sm font-medium text-center py-1.5 transition-opacity hover:opacity-70"
                    style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                  >
                    Clear all filters
                  </button>
                )}
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: 6 }} />

                {/* ── Accordion sections ── */}
                <div>

                  <FilterAccordion label="Condition" isOpen={!!openSections.condition} onToggle={() => toggleSection('condition')}>
                    <FilterOptions
                      options={['New', 'Used']}
                      values={['new', 'used']}
                      value={filters.condition}
                      onChange={(v) => handleFilterChange('condition', v)}
                    />
                  </FilterAccordion>

                  <FilterAccordion label="Power / Sail" isOpen={!!openSections.propulsion} onToggle={() => toggleSection('propulsion')}>
                    <FilterOptions
                      options={['Power', 'Sail']}
                      values={['power', 'sail']}
                      value={filters.propulsion}
                      onChange={(v) => handleFilterChange('propulsion', v)}
                    />
                  </FilterAccordion>

                  <FilterAccordion label="Type" isOpen={!!openSections.boat_type} onToggle={() => toggleSection('boat_type')}>
                    <FilterSearchList
                      items={typeOptions}
                      value={filters.boat_type}
                      search={typeSearch}
                      onSearchChange={setTypeSearch}
                      onChange={(v) => handleFilterChange('boat_type', v)}
                      placeholder="Search types…"
                    />
                  </FilterAccordion>

                  <FilterAccordion label="Manufacturer" isOpen={!!openSections.make} onToggle={() => toggleSection('make')}>
                    <FilterSearchList
                      items={makes}
                      value={filters.make}
                      search={makeSearch}
                      onSearchChange={setMakeSearch}
                      onChange={(v) => {
                        handleFilterChange('make', v);
                        handleFilterChange('model', '');
                        setModelSearch('');
                      }}
                      placeholder="Search makes…"
                    />
                  </FilterAccordion>

                  <FilterAccordion label="Model" isOpen={!!openSections.model} onToggle={() => toggleSection('model')}>
                    {filters.make ? (
                      <FilterSearchList
                        items={models}
                        value={filters.model}
                        search={modelSearch}
                        onSearchChange={setModelSearch}
                        onChange={(v) => handleFilterChange('model', v)}
                        placeholder="Search models…"
                        emptyMsg={models.length === 0 ? 'Loading…' : 'No models found'}
                      />
                    ) : (
                      <p style={{ fontSize: 13, color: 'rgba(16,33,79,0.4)', fontFamily: 'Poppins, sans-serif', padding: '4px 2px 8px' }}>
                        Select a manufacturer first
                      </p>
                    )}
                  </FilterAccordion>

                  <FilterAccordion label="Price" isOpen={!!openSections.price} onToggle={() => toggleSection('price')}>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={filters.min_price} onChange={(e) => handleFilterChange('min_price', e.target.value)} placeholder="Min ($)" style={accInputStyle} className="focus:outline-none" />
                      <input type="number" value={filters.max_price} onChange={(e) => handleFilterChange('max_price', e.target.value)} placeholder="Max ($)" style={accInputStyle} className="focus:outline-none" />
                    </div>
                  </FilterAccordion>

                  <FilterAccordion label="Length (ft)" isOpen={!!openSections.length} onToggle={() => toggleSection('length')}>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={filters.min_length} onChange={(e) => handleFilterChange('min_length', e.target.value)} placeholder="Min" style={accInputStyle} className="focus:outline-none" />
                      <input type="number" value={filters.max_length} onChange={(e) => handleFilterChange('max_length', e.target.value)} placeholder="Max" style={accInputStyle} className="focus:outline-none" />
                    </div>
                  </FilterAccordion>

                  <FilterAccordion label="Year Built" isOpen={!!openSections.year} onToggle={() => toggleSection('year')}>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={filters.min_year} onChange={(e) => handleFilterChange('min_year', e.target.value)} placeholder="From" style={accInputStyle} className="focus:outline-none" />
                      <input type="number" value={filters.max_year} onChange={(e) => handleFilterChange('max_year', e.target.value)} placeholder="To" style={accInputStyle} className="focus:outline-none" />
                    </div>
                  </FilterAccordion>

                  <FilterAccordion label="Location" isOpen={!!openSections.location} onToggle={() => toggleSection('location')}>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input type="text" value={filters.city} onChange={(e) => handleFilterChange('city', e.target.value)} placeholder="City" style={accInputStyle} className="focus:outline-none" />
                      <input type="text" value={filters.state} onChange={(e) => handleFilterChange('state', e.target.value)} placeholder="State" style={accInputStyle} className="focus:outline-none" />
                    </div>
                    <input type="text" value={filters.country} onChange={(e) => handleFilterChange('country', e.target.value)} placeholder="Country" style={{ ...accInputStyle, marginBottom: 8 }} className="focus:outline-none" />
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginBottom: 8 }} />
                    <p style={{ fontSize: 11, color: 'rgba(16,33,79,0.5)', fontFamily: 'Poppins, sans-serif', marginBottom: 6 }}>Filter by distance from a location</p>
                    <input type="text" value={filters.location_query} onChange={(e) => handleFilterChange('location_query', e.target.value)} placeholder="Zip, city, or address" style={{ ...accInputStyle, marginBottom: 6 }} className="focus:outline-none" />
                    <select value={filters.max_distance} onChange={(e) => handleFilterChange('max_distance', e.target.value)} style={accInputStyle} className="focus:outline-none">
                      <option value="">Any distance</option>
                      <option value="25">Within 25 miles</option>
                      <option value="50">Within 50 miles</option>
                      <option value="100">Within 100 miles</option>
                      <option value="250">Within 250 miles</option>
                      <option value="500">Within 500 miles</option>
                      <option value="1000">Within 1,000 miles</option>
                    </select>
                  </FilterAccordion>

                  <FilterAccordion label="Engine Details" isOpen={!!openSections.engine} onToggle={() => toggleSection('engine')}>
                    <input type="text" value={filters.engine} onChange={(e) => handleFilterChange('engine', e.target.value)} placeholder="e.g. Twin diesel" style={accInputStyle} className="w-full focus:outline-none" />
                  </FilterAccordion>

                  <FilterAccordion label="Fuel" isOpen={!!openSections.fuel} onToggle={() => toggleSection('fuel')}>
                    <FilterOptions
                      options={['Diesel', 'Gasoline', 'Electric', 'Hybrid', 'Other']}
                      values={['diesel', 'gasoline', 'electric', 'hybrid', 'other']}
                      value={filters.fuel}
                      onChange={(v) => handleFilterChange('fuel', v)}
                    />
                  </FilterAccordion>

                  <FilterAccordion label="Hull Material" isOpen={!!openSections.hull_material} onToggle={() => toggleSection('hull_material')}>
                    <FilterOptions
                      options={['Fiberglass', 'Steel', 'Aluminum', 'Carbon Fibre', 'Wood', 'Composite', 'Other']}
                      values={['fiberglass', 'steel', 'aluminum', 'carbon_fibre', 'wood', 'composite', 'other']}
                      value={filters.hull_material}
                      onChange={(v) => handleFilterChange('hull_material', v)}
                    />
                  </FilterAccordion>

                  <FilterAccordion label="Brokerage" isOpen={!!openSections.brokerage} onToggle={() => toggleSection('brokerage')} noBorder>
                    <input type="text" value={filters.brokerage} onChange={(e) => handleFilterChange('brokerage', e.target.value)} placeholder="Any brokerage" style={accInputStyle} className="w-full focus:outline-none" />
                  </FilterAccordion>

                </div>

              </div>
            </div>
          </div>

          {/* ── RESULTS — 3-column grid ── */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div
                  className="animate-spin rounded-full border-b-2"
                  style={{ width: 48, height: 48, borderColor: '#01BBDC' }}
                />
                <p className="mt-4" style={{ color: 'rgba(16,33,79,0.7)', fontFamily: 'Poppins, sans-serif' }}>
                  Searching…
                </p>
              </div>
            ) : listings.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-24 rounded-2xl"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)' }}
              >
                <Search size={64} style={{ color: '#d1d5db', marginBottom: 16 }} />
                <h3
                  style={{
                    color: '#10214F',
                    fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                    fontSize: 24, lineHeight: '29px', marginBottom: 8,
                  }}
                >
                  No yachts found
                </h3>
                <p style={{ color: 'rgba(16,33,79,0.7)', fontFamily: 'Poppins, sans-serif', fontSize: 16 }}>
                  Try adjusting your filters or use the AI search above.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* AI Search info banner */}
                {searchType === 'ai' && (
                  <div
                    className="flex items-start gap-3 p-4 rounded-2xl"
                    style={{ backgroundColor: 'rgba(1,187,220,0.08)', border: '1px solid rgba(1,187,220,0.25)' }}
                  >
                    <Sparkles size={18} style={{ color: '#01BBDC', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 14, lineHeight: '21px' }}>
                      <strong>AI-Powered Results:</strong> These yachts are ranked by how well they match your request.
                      You can still refine using the filters on the left.
                    </p>
                  </div>
                )}

                {/* ── Featured strip ── */}
                {pinnedFeatured.length > 0 && (
                  <div className="mb-6">
                    <p
                      className="mb-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                    >
                      ★ Featured Listings
                    </p>
                    <div
                      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                      style={{ gap: 16 }}
                    >
                      {pinnedFeatured.map((listing) => (
                        <div key={`featured-${listing.id}`} className="relative">
                          <div
                            className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: '#01BBDC', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                          >
                            Featured
                          </div>
                          <ListingCard
                            id={listing.id}
                            title={listing.title}
                            price={listing.price}
                            year={listing.year}
                            make={listing.make}
                            model={listing.model}
                            boatType={listing.boat_type}
                            cabins={listing.cabins}
                            length={listing.length_feet}
                            city={listing.city}
                            state={listing.state}
                            images={listing.images.map((img) => (typeof img === 'string' ? img : img.url))}
                            condition={listing.condition}
                            featured={listing.featured}
                            dealerInfo={listing.dealer ? {
                              name: listing.dealer.name || '',
                              company: listing.dealer.company_name || '',
                              slug: listing.dealer.slug,
                              logoUrl: listing.dealer.logo_url,
                            } : undefined}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', marginTop: 16, marginBottom: 20 }} />
                  </div>
                )}

                {/* ── All Results grid ── */}
                <div
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                  style={{ gap: 24 }}
                >
                  {regularListings.map((listing) => (
                    <div key={listing.id} className="relative">
                      {/* AI Match Score Badge */}
                      {listing.match_score !== undefined && (
                        <div
                          className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                          style={{ backgroundColor: '#FFFFFF', border: '2px solid #01BBDC', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                        >
                          <span
                            className="font-bold text-base"
                            style={{
                              color: listing.match_score >= 90 ? '#01BBDC'
                                : listing.match_score >= 75 ? '#f59e0b'
                                : listing.match_score >= 60 ? '#10214F'
                                : 'rgba(16,33,79,0.4)',
                              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                            }}
                          >
                            {listing.match_score}%
                          </span>
                          <span style={{ color: 'rgba(0,0,0,0.5)', fontSize: 12, fontFamily: 'Poppins, sans-serif' }}>match</span>
                        </div>
                      )}

                      <ListingCard
                        id={listing.id}
                        title={listing.title}
                        price={listing.price}
                        year={listing.year}
                        make={listing.make}
                        model={listing.model}
                        boatType={listing.boat_type}
                        cabins={listing.cabins}
                        length={listing.length_feet}
                        city={listing.city}
                        state={listing.state}
                        images={listing.images.map((img) => (typeof img === 'string' ? img : img.url))}
                        condition={listing.condition}
                        featured={listing.featured}
                        dealerInfo={listing.dealer ? {
                          name: listing.dealer.name || '',
                          company: listing.dealer.company_name || '',
                          slug: listing.dealer.slug,
                          logoUrl: listing.dealer.logo_url,
                        } : undefined}
                      />

                      {/* AI Match Reasons */}
                      {listing.match_reasons && listing.match_reasons.length > 0 && (
                        <div
                          className="mt-2 p-3 rounded-xl"
                          style={{ backgroundColor: 'rgba(1,187,220,0.05)', border: '1px solid rgba(1,187,220,0.2)' }}
                        >
                          <p className="text-xs font-semibold mb-1" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>Why this matches:</p>
                          <ul className="space-y-0.5">
                            {listing.match_reasons.slice(0, 2).map((reason, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'rgba(16,33,79,0.8)', fontFamily: 'Poppins, sans-serif' }}>
                                <span style={{ color: '#01BBDC' }}>•</span>
                                {reason.replace('✓ ', '')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* AI Warnings */}
                      {listing.warnings && listing.warnings.length > 0 && (
                        <div
                          className="mt-2 p-3 rounded-xl"
                          style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
                        >
                          <p className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: '#f59e0b', fontFamily: 'Poppins, sans-serif' }}>
                            <AlertTriangle size={12} /> Note:
                          </p>
                          {listing.warnings.slice(0, 1).map((w, i) => (
                            <p key={i} className="text-xs" style={{ color: 'rgba(16,33,79,0.8)', fontFamily: 'Poppins, sans-serif' }}>• {w}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Listings Map ─────────────────────────────────────────────── */}
      {!loading && processedListings.some((l) => l.latitude && l.longitude) && (
        <div
          style={{
            maxWidth: 1296,
            margin: '0 auto',
            padding: '0 clamp(16px, 4vw, 48px) 80px',
          }}
        >
          <h2
            style={{
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
              fontSize: 24,
              fontWeight: 400,
              color: '#10214F',
              marginBottom: 16,
            }}
          >
            Listings Map
          </h2>
          <ListingsMap
            listings={processedListings
              .filter((l) => l.latitude && l.longitude)
              .map((l) => ({
                id: l.id,
                title: l.title,
                price: l.price,
                currency: l.currency,
                make: l.make,
                model: l.model,
                year: l.year,
                city: l.city,
                state: l.state,
                latitude: l.latitude!,
                longitude: l.longitude!,
                featured: l.featured,
              }))}
          />
        </div>
      )}
    </div>
  );
}

function ListingsLoading() {
  return <div className="min-h-screen section-light" />;
}

export default function UnifiedListingsPage() {
  return (
    <Suspense fallback={<ListingsLoading />}>
      <UnifiedListingsContent />
    </Suspense>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const accInputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'Poppins, sans-serif',
  color: '#10214F',
  width: '100%',
  backgroundColor: '#FFFFFF',
};

function FilterAccordion({
  label, isOpen, onToggle, children, noBorder = false,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between"
        style={{ padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 500 }}>
          {label}
        </span>
        <ChevronDown
          size={18}
          style={{
            color: '#10214F',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        />
      </button>
      {isOpen && (
        <div style={{ paddingBottom: 8 }}>
          {children}
        </div>
      )}
      {!noBorder && <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }} />}
    </div>
  );
}

// Radio-style inline option picker (Condition, Power/Sail, Fuel, Hull Material)
function FilterOptions({
  options, values, value, onChange,
}: {
  options: string[];
  values?: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 4 }}>
      {options.map((opt, i) => {
        const val = values ? values[i] : opt.toLowerCase();
        const active = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(active ? '' : val)}
            className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md transition-colors text-left"
            style={{ backgroundColor: active ? 'rgba(1,187,220,0.1)' : 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${active ? '#01BBDC' : 'rgba(16,33,79,0.3)'}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#01BBDC', display: 'block' }} />}
            </span>
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, color: active ? '#01BBDC' : '#10214F', fontWeight: active ? 500 : 400 }}>
              {opt}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Searchable scrollable list (Type, Manufacturer, Model)
function FilterSearchList({
  items, value, search, onSearchChange, onChange, placeholder, emptyMsg,
}: {
  items: string[];
  value: string;
  search: string;
  onSearchChange: (v: string) => void;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyMsg?: string;
}) {
  const filtered = search
    ? items.filter((it) => it.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <Search
          size={13}
          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(16,33,79,0.35)', pointerEvents: 'none' }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder || 'Search...'}
          className="w-full focus:outline-none"
          style={{ ...accInputStyle, paddingLeft: 28, paddingTop: 7, paddingBottom: 7, fontSize: 13 }}
        />
      </div>
      <div style={{ maxHeight: 168, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(16,33,79,0.4)', fontFamily: 'Poppins, sans-serif', padding: '6px 4px' }}>
            {emptyMsg || 'No results'}
          </p>
        ) : (
          filtered.map((item) => {
            const active = value === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onChange(active ? '' : item)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors"
                style={{ backgroundColor: active ? 'rgba(1,187,220,0.1)' : 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  border: `2px solid ${active ? '#01BBDC' : 'rgba(16,33,79,0.25)'}`,
                  backgroundColor: active ? '#01BBDC' : 'transparent',
                }} />
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: active ? '#01BBDC' : '#10214F', fontWeight: active ? 500 : 400 }}>
                  {item}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}