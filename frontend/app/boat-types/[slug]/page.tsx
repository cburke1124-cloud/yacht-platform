import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBoatTypeBySlug } from '@/app/lib/boatTypeData';
import BoatTypeHero from '@/app/components/boat-types/BoatTypeHero';
import BoatTypeInfo from '@/app/components/boat-types/BoatTypeInfo';
import BoatTypeMakes from '@/app/components/boat-types/BoatTypeMakes';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

interface BoatTypeDetailProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BoatTypeDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const boatType = getBoatTypeBySlug(slug);
  if (!boatType) return { title: 'Boat Type Not Found' };

  return {
    title: boatType.displayName,
    description: boatType.shortDescription,
    alternates: { canonical: `${SITE_URL}/boat-types/${slug}` },
    openGraph: {
      title: boatType.displayName,
      description: boatType.shortDescription,
      url: `${SITE_URL}/boat-types/${slug}`,
      images: [{ url: boatType.heroImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: boatType.displayName,
      description: boatType.shortDescription,
      images: [boatType.heroImage],
    },
  };
}

export default async function BoatTypeDetail({ params }: BoatTypeDetailProps) {
  const { slug } = await params;
  const boatType = getBoatTypeBySlug(slug);

  if (!boatType) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Boat Types', item: `${SITE_URL}/boat-types` },
      { '@type': 'ListItem', position: 2, name: boatType.name, item: `${SITE_URL}/boat-types/${slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-soft">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero Section */}
      <BoatTypeHero boatType={boatType} />

      {/* Makes Section */}
      <BoatTypeMakes boatType={boatType} />

      {/* Info Section */}
      <BoatTypeInfo boatType={boatType} />

      {/* Footer CTA */}
      <div className="bg-secondary py-14 md:py-18">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Ready to Find Your {boatType.name.replace(/s$/, '')}?
          </h2>
          <p className="text-blue-100 mb-8 font-poppins">
            Browse builders above, or jump straight to {boatType.name.toLowerCase()} currently for sale.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/listings?boat_type=${encodeURIComponent(boatType.boatType)}`}
              className="px-8 py-3 bg-primary text-white hover-primary transition-colors font-medium btn-press"
            >
              View {boatType.name} For Sale
            </a>
            <a
              href="/boat-types"
              className="px-8 py-3 bg-white text-[#10214F] hover:bg-gray-100 transition-colors font-medium btn-press"
            >
              Browse All Boat Types
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
