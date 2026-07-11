import { notFound } from 'next/navigation';
import { API_ROOT, mediaUrl } from '@/app/lib/apiRoot';
import CharterDetailClient, { type CharterListing } from './CharterDetailClient';

interface CharterDetailPageProps {
  params: Promise<{ id: string }>;
}

async function fetchCharter(id: string): Promise<{ data: CharterListing | null; is404: boolean }> {
  try {
    const res = await fetch(`${API_ROOT}/charter/${id}`, { next: { revalidate: 3600 } });
    if (res.status === 404) return { data: null, is404: true };
    if (!res.ok) return { data: null, is404: false };
    return { data: await res.json(), is404: false };
  } catch {
    return { data: null, is404: false };
  }
}

async function fetchMedia(id: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_ROOT}/charter/${id}/media`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const media: Array<{ url: string }> = data.media ?? [];
    return media.map((m) => mediaUrl(m.url));
  } catch {
    return [];
  }
}

export default async function CharterDetailPage({ params }: CharterDetailPageProps) {
  const { id } = await params;
  const [{ data: charter, is404 }, media] = await Promise.all([
    fetchCharter(id),
    fetchMedia(id),
  ]);

  if (is404) {
    notFound();
  }

  const jsonLd = charter ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: charter.title,
    description: charter.description || charter.title,
    image: media.length > 0 ? media : undefined,
    ...(charter.day_rate || charter.week_rate ? {
      offers: {
        '@type': 'Offer',
        price: charter.day_rate || charter.week_rate,
        priceCurrency: charter.currency || 'USD',
        availability: 'https://schema.org/InStock',
      },
    } : {}),
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <CharterDetailClient
        id={id}
        initialCharter={charter}
        initialGalleryImages={media.length > 0 ? media : null}
      />
    </>
  );
}
