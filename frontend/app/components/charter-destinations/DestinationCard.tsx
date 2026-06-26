'use client';

import Link from 'next/link';
import { Destination } from '@/app/lib/destinationData';
import { ArrowRight } from 'lucide-react';

interface DestinationCardProps {
  destination: Destination;
  includedLocations?: Array<{ name: string; href: string }>;
}

const DESTINATION_FALLBACK_IMAGE = '/images/hero-yacht3.png';
const LOGO_FALLBACK_IMAGE = '/logo/logo-icon.png';

export default function DestinationCard({ destination, includedLocations = [] }: DestinationCardProps) {
  const href = destination.type === 'region' 
    ? `/charter-destinations/${destination.slug}`
    : `/charter-destinations/${destination.parentRegion}/${destination.slug}`;

  return (
    <div className="group h-full overflow-hidden border border-gray-200 bg-white hover:border-primary hover:shadow-md transition-all duration-200 hover-rise">
      <Link href={href} className="block">
        {/* Hero Image */}
        <div className="relative h-64 overflow-hidden bg-gray-200">
          <img
            src={destination.heroImage}
            alt={destination.heroImageAlt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const img = e.currentTarget;
              const currentSrc = img.getAttribute('src') || '';
              if (currentSrc !== DESTINATION_FALLBACK_IMAGE) {
                img.src = DESTINATION_FALLBACK_IMAGE;
                return;
              }
              img.src = LOGO_FALLBACK_IMAGE;
              img.classList.remove('object-cover');
              img.classList.add('object-contain', 'p-8', 'bg-white');
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-6 bg-white">
          <h3 className="text-xl font-semibold text-gray-900 group-hover:text-primary transition-colors" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            {destination.name}
          </h3>
          <p className="text-sm text-gray-600 mt-1 font-poppins">{destination.subtitle}</p>

          {/* Destination quick-links (region cards only) */}
          {destination.type === 'region' && includedLocations.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-poppins mb-2">Destinations</p>
              <div className="flex flex-wrap gap-2" onClick={(e) => e.preventDefault()}>
                {includedLocations.map((location) => (
                  <Link
                    key={`${destination.slug}-${location.name}`}
                    href={location.href}
                    className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-[#10214F] hover:border-primary hover:text-primary transition-colors font-poppins"
                  >
                    {location.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <p className="text-gray-700 text-sm mt-4 line-clamp-2 font-poppins">
            {destination.shortDescription}
          </p>

          {/* CTA */}
          <div className="mt-4 flex items-center text-primary font-medium text-sm group-hover:gap-2 transition-all">
            Explore {destination.type === 'region' ? 'region' : 'destination'}
            <ArrowRight size={16} className="ml-2" />
          </div>
        </div>
      </Link>
    </div>
  );
}
