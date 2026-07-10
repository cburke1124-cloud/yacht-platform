'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Heart, Download, MapPin, Calendar, ArrowLeft, Mail,
  Ship, Share2, Facebook, Twitter, Linkedin, Instagram,
  MessageCircle, Link2, Printer, Plus, Check, Phone,
  X, ChevronLeft, ChevronRight, Building2, User,
  ExternalLink, Globe, Users, Wrench,
  Bed, Gauge, Fuel, Waves, Ruler,
  Zap, Wind, ZoomIn, ZoomOut, FileText, PlayCircle, Edit
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { API_ROOT, mediaUrl, FALLBACK_IMAGE } from '@/app/lib/apiRoot';
import { detectLocaleDefaults, fmtLength, fmtCapacity, fmtWeight, fmtFuelBurn } from '@/app/lib/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListingImage {
  id: number; url: string; thumbnail_url?: string;
  is_primary: boolean; display_order?: number; caption?: string;
}

interface Listing {
  id: number; user_id?: number; created_by_user_id?: number; title: string; price?: number; currency?: string;
  year?: number; make?: string; model?: string; bin?: string;
  boat_type?: string; condition?: string; status?: string;
  length_feet?: number; beam_feet?: number; draft_feet?: number;
  hull_material?: string; hull_type?: string;
  engine_make?: string; engine_model?: string; engine_type?: string;
  engine_count?: number; engine_hours?: number;
  fuel_type?: string; max_speed_knots?: number; cruising_speed_knots?: number;
  fuel_capacity_gallons?: number; water_capacity_gallons?: number;
  cabins?: number; berths?: number; heads?: number;
  city?: string; state?: string; country?: string;
  description?: string; features?: string;
  feature_bullets?: string[];
  additional_specs?: {
    displacement_lbs?: number;
    dry_weight_lbs?: number;
    bridge_clearance_feet?: number;
    deadrise_degrees?: number;
    cruising_range_nm?: number;
    fuel_burn_gph?: number;
    holding_tank_gallons?: number;
  };
  youtube_video_url?: string; vimeo_video_url?: string; video_tour_url?: string;
  has_video?: boolean; featured?: boolean; published_at?: string;
  previous_owners?: number;
  additional_engines?: Array<{
    make?: string;
    model?: string;
    type?: string;
    hours?: number;
    horsepower?: number;
    notes?: string;
  }>;
  generators?: Array<{
    brand?: string;
    model?: string;
    hours?: number;
    kw?: number;
    notes?: string;
  }>;
  images?: ListingImage[];
  latitude?: number; longitude?: number;
}

interface MediaItem {
  id: number; url: string; file_type: 'image' | 'video' | 'pdf';
  thumbnail_url?: string; is_primary?: boolean; display_order?: number; caption?: string; alt_text?: string;
}

interface ContactInfo {
  dealer: {
    id?: number; name?: string; company_name?: string; email?: string; phone?: string;
    logo_url?: string; slug?: string; address?: string; city?: string; state?: string;
    country?: string; website?: string; description?: string;
    facebook_url?: string; instagram_url?: string; twitter_url?: string; linkedin_url?: string;
    is_demo?: boolean;
  };
  sales_contact?: {
    id?: number; name?: string; title?: string; email?: string;
    phone?: string; photo_url?: string; bio?: string;
  } | null;
}

interface FinResult {
  monthly_payment: number; down_payment: number; loan_amount: number;
  total_interest: number; total_cost: number;
}

interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt    = (n: number)   => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function formatPhone(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

// ─── Components ───────────────────────────────────────────────────────────────

function SpecRow({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-gray-200/60 last:border-0">
      <span className="text-sm text-[#10214F]/55 font-poppins">{label}</span>
      {href ? (
        <Link href={href} className="text-sm text-[#01BBDC] text-right font-semibold font-poppins hover:underline">
          {value}
        </Link>
      ) : (
        <span className="text-sm text-[#10214F] text-right font-semibold font-poppins">{value}</span>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 pl-4 border-l-4 border-[#01BBDC]">
      <h3 className="text-xl font-bold text-[#10214F] font-bahnschrift">
        {children}
      </h3>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CatalogLink {
  href: string;
  label: string;
}

interface ListingDetailClientProps {
  initialListing?: Listing | null;
  initialMedia?: MediaItem[];
  initialContact?: ContactInfo | null;
  makeLink?: CatalogLink | null;
  boatTypeLink?: CatalogLink | null;
}

export default function ListingDetailClient({
  initialListing = null,
  initialMedia = [],
  initialContact = null,
  makeLink = null,
  boatTypeLink = null,
}: ListingDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const id     = params?.id as string;

  const [listing,      setListing]      = useState<Listing | null>(initialListing);
  const [media,        setMedia]        = useState<MediaItem[]>(initialMedia);
  const [contact,      setContact]      = useState<ContactInfo | null>(initialContact);
  const [loading,      setLoading]      = useState(!initialListing);
  const [currencies,   setCurrencies]   = useState<CurrencyRates | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [displayUnits, setDisplayUnits] = useState<'imperial' | 'metric'>('imperial');

  // gallery lightbox
  const [lightbox,     setLightbox]     = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  // actions
  const [saved,        setSaved]        = useState(false);
  const [inComp,       setInComp]       = useState(false);
  const [comparisons,  setComparisons]  = useState<any[]>([]);
  const [showComp,     setShowComp]     = useState(false);
  const [showShare,    setShowShare]    = useState(false);
  const [copied,       setCopied]       = useState(false);

  // finance
  const [finIn,  setFinIn]  = useState({ down_payment_percent: 20, interest_rate: 6.49, term_years: 20 });
  const [finOut, setFinOut] = useState<FinResult | null>(null);
  const [finBusy,setFinBusy]= useState(false);

  // message modal
  const [showMsg, setShowMsg] = useState(false);
  const [msgForm, setMsgForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgDone, setMsgDone] = useState(false);

  // editor bar state
  const [me, setMe] = useState<{ id: number; user_type: string } | null>(null);
  const [approvingStatus, setApprovingStatus] = useState(false);
  const [navContext, setNavContext] = useState<{ ids: number[]; filter: string } | null>(null);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // ── fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || id === 'undefined') return;
    setLoading(true);
    Promise.all([fetchListing(), fetchMedia(), fetchContact(), checkSaved(), loadComps(), fetchCurrencies()])
      .finally(() => setLoading(false));
  }, [id]);

  // ── locale / unit preference (runs once on mount) ─────────────────────────

  useEffect(() => {
    const savedCurrency = localStorage.getItem('preferredCurrency');
    const savedUnits = localStorage.getItem('preferredUnits') as 'imperial' | 'metric' | null;
    if (savedCurrency || savedUnits) {
      if (savedCurrency) setDisplayCurrency(savedCurrency);
      if (savedUnits) setDisplayUnits(savedUnits);
    } else {
      const { currency, units } = detectLocaleDefaults();
      setDisplayCurrency(currency);
      setDisplayUnits(units);
      localStorage.setItem('preferredCurrency', currency);
      localStorage.setItem('preferredUnits', units);
    }
  }, []);

  async function fetchListing() {
    try { const r = await fetch(`${API_ROOT}/listings/${id}`); if (r.ok) setListing(await r.json()); } catch {}
  }
  async function fetchMedia() {
    try { const r = await fetch(`${API_ROOT}/listings/${id}/media`); if (r.ok) { const d = await r.json(); setMedia(d.media || []); } } catch {}
  }
  async function fetchContact() {
    try { const r = await fetch(`${API_ROOT}/listings/${id}/contact-info`); if (r.ok) setContact(await r.json()); } catch {}
  }
  async function checkSaved() {
    const token = localStorage.getItem('token'); if (!token) return;
    try { const r = await fetch(`${API_ROOT}/saved-listings`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) { const d = await r.json(); setSaved(d.some((i: any) => i.listing_id === Number(id))); } } catch {}
  }
  async function loadComps() {
    const token = localStorage.getItem('token'); if (!token) return;
    try { const r = await fetch(`${API_ROOT}/comparisons`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) { const d = await r.json(); setComparisons(d); setInComp(d.some((c: any) => c.listings?.some((l: any) => l.id === Number(id)))); } } catch {}
  }
  async function fetchCurrencies() {
    try { const r = await fetch(`${API_ROOT}/currencies/rates`); if (r.ok) { const d = await r.json(); setCurrencies(d); } } catch {}
  }

  // ── currency conversion ────────────────────────────────────────────────────

  function convertPrice(amount: number | undefined, fromCurrency: string): number {
    if (!amount || !currencies || fromCurrency === displayCurrency) return amount || 0;

    const fromRate = fromCurrency === 'USD' ? 1 : (currencies.rates[fromCurrency] || 1);
    const toRate = displayCurrency === 'USD' ? 1 : (currencies.rates[displayCurrency] || 1);

    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
  }

  const displayPrice = listing?.price ? convertPrice(listing.price, listing.currency || 'USD') : null;

  // ── actions ────────────────────────────────────────────────────────────────

  async function toggleSave() {
    const token = localStorage.getItem('token'); if (!token) return alert('Please log in to save listings');
    if (saved) {
      const r = await fetch(`${API_ROOT}/saved-listings`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json(); const item = d.find((i: any) => i.listing_id === Number(id));
      if (item) { await fetch(`${API_ROOT}/saved-listings/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); setSaved(false); }
    } else {
      await fetch(`${API_ROOT}/saved-listings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ listing_id: Number(id) }) });
      setSaved(true);
    }
  }

  async function addToComp(compId?: number) {
    const token = localStorage.getItem('token'); if (!token) return alert('Please log in');
    if (compId) {
      await fetch(`${API_ROOT}/comparisons/${compId}/listings`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: Number(id) }) });
      setInComp(true); setShowComp(false); loadComps();
    } else {
      const name = prompt('Name your comparison:') || 'My Comparison';
      const r = await fetch(`${API_ROOT}/comparisons`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, listing_ids: [Number(id)] }) });
      if (r.ok) { const d = await r.json(); router.push(`/comparisons/${d.id}`); }
    }
  }

  async function doShare(platform: string) {
    const url = `${window.location.origin}/listings/${id}`;
    const text = listing ? `${listing.title}${listing.price ? ` — $${fmt(listing.price)}` : ''}` : '';
    try { await fetch(`${API_ROOT}/listings/${id}/track-share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) }); } catch {}
    const map: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter:  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      email:    `mailto:?subject=${encodeURIComponent(listing?.title || 'Yacht')}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    };
    if (platform === 'print') { window.print(); setShowShare(false); return; }
    if (map[platform]) window.open(map[platform], '_blank', 'width=600,height=400');
    setShowShare(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/listings/${id}`);
    setCopied(true); setTimeout(() => { setCopied(false); setShowShare(false); }, 2000);
  }

  async function calcFinance() {
    if (!listing?.price) return; setFinBusy(true);
    try { const r = await fetch(`${API_ROOT}/listings/${id}/calculate-financing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finIn) }); if (r.ok) setFinOut(await r.json()); } catch {}
    setFinBusy(false);
  }

  useEffect(() => {
    if (listing?.price) calcFinance();
  }, [listing?.price, finIn.down_payment_percent, finIn.interest_rate, finIn.term_years]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault(); setMsgBusy(true);
    try {
      const token   = localStorage.getItem('token');
      const sc      = contact?.sales_contact;
      const dealer  = contact?.dealer;
      const recipId = sc?.id ?? dealer?.id ?? listing?.created_by_user_id ?? listing?.user_id;
      let ok = false;
      if (token && recipId) {
        // Logged-in users: create a message
        const r = await fetch(`${API_ROOT}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: `Inquiry about: ${listing?.title || 'Listing #' + id}`, body: msgForm.message, message_type: 'inquiry', recipient_id: recipId, listing_id: Number(id) }) });
        ok = r.ok;
      } else {
        // Anonymous users: create an inquiry
        const r = await fetch(`${API_ROOT}/listings/${id}/inquiry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_name: msgForm.name, sender_email: msgForm.email, sender_phone: msgForm.phone || undefined, message: msgForm.message }) });
        ok = r.ok;
      }
      if (ok) {
        setMsgDone(true); setMsgForm({ name: '', email: '', phone: '', message: '' });
      } else {
        alert('Something went wrong sending your message. Please try again.');
      }
    } catch {
      alert('Unable to send message. Please check your connection and try again.');
    }
    setMsgBusy(false);
  }

  async function approveListing() {
    const token = localStorage.getItem('token');
    if (!token) return;
    setApprovingStatus(true);
    try {
      const r = await fetch(`${API_ROOT}/listings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'active' }),
      });
      if (r.ok) setListing(prev => prev ? { ...prev, status: 'active' } : prev);
      else {
        const err = await r.json().catch(() => ({}));
        alert(err?.detail || 'Failed to approve listing');
      }
    } finally {
      setApprovingStatus(false);
    }
  }

  // ── assemble media ─────────────────────────────────────────────────────────

  const visualItems: MediaItem[] = media.length > 0
    ? media.filter(m => m.file_type === 'image' || m.file_type === 'video')
    : (listing?.images || []).map(img => ({ id: img.id, url: img.url, thumbnail_url: img.thumbnail_url, file_type: 'image' as const, is_primary: img.is_primary, display_order: img.display_order }));

  const pdfItems: MediaItem[] = media.length > 0
    ? media.filter(m => m.file_type === 'pdf')
    : [];

  const galleryItems: MediaItem[] = [...visualItems].sort((a, b) => {
    const aPrimary = a.is_primary ? 0 : 1;
    const bPrimary = b.is_primary ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    const aOrder = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.display_order ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
  const imageLightboxItems: MediaItem[] = galleryItems.filter(i => i.file_type === 'image');
  const featuredMedia = galleryItems[0] || null;
  const galleryMedia = galleryItems.slice(1);

  const sc     = contact?.sales_contact;
  const dealer = contact?.dealer;
  const primaryPhone = sc?.phone || dealer?.phone;
  const recipientName = sc?.name || dealer?.company_name || dealer?.name || 'Seller';

  // Construct location string
  const locationParts = [listing?.city, listing?.state, listing?.country].filter(Boolean);
  const locationString = locationParts.join(', ');

  // Parse key features — only use explicit bullet-point lines from features fallback
  const keyFeatures = listing?.feature_bullets?.length
    ? listing.feature_bullets.filter(Boolean).slice(0, 8)
    : (listing?.features
      ? listing.features
          .replace(/<[^>]*>/g, '\n')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('- ') || line.startsWith('• '))
          .map(line => line.replace(/^[-•]\s+/, '').trim())
          .filter(line => line.length > 0 && line.length < 150)
          .slice(0, 8)
      : []);

  const isHtmlDesc      = /<\/?[a-z][\s\S]*>/i.test(listing?.description || '');
  const descriptionHtml = listing?.description && isHtmlDesc
    ? DOMPurify.sanitize(listing.description)
    : '';
  const descParagraphs  = listing?.description && !isHtmlDesc
    ? listing.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    if (lightbox !== null) {
      setLightboxZoom(1);
      // Scroll active thumbnail into view
      const strip = thumbStripRef.current;
      if (strip && lightbox !== null) {
        const thumb = strip.children[lightbox] as HTMLElement | undefined;
        if (thumb) {
          const stripLeft = strip.scrollLeft;
          const stripRight = stripLeft + strip.clientWidth;
          const thumbLeft = thumb.offsetLeft;
          const thumbRight = thumbLeft + thumb.offsetWidth;
          if (thumbLeft < stripLeft || thumbRight > stripRight) {
            strip.scrollTo({ left: thumbLeft - strip.clientWidth / 2 + thumb.offsetWidth / 2, behavior: 'smooth' });
          }
        }
      }
    }
  }, [lightbox]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    try {
      const stored = localStorage.getItem('dashboardListingNav');
      if (stored) setNavContext(JSON.parse(stored));
    } catch {}
    if (!token) return;
    fetch(`${API_ROOT}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => setMe(data))
      .catch(() => {});
  }, []);

  // ── loading / not found ────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-14 h-14 rounded-full border-4 border-t-[#01BBDC] border-[#01BBDC]/20 animate-spin" />
    </div>
  );
  if (!listing) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4 text-[#10214F]">Listing not found</h2>
        <button onClick={() => router.back()} className="text-[#01BBDC] hover:underline font-medium">
          ← Back to listings
        </button>
      </div>
    </div>
  );

  // ── editor bar computed values ──────────────────────────────────────────────

  const canEdit = !!(me && listing && (
    ['admin', 'dealer', 'salesman'].includes(me.user_type) ||
    me.id === listing.user_id ||
    me.id === listing.created_by_user_id
  ));

  const listingStatusConfig: Record<string, { label: string; colorClass: string }> = {
    active:          { label: 'Active',            colorClass: 'bg-green-100 text-green-800' },
    draft:           { label: 'Draft',             colorClass: 'bg-gray-200 text-gray-700' },
    awaiting_review: { label: 'Awaiting Approval', colorClass: 'bg-orange-100 text-orange-800' },
    sold:            { label: 'Sold',              colorClass: 'bg-blue-100 text-blue-800' },
    archived:        { label: 'Archived',          colorClass: 'bg-red-100 text-red-700' },
  };

  const currentNavIndex = navContext ? navContext.ids.indexOf(Number(id)) : -1;
  const prevListingId   = currentNavIndex > 0 ? navContext!.ids[currentNavIndex - 1] : null;
  const nextListingId   = currentNavIndex >= 0 && currentNavIndex < navContext!.ids.length - 1
    ? navContext!.ids[currentNavIndex + 1] : null;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">

      {/* ══ LIGHTBOX ════════════════════════════════════════════════════════ */}
      {lightbox !== null && imageLightboxItems.length > 0 && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center"
          style={{ zIndex: 9999 }}
          onClick={() => setLightbox(null)}>
          {/* z-10 on all controls keeps them above the transform-scaled image */}
          <button className="absolute z-10 top-6 right-6 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all" aria-label="Close">
            <X size={22} className="text-white" />
          </button>
          <div className="absolute z-10 top-6 right-20 flex items-center gap-2">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setLightboxZoom(z => Math.max(1, z - 0.25)); }}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all"
              aria-label="Zoom out">
              <ZoomOut size={18} className="text-white" />
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setLightboxZoom(z => Math.min(3, z + 0.25)); }}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all"
              aria-label="Zoom in">
              <ZoomIn size={18} className="text-white" />
            </button>
          </div>
          <button onClick={e => { e.stopPropagation(); setLightbox(i => ((i ?? 0) - 1 + imageLightboxItems.length) % imageLightboxItems.length); }}
            className="absolute z-10 left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <ChevronLeft size={28} className="text-white" />
          </button>
          <img src={mediaUrl(imageLightboxItems[lightbox]?.url) || FALLBACK_IMAGE} className="relative z-0 max-h-[90vh] max-w-[90vw] object-contain rounded-2xl transition-transform duration-200"
            style={{ transform: `scale(${lightboxZoom})` }}
            alt={imageLightboxItems[lightbox]?.alt_text || imageLightboxItems[lightbox]?.caption || `${listing.title} photo ${(lightbox ?? 0) + 1}`}
            onClick={e => e.stopPropagation()} />
          <button onClick={e => { e.stopPropagation(); setLightbox(i => ((i ?? 0) + 1) % imageLightboxItems.length); }}
            className="absolute z-10 right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <ChevronRight size={28} className="text-white" />
          </button>
          <div className="absolute z-10 bottom-6 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white text-sm">
            {(lightbox ?? 0) + 1} / {imageLightboxItems.length}
          </div>
          {/* Thumbnail strip with scroll arrows */}
          <div className="absolute z-10 left-1/2 -translate-x-1/2 bottom-20 w-[90vw] max-w-5xl flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Scroll thumbnails left"
              onClick={e => { e.stopPropagation(); thumbStripRef.current?.scrollBy({ left: -320, behavior: 'smooth' }); }}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition"
            >
              <ChevronLeft size={18} className="text-white" />
            </button>
            <div ref={thumbStripRef} className="flex-1 overflow-x-hidden">
              <div className="flex gap-2">
                {imageLightboxItems.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={e => { e.stopPropagation(); setLightbox(idx); }}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${idx === lightbox ? 'border-[#01BBDC]' : 'border-white/20'}`}
                  >
                    <img
                      src={mediaUrl(item.thumbnail_url || item.url)}
                      alt={item.alt_text || item.caption || `${listing.title} thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              aria-label="Scroll thumbnails right"
              onClick={e => { e.stopPropagation(); thumbStripRef.current?.scrollBy({ left: 320, behavior: 'smooth' }); }}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition"
            >
              <ChevronRight size={18} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ══ MESSAGE MODAL ════════════════════════════════════════════════════ */}
      {showMsg && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-[#10214F]/80 backdrop-blur-sm"
          style={{ zIndex: 9999 }}
          onClick={() => setShowMsg(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-[#10214F]">
                  Contact {recipientName}
                </h3>
                {sc?.title && <p className="text-sm text-gray-500 mt-1">{sc.title}</p>}
              </div>
              <button onClick={() => setShowMsg(false)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="mb-5 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600">Re: <span className="font-semibold text-[#10214F]">{listing.title}</span></p>
              </div>
              {msgDone ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 bg-green-50">
                    <Check size={36} className="text-green-600" />
                  </div>
                  <p className="font-bold text-xl mb-2 text-[#10214F]">Message sent!</p>
                  <p className="text-sm text-gray-600 mb-6">{recipientName} will be in touch shortly.</p>
                  <button onClick={() => { setMsgDone(false); setShowMsg(false); }}
                    className="px-8 py-3 rounded-xl text-white font-semibold hover:opacity-90 bg-[#01BBDC] transition-all">
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={sendMessage} className="space-y-4">
                  {!localStorage.getItem('token') && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-semibold block mb-2 text-gray-700">Name *</label>
                          <input required value={msgForm.name} onChange={e => setMsgForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Jane Smith" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] focus:border-transparent transition-all" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold block mb-2 text-gray-700">Phone</label>
                          <input value={msgForm.phone} onChange={e => setMsgForm(p => ({ ...p, phone: e.target.value }))}
                            placeholder="+1 555 000 0000" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] focus:border-transparent transition-all" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold block mb-2 text-gray-700">Email *</label>
                        <input required type="email" value={msgForm.email} onChange={e => setMsgForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="you@email.com" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] focus:border-transparent transition-all" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-sm font-semibold block mb-2 text-gray-700">Message *</label>
                    <textarea required rows={5} value={msgForm.message} onChange={e => setMsgForm(p => ({ ...p, message: e.target.value }))}
                      placeholder="I'm interested in this listing. Could we arrange a viewing?"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] focus:border-transparent resize-none transition-all" />
                  </div>
                  <button type="submit" disabled={msgBusy}
                    className="w-full py-3.5 rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-all bg-[#01BBDC]">
                    {msgBusy ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ EDITOR STATUS BAR ══════════════════════════════════════════════ */}
      {canEdit && listing && (() => {
        const info = listingStatusConfig[listing.status || ''] ?? { label: listing.status || '', colorClass: 'bg-gray-200 text-gray-700' };
        return (
          <div className="bg-[#10214F] text-white border-b border-white/10">
            <div className="max-w-[1296px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-white/60 uppercase tracking-wider font-medium">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${info.colorClass}`}>
                  {info.label}
                </span>
                {listing.status === 'awaiting_review' && (
                  <button
                    onClick={approveListing}
                    disabled={approvingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-xs font-semibold rounded-full transition-colors"
                  >
                    <Check size={12} />
                    {approvingStatus ? 'Approving…' : 'Approve'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {navContext && currentNavIndex >= 0 && (
                  <span className="text-xs text-white/50">
                    {currentNavIndex + 1} of {navContext.ids.length}
                  </span>
                )}
                {prevListingId !== null && (
                  <Link
                    href={`/listings/${prevListingId}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                  >
                    <ChevronLeft size={14} /> Prev
                  </Link>
                )}
                {nextListingId !== null && (
                  <Link
                    href={`/listings/${nextListingId}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                  >
                    Next <ChevronRight size={14} />
                  </Link>
                )}
                <Link
                  href={`/dealer/listings/${id}/edit`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#01BBDC] hover:bg-[#01BBDC]/80 text-white text-xs font-semibold rounded-full transition-colors"
                >
                  <Edit size={13} /> Edit Listing
                </Link>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ PAGE ════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1296px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back button */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm mb-6 text-[#10214F] hover:text-[#01BBDC] transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to listings
        </button>

        {/* ══ TITLE + PRICE ══════════════════════════════════════════════════ */}
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#10214F] tracking-tight mb-2 font-bahnschrift">
              {listing.title}
            </h1>
            {/* Location + Stock */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#10214F] font-poppins">
              {locationString && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-[#01BBDC]" />
                  {locationString}
                </span>
              )}
              <span>Stock #{id}</span>
              {listing.featured && (
                <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-[#01BBDC]">
                  ⭐ Featured
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {displayPrice != null && (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-bold text-[#01BBDC] font-bahnschrift">
                  {displayCurrency === 'USD' ? '$' : ''}{fmt(displayPrice)}{displayCurrency !== 'USD' ? ` ${displayCurrency}` : ''}
                </span>
              </div>
            )}
            {currencies && (
              <select
                value={displayCurrency}
                onChange={e => { setDisplayCurrency(e.target.value); localStorage.setItem('preferredCurrency', e.target.value); }}
                className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
              </select>
            )}
          </div>
        </div>

        {/* ══ FEATURED IMAGE + CONTACT ════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-4">

          {/* ── Featured image: 8 cols ──────────────────────────────────────── */}
          <div className="lg:col-span-8">
            <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer"
              style={{ height: 500 }}
              onClick={() => {
                if (!featuredMedia) return;
                if (featuredMedia.file_type === 'image') {
                  const idx = imageLightboxItems.findIndex(i => i.id === featuredMedia.id);
                  if (idx >= 0) setLightbox(idx);
                } else if (featuredMedia.file_type === 'video') {
                  window.open(featuredMedia.url, '_blank');
                }
              }}>
              {featuredMedia?.file_type === 'video' ? (
                <div className="relative w-full h-full bg-black">
                  {featuredMedia.url.includes('youtube.com/embed') || featuredMedia.url.includes('vimeo.com/video') ? (
                    <iframe src={featuredMedia.url} title={listing.title} className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                  ) : (
                    <video src={featuredMedia.url} controls className="w-full h-full object-cover" />
                  )}
                </div>
              ) : (
                <img src={mediaUrl(featuredMedia?.url) || FALLBACK_IMAGE}
                  alt={`${listing.title} main photo`} className="w-full h-full object-cover" />
              )}
              {listing.featured && (
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl text-sm font-bold text-white bg-[#01BBDC]">
                  ⭐ Featured
                </div>
              )}
              {contact?.dealer?.is_demo && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                  <div className="bg-[#10214F]/80 backdrop-blur-md text-white px-6 py-4 rounded-xl text-center border-2 border-[#01BBDC]">
                    <p className="text-2xl font-black uppercase tracking-widest mb-1 text-[#01BBDC] font-bahnschrift">Sample Listing</p>
                    <p className="text-sm font-medium opacity-80">Demonstration Purposes Only</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Contact card: 4 cols ── */}
          <div className="lg:col-span-4">
            <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden">
              {(sc || dealer) ? (
                <>
                  {/* ── Broker section ──────────────────────────────── */}
                  <div className="p-6 text-center">
                    {/* Photo / Avatar */}
                    <div className="flex justify-center mb-4">
                      {sc?.photo_url ? (
                        <img src={sc.photo_url} alt={sc.name || 'Broker'}
                          className="w-24 h-24 rounded-full object-cover border-2 border-gray-100 shadow-sm"
                          onError={e => { (e.target as HTMLImageElement).src = '/logo/logo-icon.png'; }} />
                      ) : (dealer?.logo_url && !sc) ? (
                        <img src={dealer.logo_url} alt={dealer.company_name || 'Dealer'}
                          className="w-24 h-24 rounded-full object-contain bg-gray-50 p-2 border border-gray-100"
                          onError={e => { (e.target as HTMLImageElement).src = '/logo/logo-icon.png'; }} />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                          <img src="/logo/logo-icon.png" alt="YachtVersal" className="w-14 h-14 object-contain" />
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    {sc?.id ? (
                      <Link href={`/salesmen/${sc.id}`} className="hover:underline"
                        style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontSize: 15, color: '#10214F', display: 'block', marginBottom: 2 }}>
                        {sc.name}
                      </Link>
                    ) : sc?.name ? (
                      <p style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontSize: 15, color: '#10214F', marginBottom: 2 }}>
                        {sc.name}
                      </p>
                    ) : dealer?.slug ? (
                      <Link href={`/dealers/${dealer.slug}`} className="hover:underline"
                        style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontSize: 15, color: '#10214F', display: 'block', marginBottom: 2 }}>
                        {dealer.company_name || dealer.name}
                      </Link>
                    ) : (
                      <p style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontSize: 15, color: '#10214F', marginBottom: 2 }}>
                        {dealer?.company_name || dealer?.name}
                      </p>
                    )}

                    {/* Title */}
                    {sc?.title && (
                      <p className="text-sm text-gray-500 mb-2">{sc.title}</p>
                    )}

                    {/* Phone */}
                    {(sc?.phone || dealer?.phone) && (
                      <a href={`tel:${sc?.phone || dealer?.phone}`}
                        className="flex items-center justify-center gap-1.5 text-sm hover:text-[#01BBDC] transition-colors mb-2"
                        style={{ color: '#10214F' }}>
                        <Phone size={13} /> {formatPhone(sc?.phone || dealer?.phone)}
                      </a>
                    )}

                    {/* Location */}
                    {(dealer?.city || dealer?.state) && (
                      <p className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1 mb-5">
                        <MapPin size={10} />
                        {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                      </p>
                    )}

                    {/* CTA */}
                    <button onClick={() => setShowMsg(true)}
                      className="w-full py-3.5 rounded-2xl text-white font-semibold transition-all hover:opacity-90"
                      style={{ backgroundColor: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.08em', fontSize: 13 }}>
                      CONTACT BROKER
                    </button>
                  </div>

                  {/* ── Company section ──────────────────────────────── */}
                  {dealer && (dealer.company_name || dealer.name) && (
                    <div className="border-t border-gray-100 p-5" style={{ backgroundColor: '#F8F9FC' }}>
                      {/* Logo */}
                      <div className="flex justify-center mb-3">
                        {dealer.logo_url ? (
                          <img src={dealer.logo_url} alt={`${dealer.company_name || dealer.name} logo`}
                            className="h-12 max-w-[140px] object-contain"
                            onError={e => { (e.target as HTMLImageElement).src = '/logo/logo-icon.png'; }} />
                        ) : (
                          <img src="/logo/logo-icon.png" alt="YachtVersal" className="h-10 w-auto object-contain opacity-30" />
                        )}
                      </div>

                      {/* Company name */}
                      {sc && (dealer.slug ? (
                        <Link href={`/dealers/${dealer.slug}`}
                          className="block text-center text-xs font-semibold text-[#10214F] hover:text-[#01BBDC] hover:underline mb-1 uppercase tracking-wider">
                          {dealer.company_name || dealer.name}
                        </Link>
                      ) : (
                        <p className="text-center text-xs font-semibold text-[#10214F] mb-1 uppercase tracking-wider">
                          {dealer.company_name || dealer.name}
                        </p>
                      ))}

                      {/* Location */}
                      {(dealer.city || dealer.state || dealer.country) && (
                        <p className="text-center text-[11px] text-gray-400 flex items-center justify-center gap-1 mb-3">
                          <MapPin size={10} />
                          {[dealer.city, dealer.state, dealer.country].filter(Boolean).join(', ')}
                        </p>
                      )}

                      {/* Description / bio */}
                      {dealer.description && (
                        <p className="text-center text-xs text-gray-500 leading-relaxed mb-3 line-clamp-4">
                          {dealer.description}
                        </p>
                      )}

                      {/* Email */}
                      {dealer.email && (
                        <a href={`mailto:${dealer.email}`}
                          className="flex items-center justify-center gap-1.5 text-xs hover:text-[#01BBDC] transition-colors mb-3"
                          style={{ color: '#10214F' }}>
                          <Mail size={12} /> {dealer.email}
                        </a>
                      )}

                      {/* Social links */}
                      {(dealer.facebook_url || dealer.instagram_url || dealer.twitter_url || dealer.linkedin_url) && (
                        <div className="flex items-center justify-center gap-3 mb-3">
                          {dealer.facebook_url && (
                            <a href={dealer.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                              <Facebook size={16} className="text-[#1877F2]" />
                            </a>
                          )}
                          {dealer.instagram_url && (
                            <a href={dealer.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                              <Instagram size={16} className="text-[#E4405F]" />
                            </a>
                          )}
                          {dealer.twitter_url && (
                            <a href={dealer.twitter_url} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                              <Twitter size={16} className="text-[#1DA1F2]" />
                            </a>
                          )}
                          {dealer.linkedin_url && (
                            <a href={dealer.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                              <Linkedin size={16} className="text-[#0A66C2]" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Visit website */}
                      {dealer.website && (
                        <a href={dealer.website.startsWith('http') ? dealer.website : `https://${dealer.website}`}
                          target="_blank" rel="noopener noreferrer"
                          className="block w-full py-2.5 rounded-xl text-center text-xs font-semibold transition-all hover:opacity-80"
                          style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.06em', border: '1.5px solid #10214F', color: '#10214F' }}>
                          VISIT WEBSITE
                        </a>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-24 h-24 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                      <img src="/logo/logo-icon.png" alt="YachtVersal" className="w-14 h-14 object-contain opacity-40" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Contact information not available</p>
                  <button onClick={() => setShowMsg(true)}
                    className="w-full py-3.5 rounded-2xl text-white font-semibold bg-[#01BBDC] hover:opacity-90 transition-all"
                    style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.08em', fontSize: 13 }}>
                    SEND INQUIRY
                  </button>
                </div>
              )}

              {/* Action buttons row */}
              <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200 bg-gray-50 rounded-b-3xl">
                <button onClick={toggleSave}
                  className="flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors"
                  style={{ color: saved ? '#10214F' : '#10214F' }}>
                  {saved ? 'Saved' : 'Save'}
                </button>
                <div className="relative">
                  <button onClick={() => setShowComp(!showComp)}
                    className="w-full flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors"
                    style={{ color: '#10214F' }}>
                    Compare
                  </button>
                  {showComp && (
                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-white rounded-2xl border border-gray-200 z-20 max-h-52 overflow-y-auto">
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
                    className="w-full flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors text-[#10214F]">
                    Share
                  </button>
                  {showShare && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200 z-50">
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
                        <button onClick={() => { window.open(`${API_ROOT}/pdf/listings/${id}/pdf`, '_blank'); setShowShare(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl text-sm text-gray-700 transition-colors">
                          <Download size={16} className="text-gray-500" /> PDF Brochure
                        </button>
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
          </div>
        </div>

        {/* ══ PHOTO STRIP: single row of thumbnails ═══════════════════════ */}
        {galleryItems.length > 1 && (
          <div className="flex justify-center gap-3 mb-12 overflow-hidden">
            {galleryItems.slice(1, 5).map((item, idx) => {
              const isLast = idx === 3;
              const remaining = Math.max(galleryItems.length - 5, 0);
              return (
                <button key={item.id} type="button"
                  className="relative flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100"
                  style={{ height: 160, width: 'calc(25% - 9px)' }}
                  onClick={() => {
                    if (item.file_type === 'image') {
                      const i = imageLightboxItems.findIndex(x => x.id === item.id);
                      if (i >= 0) setLightbox(i);
                    } else if (item.file_type === 'video') {
                      window.open(item.url, '_blank');
                    }
                  }}>
                  {item.file_type === 'video' ? (
                    <>
                      <img src={mediaUrl(item.thumbnail_url) || FALLBACK_IMAGE}
                        alt={`${listing.title} video`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <PlayCircle size={22} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <img src={mediaUrl(item.thumbnail_url || item.url) || FALLBACK_IMAGE}
                      alt={`${listing.title} photo ${idx + 2}`} className="w-full h-full object-cover" />
                  )}
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

        {/* PDF documents */}
        {pdfItems.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 mb-6">
            <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
              <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
              Documents
            </h4>
            <div className="space-y-2">
              {pdfItems.map((doc, idx) => (
                <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <span className="flex items-center gap-2 text-sm text-[#10214F] font-poppins">
                    <FileText size={16} className="text-[#01BBDC]" />
                    {doc.caption || doc.alt_text || `Document ${idx + 1}`}
                  </span>
                  <ExternalLink size={14} className="text-gray-500" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ══ KEY SPECS (LEFT 8) + FINANCE (RIGHT 4) ══════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">

          {/* Left column: Key Specs + Key Features — 8 cols */}
          <div className="lg:col-span-8 space-y-8">

            {/* KEY SPECIFICATIONS */}
            <div>
              <SectionHeading>Key Specifications</SectionHeading>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                {[
                  { icon: <Ruler size={20} className="text-[#01BBDC]" />, label: 'Length',       value: fmtLength(listing.length_feet, displayUnits) },
                  { icon: <Users size={20} className="text-[#01BBDC]" />, label: 'Guests',        value: listing.berths ? String(listing.berths) : null },
                  { icon: <Bed size={20} className="text-[#01BBDC]" />,   label: 'Cabins',        value: listing.cabins ? String(listing.cabins) : null },
                  { icon: <Ship size={20} className="text-[#01BBDC]" />,  label: 'Type',          value: listing.boat_type, href: boatTypeLink?.href },
                  { icon: <Wrench size={20} className="text-[#01BBDC]" />,label: 'Make',          value: listing.make, href: makeLink?.href },
                  { icon: <Gauge size={20} className="text-[#01BBDC]" />, label: 'Year',          value: listing.year ? String(listing.year) : null },
                  { icon: <Waves size={20} className="text-[#01BBDC]" />, label: 'Cruise Speed',  value: listing.cruising_speed_knots ? `${listing.cruising_speed_knots} kts` : null },
                  { icon: <Gauge size={20} className="text-[#01BBDC]" />, label: 'Max Speed',     value: listing.max_speed_knots ? `${listing.max_speed_knots} kts` : null },
                  { icon: <Fuel size={20} className="text-[#01BBDC]" />,  label: 'Fuel Type',     value: listing.fuel_type },
                  { icon: <Ship size={20} className="text-[#01BBDC]" />,  label: 'Engines',       value: listing.engine_count ? String(listing.engine_count) : ((listing.additional_engines?.length || 0) > 0 ? String(listing.additional_engines?.length) : null) },
                  { icon: <MapPin size={20} className="text-[#01BBDC]" />,label: 'Location',      value: locationString || null },
                  { icon: <Calendar size={20} className="text-[#01BBDC]" />, label: 'Listed',     value: listing.published_at ? new Date(listing.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null },
                ].filter(s => s.value).map(s => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(1,187,220,0.1)' }}>
                      {s.icon}
                    </div>
                    <div>
                      <p className="text-xs text-[#10214F]/55 uppercase tracking-wide font-bahnschrift">{s.label}</p>
                      {s.href ? (
                        <Link href={s.href} className="font-semibold text-[#01BBDC] font-bahnschrift text-sm hover:underline">
                          {s.value}
                        </Link>
                      ) : (
                        <p className="font-semibold text-[#10214F] font-bahnschrift text-sm">{s.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>

            {/* KEY FEATURES */}
            {keyFeatures.length > 0 && (
              <div>
                <SectionHeading>Key Features</SectionHeading>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <ul className="space-y-2.5">
                    {keyFeatures.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-[15px] text-[#10214F] font-poppins leading-relaxed">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white" style={{ backgroundColor: '#01BBDC' }}>✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* ══ DESCRIPTION ═══════════════════════════════════════════════ */}
            {listing.description && (
              <div>
                <SectionHeading>Description</SectionHeading>
                {isHtmlDesc ? (
                  <div
                    className="text-[15px] leading-relaxed text-[#10214F] font-poppins space-y-4 prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                ) : (
                  <div className="space-y-4">
                    {(showFullDesc ? descParagraphs : descParagraphs.slice(0, 3)).map((para, i) => (
                      <p key={i} className="text-[15px] leading-[1.8] text-[#10214F] font-poppins">
                        {para}
                      </p>
                    ))}
                    {descParagraphs.length > 3 && (
                      <button
                        onClick={() => setShowFullDesc((v) => !v)}
                        className="text-sm font-semibold text-[#01BBDC] hover:opacity-75 transition-opacity mt-1"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {showFullDesc ? '↑ Show less' : 'Read full description →'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right column: Finance — 4 cols */}
          <div className="lg:col-span-4 space-y-6">

            {/* FINANCE CALCULATOR */}
            {listing.price && (
              <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden">

                {/* Inputs */}
                <div className="p-6">
                  <h4 className="text-lg font-bold text-[#10214F] mb-4 font-bahnschrift">Finance Calculator</h4>

                  {([
                    { label: 'Purchase Price',    key: null,                   type: 'readonly', val: `$${fmt(listing.price)}` },
                    { label: 'Down Payment %',    key: 'down_payment_percent', type: 'number',   step: 5 },
                    { label: 'Loan Amount',       key: null,                   type: 'readonly', val: `$${fmt(listing.price * (1 - finIn.down_payment_percent / 100))}` },
                  ] as any[]).map(f => (
                    <div key={f.label} className="mb-4">
                      <p className="mb-2 text-sm font-semibold text-[#10214F] font-poppins">{f.label}</p>
                      {f.type === 'readonly' ? (
                        <div className="px-4 py-3 rounded-xl text-sm font-medium border border-gray-200 text-[#10214F] bg-white">
                          {f.val}
                        </div>
                      ) : (
                        <input type="number" step={f.step}
                          value={(finIn as any)[f.key]}
                          onChange={e => setFinIn(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                          className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#01BBDC] border border-gray-200 transition-all" />
                      )}
                    </div>
                  ))}

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-[#10214F] font-poppins">Term (years)</p>
                      <input type="number" min={1} max={30} value={finIn.term_years}
                        onChange={e => setFinIn(p => ({ ...p, term_years: Number(e.target.value) }))}
                        className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#01BBDC] border border-gray-200 transition-all" />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-[#10214F] font-poppins">Rate %</p>
                      <input type="number" step={0.01} value={finIn.interest_rate}
                        onChange={e => setFinIn(p => ({ ...p, interest_rate: Number(e.target.value) }))}
                        className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#01BBDC] border border-gray-200 transition-all" />
                    </div>
                  </div>

                  <button onClick={calcFinance} disabled={finBusy}
                    className="w-full py-3 rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-all bg-[#01BBDC]">
                    {finBusy ? 'Calculating…' : 'Calculate'}
                  </button>
                </div>

                {/* Results */}
                <div className="px-6 py-6 bg-white border-t border-gray-200">
                  <p className="font-bold text-lg text-[#10214F] mb-2 font-bahnschrift">
                    Monthly Payment
                  </p>
                  <p className="font-bold text-4xl text-[#10214F] mb-5 font-bahnschrift">
                    {finOut ? `$${fmt(finOut.monthly_payment)}` : '—'}
                  </p>
                  {finOut && (
                    <div className="space-y-3 text-sm">
                      {[
                        { label: 'Down payment',   val: `$${fmt(finOut.down_payment)}`   },
                        { label: 'Loan amount',    val: `$${fmt(finOut.loan_amount)}`    },
                        { label: 'Total interest', val: `$${fmt(finOut.total_interest)}`  },
                        { label: 'Total cost',     val: `$${fmt(finOut.total_cost)}`     },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-[#10214F] font-poppins">{r.label}</span>
                          <span className="font-bold text-[#10214F] font-poppins">{r.val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* ══ FULL SPECIFICATIONS ════════════════════════════════════════════ */}
        <div className="mb-10">
          <SectionHeading>Full Specifications</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* ── General ── */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                General
              </h4>
              <SpecRow label="Stock #"         value={id} />
              <SpecRow label="BIN"             value={listing.bin} />
              <SpecRow label="Status"          value={listing.status === 'active' ? 'Available' : listing.status === 'sold' ? 'Sold' : listing.status || null} />
              <SpecRow label="Make"            value={listing.make} href={makeLink?.href} />
              <SpecRow label="Model"           value={listing.model} />
              <SpecRow label="Year"            value={listing.year ? String(listing.year) : null} />
              <SpecRow label="Type"            value={listing.boat_type} href={boatTypeLink?.href} />
              <SpecRow label="Condition"       value={listing.condition ? (listing.condition.charAt(0).toUpperCase() + listing.condition.slice(1)) : null} />
              <SpecRow label="Previous Owners" value={listing.previous_owners != null ? String(listing.previous_owners) : null} />
            </div>

            {/* ── Dimensions + Accommodations stacked ── */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                  <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                  Dimensions
                </h4>
                <SpecRow label="LOA"           value={fmtLength(listing.length_feet, displayUnits)} />
                <SpecRow label="Beam"          value={fmtLength(listing.beam_feet, displayUnits)} />
                <SpecRow label="Draft"         value={fmtLength(listing.draft_feet, displayUnits)} />
                <SpecRow label="Hull Material" value={listing.hull_material} />
                <SpecRow label="Hull Type"     value={listing.hull_type} />
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                  <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                  Accommodations
                </h4>
                <SpecRow label="Cabins" value={listing.cabins ? String(listing.cabins) : null} />
                <SpecRow label="Berths" value={listing.berths ? String(listing.berths) : null} />
                <SpecRow label="Heads"  value={listing.heads  ? String(listing.heads)  : null} />
              </div>
            </div>

            {/* ── Performance + Listing Details stacked ── */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                  <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                  Performance
                </h4>
                <SpecRow label="Max Speed"        value={listing.max_speed_knots ? `${listing.max_speed_knots} kts` : null} />
                <SpecRow label="Cruise Speed"      value={listing.cruising_speed_knots ? `${listing.cruising_speed_knots} kts` : null} />
                <SpecRow label="Fuel Type"         value={listing.fuel_type} />
                <SpecRow label="Fuel Capacity"     value={fmtCapacity(listing.fuel_capacity_gallons, displayUnits)} />
                <SpecRow label="Water Capacity"    value={fmtCapacity(listing.water_capacity_gallons, displayUnits)} />
                <SpecRow label="Displacement"      value={fmtWeight(listing.additional_specs?.displacement_lbs, displayUnits)} />
                <SpecRow label="Dry Weight"        value={fmtWeight(listing.additional_specs?.dry_weight_lbs, displayUnits)} />
                <SpecRow label="Bridge Clearance"  value={fmtLength(listing.additional_specs?.bridge_clearance_feet, displayUnits)} />
                <SpecRow label="Deadrise"          value={listing.additional_specs?.deadrise_degrees ? `${listing.additional_specs.deadrise_degrees}°` : null} />
                <SpecRow label="Range"             value={listing.additional_specs?.cruising_range_nm ? `${fmt(listing.additional_specs.cruising_range_nm)} nm` : null} />
                <SpecRow label="Fuel Burn"         value={fmtFuelBurn(listing.additional_specs?.fuel_burn_gph, displayUnits)} />
                <SpecRow label="Holding Tank"      value={fmtCapacity(listing.additional_specs?.holding_tank_gallons, displayUnits)} />
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                  <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                  Listing Details
                </h4>
                <SpecRow label="Listed" value={listing.published_at ? new Date(listing.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null} />
              </div>
            </div>

          </div>
        </div>

        {/* ══ ENGINES ════════════════════════════════════════════════════════ */}
        {(() => {
          // Only show explicit engine entries (from additional_engines).
          // If only engine_count was filled in with no detail, show nothing —
          // same behaviour as generators (which also only render when data exists).
          const additionalEngines = Array.isArray(listing.additional_engines) && listing.additional_engines.length > 0
            ? listing.additional_engines
            : [];

          // Legacy fallback: if old listing has engine_hours but no additional_engines
          const hasLegacyHours = listing.engine_hours != null;

          const gens = Array.isArray(listing.generators) ? listing.generators.slice(0, 2) : [];

          if (additionalEngines.length === 0 && !hasLegacyHours && gens.length === 0) return null;

          return (
            <div className="mb-10">
              <SectionHeading>Engine Details</SectionHeading>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {additionalEngines.length > 0 ? (
                  additionalEngines.slice(0, 4).map((engine, idx) => (
                    <div key={`engine-${idx}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                      <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                        <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                        {additionalEngines.length > 1 ? `Engine ${idx + 1}` : 'Engine'}
                      </h4>
                      <div className="space-y-1">
                        <SpecRow label="Make" value={engine.make} />
                        <SpecRow label="Model" value={engine.model} />
                        <SpecRow label="Type" value={engine.type} />
                        <SpecRow label="Hours" value={engine.hours != null ? fmt(engine.hours) : null} />
                        <SpecRow label="Horsepower" value={engine.horsepower != null ? `${fmt(engine.horsepower)} hp` : null} />
                        <SpecRow label="Notes" value={engine.notes || null} />
                      </div>
                    </div>
                  ))
                ) : hasLegacyHours ? (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                      <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                      Engine
                    </h4>
                    <div className="space-y-1">
                      <SpecRow label="Fuel" value={listing.fuel_type} />
                      <SpecRow label="Hours" value={fmt(listing.engine_hours!)} />
                    </div>
                  </div>
                ) : null}

                {gens.map((generator, idx) => (
                  <div key={`generator-${idx}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <h4 className="font-bold text-[#10214F] mb-4 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                      <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                      Generator {idx + 1}
                    </h4>
                    <div className="space-y-1">
                      <SpecRow label="Brand" value={generator.brand} />
                      <SpecRow label="Model" value={generator.model} />
                      <SpecRow label="Hours" value={generator.hours != null ? fmt(generator.hours) : null} />
                      <SpecRow label="Power" value={generator.kw != null ? `${fmt(generator.kw)} kW` : null} />
                      <SpecRow label="Notes" value={generator.notes} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══ FEATURES / EQUIPMENT ═══════════════════════════════════════════ */}
        {listing.features && (() => {
          // Strip feature_bullet lines (prefixed "- ") — already shown in Key Features above
          const equipmentLines = listing.features.split('\n').filter((line: string) => !line.trimStart().startsWith('- '));
          const hasContent = equipmentLines.some((l: string) => l.trim().length > 0);
          if (!hasContent) return null;
          return (
            <div className="mb-16">
              <SectionHeading>Equipment &amp; Features</SectionHeading>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-[15px] leading-relaxed text-[#10214F] font-poppins">
                {equipmentLines.map((line: string, i: number) => {
                  const isSectionHeader = line.trim().length > 0 && line.trim().length < 50 && line.trim() === line.trim().toUpperCase();
                  return isSectionHeader ? (
                    <h4 key={i} className="font-bold text-[#10214F] mt-6 mb-3 first:mt-0 text-xs uppercase tracking-widest font-bahnschrift flex items-center gap-2">
                      <span className="w-0.5 h-4 rounded-full bg-[#01BBDC] inline-block flex-shrink-0" />
                      {line.trim()}
                    </h4>
                  ) : line.trim() ? (
                    <p key={i} className="mb-2">• {line}</p>
                  ) : (
                    <div key={i} className="h-4" />
                  );
                })}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
