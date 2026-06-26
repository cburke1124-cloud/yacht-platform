import { getDestinations, Destination } from '@/app/lib/destinationData';
import DestinationCard from '@/app/components/charter-destinations/DestinationCard';

export default function DestinationsBrowse() {
  const destinations = getDestinations();
  const regions = destinations.filter((d) => d.type === 'region');
  const subregionsBySlug = new Map(destinations.filter((d) => d.type === 'subregion').map((d) => [d.slug, d]));

  return (
    <div className="min-h-screen bg-soft">
      {/* Hero Section */}
      <div className="bg-secondary text-white py-16 px-4">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <h1
              className="text-4xl md:text-5xl font-bold"
              style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
            >
              Browse Destinations
            </h1>
            <p className="text-blue-100 mt-6 font-poppins">
              Pick a region to explore available yachts, plan your route, and learn what makes each destination special.
            </p>
          </div>
        </div>
      </div>

      {/* Destinations Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {regions.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 glass-card">
            <p className="text-gray-600 font-poppins">No destinations available yet. Check back soon!</p>
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-[#10214F]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Regions
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regions.map((region) => (
                <DestinationCard
                  key={region.id}
                  destination={region}
                  includedLocations={
                    region.subRegions
                      ?.map((slug) => subregionsBySlug.get(slug))
                      .filter((subregion): subregion is Destination => !!subregion)
                      .map((subregion) => ({
                        name: subregion.name,
                        href: `/charter-destinations/${region.slug}/${subregion.slug}`,
                      })) || []
                  }
                />
              ))}
            </div>

            {/* CTA Section */}
            <div className="mt-16 bg-white border border-gray-200 p-8 text-center glass-card">
              <h2 className="text-2xl font-bold text-[#10214F] mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Not sure where to go?
              </h2>
              <p className="text-gray-600 mb-6 font-poppins">
                Tell us what you're looking for and we'll find the perfect yacht and destination combination.
              </p>
              <a
                href="/search"
                className="inline-block px-8 py-3 bg-primary text-white hover-primary transition-colors font-medium btn-press"
              >
                Use AI-Powered Search
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Educational CTA */}
      <div className="bg-secondary text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Ready to Chart Your Course?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Each destination page includes available yachts, sailing conditions, local information, 
            and everything you need to feel confident choosing your charter.
          </p>
          <p className="text-blue-100 text-sm font-poppins">
            New to yacht chartering? Start by browsing our guides above—we'll make sure you feel comfortable and prepared.
          </p>
        </div>
      </div>
    </div>
  );
}
