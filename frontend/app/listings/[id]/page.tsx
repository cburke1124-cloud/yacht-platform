'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { API_ROOT, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface Listing {
  id: number;
  title: string;
  price?: number;
  currency?: string;
  year?: number;
  make?: string;
  model?: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  images?: Array<{ id: number; url: string; thumbnail_url?: string }>;
  latitude?: number;
  longitude?: number;
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

  const backgroundImage = listing?.images?.[0]?.url ? mediaUrl(listing.images[0].url) : '/images/hero-fallback.jpg';

  const location = [listing?.city, listing?.state, listing?.country].filter(Boolean).join(', ');
  const price = listing?.price != null ? `$${listing.price.toLocaleString()}` : 'Price on request';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#10214F] mb-4">Listing not found</h2>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-[#01BBDC] text-white rounded-lg"
          >
            Back to listings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="relative h-[115px] w-full bg-gradient-to-r from-white via-white/90 to-transparent flex items-center px-10 shadow-sm z-20">
        <div className="flex items-center h-full" style={{ width: 240 }}>
          <img src="/logo.svg" alt="YachtVersal" className="h-12 w-auto" />
        </div>
        <nav className="flex-1 flex justify-center items-center gap-10 text-sm font-medium text-[#10214F]">
          <Link href="/listings" className="hover:text-[#01BBDC]">Search Listings</Link>
          <Link href="/brokers" className="hover:text-[#01BBDC]">Yacht Brokers</Link>
          <Link href="/sellers" className="hover:text-[#01BBDC]">Private Sellers</Link>
          <Link href="/resources" className="hover:text-[#01BBDC]">Resources</Link>
        </nav>
        <div className="flex items-center h-full">
          <Link
            href="/dashboard/listings/new"
            className="bg-[#01BBDC] text-white font-medium rounded-xl px-6 py-3 shadow-lg hover:bg-[#019bb0] transition"
          >
            List a Yacht
          </Link>
        </div>
      </header>

      <section className="relative h-[400px] w-full">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 max-w-[1296px] mx-auto px-6 py-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            {listing.title}
          </h1>
          <p className="mt-3 text-lg text-white/90">{location}</p>
          <p className="mt-6 text-3xl font-semibold text-white">{price}</p>
        </div>
      </section>

      <main className="max-w-[1296px] mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <section className="bg-white rounded-3xl shadow border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-[#10214F] mb-4">Overview</h2>
              <p className="text-gray-700 leading-relaxed">
                {listing.description || 'No description available.'}
              </p>
            </section>

            <section className="bg-white rounded-3xl shadow border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-[#10214F] mb-4">Specifications</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Year</div>
                  <div className="text-base font-semibold text-[#10214F]">{listing.year || '—'}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Make</div>
                  <div className="text-base font-semibold text-[#10214F]">{listing.make || '—'}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Model</div>
                  <div className="text-base font-semibold text-[#10214F]">{listing.model || '—'}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Location</div>
                  <div className="text-base font-semibold text-[#10214F]">{location || '—'}</div>
                </div>
              </div>
            </section>
          </div>

          <aside className="w-full md:w-1/3 space-y-6">
            <div className="bg-white rounded-3xl shadow border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-[#10214F] mb-4">Contact Seller</h2>
              <button
                onClick={() => router.push(`/listings/${id}/contact`)}
                className="w-full py-3 rounded-xl text-white font-semibold bg-[#01BBDC] hover:bg-[#019bb0] transition"
              >
                Send Message
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
