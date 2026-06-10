import { getRegions, Destination } from '@/app/lib/destinationData';
import DestinationCard from '@/app/components/charter-destinations/DestinationCard';
import { MapPin, Compass } from 'lucide-react';

export default function DestinationsBrowse() {
  const regions = getRegions();
  const loading = false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading destinations...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative py-16 md:py-24 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Compass className="text-blue-600" size={28} />
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                Chart Your Course
              </h1>
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mt-4">
              From pristine Caribbean anchorages to Mediterranean coastlines, discover the perfect sailing destination for your next yacht charter.
            </p>
            <p className="text-gray-600 mt-6">
              Pick a region to explore available yachts, plan your route, and learn what makes each destination special.
            </p>
          </div>
        </div>
      </div>

      {/* Destinations Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {regions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No destinations available yet. Check back soon!</p>
          </div>
        ) : (
          <div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regions.map((region) => (
                <DestinationCard key={region.id} destination={region} />
              ))}
            </div>

            {/* CTA Section */}
            <div className="mt-16 bg-blue-50 rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Not sure where to go?</h2>
              <p className="text-gray-600 mb-6">
                Tell us what you're looking for and we'll find the perfect yacht and destination combination.
              </p>
              <a
                href="/search"
                className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Use AI-Powered Search
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Educational CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Chart Your Course?</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Each destination page includes available yachts, sailing conditions, local information, 
            and everything you need to feel confident choosing your charter.
          </p>
          <p className="text-blue-100 text-sm">
            New to yacht chartering? Start by browsing our guides above—we'll make sure you feel comfortable and prepared.
          </p>
        </div>
      </div>
    </div>
  );
}
