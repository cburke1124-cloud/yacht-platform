'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import SearchBar from '@/app/components/SearchBar';

const SEL = [
  'h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white',
  'text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40',
  'cursor-pointer shrink-0',
].join(' ');

const INPUT = [
  'h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white',
  'text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40',
  'shrink-0',
].join(' ');

const CHARTER_CATEGORIES = ['Sailboat', 'Catamaran', 'Yacht'] as const;
const GUEST_OPTIONS = [2, 4, 6, 8, 10, 12];

function CharterSearchFilters() {
  const router = useRouter();

  const [destination, setDestination] = useState('');
  const [charterCategory, setCharterCategory] = useState('');
  const [minGuests, setMinGuests] = useState('');
  const [priceMode, setPriceMode] = useState<'day' | 'week'>('week');
  const [maxRate, setMaxRate] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();

    if (destination) params.set('region', destination);
    if (charterCategory) params.set('charter_category', charterCategory.toLowerCase());
    if (minGuests) params.set('min_guests', minGuests);
    if (maxRate) params.set(priceMode === 'day' ? 'max_day_rate' : 'max_week_rate', maxRate);
    if (minYear) params.set('min_year', minYear);
    if (maxYear) params.set('max_year', maxYear);

    const qs = params.toString();
    router.push(`/charter${qs ? `?${qs}` : ''}`);
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div
        className="flex flex-wrap items-center bg-white px-3 py-2 gap-2"
        style={{
          minHeight: 56,
          borderRadius: '0 0 12px 12px',
          border: '1px solid rgba(0,0,0,0.12)',
          borderTop: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Destination (e.g. BVI, Greece)"
          className={INPUT}
          style={{ minWidth: 160, flex: '1 1 160px' }}
        />

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        <select value={charterCategory} onChange={(e) => setCharterCategory(e.target.value)} className={SEL} style={{ minWidth: 100, flexShrink: 0 }}>
          <option value="">Type</option>
          {CHARTER_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        <select value={minGuests} onChange={(e) => setMinGuests(e.target.value)} className={SEL} style={{ minWidth: 100, flexShrink: 0 }}>
          <option value="">Guests</option>
          {GUEST_OPTIONS.map((g) => (
            <option key={g} value={g}>{g}+ guests</option>
          ))}
        </select>

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={priceMode}
            onChange={(e) => setPriceMode(e.target.value as 'day' | 'week')}
            className={SEL}
            style={{ minWidth: 70 }}
          >
            <option value="day">Per day</option>
            <option value="week">Per week</option>
          </select>
          <input
            type="number"
            value={maxRate}
            onChange={(e) => setMaxRate(e.target.value)}
            placeholder={`Max $/${priceMode}`}
            className={INPUT}
            style={{ width: 110 }}
          />
        </div>

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            value={minYear}
            onChange={(e) => setMinYear(e.target.value)}
            placeholder="Min year"
            className={INPUT}
            style={{ width: 90 }}
          />
          <input
            type="number"
            value={maxYear}
            onChange={(e) => setMaxYear(e.target.value)}
            placeholder="Max year"
            className={INPUT}
            style={{ width: 90 }}
          />
        </div>

        <span className="hidden sm:block text-gray-200 select-none">|</span>

        <button
          type="submit"
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition shrink-0"
        >
          <Search size={15} />
          Search
        </button>
        <button
          type="button"
          onClick={() => router.push('/charter')}
          className="h-10 px-3 rounded-lg text-xs font-medium text-gray-500 hover:text-primary hover:bg-gray-50 flex items-center gap-1 transition shrink-0 whitespace-nowrap border border-gray-200"
        >
          <SlidersHorizontal size={13} />
          Advanced Search+
        </button>
      </div>
    </form>
  );
}

export default function StructuredSearchTabs() {
  const [activeTab, setActiveTab] = useState<'yacht' | 'charter'>('yacht');

  return (
    <div className="w-full" style={{ maxWidth: 900 }}>
      <div className="flex">
        <button
          type="button"
          onClick={() => setActiveTab('yacht')}
          className="flex-1 sm:flex-none px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors"
          style={{
            borderRadius: '12px 0 0 0',
            backgroundColor: activeTab === 'yacht' ? '#FFFFFF' : '#01BBDC',
            color: activeTab === 'yacht' ? '#10214F' : '#FFFFFF',
          }}
        >
          Yacht Search
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('charter')}
          className="flex-1 sm:flex-none px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors"
          style={{
            backgroundColor: activeTab === 'charter' ? '#FFFFFF' : '#01BBDC',
            color: activeTab === 'charter' ? '#10214F' : '#FFFFFF',
          }}
        >
          Charter Search
        </button>
      </div>

      {activeTab === 'yacht' ? (
        <SearchBar squareTop />
      ) : (
        <CharterSearchFilters />
      )}
    </div>
  );
}
