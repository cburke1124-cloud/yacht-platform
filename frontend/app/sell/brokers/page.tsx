'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, Globe, Users, Zap, BarChart2, Headphones, Award } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

// ─── Tier display config ──────────────────────────────────────────────────────────────────────
// Silver (outline CTA), Gold (filled navy CTA), Platinum (outline CTA), Ultimate (enterprise)

const TIER_DISPLAY: Record<string, { badge: string; variant: 'outline' | 'filled' | 'enterprise' }> = {
  basic:    { badge: 'Silver',     variant: 'outline' },
  plus:     { badge: 'Gold',       variant: 'filled'  },
  pro:      { badge: 'Platinum',   variant: 'outline' },
  ultimate: { badge: 'Ultimate',   variant: 'enterprise' },
};

type SubscriptionTier = {
  key: string;
  name: string;
  price: number;
  listings: number;
  images_per_listing: number;
  videos: number;
  features: string[];
  trial_days?: number;
  is_custom_pricing?: boolean;
};

const FALLBACK_TIERS: SubscriptionTier[] = [
  {
    key: 'basic',
    name: 'Basic',
    price: 29,
    listings: 25,
    images_per_listing: 15,
    videos: 1,
    trial_days: 14,
    features: [
      '25 active listings',
      '15 images per listing',
      '1 video per listing',
      'Enhanced search visibility',
      'Priority email support',
      'Analytics dashboard',
    ],
  },
  {
    key: 'plus',
    name: 'Plus',
    price: 59,
    listings: 75,
    images_per_listing: 30,
    videos: 3,
    trial_days: 14,
    features: [
      '75 active listings',
      '30 images per listing',
      '3 videos per listing',
      'Priority search placement',
      'Featured dealer badge',
      'Priority support',
      'Advanced analytics',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 99,
    listings: 999999,
    images_per_listing: 50,
    videos: 5,
    trial_days: 30,
    features: [
      'Unlimited listings',
      '50 images per listing',
      '5 videos per listing',
      'Top search placement',
      'Featured dealer badge',
      'Dedicated account manager',
      'Advanced analytics',
      'AI scraper tools',
    ],
  },  {
    key: 'ultimate',
    name: 'Ultimate',
    price: 0,
    listings: 999999,
    images_per_listing: 999999,
    videos: 999999,
    trial_days: 0,
    is_custom_pricing: true,
    features: [
      'Unlimited listings',
      'Unlimited images & video',
      'White-glove onboarding',
      'Dedicated account manager',
      'Custom API integrations',
      'Branded micro-site',
      'Premium search placement',
      'Co-brokering network access',
    ],
  },];

// ─── Data ─────────────────────────────────────────────────────────────────────

const brokerBenefits = [
  {
    icon: <Globe className="w-8 h-8" />,
    title: 'Global Exposure',
    description: 'Global exposure through a clean, modern marketplace reaching international buyers.',
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: 'Intelligent AI Search',
    description: 'Intelligent AI-powered search that surfaces your listings to high-intent buyers.',
  },
  {
    icon: <Award className="w-8 h-8" />,
    title: 'Premium Presentation',
    description: 'Professional presentation of photos, videos, specifications, and pricing.',
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: 'Qualified Leads',
    description: 'Qualified lead delivery directly to you — no interference in your process.',
  },
  {
    icon: <BarChart2 className="w-8 h-8" />,
    title: 'No Commissions',
    description: 'No commissions taken by YachtVersal. You keep 100% of your earnings.',
  },
  {
    icon: <Headphones className="w-8 h-8" />,
    title: 'Dedicated Support',
    description: 'Support representatives available to assist with buyer coordination and platform use.',
  },
];

const howItWorksSteps = [
  {
    number: 1,
    title: 'Create or Import Your Listings',
    description:
      "Upload your yacht listings using YachtVersal's intuitive broker dashboard. Add photos, videos, specifications, features, and pricing or import listings directly through supported integrations. Our platform is designed for speed and ease, minimizing admin work.",
    image: '/images/broker-dashboard.jpg',
    side: 'right' as const,
  },
  {
    number: 2,
    title: 'Listing Optimization & Review',
    description:
      'Once submitted, YachtVersal reviews and optimizes each listing to ensure consistency, clarity, and premium presentation. We format media, organize specifications, and prepare your listing for global distribution.',
    image: '/images/listing-optimization.jpg',
    side: 'left' as const,
  },
  {
    number: 3,
    title: 'Global Distribution & Marketing',
    description:
      "Your listings are promoted across YachtVersal's global marketplace, partner platforms, and targeted digital campaigns. Our intelligent marketing engine works continuously to position your yachts in front of qualified buyers worldwide.",
    image: '/images/global-marketing.jpg',
    side: 'right' as const,
  },
  {
    number: 4,
    title: 'Lead Capture & Delivery',
    description:
      'All buyer inquiries are captured, qualified, and delivered directly to you or your brokerage. You control all communication, showings, negotiations, and closing activity.',
    image: '/images/lead-delivery.jpg',
    side: 'left' as const,
  },
  {
    number: 5,
    title: 'Ongoing Support & Performance Insights',
    description:
      "YachtVersal support representatives assist with listing updates, questions, and optimization opportunities. As the platform evolves, your listings benefit from ongoing enhancements in visibility, search performance, and buyer engagement.",
    image: '/images/performance-insights.jpg',
    side: 'right' as const,
  },
];

const membershipBenefits = [
  'Professional listing visibility across the YachtVersal marketplace',
  'Strategic placement within search results and featured sections',
  'Access to intelligent marketing and buyer-matching tools',
  'Dedicated onboarding and ongoing support representatives',
  'Broker Member designation displayed on profiles and listings',
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SellBrokersPage() {
  const router = useRouter();
  const [tiers, setTiers] = useState<SubscriptionTier[]>(FALLBACK_TIERS);
  const [tiersLoading, setTiersLoading] = useState(true);

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        fetch(apiUrl('/health'), { method: 'GET', cache: 'no-store' }).catch(() => {});
        const res = await fetch(apiUrl('/pricing-tiers'), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const source = data.broker ?? data;
          const tiersArray: SubscriptionTier[] = (Array.isArray(source)
            ? source
            : Object.entries(source).map(([key, val]: [string, any]) => ({ key, ...val }))
          ).filter((t: any) => t.active !== false);
          if (tiersArray.length > 0) setTiers(tiersArray);
        }
      } catch {
        // silently fall back
      } finally {
        setTiersLoading(false);
      }
    };
    fetchTiers();
  }, []);

  const handleSelectTier = (tierKey: string) => {
    router.push(`/register?user_type=dealer&subscription_tier=${tierKey}`);
  };

  return (
    <main className="relative bg-white">

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Figma: 1920×516, photo right, white gradient left
          Title: Bahnschrift Bold 56/67, left 312px
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative w-full overflow-hidden" style={{ height: 401 }}>
        {/* Background photo — mirrored (transform: matrix(-1,0,0,1,0,0) in Figma) */}
        <div className="absolute inset-0">
          <Image
            src="/images/broker-hero.jpg"
            alt="Broker consulting with yacht buyer"
            aria-hidden
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Full-height gradient overlay — ensure gradient spans entire 401px hero */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 25%, rgba(255,255,255,0) 70.67%)',
          }}
        />

        {/* Hero text — Figma: "Yacht Brokers" left 312, top 282 */}
        <div
          className="relative z-10 flex flex-col justify-center"
          style={{ minHeight: 516, paddingLeft: 'clamp(24px, 16.25vw, 312px)', paddingRight: '35%' }}
        >
          <h1
            style={{
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
              fontSize: 'clamp(36px, 3.5vw, 56px)',
              lineHeight: '67px',
              fontWeight: 700,
              color: '#10214F',
              marginBottom: 0,
            }}
          >
            Yacht Brokers
          </h1>


        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          BUILT TO SUPPORT BROKERS + PRICING CARDS
          Figma: Group 122, left 312, top 615, width 1296
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white" style={{ paddingTop: 80, paddingBottom: 100 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          {/* Section header — Figma: Group 117, centered, top 615 */}
          <div className="text-center" style={{ marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 30,
                lineHeight: '36px',
                fontWeight: 600,
                color: '#10214F',
                marginBottom: 12,
              }}
            >
              Built to Support Brokers — Not Replace Them
            </h2>
            <p
              className="mx-auto"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#10214F',
                maxWidth: 843,
              }}
            >
              YachtVersal is a global yacht marketing platform designed to enhance broker visibility, simplify listing management, and connect you with qualified buyers without interfering in your client relationships.
            </p>
            <p
              className="mx-auto"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#10214F',
                maxWidth: 659,
                marginTop: 12,
              }}
            >
              We operate as a marketing partner, not a middleman. You remain in full control of communication, negotiation, and closing.
            </p>
          </div>

          {/* ── PRICING CARDS — 4 cards matching register page, tab badge on top ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: 24 }}>
            {tiersLoading
              ? [0, 1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex justify-center" style={{ marginBottom: -1 }}>
                      <div className="rounded-xl bg-gray-200" style={{ width: 118, height: 48 }} />
                    </div>
                    <div className="rounded-xl" style={{ border: '1px solid #e5e7eb', minHeight: 403, background: '#FFFFFF', paddingTop: 40, paddingLeft: 32, paddingRight: 32, paddingBottom: 32 }}>
                      <div className="h-9 bg-gray-200 rounded w-1/2 mx-auto mb-6" />
                      {[1, 2, 3].map((j) => <div key={j} className="h-5 bg-gray-100 rounded mb-4" />)}
                      <div className="h-12 bg-gray-200 rounded-xl mt-8" />
                    </div>
                  </div>
                ))
              : tiers.map((tier) => {
                  const display = TIER_DISPLAY[tier.key] ?? { badge: tier.name, variant: 'outline' as const };
                  const isEnterprise = display.variant === 'enterprise';
                  const isCustom = tier.is_custom_pricing || isEnterprise;
                  const priceLabel = isCustom ? 'Custom Pricing' : `$${tier.price}/month`;
                  const trialDays = tier.trial_days ?? 0;

                  return (
                    <div key={tier.key} className="relative flex flex-col" style={{ paddingTop: 24 }}>
                      {/* Badge tab — centered, overlapping top border */}
                      <div
                        className="absolute left-1/2 flex items-center justify-center"
                        style={{
                          transform: 'translateX(-50%)',
                          top: 0,
                          backgroundColor: isEnterprise ? '#D4AF37' : '#01BBDC',
                          borderRadius: 12,
                          width: 118,
                          height: 48,
                          zIndex: 2,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                            fontSize: 18,
                            lineHeight: '22px',
                            fontWeight: 600,
                            color: isEnterprise ? '#10214F' : '#FFFFFF',
                          }}
                        >
                          {tier.name}
                        </span>
                      </div>

                      {/* Card body */}
                      <div
                        className="flex flex-col flex-1"
                        style={{
                          backgroundColor: isEnterprise ? '#10214F' : '#FFFFFF',
                          border: isEnterprise ? '2px solid #D4AF37' : '1px solid #01BBDC',
                          boxShadow: '0px 0px 4px rgba(0,0,0,0.25)',
                          borderRadius: 12,
                          minHeight: 403,
                          paddingTop: 40,
                          paddingLeft: 24,
                          paddingRight: 24,
                          paddingBottom: 32,
                        }}
                      >
                        {/* Price */}
                        <p
                          className="text-center"
                          style={{
                            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                            fontSize: isCustom ? 22 : 30,
                            lineHeight: '36px',
                            fontWeight: 600,
                            color: isEnterprise ? '#FFFFFF' : '#10214F',
                            marginBottom: 24,
                          }}
                        >
                          {priceLabel}
                        </p>

                        {/* Stripe / enterprise subtitle */}}
                        <p
                          className="text-center"
                          style={{
                            fontFamily: 'Poppins, sans-serif',
                            fontSize: 12,
                            color: isEnterprise ? 'rgba(255,255,255,0.5)' : 'rgba(16,33,79,0.4)',
                            marginBottom: 24,
                          }}
                        >
                          {isCustom ? 'Tailored to your brokerage' : '🔒 Billed securely via Stripe'}
                        </p>

                        {/* Features */}
                        <ul className="flex-1 flex flex-col items-center" style={{ gap: 16, marginBottom: 32 }}>
                          {tier.features.map((f) => (
                            <li
                              key={f}
                              style={{
                                fontFamily: 'Poppins, sans-serif',
                                fontSize: 14,
                                lineHeight: '22px',
                                color: isEnterprise ? 'rgba(255,255,255,0.85)' : '#10214F',
                                textAlign: 'center',
                              }}
                            >
                              {f}
                            </li>
                          ))}
                        </ul>

                        {/* CTA */}
                        {isEnterprise ? (
                          <Link
                            href="/contact?tier=ultimate"
                            className="w-full flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg"
                            style={{
                              backgroundColor: '#FFFFFF',
                              color: '#10214F',
                              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                              fontSize: 18,
                              lineHeight: '22px',
                              fontWeight: 600,
                              borderRadius: 12,
                              height: 48,
                            }}
                          >
                            Contact Us
                          </Link>
                        ) : display.variant === 'filled' ? (
                          <button
                            onClick={() => handleSelectTier(tier.key)}
                            className="w-full flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg"
                            style={{
                              backgroundColor: '#10214F',
                              color: '#FFFFFF',
                              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                              fontSize: 18,
                              lineHeight: '22px',
                              fontWeight: 600,
                              borderRadius: 12,
                              height: 48,
                            }}
                          >
                            Get Started
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectTier(tier.key)}
                            className="w-full flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg hover:bg-[#10214F] hover:text-white"
                            style={{
                              border: '1px solid #10214F',
                              backgroundColor: 'transparent',
                              color: '#10214F',
                              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                              fontSize: 18,
                              lineHeight: '22px',
                              fontWeight: 600,
                              borderRadius: 12,
                              height: 48,
                            }}
                          >
                            Get Started
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          WHY BROKERS LIST WITH YACHTVERSAL
          Figma: Group 153, bg rgba(16,33,79,0.02), top 1357, 1920×821
          3×2 grid of benefit cards, 416px each, white bg, border rgba(16,33,79,0.1)
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: '#10214F', paddingTop: 80, paddingBottom: 100 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          {/* Header — Figma: "Why Brokers List With YachtVersal", Bahnschrift SemiBold 30/36, centered */}
          <div className="text-center" style={{ marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 30,
                lineHeight: '36px',
                fontWeight: 600,
                color: '#FFFFFF',
                marginBottom: 12,
              }}
            >
              Why Brokers List With YachtVersal
            </h2>
            <p
              className="mx-auto"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#FFFFFF',
                maxWidth: 570,
              }}
            >
              YachtVersal helps brokers modernize how their listings are discovered, marketed, and engaged with by today's buyers.
            </p>
          </div>

          {/* 3×2 benefit cards — Figma: 416×245 each, white bg, border rgba(16,33,79,0.1), radius 12 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 24 }}>
            {brokerBenefits.map((benefit) => (
              <div
                key={benefit.title}
                className="flex flex-col"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(16,33,79,0.1)',
                  borderRadius: 12,
                  padding: '32px',
                  minHeight: 245,
                  gap: 16,
                }}
              >
                {/* Icon — Figma: 32×32, #01BBDC */}
                <div style={{ color: '#01BBDC', width: 32, height: 32 }}>{benefit.icon}</div>

                {/* Title — Figma: Bahnschrift 24/29, #10214F */}
                <h3
                  style={{
                    fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                    fontSize: 24,
                    lineHeight: '29px',
                    fontWeight: 400,
                    color: '#10214F',
                  }}
                >
                  {benefit.title}
                </h3>

                {/* Description — Figma: Poppins 16/24, #10214F */}
                <p
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: 16,
                    lineHeight: '24px',
                    color: '#10214F',
                  }}
                >
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          HOW LISTING WITH YACHTVERSAL WORKS FOR BROKERS
          Figma: Group 130, top 2278, 5 alternating image+text steps
          Odd steps: image left, text right. Even steps: text left, image right.
          Step titles: Bahnschrift 24/29, #01BBDC. Body: Poppins 16/30, #10214F
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white" style={{ paddingTop: 80, paddingBottom: 100 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          {/* Section title — Figma: Bahnschrift SemiBold 30/36, centered */}
          <h2
            className="text-center"
            style={{
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
              fontSize: 30,
              lineHeight: '36px',
              fontWeight: 600,
              color: '#10214F',
              marginBottom: 64,
            }}
          >
            How Listing With YachtVersal Works for Brokers
          </h2>

          {/* Alternating steps */}
          <div className="flex flex-col" style={{ gap: 80 }}>
            {howItWorksSteps.map((step) => (
              <div
                key={step.number}
                className={`flex flex-col items-center ${
                  step.side === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row'
                }`}
                style={{ gap: 40 }}
              >
                {/* Image — Figma: Rectangle 40, 636×344, radius 12 */}
                <div className="w-full lg:w-1/2">
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ aspectRatio: '636 / 344', borderRadius: 12, backgroundColor: '#F0FEFF' }}
                  >
                    <Image
                      src={step.image}
                      alt={step.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                </div>

                {/* Text — narrowed toward center; left-column steps right-aligned to hug center */}
                <div
                  className="w-full lg:w-1/2 flex"
                  style={{ justifyContent: step.side === 'left' ? 'flex-end' : 'flex-start' }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 500,
                      textAlign: step.side === 'left' ? 'right' : 'left',
                    }}
                  >
                  {/* Step title — Figma: Bahnschrift 24/29, #01BBDC */}
                  <h3
                    style={{
                      fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                      fontSize: 24,
                      lineHeight: '29px',
                      fontWeight: 400,
                      color: '#01BBDC',
                      marginBottom: 16,
                    }}
                  >
                    Step {step.number}: {step.title}
                  </h3>
                  {/* Body — Figma: Poppins 16/30, #10214F */}
                  <p
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 16,
                      lineHeight: '30px',
                      color: '#10214F',
                    }}
                  >
                    {step.description}
                  </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          BROKER MEMBERSHIP PROGRAM
          Figma: top 4292, 1920×698, background photo "two-men-negotiating"
          Gradient: 90deg, #FFF 0% → rgba(255,255,255,0.95) 41.29% → transparent 70.67%
          Content: Group 54, left 312, width 549
          Title: Bahnschrift 40/48, #10214F
          Checklist items: gap 49px (Figma spacing between rows)
          CTA: "View All Listings" 278×48, #01BBDC, radius 12
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: 698 }}>
        {/* Background photo */}
        <div className="absolute inset-0">
          <Image
            src="/images/broker-membership.jpg"
            alt="Two professionals discussing yacht brokerage details"
            aria-hidden
            fill
            className="object-cover object-center"
          />
        </div>

        {/* Figma gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0.95) 41.29%, rgba(255,255,255,0) 70.67%)',
          }}
        />

        {/* Content — Figma: Group 54, left 312, width 549 */}
        <div
          className="relative z-10 flex flex-col justify-center"
          style={{
            minHeight: 698,
            paddingLeft: 'clamp(24px, 16.25vw, 312px)',
            paddingRight: 24,
            paddingTop: 64,
            paddingBottom: 64,
          }}
        >
          <div style={{ maxWidth: 549 }}>
            {/* Title — Figma: Bahnschrift 40/48, #10214F */}
            <h2
              style={{
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 'clamp(28px, 2.5vw, 40px)',
                lineHeight: '48px',
                fontWeight: 400,
                color: '#10214F',
                marginBottom: 12,
              }}
            >
              Broker Membership Program
            </h2>

            {/* Sub text — Figma: Poppins 16/24, #10214F */}
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#10214F',
                marginBottom: 8,
              }}
            >
              The Broker Membership Program provides access to YachtVersal's full marketing and distribution engine.
            </p>

            {/* "Broker Members Receive:" — Figma: #01BBDC */}
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#01BBDC',
                marginBottom: 24,
              }}
            >
              Broker Members Receive:
            </p>

            {/* Checklist — Figma: tick-circle 24×24 #01BBDC, gap 49px rows */}
            <ul className="flex flex-col" style={{ gap: 20, marginBottom: 24 }}>
              {membershipBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center" style={{ gap: 13 }}>
                  {/* Tick circle — Figma: vuesax/bold/tick-circle, 24×24, fill #01BBDC */}
                  <span
                    className="flex-shrink-0 rounded-full flex items-center justify-center"
                    style={{ width: 24, height: 24, backgroundColor: '#01BBDC' }}
                  >
                    <Check aria-hidden className="text-white" style={{ width: 14, height: 14 }} strokeWidth={3} />
                  </span>
                  <span
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 16,
                      lineHeight: '24px',
                      color: '#10214F',
                    }}
                  >
                    {benefit}
                  </span>
                </li>
              ))}
            </ul>

            {/* Closing line — Figma: Poppins 16/24, #10214F */}
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#10214F',
                marginBottom: 32,
              }}
            >
              YachtVersal is built to help brokers attract serious buyers while maintaining complete control of their business.
            </p>

            {/* CTA — Figma: 278×48, #01BBDC, radius 12 */}
            <Link
              href="/listings"
              className="inline-flex items-center justify-center font-medium text-white transition hover:opacity-90"
              style={{
                backgroundColor: '#01BBDC',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                fontWeight: 500,
                borderRadius: 12,
                width: 278,
                height: 48,
              }}
            >
              Search Listings
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}