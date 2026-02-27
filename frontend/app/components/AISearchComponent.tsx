'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Mic, MicOff, Sparkles, X, Volume2, Star, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

interface MatchReason {
  text: string;
  isWarning: boolean;
}

interface SearchResult {
  listing: {
    id: number;
    title: string;
    price: number;
    currency: string;
    year: number;
    make: string;
    model: string;
    boat_type: string;
    length_feet: number;
    cabins: number;
    berths: number;
    city: string;
    state: string;
    images: Array<{ url: string }>;
    featured: boolean;
  };
  match_score: number;
  match_reasons: string[];
  warnings: string[] | null;
}

interface AISearchResponse {
  query: string;
  understood_criteria: any;
  total_found: number;
  results: SearchResult[];
  message?: string;
}

export default function AISearchComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AISearchResponse | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [error, setError] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Check for query parameter on load
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
      handleSearch(urlQuery);
    }
  }, [searchParams]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setSpeechSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setQuery(transcript);
          setIsListening(false);
          // Auto-search after voice input
          handleSearch(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setError('Voice input failed. Please try again or type your search.');
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!speechSupported) {
      setError('Voice input is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setError('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) {
      setError('Please enter or speak what you\'re looking for');
      return;
    }

    setIsSearching(true);
    setError('');
    setShowSuggestions(false);

    try {
      const response = await fetch(apiUrl('/search/ai'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          max_results: 10
        })
      });

      if (response.ok) {
        const data: AISearchResponse = await response.json();
        setSearchResults(data);
      } else {
        setError('Search failed. Please try again.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to connect to search service.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const viewInListings = () => {
    if (searchResults) {
      // Navigate to listings page with AI query
      router.push(`/listings?ai_query=${encodeURIComponent(searchResults.query)}`);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 75) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 95) return 'Perfect Match';
    if (score >= 85) return 'Excellent Match';
    if (score >= 75) return 'Great Match';
    if (score >= 60) return 'Good Match';
    return 'Possible Match';
  };

  const suggestions = [
    "I need a yacht that can fit 10 people for a party",
    "Fishing boat under $500k in Florida",
    "Luxury motor yacht 80+ feet for Mediterranean cruising",
    "Family-friendly sailboat with 3 cabins under $300k",
    "Fast sport fishing boat in the Caribbean",
    "Budget-friendly cruiser for coastal trips, under $200k"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">AI Yacht Search</h1>
          </div>
          <p className="text-gray-600">
            Tell us what you're looking for in plain English, or use your voice
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Input */}
        <div className="bg-secondary text-light rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g., 'I need a yacht for 10 people for parties' or 'Fishing boat under $500k in Florida'"
                className="w-full px-6 py-4 text-lg border-2 border-light/30 bg-secondary/70 text-light placeholder:text-light/70 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={isListening || isSearching}
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setSearchResults(null);
                    setShowSuggestions(true);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-light/70 hover:text-light"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {speechSupported && (
              <button
                onClick={toggleVoiceInput}
                disabled={isSearching}
                className={`px-6 py-4 rounded-xl font-semibold transition-all ${
                  isListening
                    ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
            )}

            <button
              onClick={() => handleSearch()}
              disabled={isSearching || isListening || !query.trim()}
              className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Search
                </>
              )}
            </button>
          </div>

          {isListening && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium flex items-center gap-2">
                <Mic className="animate-pulse" size={20} />
                Listening... Speak now!
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Example Queries */}
        {showSuggestions && !searchResults && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-blue-600" />
              Try asking:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-left p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 text-sm text-gray-700 hover:text-gray-900"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Understanding */}
        {searchResults && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">🧠 What I understood:</h3>
              <button
                onClick={viewInListings}
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refine with Filters →
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchResults.understood_criteria.boat_types && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Type: {searchResults.understood_criteria.boat_types.join(', ')}
                </span>
              )}
              {searchResults.understood_criteria.min_price && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Budget: ${searchResults.understood_criteria.min_price.toLocaleString()}+
                </span>
              )}
              {searchResults.understood_criteria.max_price && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Max: ${searchResults.understood_criteria.max_price.toLocaleString()}
                </span>
              )}
              {searchResults.understood_criteria.min_berths && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  Capacity: {searchResults.understood_criteria.min_berths}+ people
                </span>
              )}
              {searchResults.understood_criteria.min_length && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                  Length: {searchResults.understood_criteria.min_length}+ ft
                </span>
              )}
              {searchResults.understood_criteria.use_case && (
                <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm">
                  Purpose: {searchResults.understood_criteria.use_case}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {searchResults && (
          <>
            {searchResults.message ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                <p className="text-yellow-800">{searchResults.message}</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Found {searchResults.total_found} yachts - Top {searchResults.results.length} matches:
                  </h2>
                </div>

                <div className="space-y-6">
                  {searchResults.results.map((result, idx) => (
                    <div
                      key={result.listing.id}
                      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                    >
                      <div className="p-6">
                        {/* Score Badge */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`px-4 py-2 rounded-lg font-bold text-lg border-2 ${getScoreColor(result.match_score)}`}>
                              {result.match_score}%
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                #{idx + 1} {getScoreBadge(result.match_score)}
                              </p>
                              {result.match_score >= 90 && (
                                <p className="text-sm text-green-600 flex items-center gap-1">
                                  <Star size={14} fill="currentColor" />
                                  Highly recommended
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => speakText(`${getScoreBadge(result.match_score)}. ${result.listing.title}. ${result.match_reasons.join('. ')}`)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Read aloud"
                          >
                            <Volume2 size={20} />
                          </button>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                          {/* Image */}
                          <div className="md:col-span-1">
                            {result.listing.images && result.listing.images.length > 0 ? (
                              <img
                                src={result.listing.images[0].url}
                                alt={result.listing.title}
                                className="w-full h-48 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                                <Search className="text-gray-400" size={48} />
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="md:col-span-2">
                            <Link href={`/listings/${result.listing.id}`}>
                              <h3 className="text-xl font-bold text-gray-900 hover:text-blue-600 mb-2">
                                {result.listing.title}
                              </h3>
                            </Link>
                            
                            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                              <div><span className="text-gray-600">Price:</span> <span className="font-semibold">${result.listing.price?.toLocaleString()}</span></div>
                              <div><span className="text-gray-600">Year:</span> <span className="font-semibold">{result.listing.year}</span></div>
                              <div><span className="text-gray-600">Length:</span> <span className="font-semibold">{result.listing.length_feet} ft</span></div>
                              <div><span className="text-gray-600">Type:</span> <span className="font-semibold">{result.listing.boat_type}</span></div>
                              <div><span className="text-gray-600">Cabins:</span> <span className="font-semibold">{result.listing.cabins || 'N/A'}</span></div>
                              <div><span className="text-gray-600">Sleeps:</span> <span className="font-semibold">{result.listing.berths || 'N/A'}</span></div>
                            </div>

                            {/* Match Reasons */}
                            <div className="space-y-2">
                              <p className="font-semibold text-sm text-gray-700">Why this matches:</p>
                              {result.match_reasons.map((reason, i) => (
                                <p key={i} className="text-sm text-green-700 flex items-start gap-2">
                                  <span className="text-green-500">✓</span>
                                  {reason.replace('✓ ', '')}
                                </p>
                              ))}
                              {result.warnings && result.warnings.map((warning, i) => (
                                <p key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                                  {warning}
                                </p>
                              ))}
                            </div>

                            <Link
                              href={`/listings/${result.listing.id}`}
                              className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              View Details
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}