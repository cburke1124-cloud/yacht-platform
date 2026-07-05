import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Mail } from 'lucide-react';
import { FAQ_ITEMS } from './faqData';
import FaqAccordion from './FaqAccordion';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Answers to common questions about buying, selling, chartering, and listing yachts on YachtVersal — pricing, broker verification, financing tools, and more.',
  alternates: { canonical: `${SITE_URL}/faq` },
};

export default function FAQPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.flatMap((category) =>
      category.questions.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      }))
    ),
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#10214F', padding: '72px 24px 64px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none' }}>Home</Link>
            <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span style={{ color: '#01BBDC', fontSize: 13 }}>FAQ</span>
          </div>
          <h1 style={{
            color: '#fff',
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            fontWeight: 700,
            margin: '0 0 16px',
            lineHeight: 1.15,
          }}>
            Frequently Asked Questions
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
            maxWidth: 560,
            margin: '0 auto',
            lineHeight: 1.6,
            fontFamily: 'Poppins, sans-serif',
          }}>
            Find answers to common questions about buying, chartering, selling, and listing yachts on YachtVersal.
          </p>
        </div>
      </div>

      {/* ── Cyan accent bar ──────────────────────────────────────────────── */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #01BBDC, #0097b2)' }} />

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 80px' }}>
        <FaqAccordion />

        {/* ── Still have questions? ────────────────────────────────────── */}
        <div style={{
          marginTop: 80,
          padding: '40px 36px',
          background: '#fff',
          borderRadius: 6,
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
          textAlign: 'center',
        }}>
          <h2 style={{
            color: '#10214F',
            fontSize: 24,
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            fontWeight: 700,
            margin: '0 0 12px',
          }}>
            Still have questions?
          </h2>
          <p style={{
            color: '#6b7280',
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 500,
            margin: '0 auto 28px',
          }}>
            Can&apos;t find the answer you&apos;re looking for? Reach out to our support team.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Mail size={18} style={{ color: '#01BBDC' }} />
            <a
              href="mailto:info@yachtversal.com"
              style={{
                color: '#10214F',
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              info@yachtversal.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
