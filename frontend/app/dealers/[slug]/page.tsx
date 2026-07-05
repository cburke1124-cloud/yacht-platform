import { notFound } from 'next/navigation';
import { API_ROOT, mediaUrl } from '@/app/lib/apiRoot';
import DealerProfileClient from './DealerProfileClient';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

interface DealerPageProps {
  params: Promise<{ slug: string }>;
}

const LISTINGS_LIMIT = 100;

async function fetchDealer(slug: string): Promise<{ data: any | null; is404: boolean }> {
  try {
    const res = await fetch(`${API_ROOT}/dealers/${slug}?skip=0&limit=${LISTINGS_LIMIT}`, { next: { revalidate: 3600 } });
    if (res.status === 404) return { data: null, is404: true };
    if (!res.ok) return { data: null, is404: false };
    return { data: await res.json(), is404: false };
  } catch {
    return { data: null, is404: false };
  }
}

async function fetchTeam(slug: string) {
  try {
    const res = await fetch(`${API_ROOT}/dealers/${slug}/team`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function DealerPage({ params }: DealerPageProps) {
  const { slug } = await params;
  const { data, is404 } = await fetchDealer(slug);

  if (is404) {
    notFound();
  }

  const dealer = data?.dealer ?? null;
  const listings = data?.listings ?? [];
  const totalListings = data?.total ?? listings.length ?? 0;
  const team = dealer?.show_team_on_profile ? await fetchTeam(slug) : [];

  const jsonLd = dealer ? {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: dealer.business_name,
    description: dealer.bio,
    image: dealer.logo_url ? mediaUrl(dealer.logo_url) : undefined,
    telephone: dealer.phone,
    email: dealer.email,
    url: dealer.website,
    address: (dealer.city || dealer.state) ? {
      '@type': 'PostalAddress',
      addressLocality: dealer.city,
      addressRegion: dealer.state,
    } : undefined,
  } : null;

  const breadcrumbJsonLd = dealer ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Yacht Brokers', item: `${SITE_URL}/dealers` },
      { '@type': 'ListItem', position: 3, name: dealer.business_name, item: `${SITE_URL}/dealers/${slug}` },
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
      <DealerProfileClient
        initialDealer={dealer}
        initialListings={listings}
        initialTotalListings={totalListings}
        initialTeam={team}
      />
    </>
  );
}
