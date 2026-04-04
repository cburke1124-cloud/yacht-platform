'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin, Ruler, Bed, Fuel, Gauge, Waves, ChevronLeft, ChevronRight,
  Phone, Mail, Globe, Building2, User, X, Ship,
} from 'lucide-react';
import { API_ROOT } from '@/app/lib/apiRoot';

// ── Types ────────────────────────────────────────────────────────────────────

interface PreviewData {
  id: number;
  share_token: string;
  title: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  currency: string | null;
  length_feet: number | null;
  beam_feet: number | null;
  draft_feet: number | null;
  boat_type: string | null;
  hull_material: string | null;
  hull_type: string | null;
  condition: string | null;
  engine_count: number | null;
  engine_hours: number | null;
  fuel_type: string | null;
  max_speed_knots: number | null;
  cruising_speed_knots: number | null;
  cabins: number | null;
  berths: number | null;
  heads: number | null;
  fuel_capacity_gallons: number | null;
  water_capacity_gallons: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  description: string | null;
  feature_bullets: string[];
  additional_specs: Record<string, any>;
  seller_name: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  brokerage_name: string | null;
  brokerage_logo_url: string | null;
  brokerage_website: string | null;
  images: { url: string; is_primary?: boolean }[];
  source_url: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price?: number | null, currency = 'USD') {
  if (!price) return 'Price on Request';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(price);
}

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{String(value)}</span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PreviewListingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_ROOT}/api/preview/listings/view/${token}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#01BBDC' }} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#f8fafc' }}>
        <Ship size={48} style={{ color: '#10214F', opacity: 0.3 }} />
        <h1 className="text-2xl font-bold" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
          Preview Not Found
        </h1>
        <p className="text-gray-500">This listing preview link may have expired or been removed.</p>
        <Link href="/" className="text-sm font-medium" style={{ color: '#01BBDC' }}>← Back to YachtVersal</Link>
      </div>
    );
  }

  const images = data.images || [];
  const currentImage = images[imageIndex];
  const location = [data.city, data.state, data.country].filter(Boolean).join(', ');
  const displayTitle = data.title || [data.year, data.make, data.model].filter(Boolean).join(' ') || 'Yacht Preview';

  return (
    <>
      {/* noindex meta — we don't want these pages in search engines */}
      <meta name="robots" content="noindex, nofollow" />

      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>

        {/* ── Preview Banner ─────────────────────────────────────────────── */}
        <div
          className="text-center py-3 px-4 text-sm font-medium"
          style={{ backgroundColor: '#10214F', color: 'rgba(255,255,255,0.85)', fontFamily: 'Poppins, sans-serif' }}
        >
          🔗 This is a <strong style={{ color: '#01BBDC' }}>confidential preview</strong> prepared by YachtVersal — not a live listing.
          &nbsp;
          <Link href="/register" style={{ color: '#01BBDC', textDecoration: 'underline' }}>
            List on YachtVersal →
          </Link>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px 80px' }}>

          {/* ── Back link ──────────────────────────────────────────────────── */}
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm mb-6"
            style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
          >
            <ChevronLeft size={16} /> YachtVersal Home
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">

            {/* ── Left column ─────────────────────────────────────────────── */}
            <div>

              {/* Title / price */}
              <div className="mb-4">
                <h1
                  style={{
                    color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
                    fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 600, lineHeight: 1.2, marginBottom: 8,
                  }}
                >
                  {displayTitle}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-3xl font-bold" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                    {formatPrice(data.price, data.currency ?? undefined)}
                  </span>
                  {data.condition && (
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium capitalize"
                      style={{ backgroundColor: '#f0feff', color: '#01BBDC', border: '1px solid #b2edf7' }}
                    >
                      {data.condition}
                    </span>
                  )}
                  {location && (
                    <span className="flex items-center gap-1 text-sm" style={{ color: '#6b7280' }}>
                      <MapPin size={14} style={{ color: '#01BBDC' }} />
                      {location}
                    </span>
                  )}
                </div>
              </div>

              {/* Image gallery */}
              {images.length > 0 && (
                <div className="mb-6">
                  <div
                    className="relative rounded-xl overflow-hidden cursor-zoom-in"
                    style={{ aspectRatio: '16/9', backgroundColor: '#e5e7eb' }}
                    onClick={() => setLightboxOpen(true)}
                  >
                    <img
                      src={currentImage.url}
                      alt={displayTitle}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setImageIndex((i) => (i - 1 + images.length) % images.length); }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setImageIndex((i) => (i + 1) % images.length); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                        >
                          <ChevronRight size={18} />
                        </button>
                        <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {imageIndex + 1} / {images.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Thumbnails */}
                  {images.length > 1 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                      {images.slice(0, 10).map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setImageIndex(i)}
                          className="flex-shrink-0 rounded-lg overflow-hidden transition-opacity"
                          style={{
                            width: 72, height: 50,
                            border: i === imageIndex ? '2px solid #01BBDC' : '2px solid transparent',
                            opacity: i === imageIndex ? 1 : 0.65,
                          }}
                        >
                          <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {data.description && (
                <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                  <h2 className="font-semibold mb-3" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 18 }}>
                    Description
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#374151' }}>
                    {data.description}
                  </p>
                </div>
              )}

              {/* Feature bullets */}
              {data.feature_bullets?.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                  <h2 className="font-semibold mb-3" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 18 }}>
                    Features & Equipment
                  </h2>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.feature_bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#374151' }}>
                        <span className="mt-1 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#01BBDC' }}>
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specs */}
              <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                <h2 className="font-semibold mb-3" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 18 }}>
                  Specifications
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <div>
                    <SpecRow label="Year" value={data.year} />
                    <SpecRow label="Make" value={data.make} />
                    <SpecRow label="Model" value={data.model} />
                    <SpecRow label="Type" value={data.boat_type} />
                    <SpecRow label="Condition" value={data.condition ? data.condition.charAt(0).toUpperCase() + data.condition.slice(1) : null} />
                    <SpecRow label="Length" value={data.length_feet ? `${data.length_feet} ft` : null} />
                    <SpecRow label="Beam" value={data.beam_feet ? `${data.beam_feet} ft` : null} />
                    <SpecRow label="Draft" value={data.draft_feet ? `${data.draft_feet} ft` : null} />
                    <SpecRow label="Hull Material" value={data.hull_material} />
                    <SpecRow label="Hull Type" value={data.hull_type} />
                  </div>
                  <div>
                    <SpecRow label="Engines" value={data.engine_count} />
                    <SpecRow label="Engine Hours" value={data.engine_hours ? `${data.engine_hours} hrs` : null} />
                    <SpecRow label="Fuel Type" value={data.fuel_type} />
                    <SpecRow label="Max Speed" value={data.max_speed_knots ? `${data.max_speed_knots} kts` : null} />
                    <SpecRow label="Cruising Speed" value={data.cruising_speed_knots ? `${data.cruising_speed_knots} kts` : null} />
                    <SpecRow label="Fuel Capacity" value={data.fuel_capacity_gallons ? `${data.fuel_capacity_gallons} gal` : null} />
                    <SpecRow label="Water Capacity" value={data.water_capacity_gallons ? `${data.water_capacity_gallons} gal` : null} />
                    <SpecRow label="Cabins" value={data.cabins} />
                    <SpecRow label="Berths" value={data.berths} />
                    <SpecRow label="Heads" value={data.heads} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right column: Contact card ───────────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* Brokerage / seller card */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold mb-4" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 16 }}>
                  Listed By
                </h3>

                {data.brokerage_logo_url && (
                  <img
                    src={data.brokerage_logo_url}
                    alt={data.brokerage_name || 'Brokerage'}
                    style={{ maxHeight: 56, maxWidth: '100%', objectFit: 'contain', marginBottom: 12 }}
                  />
                )}

                {data.brokerage_name && (
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={16} style={{ color: '#01BBDC' }} />
                    <span className="font-medium text-sm" style={{ color: '#10214F' }}>{data.brokerage_name}</span>
                  </div>
                )}

                {data.seller_name && (
                  <div className="flex items-center gap-2 mb-3">
                    <User size={16} style={{ color: '#01BBDC' }} />
                    <span className="text-sm" style={{ color: '#374151' }}>{data.seller_name}</span>
                  </div>
                )}

                {data.seller_phone && (
                  <a
                    href={`tel:${data.seller_phone}`}
                    className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity"
                  >
                    <Phone size={16} style={{ color: '#01BBDC' }} />
                    <span className="text-sm" style={{ color: '#374151' }}>{data.seller_phone}</span>
                  </a>
                )}

                {data.seller_email && (
                  <a
                    href={`mailto:${data.seller_email}`}
                    className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity"
                  >
                    <Mail size={16} style={{ color: '#01BBDC' }} />
                    <span className="text-sm" style={{ color: '#374151' }}>{data.seller_email}</span>
                  </a>
                )}

                {data.brokerage_website && (
                  <a
                    href={data.brokerage_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <Globe size={16} style={{ color: '#01BBDC' }} />
                    <span className="text-sm" style={{ color: '#01BBDC', textDecoration: 'underline' }}>
                      {data.brokerage_website.replace(/^https?:\/\/(www\.)?/, '')}
                    </span>
                  </a>
                )}
              </div>

              {/* YachtVersal CTA */}
              <div
                className="rounded-xl p-6"
                style={{ background: 'linear-gradient(135deg, #10214F 0%, #0d3a70 100%)' }}
              >
                <h3 className="font-semibold text-white mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 16 }}>
                  Want listings like this?
                </h3>
                <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  List your fleet on YachtVersal and reach qualified buyers worldwide.
                </p>
                <Link
                  href="/register?user_type=dealer"
                  className="block text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#01BBDC', color: '#fff', fontFamily: 'Poppins, sans-serif' }}
                >
                  Get Started →
                </Link>
              </div>

              {/* Source URL note */}
              {data.source_url && (
                <div className="rounded-xl p-4 border border-gray-200 bg-white">
                  <p className="text-xs text-gray-400 mb-1">Original listing source</p>
                  <a
                    href={data.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs break-all hover:underline"
                    style={{ color: '#01BBDC' }}
                  >
                    {data.source_url}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Lightbox ─────────────────────────────────────────────────────── */}
        {lightboxOpen && images.length > 0 && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
            onClick={() => setLightboxOpen(false)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:opacity-70 transition-opacity"
              onClick={() => setLightboxOpen(false)}
            >
              <X size={28} />
            </button>
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:opacity-70 p-2"
                  onClick={(e) => { e.stopPropagation(); setImageIndex((i) => (i - 1 + images.length) % images.length); }}
                >
                  <ChevronLeft size={32} />
                </button>
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:opacity-70 p-2"
                  onClick={(e) => { e.stopPropagation(); setImageIndex((i) => (i + 1) % images.length); }}
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}
            <img
              src={images[imageIndex].url}
              alt={displayTitle}
              style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 text-white text-sm opacity-60">
              {imageIndex + 1} / {images.length}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
