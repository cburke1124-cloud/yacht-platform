'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/apiRoot';
import { Ship, MapPin, Sailboat } from 'lucide-react';

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

export default function MakeDetailPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [make, setMake] = useState<CatalogMake | null>(null);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    async function fetchMake() {
      try {
        setLoading(true);
        const makesRes = await fetch(apiUrl('/catalog/makes'));
        if (!makesRes.ok) throw new Error('Failed to fetch makes');
        const allMakes: CatalogMake[] = await makesRes.json();
        const found = allMakes.find((m) => m.slug === slug);

        if (!found) {
          setNotFoundState(true);
          return;
        }
        setMake(found);

        const modelsRes = await fetch(apiUrl(`/catalog/models?make_id=${found.id}`));
        if (modelsRes.ok) {
          const modelData: CatalogModel[] = await modelsRes.json();
          setModels(modelData);
        }
      } catch (err) {
        console.error('Error fetching make:', err);
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchMake();
  }, [slug]);

  const modelsByType = useMemo(() => {
    const groups = new Map<string, CatalogModel[]>();
    for (const model of models) {
      const key = model.boat_type || 'Other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(model);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [models]);

  if (notFoundState) {
    notFound();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <p className="text-gray-600 font-poppins">Loading builder...</p>
      </div>
    );
  }

  if (!make) return null;

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
