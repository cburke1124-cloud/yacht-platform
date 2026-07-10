'use client';

import Link from 'next/link';
import { Anchor, Bed, Users, Ruler } from 'lucide-react';
import { mediaUrl, onImgError } from '@/app/lib/apiRoot';

export interface CharterListing {
  id: number;
  title: string;
  slug: string;
  vessel_name: string;
  make?: string;
  model?: string;
  year?: number;
  length_feet?: number;
  boat_type?: string;
  home_port?: string;
  home_port_city?: string;
  home_port_state?: string;
  home_port_country?: string;
  operating_regions?: string;
  day_rate?: number;
  week_rate?: number;
  hourly_rates?: Array<{ hours: number; price: number }>;
  currency: string;
  min_charter_days?: number;
  max_guests?: number;
  cabins?: number;
  crew_included: boolean;
  images?: Array<{ url: string } | string>;
  status: string;
  charter_company_name?: string;
  charter_company_slug?: string;
}

export default function CharterCard({ charter }: { charter: CharterListing }) {
  const imageUrl = (() => {
    if (!charter.images?.length) return null;
    const first = charter.images[0];
    return mediaUrl(typeof first === 'string' ? first : first.url);
  })();
  const formatRate = (rate?: number, period?: string) => {
    if (!rate) return null;
    return `${charter.currency === 'USD' ? '$' : charter.currency}${rate.toLocaleString()} / ${period}`;
  };
  const lowestHourly = charter.hourly_rates?.length
    ? [...charter.hourly_rates].sort((a, b) => a.price - b.price)[0]
    : null;
  const formatHourly = lowestHourly
    ? `From ${charter.currency === 'USD' ? '$' : charter.currency}${lowestHourly.price.toLocaleString()} / ${lowestHourly.hours}hr`
    : null;
  const displayRate = formatRate(charter.day_rate, 'day') || formatRate(charter.week_rate, 'week') || formatHourly || 'Contact for pricing';

  return (
    <Link href={`/charter/${charter.id}`} className="group block bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-[#01BBDC] hover:shadow-md transition-all duration-200">
      <div className="relative h-52 bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={charter.title} onError={onImgError} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Anchor className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {charter.crew_included && (
          <span className="absolute top-3 left-3 bg-[#01BBDC] text-white text-xs font-semibold px-2 py-1 rounded-full">Crew Included</span>
        )}
        {charter.boat_type && (
          <span className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">{charter.boat_type}</span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-[#01BBDC] transition-colors">{charter.title}</h3>
        <p className="text-sm text-gray-500 mt-0.5 truncate">
          {[charter.home_port_city, charter.home_port_state, charter.home_port_country].filter(Boolean).join(', ') || charter.home_port || charter.operating_regions || 'Location TBD'}
        </p>
        <div className="flex items-center gap-3 mt-3 text-sm text-gray-500 flex-wrap">
          {charter.max_guests && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{charter.max_guests} guests</span>}
          {charter.cabins && <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{charter.cabins} cabins</span>}
          {charter.length_feet && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{charter.length_feet}ft</span>}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[#01BBDC] font-semibold text-sm">{displayRate}</span>
          {charter.charter_company_name && <span className="text-xs text-gray-400 truncate max-w-[120px]">{charter.charter_company_name}</span>}
        </div>
      </div>
    </Link>
  );
}
