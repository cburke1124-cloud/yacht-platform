'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ListingCard from '@/app/components/ListingCard';
import { API_ROOT } from '@/app/lib/apiRoot';

type ListingImage = {
  url: string;
  thumbnail_url?: string;
  is_primary?: boolean;
};

export type Listing = {
  id: number | string;
  title: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  currency?: string;
  length_feet?: number;
  city?: string;
  state?: string;
  country?: string;
  boat_type?: string;
  condition?: string;
  status?: string;
  featured?: boolean;
  images?: ListingImage[];
  dealer?: {
    name?: string;
    company_name?: string;
    slug?: string;
    logo_url?: string;
  };
};

interface HomeFeaturedListingsProps {
  initialListings: Listing[];
}

/**
 * Renders with server-fetched listings immediately (so crawlers and first
 * paint see real content), then adjusts displayed currency client-side once
 * the visitor's locale/exchange rates are known.
 */
export default function HomeFeaturedListings({ initialListings }: HomeFeaturedListingsProps) {
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [visitorCurrency, setVisitorCurrency] = useState('USD');

  useEffect(() => {
    fetch(`${API_ROOT}/currencies/rates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.rates) setExchangeRates(data.rates); })
      .catch(() => {});

    const locale = (typeof navigator !== 'undefined' ? navigator.language : 'en-US') || 'en-US';
    const region = locale.split('-')[1]?.toUpperCase() ?? '';
    const EUR_REGIONS = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'FI', 'GR', 'IE', 'LU', 'PT', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY'];
    if (region === 'GB') setVisitorCurrency('GBP');
    else if (region === 'AU') setVisitorCurrency('AUD');
    else if (region === 'CA') setVisitorCurrency('CAD');
    else if (EUR_REGIONS.includes(region)) setVisitorCurrency('EUR');
  }, []);

  const visitorExchangeRate = visitorCurrency !== 'USD' ? (exchangeRates[visitorCurrency] ?? 1) : 1;

  if (initialListings.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-lg" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
          No listings available right now. Check back soon.
        </p>
        <Link
          href="/listings"
          className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-medium"
          style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
        >
          Browse All Listings
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch" style={{ gap: 24 }}>
      {initialListings.slice(0, 12).map((listing) => (
        <ListingCard
          key={listing.id}
          id={Number(listing.id)}
          title={listing.title}
          price={listing.price}
          year={listing.year}
          make={listing.make}
          model={listing.model}
          boatType={listing.boat_type}
          length={listing.length_feet}
          city={listing.city}
          state={listing.state}
          images={listing.images?.map((img) => img.url) || []}
          condition={listing.condition}
          featured={listing.featured}
          currencyCode={visitorCurrency}
          exchangeRate={visitorExchangeRate}
          dealerInfo={listing.dealer ? {
            name: listing.dealer.name || '',
            company: listing.dealer.company_name || '',
            slug: listing.dealer.slug,
            logoUrl: listing.dealer.logo_url,
          } : undefined}
        />
      ))}
    </div>
  );
}
