'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Globe, Award, Zap, Headphones, Users } from 'lucide-react';

// ─── Pricing — flat one-time listing fee (no more tiered monthly plans) ──────
const PRIVATE_SELLER_FEE = 149;

const PRIVATE_SELLER_FEATURES = [
  'List your yacht for sale',
  'Professional listing presentation',
  'Global marketplace exposure',
  'Direct buyer inquiries',
  'Support from our team when you need it',
];

// ─── Data — Figma copy ────────────────────────────────────────────────────────

const sellerBenefits = [
  {
    icon: <Globe className="w-8 h-8" />,
    title: 'Global Exposure',
    description: 'Reach buyers worldwide without managing multiple platforms. Your listing is instantly available to our international audience.',
  },
  {
    icon: <Award className="w-8 h-8" />,
    title: 'Professional Presentation',
    description: 'We provide tools for a professional listing presentation that builds buyer trust, including high-res galleries and spec sheets.',
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: 'Intelligent Marketing',
    description: 'Our data-driven marketing engine ensures your yacht attracts serious inquiries from qualified buyers, not just window shoppers.',
  },
  {
    icon: <Headphones className="w-8 h-8" />,
    title: 'Expert Support',
    description: 'Support representatives available to guide you at every step, from listing creation to closing the deal.',
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: 'Flexible Options',
    description: 'Choose your path: work directly with buyers for a private sale, or connect with a verified broker when you need extra help.',
  },
];

const howItWorksSteps = [
  {
    number: 1,
    title: 'Create Your Listing',
    description:
      "Upload your yacht's photos, videos, specifications, features, and asking price using our intuitive listing form — no technical expertise required.",
    image: '/images/private-create-listing.jpg',
    side: 'right' as const,
  },
  {
    number: 2,
    title: 'We Optimize & Market Your Yacht',
    description:
      'Once submitted, YachtVersal optimizes your listing and distributes it across our global marketplace and partner channels. We ensure your yacht is presented clearly, professionally, and consistently everywhere it appears.',
    image: '/images/private-go-live.jpg',
    side: 'left' as const,
  },
  {
    number: 3,
    title: 'Receive Qualified Inquiries',
    description:
      'All buyer inquiries are delivered directly to you. Our intelligent marketing engine focuses on connecting your yacht with serious, high-intent buyers — not casual browsers.',
    image: '/images/private-enquiries.jpg',
    side: 'right' as const,
  },
  {
    number: 4,
    title: 'Get Support When You Need It',
    description:
      "YachtVersal support representatives are available to help answer questions, coordinate communication, and keep the process moving smoothly. You stay in control. We provide clarity and support.",
    image: '/images/private-close.jpg',
    side: 'left' as const,
  },
  {
    number: 5,
    title: 'Move Forward With Confidence',
    description:
      "Whether you sell independently or decide to work with a broker, YachtVersal supports the journey from listing to sale. Our goal is simple: make selling your yacht feel clear, professional, and stress-free.",
    image: '/images/private-confidence.jpg',
    side: 'right' as const,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SellPrivatePage() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/register?user_type=private');
  };

  return (
    <main className="relative bg-white">

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Figma: 1920×516, photo right mirrored, white gradient left
          Title: "Private Sellers", Bahnschrift Bold 56/67, left 312px
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative w-full overflow-hidden" style={{ height: 401 }}>
        <div className="absolute inset-0">
          <Image
            src="/images/private-seller-hero.jpg"
            alt="Private yacht seller with vessel in marina"
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

        {/* Hero text — Figma: "Private Sellers", left 312, top 282 */}
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
            }}
          >
            Private Sellers
          </h1>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SELL YOUR YACHT — SIMPLY AND CONFIDENTLY + PRICING CARDS
          Figma: Group 122, left 312, top 615, 1296px wide
          Header: "Sell Your Yacht—Simply and Confidently", Bahnschrift SemiBold 30/36
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white" style={{ paddingTop: 80, paddingBottom: 100 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
          {/* Section header — Figma: Group 117 */}
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
              Sell Your Yacht—Simply and Confidently
            </h2>
            <p
              className="mx-auto"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#10214F',
                maxWidth: 746,
              }}
            >
              YachtVersal makes it easy for private sellers to list and market their yacht through a professional global platform — without complexity or industry intimidation.
            </p>
            <p
              className="mx-auto"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#10214F',
                maxWidth: 375,
                marginTop: 12,
              }}
            >
              You list your yacht. We handle the heavy lifting.
            </p>
          </div>

          {/* ── FLAT ONE-TIME FEE CARD — replaces old tiered monthly pricing ── */}
          <div className="flex justify-center">
            <div className="relative flex flex-col" style={{ paddingTop: 24, flex: '0 1 390px', minWidth: 280, width: '100%' }}>
              <div
                className="absolute left-1/2 flex items-center justify-center"
                style={{
                  transform: 'translateX(-50%)',
                  top: 0,
                  backgroundColor: '#01BBDC',
                  borderRadius: 6,
                  width: 160,
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
                    color: '#FFFFFF',
                  }}
                >
                  Private Seller
                </span>
              </div>

              <div
                className="flex flex-col flex-1"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #01BBDC',
                  boxShadow: '0px 0px 4px rgba(0,0,0,0.25)',
                  borderRadius: 6,
                  minHeight: 403,
                  paddingTop: 40,
                  paddingLeft: 32,
                  paddingRight: 32,
                  paddingBottom: 32,
                }}
              >
                <p
                  className="text-center"
                  style={{
                    fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                    fontSize: 30,
                    lineHeight: '36px',
                    fontWeight: 600,
                    color: '#10214F',
                    marginBottom: 24,
                  }}
                >
                  ${PRIVATE_SELLER_FEE} one-time
                </p>

                <p
                  className="text-center"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: 12,
                    color: 'rgba(16,33,79,0.4)',
                    marginBottom: 24,
                  }}
                >
                  🔒 Billed securely via Stripe
                </p>

                <ul className="flex-1 flex flex-col items-center" style={{ gap: 20, marginBottom: 32 }}>
                  {PRIVATE_SELLER_FEATURES.map((f) => (
                    <li
                      key={f}
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 16,
                        lineHeight: '24px',
                        color: '#10214F',
                        textAlign: 'center',
                      }}
                    >
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={handleGetStarted}
                  className="w-full flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg"
                  style={{
                    backgroundColor: '#10214F',
                    color: '#FFFFFF',
                    fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                    fontSize: 18,
                    lineHeight: '22px',
                    fontWeight: 600,
                    borderRadius: 6,
                    height: 48,
                  }}
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          WHY PRIVATE SELLERS CHOOSE YACHTVERSAL
          Figma: Group 153, bg rgba(16,33,79,0.02), top 1357, 1920×877
          Title: "Why Private Sellers Choose YachtVersal", Bahnschrift SemiBold 30/36
          Sub: "Selling a yacht doesn't need to be complicated."
          3×2 grid of benefit cards, 416×269 each
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: '#10214F', paddingTop: 80, paddingBottom: 100 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
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
              Why Private Sellers Choose YachtVersal
            </h2>
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#FFFFFF',
              }}
            >
              Selling a yacht doesn't need to be complicated.
            </p>
          </div>

          {/* 3×2 benefit cards — Figma: 416×269, white bg, border rgba(16,33,79,0.1), radius 12 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 24 }}>
            {sellerBenefits.map((benefit) => (
              <div
                key={benefit.title}
                className="flex flex-col"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(16,33,79,0.1)',
                  borderRadius: 6,
                  padding: 32,
                  minHeight: 269,
                  gap: 16,
                }}
              >
                <div style={{ color: '#01BBDC', width: 32, height: 32 }}>{benefit.icon}</div>
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

            {/* 6th card — logo only, symmetry filler */}
            <div
              className="flex items-center justify-center"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(16,33,79,0.1)',
                borderRadius: 6,
                padding: 32,
                minHeight: 269,
              }}
            >
              <Image
                src="/logo/logo-full.png"
                alt="YachtVersal"
                width={200}
                height={60}
                style={{ objectFit: 'contain' }}
              />
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          HOW SELLING YOUR YACHT WORKS
          Figma: Group 159, top 2334, title: "How Selling Your Yacht Works"
          5 alternating steps: odd=image left/text right, even=text left/image right
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white" style={{ paddingTop: 80, paddingBottom: 100 }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1296, paddingLeft: 'clamp(16px, 4vw, 0px)', paddingRight: 'clamp(16px, 4vw, 0px)' }}
        >
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
            How Selling Your Yacht Works
          </h2>

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
                    style={{ aspectRatio: '636 / 344', borderRadius: 6, backgroundColor: '#F0FEFF' }}
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
          SUPPORT & TRUST
          Figma: top 4348, 1920×479, background photo, left gradient
          Title: "Support & Trust", Bahnschrift 40/48, #10214F
          Subtitle: "Support When You Need It", Poppins 16/24, #01BBDC
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: 479 }}>
        <div className="absolute inset-0">
          <Image
            src="/images/private-seller-membership.jpg"
            alt="Private seller support and trust section background"
            aria-hidden
            fill
            className="object-cover object-center"
          />
        </div>

        {/* Figma gradient — same as brokers membership section */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0.95) 41.29%, rgba(255,255,255,0) 70.67%)',
          }}
        />

        {/* Content — Figma: Group 54, left 312, width 468 */}
        <div
          className="relative z-10 flex flex-col justify-center"
          style={{
            minHeight: 479,
            paddingLeft: 'clamp(24px, 16.25vw, 312px)',
            paddingRight: 24,
            paddingTop: 64,
            paddingBottom: 64,
          }}
        >
          <div style={{ maxWidth: 468 }}>
            {/* Title — Figma: Bahnschrift 40/48, #10214F */}
            <h2
              style={{
                fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                fontSize: 'clamp(28px, 2.5vw, 40px)',
                lineHeight: '48px',
                fontWeight: 400,
                color: '#10214F',
                marginBottom: 8,
              }}
            >
              Support &amp; Trust
            </h2>

            {/* Subtitle — Figma: "Support When You Need It", Poppins 16/24, #01BBDC */}
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#01BBDC',
                marginBottom: 12,
              }}
            >
              Support When You Need It
            </p>

            {/* Body — Figma: two paragraphs, Poppins 16/24, #10214F */}
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#10214F',
                marginBottom: 12,
              }}
            >
              Our support representatives are available to help answer questions, coordinate communication, and keep the buying and selling process clear and efficient.
            </p>
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                color: '#10214F',
                marginBottom: 32,
              }}
            >
              Whether you're exploring options or actively transacting, YachtVersal provides support without pressure.
            </p>

            {/* CTA */}
            <Link
              href="/listings"
              className="inline-flex items-center justify-center font-medium text-white transition hover:opacity-90"
              style={{
                backgroundColor: '#01BBDC',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 16,
                lineHeight: '24px',
                fontWeight: 500,
                borderRadius: 6,
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