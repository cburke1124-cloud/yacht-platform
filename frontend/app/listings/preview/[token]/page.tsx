'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, ChevronLeft, ChevronRight, X, Ship,
  Phone, Mail, Globe, Building2, User, Ruler,
  Bed, Fuel, Gauge, Waves, Users, Wrench,
  ZoomIn, ZoomOut, ArrowLeft, ExternalLink,
  Heart, Plus, Share2,
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

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function formatPrice(price: number, currency: string | null | undefined) {
  const cur = currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: cur, maximumFractionDigits: 0,
  }).format(price);
}

function SpecRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline py-2.5 border-b border-gray-100">
      <span className="text-sm text-[#10214F] font-poppins">{label}</span>
      <span className="text-sm text-[#10214F] text-right font-semibold font-poppins">{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-2xl font-bold text-[#01BBDC] mb-2 font-bahnschrift">{children}</h3>
      <div className="h-[1px] bg-[#01BBDC]" />
    </div>
  );
}

const FALLBACK = '/images/listing-fallback1.png';

// ── Component ────────────────────────────────────────────────────────────────

export default function PreviewListingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // gallery
  const [mainIdx, setMainIdx] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_ROOT}/preview/listings/view/${token}`)
      .then((r) => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then((d) => { if (d) setData(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { if (lightbox !== null) setZoom(1); }, [lightbox]);

  // ── inject noindex ──────────────────────────────────────────────────────
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    return () => { document.head.removeChild(m); };
  }, []);

  // ── CTA click tracking ──────────────────────────────────────────────────
  function trackCtaClick(label: string) {
    // Fire GTM dataLayer event (works if/when GTM is added)
    if (typeof window !== 'undefined') {
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).dataLayer.push({
        event: 'preview_cta_click',
        cta_label: label,
        preview_token: token,
      });
    }
    // Fire-and-forget backend tracking
    if (token) {
      fetch(`${API_ROOT}/preview/listings/${token}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: label }),
        keepalive: true,
      }).catch(() => {/* ignore */});
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-14 h-14 rounded-full border-4 border-t-[#01BBDC] border-[#01BBDC]/20 animate-spin" />
    </div>
  );

  if (notFound || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
      <Ship size={48} className="text-[#10214F] opacity-20" />
      <h1 className="text-2xl font-bold text-[#10214F] font-bahnschrift">Preview Not Found</h1>
      <p className="text-gray-500 text-sm">This listing preview link may have expired or been removed.</p>
      <Link href="/" className="text-sm font-medium text-[#01BBDC]">← Back to YachtVersal</Link>
    </div>
  );

  const images = data.images || [];
  const locationParts = [data.city, data.state, data.country].filter(Boolean);
  const location = locationParts.join(', ');
  const displayTitle = data.title || [data.year, data.make, data.model].filter(Boolean).join(' ') || 'Yacht Preview';
  const galleryThumbs = images.slice(1, 5);
  const remaining = Math.max(images.length - 5, 0);

  const keySpecs = [
    { icon: <Ruler size={28} className="text-[#01BBDC]" />,  label: 'Length',      value: data.length_feet ? `${data.length_feet} ft` : null },
    { icon: <Users size={28} className="text-[#01BBDC]" />,  label: 'Guests',       value: data.berths ? String(data.berths) : null },
    { icon: <Bed size={28} className="text-[#01BBDC]" />,    label: 'Cabins',       value: data.cabins ? String(data.cabins) : null },
    { icon: <Ship size={28} className="text-[#01BBDC]" />,   label: 'Type',         value: data.boat_type },
    { icon: <Wrench size={28} className="text-[#01BBDC]" />, label: 'Make',         value: data.make },
    { icon: <Gauge size={28} className="text-[#01BBDC]" />,  label: 'Year',         value: data.year ? String(data.year) : null },
    { icon: <Waves size={28} className="text-[#01BBDC]" />,  label: 'Cruise Speed', value: data.cruising_speed_knots ? `${data.cruising_speed_knots} kts` : null },
    { icon: <Gauge size={28} className="text-[#01BBDC]" />,  label: 'Max Speed',    value: data.max_speed_knots ? `${data.max_speed_knots} kts` : null },
    { icon: <Fuel size={28} className="text-[#01BBDC]" />,   label: 'Fuel Type',    value: data.fuel_type },
    { icon: <Ship size={28} className="text-[#01BBDC]" />,   label: 'Engines',      value: data.engine_count ? String(data.engine_count) : null },
    { icon: <MapPin size={28} className="text-[#01BBDC]" />, label: 'Location',     value: location || null },
  ].filter(s => s.value);

  return (
    <div className="min-h-screen bg-white">

      {/* ── Preview Banner ─────────────────────────────────────────────────── */}
      <div className="text-center py-2.5 px-4 text-sm font-medium bg-[#10214F]">
        <span className="text-white/80">
          🔗 This is a <strong className="text-[#01BBDC]">confidential preview</strong> prepared by YachtVersal — not a live listing.{' '}
        </span>
        <Link href="/register" className="text-[#01BBDC] underline font-semibold"
          onClick={() => trackCtaClick('banner_list_on_yachtversal')}>
          List on YachtVersal →
        </Link>
      </div>

      {/* ── Lightbox ───────────────────────────────────────────────────────── */}
      {lightbox !== null && images.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center"
          style={{ zIndex: 9999 }}
          onClick={() => setLightbox(null)}
        >
          {/* z-10 on all controls keeps them above the transform-scaled image */}
          <button className="absolute z-10 top-6 right-6 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all"
            onClick={() => setLightbox(null)}>
            <X size={22} className="text-white" />
          </button>
          <div className="absolute z-10 top-6 right-20 flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); setZoom(z => Math.max(1, z - 0.25)); }}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
              <ZoomOut size={18} className="text-white" />
            </button>
            <button onClick={e => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.25)); }}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
              <ZoomIn size={18} className="text-white" />
            </button>
          </div>
          <button onClick={e => { e.stopPropagation(); setLightbox(i => ((i ?? 0) - 1 + images.length) % images.length); }}
            className="absolute z-10 left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <ChevronLeft size={28} className="text-white" />
          </button>
          <img
            src={images[lightbox]?.url || FALLBACK}
            alt={`${displayTitle} photo ${lightbox + 1}`}
            className="relative z-0 max-h-[90vh] max-w-[90vw] object-contain rounded-2xl transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
            onClick={e => e.stopPropagation()}
          />
          <button onClick={e => { e.stopPropagation(); setLightbox(i => ((i ?? 0) + 1) % images.length); }}
            className="absolute z-10 right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <ChevronRight size={28} className="text-white" />
          </button>
          <div className="absolute z-10 bottom-6 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white text-sm">
            {(lightbox ?? 0) + 1} / {images.length}
          </div>
          {/* Thumbnail strip */}
          <div className="absolute z-10 left-1/2 -translate-x-1/2 bottom-20 w-[90vw] max-w-5xl overflow-x-auto">
            <div className="flex gap-2 justify-center">
              {images.map((img, idx) => (
                <button key={idx} type="button"
                  onClick={e => { e.stopPropagation(); setLightbox(idx); }}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition flex-shrink-0 ${idx === lightbox ? 'border-[#01BBDC]' : 'border-white/20'}`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Page ───────────────────────────────────────────────────────────── */}
      <div className="max-w-[1296px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back */}
        <Link href="/"
          className="flex items-center gap-2 text-sm mb-6 text-[#10214F] hover:text-[#01BBDC] transition-colors group w-fit">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> YachtVersal Home
        </Link>

        {/* ── Title + Price ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#10214F] tracking-tight mb-2 font-bahnschrift">
              {displayTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#10214F] font-poppins">
              {location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-[#01BBDC]" />
                  {location}
                </span>
              )}
              {data.condition && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 capitalize">
                  {data.condition}
                </span>
              )}
            </div>
          </div>
          {data.price && (
            <span className="text-4xl md:text-5xl font-bold text-[#01BBDC] font-bahnschrift">
              {formatPrice(data.price, data.currency)}
            </span>
          )}
        </div>

        {/* ── Hero image + contact card ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-4">

          {/* Hero image — 8 cols */}
          <div className="lg:col-span-8">
            <div
              className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer"
              style={{ height: 500 }}
              onClick={() => setLightbox(mainIdx)}
            >
              <img
                src={images[mainIdx]?.url || FALLBACK}
                alt={`${displayTitle} main photo`}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }}
              />
            </div>
          </div>

          {/* Contact card — 4 cols */}
          <div className="lg:col-span-4">
            <div className="rounded-3xl border border-gray-200 bg-white">

              {/* ── Main contact: salesperson (or brokerage when no seller) ── */}
              {(data.seller_name || data.brokerage_name) ? (
                <div className="p-6">
                  <div className="flex gap-4 mb-5">
                    {/* w-20 h-20 rounded-2xl matches real listing page salesman photo */}
                    {!data.seller_name && data.brokerage_logo_url ? (
                      <img src={data.brokerage_logo_url} alt={data.brokerage_name || 'Brokerage'}
                        className="w-16 h-16 rounded-2xl object-contain bg-white p-2 flex-shrink-0 border border-gray-100"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gray-100 border border-gray-200">
                        <User size={36} className="text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 pt-1">
                      {/* Primary name in cyan — seller name takes priority over brokerage */}
                      {data.seller_name ? (
                        <p className="font-bold text-lg text-[#01BBDC] mb-0.5">{data.seller_name}</p>
                      ) : data.brokerage_name ? (
                        data.brokerage_website ? (
                          <a href={data.brokerage_website} target="_blank" rel="noopener noreferrer"
                            className="font-bold text-lg text-[#01BBDC] mb-0.5 hover:underline block">
                            {data.brokerage_name}
                          </a>
                        ) : (
                          <p className="font-bold text-lg text-[#01BBDC] mb-0.5">{data.brokerage_name}</p>
                        )
                      ) : null}
                      {/* "Broker" title row — matches real page sc.title display */}
                      {data.seller_name && (
                        <p className="text-sm text-gray-600 mb-1">Broker</p>
                      )}
                      {/* Brokerage-only: show city/state under name */}
                      {!data.seller_name && (data.city || data.state) && (
                        <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                          <MapPin size={12} className="text-[#01BBDC]" />
                          {[data.city, data.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {/* Phone with Phone icon — matches real page sc.phone display */}
                      {data.seller_phone && (
                        <a href={`tel:${data.seller_phone}`}
                          className="text-sm text-[#10214F] hover:text-[#01BBDC] transition-colors flex items-center gap-1">
                          <Phone size={12} /> {data.seller_phone}
                        </a>
                      )}
                      {/* Email xs gray — matches real page sc.email display */}
                      {data.seller_email && (
                        <a href={`mailto:${data.seller_email}`}
                          className="text-xs text-gray-500 hover:text-[#01BBDC] transition-colors block mt-1">
                          {data.seller_email}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-gray-200 mb-5" />

                  <div className="flex flex-col gap-3">
                    {(data.seller_email || data.source_url) && (
                      <a href={data.seller_email ? `mailto:${data.seller_email}` : data.source_url!}
                        {...(!data.seller_email ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="w-full py-3.5 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 transition-all bg-[#01BBDC] hover:opacity-90">
                        <Mail size={18} /> Contact Broker
                      </a>
                    )}
                    {data.seller_phone && (
                      <a href={`tel:${data.seller_phone}`}
                        className="w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all border-2 border-[#01BBDC] text-[#01BBDC] hover:bg-[#01BBDC] hover:text-white">
                        <Phone size={18} /> Call Broker
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <Building2 size={36} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Contact information not available</p>
                </div>
              )}

              {/* ── Brokerage sub-section (when seller + brokerage both present) */}
              {data.seller_name && data.brokerage_name && (
                <div className="px-6 py-5 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-3 items-start">
                    {data.brokerage_logo_url ? (
                      <img src={data.brokerage_logo_url} alt={data.brokerage_name}
                        className="w-14 h-14 rounded-xl object-contain bg-white p-2 flex-shrink-0 border border-gray-100"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border border-gray-100">
                        <Building2 size={24} className="text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {/* Brokerage name in NAVY — matches real page dealer sub-section */}
                      {data.brokerage_website ? (
                        <a href={data.brokerage_website} target="_blank" rel="noopener noreferrer"
                          className="font-bold text-[#10214F] truncate text-sm hover:text-[#01BBDC] hover:underline block">
                          {data.brokerage_name}
                        </a>
                      ) : (
                        <p className="font-bold text-[#10214F] truncate text-sm">{data.brokerage_name}</p>
                      )}
                      {(data.city || data.state) && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {[data.city, data.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {data.brokerage_website && (
                        <a href={data.brokerage_website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 mt-1.5 text-xs hover:underline text-[#01BBDC]">
                          <Globe size={11} />
                          {data.brokerage_website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                    {data.brokerage_website && (
                      <a href={data.brokerage_website} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold hover:underline flex items-center gap-1 flex-shrink-0 text-[#01BBDC]">
                        View all <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ── Action row matching Save / Compare / Share layout ── */}
              <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200 bg-gray-50 rounded-b-3xl">
                <Link href="/register"
                  className="flex flex-col items-center gap-1.5 py-4 text-xs font-semibold text-[#10214F] hover:bg-white transition-colors rounded-bl-3xl"
                  onClick={() => trackCtaClick('save_button')}>
                  <Heart size={18} strokeWidth={2} />
                  Save
                </Link>
                <Link href="/register"
                  className="flex flex-col items-center gap-1.5 py-4 text-xs font-semibold text-[#10214F] hover:bg-white transition-colors"
                  onClick={() => trackCtaClick('compare_button')}>
                  <Plus size={18} strokeWidth={2} />
                  Compare
                </Link>
                <button
                  onClick={() => { navigator.clipboard.writeText(window.location.href); setShared(true); setTimeout(() => setShared(false), 2000); }}
                  className="flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors rounded-br-3xl"
                  style={{ color: shared ? '#01BBDC' : '#10214F' }}>
                  <Share2 size={18} strokeWidth={2} />
                  {shared ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Thumbnail strip ───────────────────────────────────────────── */}
        {images.length > 1 && (
          <div className="flex gap-3 mb-12 overflow-hidden lg:w-[calc(66.666%-12px)]">
            {galleryThumbs.map((img, idx) => {
              const isLast = idx === galleryThumbs.length - 1;
              return (
                <button key={idx} type="button"
                  className="relative flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100"
                  style={{ height: 160, width: 'calc(25% - 9px)' }}
                  onClick={() => { setMainIdx(idx + 1); setLightbox(idx + 1); }}
                >
                  <img src={img.url} alt={`${displayTitle} photo ${idx + 2}`} className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }} />
                  {isLast && remaining > 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xl font-bold font-bahnschrift">+{remaining}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Key Specs + Features + Description ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          <div className="lg:col-span-8 space-y-8">

            {/* Key Specifications icon grid */}
            {keySpecs.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-[#01BBDC] mb-2 font-bahnschrift">Key Specifications</h3>
                <div className="h-[1px] bg-[#01BBDC] mb-5" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                  {keySpecs.map(s => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white">
                        {s.icon}
                      </div>
                      <div>
                        <p className="text-xs text-[#10214F]/60 uppercase tracking-wide font-bahnschrift">{s.label}</p>
                        <p className="font-semibold text-[#10214F] font-bahnschrift text-sm">{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Features */}
            {data.feature_bullets?.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-[#01BBDC] mb-2 font-bahnschrift">Key Features</h3>
                <div className="h-[1px] bg-[#01BBDC] mb-2" />
                <ul className="space-y-2">
                  {data.feature_bullets.slice(0, 8).map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-[#10214F] font-poppins">
                      <span className="text-[#01BBDC] mt-1 flex-shrink-0">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Description */}
            {data.description && (
              <div>
                <SectionHeading>Description</SectionHeading>
                <p className="text-base leading-relaxed text-[#10214F] font-poppins whitespace-pre-line">
                  {data.description}
                </p>
              </div>
            )}

          </div>

          {/* Right 4 cols — source URL card */}
          <div className="lg:col-span-4">
            {data.source_url && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Original Listing Source</p>
                <a href={data.source_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs break-all hover:underline text-[#01BBDC] flex items-start gap-1">
                  <ExternalLink size={12} className="flex-shrink-0 mt-0.5" />
                  {data.source_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80)}{data.source_url.length > 90 ? '\u2026' : ''}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── Full Specifications ───────────────────────────────────────── */}
        <div className="mb-10">
          <SectionHeading>Specifications</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h4 className="font-bold text-[#10214F] mb-3 text-sm uppercase tracking-wide font-bahnschrift">General</h4>
              <SpecRow label="Make"      value={data.make} />
              <SpecRow label="Model"     value={data.model} />
              <SpecRow label="Year"      value={data.year ? String(data.year) : null} />
              <SpecRow label="Type"      value={data.boat_type} />
              <SpecRow label="Condition" value={data.condition ? data.condition.charAt(0).toUpperCase() + data.condition.slice(1) : null} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-[#10214F] mb-3 text-sm uppercase tracking-wide font-bahnschrift">Dimensions</h4>
              <SpecRow label="LOA"           value={data.length_feet ? `${data.length_feet} ft` : null} />
              <SpecRow label="Beam"          value={data.beam_feet ? `${data.beam_feet} ft` : null} />
              <SpecRow label="Draft"         value={data.draft_feet ? `${data.draft_feet} ft` : null} />
              <SpecRow label="Hull Material" value={data.hull_material} />
              <SpecRow label="Hull Type"     value={data.hull_type} />
              <h4 className="font-bold text-[#10214F] mb-3 mt-5 text-sm uppercase tracking-wide font-bahnschrift">Accommodations</h4>
              <SpecRow label="Cabins"  value={data.cabins ? String(data.cabins) : null} />
              <SpecRow label="Berths"  value={data.berths ? String(data.berths) : null} />
              <SpecRow label="Heads"   value={data.heads  ? String(data.heads)  : null} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-[#10214F] mb-3 text-sm uppercase tracking-wide font-bahnschrift">Performance</h4>
              <SpecRow label="Max Speed"      value={data.max_speed_knots ? `${data.max_speed_knots} kts` : null} />
              <SpecRow label="Cruise Speed"   value={data.cruising_speed_knots ? `${data.cruising_speed_knots} kts` : null} />
              <SpecRow label="Fuel Type"      value={data.fuel_type} />
              <SpecRow label="Fuel Capacity"  value={data.fuel_capacity_gallons ? `${fmt(data.fuel_capacity_gallons)} gal` : null} />
              <SpecRow label="Water Capacity" value={data.water_capacity_gallons ? `${fmt(data.water_capacity_gallons)} gal` : null} />
              <SpecRow label="Engine Count"   value={data.engine_count ? String(data.engine_count) : null} />
              <SpecRow label="Engine Hours"   value={data.engine_hours ? `${fmt(data.engine_hours)} hrs` : null} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
