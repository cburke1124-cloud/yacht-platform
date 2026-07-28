import type { Metadata } from 'next';
import { getBoatTypes } from '@/app/lib/boatTypeData';
import BoatTypeCard from '@/app/components/boat-types/BoatTypeCard';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://yachtversal.com';

export const metadata: Metadata = {
  title: 'Find Your Type of Boat',
  description: "Not sure what kind of boat is right for you? Learn what each type is built for, who it suits best, and which builders make it — then browse makes, models, and boats for sale.",
  alternates: { canonical: `${SITE_URL}/boat-types` },
};

export default function BoatTypesBrowse() {
  const boatTypes = getBoatTypes();

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
              Find Your Type of Boat
            </h1>
            <p className="text-blue-100 mt-6 font-poppins">
              Not sure what kind of boat is right for you? Learn what each type is built for, who it suits best, and which builders make it — then browse makes, models, and boats for sale.
            </p>
          </div>
        </div>
      </div>

      {/* Boat Types Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {boatTypes.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 glass-card">
            <p className="text-gray-600 font-poppins">No boat types available yet. Check back soon!</p>
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-[#10214F]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Types of Boats
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boatTypes.map((boatType) => (
                <BoatTypeCard key={boatType.id} boatType={boatType} />
              ))}
            </div>

            {/* CTA Section */}
            <div className="mt-16 bg-white border border-gray-200 p-8 text-center glass-card">
              <h2 className="text-2xl font-bold text-[#10214F] mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Already know what you're looking for?
              </h2>
              <p className="text-gray-600 mb-6 font-poppins">
                Browse makes and models directly, or search all boats for sale.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/makes"
                  className="inline-block px-8 py-3 bg-white border border-gray-200 text-[#10214F] hover:border-primary hover:text-primary transition-colors font-medium btn-press"
                >
                  Browse Makes
                </a>
                <a
                  href="/listings"
                  className="inline-block px-8 py-3 bg-primary text-white hover-primary transition-colors font-medium btn-press"
                >
                  Browse Boats For Sale
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Educational CTA */}
      <div className="bg-secondary text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Buying the Right Boat Starts With Knowing the Type
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Each boat type page explains what it's built for, what to expect from ownership, and which makes and models to consider.
          </p>
          <p className="text-blue-100 text-sm font-poppins">
            New to boat buying? Start by browsing the types above—we'll help you narrow down what fits your plans on the water.
          </p>
        </div>
      </div>
    </div>
  );
}
