'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Destination } from '@/app/lib/destinationData';
import { apiUrl } from '@/app/lib/apiRoot';
import { MapPin, Anchor, Users, Waves } from 'lucide-react';

interface CharterListingPreview {
  id: number;
  title: string;
  vessel_name: string;
  boat_type?: string;
  length_feet?: number;
  cabins?: number;
  max_guests?: number;
  day_rate?: number;
  week_rate?: number;
  currency: string;
  home_port_city?: string;
  operating_regions?: string;
  images?: Array<{ url: string; is_primary?: boolean } | string>;
}

interface DestinationListingsProps {
  destination: Destination;
  limit?: number;
}

export default function DestinationListings({ destination, limit = 6 }: DestinationListingsProps) {
  const [listings, setListings] = useState<CharterListingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListings() {
      try {
        setLoading(true);
        
        // Build query params from destination search filters
        const params = new URLSearchParams();
        const filters = destination.searchFilters || {};

        if (filters.operatingRegions) {
          const regions = Array.isArray(filters.operatingRegions) 
            ? filters.operatingRegions 
            : [filters.operatingRegions];
          regions.forEach(r => params.append('region', r));
        }

        if (filters.country) {
          const countries = Array.isArray(filters.country) 
            ? filters.country 
            : [filters.country];
          countries.forEach(c => params.append('country', c));
        }

        if (filters.state) {
          params.append('state', filters.state);
        }

        params.append('limit', limit.toString());

        const res = await fetch(`${apiUrl}/api/charter?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch charters');
        
        const data = await res.json();
        setListings(data.charters || []);
      } catch (err) {
        console.error('Error fetching listings:', err);
        setError('Unable to load listings');
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, [destination, limit]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">Loading available charters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600 mb-4">No charters available in this region yet.</p>
        <Link href="/charter" className="text-blue-600 hover:text-blue-700 font-medium">
          Browse all available charters →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Available Yachts</h2>
          <p className="text-gray-600">
            Explore {listings.length} {listings.length === 1 ? 'yacht' : 'yachts'} available for charter in {destination.name}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => {
            const imageUrl = listing.images && listing.images.length > 0
              ? typeof listing.images[0] === 'string' ? listing.images[0] : listing.images[0].url
              : '/images/placeholder-yacht.jpg';

            return (
              <Link key={listing.id} href={`/charter/${listing.id}`}>
                <div className="group h-full bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all">
                  {/* Image */}
                  <div className="relative h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={listing.vessel_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.currentTarget.src = '/images/placeholder-yacht.jpg';
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {listing.vessel_name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{listing.boat_type}</p>

                    {/* Specs Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-4 py-3 border-t border-gray-200">
                      {listing.length_feet && (
                        <div className="flex items-center gap-1 text-sm">
                          <Waves size={16} className="text-gray-500" />
                          <span className="text-gray-600">{listing.length_feet}ft</span>
                        </div>
                      )}
                      {listing.cabins && (
                        <div className="flex items-center gap-1 text-sm">
                          <Anchor size={16} className="text-gray-500" />
                          <span className="text-gray-600">{listing.cabins} cabins</span>
                        </div>
                      )}
                      {listing.max_guests && (
                        <div className="flex items-center gap-1 text-sm">
                          <Users size={16} className="text-gray-500" />
                          <span className="text-gray-600">
                            {listing.max_guests} {listing.max_guests === 1 ? 'guest' : 'guests'}
                          </span>
                        </div>
                      )}
                      {listing.home_port_city && (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin size={16} className="text-gray-500" />
                          <span className="text-gray-600">{listing.home_port_city}</span>
                        </div>
                      )}
                    </div>

                    {/* Pricing */}
                    {(listing.day_rate || listing.week_rate) && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        {listing.day_rate && (
                          <p className="text-sm font-semibold text-gray-900">
                            ${listing.day_rate.toLocaleString()} {listing.currency}/day
                          </p>
                        )}
                        {listing.week_rate && (
                          <p className="text-sm text-gray-600">
                            ${listing.week_rate.toLocaleString()} {listing.currency}/week
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {listings.length === limit && (
          <div className="mt-8 text-center">
            <Link 
              href={`/search?region=${destination.slug}`}
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View All Charters in {destination.name}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
