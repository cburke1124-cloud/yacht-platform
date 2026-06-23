'use client';

import { Destination } from '@/app/lib/destinationData';

interface DestinationHeroProps {
  destination: Destination;
  showBreadcrumb?: boolean;
  parentRegion?: Destination;
}

const DESTINATION_HERO_FALLBACK = '/images/cannes-luxury-yacht-port.jpg';
const LOGO_FALLBACK_IMAGE = '/logo/logo-icon.png';

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
          onError={(e) => {
            const img = e.currentTarget;
            const currentSrc = img.getAttribute('src') || '';
            if (currentSrc !== DESTINATION_HERO_FALLBACK) {
              img.src = DESTINATION_HERO_FALLBACK;
              return;
            }
            img.src = LOGO_FALLBACK_IMAGE;
            img.classList.remove('object-cover');
            img.classList.add('object-contain', 'p-10', 'bg-white');
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12">
          {showBreadcrumb && parentRegion && (
            <div className="mb-4">
              <a href={`/charter-destinations/${parentRegion.slug}`} className="text-[#C9A84C] hover:text-[#e0c987] transition-colors text-sm">
                ← Back to {parentRegion.name}
              </a>
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            {destination.displayName}
          </h1>
          <p className="text-xl text-gray-100 max-w-2xl font-poppins">
            {destination.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
