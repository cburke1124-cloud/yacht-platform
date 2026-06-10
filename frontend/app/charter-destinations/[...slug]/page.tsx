import { notFound } from 'next/navigation';
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

interface DestinationDetailProps {
  params: Promise<{ slug: string[] | string }>;
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

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <DestinationHero 
        destination={destination} 
        parentRegion={parentRegion || undefined}
        showBreadcrumb={!!parentRegion}
      />

      {/* Info Section */}
      <DestinationInfo destination={destination} />

      {/* Listings Section */}
      <DestinationListings destination={destination} limit={9} />

      {/* Sub-Regions (if this is a region with sub-regions) */}
      {subregions.length > 0 && (
        <SubRegionNavigation 
          subregions={subregions} 
          parentSlug={destination.slug}
        />
      )}

      {/* Footer CTA */}
      <div className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to Book Your {destination.name} Charter?
          </h2>
          <p className="text-gray-600 mb-8">
            Browse available yachts above, compare options, or use our AI search to find your perfect match.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/search?region=${destination.slug}`}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Search by {destination.name}
            </a>
            <a
              href="/search"
              className="px-8 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Browse All Charters
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
