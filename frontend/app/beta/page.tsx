'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, MapPin, Ruler } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import SearchBar from '@/app/components/SearchBar';
import { API_ROOT, mediaUrl } from '@/app/lib/apiRoot';

// --- Types ---

type ListingImage = {
  url: string;
  thumbnail_url?: string;
  is_primary?: boolean;
};

type Listing = {
  id: number | string;
  title: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  currency?: string;
  length_feet?: number;
  city?: string;
  state?: string;
  country?: string;
  boat_type?: string;
  condition?: string;
  status?: string;
  featured?: boolean;
  images?: ListingImage[];
};

// --- Helpers ---

function formatPrice(price?: number, currency = 'USD'): string {
  if (!price) return 'Price on Request';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function getPrimaryImage(listing: Listing): string {
  if (!listing.images?.length) return '/images/listing-fallback.png';
  const primary = listing.images.find((img) => img.is_primary);
  return (primary ?? listing.images[0]).url;
}

function getLocation(listing: Listing): string {
  const parts = [listing.city, listing.state || listing.country].filter(Boolean);
  return parts.join(', ') || 'Location TBD';
}

// --- Featured Listing Card ---

function FeaturedCard({ listing }: { listing: Listing }) {
  const [imgSrc, setImgSrc] = useState(mediaUrl(getPrimaryImage(listing)));

  return (
    <Link href={`/listings/${listing.id}`} className="block group">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden">
        <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
          <img
            src={imgSrc}
            alt={
              [
                listing.year,
                listing.make,
                listing.model,
                listing.length_feet ? `${Math.round(listing.length_feet)}ft` : null,
                getLocation(listing) !== 'Location TBD' ? `in ${getLocation(listing)}` : null,
              ]
                .filter(Boolean)
                .join(' ') || listing.title
            }
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgSrc('/images/listing-fallback.png')}
          />
          {listing.featured && (
            <div
              className="absolute top-3 left-3 px-3 py-1 text-xs font-medium text-white rounded-full"
              style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
            >
              Featured
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col" style={{ minHeight: 180 }}>
          <h3
            className="font-bold text-xl leading-tight line-clamp-2 mb-2"
            style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
          >
            {listing.title}
          </h3>

          <p className="text-2xl font-bold mb-2" style={{ color: '#01BBDC' }}>
            {formatPrice(listing.price, listing.currency)}
          </p>

          <div className="flex items-center gap-3 text-sm mb-4" style={{ color: '#10214F', minHeight: 24 }}>
            {listing.length_feet && (
              <span className="flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                <Ruler className="w-4 h-4 flex-shrink-0" style={{ color: '#01BBDC' }} />
                {Math.round(listing.length_feet)} ft
              </span>
            )}
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: '#01BBDC' }} />
              <span className="truncate">{getLocation(listing)}</span>
            </span>
          </div>

          <div className="mt-auto">
            <span
              className="inline-flex items-center justify-center w-full text-white font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: '#01BBDC',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 15,
                fontWeight: 500,
                borderRadius: 8,
                padding: '10px 0',
              }}
            >
              View Details
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// --- Step Card ---

function StepCard({
  number,
  title,
  description,
  illustration,
}: {
  number: string;
  title: string;
  description: string;
  illustration: string;
}) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
        paddingBottom: 24,
      }}
    >
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0"
        style={{ width: 82, height: 82, backgroundColor: '#01BBDC', marginTop: -41, marginBottom: 16, zIndex: 1, position: 'relative' }}
      >
        <span
          style={{
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            fontSize: 30,
            lineHeight: '36px',
            color: '#FFFFFF',
            fontWeight: 400,
          }}
        >
          {number}
        </span>
      </div>

      <p
        className="text-center px-6"
        style={{
          color: '#10214F',
          fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
          fontSize: 24,
          lineHeight: '29px',
          fontWeight: 400,
          marginBottom: 16,
          minHeight: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {title}
      </p>

      <div
        className="w-full flex-shrink-0"
        style={{ height: 280, backgroundColor: '#F0FEFF', overflow: 'hidden' }}
      >
        <img
          src={illustration}
          alt={`${title} illustration`}
          aria-hidden={true}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      <p
        className="px-6 pt-5"
        style={{
          color: '#10214F',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          lineHeight: '24px',
          textAlign: 'center',
        }}
      >
        {description}
      </p>
    </div>
  );
}

// --- AI Search Box ---

function AISearchBox() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.append('search', query.trim());
    router.push(`/listings?${params.toString()}`);
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '24px 24px 0 0',
        padding: '43px 0 43px 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Logomark watermark */}
      <Image
        src="/logo/wave-only.png"
        alt=""
        aria-hidden={true}
        width={900}
        height={900}
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: 0.35,
        }}
      />

      <h2
        className="text-center font-normal"
        style={{
          color: '#10214F',
          fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
          fontSize: 'clamp(26px, 2.5vw, 40px)',
          lineHeight: '48px',
          fontWeight: 400,
          marginBottom: 22,
        }}
      >
        Skip the Filters - Find the Yacht
      </h2>

      <p
        className="text-center"
        style={{
          color: '#10214F',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          lineHeight: '24px',
          marginBottom: 46,
          opacity: 0.7,
        }}
      >
        Our AI-powered search goes beyond basic filters.<br />
        Tell us what you want—size, lifestyle, budget, cruising plans—and YachtVersal AI matches you with yachts that fit your vision.
      </p>

      <form
        onSubmit={handleSearch}
        className="flex items-center gap-3 mx-auto"
        style={{ maxWidth: 799, paddingLeft: 0, paddingRight: 0 }}
        role="search"
        aria-label="Yacht search"
      >
        <label htmlFor="yacht-search" className="sr-only">
          Describe your ideal yacht
        </label>

        <div className="relative flex-1">
          <input
            id="yacht-search"
            type="search"
            placeholder="I want a 70–90 ft yacht for Bahamas cruising under $3M"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full focus:outline-none"
            style={{
              height: 56,
              border: '1.5px solid #E2E8F0',
              borderRadius: 999,
              backgroundColor: '#F8FAFC',
              paddingLeft: 24,
              paddingRight: 52,
              fontSize: 14,
              lineHeight: '21px',
              fontFamily: 'Poppins, sans-serif',
              color: '#10214F',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <path d="M15 3C15 3 17.25 10.5 22.5 12.75C17.25 15 15 22.5 15 22.5C15 22.5 12.75 15 7.5 12.75C12.75 10.5 15 3 15 3Z" fill="#01BBDC" />
              <path d="M23.5 17.5C23.5 17.5 24.5 21 26.5 22C24.5 23 23.5 26.5 23.5 26.5C23.5 26.5 22.5 23 20.5 22C22.5 21 23.5 17.5 23.5 17.5Z" fill="#01BBDC" opacity="0.6" />
              <path d="M6 4C6 4 6.75 6.75 8.5 7.5C6.75 8.25 6 11 6 11C6 11 5.25 8.25 3.5 7.5C5.25 6.75 6 4 6 4Z" fill="#01BBDC" opacity="0.4" />
            </svg>
          </span>
        </div>

        <button
          type="submit"
          aria-label="Search for yachts"
          className="text-white font-medium transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{
            backgroundColor: '#01BBDC',
            fontFamily: 'Poppins, sans-serif',
            fontSize: 16,
            lineHeight: '24px',
            fontWeight: 500,
            borderRadius: 999,
            width: 155,
            height: 56,
            flexShrink: 0,
          }}
        >
          Quick Search
        </button>
      </form>

      <p
        className="text-center flex items-center justify-center gap-2"
        style={{
          color: '#10214F',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          lineHeight: '24px',
          marginTop: 42,
          opacity: 0.7,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2C12 2 13.5 7 17 8.5C13.5 10 12 15 12 15C12 15 10.5 10 7 8.5C10.5 7 12 2 12 2Z" fill="#01BBDC" />
          <path d="M19 14C19 14 19.75 16.5 21.5 17.25C19.75 18 19 20.5 19 20.5C19 20.5 18.25 18 16.5 17.25C18.25 16.5 19 14 19 14Z" fill="#01BBDC" opacity="0.6" />
          <path d="M5 3C5 3 5.5 4.75 7 5.5C5.5 6.25 5 8 5 8C5 8 4.5 6.25 3 5.5C4.5 4.75 5 3 5 3Z" fill="#01BBDC" opacity="0.4" />
        </svg>
        AI powered search matching lifestyle, size &amp; budget.
      </p>
    </div>
  );
}

// --- Main Page ---

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch(`${API_ROOT}/listings?limit=8&status=active`);
        if (!res.ok) {
          setListings([]);
        } else {
          const data = await res.json();
          const listingsArray = Array.isArray(data) ? data : (data.listings ?? []);
          setListings(listingsArray.slice(0, 8));
        }
      } catch {
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  const steps = [
    {
      number: '01',
      title: 'Step 1: Discover',
      description: 'Explore yachts from brokers and sellers worldwide through one clean, modern marketplace.',
      illustration: '/images/step-discover.svg',
    },
    {
      number: '02',
      title: 'Step 2: Connect',
      description: 'Communicate directly with brokers while YachtVersal support representatives help coordinate questions, next steps, and information.',
      illustration: '/images/step-connect.svg',
    },
    {
      number: '03',
      title: 'Step 3: Move Forward Confidently',
      description: 'Schedule showings, request details, and proceed at your own pace with clarity and transparency.',
      illustration: '/images/step-forward.svg',
    },
  ];

  const features = [
    'Global listings in one trusted platform',
    'Transparent information and professional presentation',
    'Support representatives available when you need guidance',
    'No pressure. No confusion. Just a better experience',
  ];

  return (
    <main className="relative bg-white">

      {/* HERO */}
      <section
        aria-label="Hero"
        className="relative overflow-hidden"
        style={{ height: 'clamp(480px, 60vh, 720px)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-yacht.png"
          alt=""
          aria-hidden={true}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right bottom' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 20%, rgba(255,255,255,0.9) 35%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.2) 70%, rgba(255,255,255,0) 85%)',
          }}
        />
        <div
          className="absolute inset-0 z-10 flex flex-col justify-center"
          style={{ paddingLeft: 'clamp(20px, 16.25vw, 312px)', paddingRight: 20 }}
        >
          <div style={{ maxWidth: 660 }}>
            <h1
              className="font-bold"
              style={{
                color: '#10214F',
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 'clamp(28px, 3.5vw, 56px)',
                lineHeight: 'clamp(34px, 4.5vw, 67px)',
                fontWeight: 700,
                marginBottom: 18,
              }}
            >
              A Simpler Way to<br /><span style={{ color: '#01BBDC' }}>Buy and Sell</span> Your Yacht
            </h1>
            <p
              style={{
                color: '#10214F',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '26px',
                fontWeight: 400,
                marginBottom: 20,
                maxWidth: 640,
              }}
            >
              YachtVersal Combines Smart Technology, Global Reach, and Dedicated Support to Deliver a Smooth Experience for Buyers, Brokers, and Sellers—Without the Complexity.
            </p>
            <p
              style={{
                color: '#01BBDC',
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 'clamp(11px, 1.1vw, 18px)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 40,
                whiteSpace: 'nowrap',
              }}
            >
              Search Globally.&nbsp; Connect Confidently.&nbsp; Move Forward With Clarity.
            </p>
          </div>
        </div>
      </section>

      {/* AI SEARCH BOX */}
      <section className="relative z-20" style={{ marginTop: 0 }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1296,
            paddingLeft: 'clamp(16px, 2vw, 0px)',
            paddingRight: 'clamp(16px, 2vw, 0px)',
          }}
        >
          <AISearchBox />
          <SearchBar showAIOption={false} />
        </div>
      </section>

      {/* FEATURED LISTINGS */}
      <section className="bg-white" style={{ paddingTop: 100, paddingBottom: 100 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(32px, 6vw, 116px)' }}>
            <h2
              className="font-normal"
              style={{
                color: '#10214F',
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 40,
                lineHeight: '48px',
                fontWeight: 400,
              }}
            >
              Featured Listings
            </h2>
            <Link
              href="/listings"
              className="inline-flex items-center justify-center text-white font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: '#01BBDC',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                fontWeight: 500,
                borderRadius: 12,
                height: 48,
                paddingLeft: 22,
                paddingRight: 22,
                whiteSpace: 'nowrap',
              }}
            >
              Browse All Listings
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-24">
              <LoadingSpinner />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-lg" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                No listings available right now. Check back soon.
              </p>
              <Link
                href="/listings"
                className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-medium"
                style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
              >
                Browse All Listings
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: 24 }}>
              {listings.slice(0, 8).map((listing) => (
                <FeaturedCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* HOW BUYING WORKS */}
      <section className="bg-white" style={{ paddingTop: 80, paddingBottom: 100, overflow: 'visible' }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          <h2
            className="font-normal text-center"
            style={{
              color: '#10214F',
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
              fontSize: 'clamp(24px, 3vw, 40px)',
              lineHeight: '1.2',
              fontWeight: 400,
              marginBottom: 'clamp(32px, 5vw, 80px)',
            }}
          >
            How Buying Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 24, paddingTop: 41, overflow: 'visible' }}>
            {steps.map((step) => (
              <StepCard key={step.number} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* BUILT FOR CONFIDENCE */}
      <section aria-label="Built for Confidence" className="relative overflow-hidden" style={{ minHeight: 479 }}>
        <div className="absolute inset-0">
          <Image
            src="/images/elegant-yacht-lagoon.jpg"
            alt="Elegant yacht on a calm lagoon"
            aria-hidden={true}
            fill
            className="object-cover object-center"
          />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0.95) 41.29%, rgba(255,255,255,0) 70.67%)',
          }}
        />
        <div
          className="relative z-10 flex flex-col justify-center"
          style={{
            minHeight: 479,
            paddingLeft: 'clamp(24px, 16.25vw, 312px)',
            paddingRight: 24,
            paddingTop: 48,
            paddingBottom: 48,
          }}
        >
          <div style={{ maxWidth: 629 }}>
            <h2
              className="font-normal"
              style={{
                color: '#10214F',
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 'clamp(28px, 2.5vw, 40px)',
                lineHeight: '48px',
                fontWeight: 400,
                marginBottom: 16,
              }}
            >
              Built for Confidence, Not Complexity
            </h2>
            <p style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 16, lineHeight: '24px', marginBottom: 24 }}>
              YachtVersal was created to remove friction from the yacht marketplace.
            </p>
            <ul aria-label="YachtVersal platform benefits" className="flex flex-col" style={{ gap: 14 }}>
              {features.map((feature) => (
                <li key={feature} className="flex items-center" style={{ gap: 13 }}>
                  <span
                    className="flex-shrink-0 rounded-full flex items-center justify-center"
                    style={{ width: 24, height: 24, backgroundColor: '#01BBDC' }}
                  >
                    <Check aria-hidden={true} className="text-white" style={{ width: 14, height: 14 }} strokeWidth={3} />
                  </span>
                  <span style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 16, lineHeight: '24px' }}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
