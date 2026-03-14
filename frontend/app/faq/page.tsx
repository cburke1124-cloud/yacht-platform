'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Mail } from 'lucide-react';

const FAQItems = [
  {
    category: 'Buying',
    questions: [
      {
        q: 'How do I search for yachts on YachtVersal?',
        a: 'Use our advanced search tool to filter by price, size, location, brand, and many other specifications. You can save your favorite listings and set up price alerts to be notified when new yachts matching your criteria become available.',
      },
      {
        q: 'What is the typical timeline for purchasing a yacht?',
        a: 'The timeline varies depending on the yacht\'s availability and your financing situation. Typically, the process takes 30-90 days from offer to closing. Our team can guide you through each step.',
      },
      {
        q: 'Do you offer yacht financing?',
        a: 'Yes! We provide information on financing options and can connect you with trusted lenders. Check our Financing guide for more details on rates and terms.',
      },
      {
        q: 'Can I arrange an inspection or sea trial?',
        a: 'Absolutely. We can facilitate inspections and sea trials with the yacht\'s current owner. This is an important step in the buying process, and we\'ll help coordinate everything.',
      },
    ],
  },
  {
    category: 'Selling',
    questions: [
      {
        q: 'How much does it cost to list my yacht?',
        a: 'Listing costs depend on your account tier. We offer flexible pricing for private sellers and yacht brokers. Browse our pricing page to find the right plan for you.',
      },
      {
        q: 'What information should I include in my listing?',
        a: 'Include detailed specifications, maintenance history, current condition, photos, and videos. The more information you provide, the more interested buyers you\'ll attract.',
      },
      {
        q: 'Can I list multiple yachts?',
        a: 'Yes! Both private sellers and brokers can list multiple vessels. Our tiers allow you to manage as many listings as you need based on your subscription level.',
      },
      {
        q: 'How are buyer inquiries handled?',
        a: 'You\'ll receive inquiries directly through your dashboard. We provide tools to track and manage all communications, so you never miss a potential buyer.',
      },
    ],
  },
  {
    category: 'Account & Technical',
    questions: [
      {
        q: 'What\'s the difference between private sellers and brokers?',
        a: 'Private sellers list individual yachts they own. Brokers list yachts on behalf of clients. Both have dedicated features and pricing tiers tailored to their needs.',
      },
      {
        q: 'How do I create an account?',
        a: 'Click "Sign Up" on our website and choose your account type. You can register as a buyer, private seller, or broker. The process takes just a few minutes.',
      },
      {
        q: 'Is my information secure?',
        a: 'Yes, we use industry-standard encryption and security measures to protect your personal and financial information. Your privacy is our top priority.',
      },
      {
        q: 'How do I contact support?',
        a: 'You can reach our support team at info@yachtversal.com or through our contact form. We aim to respond within 1–2 business days.',
      },
    ],
  },
];

function FAQAccordion() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {FAQItems.map((category) => (
        <div key={category.category}>
          <h2 style={{
            color: '#10214F',
            fontSize: 28,
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            fontWeight: 700,
            margin: '0 0 24px',
          }}>
            {category.category}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {category.questions.map((item, idx) => {
              const itemId = `${category.category}-${idx}`;
              const isOpen = expandedId === itemId;
              return (
                <div
                  key={itemId}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <button
                    onClick={() => toggleExpand(itemId)}
                    style={{
                      width: '100%',
                      padding: '18px 24px',
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: 16,
                    }}
                  >
                    <span style={{
                      color: '#10214F',
                      fontSize: 16,
                      fontWeight: 600,
                      textAlign: 'left',
                      fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                    }}>
                      {item.q}
                    </span>
                    <ChevronDown
                      size={20}
                      style={{
                        color: '#01BBDC',
                        flexShrink: 0,
                        transition: 'transform 0.2s ease',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div style={{
                      padding: '0 24px 18px',
                      background: 'rgba(1,187,220,0.03)',
                      borderTop: '1px solid #e5e7eb',
                    }}>
                      <p style={{
                        color: '#6b7280',
                        fontSize: 15,
                        lineHeight: 1.6,
                        margin: 0,
                      }}>
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
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
            Find answers to common questions about buying, selling, and listing yachts on YachtVersal.
          </p>
        </div>
      </div>

      {/* ── Cyan accent bar ──────────────────────────────────────────────── */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #01BBDC, #0097b2)' }} />

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 80px' }}>
        <FAQAccordion />

        {/* ── Still have questions? ────────────────────────────────────── */}
        <div style={{
          marginTop: 80,
          padding: '40px 36px',
          background: '#fff',
          borderRadius: 16,
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
            margin: '0 0 28px',
          }}>
            Can't find the answer you're looking for? Reach out to our support team.
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
