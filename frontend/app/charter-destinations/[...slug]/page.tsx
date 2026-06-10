'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import {
  getDestinationBySlug,
  getSubregionsForRegion,
  getRegionForSubregion,
  Destination
} from '@/app/lib/destinationData';
import DestinationHero from '@/app/components/charter-destinations/DestinationHero';
import DestinationInfo from '@/app/components/charter-destinations/DestinationInfo';
import DestinationListings from '@/app/components/charter-destinations/DestinationListings';
import SubRegionNavigation from '@/app/components/charter-destinations/SubRegionNavigation';

export default function DestinationDetail() {
  const params = useParams();
  const slugArray = Array.isArray(params.slug) ? params.slug : [params.slug];
  
  const [destination, setDestination] = useState<Destination | null>(null);
  const [parentRegion, setParentRegion] = useState<Destination | null>(null);
  const [subregions, setSubregions] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle both region and sub-region paths
    let dest: Destination | undefined;
    let parent: Destination | undefined = null;
    let subs: Destination[] = [];

    if (slugArray.length === 1) {
      // Single slug - could be region or subregion
      dest = getDestinationBySlug(slugArray[0]);
      
      if (dest?.type === 'region') {
        // It's a region - get its subregions
        subs = getSubregionsForRegion(dest.slug);
      } else if (dest?.type === 'subregion') {
        // It's a subregion - get its parent region
        parent = getRegionForSubregion(dest.slug);
      }
    } else if (slugArray.length === 2) {
      // Two slugs - [region]/[subregion]
      const regionSlug = slugArray[0];
      const subregionSlug = slugArray[1];
      
      parent = getDestinationBySlug(regionSlug);
      dest = getDestinationBySlug(subregionSlug);
      
      // Verify parent-child relationship
      if (dest?.type !== 'subregion' || dest.parentRegion !== regionSlug) {
        setDestination(null);
        setLoading(false);
        return;
      }
    }

    if (!dest) {
      setDestination(null);
      setLoading(false);
      return;
    }

    setDestination(dest);
    setParentRegion(parent || null);
    setSubregions(subs);
    setLoading(false);
  }, [slugArray]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading destination...</p>
      </div>
    );
  }

  if (!destination) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <DestinationHero 
        destination={destination} 
        parentRegion={parentRegion || undefined}
        showBreadcrumb={!!parentRegion}
      />

      {/* Info Section */}
      <DestinationInfo destination={destination} />

      {/* Listings Section */}
      <DestinationListings destination={destination} limit={9} />

      {/* Sub-Regions (if this is a region with sub-regions) */}
      {subregions.length > 0 && (
        <SubRegionNavigation 
          subregions={subregions} 
          parentSlug={destination.slug}
        />
      )}

      {/* Footer CTA */}
      <div className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to Book Your {destination.name} Charter?
          </h2>
          <p className="text-gray-600 mb-8">
            Browse available yachts above, compare options, or use our AI search to find your perfect match.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/search?region=${destination.slug}`}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Search by {destination.name}
            </a>
            <a
              href="/search"
              className="px-8 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Browse All Charters
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
