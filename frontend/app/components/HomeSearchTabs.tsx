'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import SearchBar from '@/app/components/SearchBar';

const SEL = [
  'h-11 px-3 text-sm rounded-lg border border-gray-200 bg-white',
  'text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40',
  'cursor-pointer shrink-0',
].join(' ');

const INPUT = [
  'h-11 px-3 text-sm rounded-lg border border-gray-200 bg-white',
  'text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40',
  'shrink-0',
].join(' ');

const CHARTER_CATEGORIES = ['Sailboat', 'Catamaran', 'Yacht'] as const;
const GUEST_OPTIONS = [2, 4, 6, 8, 10, 12];

type Tab = 'ai' | 'yacht' | 'charter';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai', label: 'AI Search' },
  { id: 'yacht', label: 'Yacht Search' },
  { id: 'charter', label: 'Charter Search' },
];

// Shared "bar" container style — mirrors SearchBar.tsx's own self-contained
// bordered/shadowed pill so all three tab panels read as the same component.
function Panel({ children, maxWidth }: { children: React.ReactNode; maxWidth: number }) {
  return (
    <div
      className="bg-white px-4 py-4 sm:px-5 sm:py-4 mx-auto"
      style={{
        maxWidth,
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      }}
    >
      {children}
    </div>
  );
}

function AISearchPanel() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/ai-search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <Panel maxWidth={799}>
      <form onSubmit={handleSearch} role="search" aria-label="AI yacht and charter search">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <label htmlFor="ai-search-input" className="sr-only">
            Describe your ideal yacht or charter
          </label>
          <div className="relative flex-1">
            <input
              id="ai-search-input"
              type="search"
              placeholder="70–90 ft yacht under $3M, or a week in the BVI for 8 people"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full focus:outline-none"
              style={{
                height: 52,
                border: '1.5px solid #E2E8F0',
                borderRadius: 999,
                backgroundColor: '#F8FAFC',
                paddingLeft: 22,
                paddingRight: 48,
                fontSize: 14,
                lineHeight: '21px',
                fontFamily: 'Poppins, sans-serif',
                color: '#10214F',
              }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
              <Sparkles size={18} style={{ color: '#01BBDC' }} />
            </span>
          </div>

          <button
            type="submit"
            aria-label="Run AI search"
            className="text-white font-medium transition-opacity hover:opacity-90 whitespace-nowrap w-full sm:w-auto"
            style={{
              backgroundColor: '#01BBDC',
              fontFamily: 'Poppins, sans-serif',
              fontSize: 15,
              lineHeight: '22px',
              fontWeight: 500,
              borderRadius: 999,
              height: 52,
              flexShrink: 0,
              paddingLeft: 22,
              paddingRight: 22,
            }}
          >
            Quick Search
          </button>
        </div>

        <p
          className="text-center flex items-center justify-center gap-2"
          style={{
            color: '#10214F',
            fontFamily: 'Poppins, sans-serif',
            fontSize: 13,
            lineHeight: '20px',
            marginTop: 14,
            opacity: 0.55,
          }}
        >
          <Sparkles size={13} style={{ color: '#01BBDC' }} />
          AI powered search matching lifestyle, size &amp; budget.
        </p>
      </form>
    </Panel>
  );
}

function CharterSearchPanel() {
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
    <Panel maxWidth={1200}>
      <form onSubmit={handleSearch} className="w-full">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Destination (e.g. BVI, Greece)"
            className={INPUT}
            style={{ minWidth: 200, flex: '2 1 200px' }}
          />

          <select value={charterCategory} onChange={(e) => setCharterCategory(e.target.value)} className={SEL} style={{ minWidth: 110, flexShrink: 0 }}>
            <option value="">Type</option>
            {CHARTER_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={minGuests} onChange={(e) => setMinGuests(e.target.value)} className={SEL} style={{ minWidth: 110, flexShrink: 0 }}>
            <option value="">Guests</option>
            {GUEST_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}+ guests</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={priceMode}
              onChange={(e) => setPriceMode(e.target.value as 'day' | 'week')}
              className={SEL}
              style={{ minWidth: 80 }}
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
              style={{ width: 120 }}
            />
          </div>

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
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            type="submit"
            className="h-11 px-5 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition shrink-0"
          >
            <Search size={15} />
            Search Charters
          </button>
          <button
            type="button"
            onClick={() => router.push('/charter')}
            className="h-11 px-3 rounded-lg text-xs font-medium text-gray-500 hover:text-primary hover:bg-gray-50 flex items-center gap-1 transition shrink-0 whitespace-nowrap border border-gray-200"
          >
            <SlidersHorizontal size={13} />
            Advanced Search+
          </button>
        </div>
      </form>
    </Panel>
  );
}

const MOBILE_FALLBACK: Record<Exclude<Tab, 'ai'>, { href: string; label: string }> = {
  yacht: { href: '/listings', label: 'Browse yachts with filters →' },
  charter: { href: '/charter', label: 'Browse charters with filters →' },
};

export default function HomeSearchTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('ai');

  return (
    <div className="w-full">
      {/* Tab bar — pill-style segmented control */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex bg-gray-100 rounded-full p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap"
              style={
                activeTab === tab.id
                  ? { backgroundColor: '#FFFFFF', color: '#10214F', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                  : { backgroundColor: 'transparent', color: 'rgba(16,33,79,0.55)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'ai' && <AISearchPanel />}

      {activeTab === 'yacht' && (
        <>
          <div className="hidden sm:block">
            <SearchBar />
          </div>
          <div className="sm:hidden text-center py-2">
            <a href={MOBILE_FALLBACK.yacht.href} className="text-sm font-medium text-primary">
              {MOBILE_FALLBACK.yacht.label}
            </a>
          </div>
        </>
      )}

      {activeTab === 'charter' && (
        <>
          <div className="hidden sm:block">
            <CharterSearchPanel />
          </div>
          <div className="sm:hidden text-center py-2">
            <a href={MOBILE_FALLBACK.charter.href} className="text-sm font-medium text-primary">
              {MOBILE_FALLBACK.charter.label}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
