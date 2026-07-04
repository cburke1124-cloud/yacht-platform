'use client';

import Link from 'next/link';
import { BoatType } from '@/app/lib/boatTypeData';
import { ArrowRight } from 'lucide-react';

interface BoatTypeCardProps {
  boatType: BoatType;
}

const BOAT_TYPE_FALLBACK_IMAGE = '/images/hero-yacht3.png';
const LOGO_FALLBACK_IMAGE = '/logo/logo-icon.png';

export default function BoatTypeCard({ boatType }: BoatTypeCardProps) {
  return (
    <div className="group h-full overflow-hidden border border-gray-200 bg-white hover:border-primary hover:shadow-md transition-all duration-200 hover-rise">
      <Link href={`/boat-types/${boatType.slug}`} className="block">
        {/* Hero Image */}
        <div className="relative h-64 overflow-hidden bg-gray-200">
          <img
            src={boatType.heroImage}
            alt={boatType.heroImageAlt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const img = e.currentTarget;
              const currentSrc = img.getAttribute('src') || '';
              if (currentSrc !== BOAT_TYPE_FALLBACK_IMAGE) {
                img.src = BOAT_TYPE_FALLBACK_IMAGE;
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
            {boatType.name}
          </h3>
          <p className="text-sm text-gray-600 mt-1 font-poppins">{boatType.subtitle}</p>

          {/* CTA */}
          <div className="mt-4 flex items-center text-primary font-medium text-sm group-hover:gap-2 transition-all">
            Explore boat type
            <ArrowRight size={16} className="ml-2" />
          </div>
        </div>
      </Link>
    </div>
  );
}
