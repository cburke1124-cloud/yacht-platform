'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Anchor, Users, Ruler, Calendar,
  Mail, Phone, ChevronLeft, ChevronRight,
  Ship, Zap, Bed, Waves, Check, ExternalLink,
  Facebook, Instagram, Twitter, Linkedin, Sparkles, AlertTriangle,
  MessageCircle, Link2, Printer
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import AvailabilityCalendar, { type AvailabilityBlock } from '@/app/components/charter/AvailabilityCalendar';
import BookingRangeCalendar from '@/app/components/charter/BookingRangeCalendar';

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
  special_features?: string[];
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
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', phone: '', guests: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [charterStartDate, setCharterStartDate] = useState('');
  const [charterEndDate, setCharterEndDate] = useState('');
  const [showSimpleGuide, setShowSimpleGuide] = useState(true);
  const [similar, setSimilar] = useState<CharterListing[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Save / Compare / Share — mirrors the for-sale listing page, scoped to charter_id
  const [saved, setSaved] = useState(false);
  const [showComp, setShowComp] = useState(false);
  const [inComp, setInComp] = useState(false);
  const [comparisons, setComparisons] = useState<Array<{ id: number; name: string; listings?: unknown[] }>>([]);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Flag (not block — the charter company makes the final call) when the
  // requester's preferred dates overlap a published booked/hold/option
  // window, using the same availability data the calendar above renders.
  const dateConflict = useMemo(() => {
    if (!charterStartDate || !charterEndDate || !charter?.availability_blocks?.length) return false;
    const start = new Date(`${charterStartDate}T00:00:00`);
    const end = new Date(`${charterEndDate}T00:00:00`);
    return charter.availability_blocks.some(b => {
      if (!['booked', 'hold', 'option'].includes(b.status)) return false;
      const bStart = new Date(`${b.start_date}T00:00:00`);
      const bEnd = new Date(`${b.end_date}T00:00:00`);
      return start <= bEnd && end >= bStart;
    });
  }, [charterStartDate, charterEndDate, charter]);

  // Condensed above-the-fold facts — only ever shows what actually exists,
  // so a listing with just 2 populated fields doesn't look broken next to
  // one with a dozen.
  const quickFacts = useMemo(() => {
    if (!charter) return [];
    return [
      charter.max_guests ? { icon: <Users size={14} />, label: `${charter.max_guests} guests` } : null,
      charter.cabins ? { icon: <Bed size={14} />, label: `${charter.cabins} cabins` } : null,
      charter.length_feet ? { icon: <Ruler size={14} />, label: `${charter.length_feet} ft` } : null,
      charter.crew_included ? { icon: <Check size={14} />, label: charter.crew_count ? `Crew of ${charter.crew_count}` : 'Crew included' } : null,
    ].filter((f): f is { icon: React.ReactElement; label: string } => f !== null);
  }, [charter]);

  const topAmenities = useMemo(() => (charter?.amenities ?? []).slice(0, 4), [charter]);

  const vesselSpecs = useMemo(() => {
    if (!charter) return [];
    return [
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
    ].filter((s): s is { icon: React.ReactElement; label: string; value: string } => Boolean(s.value));
  }, [charter]);

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

  const checkSaved = async () => {
    const token = localStorage.getItem('token'); if (!token || !charter) return;
    try {
      const r = await fetch(apiUrl('/saved-listings'), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setSaved(d.some((i: { charter_id?: number }) => i.charter_id === charter.id)); }
    } catch { /* non-critical */ }
  };

  const loadComps = async () => {
    const token = localStorage.getItem('token'); if (!token || !charter) return;
    try {
      const r = await fetch(apiUrl('/comparisons'), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setComparisons(d);
        setInComp(d.some((c: { listings?: Array<{ id: number; item_type?: string }> }) => c.listings?.some(l => l.item_type === 'charter' && l.id === charter.id)));
      }
    } catch { /* non-critical */ }
  };

  useEffect(() => { checkSaved(); loadComps(); }, [charter]);

  const toggleSave = async () => {
    const token = localStorage.getItem('token'); if (!token) return alert('Please log in to save listings');
    if (!charter) return;
    if (saved) {
      await fetch(apiUrl(`/saved-listings/by-charter/${charter.id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setSaved(false);
    } else {
      await fetch(apiUrl('/saved-listings'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ charter_id: charter.id }) });
      setSaved(true);
    }
  };

  const addToComp = async (compId?: number) => {
    const token = localStorage.getItem('token'); if (!token) return alert('Please log in');
    if (!charter) return;
    if (compId) {
      await fetch(apiUrl(`/comparisons/${compId}/add-charter/${charter.id}`), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      setInComp(true); setShowComp(false); loadComps();
    } else {
      const name = prompt('Name your comparison:') || 'My Comparison';
      const r = await fetch(apiUrl('/comparisons'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (r.ok) {
        const d = await r.json();
        await fetch(apiUrl(`/comparisons/${d.id}/add-charter/${charter.id}`), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        router.push(`/comparison/${d.id}`);
      }
    }
  };

  const doShare = async (platform: string) => {
    if (!charter) return;
    const url = `${window.location.origin}/charter/${charter.id}`;
    const text = `${charter.title}${charter.week_rate ? ` — ${formatRate(charter.week_rate, charter.currency, 'week')}` : ''}`;
    const map: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      email: `mailto:?subject=${encodeURIComponent(charter.title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    };
    if (map[platform]) window.open(map[platform], '_blank', 'width=600,height=400');
    setShowShare(false);
  };

  const copyLink = async () => {
    if (!charter) return;
    await navigator.clipboard.writeText(`${window.location.origin}/charter/${charter.id}`);
    setCopied(true); setTimeout(() => { setCopied(false); setShowShare(false); }, 2000);
  };

  const images = galleryImages ?? charter?.images?.map(img => mediaUrl(typeof img === 'string' ? img : img.url)) ?? [];

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { guests, ...rest } = inquiryForm;
      await fetch(apiUrl('/charter/inquiry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charter_id: charter?.id,
          ...rest,
          guests: guests ? Number(guests) : undefined,
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

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">

      {/* == PAGE =============================================================== */}
      <div className="max-w-[1296px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back button */}
        <button onClick={() => router.push('/charter')} className="flex items-center gap-2 text-sm mb-6 text-[#10214F] hover:text-[#01BBDC] transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to charter listings
        </button>

        <div id="overview" className="scroll-mt-32" />

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

        {/* == QUICK FACTS + AMENITY STRIP ======================================= */}
        {(quickFacts.length > 0 || topAmenities.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {quickFacts.map((fact, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#10214F] bg-gray-100">
                {fact.icon} {fact.label}
              </span>
            ))}
            {topAmenities.map((a, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#01BBDC] bg-[#01BBDC]/10">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* == SPECIAL FEATURES CALLOUT =========================================== */}
        {charter.special_features && charter.special_features.length > 0 && (
          <div className="mb-6 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/8 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#a1852f] mb-2.5">
              <Sparkles size={14} /> Special Features
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {charter.special_features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#10214F]">
                  <span className="text-[#C9A84C] mt-0.5">•</span> {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* == FEATURED IMAGE + BOOKING CARD ===================================== */}
        <div id="photos" className="scroll-mt-32 grid grid-cols-1 lg:grid-cols-12 gap-6 mb-4">

          {/* Featured image -- 8 cols */}
          <div className="lg:col-span-8 space-y-3">
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

            {/* Photo strip -- 3 thumbnails, fits beneath the featured image */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-hidden">
                {images.slice(1, 4).map((src, idx) => {
                  const isLast = idx === 2;
                  const remaining = Math.max(images.length - 4, 0);
                  return (
                    <button key={idx} type="button"
                      className="relative flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100"
                      style={{ height: 130, width: 'calc(33.333% - 8px)' }}
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
          </div>

          {/* Booking card -- 4 cols */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden sticky top-5">
              {/* ── Company section — single unified block, no separate broker tier
                    (charter listings don't have an individual sales-rep concept the
                    way for-sale listings do, just the one charter company). ── */}
              <div className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  {charter.charter_company_logo_url ? (
                    <img src={mediaUrl(charter.charter_company_logo_url)} alt={charter.charter_company_name || 'Charter company'}
                      className="w-24 h-24 rounded-full object-contain bg-gray-50 p-2 border border-gray-100 shadow-sm"
                      onError={onImgError} />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                      <Anchor className="w-10 h-10 text-[#01BBDC]" />
                    </div>
                  )}
                </div>
                {charter.charter_company_name && (
                  charter.charter_company_slug ? (
                    <Link href={`/dealers/${charter.charter_company_slug}`} className="hover:underline"
                      style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 15, color: '#10214F', marginBottom: 2, display: 'block' }}>
                      {charter.charter_company_name}
                    </Link>
                  ) : (
                    <p style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 15, color: '#10214F', marginBottom: 2 }}>
                      {charter.charter_company_name}
                    </p>
                  )
                )}
                {(charter.charter_company_city || charter.charter_company_state || charter.charter_company_country) && (
                  <p className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1 mb-3">
                    <MapPin size={10} />
                    {[charter.charter_company_city, charter.charter_company_state, charter.charter_company_country].filter(Boolean).join(', ')}
                  </p>
                )}
                {charter.charter_company_description && (
                  <p className="text-center text-xs text-gray-500 leading-relaxed mb-3 line-clamp-4">
                    {charter.charter_company_description}
                  </p>
                )}
                {charter.charter_company_phone && (
                  <a href={`tel:${charter.charter_company_phone}`} className="flex items-center justify-center gap-1.5 text-sm hover:text-[#01BBDC] transition-colors mb-2" style={{ color: '#10214F' }}>
                    <Phone size={13} /> {charter.charter_company_phone}
                  </a>
                )}
                {charter.charter_company_email && (
                  <a href={`mailto:${charter.charter_company_email}`}
                    className="flex items-center justify-center gap-1.5 text-sm hover:text-[#01BBDC] transition-colors mb-3"
                    style={{ color: '#10214F' }}>
                    <Mail size={13} /> {charter.charter_company_email}
                  </a>
                )}
                {(charter.charter_company_facebook_url || charter.charter_company_instagram_url || charter.charter_company_twitter_url || charter.charter_company_linkedin_url) && (
                  <div className="flex items-center justify-center gap-3 mb-5">
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

                {/* CTA — the "message" action: books directly if a booking_url exists,
                    otherwise scrolls to the inquiry form further down the page */}
                {charter.booking_url ? (
                  <a href={charter.booking_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.08em', fontSize: 13 }}>
                    BOOK NOW <ExternalLink size={13} />
                  </a>
                ) : (
                  <button onClick={() => scrollToSection('inquiry')}
                    className="w-full py-3.5 rounded-2xl text-white font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.08em', fontSize: 13 }}>
                    REQUEST CHARTER
                  </button>
                )}

                {charter.charter_company_website && (
                  <a href={charter.charter_company_website.startsWith('http') ? charter.charter_company_website : `https://${charter.charter_company_website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block w-full py-2.5 rounded-xl text-center text-xs font-semibold transition-all hover:opacity-80 mt-2"
                    style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.06em', border: '1.5px solid #10214F', color: '#10214F' }}>
                    VISIT WEBSITE
                  </a>
                )}
              </div>

              {/* ── Action buttons row: Save / Compare / Share ── */}
              <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200 bg-gray-50 rounded-b-3xl">
                <button onClick={toggleSave}
                  className="flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors"
                  style={{ color: '#10214F' }}>
                  {saved ? 'Saved' : 'Save'}
                </button>
                <div className="relative">
                  <button onClick={() => setShowComp(!showComp)}
                    className="w-full flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors"
                    style={{ color: '#10214F' }}>
                    {inComp ? 'In Compare' : 'Compare'}
                  </button>
                  {showComp && (
                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-white rounded-2xl border border-gray-200 z-20 max-h-52 overflow-y-auto shadow-lg">
                      <div className="p-2">
                        <button onClick={() => addToComp()} className="w-full px-4 py-3 hover:bg-gray-50 rounded-xl text-left text-sm font-semibold text-[#01BBDC]">+ New Comparison</button>
                        {comparisons.map(c => (
                          <button key={c.id} onClick={() => addToComp(c.id)} className="w-full px-4 py-3 hover:bg-gray-50 rounded-xl text-left text-sm text-gray-700">
                            {c.name} ({c.listings?.length || 0})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => setShowShare(!showShare)}
                    className="w-full flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors" style={{ color: '#10214F' }}>
                    Share
                  </button>
                  {showShare && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200 z-50 shadow-lg">
                      <div className="p-2 space-y-1">
                        {[
                          { icon: <Facebook size={16} className="text-[#1877F2]" />,      label: 'Facebook',  p: 'facebook' },
                          { icon: <Twitter size={16} className="text-[#1DA1F2]" />,       label: 'Twitter',   p: 'twitter'  },
                          { icon: <Linkedin size={16} className="text-[#0A66C2]" />,      label: 'LinkedIn',  p: 'linkedin' },
                          { icon: <MessageCircle size={16} className="text-[#25D366]" />, label: 'WhatsApp',  p: 'whatsapp' },
                          { icon: <Mail size={16} className="text-gray-500" />,           label: 'Email',     p: 'email'    },
                        ].map(s => (
                          <button key={s.p} onClick={() => doShare(s.p)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl text-sm text-gray-700 transition-colors">
                            {s.icon} {s.label}
                          </button>
                        ))}
                        <div className="border-t border-gray-100 my-1" />
                        <button onClick={() => { window.print(); setShowShare(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl text-sm text-gray-700 transition-colors">
                          <Printer size={16} className="text-gray-500" /> Print
                        </button>
                        <button onClick={copyLink}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl text-sm text-gray-700 transition-colors">
                          <Link2 size={16} className="text-gray-500" /> {copied ? '✓ Copied!' : 'Copy Link'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* == INLINE INQUIRY FORM — moved up here, right under the company card.
                Always present (not a modal) so the availability calendar and date
                selection are available on every listing, whether or not it has a
                direct booking_url — this is the one place across the site where a
                visitor picks their preferred charter dates before contacting the
                charter company. The calendar leads the card, single month, click to
                pick a range — a hotel-booking feel rather than a form field. */}
            <div id="inquiry" className="scroll-mt-32 rounded-3xl border border-gray-200 bg-white p-6">
              <h4 className="text-lg font-bold text-[#10214F] mb-1" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Inquire About This Yacht</h4>
              <p className="text-sm text-gray-500 mb-4">Pick your preferred dates and the charter company will confirm availability.</p>
              {submitted ? (
                <div className="text-center py-6">
                  <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-bold text-[#10214F] mb-1">Request sent!</p>
                  <p className="text-sm text-gray-400">The charter company will be in touch shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleInquiry} className="space-y-3">
                  <BookingRangeCalendar
                    blocks={charter.availability_blocks ?? []}
                    startDate={charterStartDate}
                    endDate={charterEndDate}
                    onChange={(start, end) => { setCharterStartDate(start); setCharterEndDate(end); }}
                  />
                  {dateConflict && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      These dates overlap a booked or tentatively held window — you can still send your inquiry, but confirm with the charter company before finalizing plans.
                    </div>
                  )}
                  <input required placeholder="Your name" value={inquiryForm.name} onChange={e => setInquiryForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                  <input required type="email" placeholder="Email address" value={inquiryForm.email} onChange={e => setInquiryForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Phone (optional)" value={inquiryForm.phone} onChange={e => setInquiryForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                    <input type="number" min={1} placeholder="Guests" value={inquiryForm.guests} onChange={e => setInquiryForm(f => ({ ...f, guests: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                  </div>
                  <textarea required rows={4} placeholder="Tell them about your trip..." value={inquiryForm.message} onChange={e => setInquiryForm(f => ({ ...f, message: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] resize-none" />
                  <button type="submit" disabled={submitting} className="w-full bg-[#01BBDC] hover:bg-[#00a5c4] text-white py-3.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                    {submitting ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </form>
              )}
            </div>

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

        {/* == VESSEL SPECIFICATIONS + KEY FEATURES + DESCRIPTION ================= */}
        {/* Inquire card + Charter Policy card now live up in the booking-card
            column instead of here — moved up closer to the company card. */}
        <div className="mb-10 space-y-10">

            {/* VESSEL SPECIFICATIONS — grid column count adapts to how much data
                actually exists, so a thin listing (a handful of specs) doesn't
                sit inside a grid built for a dozen and look like it's missing rows. */}
            <div id="specs" className="scroll-mt-32">
              <SectionHeading>Vessel Specifications</SectionHeading>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <div className={`grid gap-x-6 gap-y-5 ${vesselSpecs.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {vesselSpecs.map((spec, i) => (
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
              <div id="amenities" className="scroll-mt-32">
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
            <div id="availability" className="scroll-mt-32">
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

            {/* SEASONAL + HOURLY RATES */}
            {(seasonalRates.length > 0 || hourlyRates.length > 0) && (
              <div id="rates" className="scroll-mt-32 space-y-8">

                {/* SEASONAL PRICING — compact table instead of a stacked card list,
                    so a handful of seasons reads at a glance rather than scrolling. */}
                {seasonalRates.length > 0 && (
                  <div>
                    <SectionHeading>Seasonal Pricing</SectionHeading>
                    <div className="rounded-2xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Season</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Dates</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Half Day</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Day</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Week</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {seasonalRates.map((rate, index) => {
                            const moneyPrefix = (rate.currency || charter.currency || 'USD') === 'USD' ? '$' : (rate.currency || charter.currency || 'USD');
                            return (
                              <tr key={rate.id ?? `${rate.season_name}-${index}`} className="align-top">
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-[#10214F]">{rate.season_name}</p>
                                  {rate.min_charter_days ? <p className="text-xs text-gray-400 mt-0.5">Min {rate.min_charter_days} days</p> : null}
                                  {rate.notes ? <p className="text-xs text-gray-400 mt-0.5">{rate.notes}</p> : null}
                                </td>
                                <td className="px-4 py-3 text-gray-500 text-xs">{rate.start_date || 'Open start'}{rate.end_date ? ` – ${rate.end_date}` : ''}</td>
                                <td className="px-4 py-3 text-right font-medium text-[#10214F]">{rate.half_day_rate ? `${moneyPrefix}${rate.half_day_rate.toLocaleString()}` : '—'}</td>
                                <td className="px-4 py-3 text-right font-medium text-[#10214F]">{rate.day_rate ? `${moneyPrefix}${rate.day_rate.toLocaleString()}` : '—'}</td>
                                <td className="px-4 py-3 text-right font-medium text-[#10214F]">{rate.week_rate ? `${moneyPrefix}${rate.week_rate.toLocaleString()}` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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

      {/* == STICKY MOBILE CTA BAR ============================================== */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3" style={{ boxShadow: '0 -4px 12px rgba(0,0,0,0.06)' }}>
        <div className="min-w-0">
          {primaryRate ? (
            <span className="text-lg font-bold text-[#01BBDC] truncate block" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>{primaryRate}</span>
          ) : lowestHourlyRate ? (
            <span className="text-sm font-bold text-[#01BBDC] truncate block">From {formatRate(lowestHourlyRate.price, charter.currency)}</span>
          ) : (
            <span className="text-sm text-gray-400">Contact for pricing</span>
          )}
        </div>
        <button
          onClick={() => (charter.booking_url ? window.open(charter.booking_url, '_blank') : scrollToSection('inquiry'))}
          className="flex-shrink-0 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.05em' }}
        >
          {charter.booking_url ? 'Book Now' : 'Send Inquiry'}
        </button>
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
