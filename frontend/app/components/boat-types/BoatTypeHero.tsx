'use client';

import { BoatType } from '@/app/lib/boatTypeData';

interface BoatTypeHeroProps {
  boatType: BoatType;
}

const BOAT_TYPE_HERO_FALLBACK = '/images/cannes-luxury-yacht-port.jpg';
const LOGO_FALLBACK_IMAGE = '/logo/logo-icon.png';

export default function BoatTypeHero({ boatType }: BoatTypeHeroProps) {
  return (
    <div className="relative w-full">
      {/* Hero Image */}
      <div className="relative h-96 w-full bg-gray-200 overflow-hidden">
        <img
          src={boatType.heroImage}
          alt={boatType.heroImageAlt}
          className="w-full h-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            const currentSrc = img.getAttribute('src') || '';
            if (currentSrc !== BOAT_TYPE_HERO_FALLBACK) {
              img.src = BOAT_TYPE_HERO_FALLBACK;
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
          <div className="mb-4">
            <a href="/boat-types" className="text-[#C9A84C] hover:text-[#e0c987] transition-colors text-sm">
              ← Back to Boat Types
            </a>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            {boatType.displayName}
          </h1>
          <p className="text-xl text-gray-100 max-w-2xl font-poppins">
            {boatType.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
