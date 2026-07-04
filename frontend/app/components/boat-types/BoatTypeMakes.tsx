'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BoatType } from '@/app/lib/boatTypeData';
import { apiUrl } from '@/app/lib/apiRoot';
import { ArrowRight, Ship } from 'lucide-react';

interface CatalogMake {
  id: number;
  name: string;
  slug: string;
  country?: string;
  propulsion: string;
}

interface CatalogModel {
  id: number;
  make_id: number;
  name: string;
  boat_type?: string;
  length_ft?: number;
}

interface BoatTypeMakesProps {
  boatType: BoatType;
}

export default function BoatTypeMakes({ boatType }: BoatTypeMakesProps) {
  const [makes, setMakes] = useState<Array<CatalogMake & { modelCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMakes() {
      try {
        setLoading(true);
        const [modelsRes, makesRes] = await Promise.all([
          fetch(apiUrl(`/catalog/models?boat_type=${encodeURIComponent(boatType.boatType)}`)),
          fetch(apiUrl('/catalog/makes')),
        ]);
        if (!modelsRes.ok || !makesRes.ok) throw new Error('Failed to fetch catalog');

        const models: CatalogModel[] = await modelsRes.json();
        const allMakes: CatalogMake[] = await makesRes.json();

        const countByMakeId = new Map<number, number>();
        for (const m of models) {
          countByMakeId.set(m.make_id, (countByMakeId.get(m.make_id) || 0) + 1);
        }

        const matched = allMakes
          .filter((m) => countByMakeId.has(m.id))
          .map((m) => ({ ...m, modelCount: countByMakeId.get(m.id) || 0 }))
          .sort((a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name));

        setMakes(matched);
      } catch (err) {
        console.error('Error fetching makes for boat type:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMakes();
  }, [boatType]);

  if (loading) {
    return (
      <div className="py-12 text-center bg-white border border-gray-200 mx-6">
        <p className="text-gray-600 font-poppins">Loading builders...</p>
      </div>
    );
  }

  if (!makes || makes.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-[#F8F9FC] py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-[#10214F] mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            {boatType.name} Builders
          </h2>
          <p className="text-gray-600 font-poppins">
            Explore the makes and models that build {boatType.name.toLowerCase()}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {makes.map((make) => (
            <Link key={make.id} href={`/makes/${make.slug}`}>
              <div className="group h-full bg-white border border-gray-200 p-6 hover:border-[#01BBDC] hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <Ship className="text-[#01BBDC]" size={22} />
                  <h3 className="font-semibold text-gray-900 group-hover:text-[#01BBDC] transition-colors" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                    {make.name}
                  </h3>
                </div>
                {make.country && <p className="text-sm text-gray-600 font-poppins">{make.country}</p>}
                <p className="text-sm text-gray-500 mt-1 font-poppins">
                  {make.modelCount} {make.modelCount === 1 ? 'model' : 'models'}
                </p>
                <div className="mt-4 flex items-center text-[#01BBDC] font-medium text-sm group-hover:gap-2 transition-all">
                  View builder
                  <ArrowRight size={16} className="ml-2" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/listings?boat_type=${encodeURIComponent(boatType.boatType)}`}
            className="inline-block px-6 py-2 bg-[#01BCDD] text-white hover:bg-[#00a7c4] transition-colors font-medium"
          >
            View {boatType.name} For Sale
          </Link>
        </div>
      </div>
    </div>
  );
}
