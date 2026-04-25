'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, MapPin, Anchor, Calendar, Users, Ruler, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
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
  day_rate?: number;
  week_rate?: number;
  currency: string;
  min_charter_days?: number;
  max_guests?: number;
  crew_included: boolean;
  images?: Array<{ url: string } | string>;
  status: string;
  charter_company_name?: string;
  charter_company_slug?: string;
}

const BOAT_TYPES = ['Motor Yacht', 'Sailing Yacht', 'Catamaran', 'Mega Yacht', 'Superyacht', 'Trawler'];
const PAGE_SIZE = 24;

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
    <Link href={`/charter/${charter.id}`} className="group block bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-primary hover:shadow-md transition-all duration-200">
      {/* Image */}
      <div className="relative h-52 bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={charter.title}
            onError={onImgError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Anchor className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {charter.crew_included && (
          <span className="absolute top-3 left-3 bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full">
            Crew Included
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-primary transition-colors">
          {charter.title}
        </h3>

        <div className="flex items-center gap-1 mt-1 text-gray-500 text-sm">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {[charter.home_port_city, charter.home_port_state, charter.home_port_country].filter(Boolean).join(', ') || charter.home_port || 'Location TBD'}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
          {charter.length_feet && (
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />
              {charter.length_feet}ft
            </span>
          )}
          {charter.max_guests && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {charter.max_guests} guests
            </span>
          )}
          {charter.min_charter_days && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {charter.min_charter_days}d min
            </span>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-primary font-semibold">{displayRate}</span>
          {charter.charter_company_name && (
            <span className="text-xs text-gray-400 truncate max-w-[120px]">{charter.charter_company_name}</span>
          )}
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
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState('');
  const [boatType, setBoatType] = useState('');
  const [location, setLocation] = useState('');
  const [minLength, setMinLength] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [maxGuests, setMaxGuests] = useState('');
  const [crewIncluded, setCrewIncluded] = useState('');
  const [maxDayRate, setMaxDayRate] = useState('');

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchCharters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (boatType) params.set('boat_type', boatType);
      if (location) params.set('location', location);
      if (minLength) params.set('min_length', minLength);
      if (maxLength) params.set('max_length', maxLength);
      if (maxGuests) params.set('max_guests', maxGuests);
      if (crewIncluded) params.set('crew_included', crewIncluded);
      if (maxDayRate) params.set('max_day_rate', maxDayRate);

      const res = await fetch(apiUrl(`/charter?${params}`));
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCharters(data.charters ?? data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setCharters([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, boatType, location, minLength, maxLength, maxGuests, crewIncluded, maxDayRate]);

  useEffect(() => {
    fetchCharters();
  }, [fetchCharters]);

  const clearFilters = () => {
    setSearch('');
    setBoatType('');
    setLocation('');
    setMinLength('');
    setMaxLength('');
    setMaxGuests('');
    setCrewIncluded('');
    setMaxDayRate('');
    setPage(1);
  };

  const hasActiveFilters = !!(search || boatType || location || minLength || maxLength || maxGuests || crewIncluded || maxDayRate);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#10214F] text-white py-14 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Anchor className="w-7 h-7 text-[#C9A84C]" />
            <span className="text-[#C9A84C] uppercase tracking-widest text-sm font-medium" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Charter</span>
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Yacht Charter
          </h1>
          <p className="text-blue-200 text-lg max-w-xl mx-auto">
            Find your perfect charter vessel — from day trips to extended voyages worldwide.
          </p>

          {/* Search bar */}
          <div className="mt-8 flex gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, make, location..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              />
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${showFilters ? 'bg-[#C9A84C] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Filters</h3>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vessel Type</label>
                <select value={boatType} onChange={(e) => { setBoatType(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">All types</option>
                  {BOAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                <input type="text" placeholder="City, state, country..." value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Guests</label>
                <input type="number" placeholder="e.g. 12" min={1} value={maxGuests} onChange={(e) => { setMaxGuests(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Crew</label>
                <select value={crewIncluded} onChange={(e) => { setCrewIncluded(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Any</option>
                  <option value="true">Crew included</option>
                  <option value="false">Bareboat</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min Length (ft)</label>
                <input type="number" placeholder="e.g. 40" min={0} value={minLength} onChange={(e) => { setMinLength(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Length (ft)</label>
                <input type="number" placeholder="e.g. 200" min={0} value={maxLength} onChange={(e) => { setMaxLength(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Day Rate (USD)</label>
                <input type="number" placeholder="e.g. 10000" min={0} value={maxDayRate} onChange={(e) => { setMaxDayRate(e.target.value); setPage(1); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
          </div>
        )}

        {/* Results header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-gray-600 text-sm">
            {loading ? 'Loading...' : `${total.toLocaleString()} charter vessel${total !== 1 ? 's' : ''} available`}
          </p>
          {hasActiveFilters && !showFilters && (
            <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>

        {/* Grid */}
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
          <div className="text-center py-20">
            <Anchor className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-500 font-medium text-lg mb-1">No charter vessels found</h3>
            <p className="text-gray-400 text-sm mb-4">Try adjusting your filters or check back soon.</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-primary hover:underline text-sm">Clear all filters</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {charters.map(c => <CharterCard key={c.id} charter={c} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
