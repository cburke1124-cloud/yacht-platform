import type { Metadata } from 'next';
import { API_ROOT } from '@/app/lib/apiRoot';
import BrowseContent from './BrowseContent';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://yachtversal.com';

export const metadata: Metadata = {
  title: 'Yachts For Sale',
  description: 'Browse yachts for sale from trusted brokers and private sellers. Filter by boat type, make, model, price, length, year, and location.',
  alternates: { canonical: `${SITE_URL}/listings` },
};

const FILTER_KEYS = [
  'search', 'boat_type', 'make', 'model', 'propulsion',
  'min_price', 'max_price', 'min_length', 'max_length',
  'min_year', 'max_year', 'state', 'city', 'condition',
  'fuel', 'hull_material', 'engine', 'brokerage', 'country',
];

interface ListingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function fetchInitialListings(params: Record<string, string | string[] | undefined>) {
  try {
    const qs = new URLSearchParams();
    qs.set('status', 'active');
    qs.set('limit', '20');
    qs.set('skip', '0');
    for (const key of FILTER_KEYS) {
      const value = params[key];
      if (typeof value === 'string' && value) qs.set(key, value);
    }
    const res = await fetch(`${API_ROOT}/listings?${qs.toString()}`, { next: { revalidate: 300 } });
    if (!res.ok) return { listings: [], total: 0, ok: false };
    const data = await res.json();
    const listings = data.listings ?? (Array.isArray(data) ? data : []);
    return { listings, total: data.total ?? listings.length, ok: true };
  } catch {
    return { listings: [], total: 0, ok: false };
  }
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const params = await searchParams;
  const { listings, total, ok } = await fetchInitialListings(params);

  return (
    <BrowseContent
      initialListings={listings}
      initialTotal={total}
      hasInitialData={ok}
    />
  );
}
