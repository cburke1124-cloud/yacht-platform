'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, MapPin, Ruler } from 'lucide-react';
import LoadingSpinner from './components/LoadingSpinner';
import SearchBar from './components/SearchBar';
import { API_ROOT } from './lib/apiRoot';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Featured Listing Card — Figma: 416×480, image 317px tall ────────────────
// Card uses a fixed total height (480px) so all cards in the grid stay uniform.
// The body area is exactly 163px (480 - 317) and uses flex to pin price+button
// to the bottom regardless of title length.

function FeaturedCard({ listing }: { listing: Listing }) {
  const [imgSrc, setImgSrc] = useState(getPrimaryImage(listing));

  return (
    <Link href={`/listings/${listing.id}`} className="block group h-full">
      <div
        className="bg-white overflow-hidden transition-shadow duration-300 group-hover:shadow-2xl flex flex-col h-[380px] sm:h-[480px]"
        style={{ border: '1px solid #DBDBDB', borderRadius: 12 }}
      >
        {/* Image — responsive height */}
        <div className="relative w-full flex-shrink-0 overflow-hidden h-[220px] sm:h-[317px]">
          <Image
            src={imgSrc}
            alt={
              [
                listing.year,
                listing.make,
                listing.model,
                listing.length_feet ? `${Math.round(listing.length_feet)}ft` : null,
                getLocation(listing) !== 'Location TBD'
                  ? `in ${getLocation(listing)}`
                  : null,
              ]
                .filter(Boolean)
                .join(' ') || listing.title
            }
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
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

        {/* Card body — fills remaining 163px, flex column so bottom row is pinned */}
        <div className="flex flex-col flex-1 px-5 pt-[17px] pb-5 min-h-0">
          {/* Title — clamp to 2 lines max so it never pushes content down */}
          <h3
            className="font-normal overflow-hidden"
            style={{
              color: '#10214F',
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
              fontSize: 24,
              lineHeight: '29px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              marginBottom: 8,
            }}
          >
            {listing.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center flex-wrap" style={{ gap: 16, marginBottom: 8 }}>
            {listing.length_feet && (
              <span
                className="flex items-center gap-1"
                style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 16, lineHeight: '24px' }}
              >
                <Ruler aria-hidden={true} className="w-5 h-5 flex-shrink-0" style={{ color: '#01BBDC' }} />
                {Math.round(listing.length_feet)} ft
              </span>
            )}
            <span
              className="flex items-center gap-1"
              style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 16, lineHeight: '24px' }}
            >
              <MapPin aria-hidden={true} className="w-5 h-5 flex-shrink-0" style={{ color: '#01BBDC' }} />
              {getLocation(listing)}
            </span>
          </div>

          {/* Spacer pushes price + button to bottom */}
          <div className="flex-1" />

          {/* Bottom row: price left, button right — always at card bottom */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="font-bold"
              style={{
                color: '#01BBDC',
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 24,
                lineHeight: '29px',
              }}
            >
              {formatPrice(listing.price, listing.currency)}
            </span>

            <span
              className="flex-shrink-0 inline-flex items-center justify-center text-white font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: '#01BBDC',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                fontWeight: 500,
                borderRadius: 12,
                width: 120,
                height: 48,
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

// ─── Step Card (How Buying Works) ────────────────────────────────────────────

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
      {/* Number bubble — floats above the card top edge via negative margin.
          No overflow:hidden on the card so the circle is fully visible. */}
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

      {/* Step title — centered, fixed height so all three cards align */}
      <p
        className="text-center px-6"
        style={{
          color: '#10214F',
          fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
          fontSize: 24,
          lineHeight: '29px',
          fontWeight: 400,
          marginBottom: 16,
          minHeight: 58, // enough for up to 2 lines
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {title}
      </p>

      {/* Illustration — full card width, fixed height, overflow clipped here only */}
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

      {/* Description */}
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

// ─── AI Search Box — Figma: 1296×339 card with shadow ────────────────────────
// NOTE: Search functionality is a separate component; this shell wires the
// router for the inline fallback used on this page.

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
      className="bg-secondary"
      style={{
        boxShadow: '0px 1px 10.2px rgba(0,0,0,0.15)',
        borderRadius: '24px 24px 0 0',
        padding: '43px 0 43px 0',
      }}
    >
      {/* Heading — Figma: Bahnschrift 40/48, #10214F, centered */}
      <h2
        className="text-center font-normal"
        style={{
          color: '#FFFFFF',
          fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
          fontSize: 'clamp(26px, 2.5vw, 40px)',
          lineHeight: '48px',
          fontWeight: 400,
          marginBottom: 22,
        }}
      >
        Find the Right Yacht — Without Endless Filters
      </h2>

      {/* Sub-heading — Figma: Poppins 16/24, #10214F, centered */}
      <p
        className="text-center"
        style={{
          color: '#FFFFFF',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          lineHeight: '24px',
          marginBottom: 46,
        }}
      >
        Tell us what you&apos;re looking for, and YachtVersal AI does the rest.
      </p>

      {/* Search row — Figma: 666px input + 30px AI icon + 121px button */}
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

        {/* Input — Figma: 666×56, border rgba(117,117,117,0.4), radius 6 */}
        <div className="relative flex-1">
          <input
            id="yacht-search"
            type="search"
            placeholder="Describe your ideal yacht..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full focus:outline-none"
            style={{
              height: 56,
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.08)',
              paddingLeft: 20,
              paddingRight: 52,
              fontSize: 14,
              lineHeight: '21px',
              fontFamily: 'Poppins, sans-serif',
              color: '#FFFFFF',
            }}
          />
          {/* AI icon inside input — Figma: 30×30, path fill #01BBDC */}
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          >
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <path
                d="M15 3C15 3 17.25 10.5 22.5 12.75C17.25 15 15 22.5 15 22.5C15 22.5 12.75 15 7.5 12.75C12.75 10.5 15 3 15 3Z"
                fill="#01BBDC"
              />
              <path
                d="M23.5 17.5C23.5 17.5 24.5 21 26.5 22C24.5 23 23.5 26.5 23.5 26.5C23.5 26.5 22.5 23 20.5 22C22.5 21 23.5 17.5 23.5 17.5Z"
                fill="#01BBDC"
                opacity="0.6"
              />
              <path
                d="M6 4C6 4 6.75 6.75 8.5 7.5C6.75 8.25 6 11 6 11C6 11 5.25 8.25 3.5 7.5C5.25 6.75 6 4 6 4Z"
                fill="#01BBDC"
                opacity="0.4"
              />
            </svg>
          </span>
        </div>

        {/* Search button — Figma: 121×56, #01BBDC, radius 12 */}
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
            borderRadius: 12,
            width: 121,
            height: 56,
            flexShrink: 0,
          }}
        >
          Search
        </button>
      </form>

      {/* AI tag line — Figma: Poppins 16/24, icon + text, centered */}
      <p
        className="text-center flex items-center justify-center gap-2"
        style={{
          color: '#FFFFFF',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          lineHeight: '24px',
          marginTop: 42,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2C12 2 13.5 7 17 8.5C13.5 10 12 15 12 15C12 15 10.5 10 7 8.5C10.5 7 12 2 12 2Z"
            fill="#01BBDC"
          />
          <path
            d="M19 14C19 14 19.75 16.5 21.5 17.25C19.75 18 19 20.5 19 20.5C19 20.5 18.25 18 16.5 17.25C18.25 16.5 19 14 19 14Z"
            fill="#01BBDC"
            opacity="0.6"
          />
          <path
            d="M5 3C5 3 5.5 4.75 7 5.5C5.5 6.25 5 8 5 8C5 8 4.5 6.25 3 5.5C4.5 4.75 5 3 5 3Z"
            fill="#01BBDC"
            opacity="0.4"
          />
        </svg>
        AI powered search matching lifestyle, size &amp; budget.
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch(`${API_ROOT}/listings?limit=9&status=active`);
        if (!res.ok) {
          console.error('Failed to fetch listings:', res.status, res.statusText);
          setListings([]);
        } else {
          const data = await res.json();
          const listingsArray = Array.isArray(data) ? data : (data.listings ?? []);
          // Prefer featured listings; fall back to most-recently-added
          const featured = listingsArray.filter((l: Listing) => l.featured);
          setListings(featured.length ? featured : listingsArray.slice(0, 9));
        }
      } catch (err) {
        console.error('Error fetching listings:', err);
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
      description:
        'Explore yachts from brokers and sellers worldwide through one clean, modern marketplace.',
      illustration: '/images/step-discover.svg',
    },
    {
      number: '02',
      title: 'Step 2: Connect',
      description:
        'Communicate directly with brokers while YachtVersal support representatives help coordinate questions, next steps, and information.',
      illustration: '/images/step-connect.svg',
    },
    {
      number: '03',
      title: 'Step 3: Move Forward Confidently',
      description:
        'Schedule showings, request details, and proceed at your own pace with clarity and transparency.',
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

      {/* ══════════════════════════════════════════════════════════════════
          HERO — 1920×1000, full-bleed photo, white gradient L→R, text left
          Figma: gradient 90deg #FFF 0% / 6.19% → transparent 70.67%
      ══════════════════════════════════════════════════════════════════ */}
      <section
        aria-label="Hero"
        className="relative overflow-hidden"
        style={{ minHeight: 'clamp(500px, 80vh, 1000px)' }}
      >
        {/* Background photo */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero-yacht.png"
            alt="Luxury yacht at sea"
            aria-hidden={true}
            fill
            className="object-cover object-center"
            priority
          />
        </div>

        {/* Figma gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 6.19%, rgba(255,255,255,0) 70.67%)',
          }}
        />

        {/* Hero content — Figma: TEXT block left: 312px, top: ~355px */}
        <div
          className="relative z-10 flex flex-col justify-center"
          style={{ minHeight: 'clamp(400px, 70vh, 900px)', paddingLeft: 'clamp(20px, 16.25vw, 312px)', paddingRight: 20 }}
        >
          <div style={{ maxWidth: 660 }}>
            {/* H1 — Figma: Bahnschrift Bold 56/67, #10214F, width ~565px */}
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
              A Simpler Way to Buy and Sell Your Yacht
            </h1>

            {/* Sub line 1 */}
            <p
              style={{
                color: '#10214F',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '26px',
                marginBottom: 12,
                maxWidth: 640,
              }}
            >
              Yachtversal Simplifies Your Buying Experience by Connecting Buyers and Listings in a Trusted, Intuitive Online Marketplace.
            </p>

            {/* Sub line 2 */}
            <p
              style={{
                color: '#10214F',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '26px',
                marginBottom: 20,
                maxWidth: 640,
              }}
            >
              We Bring Together Intelligent Technology, Global Reach, and Dedicated Support Representatives to Create a Better Experience for Buyers, Brokers, and Sellers—Without Unnecessary Complexity.
            </p>

            {/* Tagline */}
            <p
              style={{
                color: '#10214F',
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 'clamp(13px, 1.1vw, 16px)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 40,
                opacity: 0.75,
              }}
            >
              Search Globally.&nbsp; Connect Confidently.&nbsp; Move Forward With Clarity.
            </p>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          AI SEARCH BOX — Figma: 1296×339, top 956px (overlaps hero bottom)
          shadow: 0px 1px 10.2px rgba(0,0,0,0.15), radius 24
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-20" style={{ marginTop: -160 }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1296,
            paddingLeft: 'clamp(16px, 2vw, 0px)',
            paddingRight: 'clamp(16px, 2vw, 0px)',
          }}
        >
          <AISearchBox />
          <SearchBar showAIOption={false} squareTop />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FEATURED LISTINGS — Figma: top 1395, 1296px wide, 3-col grid
          Section header left-aligned, "View All Listings" button right
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="bg-white"
        style={{ paddingTop: 100, paddingBottom: 100 }}
      >
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          {/* Section header — Figma: "Featured Listings" Bahnschrift 40/48, button right */}
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 'clamp(32px, 6vw, 116px)' }}
          >
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

            {/* Figma: 171×48, #01BBDC, radius 12 */}
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
              Search Listings
            </Link>
          </div>

          {/* Cards — 3-col grid, gap matches Figma spacing between 416px columns */}
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <LoadingSpinner />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-24">
              <p
                className="text-lg"
                style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}
              >
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
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              style={{ gap: 24 }}
            >
              {listings.slice(0, 9).map((listing) => (
                <FeaturedCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>



      {/* ══════════════════════════════════════════════════════════════════
          HOW BUYING WORKS — Figma: top 3099, 1296×822
          3 columns with step number bubbles, illustration boxes, descriptions
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="bg-white"
        style={{ paddingTop: 80, paddingBottom: 100, overflow: 'visible' }}
      >
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          {/* Title — centered */}
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

          {/* 3-col step cards — paddingTop gives room for the 82px bubble (half = 41px) */}
          <div
            className="grid grid-cols-1 md:grid-cols-3"
            style={{ gap: 24, paddingTop: 41, overflow: 'visible' }}
          >
            {steps.map((step) => (
              <StepCard key={step.number} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          BUILT FOR CONFIDENCE — Figma: top 4021, 1920×479
          Full-width photo, white gradient left→right, checklist left
      ══════════════════════════════════════════════════════════════════ */}
      <section
        aria-label="Built for Confidence"
        className="relative overflow-hidden"
        style={{ minHeight: 479 }}
      >
        {/* Background photo */}
        <div className="absolute inset-0">
          <Image
            src="/images/elegant-yacht-lagoon.jpg"
            alt="Elegant yacht on a calm lagoon"
            aria-hidden={true}
            fill
            className="object-cover object-center"
          />
        </div>

        {/* Figma gradient: 90deg, #FFF 0%, rgba(255,255,255,0.95) 41.29%, transparent 70.67% */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0.95) 41.29%, rgba(255,255,255,0) 70.67%)',
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
          {/* Figma: Group 54, width 629, left 312, top 4088 */}
          <div style={{ maxWidth: 629 }}>
            {/* Title — Figma: Bahnschrift 40/48, #10214F */}
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

            {/* Sub — Figma: Poppins 16/24, #10214F */}
            <p
              style={{
                color: '#10214F',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                marginBottom: 24,
              }}
            >
              YachtVersal was created to remove friction from the yacht marketplace.
            </p>

            {/* Feature checklist — tighter spacing to fit within 479px section */}
            <ul
              aria-label="YachtVersal platform benefits"
              className="flex flex-col"
              style={{ gap: 14 }}
            >
              {features.map((feature) => (
                <li key={feature} className="flex items-center" style={{ gap: 13 }}>
                  {/* Figma: vuesax/bold/tick-circle, 24×24, fill #01BBDC */}
                  <span
                    className="flex-shrink-0 rounded-full flex items-center justify-center"
                    style={{ width: 24, height: 24, backgroundColor: '#01BBDC' }}
                  >
                    <Check aria-hidden={true} className="text-white" style={{ width: 14, height: 14 }} strokeWidth={3} />
                  </span>
                  <span
                    style={{
                      color: '#10214F',
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 16,
                      lineHeight: '24px',
                    }}
                  >
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