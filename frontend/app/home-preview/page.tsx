'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Search, MessageCircle, Handshake, MapPin, Anchor } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import HomeSearchTabs from '@/app/components/HomeSearchTabs';
import ListingCard from '@/app/components/ListingCard';
import CharterCard, { CharterListing } from '@/app/components/CharterCard';
import BlogPostCard, { BlogPostSummary } from '@/app/components/BlogPostCard';
import BoatTypeCard from '@/app/components/boat-types/BoatTypeCard';
import type { BoatType } from '@/app/lib/boatTypeData';
import { fetchLocationNodes, LocationNode } from '@/app/lib/listingLocationsData';
import { API_ROOT } from '@/app/lib/apiRoot';

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
  dealer?: {
    name?: string;
    company_name?: string;
    slug?: string;
    logo_url?: string;
  };
};

// --- Section heading helper (matches existing page.tsx typography) ---

function SectionHeading({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <h2
      className={center ? 'text-center font-normal' : 'font-normal'}
      style={{
        color: '#10214F',
        fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
        fontSize: 32,
        lineHeight: '40px',
        fontWeight: 400,
      }}
    >
      {children}
    </h2>
  );
}

// --- Main Page ---

export default function HomePreviewPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [visitorCurrency, setVisitorCurrency] = useState('USD');

  // New section state
  const [stats, setStats] = useState<{ listings: number | null; brokers: number | null; countries: number | null }>({
    listings: null,
    brokers: null,
    countries: null,
  });
  const [boatTypes, setBoatTypes] = useState<BoatType[]>([]);
  const [locations, setLocations] = useState<LocationNode[]>([]);
  const [charters, setCharters] = useState<CharterListing[]>([]);
  const [chartersLoading, setChartersLoading] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPostSummary[]>([]);
  const [blogLoading, setBlogLoading] = useState(true);

  useEffect(() => {
    // Fetch listings
    const fetchListings = async () => {
      try {
        const res = await fetch(`${API_ROOT}/listings?limit=12&status=active&featured=true&sort=price_desc`);
        if (!res.ok) {
          setListings([]);
        } else {
          const data = await res.json();
          const listingsArray = Array.isArray(data) ? data : (data.listings ?? []);
          setListings(listingsArray.slice(0, 12));
        }
      } catch {
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch exchange rates
    fetch(`${API_ROOT}/currencies/rates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.rates) setExchangeRates(data.rates); })
      .catch(() => {});

    // Auto-detect visitor currency from browser locale
    const locale = (typeof navigator !== 'undefined' ? navigator.language : 'en-US') || 'en-US';
    const region = locale.split('-')[1]?.toUpperCase() ?? '';
    const EUR_REGIONS = ['DE','FR','ES','IT','NL','BE','AT','FI','GR','IE','LU','PT','SK','SI','EE','LV','LT','MT','CY'];
    if (region === 'GB') setVisitorCurrency('GBP');
    else if (region === 'AU') setVisitorCurrency('AUD');
    else if (region === 'CA') setVisitorCurrency('CAD');
    else if (EUR_REGIONS.includes(region)) setVisitorCurrency('EUR');

    fetchListings();

    // Stats bar — active listings total
    fetch(`${API_ROOT}/listings?status=active&limit=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.total != null) setStats((s) => ({ ...s, listings: data.total })); })
      .catch(() => {});

    // Stats bar — verified brokers total
    fetch(`${API_ROOT}/dealers?limit=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.total != null) setStats((s) => ({ ...s, brokers: data.total })); })
      .catch(() => {});

    // Locations (used for both the "Popular Locations" section and the countries stat)
    fetchLocationNodes()
      .then((nodes) => {
        setLocations(nodes);
        const countryCount = nodes.filter((n) => n.type === 'country').length;
        setStats((s) => ({ ...s, countries: countryCount || null }));
      })
      .catch(() => {});

    // Browse by Boat Type — fetch the same static JSON used by boatTypeData.ts,
    // but via a plain browser fetch since that helper uses Node's `fs` and can't
    // run in a client component.
    fetch('/data/boat_types.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BoatType[]) => {
        const published = (Array.isArray(data) ? data : [])
          .filter((b) => b.published)
          .sort((a, b) => a.order - b.order)
          .slice(0, 4);
        setBoatTypes(published);
      })
      .catch(() => setBoatTypes([]));

    // Charter teaser
    fetch(`${API_ROOT}/charter?limit=4&status=active`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCharters(data?.results ?? []))
      .catch(() => setCharters([]))
      .finally(() => setChartersLoading(false));

    // Recent blog posts
    fetch(`${API_ROOT}/blog/posts?status=published&limit=3`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setBlogPosts(data?.posts ?? []))
      .catch(() => setBlogPosts([]))
      .finally(() => setBlogLoading(false));
  }, []);

  const visitorExchangeRate = visitorCurrency !== 'USD' ? (exchangeRates[visitorCurrency] ?? 1) : 1;

  const features = [
    'Global listings in one trusted platform',
    'Transparent information and professional presentation',
    'Support representatives available when you need guidance',
    'No pressure. No confusion. Just a better experience',
  ];

  const popularLocations = [...locations].sort((a, b) => b.count - a.count).slice(0, 8);

  const howItWorks = [
    {
      icon: Search,
      title: '1. Search',
      body: 'Describe what you want in plain English, or use our structured filters, to find yachts for sale and charters that match your vision.',
    },
    {
      icon: MessageCircle,
      title: '2. Connect',
      body: 'Message verified brokers and private sellers directly — no middleman, no pressure, just straightforward answers to your questions.',
    },
    {
      icon: Handshake,
      title: '3. Close',
      body: 'Move forward with financing tools, transparent documentation, and support along the way, right up to the day you take the helm.',
    },
  ];

  return (
    <main className="relative bg-white">

      {/* HERO — desktop */}
      <section
        aria-label="Hero"
        className="relative overflow-hidden hidden md:block"
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

      {/* HERO — mobile-only band (the desktop hero is hidden below md, so mobile
          visitors previously saw no hero at all) */}
      <section aria-label="Hero" className="relative overflow-hidden block md:hidden" style={{ height: 320 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-yacht2.png"
          alt=""
          aria-hidden={true}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.75) 65%, #FFFFFF 100%)' }}
        />
        <div className="absolute inset-0 z-10 flex flex-col justify-end px-5 pb-6">
          <h1
            className="font-bold"
            style={{
              color: '#10214F',
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
              fontSize: 28,
              lineHeight: '34px',
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            A Simpler Way to <span style={{ color: '#01BBDC' }}>Buy and Sell</span> Your Yacht
          </h1>
          <p style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 14, lineHeight: '21px' }}>
            Smart technology, global reach, and dedicated support — without the complexity.
          </p>
        </div>
      </section>

      {/* SEARCH — AI Search / Yacht Search / Charter Search tabs */}
      <section className="relative z-20 bg-white" style={{ marginTop: 0, paddingTop: 32, paddingBottom: 32 }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1296,
            paddingLeft: 'clamp(16px, 2vw, 0px)',
            paddingRight: 'clamp(16px, 2vw, 0px)',
          }}
        >
          <h2
            className="text-center font-normal"
            style={{
              color: '#10214F',
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
              fontSize: 'clamp(26px, 2.5vw, 40px)',
              lineHeight: '48px',
              fontWeight: 400,
              marginBottom: 10,
            }}
          >
            Skip the Filters - Find the Yacht
          </h2>

          <p
            className="text-center mx-auto"
            style={{
              color: '#10214F',
              fontFamily: 'Poppins, sans-serif',
              fontSize: 16,
              lineHeight: '24px',
              marginBottom: 28,
              maxWidth: 720,
              opacity: 0.7,
            }}
          >
            Our AI-powered search goes beyond basic filters.<br />
            Tell us what you want—size, lifestyle, budget, destination—whether you're buying or booking a charter, YachtVersal AI matches you with yachts that fit your vision.
          </p>

          <HomeSearchTabs />
        </div>
      </section>

      {/* STATS / TRUST BAR */}
      {(stats.listings || stats.brokers || stats.countries) && (
        <section style={{ backgroundColor: '#10214F', paddingTop: 28, paddingBottom: 28 }}>
          <div
            className="mx-auto grid grid-cols-1 sm:grid-cols-3 text-center"
            style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)', gap: 20 }}
          >
            {stats.listings != null && (
              <div>
                <p style={{ color: '#01BBDC', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 32, fontWeight: 700 }}>
                  {stats.listings.toLocaleString()}+
                </p>
                <p style={{ color: '#FFFFFF', fontFamily: 'Poppins, sans-serif', fontSize: 14, opacity: 0.8 }}>Active Listings</p>
              </div>
            )}
            {stats.brokers != null && (
              <div>
                <p style={{ color: '#01BBDC', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 32, fontWeight: 700 }}>
                  {stats.brokers.toLocaleString()}+
                </p>
                <p style={{ color: '#FFFFFF', fontFamily: 'Poppins, sans-serif', fontSize: 14, opacity: 0.8 }}>Verified Brokers</p>
              </div>
            )}
            {stats.countries != null && (
              <div>
                <p style={{ color: '#01BBDC', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 32, fontWeight: 700 }}>
                  {stats.countries.toLocaleString()}+
                </p>
                <p style={{ color: '#FFFFFF', fontFamily: 'Poppins, sans-serif', fontSize: 14, opacity: 0.8 }}>Countries Served</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FEATURED LISTINGS */}
      <section style={{ backgroundColor: '#FFFFFF', marginTop: 60, paddingTop: 40, paddingBottom: 80 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(16px, 3vw, 32px)' }}>
            <SectionHeading>Featured Listings</SectionHeading>
            <Link
              href="/listings"
              className="inline-flex items-center justify-center text-white font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: '#01BBDC',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                fontWeight: 500,
                borderRadius: 6,
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch" style={{ gap: 24 }}>
              {listings.slice(0, 12).map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={Number(listing.id)}
                  title={listing.title}
                  price={listing.price}
                  year={listing.year}
                  make={listing.make}
                  model={listing.model}
                  boatType={listing.boat_type}
                  length={listing.length_feet}
                  city={listing.city}
                  state={listing.state}
                  images={listing.images?.map((img) => img.url) || []}
                  condition={listing.condition}
                  featured={listing.featured}
                  currencyCode={visitorCurrency}
                  exchangeRate={visitorExchangeRate}
                  dealerInfo={listing.dealer ? {
                    name: listing.dealer.name || '',
                    company: listing.dealer.company_name || '',
                    slug: listing.dealer.slug,
                    logoUrl: listing.dealer.logo_url,
                  } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* BROWSE BY BOAT TYPE */}
      {boatTypes.length > 0 && (
        <section style={{ backgroundColor: '#F8FAFC', paddingTop: 56, paddingBottom: 56 }}>
          <div className="mx-auto" style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
              <SectionHeading>Browse by Boat Type</SectionHeading>
              <Link href="/boat-types" className="text-sm font-semibold" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                View all types →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 24 }}>
              {boatTypes.map((bt) => (
                <BoatTypeCard key={bt.slug} boatType={bt} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* POPULAR LOCATIONS */}
      {popularLocations.length > 0 && (
        <section style={{ backgroundColor: '#FFFFFF', paddingTop: 56, paddingBottom: 56 }}>
          <div className="mx-auto" style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
              <SectionHeading>Popular Locations</SectionHeading>
              <Link href="/yachts-for-sale" className="text-sm font-semibold" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                View all locations →
              </Link>
            </div>
            <div className="flex flex-wrap" style={{ gap: 12 }}>
              {popularLocations.map((node) => (
                <Link
                  key={node.path.join('/')}
                  href={`/yachts-for-sale/${node.path.join('/')}`}
                  className="hover-lift flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50"
                >
                  <MapPin size={16} style={{ color: '#01BBDC' }} />
                  <span style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 600 }}>
                    {node.label}
                  </span>
                  <span style={{ color: '#10214F', opacity: 0.5, fontFamily: 'Poppins, sans-serif', fontSize: 13 }}>
                    ({node.count})
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CHARTER TEASER */}
      <section style={{ backgroundColor: '#F8FAFC', paddingTop: 56, paddingBottom: 56 }}>
        <div className="mx-auto" style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
            <SectionHeading>Yacht Charters</SectionHeading>
            <Link href="/charter" className="text-sm font-semibold" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
              Browse all charters →
            </Link>
          </div>
          {chartersLoading ? (
            <div className="flex justify-center items-center py-16">
              <LoadingSpinner />
            </div>
          ) : charters.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Anchor className="mx-auto mb-3" size={32} style={{ color: '#01BBDC' }} />
              <p style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                Charter listings coming soon.
              </p>
              <Link href="/charter" className="mt-4 inline-block text-sm font-semibold" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                Explore charter destinations →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 24 }}>
              {charters.map((charter) => (
                <CharterCard key={charter.id} charter={charter} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ backgroundColor: '#FFFFFF', paddingTop: 64, paddingBottom: 64 }}>
        <div className="mx-auto" style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}>
          <SectionHeading center>How It Works</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 32, marginTop: 36 }}>
            {howItWorks.map((step) => (
              <div key={step.title} className="text-center">
                <div
                  className="mx-auto flex items-center justify-center rounded-full"
                  style={{ width: 56, height: 56, backgroundColor: 'rgba(1,187,220,0.1)', marginBottom: 16 }}
                >
                  <step.icon size={24} style={{ color: '#01BBDC' }} />
                </div>
                <h3 style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 20, marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ color: '#10214F', opacity: 0.7, fontFamily: 'Poppins, sans-serif', fontSize: 15, lineHeight: '22px' }}>
                  {step.body}
                </p>
              </div>
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

      {/* BROKER / SELLER CTA STRIP */}
      <section style={{ backgroundColor: '#F8FAFC', paddingTop: 64, paddingBottom: 64 }}>
        <div className="mx-auto" style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}>
          <SectionHeading center>Ready to Sell Your Yacht?</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 24, marginTop: 32 }}>
            <Link href="/sell/brokers" className="hover-lift group relative overflow-hidden rounded-2xl" style={{ height: 280 }}>
              <Image src="/images/broker-hero.jpg" alt="Yacht broker at a marina" fill className="object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(16,33,79,0.2) 0%, rgba(16,33,79,0.85) 100%)' }} />
              <div className="absolute inset-0 flex flex-col justify-end p-8">
                <h3 style={{ color: '#FFFFFF', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 24, marginBottom: 6 }}>
                  For Yacht Brokers
                </h3>
                <p style={{ color: '#FFFFFF', opacity: 0.85, fontFamily: 'Poppins, sans-serif', fontSize: 14, marginBottom: 12 }}>
                  Manage your full inventory, your team, and your analytics in one place — with plans built to scale.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#01BBDC' }}>
                  See broker plans →
                </span>
              </div>
            </Link>
            <Link href="/sell/private" className="hover-lift group relative overflow-hidden rounded-2xl" style={{ height: 280 }}>
              <Image src="/images/private-seller-hero.jpg" alt="Private yacht owner" fill className="object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(16,33,79,0.2) 0%, rgba(16,33,79,0.85) 100%)' }} />
              <div className="absolute inset-0 flex flex-col justify-end p-8">
                <h3 style={{ color: '#FFFFFF', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 24, marginBottom: 6 }}>
                  For Private Sellers
                </h3>
                <p style={{ color: '#FFFFFF', opacity: 0.85, fontFamily: 'Poppins, sans-serif', fontSize: 14, marginBottom: 12 }}>
                  Selling your own yacht? List simply and affordably, with no broker required.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#01BBDC' }}>
                  See private seller plans →
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* RECENT BLOG POSTS */}
      <section style={{ backgroundColor: '#FFFFFF', paddingTop: 56, paddingBottom: 80 }}>
        <div className="mx-auto" style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
            <SectionHeading>From the Blog</SectionHeading>
            <Link href="/blog" className="text-sm font-semibold" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
              Read more →
            </Link>
          </div>
          {blogLoading ? (
            <div className="flex justify-center items-center py-16">
              <LoadingSpinner />
            </div>
          ) : blogPosts.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
              <p style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                New posts coming soon.
              </p>
              <Link href="/blog" className="mt-4 inline-block text-sm font-semibold" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                Visit the blog →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 24 }}>
              {blogPosts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
