import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { API_ROOT } from '@/app/lib/apiRoot';
import { Ship, MapPin, Sailboat } from 'lucide-react';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://yachtversal.com';

interface CatalogMake {
  id: number;
  name: string;
  slug: string;
  country?: string;
  propulsion: string;
  notes?: string;
}

interface CatalogModel {
  id: number;
  make_id: number;
  name: string;
  boat_type?: string;
  propulsion?: string;
  length_ft?: number;
  min_year?: number;
  max_year?: number;
}

interface MakeDetailPageProps {
  params: Promise<{ slug: string }>;
}

async function fetchMake(slug: string): Promise<CatalogMake | null> {
  try {
    const res = await fetch(`${API_ROOT}/catalog/makes`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const allMakes: CatalogMake[] = await res.json();
    return allMakes.find((m) => m.slug === slug) ?? null;
  } catch {
    return null;
  }
}

async function fetchModels(makeId: number): Promise<CatalogModel[]> {
  try {
    const res = await fetch(`${API_ROOT}/catalog/models?make_id=${makeId}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: MakeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const make = await fetchMake(slug);
  if (!make) return { title: 'Make Not Found' };

  const propulsionLabel = make.propulsion === 'both' ? 'Power & Sail' : make.propulsion === 'sail' ? 'Sail' : 'Power';
  const description = make.notes?.slice(0, 160)
    || `Browse ${make.name} yacht models${make.country ? ` from ${make.country}` : ''} — ${propulsionLabel} builder.`;

  return {
    title: make.name,
    description,
    alternates: { canonical: `${SITE_URL}/makes/${slug}` },
    openGraph: {
      title: make.name,
      description,
      url: `${SITE_URL}/makes/${slug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: make.name,
      description,
    },
  };
}

export default async function MakeDetailPage({ params }: MakeDetailPageProps) {
  const { slug } = await params;
  const make = await fetchMake(slug);

  if (!make) {
    notFound();
  }

  const models = await fetchModels(make.id);

  const modelsByType = (() => {
    const groups = new Map<string, CatalogModel[]>();
    for (const model of models) {
      const key = model.boat_type || 'Other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(model);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const propulsionLabel = make.propulsion === 'both' ? 'Power & Sail' : make.propulsion === 'sail' ? 'Sail' : 'Power';

  return (
    <div className="min-h-screen bg-soft">
      {/* Hero */}
      <div className="bg-secondary text-white py-16 px-4">
        <div className="max-w-6xl mx-auto px-6">
          <a href="/makes" className="text-[#C9A84C] hover:text-[#e0c987] transition-colors text-sm">
            ← Back to Makes
          </a>
          <h1 className="text-4xl md:text-5xl font-bold mt-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            {make.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-4 text-blue-100 font-poppins">
            {make.country && (
              <div className="flex items-center gap-1.5">
                <MapPin size={16} />
                <span>{make.country}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Sailboat size={16} />
              <span>{propulsionLabel}</span>
            </div>
          </div>
          {make.notes && <p className="text-blue-100 mt-6 max-w-2xl font-poppins">{make.notes}</p>}
        </div>
      </div>

      {/* Models */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {modelsByType.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 glass-card">
            <p className="text-gray-600 font-poppins">No models listed yet for {make.name}.</p>
          </div>
        ) : (
          modelsByType.map(([boatType, typeModels]) => (
            <div key={boatType} className="mb-12">
              <h2 className="text-2xl font-bold text-[#10214F] mb-6" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                {boatType}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {typeModels
                  .sort((a, b) => (a.length_ft || 0) - (b.length_ft || 0))
                  .map((model) => (
                    <div key={model.id} className="bg-white border border-gray-200 p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <Ship size={18} className="text-primary" />
                        <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                          {model.name}
                        </h3>
                      </div>
                      <div className="text-sm text-gray-600 font-poppins flex flex-wrap gap-x-3 mt-2">
                        {model.length_ft && <span>{model.length_ft}ft</span>}
                        {model.min_year && (
                          <span>
                            {model.min_year}
                            {model.max_year ? `–${model.max_year}` : '–present'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}

        {/* CTA */}
        <div className="mt-8 bg-white border border-gray-200 p-8 text-center glass-card">
          <h2 className="text-2xl font-bold text-[#10214F] mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Looking for a {make.name}?
          </h2>
          <p className="text-gray-600 mb-6 font-poppins">
            Browse current {make.name} listings for sale.
          </p>
          <Link
            href={`/listings?make=${encodeURIComponent(make.name)}`}
            className="inline-block px-8 py-3 bg-primary text-white hover-primary transition-colors font-medium btn-press"
          >
            View {make.name} For Sale
          </Link>
        </div>
      </div>
    </div>
  );
}
