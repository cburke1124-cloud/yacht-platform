'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from './faqData';

export default function FaqAccordion() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {FAQ_ITEMS.map((category) => (
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
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <button
                    onClick={() => toggleExpand(itemId)}
                    aria-expanded={isOpen}
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
                  {/* Always rendered (not conditionally mounted) so answer text is
                      present in the server-rendered HTML for crawlers; visibility
                      is toggled with CSS only. */}
                  <div
                    hidden={!isOpen}
                    style={{
                      padding: '0 24px 18px',
                      background: 'rgba(1,187,220,0.03)',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    <p style={{
                      color: '#6b7280',
                      fontSize: 15,
                      lineHeight: 1.6,
                      margin: 0,
                    }}>
                      {item.a}
                    </p>
                    {item.links && item.links.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
                        {item.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            style={{
                              color: '#01BBDC',
                              fontSize: 14,
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            {link.label} →
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
