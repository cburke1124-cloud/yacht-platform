'use client';

import Image from 'next/image';
import { Destination } from '@/app/lib/destinationData';
import { MapPin, Heart } from 'lucide-react';

interface DestinationHeroProps {
  destination: Destination;
  showBreadcrumb?: boolean;
  parentRegion?: Destination;
}

export default function DestinationHero({ 
  destination, 
  showBreadcrumb = true,
  parentRegion 
}: DestinationHeroProps) {
  return (
    <div className="relative w-full">
      {/* Hero Image */}
      <div className="relative h-96 w-full bg-gray-200 overflow-hidden">
        <img
          src={destination.heroImage}
          alt={destination.heroImageAlt}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12">
          {showBreadcrumb && parentRegion && (
            <div className="mb-4">
              <a href={`/charter-destinations/${parentRegion.slug}`} className="text-blue-300 hover:text-blue-100 transition-colors text-sm">
                ← Back to {parentRegion.name}
              </a>
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            {destination.displayName}
          </h1>
          <p className="text-xl text-gray-100 max-w-2xl">
            {destination.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
