import { notFound } from 'next/navigation';
import { API_ROOT, mediaUrl } from '@/app/lib/apiRoot';
import ListingDetailClient from './ListingDetailClient';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
}

async function fetchListing(id: string): Promise<{ data: any | null; is404: boolean }> {
  try {
    const res = await fetch(`${API_ROOT}/listings/${id}`, { next: { revalidate: 3600 } });
    if (res.status === 404) return { data: null, is404: true };
    if (!res.ok) return { data: null, is404: false };
    return { data: await res.json(), is404: false };
  } catch {
    return { data: null, is404: false };
  }
}

async function fetchMedia(id: string) {
  try {
    const res = await fetch(`${API_ROOT}/listings/${id}/media`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.media || [];
  } catch {
    return [];
  }
}

async function fetchContact(id: string) {
  try {
    const res = await fetch(`${API_ROOT}/listings/${id}/contact-info`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const [{ data: listing, is404 }, media, contact] = await Promise.all([
    fetchListing(id),
    fetchMedia(id),
    fetchContact(id),
  ]);

  if (is404) {
    notFound();
  }

  const jsonLd = listing ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title || [listing.year, listing.make, listing.model].filter(Boolean).join(' '),
    description: listing.title,
    image: media.length > 0 ? media.map((m: any) => mediaUrl(m.url)) : undefined,
    brand: listing.make ? { '@type': 'Brand', name: listing.make } : undefined,
    ...(listing.price ? {
      offers: {
        '@type': 'Offer',
        price: listing.price,
        priceCurrency: listing.currency || 'USD',
        availability: listing.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      },
    } : {}),
  } : null;

  const breadcrumbJsonLd = listing ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Yachts for Sale', item: `${SITE_URL}/listings` },
      { '@type': 'ListItem', position: 3, name: listing.title, item: `${SITE_URL}/listings/${id}` },
    ],
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <ListingDetailClient initialListing={listing} initialMedia={media} initialContact={contact} />
    </>
  );
}
