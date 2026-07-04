import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getDestinationBySlug,
  getSubregionsForRegion,
  getRegionForSubregion,
  Destination
} from '@/app/lib/destinationData';
import DestinationHero from '@/app/components/charter-destinations/DestinationHero';
import DestinationInfo from '@/app/components/charter-destinations/DestinationInfo';
import DestinationListings from '@/app/components/charter-destinations/DestinationListings';
import SubRegionNavigation from '@/app/components/charter-destinations/SubRegionNavigation';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

interface DestinationDetailProps {
  params: Promise<{ slug: string[] | string }>;
}

function resolveDestination(slugArray: string[]): Destination | undefined {
  if (slugArray.length === 1) {
    return getDestinationBySlug(slugArray[0]);
  }
  if (slugArray.length === 2) {
    const destination = getDestinationBySlug(slugArray[1]);
    if (destination?.type === 'subregion' && destination.parentRegion === slugArray[0]) {
      return destination;
    }
  }
  return undefined;
}

export async function generateMetadata({ params }: DestinationDetailProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slugArray = Array.isArray(resolvedParams.slug) ? resolvedParams.slug : [resolvedParams.slug];
  const destination = resolveDestination(slugArray);
  if (!destination) return { title: 'Destination Not Found' };

  const url = `${SITE_URL}/charter-destinations/${slugArray.join('/')}`;

  return {
    title: destination.displayName,
    description: destination.shortDescription,
    alternates: { canonical: url },
    openGraph: {
      title: destination.displayName,
      description: destination.shortDescription,
      url,
      images: [{ url: destination.heroImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: destination.displayName,
      description: destination.shortDescription,
      images: [destination.heroImage],
    },
  };
}

export default async function DestinationDetail({ params }: DestinationDetailProps) {
  const resolvedParams = await params;
  const slugArray = Array.isArray(resolvedParams.slug) ? resolvedParams.slug : [resolvedParams.slug];
  // Handle both region and sub-region paths
  let destination: Destination | undefined;
  let parentRegion: Destination | undefined;
  let subregions: Destination[] = [];

  if (slugArray.length === 1) {
    // Single slug - could be region or subregion
    destination = getDestinationBySlug(slugArray[0]);

    if (destination?.type === 'region') {
      // It's a region - get its subregions
      subregions = getSubregionsForRegion(destination.slug);
    } else if (destination?.type === 'subregion') {
      // It's a subregion - get its parent region
      parentRegion = getRegionForSubregion(destination.slug);
    }
  } else if (slugArray.length === 2) {
    // Two slugs - [region]/[subregion]
    const regionSlug = slugArray[0];
    const subregionSlug = slugArray[1];

    parentRegion = getDestinationBySlug(regionSlug);
    destination = getDestinationBySlug(subregionSlug);

    // Verify parent-child relationship
    if (destination?.type !== 'subregion' || destination.parentRegion !== regionSlug) {
      notFound();
    }
  }

  if (!destination) {
    notFound();
  }

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Charter Destinations', item: `${SITE_URL}/charter-destinations` },
    ...(parentRegion ? [{ '@type': 'ListItem', position: 2, name: parentRegion.name, item: `${SITE_URL}/charter-destinations/${parentRegion.slug}` }] : []),
    { '@type': 'ListItem', position: parentRegion ? 3 : 2, name: destination.name, item: `${SITE_URL}/charter-destinations/${slugArray.join('/')}` },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  return (
    <div className="min-h-screen bg-soft">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero Section */}
      <DestinationHero
        destination={destination}
        parentRegion={parentRegion || undefined}
        showBreadcrumb={true}
      />

      {/* Sub-Destinations (if this is a region with sub-regions) */}
      {subregions.length > 0 && (
        <SubRegionNavigation
          subregions={subregions}
          parentSlug={destination.slug}
        />
      )}

      {/* Listings Section */}
      <DestinationListings destination={destination} limit={9} />

      {/* Info Section */}
      <DestinationInfo destination={destination} />

      {/* Footer CTA */}
      <div className="bg-secondary py-14 md:py-18">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Ready to Book Your {destination.name} Charter?
          </h2>
          <p className="text-blue-100 mb-8 font-poppins">
            Browse available yachts above, compare options, or use our AI search to find your perfect match.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/search?region=${destination.slug}`}
              className="px-8 py-3 bg-primary text-white hover-primary transition-colors font-medium btn-press"
            >
              Search by {destination.name}
            </a>
            <a
              href="/search"
              className="px-8 py-3 bg-white text-[#10214F] hover:bg-gray-100 transition-colors font-medium btn-press"
            >
              Browse All Charters
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
