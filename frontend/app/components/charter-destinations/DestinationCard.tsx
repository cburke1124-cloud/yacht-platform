'use client';

import Link from 'next/link';
import { Destination } from '@/app/lib/destinationData';
import { ArrowRight } from 'lucide-react';

interface DestinationCardProps {
  destination: Destination;
}

const DESTINATION_FALLBACK_IMAGE = '/images/hero-yacht3.png';
const LOGO_FALLBACK_IMAGE = '/logo/logo-icon.png';

export default function DestinationCard({ destination }: DestinationCardProps) {
  const href = destination.type === 'region' 
    ? `/charter-destinations/${destination.slug}`
    : `/charter-destinations/${destination.parentRegion}/${destination.slug}`;

  return (
    <Link href={href}>
      <div className="group h-full cursor-pointer overflow-hidden border border-gray-200 bg-white hover:border-primary hover:shadow-md transition-all duration-200 hover-rise">
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
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 group-hover:text-primary transition-colors" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                {destination.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1 font-poppins">{destination.subtitle}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-700 text-sm mt-3 line-clamp-2 font-poppins">
            {destination.shortDescription}
          </p>

          {/* Best For */}
          <div className="mt-4 flex flex-wrap gap-1">
            {destination.bestFor.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block text-xs px-2 py-1 rounded"
                style={{ backgroundColor: 'rgba(1, 187, 220, 0.1)', color: '#01BBDC', border: '1px solid rgba(1, 187, 220, 0.3)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-4 flex items-center text-primary font-medium text-sm group-hover:gap-2 transition-all">
            Explore {destination.type === 'region' ? 'region' : 'location'}
            <ArrowRight size={16} className="ml-2" />
          </div>
        </div>
      </div>
    </Link>
  );
}
