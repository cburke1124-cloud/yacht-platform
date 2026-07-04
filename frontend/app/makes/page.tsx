'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/apiRoot';
import { ArrowRight, Ship, Search } from 'lucide-react';

interface CatalogMake {
  id: number;
  name: string;
  slug: string;
  country?: string;
  propulsion: string;
}

export default function MakesBrowse() {
  const [makes, setMakes] = useState<CatalogMake[]>([]);
  const [loading, setLoading] = useState(true);
  const [propulsionFilter, setPropulsionFilter] = useState<'all' | 'power' | 'sail'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchMakes() {
      try {
        setLoading(true);
        const res = await fetch(apiUrl('/catalog/makes'));
        if (!res.ok) throw new Error('Failed to fetch makes');
        const data: CatalogMake[] = await res.json();
        setMakes(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error fetching makes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMakes();
  }, []);

  const filteredMakes = useMemo(() => {
    return makes.filter((make) => {
      if (propulsionFilter !== 'all' && make.propulsion !== propulsionFilter && make.propulsion !== 'both') {
        return false;
      }
      if (search && !make.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [makes, propulsionFilter, search]);

  return (
    <div className="min-h-screen bg-soft">
      {/* Hero Section */}
      <div className="bg-secondary text-white py-16 px-4">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <h1
              className="text-4xl md:text-5xl font-bold"
              style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
            >
              Browse Boat Makes
            </h1>
            <p className="text-blue-100 mt-6 font-poppins">
              Explore builders from around the world—see their models, specialties, and boats currently for sale.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search makes…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 focus:border-primary focus:outline-none font-poppins"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'power', 'sail'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setPropulsionFilter(option)}
                className={`px-4 py-2.5 border font-medium text-sm transition-colors ${
                  propulsionFilter === option
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-[#10214F] border-gray-200 hover:border-primary'
                }`}
              >
                {option === 'all' ? 'All' : option === 'power' ? 'Power' : 'Sail'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 bg-white border border-gray-200 glass-card">
            <p className="text-gray-600 font-poppins">Loading makes...</p>
          </div>
        ) : filteredMakes.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 glass-card">
            <p className="text-gray-600 font-poppins">No makes match your search.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMakes.map((make) => (
              <Link key={make.id} href={`/makes/${make.slug}`}>
                <div className="group h-full bg-white border border-gray-200 p-6 hover:border-primary hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Ship className="text-primary" size={22} />
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                      {make.name}
                    </h3>
                  </div>
                  {make.country && <p className="text-sm text-gray-600 font-poppins">{make.country}</p>}
                  <div className="mt-4 flex items-center text-primary font-medium text-sm group-hover:gap-2 transition-all">
                    View builder
                    <ArrowRight size={16} className="ml-2" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Educational CTA */}
      <div className="bg-secondary text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Not Sure Which Builder Is Right for You?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Start with the type of boat you want, and we'll point you to the makes and models that build it.
          </p>
          <a
            href="/boat-types"
            className="inline-block px-8 py-3 bg-white text-[#10214F] hover:bg-gray-100 transition-colors font-medium btn-press"
          >
            Browse Boat Types
          </a>
        </div>
      </div>
    </div>
  );
}
