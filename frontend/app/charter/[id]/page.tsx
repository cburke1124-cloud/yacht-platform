'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Anchor, Users, Ruler, Calendar, 
  Mail, Phone, Globe, ChevronLeft, ChevronRight,
  Ship, Zap, Bed, Waves, Check, ExternalLink
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

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
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', phone: '', message: '', start_date: '', end_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
        body: JSON.stringify({ charter_id: charter?.id, ...inquiryForm }),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || !charter) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Anchor className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-600">Charter listing not found</h2>
        <Link href="/charter" className="text-primary hover:underline text-sm">Browse all charters</Link>
      </div>
    );
  }

  const location = [charter.home_port_city, charter.home_port_state, charter.home_port_country].filter(Boolean).join(', ') || charter.home_port;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back nav */}
      <div className="bg-white border-b border-gray-200 py-3 px-4">
        <div className="max-w-7xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Charter Listings
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8">

          {/* Left column */}
          <div className="space-y-6">
            {/* Image gallery */}
            <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
              <div className="relative h-[420px] bg-gray-100">
                {images.length > 0 ? (
                  <img src={images[activeImg]} alt={charter.title} onError={onImgError} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Anchor className="w-16 h-16 text-gray-300" />
                  </div>
                )}
                {images.length > 1 && (
                  <>
                    <button onClick={() => setActiveImg(i => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => setActiveImg(i => (i + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                      {activeImg + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {images.map((src, i) => (
                    <button key={i} onClick={() => setActiveImg(i)} className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${i === activeImg ? 'border-primary' : 'border-transparent'}`}>
                      <img src={src} alt="" onError={onImgError} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title + location */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                    {charter.title}
                  </h1>
                  {charter.vessel_name && charter.vessel_name !== charter.title && (
                    <p className="text-gray-500 text-sm mt-0.5">{charter.vessel_name}</p>
                  )}
                  {location && (
                    <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      {location}
                    </div>
                  )}
                  {charter.operating_regions && (
                    <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                      <Waves className="w-4 h-4 flex-shrink-0" />
                      Operates in: {charter.operating_regions}
                    </div>
                  )}
                </div>
                {charter.crew_included && (
                  <span className="flex-shrink-0 flex items-center gap-1.5 bg-primary/10 text-primary text-sm font-medium px-3 py-1.5 rounded-full">
                    <Check className="w-3.5 h-3.5" /> Crew Included
                  </span>
                )}
              </div>
            </div>

            {/* Specs */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Vessel Specifications</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { icon: <Ruler className="w-4 h-4" />, label: 'Length', value: charter.length_feet ? `${charter.length_feet} ft` : null },
                  { icon: <Ship className="w-4 h-4" />, label: 'Vessel Type', value: charter.boat_type },
                  { icon: <Calendar className="w-4 h-4" />, label: 'Year', value: charter.year?.toString() },
                  { icon: <Users className="w-4 h-4" />, label: 'Max Guests', value: charter.max_guests?.toString() },
                  { icon: <Bed className="w-4 h-4" />, label: 'Cabins', value: charter.cabins?.toString() },
                  { icon: <Anchor className="w-4 h-4" />, label: 'Make / Model', value: [charter.make, charter.model].filter(Boolean).join(' ') || null },
                  { icon: <Zap className="w-4 h-4" />, label: 'Engines', value: charter.engine_count ? `${charter.engine_count}x ${charter.engine_make ?? ''}`.trim() : null },
                  { icon: <Waves className="w-4 h-4" />, label: 'Fuel Type', value: charter.fuel_type },
                  { icon: <Gauge className="w-4 h-4" />, label: 'Max Speed', value: charter.max_speed_knots ? `${charter.max_speed_knots} kts` : null },
                  { icon: <Users className="w-4 h-4" />, label: 'Crew', value: charter.crew_included ? `Included${charter.crew_count ? ` (${charter.crew_count})` : ''}` : 'Bareboat' },
                  { icon: <Ruler className="w-4 h-4" />, label: 'Beam', value: charter.beam_feet ? `${charter.beam_feet} ft` : null },
                  { icon: <Ruler className="w-4 h-4" />, label: 'Draft', value: charter.draft_feet ? `${charter.draft_feet} ft` : null },
                ].filter(s => s.value).map((spec, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-primary mt-0.5 flex-shrink-0">{spec.icon}</span>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">{spec.label}</p>
                      <p className="text-sm font-medium text-gray-800">{spec.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {charter.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">About This Vessel</h2>
                <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{charter.description}</div>
              </div>
            )}

            {/* Amenities */}
            {charter.amenities && charter.amenities.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Amenities & Features</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {charter.amenities.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column — pricing + contact */}
          <div className="space-y-5">
            {/* Pricing card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Charter Rates</h2>

              {charter.half_day_rate && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Half Day</span>
                  <span className="font-semibold text-gray-900">{formatRate(charter.half_day_rate, charter.currency)}</span>
                </div>
              )}
              {charter.day_rate && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Per Day</span>
                  <span className="font-semibold text-gray-900">{formatRate(charter.day_rate, charter.currency)}</span>
                </div>
              )}
              {charter.week_rate && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Per Week</span>
                  <span className="font-semibold text-gray-900">{formatRate(charter.week_rate, charter.currency)}</span>
                </div>
              )}
              {!charter.day_rate && !charter.week_rate && !charter.half_day_rate && (
                <p className="text-gray-500 text-sm">Contact for pricing</p>
              )}

              {(charter.min_charter_days || charter.max_charter_days) && (
                <p className="text-xs text-gray-400 mt-3">
                  {charter.min_charter_days && `Min ${charter.min_charter_days} day${charter.min_charter_days !== 1 ? 's' : ''}`}
                  {charter.min_charter_days && charter.max_charter_days && ' · '}
                  {charter.max_charter_days && `Max ${charter.max_charter_days} day${charter.max_charter_days !== 1 ? 's' : ''}`}
                </p>
              )}

              {charter.booking_url ? (
                <a
                  href={charter.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex items-center justify-center gap-2 w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Book Now <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <button
                  onClick={() => setShowInquiry(v => !v)}
                  className="mt-5 w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Request Charter
                </button>
              )}

              {/* Inquiry form */}
              {showInquiry && !submitted && (
                <form onSubmit={handleInquiry} className="mt-5 space-y-3 border-t border-gray-100 pt-5">
                  <h3 className="text-sm font-semibold text-gray-700">Send Inquiry</h3>
                  <input required placeholder="Your name" value={inquiryForm.name} onChange={e => setInquiryForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input required type="email" placeholder="Email address" value={inquiryForm.email} onChange={e => setInquiryForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input placeholder="Phone (optional)" value={inquiryForm.phone} onChange={e => setInquiryForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Desired start</label>
                      <input type="date" value={inquiryForm.start_date} onChange={e => setInquiryForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">End date</label>
                      <input type="date" value={inquiryForm.end_date} onChange={e => setInquiryForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                  <textarea required rows={3} placeholder="Tell them about your trip..." value={inquiryForm.message} onChange={e => setInquiryForm(f => ({ ...f, message: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                  <button type="submit" disabled={submitting} className="w-full bg-[#C9A84C] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#b8933f] transition-colors disabled:opacity-50">
                    {submitting ? 'Sending...' : 'Send Request'}
                  </button>
                </form>
              )}
              {submitted && (
                <div className="mt-5 border-t border-gray-100 pt-4 text-center">
                  <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Request sent!</p>
                  <p className="text-xs text-gray-400 mt-1">The charter company will be in touch shortly.</p>
                </div>
              )}
            </div>

            {/* Charter company */}
            {(charter.charter_company_name || charter.charter_company_email || charter.charter_company_phone) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Charter Company</h3>
                {charter.charter_company_name && (
                  <p className="font-medium text-gray-900 mb-3">{charter.charter_company_name}</p>
                )}
                <div className="space-y-2">
                  {charter.charter_company_email && (
                    <a href={`mailto:${charter.charter_company_email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors">
                      <Mail className="w-4 h-4" />{charter.charter_company_email}
                    </a>
                  )}
                  {charter.charter_company_phone && (
                    <a href={`tel:${charter.charter_company_phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors">
                      <Phone className="w-4 h-4" />{charter.charter_company_phone}
                    </a>
                  )}
                  {charter.charter_company_website && (
                    <a href={charter.charter_company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors">
                      <Globe className="w-4 h-4" />Website
                    </a>
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

// Needed for the spec grid
function Gauge(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 12 8.5 8.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
