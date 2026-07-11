'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Anchor, Users, Ruler, Calendar, X,
  Mail, Phone, ChevronLeft, ChevronRight,
  Ship, Zap, Bed, Waves, Check, ExternalLink,
  Facebook, Instagram, Twitter, Linkedin
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import AvailabilityCalendar, { type AvailabilityBlock } from '@/app/components/charter/AvailabilityCalendar';

export interface CharterListing {
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
  crew_profiles?: Array<{ name: string; role: string; bio?: string }>;
  home_port?: string;
  home_port_city?: string;
  home_port_state?: string;
  home_port_country?: string;
  operating_regions?: string;
  embarkation_ports?: string[];
  disembarkation_ports?: string[];
  one_way_allowed?: boolean;
  turnaround_days?: number;
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
  charter_company_logo_url?: string;
  charter_company_description?: string;
  charter_company_city?: string;
  charter_company_state?: string;
  charter_company_country?: string;
  charter_company_facebook_url?: string;
  charter_company_instagram_url?: string;
  charter_company_twitter_url?: string;
  charter_company_linkedin_url?: string;
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
  hourly_rates?: Array<{
    id?: number;
    hours: number;
    price: number;
    label?: string;
    notes?: string;
  }>;
  included_items?: string[];
  excluded_items?: string[];
  apa_percentage?: number;
  security_deposit?: number;
  tax_notes?: string;
  cancellation_policy?: string;
}

function formatRate(amount?: number, currency = 'USD', period?: string) {
  if (!amount) return null;
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;
  return `${symbol}${amount.toLocaleString()}${period ? ` / ${period}` : ''}`;
}

// Categorize flat amenity tags into equipment groups (Master Ocean-style display).
// Matching is keyword-based so both our fixed CHARTER_FEATURES tags and free-form
// amenities from feeds/scrapes land in a sensible group.
const EQUIPMENT_GROUPS: Array<{ name: string; keywords: string[] }> = [
  { name: 'Navigation & Technical', keywords: ['gps', 'autopilot', 'radar', 'chartplotter', 'vhf', 'compass', 'watermaker', 'generator', 'inverter', 'stabilizer', 'thruster', 'battery', 'shore power', 'solar', 'depth', 'wind instrument', 'navigation'] },
  { name: 'Comfort & Interior', keywords: ['air conditioning', 'a/c', 'heating', 'wifi', 'wi-fi', 'washing', 'dryer', 'dishwasher', 'ice maker', 'freezer', 'fridge', 'refrigerator', 'linen', 'towel', 'cabin', 'wardrobe'] },
  { name: 'Deck & Water Toys', keywords: ['tender', 'jet ski', 'seabob', 'paddleboard', 'paddle board', 'kayak', 'snorkel', 'dive', 'diving', 'fishing', 'water slide', 'floating', 'wakeboard', 'water ski', 'bbq', 'grill', 'bimini', 'swim platform', 'deck shower', 'jacuzzi', 'anchor', 'windlass'] },
  { name: 'Entertainment', keywords: ['tv', 'television', 'audio', 'speaker', 'sound', 'bluetooth', 'satellite', 'streaming', 'game', 'projector', 'stereo'] },
  { name: 'Safety', keywords: ['life raft', 'life jacket', 'liferaft', 'epirb', 'fire', 'first aid', 'flare', 'alarm', 'medical', 'smoke', 'safety'] },
  { name: 'Galley', keywords: ['oven', 'stove', 'microwave', 'coffee', 'wine cooler', 'bar ', 'cooktop', 'galley'] },
];

function groupAmenities(amenities: string[]): Array<{ name: string; items: string[] }> {
  const groups: Record<string, string[]> = {};
  const other: string[] = [];
  for (const a of amenities) {
    const lower = a.toLowerCase();
    const group = EQUIPMENT_GROUPS.find(g => g.keywords.some(k => lower.includes(k)));
    if (group) (groups[group.name] ??= []).push(a);
    else other.push(a);
  }
  const result = EQUIPMENT_GROUPS.filter(g => groups[g.name]?.length).map(g => ({ name: g.name, items: groups[g.name] }));
  if (other.length) result.push({ name: 'Other Equipment', items: other });
  return result;
}

const CHARTER_FAQS = [
  { q: 'How do I book this yacht?', a: 'Send an inquiry with your preferred dates and group size using the Request Charter button. The charter company will confirm availability, answer questions, and walk you through their booking and payment process directly.' },
  { q: "What's included in the charter rate?", a: 'It varies by vessel. Crewed charters typically include the crew, vessel insurance, and standard water toys — while fuel, food and beverages, dockage away from the home port, taxes, and gratuity are often billed separately. Check the Charter Terms section on this page for what this vessel includes and excludes.' },
  { q: 'What is APA?', a: 'APA (Advance Provisioning Allowance) is a deposit — commonly 25–35% of the charter fee — collected before departure to cover variable expenses like fuel, food, drinks, and port fees. The captain accounts for spending during the trip and any unused balance is refunded after the charter.' },
  { q: 'Can I customize the itinerary?', a: 'In most cases, yes. Itineraries are flexible and planned with the captain around your preferences, local conditions, and weather. Share your ideas in the inquiry and the charter company will help shape the trip.' },
  { q: 'What is the cancellation policy?', a: 'Cancellation terms are set by each charter company and are shown in the Charter Terms section when the operator has published them. Always confirm the current policy before paying a deposit.' },
];

interface CharterDetailClientProps {
  id: string;
  initialCharter: CharterListing | null;
  initialGalleryImages: string[] | null;
}

export default function CharterDetailClient({ id, initialCharter, initialGalleryImages }: CharterDetailClientProps) {
  const router = useRouter();
  const [charter] = useState<CharterListing | null>(initialCharter);
  const [notFound] = useState(!initialCharter);
  const [activeImg, setActiveImg] = useState(0);
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [charterStartDate, setCharterStartDate] = useState('');
  const [charterEndDate, setCharterEndDate] = useState('');
  const [showSimpleGuide, setShowSimpleGuide] = useState(true);
  const [similar, setSimilar] = useState<CharterListing[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const hourlyRates = useMemo(
    () => [...(charter?.hourly_rates ?? [])].sort((a, b) => a.hours - b.hours),
    [charter]
  );
  const lowestHourlyRate = hourlyRates.length > 0 ? hourlyRates[0] : null;

  const availabilitySummary = useMemo(() => {
    if (!charter?.availability_blocks?.length) return 'Availability is confirmed after inquiry.';
    const booked = charter.availability_blocks.filter(b => b.status === 'booked').length;
    const hold = charter.availability_blocks.filter(b => b.status === 'hold' || b.status === 'option').length;
    return `${booked} booked window${booked === 1 ? '' : 's'} and ${hold} tentative hold${hold === 1 ? '' : 's'}`;
  }, [charter]);

  const seasonalRates = useMemo(() => charter?.seasonal_rates ?? [], [charter]);

  const [galleryImages, setGalleryImages] = useState<string[] | null>(initialGalleryImages);

  // Prefer the shared media-gallery system (MediaFile/ListingMediaAttachment)
  // over the legacy flat `images` array — the /media endpoint already falls
  // back to that array server-side when a charter has no attachments yet.
  // Server already fetched this for first paint; re-fetch client-side only
  // as a freshness refresh, not a blocking dependency.
  useEffect(() => {
    if (!id) return;
    fetch(apiUrl(`/charter/${id}/media`))
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.media) setGalleryImages(data.media.map((m: { url: string }) => mediaUrl(m.url))); })
      .catch(() => {});
  }, [id]);

  // Similar yachts — prefer same boat type, fall back to most recent
  useEffect(() => {
    if (!charter) return;
    const fetchSimilar = async () => {
      try {
        const res = await fetch(apiUrl('/charter?limit=12'));
        if (!res.ok) return;
        const data = await res.json();
        const all: CharterListing[] = (data.results || []).filter((c: CharterListing) => c.id !== charter.id);
        const sameType = all.filter(c => charter.boat_type && c.boat_type === charter.boat_type);
        const rest = all.filter(c => !sameType.includes(c));
        setSimilar([...sameType, ...rest].slice(0, 3));
      } catch { /* non-critical */ }
    };
    fetchSimilar();
  }, [charter]);

  const images = galleryImages ?? charter?.images?.map(img => mediaUrl(typeof img === 'string' ? img : img.url)) ?? [];

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

      {/* == INQUIRY MODAL ====================================================== */}
      {showInquiry && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-[#10214F]/80 backdrop-blur-sm" style={{ zIndex: 9999 }} onClick={() => setShowInquiry(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-[#10214F]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Request Charter</h3>
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
                    {submitting ? 'Sending...' : 'Send Request'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* == PAGE =============================================================== */}
      <div className="max-w-[1296px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back button */}
        <button onClick={() => router.push('/charter')} className="flex items-center gap-2 text-sm mb-6 text-[#10214F] hover:text-[#01BBDC] transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to charter listings
        </button>

        {/* == TITLE + RATE ====================================================== */}
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#10214F] tracking-tight mb-2" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
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
              {charter.embarkation_ports && charter.embarkation_ports.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Anchor size={15} className="text-[#01BBDC]" />
                  Departs: {charter.embarkation_ports.join(', ')}
                </span>
              )}
              {charter.disembarkation_ports && charter.disembarkation_ports.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Anchor size={15} className="text-[#01BBDC]" />
                  Arrives: {charter.disembarkation_ports.join(', ')}
                </span>
              )}
              {charter.one_way_allowed && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#10214F] bg-[#C9A84C]/20">
                  One-Way Available
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
              <span className="text-4xl md:text-5xl font-bold text-[#01BBDC]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                {primaryRate}
              </span>
              {charter.min_charter_days && (
                <span className="text-xs text-gray-400">Min {charter.min_charter_days} day{charter.min_charter_days !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>

        {/* == FEATURED IMAGE + BOOKING CARD ===================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-4">

          {/* Featured image -- 8 cols */}
          <div className="lg:col-span-8">
            <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-100" style={{ height: 500 }}>
              <img src={mediaUrl(images[activeImg])} alt={charter.title} onError={onImgError} className="w-full h-full object-cover" />
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

          {/* Booking card -- 4 cols */}
          <div className="lg:col-span-4">
            <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden sticky top-5">
              <div className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  {charter.charter_company_logo_url ? (
                    <img src={mediaUrl(charter.charter_company_logo_url)} alt={charter.charter_company_name || 'Charter company'}
                      className="w-20 h-20 rounded-full object-contain bg-gray-50 p-2 border border-gray-100"
                      onError={onImgError} />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                      <Anchor className="w-10 h-10 text-[#01BBDC]" />
                    </div>
                  )}
                </div>
                {charter.charter_company_name && (
                  <p style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 15, color: '#10214F', marginBottom: 4 }}>
                    {charter.charter_company_name}
                  </p>
                )}
                {charter.charter_company_phone && (
                  <a href={`tel:${charter.charter_company_phone}`} className="flex items-center justify-center gap-1.5 text-sm hover:text-[#01BBDC] transition-colors mb-2" style={{ color: '#10214F' }}>
                    <Phone size={13} /> {charter.charter_company_phone}
                  </a>
                )}
                {(charter.charter_company_city || charter.charter_company_state || charter.charter_company_country) && (
                  <p className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1 mb-3">
                    <MapPin size={10} />
                    {[charter.charter_company_city, charter.charter_company_state, charter.charter_company_country].filter(Boolean).join(', ')}
                  </p>
                )}
                {charter.charter_company_description && (
                  <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-4 text-left">
                    {charter.charter_company_description}
                  </p>
                )}
                {(charter.charter_company_facebook_url || charter.charter_company_instagram_url || charter.charter_company_twitter_url || charter.charter_company_linkedin_url) && (
                  <div className="flex items-center justify-center gap-3 mb-4">
                    {charter.charter_company_facebook_url && (
                      <a href={charter.charter_company_facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                        <Facebook size={16} className="text-[#1877F2]" />
                      </a>
                    )}
                    {charter.charter_company_instagram_url && (
                      <a href={charter.charter_company_instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                        <Instagram size={16} className="text-[#E4405F]" />
                      </a>
                    )}
                    {charter.charter_company_twitter_url && (
                      <a href={charter.charter_company_twitter_url} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                        <Twitter size={16} className="text-[#1DA1F2]" />
                      </a>
                    )}
                    {charter.charter_company_linkedin_url && (
                      <a href={charter.charter_company_linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                        <Linkedin size={16} className="text-[#0A66C2]" />
                      </a>
                    )}
                  </div>
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
                  {lowestHourlyRate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">From ({lowestHourlyRate.hours}hr)</span>
                      <span className="font-semibold text-[#10214F]">{formatRate(lowestHourlyRate.price, charter.currency)}</span>
                    </div>
                  )}
                  {!charter.day_rate && !charter.week_rate && !charter.half_day_rate && !lowestHourlyRate && (
                    <p className="text-sm text-gray-400">Contact for pricing</p>
                  )}
                </div>

                {/* Estimated total */}
                {estimatedTotal !== null && (
                  <div className="mb-4 rounded-xl bg-[#01BBDC]/8 px-3 py-2 text-sm text-left">
                    <span className="text-gray-600">Est. total: </span>
                    <span className="font-semibold text-[#10214F]">{charter.currency === 'USD' ? '$' : charter.currency}{estimatedTotal.toLocaleString()}</span>
                    <span className="text-gray-400"> ({charterDays}d)</span>
                  </div>
                )}

                {/* CTA */}
                {charter.booking_url ? (
                  <a href={charter.booking_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.08em', fontSize: 13 }}>
                    BOOK NOW <ExternalLink size={13} />
                  </a>
                ) : (
                  <button onClick={() => setShowInquiry(true)}
                    className="w-full py-3.5 rounded-2xl text-white font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.08em', fontSize: 13 }}>
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
                        style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.06em', border: '1.5px solid #10214F', color: '#10214F' }}>
                        VISIT WEBSITE
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* == PHOTO STRIP ======================================================= */}
        {images.length > 1 && (
          <div className="flex justify-center gap-3 mb-12 overflow-hidden">
            {images.slice(1, 5).map((src, idx) => {
              const isLast = idx === 3;
              const remaining = Math.max(images.length - 5, 0);
              return (
                <button key={idx} type="button"
                  className="relative flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100"
                  style={{ height: 160, width: 'calc(25% - 9px)' }}
                  onClick={() => setActiveImg(idx + 1)}>
                  <img src={src} alt={`${charter.title} photo ${idx + 2}`} onError={onImgError} className="w-full h-full object-cover" />
                  {isLast && remaining > 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xl font-bold" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>+{remaining}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* == SPECS + SIDEBAR ==================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">

          {/* Left -- 8 cols */}
          <div className="lg:col-span-8 space-y-10">

            {/* VESSEL SPECIFICATIONS */}
            <div>
              <SectionHeading>Vessel Specifications</SectionHeading>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                  {[
                    { icon: <Ruler size={20} className="text-[#01BBDC]" />,    label: 'Length',      value: charter.length_feet ? `${charter.length_feet} ft` : null },
                    { icon: <Ship size={20} className="text-[#01BBDC]" />,     label: 'Type',        value: charter.boat_type },
                    { icon: <Calendar size={20} className="text-[#01BBDC]" />, label: 'Year',        value: charter.year ? charter.year.toString() : null },
                    { icon: <Users size={20} className="text-[#01BBDC]" />,    label: 'Max Guests',  value: charter.max_guests ? charter.max_guests.toString() : null },
                    { icon: <Bed size={20} className="text-[#01BBDC]" />,      label: 'Cabins',      value: charter.cabins ? charter.cabins.toString() : null },
                    { icon: <Anchor size={20} className="text-[#01BBDC]" />,   label: 'Make / Model', value: [charter.make, charter.model].filter(Boolean).join(' ') || null },
                    { icon: <Zap size={20} className="text-[#01BBDC]" />,      label: 'Engines',         value: charter.engine_count ? `${charter.engine_count}x ${charter.engine_make ?? ''}`.trim() : null },
                    { icon: <Waves size={20} className="text-[#01BBDC]" />,    label: 'Fuel Type',       value: charter.fuel_type },
                    { icon: <Ship size={20} className="text-[#01BBDC]" />,     label: 'Max Speed',       value: charter.max_speed_knots ? `${charter.max_speed_knots} kts` : null },
                    { icon: <Ship size={20} className="text-[#01BBDC]" />,     label: 'Cruise Speed',    value: charter.cruising_speed_knots ? `${charter.cruising_speed_knots} kts` : null },
                    { icon: <Users size={20} className="text-[#01BBDC]" />,    label: 'Crew',            value: charter.crew_included ? `Included${charter.crew_count ? ` (${charter.crew_count})` : ''}` : 'Bareboat' },
                    { icon: <Bed size={20} className="text-[#01BBDC]" />,      label: 'Berths',          value: charter.berths ? charter.berths.toString() : null },
                    { icon: <Anchor size={20} className="text-[#01BBDC]" />,   label: 'Heads',           value: charter.heads ? charter.heads.toString() : null },
                    { icon: <Ruler size={20} className="text-[#01BBDC]" />,    label: 'Hull Material',   value: charter.hull_material },
                    { icon: <Ruler size={20} className="text-[#01BBDC]" />,    label: 'Beam',            value: charter.beam_feet ? `${charter.beam_feet} ft` : null },
                    { icon: <Ruler size={20} className="text-[#01BBDC]" />,    label: 'Draft',           value: charter.draft_feet ? `${charter.draft_feet} ft` : null },
                    { icon: <Calendar size={20} className="text-[#01BBDC]" />, label: 'Charter Duration', value: charter.min_charter_days || charter.max_charter_days ? [charter.min_charter_days ? `Min ${charter.min_charter_days}d` : null, charter.max_charter_days ? `Max ${charter.max_charter_days}d` : null].filter(Boolean).join(' · ') : null },
                  ].filter(s => s.value).map((spec, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(1,187,220,0.1)' }}>
                        {spec.icon}
                      </div>
                      <div>
                        <p className="text-xs text-[#10214F]/55 uppercase tracking-wide" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>{spec.label}</p>
                        <p className="font-semibold text-[#10214F] text-sm" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>{spec.value}</p>
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
                <div className="text-[15px] leading-[1.8] text-[#10214F] whitespace-pre-line" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {charter.description}
                </div>
              </div>
            )}

            {/* CREW — optional, only shown when at least one crew profile has been added */}
            {charter.crew_profiles && charter.crew_profiles.length > 0 && (
              <div>
                <SectionHeading>Meet the Crew</SectionHeading>
                <div className="grid sm:grid-cols-2 gap-4">
                  {charter.crew_profiles.map((crew, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="font-semibold text-[#10214F] text-sm" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>{crew.name}</p>
                      <p className="text-xs text-[#01BBDC] font-medium uppercase tracking-wide mb-2">{crew.role}</p>
                      {crew.bio && <p className="text-sm text-gray-600 leading-relaxed">{crew.bio}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FEATURES & EQUIPMENT — grouped by category */}
            {charter.amenities && charter.amenities.length > 0 && (
              <div>
                <SectionHeading>Features &amp; Equipment</SectionHeading>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                    {groupAmenities(charter.amenities).map(group => (
                      <div key={group.name}>
                        <p className="text-sm font-bold text-[#10214F] mb-2.5" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>{group.name}</p>
                        <div className="space-y-1.5">
                          {group.items.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-[#10214F]">
                              <Check size={13} className="text-[#01BBDC] flex-shrink-0" />
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AVAILABILITY */}
            <div>
              <div className="mb-5 pl-4 border-l-4 border-[#01BBDC] flex items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-[#10214F]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Availability</h3>
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
                    const moneyPrefix = (rate.currency || charter.currency || 'USD') === 'USD' ? '$' : (rate.currency || charter.currency || 'USD');
                    return (
                      <div key={rate.id ?? `${rate.season_name}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#10214F]">{rate.season_name}</p>
                            <p className="text-xs text-gray-500">{rate.start_date || 'Open start'}{rate.end_date ? ` to ${rate.end_date}` : ''}</p>
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

            {/* HOURLY RATES */}
            {hourlyRates.length > 0 && (
              <div>
                <SectionHeading>Hourly Rates</SectionHeading>
                <div className="flex flex-wrap gap-3">
                  {hourlyRates.map((rate, index) => (
                    <div key={rate.id ?? `${rate.hours}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 min-w-[140px]">
                      <p className="text-sm font-semibold text-[#10214F]">{rate.hours} hour{rate.hours === 1 ? '' : 's'}</p>
                      {rate.label && <p className="text-xs text-gray-500">{rate.label}</p>}
                      <p className="mt-1 text-sm font-medium text-gray-700">{formatRate(rate.price, charter.currency)}</p>
                      {rate.notes && <p className="mt-2 text-xs text-gray-500">{rate.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HOW CHARTERING WORKS */}
            <div className="bg-[#10214F] text-white rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#C9A84C] font-semibold mb-1">How chartering works</p>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Simple, not complicated</h2>
                </div>
                <button onClick={() => setShowSimpleGuide(v => !v)} className="text-sm text-white/70 hover:text-white flex-shrink-0">{showSimpleGuide ? 'Hide' : 'Show'}</button>
              </div>
              {showSimpleGuide && (
                <div className="grid md:grid-cols-3 gap-3 text-sm text-blue-100">
                  {[
                    { n: '1', title: 'Pick where you want to go', body: "Search by destination, dates, and group size." },
                    { n: '2', title: 'Ask for availability', body: "Most charters are confirmed by inquiry. We show booked and tentative holds." },
                    { n: '3', title: "Review what's included", body: "Some trips include crew and water toys. Others exclude taxes or gratuity." },
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

          {/* Right sidebar -- 4 cols */}
          <div className="lg:col-span-4 space-y-6">

            {/* CHARTER POLICY CARD */}
            {(charter.included_items?.length || charter.excluded_items?.length || charter.apa_percentage || charter.security_deposit || charter.tax_notes || charter.cancellation_policy) && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6">
                <h4 className="text-lg font-bold text-[#10214F] mb-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Charter Terms</h4>
                <div className="space-y-4 text-sm">
                  {charter.included_items?.length ? (
                    <div>
                      <p className="font-medium text-[#10214F] mb-1">Usually included</p>
                      <p className="text-gray-500">{charter.included_items.join(', ')}</p>
                    </div>
                  ) : null}
                  {charter.excluded_items?.length ? (
                    <div>
                      <p className="font-medium text-[#10214F] mb-1">Usually excluded</p>
                      <p className="text-gray-500">{charter.excluded_items.join(', ')}</p>
                    </div>
                  ) : null}
                  {(charter.apa_percentage || charter.security_deposit || charter.tax_notes || charter.cancellation_policy) && (
                    <div className="space-y-2 text-gray-600 border-t border-gray-100 pt-4">
                      {charter.apa_percentage ? <p><span className="font-medium text-[#10214F]">APA:</span> {charter.apa_percentage}% estimated advance provisioning.</p> : null}
                      {charter.security_deposit ? <p><span className="font-medium text-[#10214F]">Security deposit:</span> {charter.currency === 'USD' ? '$' : charter.currency}{charter.security_deposit.toLocaleString()}</p> : null}
                      {charter.tax_notes ? <p><span className="font-medium text-[#10214F]">Taxes:</span> {charter.tax_notes}</p> : null}
                      {charter.cancellation_policy ? <p><span className="font-medium text-[#10214F]">Cancellation:</span> {charter.cancellation_policy}</p> : null}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* == SIMILAR YACHTS ==================================================== */}
        {similar.length > 0 && (
          <div className="mb-12">
            <SectionHeading>Similar Yachts</SectionHeading>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {similar.map(s => {
                const img = mediaUrl(s.images?.length ? (typeof s.images[0] === 'string' ? s.images[0] : s.images[0].url) : null);
                const rate = s.day_rate
                  ? formatRate(s.day_rate, s.currency, 'day')
                  : s.week_rate ? formatRate(s.week_rate, s.currency, 'week') : null;
                return (
                  <Link key={s.id} href={`/charter/${s.id}`} className="group rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-[#01BBDC] hover:shadow-md transition-all">
                    <div className="relative h-44 bg-gray-100 overflow-hidden">
                      <img src={img} alt={s.title} onError={onImgError} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-[#10214F] text-sm truncate" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>{s.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {s.length_feet ? <span className="flex items-center gap-1"><Ruler size={11} /> {s.length_feet} ft</span> : null}
                        {s.max_guests ? <span className="flex items-center gap-1"><Users size={11} /> {s.max_guests} guests</span> : null}
                        {s.cabins ? <span className="flex items-center gap-1"><Bed size={11} /> {s.cabins} cabins</span> : null}
                      </div>
                      {rate && <p className="mt-2 text-sm font-bold text-[#01BBDC]">{rate}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* == FAQ =============================================================== */}
        <div className="mb-12 max-w-3xl">
          <SectionHeading>Frequently Asked Questions</SectionHeading>
          <div className="space-y-2">
            {CHARTER_FAQS.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-[#10214F]" style={{ fontFamily: 'Poppins, sans-serif' }}>{faq.q}</span>
                  <ChevronRight size={16} className={`text-[#01BBDC] flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 pl-4 border-l-4 border-[#01BBDC]">
      <h3 className="text-xl font-bold text-[#10214F]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
        {children}
      </h3>
    </div>
  );
}
