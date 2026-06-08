'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search, Anchor, Bed, Users, Ruler,
  ChevronLeft, ChevronRight, ChevronDown, X,
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface CharterListing {
  id: number;
  title: string;
  slug: string;
  vessel_name: string;
  make?: string;
  model?: string;
  year?: number;
  length_feet?: number;
  boat_type?: string;
  home_port?: string;
  home_port_city?: string;
  home_port_state?: string;
  home_port_country?: string;
  operating_regions?: string;
  day_rate?: number;
  week_rate?: number;
  currency: string;
  min_charter_days?: number;
  max_guests?: number;
  cabins?: number;
  crew_included: boolean;
  images?: Array<{ url: string } | string>;
  status: string;
  charter_company_name?: string;
  charter_company_slug?: string;
  availability_blocks?: Array<{ start_date: string; end_date: string; status: string }>;
}

const BOAT_TYPES = ['Motor Yacht', 'Sailing Yacht', 'Catamaran', 'Mega Yacht', 'Superyacht', 'Trawler'];
const PAGE_SIZE = 24;

const DESTINATIONS = [
  { label: 'Caribbean',              flag: '🌴', query: 'Caribbean' },
  { label: 'Greece',                 flag: '🇬🇷', query: 'Greece' },
  { label: 'Croatia',                flag: '🇭🇷', query: 'Croatia' },
  { label: 'Italy',                  flag: '🇮🇹', query: 'Italy' },
  { label: 'France',                 flag: '🇫🇷', query: 'France' },
  { label: 'Spain',                  flag: '🇪🇸', query: 'Spain' },
  { label: 'Turkey',                 flag: '🇹🇷', query: 'Turkey' },
  { label: 'British Virgin Islands', flag: '🇻🇬', query: 'British Virgin Islands' },
  { label: 'Bahamas',                flag: '🇧🇸', query: 'Bahamas' },
  { label: 'Florida',                flag: '🇺🇸', query: 'Florida' },
  { label: 'Thailand',               flag: '🇹🇭', query: 'Thailand' },
  { label: 'Maldives',               flag: '🇲🇻', query: 'Maldives' },
];

function FilterDropdown({ label, active, children }: { label: string; active?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
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
          className="absolute left-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(16,33,79,0.12)', boxShadow: '0 8px 32px rgba(16,33,79,0.14)', minWidth: 220 }}
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

function CharterCard({ charter }: { charter: CharterListing }) {
  const imageUrl = (() => {
    if (!charter.images?.length) return null;
    const first = charter.images[0];
    return mediaUrl(typeof first === 'string' ? first : first.url);
  })();
  const formatRate = (rate?: number, period?: string) => {
    if (!rate) return null;
    return `${charter.currency === 'USD' ? '$' : charter.currency}${rate.toLocaleString()} / ${period}`;
  };
  const displayRate = formatRate(charter.day_rate, 'day') || formatRate(charter.week_rate, 'week') || 'Contact for pricing';

  return (
    <Link href={`/charter/${charter.id}`} className="group block bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-[#01BBDC] hover:shadow-md transition-all duration-200">
      <div className="relative h-52 bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={charter.title} onError={onImgError} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Anchor className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {charter.crew_included && (
          <span className="absolute top-3 left-3 bg-[#01BBDC] text-white text-xs font-semibold px-2 py-1 rounded-full">Crew Included</span>
        )}
        {charter.boat_type && (
          <span className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">{charter.boat_type}</span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-[#01BBDC] transition-colors">{charter.title}</h3>
        <p className="text-sm text-gray-500 mt-0.5 truncate">
          {[charter.home_port_city, charter.home_port_state, charter.home_port_country].filter(Boolean).join(', ') || charter.home_port || charter.operating_regions || 'Location TBD'}
        </p>
        <div className="flex items-center gap-3 mt-3 text-sm text-gray-500 flex-wrap">
          {charter.max_guests && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{charter.max_guests} guests</span>}
          {charter.cabins && <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{charter.cabins} cabins</span>}
          {charter.length_feet && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{charter.length_feet}ft</span>}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[#01BBDC] font-semibold text-sm">{displayRate}</span>
          {charter.charter_company_name && <span className="text-xs text-gray-400 truncate max-w-[120px]">{charter.charter_company_name}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function CharterPage() {
  const [charters, setCharters] = useState<CharterListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const filterBarRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [boatType, setBoatType] = useState('');
  const [location, setLocation] = useState('');
  const [minLength, setMinLength] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [maxGuests, setMaxGuests] = useState('');
  const [crewIncluded, setCrewIncluded] = useState('');
  const [maxDayRate, setMaxDayRate] = useState('');
  const [duration, setDuration] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchCharters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('q', search);
      if (boatType) params.set('boat_type', boatType);
      if (location) params.set('location', location);
      if (minLength) params.set('min_length', minLength);
      if (maxLength) params.set('max_length', maxLength);
      if (maxGuests) params.set('min_guests', maxGuests);
      if (crewIncluded) params.set('crew_included', crewIncluded);
      if (maxDayRate) params.set('max_day_rate', maxDayRate);
      if (tripStart) params.set('start_date', tripStart);
      if (tripEnd) params.set('end_date', tripEnd);
      const durationMaxDays: Record<string, number> = { day: 1, weekend: 3, week: 7 };
      if (duration && durationMaxDays[duration]) params.set('max_min_days', String(durationMaxDays[duration]));
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
  }, [page, search, boatType, location, minLength, maxLength, maxGuests, crewIncluded, maxDayRate, duration, tripStart, tripEnd]);

  useEffect(() => { fetchCharters(); }, [fetchCharters]);

  const clearFilters = () => {
    setSearch(''); setBoatType(''); setLocation('');
    setMinLength(''); setMaxLength(''); setMaxGuests('');
    setCrewIncluded(''); setMaxDayRate(''); setDuration(''); setTripStart(''); setTripEnd(''); setPage(1);
  };

  const hasActiveFilters = !!(search || boatType || location || minLength || maxLength || maxGuests || crewIncluded || maxDayRate || duration || tripStart || tripEnd);

  const pills: { label: string; clear: () => void }[] = [];
  if (search)       pills.push({ label: `"${search}"`,                      clear: () => setSearch('') });
  if (boatType)     pills.push({ label: boatType,                           clear: () => setBoatType('') });
  if (location)     pills.push({ label: `📍 ${location}`,                   clear: () => setLocation('') });
  if (maxGuests)    pills.push({ label: `${maxGuests}+ guests`,              clear: () => setMaxGuests('') });
  if (duration)     pills.push({ label: ({ day: 'Day Charter', weekend: 'Weekend', week: 'Full Week' } as Record<string, string>)[duration] ?? duration, clear: () => setDuration('') });
  if (crewIncluded) pills.push({ label: crewIncluded === 'true' ? 'Crew included' : 'Bareboat', clear: () => setCrewIncluded('') });
  if (minLength || maxLength) pills.push({ label: `${minLength || '0'}–${maxLength || '∞'} ft`, clear: () => { setMinLength(''); setMaxLength(''); } });
  if (maxDayRate)   pills.push({ label: `≤$${Number(maxDayRate).toLocaleString()}/day`,         clear: () => setMaxDayRate('') });
  if (tripStart || tripEnd) pills.push({ label: `${tripStart || 'Any'} → ${tripEnd || 'Any'}`, clear: () => { setTripStart(''); setTripEnd(''); } });

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F9FC' }}>

      {/* Hero */}
      <div className="bg-[#10214F] text-white py-14 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Anchor className="w-6 h-6 text-[#C9A84C]" />
            <span className="text-[#C9A84C] uppercase tracking-widest text-sm font-medium" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Charter</span>
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Yacht Charter</h1>
          <p className="text-blue-200 text-lg max-w-xl mx-auto">Pick a destination, dates, and group size. We’ll show charters that fit the trip.</p>
          <div className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, make, or destination..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C] shadow-lg"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-blue-100 mb-1 text-left">Trip start</label>
                <input type="date" value={tripStart} onChange={e => { setTripStart(e.target.value); setPage(1); }} className="w-full px-4 py-3 rounded-xl text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C] shadow-lg" />
              </div>
              <div>
                <label className="block text-xs text-blue-100 mb-1 text-left">Trip end</label>
                <input type="date" value={tripEnd} min={tripStart || undefined} onChange={e => { setTripEnd(e.target.value); setPage(1); }} className="w-full px-4 py-3 rounded-xl text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C] shadow-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Destination quick-filters */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap mr-1">Destinations</span>
            {DESTINATIONS.map(dest => {
              const active = location === dest.query;
              return (
                <button
                  key={dest.query}
                  onClick={() => { setLocation(active ? '' : dest.query); setPage(1); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    border: active ? '1.5px solid #01BBDC' : '1.5px solid rgba(16,33,79,0.12)',
                    backgroundColor: active ? 'rgba(1,187,220,0.08)' : '#FAFAFA',
                    color: active ? '#01BBDC' : '#10214F',
                  }}
                >
                  <span className="text-base leading-none">{dest.flag}</span>
                  {dest.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div ref={filterBarRef} className="sticky top-0 z-40" style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid rgba(16,33,79,0.08)', boxShadow: '0 2px 12px rgba(16,33,79,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">

            <FilterDropdown label="Vessel Type" active={!!boatType}>
              <div className="flex flex-col gap-1">
                {BOAT_TYPES.map(t => (
                  <button key={t} onClick={() => { setBoatType(boatType === t ? '' : t); setPage(1); }}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: boatType === t ? 'rgba(1,187,220,0.08)' : 'transparent', color: boatType === t ? '#01BBDC' : '#10214F', fontWeight: boatType === t ? 600 : 400 }}>
                    {t}
                  </button>
                ))}
              </div>
            </FilterDropdown>

            <FilterDropdown label="Group Size" active={!!maxGuests}>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Guests in your group</label>
              <input type="number" placeholder="e.g. 8" min={1} value={maxGuests} onChange={e => { setMaxGuests(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
              <p className="text-xs text-gray-400 mt-1.5">Shows vessels that fit your group</p>
            </FilterDropdown>

            <FilterDropdown label="Duration" active={!!duration}>
              <div className="flex flex-col gap-1">
                {[
                  { label: 'Any', value: '' },
                  { label: 'Day Charter', value: 'day', sub: '1 day' },
                  { label: 'Weekend Escape', value: 'weekend', sub: '2–3 days' },
                  { label: 'Full Week', value: 'week', sub: '7 days' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => { setDuration(opt.value); setPage(1); }}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between"
                    style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: duration === opt.value ? 'rgba(1,187,220,0.08)' : 'transparent', color: duration === opt.value ? '#01BBDC' : '#10214F', fontWeight: duration === opt.value ? 600 : 400 }}>
                    <span>{opt.label}</span>
                    {'sub' in opt && <span className="text-xs text-gray-400 ml-2">{opt.sub}</span>}
                  </button>
                ))}
              </div>
            </FilterDropdown>

            <FilterDropdown label="Trip Dates" active={!!(tripStart || tripEnd)}>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">When are you traveling?</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={tripStart} onChange={e => { setTripStart(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                <input type="date" value={tripEnd} min={tripStart || undefined} onChange={e => { setTripEnd(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">We’ll hide yachts blocked for those dates.</p>
            </FilterDropdown>

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

            <FilterDropdown label="Length" active={!!(minLength || maxLength)}>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Length (ft)</label>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="Min" value={minLength} onChange={e => { setMinLength(e.target.value); setPage(1); }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                <span className="text-gray-400 text-xs">–</span>
                <input type="number" placeholder="Max" value={maxLength} onChange={e => { setMaxLength(e.target.value); setPage(1); }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
              </div>
            </FilterDropdown>

            <FilterDropdown label="Day Rate" active={!!maxDayRate}>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Max per day (USD)</label>
              <input type="number" placeholder="e.g. 10,000" min={0} value={maxDayRate} onChange={e => { setMaxDayRate(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
            </FilterDropdown>

            {pills.map(p => <FilterPill key={p.label} label={p.label} onRemove={p.clear} />)}

            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 ml-auto whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <X className="w-3.5 h-3.5" /> Clear all
              </button>
            )}
          </div>
        </div>
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
            <Anchor className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-500 font-medium text-lg mb-1">No charter vessels found</h3>
            <p className="text-gray-400 text-sm mb-4">Try a different destination or adjust your filters.</p>
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
