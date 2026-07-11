'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronLeft, ChevronRight, ChevronDown, X, SlidersHorizontal,
} from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import { CHARTER_FEATURES } from '@/app/lib/charterFeatures';
import CharterCard, { CharterListing } from '@/app/components/CharterCard';

const CHARTER_TYPES = ['Sailboat', 'Catamaran', 'Yacht'] as const;

const PAGE_SIZE = 24;

const DESTINATION_GROUPS = [
  { region: 'Caribbean',             subregions: ['Virgin Islands', 'British Virgin Islands', 'Leeward Islands', 'St. Martin & St. Barts', 'St. Lucia', 'The Grenadines', 'Turks & Caicos'] },
  { region: 'Bahamas',               subregions: ['Exumas', 'Abacos'] },
  { region: 'Mediterranean',         subregions: ['Greece', 'Croatia', 'Balearic Islands', 'Italy', 'French Riviera', 'Turkey'] },
  { region: 'North America',         subregions: ['Florida', 'New England', 'Chesapeake Bay', 'Pacific Northwest', 'Alaska'] },
  { region: 'Asia-Pacific',          subregions: ['Thailand', 'Raja Ampat', 'Komodo', 'Whitsundays', 'New Zealand'] },
  { region: 'South & Central America', subregions: ['Belize', 'Costa Rica', 'Galápagos'] },
  { region: 'Northern Europe',       subregions: ['Norway', 'Sweden', 'Scotland'] },
  { region: 'Indian Ocean',          subregions: ['Maldives', 'Seychelles', 'Mauritius'] },
  { region: 'South Pacific',         subregions: ['Fiji', 'French Polynesia', 'Tonga'] },
];

function DateRangePicker({
  start, end, onStartChange, onEndChange,
}: {
  start: string; end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const { btnRef, panelRef, pos, measure } = useFixedDropdown(open, () => setOpen(false), 280);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  function toStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function handleDayClick(ds: string) {
    if (!start || (start && end)) {
      // start fresh
      onStartChange(ds);
      onEndChange('');
    } else {
      // second click: if before start, swap
      if (ds < start) {
        onEndChange(start);
        onStartChange(ds);
      } else {
        onEndChange(ds);
        setOpen(false);
      }
    }
  }

  function inRange(ds: string) {
    const s = start;
    const e = end || hovered || '';
    if (!s) return false;
    const lo = s < e ? s : e;
    const hi = s < e ? e : s;
    return ds > lo && ds < hi;
  }

  function isStart(ds: string) { return ds === start; }
  function isEnd(ds: string) { return !!end && ds === end; }

  const label = start && end
    ? `${start} → ${end}`
    : start
    ? `${start} → ?`
    : 'Dates';
  const active = !!(start || end);

  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long' });

  return (
    <div ref={ref} className="relative" style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={() => { if (!open) measure(); setOpen(o => !o); }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap"
        style={{
          fontFamily: 'Poppins, sans-serif',
          border: active ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.15)',
          backgroundColor: active ? 'rgba(1,187,220,0.06)' : '#FFFFFF',
          color: active ? '#01BBDC' : '#10214F',
        }}
      >
        {label}
        {active && (
          <span
            onClick={e => { e.stopPropagation(); onStartChange(''); onEndChange(''); }}
            className="ml-1 hover:text-red-400"
            style={{ lineHeight: 1 }}
          >
            <X size={12} />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 select-none"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 50, minWidth: 280 }}
        >
          {/* header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100">
              <ChevronLeft size={16} className="text-[#10214F]" />
            </button>
            <span className="text-sm font-semibold text-[#10214F]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
              {monthName} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100">
              <ChevronRight size={16} className="text-[#10214F]" />
            </button>
          </div>

          {/* day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* day cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = toStr(viewYear, viewMonth, day);
              const past = ds < todayStr;
              const sel = isStart(ds) || isEnd(ds);
              const ranged = inRange(ds);
              return (
                <button
                  key={ds}
                  disabled={past}
                  onMouseEnter={() => setHovered(ds)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => !past && handleDayClick(ds)}
                  className="relative h-8 w-full text-xs font-medium transition-colors"
                  style={{
                    color: past ? '#ccc' : sel ? '#fff' : ranged ? '#01BBDC' : '#10214F',
                    backgroundColor: sel ? '#01BBDC' : ranged ? 'rgba(1,187,220,0.12)' : 'transparent',
                    borderRadius: sel ? 8 : 0,
                    cursor: past ? 'default' : 'pointer',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* hint */}
          <p className="text-xs text-gray-400 text-center mt-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {!start ? 'Click a start date' : !end ? 'Click an end date' : 'Dates selected'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Positions a dropdown panel with `position: fixed` so it can escape the
 * filter row's `overflow-x-auto` scroll container (absolute panels inside a
 * scroll container get clipped). Returns coords computed from the trigger's
 * rect at open time; closes the dropdown on outside scroll or resize so the
 * panel never drifts away from its trigger.
 */
function useFixedDropdown(open: boolean, close: () => void, panelWidth: number) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const measure = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - panelWidth - 8)),
    });
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      // Scrolling inside the panel itself (e.g. a long option list) is fine
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  return { btnRef, panelRef, pos, measure };
}

function FilterDropdown({ label, active, children }: { label: string; active?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { btnRef, panelRef, pos, measure } = useFixedDropdown(open, () => setOpen(false), 220);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => { if (!open) measure(); setOpen(v => !v); }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
        style={{
          fontFamily: 'Poppins, sans-serif',
          border: active ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.15)',
          backgroundColor: active ? 'rgba(1,187,220,0.06)' : '#FFFFFF',
          color: active ? '#01BBDC' : '#10214F',
        }}
      >
        {label}
        <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="rounded-2xl overflow-hidden"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 50, backgroundColor: '#FFFFFF', border: '1px solid rgba(16,33,79,0.12)', boxShadow: '0 8px 32px rgba(16,33,79,0.14)', minWidth: 220 }}
        >
          <div className="p-4">{children}</div>
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: 'rgba(1,187,220,0.1)', color: '#01BBDC', border: '1px solid rgba(1,187,220,0.3)', fontFamily: 'Poppins, sans-serif' }}
    >
      {label}
      <button onClick={onRemove} className="rounded-full p-0.5 hover:bg-[#01BBDC] hover:text-white transition-colors" aria-label={`Remove ${label} filter`}>
        <X size={10} />
      </button>
    </span>
  );
}

interface CharterBrowseContentProps {
  initialCharters?: CharterListing[];
  initialTotal?: number;
  hasInitialData?: boolean;
}

export default function CharterBrowseContent({
  initialCharters = [],
  initialTotal = 0,
  hasInitialData = false,
}: CharterBrowseContentProps) {
  const [charters, setCharters] = useState<CharterListing[]>(initialCharters);
  const [loading, setLoading] = useState(!hasInitialData);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Core filters
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [charterType, setCharterType] = useState('');
  const [minGuests, setMinGuests] = useState('');
  const [minCabins, setMinCabins] = useState('');
  const [crewIncluded, setCrewIncluded] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceMode, setPriceMode] = useState<'day' | 'week'>('day');

  // Advanced filters
  const [vesselName, setVesselName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [lengthRange, setLengthRange] = useState<[number, number]>([0, 300]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);
  const [exactCabins, setExactCabins] = useState('');
  const [features, setFeatures] = useState<string[]>([]);

  // Facet data from API
  const [facets, setFacets] = useState<{
    makes: string[];
    models: { make: string; model: string }[];
    cabins: number[];
    length: { min: number; max: number };
    day_rate: { min: number; max: number };
    week_rate: { min: number; max: number };
  } | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Fetch facets once on mount
  useEffect(() => {
    fetch(apiUrl('/charter/facets'))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setFacets(data);
        setLengthRange([data.length.min, data.length.max]);
        setPriceRange([data.day_rate.min, data.day_rate.max]);
      })
      .catch(() => {});
  }, []);

  // Reset model when make changes
  useEffect(() => { setModel(''); }, [make]);

  const toggleFeature = (f: string) =>
    setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const facetLengthMin = facets?.length.min ?? 0;
  const facetLengthMax = facets?.length.max ?? 300;
  const facetPriceMin = priceMode === 'day' ? (facets?.day_rate.min ?? 0) : (facets?.week_rate.min ?? 0);
  const facetPriceMax = priceMode === 'day' ? (facets?.day_rate.max ?? 50000) : (facets?.week_rate.max ?? 300000);

  const filteredModels = facets?.models.filter(m => !make || m.make === make) ?? [];

  const fetchCharters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('q', search);
      if (charterType) params.set('charter_category', charterType.toLowerCase());
      if (location) params.set('location', location);
      if (minGuests) params.set('min_guests', minGuests);
      if (minCabins) params.set('min_cabins', minCabins);
      if (crewIncluded) params.set('crew_included', crewIncluded);
      if (maxPrice) {
        if (priceMode === 'day') params.set('max_day_rate', maxPrice);
        else params.set('max_week_rate', maxPrice);
      }
      if (tripStart) params.set('start_date', tripStart);
      if (tripEnd) params.set('end_date', tripEnd);
      // Advanced
      if (vesselName) params.set('vessel_name', vesselName);
      if (make) params.set('make', make);
      if (model) params.set('model', model);
      if (exactCabins) params.set('exact_cabins', exactCabins);
      if (minYear) params.set('min_year', minYear);
      if (maxYear) params.set('max_year', maxYear);
      if (facets && lengthRange[0] > facetLengthMin) params.set('min_length', String(lengthRange[0]));
      if (facets && lengthRange[1] < facetLengthMax) params.set('max_length', String(lengthRange[1]));
      if (facets && priceRange[0] > facetPriceMin) {
        if (priceMode === 'day') params.set('min_day_rate', String(priceRange[0]));
        else params.set('min_week_rate', String(priceRange[0]));
      }
      if (facets && priceRange[1] < facetPriceMax) {
        if (priceMode === 'day') params.set('max_day_rate', String(priceRange[1]));
        else params.set('max_week_rate', String(priceRange[1]));
      }
      if (features.length) params.set('features', features.join(','));

      const res = await fetch(apiUrl(`/charter?${params}`));
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCharters(data.results ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setCharters([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, charterType, location, minGuests, minCabins, crewIncluded, maxPrice, priceMode, tripStart, tripEnd, vesselName, make, model, exactCabins, minYear, maxYear, lengthRange, priceRange, features, facets, facetLengthMin, facetLengthMax, facetPriceMin, facetPriceMax]);

  useEffect(() => { fetchCharters(); }, [fetchCharters]);

  const clearFilters = () => {
    setSearch(''); setCharterType(''); setLocation('');
    setMinGuests(''); setMinCabins(''); setCrewIncluded('');
    setMaxPrice(''); setPriceMode('day');
    setTripStart(''); setTripEnd('');
    setVesselName(''); setMake(''); setModel(''); setExactCabins('');
    setMinYear(''); setMaxYear('');
    setLengthRange([facetLengthMin, facetLengthMax]);
    setPriceRange([facetPriceMin, facetPriceMax]);
    setFeatures([]);
    setPage(1);
  };

  const lengthActive = facets ? (lengthRange[0] > facetLengthMin || lengthRange[1] < facetLengthMax) : false;
  const priceActive = facets ? (priceRange[0] > facetPriceMin || priceRange[1] < facetPriceMax) : false;

  const hasAdvancedFilters = !!(vesselName || make || model || exactCabins || minYear || maxYear || lengthActive || priceActive || features.length);
  const hasActiveFilters = !!(search || charterType || location || minGuests || minCabins || crewIncluded || maxPrice || tripStart || tripEnd || hasAdvancedFilters);

  const pills: { label: string; clear: () => void }[] = [];
  if (search)        pills.push({ label: `"${search}"`,                         clear: () => setSearch('') });
  if (charterType)   pills.push({ label: charterType,                           clear: () => setCharterType('') });
  if (location)      pills.push({ label: `📍 ${location}`,                      clear: () => setLocation('') });
  if (minGuests)     pills.push({ label: `${minGuests}+ guests`,                clear: () => setMinGuests('') });
  if (minCabins)     pills.push({ label: `${minCabins}+ cabins`,                clear: () => setMinCabins('') });
  if (crewIncluded)  pills.push({ label: crewIncluded === 'true' ? 'Crew included' : 'Bareboat', clear: () => setCrewIncluded('') });
  if (maxPrice)      pills.push({ label: `≤$${Number(maxPrice).toLocaleString()}/${priceMode}`, clear: () => setMaxPrice('') });
  if (tripStart || tripEnd) pills.push({ label: `${tripStart || 'Any'} → ${tripEnd || 'Any'}`, clear: () => { setTripStart(''); setTripEnd(''); } });
  if (vesselName)    pills.push({ label: `Vessel: ${vesselName}`,               clear: () => setVesselName('') });
  if (make)          pills.push({ label: make,                                  clear: () => setMake('') });
  if (model)         pills.push({ label: model,                                 clear: () => setModel('') });
  if (exactCabins)   pills.push({ label: `${exactCabins} cabins`,               clear: () => setExactCabins('') });
  if (lengthActive)  pills.push({ label: `${lengthRange[0]}–${lengthRange[1]} ft`, clear: () => setLengthRange([facetLengthMin, facetLengthMax]) });
  if (priceActive)   pills.push({ label: `$${priceRange[0].toLocaleString()}–$${priceRange[1].toLocaleString()}/${priceMode}`, clear: () => setPriceRange([facetPriceMin, facetPriceMax]) });
  if (minYear || maxYear) pills.push({ label: `${minYear || '?'}–${maxYear || 'present'}`, clear: () => { setMinYear(''); setMaxYear(''); } });
  features.forEach(f => pills.push({ label: f, clear: () => toggleFeature(f) }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F9FC' }}>

      {/* Hero */}
      <div className="bg-[#10214F] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Search Charters</h1>
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-2 flex flex-col sm:flex-row items-stretch gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, make, or model..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full h-full pl-11 pr-4 py-3 rounded-xl text-gray-900 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={minGuests}
                    onChange={e => { setMinGuests(e.target.value); setPage(1); }}
                    className="appearance-none w-full sm:w-auto pl-3 pr-8 py-3 rounded-xl text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: '#F5F7FA', color: minGuests ? '#01BBDC' : '#10214F', fontWeight: minGuests ? 600 : 400 }}
                  >
                    <option value="">Guests</option>
                    {[2, 4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n}+ guests</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#10214F]" />
                </div>
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={minCabins}
                    onChange={e => { setMinCabins(e.target.value); setPage(1); }}
                    className="appearance-none w-full sm:w-auto pl-3 pr-8 py-3 rounded-xl text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: '#F5F7FA', color: minCabins ? '#01BBDC' : '#10214F', fontWeight: minCabins ? 600 : 400 }}
                  >
                    <option value="">Cabins</option>
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+ cabins</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#10214F]" />
                </div>
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={maxPrice}
                    onChange={e => { setMaxPrice(e.target.value); setPage(1); }}
                    className="appearance-none w-full sm:w-auto pl-3 pr-8 py-3 rounded-xl text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: '#F5F7FA', color: maxPrice ? '#01BBDC' : '#10214F', fontWeight: maxPrice ? 600 : 400 }}
                  >
                    <option value="">Max Price</option>
                    {(priceMode === 'day'
                      ? [2500, 5000, 10000, 25000, 50000]
                      : [10000, 25000, 50000, 100000, 250000]
                    ).map(n => <option key={n} value={n}>≤ ${n.toLocaleString()}/{priceMode}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#10214F]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div ref={filterBarRef} className="sticky top-0 z-40" style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid rgba(16,33,79,0.08)', boxShadow: '0 2px 12px rgba(16,33,79,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Row 1: filter chips — never wrap */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">

            {/* Destination */}
            <div className="relative">
              <select
                value={location}
                onChange={e => { setLocation(e.target.value); setPage(1); }}
                className="appearance-none px-3 py-2 pr-7 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer focus:outline-none"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  border: location ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.15)',
                  backgroundColor: location ? 'rgba(1,187,220,0.06)' : '#FFFFFF',
                  color: location ? '#01BBDC' : '#10214F',
                }}
              >
                <option value="">Destination</option>
                {DESTINATION_GROUPS.map(group => (
                  <optgroup key={group.region} label={group.region}>
                    <option value={group.region}>{group.region} (all)</option>
                    {group.subregions.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: location ? '#01BBDC' : '#10214F' }} />
            </div>

            {/* Date range */}
            <DateRangePicker
              start={tripStart}
              end={tripEnd}
              onStartChange={v => { setTripStart(v); setPage(1); }}
              onEndChange={v => { setTripEnd(v); setPage(1); }}
            />

            {/* Charter Type */}
            <FilterDropdown label="Charter Type" active={!!charterType}>
              <div className="flex flex-col gap-1">
                {CHARTER_TYPES.map(t => (
                  <button key={t} onClick={() => { setCharterType(charterType === t ? '' : t); setPage(1); }}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: charterType === t ? 'rgba(1,187,220,0.08)' : 'transparent', color: charterType === t ? '#01BBDC' : '#10214F', fontWeight: charterType === t ? 600 : 400 }}>
                    {t}
                  </button>
                ))}
              </div>
            </FilterDropdown>

            {/* Guests */}
            <FilterDropdown label="Guests" active={!!minGuests}>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Minimum guests</label>
              <input type="number" placeholder="e.g. 8" min={1} value={minGuests} onChange={e => { setMinGuests(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
              <p className="text-xs text-gray-400 mt-1.5">Shows vessels that accommodate at least this many guests.</p>
            </FilterDropdown>

            {/* Cabins */}
            <FilterDropdown label="Cabins" active={!!minCabins}>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Minimum cabins</label>
              <input type="number" placeholder="e.g. 4" min={1} value={minCabins} onChange={e => { setMinCabins(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
            </FilterDropdown>

            {/* Max Price */}
            <FilterDropdown label={`Max Price${maxPrice ? ` · $${Number(maxPrice).toLocaleString()}/${priceMode}` : ''}`} active={!!maxPrice}>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Price basis</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-3">
                <button
                  onClick={() => { setPriceMode('day'); setPage(1); }}
                  className="flex-1 py-2 text-xs font-medium transition-colors"
                  style={{ backgroundColor: priceMode === 'day' ? '#01BBDC' : '#FFFFFF', color: priceMode === 'day' ? '#FFFFFF' : '#6b7280' }}
                >
                  Per Day
                </button>
                <button
                  onClick={() => { setPriceMode('week'); setPage(1); }}
                  className="flex-1 py-2 text-xs font-medium transition-colors"
                  style={{ backgroundColor: priceMode === 'week' ? '#01BBDC' : '#FFFFFF', color: priceMode === 'week' ? '#FFFFFF' : '#6b7280' }}
                >
                  Per Week
                </button>
              </div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Max {priceMode === 'day' ? 'daily' : 'weekly'} rate (USD)
              </label>
              <input type="number" placeholder={priceMode === 'day' ? 'e.g. 10,000' : 'e.g. 50,000'} min={0} value={maxPrice}
                onChange={e => { setMaxPrice(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
            </FilterDropdown>

            {/* Crew */}
            <FilterDropdown label="Crew" active={!!crewIncluded}>
              <div className="flex flex-col gap-1">
                {[{ label: 'Any', value: '' }, { label: 'Crew included', value: 'true' }, { label: 'Bareboat', value: 'false' }].map(opt => (
                  <button key={opt.value} onClick={() => { setCrewIncluded(opt.value); setPage(1); }}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: crewIncluded === opt.value ? 'rgba(1,187,220,0.08)' : 'transparent', color: crewIncluded === opt.value ? '#01BBDC' : '#10214F', fontWeight: crewIncluded === opt.value ? 600 : 400 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </FilterDropdown>

            {/* Spacer + Advanced Search */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setAdvancedOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  border: (advancedOpen || hasAdvancedFilters) ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.15)',
                  backgroundColor: (advancedOpen || hasAdvancedFilters) ? 'rgba(1,187,220,0.06)' : '#FFFFFF',
                  color: (advancedOpen || hasAdvancedFilters) ? '#01BBDC' : '#10214F',
                }}
              >
                <SlidersHorizontal size={14} />
                Advanced Search
                {hasAdvancedFilters && <span className="ml-1 bg-[#01BBDC] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{[vesselName, make, model, exactCabins, (minYear || maxYear), lengthActive, priceActive, ...features].filter(Boolean).length}</span>}
              </button>

              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>

          </div>

          {/* Row 2: active filter pills */}
          {pills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {pills.map(p => <FilterPill key={p.label} label={p.label} onRemove={p.clear} />)}
            </div>
          )}
        </div>

        {/* Advanced Search Panel */}
        {advancedOpen && (
          <div style={{ backgroundColor: '#F8F9FC', borderTop: '1px solid rgba(16,33,79,0.08)' }}>
            <div className="max-w-7xl mx-auto px-4 py-5">
              {/* Row 1: Make / Model / Cabins / Vessel Name / Build Year */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">

                {/* Make */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Make</label>
                  <select value={make} onChange={e => { setMake(e.target.value); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] bg-white">
                    <option value="">All makes</option>
                    {(facets?.makes ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Model</label>
                  <select value={model} onChange={e => { setModel(e.target.value); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] bg-white"
                    disabled={filteredModels.length === 0}>
                    <option value="">All models</option>
                    {filteredModels.map(m => <option key={m.model} value={m.model}>{m.model}</option>)}
                  </select>
                </div>

                {/* Cabins */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Cabins</label>
                  <select value={exactCabins} onChange={e => { setExactCabins(e.target.value); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] bg-white">
                    <option value="">Any</option>
                    {(facets?.cabins ?? []).map(c => <option key={c} value={String(c)}>{c} cabin{c !== 1 ? 's' : ''}</option>)}
                  </select>
                </div>

                {/* Vessel Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Vessel Name</label>
                  <input type="text" placeholder="e.g. Sea Dream" value={vesselName}
                    onChange={e => { setVesselName(e.target.value); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] bg-white" />
                </div>

                {/* Build Year */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Build Year</label>
                  <div className="flex items-center gap-2">
                    <input type="number" placeholder="From" min={1950} max={new Date().getFullYear()} value={minYear}
                      onChange={e => { setMinYear(e.target.value); setPage(1); }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] bg-white" />
                    <span className="text-gray-400 text-xs">–</span>
                    <input type="number" placeholder="To" min={1950} max={new Date().getFullYear()} value={maxYear}
                      onChange={e => { setMaxYear(e.target.value); setPage(1); }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] bg-white" />
                  </div>
                </div>

              </div>

              {/* Row 2: Length + Price sliders */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">

                {/* Length slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Length (ft)</label>
                    <span className="text-xs text-[#01BBDC] font-medium">{lengthRange[0]} – {lengthRange[1]} ft</span>
                  </div>
                  <div className="relative h-5 flex items-center">
                    <div className="absolute w-full h-1 bg-gray-200 rounded" />
                    <div
                      className="absolute h-1 bg-[#01BBDC] rounded"
                      style={{
                        left: `${((lengthRange[0] - facetLengthMin) / Math.max(facetLengthMax - facetLengthMin, 1)) * 100}%`,
                        right: `${100 - ((lengthRange[1] - facetLengthMin) / Math.max(facetLengthMax - facetLengthMin, 1)) * 100}%`,
                      }}
                    />
                    <input type="range" min={facetLengthMin} max={facetLengthMax} value={lengthRange[0]}
                      onChange={e => { const v = Number(e.target.value); setLengthRange(([, hi]) => [Math.min(v, hi - 1), hi]); setPage(1); }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#01BBDC] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow" />
                    <input type="range" min={facetLengthMin} max={facetLengthMax} value={lengthRange[1]}
                      onChange={e => { const v = Number(e.target.value); setLengthRange(([lo]) => [lo, Math.max(v, lo + 1)]); setPage(1); }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#01BBDC] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow" />
                  </div>
                </div>

                {/* Price slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</label>
                      <div className="flex rounded overflow-hidden border border-gray-200">
                        <button onClick={() => { setPriceMode('day'); setPriceRange([facets?.day_rate.min ?? 0, facets?.day_rate.max ?? 50000]); setPage(1); }}
                          className="px-2 py-0.5 text-xs transition-colors"
                          style={{ backgroundColor: priceMode === 'day' ? '#01BBDC' : '#fff', color: priceMode === 'day' ? '#fff' : '#6b7280' }}>Day</button>
                        <button onClick={() => { setPriceMode('week'); setPriceRange([facets?.week_rate.min ?? 0, facets?.week_rate.max ?? 300000]); setPage(1); }}
                          className="px-2 py-0.5 text-xs transition-colors"
                          style={{ backgroundColor: priceMode === 'week' ? '#01BBDC' : '#fff', color: priceMode === 'week' ? '#fff' : '#6b7280' }}>Week</button>
                      </div>
                    </div>
                    <span className="text-xs text-[#01BBDC] font-medium">${priceRange[0].toLocaleString()} – ${priceRange[1].toLocaleString()}</span>
                  </div>
                  <div className="relative h-5 flex items-center">
                    <div className="absolute w-full h-1 bg-gray-200 rounded" />
                    <div
                      className="absolute h-1 bg-[#01BBDC] rounded"
                      style={{
                        left: `${((priceRange[0] - facetPriceMin) / Math.max(facetPriceMax - facetPriceMin, 1)) * 100}%`,
                        right: `${100 - ((priceRange[1] - facetPriceMin) / Math.max(facetPriceMax - facetPriceMin, 1)) * 100}%`,
                      }}
                    />
                    <input type="range" min={facetPriceMin} max={facetPriceMax} step={priceMode === 'day' ? 500 : 5000} value={priceRange[0]}
                      onChange={e => { const v = Number(e.target.value); setPriceRange(([, hi]) => [Math.min(v, hi - 1), hi]); setPage(1); }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#01BBDC] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow" />
                    <input type="range" min={facetPriceMin} max={facetPriceMax} step={priceMode === 'day' ? 500 : 5000} value={priceRange[1]}
                      onChange={e => { const v = Number(e.target.value); setPriceRange(([lo]) => [lo, Math.max(v, lo + 1)]); setPage(1); }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#01BBDC] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow" />
                  </div>
                </div>

              </div>

              {/* Row 3: Features */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Features</label>
                <div className="flex flex-wrap gap-1.5">
                  {CHARTER_FEATURES.map(f => (
                    <button key={f} onClick={() => { toggleFeature(f); setPage(1); }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                      style={{
                        border: features.includes(f) ? '1px solid #01BBDC' : '1px solid rgba(16,33,79,0.15)',
                        backgroundColor: features.includes(f) ? 'rgba(1,187,220,0.1)' : '#FFFFFF',
                        color: features.includes(f) ? '#01BBDC' : '#6b7280',
                      }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {loading ? 'Loading…' : `${total.toLocaleString()} charter option${total !== 1 ? 's' : ''} available`}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="h-52 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : charters.length === 0 ? (
          <div className="text-center py-24">
            <img src="/logo/logo-icon.png" alt="YachtVersal" className="w-16 h-16 object-contain mx-auto mb-4 opacity-60" />
            <h3 className="text-gray-500 font-medium text-lg mb-1">The fleet is out to sea</h3>
            <p className="text-gray-400 text-sm mb-4">No yachts match your search yet—try a different destination or adjust your filters.</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[#01BBDC] hover:underline text-sm">Clear all filters</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {charters.map(c => <CharterCard key={c.id} charter={c} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
