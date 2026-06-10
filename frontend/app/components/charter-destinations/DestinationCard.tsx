'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Destination } from '@/app/lib/destinationData';
import { ArrowRight, MapPin, Heart } from 'lucide-react';

interface DestinationCardProps {
  destination: Destination;
}

export default function DestinationCard({ destination }: DestinationCardProps) {
  const href = destination.type === 'region' 
    ? `/charter-destinations/${destination.slug}`
    : `/charter-destinations/${destination.parentRegion}/${destination.slug}`;

  return (
    <Link href={href}>
      <div className="group h-full cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all duration-300">
        {/* Hero Image */}
        <div className="relative h-64 overflow-hidden bg-gray-200">
          <img
            src={destination.heroImage}
            alt={destination.heroImageAlt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-6 bg-white">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {destination.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{destination.subtitle}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-700 text-sm mt-3 line-clamp-2">
            {destination.shortDescription}
          </p>

          {/* Best For */}
          <div className="mt-4 flex flex-wrap gap-1">
            {destination.bestFor.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-4 flex items-center text-blue-600 font-medium text-sm group-hover:gap-2 transition-all">
            Explore {destination.type === 'region' ? 'region' : 'location'}
            <ArrowRight size={16} className="ml-2" />
          </div>
        </div>
      </div>
    </Link>
  );
}
