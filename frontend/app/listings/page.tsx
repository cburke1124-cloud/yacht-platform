'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Sparkles, Save, SlidersHorizontal, X, AlertTriangle } from 'lucide-react';
import ListingCard from '../components/ListingCard';
import { apiUrl } from '@/app/lib/apiRoot';

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
        padding: '36px 40px',
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
        Find the Right Yacht — Without Endless Filters
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
        Tell us what you&apos;re looking for, and YachtVersal AI does the rest.
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

export default function UnifiedListingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchType, setSearchType] = useState<'basic' | 'ai'>('basic');
  const [aiQuery, setAiQuery] = useState('');

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    boat_type: searchParams.get('boat_type') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    min_length: searchParams.get('min_length') || '',
    max_length: searchParams.get('max_length') || '',
    min_year: searchParams.get('min_year') || '',
    state: searchParams.get('state') || '',
    city: searchParams.get('city') || '',
    condition: searchParams.get('condition') || '',
  });

  const BOAT_TYPES = [
    'Motor Yacht', 'Sailing Yacht', 'Catamaran', 'Trawler',
    'Express Cruiser', 'Sport Fisher', 'Center Console', 'Mega Yacht',
  ];
  const CONDITIONS = ['New', 'Used'];

  useEffect(() => { fetchListings(); }, []);

  const fetchListings = async (isAISearch = false) => {
    setLoading(true);
    try {
      let url = apiUrl('/listings?status=active');
      if (isAISearch && aiQuery) {
        url = apiUrl(`/ai/search?query=${encodeURIComponent(aiQuery)}`);
      } else {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) url += `&${key}=${encodeURIComponent(value)}`;
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

  const applyFilters = () => fetchListings(searchType === 'ai');

  const clearFilters = () => {
    setFilters({ search: '', boat_type: '', min_price: '', max_price: '', min_length: '', max_length: '', min_year: '', state: '', city: '', condition: '' });
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
              {listings.length.toLocaleString()} yacht{listings.length !== 1 ? 's' : ''} found
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
        <div className="flex gap-6 items-start">

          {/* ── FILTERS SIDEBAR (unchanged from original) ── */}
          <div
            className={`flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}
            style={{ width: 306 }}
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
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2
                    className="flex items-center gap-2"
                    style={{
                      color: '#10214F',
                      fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                      fontSize: 20,
                      lineHeight: '24px',
                      fontWeight: 400,
                    }}
                  >
                    <SlidersHorizontal size={18} style={{ color: '#01BBDC' }} />
                    Filters
                  </h2>
                  {Object.values(filters).some((v) => v) && (
                    <button
                      onClick={clearFilters}
                      className="text-sm font-medium transition-opacity hover:opacity-70"
                      style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="space-y-5">
                  {/* Keywords */}
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2"
                      style={{ color: 'rgba(16,33,79,0.8)', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 18 }}
                    >
                      Keywords
                    </label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,0,0,0.4)' }} />
                      <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        placeholder="Make, model..."
                        className="w-full focus:outline-none"
                        style={{
                          paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                          border: '2px solid #e5e7eb', borderRadius: 8, fontSize: 14,
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      />
                    </div>
                  </div>

                  <FilterRow label="Body type">
                    <select
                      value={filters.boat_type}
                      onChange={(e) => handleFilterChange('boat_type', e.target.value)}
                      className="w-full focus:outline-none"
                      style={selectStyle}
                    >
                      <option value="">All Types</option>
                      {BOAT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Make">
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      placeholder="Any make"
                      className="w-full focus:outline-none"
                      style={inputStyle}
                    />
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Location">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={filters.city}
                        onChange={(e) => handleFilterChange('city', e.target.value)}
                        placeholder="City"
                        className="flex-1 focus:outline-none"
                        style={inputStyle}
                      />
                      <input
                        type="text"
                        value={filters.state}
                        onChange={(e) => handleFilterChange('state', e.target.value)}
                        placeholder="State"
                        className="flex-1 focus:outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Condition">
                    <select
                      value={filters.condition}
                      onChange={(e) => handleFilterChange('condition', e.target.value)}
                      className="w-full focus:outline-none"
                      style={selectStyle}
                    >
                      <option value="">All Conditions</option>
                      {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Length (ft)">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={filters.min_length} onChange={(e) => handleFilterChange('min_length', e.target.value)} placeholder="Min" className="focus:outline-none" style={inputStyle} />
                      <input type="number" value={filters.max_length} onChange={(e) => handleFilterChange('max_length', e.target.value)} placeholder="Max" className="focus:outline-none" style={inputStyle} />
                    </div>
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Price">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={filters.min_price} onChange={(e) => handleFilterChange('min_price', e.target.value)} placeholder="Min" className="focus:outline-none" style={inputStyle} />
                      <input type="number" value={filters.max_price} onChange={(e) => handleFilterChange('max_price', e.target.value)} placeholder="Max" className="focus:outline-none" style={inputStyle} />
                    </div>
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Year">
                    <input type="number" value={filters.min_year} onChange={(e) => handleFilterChange('min_year', e.target.value)} placeholder="Min year" className="w-full focus:outline-none" style={inputStyle} />
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Engine Details">
                    <input type="text" placeholder="e.g. Twin diesel" className="w-full focus:outline-none" style={inputStyle} />
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Fuel">
                    <input type="text" placeholder="Diesel / Gas" className="w-full focus:outline-none" style={inputStyle} />
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Hull Material">
                    <input type="text" placeholder="Fibreglass, Steel…" className="w-full focus:outline-none" style={inputStyle} />
                  </FilterRow>

                  <FilterDivider />

                  <FilterRow label="Country">
                    <input type="text" placeholder="e.g. United States" className="w-full focus:outline-none" style={inputStyle} />
                  </FilterRow>

                  {/* Save Search + Apply */}
                  <div className="pt-2 flex flex-col gap-3">
                    <button
                      onClick={handleSaveSearch}
                      className="w-full py-3 font-medium transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: '#01BBDC',
                        color: '#FFFFFF',
                        borderRadius: 12,
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 16,
                      }}
                    >
                      Save Search
                    </button>
                    <button
                      onClick={applyFilters}
                      className="w-full py-3 font-medium transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: '#10214F',
                        color: '#FFFFFF',
                        borderRadius: 12,
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 16,
                      }}
                    >
                      Apply Filters
                    </button>
                  </div>
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

                {/* ── 3-column grid ── */}
                <div
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                  style={{ gap: 24 }}
                >
                  {listings.map((listing) => (
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
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block mb-2"
        style={{
          color: '#10214F',
          fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
          fontSize: 18,
          lineHeight: '22px',
          fontWeight: 400,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterDivider() {
  return (
    <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: 4, marginBottom: 4 }} />
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'Poppins, sans-serif',
  color: '#10214F',
  width: '100%',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'Poppins, sans-serif',
  color: '#10214F',
  width: '100%',
  backgroundColor: '#FFFFFF',
};