'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, Clock, MapPin, Send, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const SUBJECTS = [
  'General Inquiry',
  'Dealer / Brokerage Inquiry',
  'Buying a Yacht',
  'Listing Your Yacht',
  'Technical Support',
  'Partnership Opportunity',
  'Media & Press',
  'Other',
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in your name, email, and message.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(apiUrl('/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || null,
          phone: phone.trim() || null,
          subject,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message || "Message sent! We'll get back to you within 1–2 business days.");
        setName(''); setEmail(''); setCompany(''); setPhone('');
        setSubject(SUBJECTS[0]); setMessage('');
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#10214F', padding: '72px 24px 64px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none' }}>Home</Link>
            <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span style={{ color: '#01BBDC', fontSize: 13 }}>Contact</span>
          </div>
          <h1 style={{
            color: '#fff',
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            fontWeight: 700,
            margin: '0 0 16px',
            lineHeight: 1.15,
          }}>
            Get in Touch
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
            maxWidth: 560,
            margin: '0 auto',
            lineHeight: 1.6,
            fontFamily: 'Poppins, sans-serif',
          }}>
            Have a question, or ready to list your fleet? We'd love to hear from you.
          </p>
        </div>
      </div>

      {/* ── Cyan accent bar ──────────────────────────────────────────────── */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #01BBDC, #0097b2)' }} />

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 48, alignItems: 'start' }}
             className="contact-grid">
          <style>{`
            @media (min-width: 768px) {
              .contact-grid { grid-template-columns: 1.6fr 1fr !important; }
            }
          `}</style>

          {/* ── Left: Form ─────────────────────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
            <h2 style={{ color: '#10214F', fontSize: 22, fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', margin: '0 0 24px' }}>
              Send Us a Message
            </h2>

            {success ? (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <CheckCircle size={32} style={{ color: '#16a34a' }} />
                </div>
                <h3 style={{ color: '#10214F', fontSize: 20, margin: '0 0 12px', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Message Sent!</h3>
                <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>{success}</p>
                <button
                  onClick={() => setSuccess('')}
                  style={{ background: '#01BBDC', color: '#fff', padding: '10px 28px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Name + Email row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-row">
                  <style>{`@media (max-width: 520px) { .form-row { grid-template-columns: 1fr !important; } }`}</style>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Full Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="John Smith"
                      required
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      required
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>

                {/* Company + Phone row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-row">
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Company <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="Your brokerage name"
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Phone <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', backgroundColor: '#fff', fontFamily: 'inherit' }}
                  >
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Message <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Tell us how we can help..."
                    required
                    rows={5}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 10 }}>
                    <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <p style={{ margin: 0, color: '#dc2626', fontSize: 14 }}>{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: loading ? '#9ca3af' : '#01BBDC',
                    color: '#fff',
                    padding: '13px 28px',
                    borderRadius: 12,
                    border: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                    transition: 'opacity 0.2s',
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      Sending…
                    </>
                  ) : (
                    <><Send size={18} /> Send Message</>
                  )}
                </button>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </form>
            )}
          </div>

          {/* ── Right: Contact Info ─────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* General contact */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ color: '#10214F', fontSize: 16, fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', margin: '0 0 20px', fontWeight: 700 }}>
                Contact Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(1,187,220,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mail size={18} style={{ color: '#01BBDC' }} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</p>
                    <a href="mailto:info@yachtversal.com" style={{ color: '#10214F', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>
                      info@yachtversal.com
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(1,187,220,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Clock size={18} style={{ color: '#01BBDC' }} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Time</p>
                    <p style={{ margin: 0, color: '#10214F', fontSize: 15, fontWeight: 500 }}>Within 1–2 business days</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(1,187,220,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={18} style={{ color: '#01BBDC' }} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</p>
                    <a href="tel:401-305-1722" style={{ color: '#10214F', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>
                      401-305-1722
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(1,187,220,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={18} style={{ color: '#01BBDC' }} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</p>
                    <p style={{ margin: 0, color: '#10214F', fontSize: 15, fontWeight: 500 }}>4132 Colonel Vanderhorst Circle<br />Mount Pleasant, SC 29466<br />United States</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(1,187,220,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={18} style={{ color: '#01BBDC' }} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Based In</p>
                    <p style={{ margin: 0, color: '#10214F', fontSize: 15, fontWeight: 500 }}>United States</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dealer CTA */}
            <div style={{ background: '#10214F', borderRadius: 16, padding: '28px 28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(1,187,220,0.15)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <h3 style={{ color: '#fff', fontSize: 16, fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', margin: '0 0 10px', fontWeight: 700 }}>
                  Are you a dealer or broker?
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
                  List your entire fleet, integrate with your website, and manage leads — all in one platform.
                </p>
                <Link
                  href="/register?user_type=dealer&subscription_tier=basic"
                  style={{
                    display: 'inline-block',
                    background: '#01BBDC',
                    color: '#fff',
                    padding: '10px 22px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  Get Started →
                </Link>
              </div>
            </div>

            {/* FAQ note */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ color: '#10214F', fontSize: 15, fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', margin: '0 0 10px', fontWeight: 700 }}>
                Looking for quick answers?
              </h3>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: '0 0 14px' }}>
                Check our FAQ for instant answers to the most common questions about buying, selling, and listing.
              </p>
              <Link
                href="/faq"
                style={{ color: '#01BBDC', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
              >
                Browse the FAQ →
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
