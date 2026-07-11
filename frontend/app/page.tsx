import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Check } from 'lucide-react';
import HomeSearchTabs from '@/app/components/HomeSearchTabs';
import HomeFeaturedListings, { type Listing } from '@/app/components/HomeFeaturedListings';
import { API_ROOT } from '@/app/lib/apiRoot';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

const TITLE = 'YachtVersal - Buy, Sell & Charter Luxury Yachts';
const DESCRIPTION = 'A smarter way to buy, sell, and charter yachts. Browse verified listings from trusted brokers and private sellers worldwide, with AI-powered search matched to your budget, size, and destination.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

async function fetchFeaturedListings(): Promise<Listing[]> {
  try {
    const res = await fetch(`${API_ROOT}/listings?limit=12&status=active&featured=true&sort=price_desc`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const listingsArray = Array.isArray(data) ? data : (data.listings ?? []);
    return listingsArray.slice(0, 12);
  } catch {
    return [];
  }
}

// --- Main Page ---

export default async function HomePage() {
  const listings = await fetchFeaturedListings();

  const features = [
    'Global listings in one trusted platform',
    'Transparent information and professional presentation',
    'Support representatives available when you need guidance',
    'No pressure. No confusion. Just a better experience',
  ];

  return (
    <main className="relative bg-white">

      {/* HERO — hidden on mobile */}
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

      {/* FEATURED LISTINGS */}
      <section style={{ backgroundColor: '#FFFFFF', marginTop: 60, paddingTop: 40, paddingBottom: 100 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(16px, 3vw, 32px)' }}>
            <h2
              className="font-normal"
              style={{
                color: '#10214F',
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 32,
                lineHeight: '40px',
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

          <HomeFeaturedListings initialListings={listings} />
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
