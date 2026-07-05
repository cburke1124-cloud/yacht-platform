import Link from 'next/link';
import type { Metadata } from 'next';
import { fetchLocationNodes } from '@/app/lib/listingLocationsData';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

// Curated shortlist only — the full set of qualifying locations is still
// reachable via the sitemap and internal links from listing detail pages,
// but the hub itself stays small so the site doesn't feel overrun with pages.
const HUB_SHORTLIST_SIZE = 12;

export const metadata: Metadata = {
  title: 'Yachts for Sale by Location',
  description: 'Browse yachts for sale by country, state, and city — from Florida to the Caribbean and beyond.',
  alternates: { canonical: `${SITE_URL}/yachts-for-sale` },
};

export default async function YachtsForSaleHubPage() {
  const nodes = await fetchLocationNodes();
  const popular = [...nodes].sort((a, b) => b.count - a.count).slice(0, HUB_SHORTLIST_SIZE);
  const countries = nodes.filter((n) => n.type === 'country').sort((a, b) => b.count - a.count);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: popular.map((node, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: `Yachts for Sale in ${node.label}`,
      url: `${SITE_URL}/yachts-for-sale/${node.path.join('/')}`,
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl md:text-4xl font-bold text-[#10214F] mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
          Yachts for Sale by Location
        </h1>
        <p className="text-[#10214F]/60 font-poppins mb-8 max-w-2xl">
          Browse yacht listings by where they're located, from major US boating hubs to popular destinations worldwide.
        </p>

        {popular.length === 0 ? (
          <p className="text-[#10214F]/60 font-poppins">No location pages available yet.</p>
        ) : (
          <>
            <h2 className="text-lg font-bold text-[#10214F] mb-4 font-poppins">Popular Locations</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
              {popular.map((node) => (
                <Link
                  key={node.path.join('/')}
                  href={`/yachts-for-sale/${node.path.join('/')}`}
                  className="hover-lift block p-4 rounded-xl border border-gray-100 bg-gray-50"
                >
                  <p className="font-semibold text-[#10214F] font-poppins">{node.label}</p>
                  <p className="text-sm text-[#10214F]/50 font-poppins">{node.count} listing{node.count === 1 ? '' : 's'}</p>
                </Link>
              ))}
            </div>

            {countries.length > 0 && (
              <>
                <h2 className="text-lg font-bold text-[#10214F] mb-4 font-poppins">Browse by Country</h2>
                <div className="flex flex-wrap gap-2">
                  {countries.map((node) => (
                    <Link
                      key={node.path.join('/')}
                      href={`/yachts-for-sale/${node.path.join('/')}`}
                      className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-[#10214F] hover:border-[#01BBDC] hover:text-[#01BBDC] transition-colors font-poppins"
                    >
                      {node.label} ({node.count})
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
