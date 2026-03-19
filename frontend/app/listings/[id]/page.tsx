'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Heart, Download, MapPin, Calendar, ArrowLeft, Mail,
  Ship, Share2, Facebook, Twitter, Linkedin,
  MessageCircle, Link2, Printer, Plus, Check, Phone,
  X, ChevronLeft, ChevronRight, Building2, User,
  ExternalLink, Globe, Users, Wrench,
  Bed, Gauge, Fuel, Waves, Ruler,
  Zap, Wind, ZoomIn, ZoomOut, FileText, PlayCircle
} from 'lucide-react';
import { API_ROOT, mediaUrl } from '@/app/lib/apiRoot';

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

const FALLBACK_LISTING_IMAGE = '/images/listing-fallback1.png';

// ─── Components ───────────────────────────────────────────────────────────────

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
      <h3 className="text-2xl font-bold text-[#01BBDC] mb-2 font-bahnschrift">
        {children}
      </h3>
      <div className="h-[1px] bg-[#01BBDC]" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id     = params?.id as string;

  const [listing,      setListing]      = useState<Listing | null>(null);
  const [media,        setMedia]        = useState<MediaItem[]>([]);
  const [contact,      setContact]      = useState<ContactInfo | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [currencies,   setCurrencies]   = useState<CurrencyRates | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState('USD');

  // gallery lightbox
  const [lightbox,     setLightbox]     = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

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

  // ── fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || id === 'undefined') return;
    setLoading(true);
    Promise.all([fetchListing(), fetchMedia(), fetchContact(), checkSaved(), loadComps(), fetchCurrencies()])
      .finally(() => setLoading(false));
  }, [id]);

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
      if (token && recipId) {
        // Logged-in users: create a message
        await fetch(`${API_ROOT}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: `Inquiry about: ${listing?.title || 'Listing #' + id}`, body: msgForm.message, message_type: 'inquiry', recipient_id: recipId, listing_id: Number(id) }) });
      } else {
        // Anonymous users: create an inquiry (triggers webhook delivery)
        await fetch(`${API_ROOT}/inquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_name: msgForm.name, sender_email: msgForm.email, sender_phone: msgForm.phone || undefined, message: msgForm.message, listing_id: Number(id) }) });
      }
      setMsgDone(true); setMsgForm({ name: '', email: '', phone: '', message: '' });
    } catch {}
    setMsgBusy(false);
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

  // Parse key features from features text (first 5-6 bullet points)
  const keyFeatures = listing?.feature_bullets?.length
    ? listing.feature_bullets.filter(Boolean).slice(0, 8)
    : (listing?.features
      ? listing.features
          .replace(/<[^>]*>/g, '\n')
          .split('\n')
          .map(line => line.replace(/^[-•\s]+/, '').trim())
          .filter(line => line && !line.match(/^[A-Z\s]+$/))
          .slice(0, 8)
      : []);

  const descriptionHtml = listing?.description
    ? (/<\/?[a-z][\s\S]*>/i.test(listing.description)
        ? listing.description
        : listing.description.replace(/\n/g, '<br />'))
    : '';

  useEffect(() => {
    if (lightbox !== null) setLightboxZoom(1);
  }, [lightbox]);

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

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">

      {/* ══ LIGHTBOX ════════════════════════════════════════════════════════ */}
      {lightbox !== null && imageLightboxItems.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all" aria-label="Close">
            <X size={22} className="text-white" />
          </button>
          <div className="absolute top-6 right-20 flex items-center gap-2">
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
            className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <ChevronLeft size={28} className="text-white" />
          </button>
          <img src={mediaUrl(imageLightboxItems[lightbox]?.url) || FALLBACK_LISTING_IMAGE} className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl transition-transform duration-200"
            style={{ transform: `scale(${lightboxZoom})` }}
            alt={imageLightboxItems[lightbox]?.alt_text || imageLightboxItems[lightbox]?.caption || `${listing.title} photo ${(lightbox ?? 0) + 1}`}
            onClick={e => e.stopPropagation()} />
          <button onClick={e => { e.stopPropagation(); setLightbox(i => ((i ?? 0) + 1) % imageLightboxItems.length); }}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <ChevronRight size={28} className="text-white" />
          </button>
          <div className="absolute bottom-6 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white text-sm">
            {(lightbox ?? 0) + 1} / {imageLightboxItems.length}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-20 w-[90vw] max-w-5xl overflow-x-auto">
            <div className="flex gap-2 justify-center">
              {imageLightboxItems.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={e => { e.stopPropagation(); setLightbox(idx); }}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${idx === lightbox ? 'border-[#01BBDC]' : 'border-white/20'}`}>
                  <img
                    src={mediaUrl(item.thumbnail_url || item.url)}
                    alt={item.alt_text || item.caption || `${listing.title} thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ MESSAGE MODAL ════════════════════════════════════════════════════ */}
      {showMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10214F]/80 backdrop-blur-sm"
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
                onChange={e => setDisplayCurrency(e.target.value)}
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
                <img src={mediaUrl(featuredMedia?.url) || FALLBACK_LISTING_IMAGE}
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
            <div className="rounded-3xl border border-gray-200 bg-white">
              {(sc || dealer) ? (
                <div className="p-6">
                  {sc ? (
                    <div className="flex gap-4 mb-5">
                      {sc.photo_url ? (
                        <img src={sc.photo_url} alt={sc.name || 'Sales contact photo'}
                          className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
                          onError={e => { (e.target as HTMLImageElement).src = '/images/user-placeholder.png'; }} />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gray-100 border border-gray-200">
                          <User size={36} className="text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 pt-1">
                        <p className="font-bold text-lg text-[#01BBDC] mb-0.5">
                          {sc.name}
                        </p>
                        {sc.title && (
                          <p className="text-sm text-gray-600 mb-1">{sc.title}</p>
                        )}
                        {sc.phone && (
                          <a href={`tel:${sc.phone}`}
                            className="text-sm text-[#10214F] hover:text-[#01BBDC] transition-colors flex items-center gap-1">
                            <Phone size={12} /> {sc.phone}
                          </a>
                        )}
                        {sc.email && (
                          <a href={`mailto:${sc.email}`}
                            className="text-xs text-gray-500 hover:text-[#01BBDC] transition-colors block mt-1">
                            {sc.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    dealer && (dealer.company_name || dealer.name) && (
                      <div className="flex gap-4 mb-5">
                        {dealer.logo_url ? (
                          <img src={dealer.logo_url} alt={`${dealer.company_name || dealer.name || 'Dealer'} logo`}
                            className="w-16 h-16 rounded-2xl object-contain bg-white p-2 flex-shrink-0 border border-gray-100"
                            onError={e => { (e.target as HTMLImageElement).src = '/images/company-placeholder.png'; }} />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gray-100 border border-gray-200">
                            <Building2 size={28} className="text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0 pt-1">
                          <p className="font-bold text-lg text-[#01BBDC] mb-1">
                            {dealer.company_name || dealer.name}
                          </p>
                          {(dealer.city || dealer.state) && (
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <MapPin size={12} />
                              {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                            </p>
                          )}
                          {dealer.phone && (
                            <a href={`tel:${dealer.phone}`}
                              className="text-sm text-[#10214F] hover:text-[#01BBDC] transition-colors mt-1 block">
                              {dealer.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  )}

                  {/* Divider */}
                  <div className="h-px bg-gray-200 mb-5" />

                  {/* CTA buttons - NO GRADIENTS */}
                  <div className="flex flex-col gap-3">
                    <button onClick={() => setShowMsg(true)}
                      className="w-full py-3.5 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 transition-all bg-[#01BBDC] hover:opacity-90">
                      <Mail size={18} /> Contact Seller
                    </button>
                    {primaryPhone && (
                      <a href={`tel:${primaryPhone}`}
                        className="w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all border-2 border-[#01BBDC] text-[#01BBDC] hover:bg-[#01BBDC] hover:text-white">
                        <Phone size={18} /> Call {sc ? 'Agent' : 'Broker'}
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
                  <button onClick={() => setShowMsg(true)}
                    className="w-full py-3 rounded-2xl text-white font-semibold bg-[#01BBDC] hover:opacity-90 transition-all">
                    Send Inquiry
                  </button>
                </div>
              )}

              {/* Brokerage info (when sales contact has parent dealer) */}
              {sc && dealer && (dealer.company_name || dealer.name) && (
                <div className="px-6 py-5 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-3 items-start">
                    {dealer.logo_url ? (
                      <img src={dealer.logo_url} alt={`${dealer.company_name || dealer.name || 'Dealer'} logo`} className="w-14 h-14 rounded-xl object-contain bg-white p-2 flex-shrink-0 border border-gray-100"
                        onError={e => { (e.target as HTMLImageElement).src = '/images/company-placeholder.png'; }} />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border border-gray-100">
                        <Building2 size={24} className="text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#10214F] truncate text-sm">
                        {dealer.company_name || dealer.name}
                      </p>
                      {(dealer.city || dealer.state) && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {dealer.website && (
                        <a href={dealer.website.startsWith('http') ? dealer.website : `https://${dealer.website}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 mt-1.5 text-xs hover:underline text-[#01BBDC]">
                          <Globe size={11} />
                          {dealer.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                    {dealer.slug && (
                      <Link href={`/dealers/${dealer.slug}`}
                        className="text-xs font-semibold hover:underline flex items-center gap-1 flex-shrink-0 text-[#01BBDC]">
                        View all <ExternalLink size={10} />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons row */}
              <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200 bg-gray-50 rounded-b-3xl">
                <button onClick={toggleSave}
                  className="flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors"
                  style={{ color: saved ? '#01BBDC' : '#10214F' }}>
                  <Heart size={18} fill={saved ? 'currentColor' : 'none'} strokeWidth={2} />
                  {saved ? 'Saved' : 'Save'}
                </button>
                <div className="relative">
                  <button onClick={() => setShowComp(!showComp)}
                    className="w-full flex flex-col items-center gap-1.5 py-4 text-xs font-semibold hover:bg-white transition-colors"
                    style={{ color: inComp ? '#01BBDC' : '#10214F' }}>
                    {inComp ? <Check size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
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
                    <Share2 size={18} strokeWidth={2} /> Share
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

        {/* ══ PHOTO STRIP: 1 large left + 2×2 right ══════════════════════════ */}
        {galleryItems.length > 1 && (
          <div className="grid gap-3 mb-12" style={{ gridTemplateColumns: '3fr 2fr', height: 300 }}>
            {/* Large left image */}
            <button type="button"
              className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 h-full"
              onClick={() => {
                const item = galleryItems[1];
                if (!item) return;
                if (item.file_type === 'image') {
                  const i = imageLightboxItems.findIndex(x => x.id === item.id);
                  if (i >= 0) setLightbox(i);
                } else if (item.file_type === 'video') {
                  window.open(item.url, '_blank');
                }
              }}>
              {galleryItems[1]?.file_type === 'video' ? (
                <>
                  <img src={mediaUrl(galleryItems[1].thumbnail_url) || FALLBACK_LISTING_IMAGE}
                    alt={`${listing.title} video`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <PlayCircle size={28} className="text-white" />
                  </div>
                </>
              ) : (
                <img src={mediaUrl(galleryItems[1]?.thumbnail_url || galleryItems[1]?.url) || FALLBACK_LISTING_IMAGE}
                  alt={`${listing.title} photo 2`} className="w-full h-full object-cover" />
              )}
            </button>

            {/* 2×2 right grid */}
            <div className="grid grid-cols-2 gap-3 h-full">
              {galleryItems.slice(2, 6).map((item, idx) => {
                const isLast = idx === 3;
                const remaining = Math.max(galleryItems.length - 6, 0);
                return (
                  <button key={item.id} type="button"
                    className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100"
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
                        <img src={mediaUrl(item.thumbnail_url) || FALLBACK_LISTING_IMAGE}
                          alt={`${listing.title} video`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <PlayCircle size={22} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <img src={mediaUrl(item.thumbnail_url || item.url) || FALLBACK_LISTING_IMAGE}
                        alt={`${listing.title} photo ${idx + 3}`} className="w-full h-full object-cover" />
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
          </div>
        )}

        {/* PDF documents */}
        {pdfItems.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-6">
            <h4 className="text-sm font-bold text-[#10214F] mb-3 uppercase tracking-wide font-bahnschrift">Documents</h4>
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

        {/* ══ KEY SPECS & KEY FEATURES (LEFT) + MAP & FINANCE (RIGHT) ═════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">

          {/* Left column: Key Specs + Key Features — 8 cols */}
          <div className="lg:col-span-8 space-y-8">

            {/* KEY SPECIFICATIONS — icon strip matching Figma */}
            <div>
              <h3 className="text-xl font-bold text-[#01BBDC] mb-2 font-bahnschrift">Key Specifications</h3>
              <div className="h-[1px] bg-[#01BBDC] mb-5" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                {[
                  { icon: <Ruler size={28} className="text-[#01BBDC]" />, label: 'Length',       value: listing.length_feet ? `${listing.length_feet} ft` : null },
                  { icon: <Users size={28} className="text-[#01BBDC]" />, label: 'Guests',        value: listing.berths ? String(listing.berths) : null },
                  { icon: <Bed size={28} className="text-[#01BBDC]" />,   label: 'Cabins',        value: listing.cabins ? String(listing.cabins) : null },
                  { icon: <Ship size={28} className="text-[#01BBDC]" />,  label: 'Type',          value: listing.boat_type },
                  { icon: <Wrench size={28} className="text-[#01BBDC]" />,label: 'Make',          value: listing.make },
                  { icon: <Gauge size={28} className="text-[#01BBDC]" />, label: 'Year',          value: listing.year ? String(listing.year) : null },
                  { icon: <Waves size={28} className="text-[#01BBDC]" />, label: 'Cruise Speed',  value: listing.cruising_speed_knots ? `${listing.cruising_speed_knots} kts` : null },
                  { icon: <Gauge size={28} className="text-[#01BBDC]" />, label: 'Max Speed',     value: listing.max_speed_knots ? `${listing.max_speed_knots} kts` : null },
                  { icon: <Fuel size={28} className="text-[#01BBDC]" />,  label: 'Fuel Type',     value: listing.fuel_type },
                  { icon: <Ship size={28} className="text-[#01BBDC]" />,  label: 'Engines',       value: listing.engine_count ? String(listing.engine_count) : ((listing.additional_engines?.length || 0) > 0 ? String(listing.additional_engines?.length) : null) },
                  { icon: <MapPin size={28} className="text-[#01BBDC]" />,label: 'Location',      value: locationString || null },
                  { icon: <Calendar size={28} className="text-[#01BBDC]" />, label: 'Listed',     value: listing.published_at ? new Date(listing.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null },
                ].filter(s => s.value).map(s => (
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

            {/* KEY FEATURES */}
            {keyFeatures.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-[#01BBDC] mb-2 font-bahnschrift">Key Features</h3>
                <div className="h-[1px] bg-[#01BBDC] mb-2" />
                <ul className="space-y-2">
                  {keyFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-[#10214F] font-poppins">
                      <span className="text-[#01BBDC] mt-1 flex-shrink-0">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
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

        {/* ══ DESCRIPTION ════════════════════════════════════════════════════ */}
        {listing.description && (
          <div className="mb-10">
            <SectionHeading>Description</SectionHeading>
            <div className="prose prose-lg max-w-none">
              <div
                className="text-base leading-relaxed text-[#10214F] font-poppins"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            </div>
          </div>
        )}

        {/* ══ FULL SPECIFICATIONS ════════════════════════════════════════════ */}
        <div className="mb-10">
          <SectionHeading>Full Specifications</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h4 className="font-bold text-[#10214F] mb-3 text-sm uppercase tracking-wide font-bahnschrift">General</h4>
              <SpecRow label="Name"           value={listing.title} />
              <SpecRow label="Stock #"        value={id} />
              <SpecRow label="Status"         value={listing.status === 'active' ? 'Available' : listing.status === 'sold' ? 'Sold' : listing.status || null} />
              <SpecRow label="Make"           value={listing.make} />
              <SpecRow label="Model"          value={listing.model} />
              <SpecRow label="Year"           value={listing.year ? String(listing.year) : null} />
              <SpecRow label="Type"           value={listing.boat_type} />
              <SpecRow label="Condition"      value={listing.condition ? (listing.condition.charAt(0).toUpperCase() + listing.condition.slice(1)) : null} />
              <SpecRow label="Previous Owners" value={listing.previous_owners != null ? String(listing.previous_owners) : null} />
            </div>
            
            <div className="space-y-1">
              <h4 className="font-bold text-[#10214F] mb-3 text-sm uppercase tracking-wide font-bahnschrift">Dimensions</h4>
              <SpecRow label="LOA"            value={listing.length_feet ? `${listing.length_feet} ft` : null} />
              <SpecRow label="Beam"           value={listing.beam_feet ? `${listing.beam_feet} ft` : null} />
              <SpecRow label="Draft"          value={listing.draft_feet ? `${listing.draft_feet} ft` : null} />
              <SpecRow label="Hull Material"  value={listing.hull_material} />
              <SpecRow label="Hull Type"      value={listing.hull_type} />
              
              <h4 className="font-bold text-[#10214F] mb-3 mt-5 text-sm uppercase tracking-wide font-bahnschrift">Accommodations</h4>
              <SpecRow label="Cabins"         value={listing.cabins ? String(listing.cabins) : null} />
              <SpecRow label="Berths"         value={listing.berths ? String(listing.berths) : null} />
              <SpecRow label="Heads"          value={listing.heads  ? String(listing.heads)  : null} />
            </div>
            
            <div className="space-y-1">
              <h4 className="font-bold text-[#10214F] mb-3 text-sm uppercase tracking-wide font-bahnschrift">Performance</h4>
              <SpecRow label="Max Speed"      value={listing.max_speed_knots ? `${listing.max_speed_knots} kts` : null} />
              <SpecRow label="Cruise Speed"   value={listing.cruising_speed_knots ? `${listing.cruising_speed_knots} kts` : null} />
              <SpecRow label="Fuel Type"      value={listing.fuel_type} />
              <SpecRow label="Fuel Capacity"  value={listing.fuel_capacity_gallons ? `${fmt(listing.fuel_capacity_gallons)} gal` : null} />
              <SpecRow label="Water Capacity" value={listing.water_capacity_gallons ? `${fmt(listing.water_capacity_gallons)} gal` : null} />
              <SpecRow label="Displacement"   value={listing.additional_specs?.displacement_lbs ? `${fmt(listing.additional_specs.displacement_lbs)} lbs` : null} />
              <SpecRow label="Dry Weight"     value={listing.additional_specs?.dry_weight_lbs ? `${fmt(listing.additional_specs.dry_weight_lbs)} lbs` : null} />
              <SpecRow label="Bridge Clearance" value={listing.additional_specs?.bridge_clearance_feet ? `${listing.additional_specs.bridge_clearance_feet} ft` : null} />
              <SpecRow label="Deadrise"       value={listing.additional_specs?.deadrise_degrees ? `${listing.additional_specs.deadrise_degrees}°` : null} />
              <SpecRow label="Range"          value={listing.additional_specs?.cruising_range_nm ? `${fmt(listing.additional_specs.cruising_range_nm)} nm` : null} />
              <SpecRow label="Fuel Burn"      value={listing.additional_specs?.fuel_burn_gph ? `${listing.additional_specs.fuel_burn_gph} gph` : null} />
              <SpecRow label="Holding Tank"   value={listing.additional_specs?.holding_tank_gallons ? `${fmt(listing.additional_specs.holding_tank_gallons)} gal` : null} />
              
              <h4 className="font-bold text-[#10214F] mb-3 mt-5 text-sm uppercase tracking-wide font-bahnschrift">Listing Details</h4>
              <SpecRow label="Listed"         value={listing.published_at ? new Date(listing.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null} />
            </div>
          </div>
        </div>

        {/* ══ ENGINES ════════════════════════════════════════════════════════ */}
        {/* NOTE: Backend currently supports single engine data with engine_count.
            For full multi-engine support, backend would need a separate engines table. */}
        {(() => {
          // Build engines array without duplicating primary/additional entries.
          const engines: Array<any> = [];
          const hasPrimary = listing.engine_hours != null || listing.engine_count;
          if (hasPrimary) {
            engines.push({
              make: null,
              model: null,
              type: null,
              hours: listing.engine_hours != null ? listing.engine_hours : null,
              horsepower: null,
              note: null,
              isPrimaryFallback: !((listing.additional_engines || []).length > 0) && !!listing.engine_count,
            });
          }

          if (Array.isArray(listing.additional_engines) && listing.additional_engines.length > 0) {
            for (const e of listing.additional_engines) {
              engines.push(e);
            }
          }

          const gens = Array.isArray(listing.generators) ? listing.generators.slice(0, 2) : [];

          if (engines.length === 0 && gens.length === 0) return null;

          return (
            <div className="mb-10">
              <SectionHeading>Engine Details</SectionHeading>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {engines.length > 0 ? (
                  // If we have explicit engine entries, render them (max 4)
                  engines.slice(0, 4).map((engine, idx) => (
                    <div key={`engine-${idx}`} className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200">
                      <h4 className="text-xl font-bold text-[#10214F] mb-4 font-bahnschrift">{engines.length > 1 ? `Engine ${idx + 1}` : 'Engine'}</h4>
                      <div className="space-y-1">
                        <SpecRow label="Make" value={engine.make} />
                        <SpecRow label="Model" value={engine.model} />
                        <SpecRow label="Type" value={engine.type} />
                        <SpecRow label="Hours" value={engine.hours != null ? fmt(engine.hours) : null} />
                        <SpecRow label="Horsepower" value={engine.horsepower != null ? `${fmt(engine.horsepower)} hp` : null} />
                        <SpecRow label="Notes" value={engine.notes || engine.note || null} />
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback: show primary spec once if only engine_count present
                  listing.engine_count ? (
                    <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200">
                      <h4 className="text-xl font-bold text-[#10214F] mb-4 font-bahnschrift">Engine</h4>
                      <div className="space-y-1">
                        <SpecRow label="Fuel" value={listing.fuel_type} />
                        <SpecRow label="Hours" value={listing.engine_hours != null ? fmt(listing.engine_hours) : null} />
                      </div>
                    </div>
                  ) : null
                )}

                {gens.map((generator, idx) => (
                  <div key={`generator-${idx}`} className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200">
                    <h4 className="text-xl font-bold text-[#10214F] mb-4 font-bahnschrift">Generator {idx + 1}</h4>
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
              <div className="text-base leading-relaxed text-[#10214F] font-poppins">
                {equipmentLines.map((line: string, i: number) => {
                  const isSectionHeader = line.trim().length > 0 && line.trim().length < 50 && line.trim() === line.trim().toUpperCase();
                  return isSectionHeader ? (
                    <h4 key={i} className="text-xl font-bold text-[#10214F] mt-8 mb-3 first:mt-0 font-bahnschrift">
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