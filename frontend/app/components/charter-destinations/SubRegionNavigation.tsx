'use client';

import { Destination } from '@/app/lib/destinationData';
import DestinationCard from './DestinationCard';

interface SubRegionNavigationProps {
  subregions: Destination[];
  parentSlug: string;
}

export default function SubRegionNavigation({ subregions, parentSlug }: SubRegionNavigationProps) {
  if (!subregions || subregions.length === 0) return null;

  return (
    <div className="w-full bg-white py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Explore Sub-Regions
          </h2>
          <p className="text-gray-600">
            Dive deeper into specific locations within {subregions[0]?.parentRegion || 'this region'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subregions.map((subregion) => (
            <DestinationCard key={subregion.id} destination={subregion} />
          ))}
        </div>
      </div>
    </div>
  );
}
