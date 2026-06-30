'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Anchor, Users, Ruler, Calendar, X,
  Mail, Phone, ChevronLeft, ChevronRight,
  Ship, Zap, Bed, Waves, Check, ExternalLink
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import AvailabilityCalendar, { type AvailabilityBlock } from '@/app/components/charter/AvailabilityCalendar';

interface CharterListing {
  id: number;
  title: string;
  vessel_name: string;
  make?: string;
  model?: string;
  year?: number;
  length_feet?: number;
  beam_feet?: number;
  draft_feet?: number;
  boat_type?: string;
  hull_material?: string;
  engine_make?: string;
  engine_count?: number;
  fuel_type?: string;
  max_speed_knots?: number;
  cruising_speed_knots?: number;
  cabins?: number;
  berths?: number;
  heads?: number;
  max_guests?: number;
  crew_included: boolean;
  crew_count?: number;
  home_port?: string;
  home_port_city?: string;
  home_port_state?: string;
  home_port_country?: string;
  operating_regions?: string;
  day_rate?: number;
  half_day_rate?: number;
  week_rate?: number;
  currency: string;
  min_charter_days?: number;
  max_charter_days?: number;
  description?: string;
  amenities?: string[];
  images?: Array<{ url: string; is_primary?: boolean } | string>;
  status: string;
  charter_company_name?: string;
  charter_company_slug?: string;
  charter_company_email?: string;
  charter_company_phone?: string;
  charter_company_website?: string;
  booking_url?: string;
  created_at?: string;
  availability_blocks?: AvailabilityBlock[];
  seasonal_rates?: Array<{
    id?: number;
    season_name: string;
    start_date?: string;
    end_date?: string;
    day_rate?: number;
    half_day_rate?: number;
    week_rate?: number;
    currency?: string;
    min_charter_days?: number;
    notes?: string;
  }>;
  included_items?: string[];
  excluded_items?: string[];
  apa_percentage?: number;
  security_deposit?: number;
  tax_notes?: string;
  cancellation_policy?: string;
  one_way_allowed?: boolean;
  turnaround_days?: number;
}

function formatRate(amount?: number, currency = 'USD', period?: string) {
  if (!amount) return null;
  const symbol = currency === 'USD' ? '$' : currency;
  return `${symbol}${amount.toLocaleString()}${period ? ` / ${period}` : ''}`;
}

export default function CharterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [charter, setCharter] = useState<CharterListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [charterStartDate, setCharterStartDate] = useState('');
  const [charterEndDate, setCharterEndDate] = useState('');
  const [showSimpleGuide, setShowSimpleGuide] = useState(true);

  const charterDays = useMemo(() => {
    if (!charterStartDate || !charterEndDate) return 0;
    const diff = new Date(charterEndDate).getTime() - new Date(charterStartDate).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [charterStartDate, charterEndDate]);

  const estimatedTotal = useMemo(() => {
    if (!charterDays || !charter) return null;
    if (charter.day_rate) return charterDays * charter.day_rate;
    if (charter.week_rate) return Math.ceil(charterDays / 7) * charter.week_rate;
    return null;
  }, [charterDays, charter]);

  const availabilitySummary = useMemo(() => {
    if (!charter?.availability_blocks?.length) return 'Availability is confirmed after inquiry.';
    const booked = charter.availability_blocks.filter(b => b.status === 'booked').length;
    const hold = charter.availability_blocks.filter(b => b.status === 'hold' || b.status === 'option').length;
    return `${booked} booked window${booked === 1 ? '' : 's'} and ${hold} tentative hold${hold === 1 ? '' : 's'}`;
  }, [charter]);

  const seasonalRates = useMemo(() => charter?.seasonal_rates ?? [], [charter]);

  useEffect(() => {
    const fetchCharter = async () => {
      try {
        const res = await fetch(apiUrl(`/charter/${id}`));
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCharter(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchCharter();
  }, [id]);

  const images = charter?.images?.map(img => mediaUrl(typeof img === 'string' ? img : img.url)) ?? [];

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(apiUrl('/charter/inquiry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charter_id: charter?.id,
          ...inquiryForm,
          start_date: charterStartDate || undefined,
          end_date: charterEndDate || undefined,
        }),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-4 border-t-[#01BBDC] border-[#01BBDC]/20 animate-spin" />
      </div>
    );
  }

  if (notFound || !charter) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Anchor className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-[#10214F]">Charter listing not found</h2>
        <Link href="/charter" className="text-[#01BBDC] hover:underline text-sm">Browse all charters</Link>
      </div>
    );
  }

  const location = [charter.home_port_city, charter.home_port_state, charter.home_port_country].filter(Boolean).join(', ') || charter.home_port;
  const primaryRate = charter.day_rate
    ? formatRate(charter.day_rate, charter.currency, 'day')
    : charter.week_rate
      ? formatRate(charter.week_rate, charter.currency, 'week')
      : null;

  return (
    <div className="min-h-screen bg-white">

      {/* ══ INQUIRY MODAL ══════════════════════════════════════════════════════ */}
      {showInquiry && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-[#10214F]/80 backdrop-blur-sm" style={{ zIndex: 9999 }} onClick={() => setShowInquiry(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-[#10214F]" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>Request Charter</h3>
                {charter.charter_company_name && <p className="text-sm text-gray-500 mt-1">{charter.charter_company_name}</p>}
              </div>
              <button onClick={() => setShowInquiry(false)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="mb-5 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600">Re: <span className="font-semibold text-[#10214F]">{charter.title}</span></p>
              </div>
              {submitted ? (
                <div className="text-center py-8">
                  <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-bold text-[#10214F] mb-1">Request sent!</p>
                  <p className="text-sm text-gray-400 mb-6">The charter company will be in touch shortly.</p>
                  <button onClick={() => { setSubmitted(false); setShowInquiry(false); }} className="px-8 py-2.5 bg-[#01BBDC] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-colors">Close</button>
                </div>
              ) : (
                <form onSubmit={handleInquiry} className="space-y-3">
                  <input required placeholder="Your name" value={inquiryForm.name} onChange={e => setInquiryForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                  <input required type="email" placeholder="Email address" value={inquiryForm.email} onChange={e => setInquiryForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                  <input placeholder="Phone (optional)" value={inquiryForm.phone} onChange={e => setInquiryForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Preferred start</label>
                      <input type="date" value={charterStartDate} onChange={e => setCharterStartDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Preferred end</label>
                      <input type="date" value={charterEndDate} min={charterStartDate || undefined} onChange={e => setCharterEndDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                    </div>
                  </div>
                  <textarea required rows={4} placeholder="Tell them about your trip..." value={inquiryForm.message} onChange={e => setInquiryForm(f => ({ ...f, message: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] resize-none" />
                  <button type="submit" disabled={submitting} className="w-full bg-[#01BBDC] hover:bg-[#00a5c4] text-white py-3.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                    {submitting ? ‘Sending...’ : ‘Send Request’}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ PAGE ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1296px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back button */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm mb-6 text-[#10214F] hover:text-[#01BBDC] transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to charter listings
        </button>

        {/* ══ TITLE + RATE ══════════════════════════════════════════════════════ */}
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#10214F] tracking-tight mb-2" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>
              {charter.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#10214F]">
              {location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-[#01BBDC]" />
                  {location}
                </span>
              )}
              {charter.operating_regions && (
                <span className="flex items-center gap-1.5">
                  <Waves size={15} className="text-[#01BBDC]" />
                  Operates in: {charter.operating_regions}
                </span>
              )}
              {charter.crew_included && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white bg-[#01BBDC]">
                  <Check size={11} /> Crew Included
                </span>
              )}
            </div>
          </div>
          {primaryRate && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-4xl md:text-5xl font-bold text-[#01BBDC]" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>
                {primaryRate}
              </span>
              {charter.min_charter_days && (
                <span className="text-xs text-gray-400">Min {charter.min_charter_days} day{charter.min_charter_days !== 1 ? ‘s’ : ‘’}</span>
              )}
            </div>
          )}
        </div>

        {/* ══ FEATURED IMAGE + BOOKING CARD ═════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-4">

          {/* Featured image — 8 cols */}
          <div className="lg:col-span-8">
            <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-100" style={{ height: 500 }}>
              {images.length > 0 ? (
                <img src={images[activeImg]} alt={charter.title} onError={onImgError} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Anchor className="w-16 h-16 text-gray-300" />
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button onClick={() => setActiveImg(i => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setActiveImg(i => (i + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
                    {activeImg + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Booking card — 4 cols */}
          <div className="lg:col-span-4">
            <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden sticky top-5">
              <div className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <Anchor className="w-10 h-10 text-[#01BBDC]" />
                  </div>
                </div>
                {charter.charter_company_name && (
                  <p style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’, fontWeight: 700, textTransform: ‘uppercase’, letterSpacing: ‘0.06em’, fontSize: 15, color: ‘#10214F’, marginBottom: 4 }}>
                    {charter.charter_company_name}
                  </p>
                )}
                {charter.charter_company_phone && (
                  <a href={`tel:${charter.charter_company_phone}`} className="flex items-center justify-center gap-1.5 text-sm hover:text-[#01BBDC] transition-colors mb-4" style={{ color: ‘#10214F’ }}>
                    <Phone size={13} /> {charter.charter_company_phone}
                  </a>
                )}

                {/* Rates */}
                <div className="text-left space-y-2 mb-4">
                  {charter.half_day_rate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Half Day</span>
                      <span className="font-semibold text-[#10214F]">{formatRate(charter.half_day_rate, charter.currency)}</span>
                    </div>
                  )}
                  {charter.day_rate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Per Day</span>
                      <span className="font-semibold text-[#10214F]">{formatRate(charter.day_rate, charter.currency)}</span>
                    </div>
                  )}
                  {charter.week_rate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Per Week</span>
                      <span className="font-semibold text-[#10214F]">{formatRate(charter.week_rate, charter.currency)}</span>
                    </div>
                  )}
                  {!charter.day_rate && !charter.week_rate && !charter.half_day_rate && (
                    <p className="text-sm text-gray-400">Contact for pricing</p>
                  )}
                </div>

                {/* Estimated total */}
                {estimatedTotal !== null && (
                  <div className="mb-4 rounded-xl bg-[#01BBDC]/8 px-3 py-2 text-sm text-left">
                    <span className="text-gray-600">Est. total: </span>
                    <span className="font-semibold text-[#10214F]">{charter.currency === ‘USD’ ? ‘$’ : charter.currency}{estimatedTotal.toLocaleString()}</span>
                    <span className="text-gray-400"> ({charterDays}d)</span>
                  </div>
                )}

                {/* CTA */}
                {charter.booking_url ? (
                  <a href={charter.booking_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: ‘#10214F’, fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’, letterSpacing: ‘0.08em’, fontSize: 13 }}>
                    BOOK NOW <ExternalLink size={13} />
                  </a>
                ) : (
                  <button onClick={() => setShowInquiry(true)}
                    className="w-full py-3.5 rounded-2xl text-white font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: ‘#10214F’, fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’, letterSpacing: ‘0.08em’, fontSize: 13 }}>
                    REQUEST CHARTER
                  </button>
                )}
              </div>

              {(charter.charter_company_email || charter.charter_company_website) && (
                <div className="border-t border-gray-100 p-5 bg-gray-50">
                  <div className="space-y-2">
                    {charter.charter_company_email && (
                      <a href={`mailto:${charter.charter_company_email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#01BBDC] transition-colors">
                        <Mail size={14} /> {charter.charter_company_email}
                      </a>
                    )}
                    {charter.charter_company_website && (
                      <a href={charter.charter_company_website} target="_blank" rel="noopener noreferrer"
                        className="block w-full py-2.5 rounded-xl text-center text-xs font-semibold transition-all hover:opacity-80 mt-2"
                        style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’, letterSpacing: ‘0.06em’, border: ‘1.5px solid #10214F’, color: ‘#10214F’ }}>
                        VISIT WEBSITE
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ PHOTO STRIP ═══════════════════════════════════════════════════════ */}
        {images.length > 1 && (
          <div className="flex justify-center gap-3 mb-12 overflow-hidden">
            {images.slice(1, 5).map((src, idx) => {
              const isLast = idx === 3;
              const remaining = Math.max(images.length - 5, 0);
              return (
                <button key={idx} type="button"
                  className="relative flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100"
                  style={{ height: 160, width: ‘calc(25% - 9px)’ }}
                  onClick={() => setActiveImg(idx + 1)}>
                  <img src={src} alt={`${charter.title} photo ${idx + 2}`} onError={onImgError} className="w-full h-full object-cover" />
                  {isLast && remaining > 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xl font-bold" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>+{remaining}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ══ SPECS + SIDEBAR ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">

          {/* Left — 8 cols */}
          <div className="lg:col-span-8 space-y-10">

            {/* VESSEL SPECIFICATIONS */}
            <div>
              <SectionHeading>Vessel Specifications</SectionHeading>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                  {[
                    { icon: <Ruler size={20} className="text-[#01BBDC]" />,    label: ‘Length’,      value: charter.length_feet ? `${charter.length_feet} ft` : null },
                    { icon: <Ship size={20} className="text-[#01BBDC]" />,     label: ‘Type’,        value: charter.boat_type },
                    { icon: <Calendar size={20} className="text-[#01BBDC]" />, label: ‘Year’,        value: charter.year?.toString() },
                    { icon: <Users size={20} className="text-[#01BBDC]" />,    label: ‘Max Guests’,  value: charter.max_guests?.toString() },
                    { icon: <Bed size={20} className="text-[#01BBDC]" />,      label: ‘Cabins’,      value: charter.cabins?.toString() },
                    { icon: <Anchor size={20} className="text-[#01BBDC]" />,   label: ‘Make / Model’, value: [charter.make, charter.model].filter(Boolean).join(‘ ‘) || null },
                    { icon: <Zap size={20} className="text-[#01BBDC]" />,      label: ‘Engines’,     value: charter.engine_count ? `${charter.engine_count}x ${charter.engine_make ?? ‘’}`.trim() : null },
                    { icon: <Waves size={20} className="text-[#01BBDC]" />,    label: ‘Fuel Type’,   value: charter.fuel_type },
                    { icon: <Ship size={20} className="text-[#01BBDC]" />,     label: ‘Max Speed’,   value: charter.max_speed_knots ? `${charter.max_speed_knots} kts` : null },
                    { icon: <Users size={20} className="text-[#01BBDC]" />,    label: ‘Crew’,        value: charter.crew_included ? `Included${charter.crew_count ? ` (${charter.crew_count})` : ‘’}` : ‘Bareboat’ },
                    { icon: <Ruler size={20} className="text-[#01BBDC]" />,    label: ‘Beam’,        value: charter.beam_feet ? `${charter.beam_feet} ft` : null },
                    { icon: <Ruler size={20} className="text-[#01BBDC]" />,    label: ‘Draft’,       value: charter.draft_feet ? `${charter.draft_feet} ft` : null },
                  ].filter(s => s.value).map((spec, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ‘rgba(1,187,220,0.1)’ }}>
                        {spec.icon}
                      </div>
                      <div>
                        <p className="text-xs text-[#10214F]/55 uppercase tracking-wide" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>{spec.label}</p>
                        <p className="font-semibold text-[#10214F] text-sm" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>{spec.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* DESCRIPTION */}
            {charter.description && (
              <div>
                <SectionHeading>About This Vessel</SectionHeading>
                <div className="text-[15px] leading-[1.8] text-[#10214F] whitespace-pre-line" style={{ fontFamily: ‘Poppins, sans-serif’ }}>
                  {charter.description}
                </div>
              </div>
            )}

            {/* AMENITIES */}
            {charter.amenities && charter.amenities.length > 0 && (
              <div>
                <SectionHeading>Amenities &amp; Features</SectionHeading>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {charter.amenities.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-[#10214F]">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ backgroundColor: ‘#01BBDC’ }}>✓</span>
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AVAILABILITY */}
            <div>
              <div className="mb-5 pl-4 border-l-4 border-[#01BBDC] flex items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-[#10214F]" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>Availability</h3>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 flex-shrink-0">{availabilitySummary}</span>
              </div>
              {charter.availability_blocks?.length ? (
                <AvailabilityCalendar blocks={charter.availability_blocks} monthsToShow={3} />
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                  No blocked dates published yet. Availability is confirmed directly with the charter company.
                </div>
              )}
            </div>

            {/* SEASONAL PRICING */}
            {seasonalRates.length > 0 && (
              <div>
                <SectionHeading>Seasonal Pricing</SectionHeading>
                <div className="space-y-3">
                  {seasonalRates.map((rate, index) => {
                    const moneyPrefix = (rate.currency || charter.currency || ‘USD’) === ‘USD’ ? ‘$’ : (rate.currency || charter.currency || ‘USD’);
                    return (
                      <div key={rate.id ?? `${rate.season_name}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#10214F]">{rate.season_name}</p>
                            <p className="text-xs text-gray-500">{rate.start_date || ‘Open start’}{rate.end_date ? ` to ${rate.end_date}` : ‘’}</p>
                          </div>
                          {rate.min_charter_days ? <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">Min {rate.min_charter_days} days</span> : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {rate.half_day_rate ? <span className="rounded-full bg-[#01BBDC]/10 text-[#01BBDC] px-2.5 py-1 font-medium">Half day {moneyPrefix}{rate.half_day_rate.toLocaleString()}</span> : null}
                          {rate.day_rate ? <span className="rounded-full bg-[#01BBDC]/10 text-[#01BBDC] px-2.5 py-1 font-medium">Day {moneyPrefix}{rate.day_rate.toLocaleString()}</span> : null}
                          {rate.week_rate ? <span className="rounded-full bg-[#01BBDC]/10 text-[#01BBDC] px-2.5 py-1 font-medium">Week {moneyPrefix}{rate.week_rate.toLocaleString()}</span> : null}
                        </div>
                        {rate.notes ? <p className="mt-3 text-sm text-gray-600">{rate.notes}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* HOW CHARTERING WORKS */}
            <div className="bg-[#10214F] text-white rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#C9A84C] font-semibold mb-1">How chartering works</p>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>Simple, not complicated</h2>
                </div>
                <button onClick={() => setShowSimpleGuide(v => !v)} className="text-sm text-white/70 hover:text-white flex-shrink-0">{showSimpleGuide ? ‘Hide’ : ‘Show’}</button>
              </div>
              {showSimpleGuide && (
                <div className="grid md:grid-cols-3 gap-3 text-sm text-blue-100">
                  {[
                    { n: ‘1’, title: ‘Pick where you want to go’, body: "Search by destination, dates, and group size." },
                    { n: ‘2’, title: ‘Ask for availability’, body: "Most charters are confirmed by inquiry. We show booked and tentative holds." },
                    { n: ‘3’, title: "Review what’s included", body: "Some trips include crew and water toys. Others exclude taxes or gratuity." },
                  ].map(s => (
                    <div key={s.n} className="bg-white/5 rounded-xl p-4">
                      <p className="font-semibold text-white mb-1">{s.n}. {s.title}</p>
                      <p>{s.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right sidebar — 4 cols */}
          <div className="lg:col-span-4 space-y-6">

            {/* Charter policy card */}
            {(charter.included_items?.length || charter.excluded_items?.length || charter.apa_percentage || charter.security_deposit || charter.tax_notes || charter.cancellation_policy) && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6">
                <h4 className="text-lg font-bold text-[#10214F] mb-4" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>Charter Terms</h4>
                <div className="space-y-4 text-sm">
                  {charter.included_items?.length ? (
                    <div>
                      <p className="font-medium text-[#10214F] mb-1">Usually included</p>
                      <p className="text-gray-500">{charter.included_items.join(‘, ‘)}</p>
                    </div>
                  ) : null}
                  {charter.excluded_items?.length ? (
                    <div>
                      <p className="font-medium text-[#10214F] mb-1">Usually excluded</p>
                      <p className="text-gray-500">{charter.excluded_items.join(‘, ‘)}</p>
                    </div>
                  ) : null}
                  {(charter.apa_percentage || charter.security_deposit || charter.tax_notes || charter.cancellation_policy) && (
                    <div className="space-y-2 text-gray-600 border-t border-gray-100 pt-4">
                      {charter.apa_percentage ? <p><span className="font-medium text-[#10214F]">APA:</span> {charter.apa_percentage}% estimated advance provisioning.</p> : null}
                      {charter.security_deposit ? <p><span className="font-medium text-[#10214F]">Security deposit:</span> {charter.currency === ‘USD’ ? ‘$’ : charter.currency}{charter.security_deposit.toLocaleString()}</p> : null}
                      {charter.tax_notes ? <p><span className="font-medium text-[#10214F]">Taxes:</span> {charter.tax_notes}</p> : null}
                      {charter.cancellation_policy ? <p><span className="font-medium text-[#10214F]">Cancellation:</span> {charter.cancellation_policy}</p> : null}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 pl-4 border-l-4 border-[#01BBDC]">
      <h3 className="text-xl font-bold text-[#10214F]" style={{ fontFamily: ‘Bahnschrift, DIN Alternate, sans-serif’ }}>
        {children}
      </h3>
    </div>
  );
}
