'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_ROOT } from '@/app/lib/apiRoot';

interface Listing {
  id: number;
  title: string;
  price?: number;
  city?: string;
  state?: string;
}

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || id === 'undefined') return;
    setLoading(true);

    fetch(`${API_ROOT}/listings/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setListing(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-600">Loading...</div>
    </div>
  );

  if (!listing) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-800">Listing not found</div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-5 py-3 bg-[#01BBDC] text-white rounded-lg"
        >
          Go back
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-4xl font-bold text-[#10214F] mb-2">{listing.title}</h1>
      <p className="text-gray-600 mb-1">
        {listing.city}{listing.city && listing.state ? ', ' : ''}{listing.state}
      </p>
      <p className="text-xl font-semibold text-[#01BBDC]">
        {listing.price != null ? `$${listing.price}` : 'Price not set'}
      </p>
    </div>
  );
}
