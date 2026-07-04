import type { Metadata } from 'next';
import { API_ROOT, mediaUrl } from '@/app/lib/apiRoot';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

interface ListingSummary {
  title?: string;
  price?: number;
  currency?: string;
  year?: number;
  make?: string;
  model?: string;
  boat_type?: string;
  length_feet?: number;
  city?: string;
  state?: string;
  description?: string;
  images?: Array<{ url: string; is_primary?: boolean }>;
}

async function fetchListing(id: string): Promise<ListingSummary | null> {
  try {
    const res = await fetch(`${API_ROOT}/listings/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await fetchListing(id);

  if (!listing) {
    return { title: 'Listing Not Found' };
  }

  const title = listing.title || [listing.year, listing.make, listing.model].filter(Boolean).join(' ') || 'Yacht Listing';
  const location = [listing.city, listing.state].filter(Boolean).join(', ');
  const priceStr = listing.price ? `${listing.currency || 'USD'} ${listing.price.toLocaleString()}` : undefined;
  const descriptionParts = [
    listing.boat_type,
    listing.length_feet ? `${listing.length_feet}ft` : undefined,
    priceStr,
    location,
  ].filter(Boolean);
  const description = descriptionParts.length > 0
    ? `${title} — ${descriptionParts.join(' | ')}`
    : (listing.description?.slice(0, 160) || `View details for ${title} on YachtVersal.`);

  const primaryImage = listing.images?.find((img) => img.is_primary) || listing.images?.[0];
  const imageUrl = primaryImage ? mediaUrl(primaryImage.url) : undefined;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/listings/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/listings/${id}`,
      type: 'website',
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default function ListingDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
