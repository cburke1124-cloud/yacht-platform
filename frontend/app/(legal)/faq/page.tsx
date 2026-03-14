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
        a: 'You can search for yachts using our advanced search bar on the homepage or listings page. Filter by price range, boat type, length, year, location, and more. You can also save searches to receive alerts when new matching listings are added.',
      },
      {
        q: 'Are the listings verified?',
        a: 'All dealers on YachtVersal go through a verification process. However, we recommend buyers conduct their own due diligence, including yacht surveys and sea trials before making a purchase. We are a marketplace platform connecting buyers and sellers.',
      },
      {
        q: 'How do I contact a seller about a yacht?',
        a: 'Click on any listing to view full details, then use the "Contact Seller" button to send a message directly to the dealer. You can also save listings to compare them later or set up price alerts to track changes.',
      },
      {
        q: 'Can I save my favorite yachts?',
        a: 'Yes! Create a free account to save unlimited yacht listings. You can access your saved yachts anytime from your account dashboard. You can also organize them into collections for easier comparison.',
      },
      {
        q: 'What are price alerts?',
        a: 'Price alerts notify you when a yacht you\'re interested in has a price change. Set up alerts on any listing by clicking the "Set Price Alert" button. You\'ll receive email notifications when the price drops or increases.',
      },
    ],
  },
  {
    category: 'Selling & Listing',
    questions: [
      {
        q: 'How do I list my yachts for sale?',
        a: 'Create a dealer or private seller account, choose a subscription plan, and start listing immediately. You can manually create listings or use our AI-powered import tool to scrape listings from your existing website.',
      },
      {
        q: 'What is the AI listing import feature?',
        a: 'Our AI scraper tool can automatically import yacht listings from your website or other platforms. Simply provide the URL, and our AI extracts all relevant information including specs, descriptions, and images, creating professional listings in seconds.',
      },
      {
        q: 'Can I manage multiple sales representatives?',
        a: 'Yes! Our Team and Enterprise plans allow you to add multiple sales representatives with customizable permissions. Each rep can manage their own listings and leads while you maintain oversight through the admin dashboard.',
      },
      {
        q: 'How do leads work?',
        a: 'When a buyer expresses interest in your listing, you receive a lead notification with their contact information. All leads are tracked in your dashboard with timestamps, contact history, and follow-up reminders.',
      },
      {
        q: 'Can I feature my listings?',
        a: 'Yes! Featured listings appear prominently in search results and on the homepage carousel. Featured slots are included in higher-tier plans or available as add-ons. Featured listings receive up to 5x more views.',
      },
    ],
  },
  {
    category: 'Pricing & Plans',
    questions: [
      {
        q: 'What subscription plans do you offer?',
        a: 'We offer flexible pricing for buyers (free), private sellers, and yacht brokers/dealers. Each tier includes different features like listing quantities, featured slots, and team management. Browse our pricing page to find the right plan for you.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes! All paid plans come with a trial period. No credit card required to start. You can cancel anytime during the trial period with no charges.',
      },
      {
        q: 'Are there any transaction fees?',
        a: 'No. YachtVersal does not charge transaction fees or commissions on sales. You only pay your monthly subscription fee. All transactions are directly between you and the buyer.',
      },
      {
        q: 'Can I cancel my subscription anytime?',
        a: 'Yes, you can cancel your subscription at any time. Your account will remain active until the end of your current billing period. You can reactivate anytime without losing your listings or data.',
      },
    ],
  },
  {
    category: 'Features & Security',
    questions: [
      {
        q: 'What image formats are supported?',
        a: 'We support JPG, PNG, and WebP formats for images. Maximum file size is 10MB per image. We recommend high-quality images (at least 1920x1080) for best presentation.',
      },
      {
        q: 'Can I add videos to my listings?',
        a: 'Yes! You can add YouTube or Vimeo video links to any listing. Videos significantly increase engagement and help showcase yachts more effectively.',
      },
      {
        q: 'How is my data protected?',
        a: 'We use industry-standard encryption (SSL/TLS) for all data transmission. Payment information is processed through PCI-compliant providers. We never store credit card details on our servers. Regular security audits ensure platform integrity.',
      },
      {
        q: 'How do you verify dealers?',
        a: 'All dealers must provide business documentation, verify their identity, and pass our background checks. We verify business licenses, insurance, and references. Dealers must maintain good standing and comply with our terms of service.',
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