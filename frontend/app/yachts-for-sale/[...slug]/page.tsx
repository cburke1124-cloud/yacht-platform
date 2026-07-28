import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { API_ROOT } from '@/app/lib/apiRoot';
import {
  fetchLocationNodes,
  getLocationByPath,
  getChildLocations,
  locationFiltersToQueryString,
  LocationNode,
} from '@/app/lib/listingLocationsData';
import ListingCard from '@/app/components/ListingCard';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://yachtversal.com';

interface LocationPageProps {
  params: Promise<{ slug: string[] }>;
}

const imgUrl = (img: { url: string } | string) => (typeof img === 'string' ? img : img.url);

async function fetchListingsForNode(node: LocationNode) {
  try {
    const qs = locationFiltersToQueryString(node.filters);
    const res = await fetch(`${API_ROOT}/listings?status=active&limit=12&${qs}`, { next: { revalidate: 3600 } });
    if (!res.ok) return { listings: [], total: 0 };
    const data = await res.json();
    return { listings: data.listings ?? [], total: data.total ?? 0 };
  } catch {
    return { listings: [], total: 0 };
  }
}

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const nodes = await fetchLocationNodes();
  const node = getLocationByPath(nodes, slug);
  if (!node) return { title: 'Location Not Found' };

  const url = `${SITE_URL}/yachts-for-sale/${slug.join('/')}`;
  const title = `Yachts for Sale in ${node.label}`;
  const description = `Browse ${node.count} yacht${node.count === 1 ? '' : 's'} for sale in ${node.label}. Compare listings from verified brokers and private sellers.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { card: 'summary', title, description },
  };
}

export default async function LocationPage({ params }: LocationPageProps) {
  const { slug } = await params;
  const nodes = await fetchLocationNodes();
  const node = getLocationByPath(nodes, slug);

  if (!node) {
    notFound();
  }

  const [{ listings, total }, children] = await Promise.all([
    fetchListingsForNode(node),
    Promise.resolve(getChildLocations(nodes, node.path)),
  ]);

  const browseHref = `/listings?${locationFiltersToQueryString(node.filters)}`;

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Yachts for Sale', item: `${SITE_URL}/yachts-for-sale` },
    ...node.path.slice(0, -1).map((_, idx) => {
      const ancestor = getLocationByPath(nodes, node.path.slice(0, idx + 1));
      return ancestor
        ? { '@type': 'ListItem', position: idx + 3, name: ancestor.label, item: `${SITE_URL}/yachts-for-sale/${ancestor.path.join('/')}` }
        : null;
    }).filter(Boolean),
    { '@type': 'ListItem', position: node.path.length + 2, name: node.label, item: `${SITE_URL}/yachts-for-sale/${node.path.join('/')}` },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Yachts for Sale in ${node.label}`,
    url: `${SITE_URL}/yachts-for-sale/${node.path.join('/')}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: listings.slice(0, 12).map((l: any, idx: number) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${SITE_URL}/listings/${l.id}`,
      })),
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <nav className="text-sm text-[#10214F]/60 mb-4 font-poppins">
          <Link href="/yachts-for-sale" className="hover:text-[#01BBDC]">Yachts for Sale</Link>
          {node.path.slice(0, -1).map((_, idx) => {
            const ancestor = getLocationByPath(nodes, node.path.slice(0, idx + 1));
            return ancestor ? (
              <span key={ancestor.path.join('/')}>
                {' / '}
                <Link href={`/yachts-for-sale/${ancestor.path.join('/')}`} className="hover:text-[#01BBDC]">
                  {ancestor.label}
                </Link>
              </span>
            ) : null;
          })}
          {' / '}
          <span className="text-[#10214F]">{node.label}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-[#10214F] mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
          Yachts for Sale in {node.label}
        </h1>
        <p className="text-[#10214F]/60 font-poppins mb-8">
          {total} yacht{total === 1 ? '' : 's'} currently listed for sale in {node.label}.
        </p>

        {children.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {children.map((child) => (
              <Link
                key={child.path.join('/')}
                href={`/yachts-for-sale/${child.path.join('/')}`}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-[#10214F] hover:border-[#01BBDC] hover:text-[#01BBDC] transition-colors font-poppins"
              >
                {child.label} ({child.count})
              </Link>
            ))}
          </div>
        )}

        {listings.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 mb-8" style={{ gap: 20 }}>
              {listings.map((l: any) => (
                <ListingCard
                  key={l.id}
                  id={l.id}
                  title={l.title}
                  price={l.price}
                  year={l.year}
                  make={l.make}
                  model={l.model}
                  boatType={l.boat_type}
                  cabins={l.cabins}
                  length={l.length_feet}
                  city={l.city}
                  state={l.state}
                  images={(l.images || []).map(imgUrl)}
                  condition={l.condition}
                  featured={l.featured}
                />
              ))}
            </div>

            <Link
              href={browseHref}
              className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all"
            >
              View all {total} Yachts for Sale in {node.label} &rarr;
            </Link>
          </>
        ) : (
          <p className="text-[#10214F]/60 font-poppins">No active listings found in {node.label} right now.</p>
        )}
      </div>
    </div>
  );
}
