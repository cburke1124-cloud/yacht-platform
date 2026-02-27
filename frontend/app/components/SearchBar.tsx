'use client';

import { useState } from 'react';
import {
  Search,
  Sparkles,
  Mic,
  X,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

interface SearchBarProps {
  onSearch?: (filters: any) => void;
  showAIOption?: boolean;
}

export default function SearchBar({
  onSearch,
  showAIOption = true
}: SearchBarProps) {
  const router = useRouter();
  const [searchMode, setSearchMode] = useState<'basic' | 'ai'>('basic');
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [boatType, setBoatType] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [isAISearching, setIsAISearching] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (onSearch) {
      onSearch({ query, minPrice, maxPrice, boatType, minYear, maxYear, condition, location });
    } else {
      const params = new URLSearchParams();
      if (query) params.append('search', query);
      if (minPrice) params.append('min_price', minPrice);
      if (maxPrice) params.append('max_price', maxPrice);
      if (boatType) params.append('boat_type', boatType);
      if (minYear) params.append('min_year', minYear);
      if (maxYear) params.append('max_year', maxYear);
      if (condition) params.append('condition', condition);
      if (location) params.append('state', location);
      router.push(`/listings?${params.toString()}`);
    }
  };

  const handleAISearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    setIsAISearching(true);
    try {
      const res = await fetch(apiUrl('/search/ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery, max_results: 20 })
      });

      if (res.ok) {
        router.push(`/listings?ai_query=${encodeURIComponent(aiQuery)}`);
      } else {
        alert('Search failed. Please try again.');
      }
    } catch {
      alert('Search failed. Please check your connection.');
    } finally {
      setIsAISearching(false);
    }
  };

  return (
    <div className="w-full">
      {/* Mode Toggle */}
      {showAIOption && (
        <div className="flex justify-center mb-4">
          <div className="inline-flex backdrop-blur-xl bg-white/70 rounded-xl shadow-lg p-1 border border-primary/20">
            <button
              type="button"
              onClick={() => setSearchMode('basic')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                searchMode === 'basic'
                  ? 'bg-primary text-white shadow'
                  : 'text-dark hover:bg-primary/10'
              }`}
            >
              <Search size={16} className="inline mr-2" />
              Quick Search
            </button>

            <button
              type="button"
              onClick={() => setSearchMode('ai')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                searchMode === 'ai'
                  ? 'bg-accent text-dark shadow'
                  : 'text-dark hover:bg-accent/20'
              }`}
            >
              <Sparkles size={16} className="inline mr-2" />
              AI Search
            </button>
          </div>
        </div>
      )}

      {/* BASIC SEARCH */}
      {searchMode === 'basic' && (
        <div className="rounded-2xl border border-primary/20 bg-white/70 p-4 shadow-lg">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by make, model, or keyword..."
                className="w-full pl-12 pr-4 py-4 rounded-xl backdrop-blur-xl bg-white/80 border border-primary/20 text-dark placeholder:text-dark/50 focus:ring-2 focus:ring-primary focus:outline-none shadow-lg"
              />
            </div>

            {/* Price + Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid grid-cols-2 rounded-xl backdrop-blur-xl bg-white/80 border border-primary/20 shadow-lg overflow-hidden">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="px-4 py-4 bg-transparent text-dark placeholder:text-dark/50 border-r border-primary/20 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="px-4 py-4 bg-transparent text-dark placeholder:text-dark/50 focus:outline-none"
                />
              </div>

              <select
                value={boatType}
                onChange={(e) => setBoatType(e.target.value)}
                className="px-4 py-4 rounded-xl backdrop-blur-xl bg-white/80 border border-primary/20 text-dark focus:ring-2 focus:ring-primary shadow-lg"
              >
                <option value="">All Types</option>
                <option>Motor Yacht</option>
                <option>Sailing Yacht</option>
                <option>Catamaran</option>
                <option>Sport Fishing</option>
                <option>Center Console</option>
                <option>Trawler</option>
              </select>
            </div>

            {/* Year + Condition + Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="grid grid-cols-2 rounded-xl backdrop-blur-xl bg-white/80 border border-primary/20 shadow-lg overflow-hidden">
                <input
                  type="number"
                  placeholder="Year Min"
                  value={minYear}
                  onChange={(e) => setMinYear(e.target.value)}
                  className="px-4 py-4 bg-transparent text-dark placeholder:text-dark/50 border-r border-primary/20 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Year Max"
                  value={maxYear}
                  onChange={(e) => setMaxYear(e.target.value)}
                  className="px-4 py-4 bg-transparent text-dark placeholder:text-dark/50 focus:outline-none"
                />
              </div>

              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="px-4 py-4 rounded-xl backdrop-blur-xl bg-white/80 border border-primary/20 text-dark focus:ring-2 focus:ring-primary shadow-lg"
              >
                <option value="">Any Condition</option>
                <option value="New">New</option>
                <option value="Used">Used</option>
              </select>

              <input
                type="text"
                placeholder="State or Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="px-4 py-4 rounded-xl backdrop-blur-xl bg-white/80 border border-primary/20 text-dark placeholder:text-dark/50 focus:ring-2 focus:ring-primary focus:outline-none shadow-lg"
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-primary text-white font-bold text-lg shadow-xl hover:scale-[1.02] transition"
              >
                Search Yachts
              </button>

              <button
                type="button"
                onClick={() => router.push('/listings')}
                className="w-full py-4 rounded-xl backdrop-blur-xl bg-white/80 border border-primary/20 text-dark font-semibold shadow-lg hover:bg-white transition"
              >
                Browse All Listings
              </button>
            </div>
            </div>
          </form>
        </div>
      )}

      {/* AI SEARCH */}
      {searchMode === 'ai' && (
        <form onSubmit={handleAISearch}>
          <div className="backdrop-blur-xl bg-secondary rounded-2xl p-6 border border-light/20 shadow-xl text-light">
            <div className="flex gap-3 mb-4">
              <Sparkles className="text-accent mt-1" size={22} />
              <div>
                <h3 className="font-bold text-light">
                  Describe what you're looking for
                </h3>
                <p className="text-sm text-light/80">
                  Use natural language to describe your ideal yacht.
                </p>
              </div>
            </div>

            <div className="relative mb-4">
              <textarea
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                rows={3}
                placeholder="Luxury motor yacht around 80 feet..."
                className="w-full px-4 py-4 rounded-xl backdrop-blur-xl bg-secondary/70 border border-light/30 text-light placeholder:text-light/60 focus:ring-2 focus:ring-primary resize-none shadow-lg"
              />
              {aiQuery && (
                <button
                  type="button"
                  onClick={() => setAiQuery('')}
                  className="absolute top-3 right-3 text-light/60 hover:text-light"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isAISearching}
                className="flex-1 py-3 rounded-xl bg-accent text-dark font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                {isAISearching ? 'Searching…' : (
                  <>
                    <Sparkles size={18} />
                    Find My Yacht
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                className="px-5 py-3 rounded-xl backdrop-blur-xl bg-secondary/70 border border-light/30 text-light shadow-lg"
              >
                <Mic />
              </button>
            </div>
          </div>
        </form>
      )}

    </div>
  );
}
