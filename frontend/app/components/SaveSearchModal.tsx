import { useState, useEffect } from 'react';
import { Search, Filter, MapPin, DollarSign, Ruler, Ship, Calendar, Save, X } from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface SearchFilters {
  boat_type?: string;
  min_price?: number;
  max_price?: number;
  min_length?: number;
  max_length?: number;
  min_year?: number;
  condition?: string;
  continent?: string;
  country?: string;
  states?: string[];
  cabins?: number;
}

const CONTINENTS = [
  'North America',
  'Caribbean',
  'Europe',
  'Mediterranean',
  'Asia',
  'Pacific',
  'Middle East'
];

const BOAT_TYPES = [
  'Motor Yacht',
  'Sailing Yacht',
  'Sport Fishing',
  'Catamaran',
  'Center Console',
  'Trawler',
  'Express Cruiser',
  'Flybridge'
];

const US_STATES = [
  'Florida', 'California', 'Texas', 'New York', 'Washington',
  'North Carolina', 'South Carolina', 'Georgia', 'Massachusetts',
  'Rhode Island', 'Connecticut', 'Maryland', 'Virginia'
];

export default function AdvancedSearchPage() {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchFrequency, setSearchFrequency] = useState('daily');
  const [showFilters, setShowFilters] = useState(true);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/search/advanced'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSearch = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to save searches');
        return;
      }

      const response = await fetch(apiUrl('/search-alerts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: searchName,
          search_criteria: filters,
          frequency: searchFrequency
        })
      });

      if (response.ok) {
        alert('Search alert created! You\'ll receive notifications about new listings.');
        setShowSaveModal(false);
        setSearchName('');
      } else {
        alert('Failed to save search');
      }
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold mb-2">Advanced Search</h1>
          <p className="text-blue-100 text-lg">
            Find your perfect yacht with powerful search filters
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className={`lg:col-span-1 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Filters</h2>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {/* Boat Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Ship size={16} className="inline mr-2" />
                    Boat Type
                  </label>
                  <select
                    value={filters.boat_type || ''}
                    onChange={(e) => updateFilter('boat_type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    {BOAT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign size={16} className="inline mr-2" />
                    Price Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.min_price || ''}
                      onChange={(e) => updateFilter('min_price', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.max_price || ''}
                      onChange={(e) => updateFilter('max_price', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Length Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Ruler size={16} className="inline mr-2" />
                    Length (feet)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.min_length || ''}
                      onChange={(e) => updateFilter('min_length', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.max_length || ''}
                      onChange={(e) => updateFilter('max_length', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-2" />
                    Year (minimum)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2010"
                    value={filters.min_year || ''}
                    onChange={(e) => updateFilter('min_year', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Condition
                  </label>
                  <select
                    value={filters.condition || ''}
                    onChange={(e) => updateFilter('condition', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any</option>
                    <option value="new">New</option>
                    <option value="used">Used</option>
                  </select>
                </div>

                {/* Continent */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-2" />
                    Continent
                  </label>
                  <select
                    value={filters.continent || ''}
                    onChange={(e) => updateFilter('continent', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Continents</option>
                    {CONTINENTS.map(continent => (
                      <option key={continent} value={continent}>{continent}</option>
                    ))}
                  </select>
                </div>

                {/* US States (Multi-select) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    US States
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {US_STATES.map(state => (
                      <label key={state} className="flex items-center gap-2 py-1 hover:bg-gray-50 px-2 rounded">
                        <input
                          type="checkbox"
                          checked={filters.states?.includes(state) || false}
                          onChange={(e) => {
                            const current = filters.states || [];
                            if (e.target.checked) {
                              updateFilter('states', [...current, state]);
                            } else {
                              updateFilter('states', current.filter(s => s !== state));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{state}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Cabins */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min. Cabins
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filters.cabins || ''}
                    onChange={(e) => updateFilter('cabins', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                disabled={loading}
                className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
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
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {results.length} Results
                  </h2>
                  {activeFilterCount > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="lg:hidden px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Filter size={18} />
                    Filters
                  </button>
                  
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                  >
                    <Save size={18} />
                    Save Search
                  </button>
                </div>
              </div>
            </div>

            {/* Results Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : results.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <Search size={48} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">No results found</p>
                <p className="text-gray-500 text-sm">
                  Try adjusting your filters or search criteria
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.map((listing) => (
                  <div key={listing.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                    <div className="relative h-48 bg-gray-200">
                      <img
                        src={mediaUrl(listing.images[0]?.url)}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                        onError={onImgError}
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                        {listing.title}
                      </h3>
                      <p className="text-2xl font-bold text-blue-600 mb-2">
                        ${listing.price.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {listing.length_feet && <span>{listing.length_feet} ft</span>}
                        {listing.city && listing.state && (
                          <>
                            <span>•</span>
                            <span>{listing.city}, {listing.state}</span>
                          </>
                        )}
                      </div>
                      <a
                        href={`/listings/${listing.id}`}
                        className="block mt-4 px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        View Details
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Search Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Save This Search</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Get notified when new yachts match your search criteria
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Name
                </label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="e.g., Motor Yachts in Florida"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Frequency
                </label>
                <select
                  value={searchFrequency}
                  onChange={(e) => setSearchFrequency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="instant">Instant (as soon as listed)</option>
                  <option value="daily">Daily summary</option>
                  <option value="weekly">Weekly summary</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSearch}
                  disabled={!searchName}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Save Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
