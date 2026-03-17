'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Heart, Download, MapPin, Calendar, ArrowLeft, Mail, Ship, Share2, 
  Facebook, Twitter, Linkedin, MessageCircle, Link2, Printer, Plus, 
  Check, Phone, X, ChevronLeft, ChevronRight, Building2, User,
  ExternalLink, Globe, Users, Wrench, Anchor, Youtube, Bed, Gauge, 
  Fuel, Waves, Ruler, Navigation, Droplet, Zap, Wind, ZoomIn, ZoomOut, 
  FileText, PlayCircle, Instagram, Send
} from 'lucide-react';
import { API_ROOT, mediaUrl, onImgError, FALLBACK_IMAGE } from '@/app/lib/apiRoot';

const ListingDetailMap = dynamic(() => import('../../components/ListingDetailMap'), { ssr: false });

// ═══ Types ═══════════════════════════════════════════════════════════

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
    displacement_lbs?: number; dry_weight_lbs?: number;
    bridge_clearance_feet?: number; deadrise_degrees?: number;
    cruising_range_nm?: number; fuel_burn_gph?: number;
    holding_tank_gallons?: number;
  };
  youtube_video_url?: string; vimeo_video_url?: string; video_tour_url?: string;
  has_video?: boolean; featured?: boolean; published_at?: string;
  previous_owners?: number;
  additional_engines?: Array<{
    make?: string; model?: string; type?: string; hours?: number;
    horsepower?: number; notes?: string;
  }>;
  generators?: Array<{
    brand?: string; model?: string; hours?: number;
    kw?: number; notes?: string;
  }>;
  images?: ListingImage[];
  latitude?: number; longitude?: number;
}

interface MediaItem {
  id: number; url: string; file_type: 'image' | 'video' | 'pdf';
  thumbnail_url?: string; is_primary?: boolean; display_order?: number; 
  caption?: string; alt_text?: string;
}

interface ContactInfo {
  dealer: {
    id?: number; name?: string; company_name?: string; email?: string; phone?: string;
    logo_url?: string; slug?: string; address?: string; city?: string; state?: string;
    country?: string; website?: string; description?: string;
    facebook_url?: string; instagram_url?: string; twitter_url?: string; 
    linkedin_url?: string; is_demo?: boolean;
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

// ═══ Helpers ═════════════════════════════════════════════════════════

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

// ═══ Main Component ══════════════════════════════════════════════════

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // gallery lightbox
  const [lightbox, setLightbox] = useState<number | null>(null);

  // actions
  const [saved, setSaved] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // finance
  const [finIn, setFinIn] = useState({ 
    down_payment_percent: 20, 
    interest_rate: 6.49, 
    term_years: 20 
  });
  const [finOut, setFinOut] = useState<FinResult | null>(null);

  // message modal
  const [showMsg, setShowMsg] = useState(false);
  const [msgForm, setMsgForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgDone, setMsgDone] = useState(false);

  // ══ fetch ════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!id || id === 'undefined') return;
    setLoading(true);
    Promise.all([
      fetchListing(), 
      fetchMedia(), 
      fetchContact(), 
      checkSaved()
    ]).finally(() => setLoading(false));
  }, [id]);

  async function fetchListing() {
    try { 
      const r = await fetch(`${API_ROOT}/listings/${id}`); 
      if (r.ok) setListing(await r.json()); 
    } catch {}
  }
  
  async function fetchMedia() {
    try { 
      const r = await fetch(`${API_ROOT}/listings/${id}/media`); 
      if (r.ok) { 
        const d = await r.json(); 
        setMedia(d.media || []); 
      } 
    } catch {}
  }
  
  async function fetchContact() {
    try { 
      const r = await fetch(`${API_ROOT}/listings/${id}/contact-info`); 
      if (r.ok) setContact(await r.json()); 
    } catch {}
  }
  
  async function checkSaved() {
    const token = localStorage.getItem('token'); 
    if (!token) return;
    try { 
      const r = await fetch(`${API_ROOT}/saved-listings`, { 
        headers: { Authorization: `Bearer ${token}` } 
      }); 
      if (r.ok) { 
        const d = await r.json(); 
        setSaved(d.some((i: any) => i.listing_id === Number(id))); 
      } 
    } catch {}
  }

  // ══ actions ══════════════════════════════════════════════════════════

  async function toggleSave() {
    const token = localStorage.getItem('token'); 
    if (!token) return alert('Please log in to save listings');
    
    if (saved) {
      const r = await fetch(`${API_ROOT}/saved-listings`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const d = await r.json(); 
      const item = d.find((i: any) => i.listing_id === Number(id));
      if (item) { 
        await fetch(`${API_ROOT}/saved-listings/${item.id}`, { 
          method: 'DELETE', 
          headers: { Authorization: `Bearer ${token}` } 
        }); 
        setSaved(false); 
      }
    } else {
      await fetch(`${API_ROOT}/saved-listings`, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        }, 
        body: JSON.stringify({ listing_id: Number(id) }) 
      });
      setSaved(true);
    }
  }

  async function doShare(platform: string) {
    const url = `${window.location.origin}/listings/${id}`;
    const text = listing ? `${listing.title}${listing.price ? ` — $${fmt(listing.price)}` : ''}` : '';
    
    try { 
      await fetch(`${API_ROOT}/listings/${id}/track-share`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ platform }) 
      }); 
    } catch {}
    
    const map: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(listing?.title || 'Yacht')}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    };
    
    if (map[platform]) window.open(map[platform], '_blank', 'width=600,height=400');
    setShowShare(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/listings/${id}`);
    setCopied(true); 
    setTimeout(() => { setCopied(false); setShowShare(false); }, 2000);
  }

  async function calcFinance() {
    if (!listing?.price) return;
    
    try { 
      const r = await fetch(`${API_ROOT}/listings/${id}/calculate-financing`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(finIn) 
      }); 
      if (r.ok) setFinOut(await r.json()); 
    } catch {}
  }

  useEffect(() => {
    if (listing?.price) calcFinance();
  }, [listing?.price, finIn.down_payment_percent, finIn.interest_rate, finIn.term_years]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault(); 
    setMsgBusy(true);
    
    try {
      const token = localStorage.getItem('token');
      const sc = contact?.sales_contact;
      const dealer = contact?.dealer;
      const recipId = sc?.id ?? dealer?.id ?? listing?.created_by_user_id ?? listing?.user_id;
      
      if (token && recipId) {
        await fetch(`${API_ROOT}/messages`, { 
          method: 'POST', 
          headers: { 
            Authorization: `Bearer ${token}`, 
            'Content-Type': 'application/json' 
          }, 
          body: JSON.stringify({ 
            subject: `Inquiry about: ${listing?.title || 'Listing #' + id}`, 
            body: msgForm.message, 
            message_type: 'inquiry', 
            recipient_id: recipId, 
            listing_id: Number(id) 
          }) 
        });
      } else {
        await fetch(`${API_ROOT}/inquiries`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            sender_name: msgForm.name, 
            sender_email: msgForm.email, 
            sender_phone: msgForm.phone || undefined, 
            message: msgForm.message, 
            listing_id: Number(id) 
          }) 
        });
      }
      
      setMsgDone(true); 
      setMsgForm({ name: '', email: '', phone: '', message: '' });
    } catch {}
    
    setMsgBusy(false);
  }

  // ══ assemble media ═══════════════════════════════════════════════════

  const visualItems: MediaItem[] = media.length > 0
    ? media.filter(m => m.file_type === 'image' || m.file_type === 'video')
    : (listing?.images || []).map(img => ({ 
        id: img.id, 
        url: img.url, 
        thumbnail_url: img.thumbnail_url, 
        file_type: 'image' as const, 
        is_primary: img.is_primary, 
        display_order: img.display_order 
      }));

  const galleryItems: MediaItem[] = [...visualItems].sort((a, b) => {
    const aPrimary = a.is_primary ? 0 : 1;
    const bPrimary = b.is_primary ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    const aOrder = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.display_order ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
  
  const imageLightboxItems: MediaItem[] = galleryItems.filter(i => i.file_type === 'image');

  const sc = contact?.sales_contact;
  const dealer = contact?.dealer;
  const primaryPhone = sc?.phone || dealer?.phone;
  const recipientName = sc?.name || dealer?.company_name || dealer?.name || 'Seller';

  const locationParts = [listing?.city, listing?.state, listing?.country].filter(Boolean);
  const locationString = locationParts.join(', ');

  // ══ loading / not found ══════════════════════════════════════════════

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-14 h-14 rounded-full border-4 border-t-[#01BBDC] border-[#01BBDC]/20 animate-spin" />
    </div>
  );
  
  if (!listing) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4 text-[#10214F]">Listing not found</h2>
        <button onClick={() => router.back()} 
          className="text-[#01BBDC] hover:underline font-medium">
          ← Back to listings
        </button>
      </div>
    </div>
  );

  // ══ render ═══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-white">
      
      {/* LIGHTBOX */}
      {lightbox !== null && imageLightboxItems.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <X size={22} className="text-white" />
          </button>
          <button onClick={e => { e.stopPropagation(); setLightbox(i => ((i ?? 0) - 1 + imageLightboxItems.length) % imageLightboxItems.length); }}
            className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <ChevronLeft size={28} className="text-white" />
          </button>
          <img src={mediaUrl(imageLightboxItems[lightbox]?.url)} onError={onImgError} 
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            alt={`${listing.title} photo ${(lightbox ?? 0) + 1}`}
            onClick={e => e.stopPropagation()} />
          <button onClick={e => { e.stopPropagation(); setLightbox(i => ((i ?? 0) + 1) % imageLightboxItems.length); }}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <ChevronRight size={28} className="text-white" />
          </button>
          <div className="absolute bottom-6 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white text-sm">
            {(lightbox ?? 0) + 1} / {imageLightboxItems.length}
          </div>
        </div>
      )}

      {/* MESSAGE MODAL */}
      {showMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10214F]/80 backdrop-blur-sm"
          onClick={() => setShowMsg(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" 
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-[#10214F]">Contact {recipientName}</h3>
                {sc?.title && <p className="text-sm text-gray-500 mt-1">{sc.title}</p>}
              </div>
              <button onClick={() => setShowMsg(false)} 
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-6">
              {msgDone ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 bg-green-50">
                    <Check size={36} className="text-green-600" />
                  </div>
                  <p className="font-bold text-xl mb-2 text-[#10214F]">Message sent!</p>
                  <p className="text-sm text-gray-600 mb-6">{recipientName} will be in touch shortly.</p>
                  <button onClick={() => { setMsgDone(false); setShowMsg(false); }}
                    className="px-8 py-3 rounded-xl text-white font-semibold bg-[#01BBDC] hover:opacity-90 transition-all">
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={sendMessage} className="space-y-4">
                  {!localStorage.getItem('token') && (
                    <>
                      <div>
                        <label className="text-sm font-semibold block mb-2 text-gray-700">Name *</label>
                        <input required value={msgForm.name} 
                          onChange={e => setMsgForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold block mb-2 text-gray-700">Email *</label>
                        <input required type="email" value={msgForm.email} 
                          onChange={e => setMsgForm(p => ({ ...p, email: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold block mb-2 text-gray-700">Phone</label>
                        <input value={msgForm.phone} 
                          onChange={e => setMsgForm(p => ({ ...p, phone: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC]" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-sm font-semibold block mb-2 text-gray-700">Message *</label>
                    <textarea required rows={5} value={msgForm.message} 
                      onChange={e => setMsgForm(p => ({ ...p, message: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] resize-none" />
                  </div>
                  <button type="submit" disabled={msgBusy}
                    className="w-full py-3.5 rounded-xl text-white font-semibold bg-[#01BBDC] hover:opacity-90 disabled:opacity-60 transition-all">
                    {msgBusy ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION WITH IMAGE BACKGROUND */}
      <div className="relative h-[400px] bg-cover bg-center" 
        style={{ 
          backgroundImage: galleryItems[0] ? `url(${mediaUrl(galleryItems[0].url)})` : 'none',
          backgroundColor: '#10214F'
        }}>
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50" />
        
        {/* Gradient overlay from left */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent" 
          style={{ width: '40%' }} />
        
        {/* Content */}
        <div className="relative h-full max-w-[1296px] mx-auto px-8 flex items-center">
          <div>
            <h1 className="text-[56px] font-bold text-[#10214F] leading-none mb-4" 
              style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
              {listing.title}
            </h1>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-[1296px] mx-auto px-8 py-12">
        
        {/* Title + Price Row */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-[30px] font-semibold text-[#10214F] mb-2"
              style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
              {listing.title}
            </h2>
            <p className="text-[16px] text-[#10214F]" 
              style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
              {listing.length_feet}ft - {listing.fuel_type} - {listing.boat_type}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[30px] font-bold text-[#01BBDC]"
              style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
              ${listing.price ? fmt(listing.price) : 'Contact'}
            </p>
          </div>
        </div>

        {/* Image Gallery + Seller Info */}
        <div className="grid grid-cols-12 gap-8 mb-12">
          
          {/* Left: Image Gallery (8 cols) */}
          <div className="col-span-8">
            {/* Main image */}
            {galleryItems[0] && (
              <div className="relative rounded-[50px] overflow-hidden mb-3 cursor-pointer"
                style={{ height: '500px' }}
                onClick={() => setLightbox(0)}>
                <img src={mediaUrl(galleryItems[0].url)} onError={onImgError}
                  alt={listing.title}
                  className="w-full h-full object-cover" />
              </div>
            )}
            
            {/* Thumbnail grid */}
            {galleryItems.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {galleryItems.slice(1, 6).map((item, idx) => (
                  <div key={item.id} 
                    className="relative rounded-xl overflow-hidden cursor-pointer"
                    style={{ height: '120px' }}
                    onClick={() => setLightbox(idx + 1)}>
                    <img src={mediaUrl(item.thumbnail_url || item.url)} onError={onImgError}
                      alt={`${listing.title} ${idx + 2}`}
                      className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Seller Info + Actions (4 cols) */}
          <div className="col-span-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
              
              {/* Location */}
              {locationString && (
                <div className="flex items-center gap-2 text-[#10214F] mb-3"
                  style={{ fontFamily: 'Poppins, Arial, sans-serif', fontSize: '16px' }}>
                  <MapPin size={24} className="text-[#01BBDC]" />
                  <span>{locationString}</span>
                </div>
              )}
              
              {/* Stock number */}
              <p className="text-[16px] text-[#10214F] mb-6"
                style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                In Stock #{listing.id}
              </p>
              
              <div className="border-t border-gray-200 pt-6 mb-6" />
              
              {/* Seller profile */}
              {(sc || dealer) && (
                <div className="mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    {(sc?.photo_url || dealer?.logo_url) ? (
                      <img src={mediaUrl(sc?.photo_url || dealer?.logo_url || '')} 
                        alt={sc?.name || dealer?.company_name || ''}
                        className="w-[133px] h-[133px] rounded-full object-cover"
                        onError={onImgError} />
                    ) : (
                      <div className="w-[133px] h-[133px] rounded-full bg-gray-100 flex items-center justify-center">
                        <User size={48} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[16px] font-medium text-[#01BBDC]"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                      {sc?.name || dealer?.company_name || dealer?.name}
                    </p>
                    {(dealer?.company_name || dealer?.address) && (
                      <p className="text-[16px] text-[#10214F]"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                        {dealer?.company_name || dealer?.address}
                      </p>
                    )}
                    {dealer?.address && (
                      <p className="text-[16px] text-[#10214F]"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                        {dealer.address}
                      </p>
                    )}
                    {primaryPhone && (
                      <p className="text-[16px] text-[#10214F]"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                        {primaryPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* CTA Buttons */}
              <div className="space-y-3">
                <button onClick={() => setShowMsg(true)}
                  className="w-full py-3.5 rounded-xl text-white font-medium text-[16px] bg-[#01BBDC] hover:opacity-90 transition-all"
                  style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                  Contact Seller
                </button>
                {primaryPhone && (
                  <button onClick={() => window.location.href = `tel:${primaryPhone}`}
                    className="w-full py-3.5 rounded-xl font-medium text-[16px] border border-[#01BBDC] text-[#01BBDC] hover:bg-[#01BBDC] hover:text-white transition-all"
                    style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                    Call Seller
                  </button>
                )}
              </div>
              
              {/* Social Media */}
              {(dealer?.facebook_url || dealer?.instagram_url || dealer?.twitter_url || dealer?.linkedin_url) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-[16px] text-[#10214F] mb-3"
                    style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                    Social Media:
                  </p>
                  <div className="flex items-center gap-2">
                    {dealer?.facebook_url && (
                      <a href={dealer.facebook_url} target="_blank" rel="noopener noreferrer"
                        className="text-[#01BBDC] hover:opacity-70 transition-opacity">
                        <Facebook size={24} />
                      </a>
                    )}
                    {dealer?.instagram_url && (
                      <a href={dealer.instagram_url} target="_blank" rel="noopener noreferrer"
                        className="text-[#01BBDC] hover:opacity-70 transition-opacity">
                        <Instagram size={24} />
                      </a>
                    )}
                    {dealer?.twitter_url && (
                      <a href={dealer.twitter_url} target="_blank" rel="noopener noreferrer"
                        className="text-[#01BBDC] hover:opacity-70 transition-opacity">
                        <Twitter size={24} />
                      </a>
                    )}
                    {dealer?.linkedin_url && (
                      <a href={dealer.linkedin_url} target="_blank" rel="noopener noreferrer"
                        className="text-[#01BBDC] hover:opacity-70 transition-opacity">
                        <Linkedin size={24} />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Boat Details Section */}
        <div className="grid grid-cols-12 gap-8 mb-12">
          
          {/* Left: Details (6 cols) */}
          <div className="col-span-6">
            <h3 className="text-[30px] font-semibold text-[#10214F] mb-6"
              style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
              {listing.model}
            </h3>
            
            <p className="text-[16px] text-[#10214F] mb-8"
              style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
              {listing.length_feet}m | {listing.make} | {listing.model}
            </p>
            
            {/* Icon Grid */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              {listing.berths && (
                <div className="text-center">
                  <div className="w-9 h-9 mx-auto mb-2">
                    <Users size={36} className="text-[#01BBDC]" />
                  </div>
                  <p className="text-[16px] font-semibold text-[#10214F]"
                    style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                    Guests
                  </p>
                  <p className="text-[16px] text-[#10214F]"
                    style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                    {listing.berths}
                  </p>
                </div>
              )}
              
              {listing.cabins && (
                <div className="text-center">
                  <div className="w-9 h-9 mx-auto mb-2">
                    <Bed size={36} className="text-[#01BBDC]" />
                  </div>
                  <p className="text-[16px] font-semibold text-[#10214F]"
                    style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                    Cabins
                  </p>
                  <p className="text-[16px] text-[#10214F]"
                    style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                    {listing.cabins}
                  </p>
                </div>
              )}
              
              {listing.engine_count && (
                <div className="text-center">
                  <div className="w-9 h-9 mx-auto mb-2">
                    <Wrench size={36} className="text-[#01BBDC]" />
                  </div>
                  <p className="text-[16px] font-semibold text-[#10214F]"
                    style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                    Crew
                  </p>
                  <p className="text-[16px] text-[#10214F]"
                    style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                    {listing.engine_count}
                  </p>
                </div>
              )}
            </div>
            
            {/* More details */}
            <div className="space-y-4">
              {listing.make && (
                <div className="flex items-center gap-3">
                  <Ship size={36} className="text-[#01BBDC]" />
                  <div>
                    <p className="text-[16px] font-semibold text-[#10214F]"
                      style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                      {listing.make}
                    </p>
                    <p className="text-[16px] text-[#10214F]"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                      Shipyard
                    </p>
                  </div>
                </div>
              )}
              
              {listing.model && (
                <div className="flex items-center gap-3">
                  <Ship size={30} className="text-[#01BBDC]" />
                  <div>
                    <p className="text-[16px] font-semibold text-[#10214F]"
                      style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                      {listing.model}
                    </p>
                    <p className="text-[16px] text-[#10214F]"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                      Model
                    </p>
                  </div>
                </div>
              )}
              
              {listing.length_feet && (
                <div className="flex items-center gap-3">
                  <Ruler size={36} className="text-[#01BBDC]" />
                  <div>
                    <p className="text-[16px] font-semibold text-[#10214F]"
                      style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                      {listing.length_feet}m
                    </p>
                    <p className="text-[16px] text-[#10214F]"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                      Length
                    </p>
                  </div>
                </div>
              )}
              
              {listing.year && (
                <div className="flex items-center gap-3">
                  <Calendar size={36} className="text-[#01BBDC]" />
                  <div>
                    <p className="text-[16px] font-semibold text-[#10214F]"
                      style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                      {listing.year}
                    </p>
                    <p className="text-[16px] text-[#10214F]"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                      Build/Refit
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Financing Calculator (6 cols) */}
          <div className="col-span-6">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              
              {/* Inputs side */}
              <div className="p-6 bg-white">
                <div className="space-y-4">
                  <div>
                    <label className="text-[14px] text-[#10214F] block mb-2"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                      Purchase Price
                    </label>
                    <input type="text" value={`$${listing.price ? fmt(listing.price) : '0'}`}
                      readOnly
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white text-[14px]"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }} />
                  </div>
                  
                  <div>
                    <label className="text-[14px] text-[#10214F] block mb-2"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                      Down Payment
                    </label>
                    <input type="text" value="$0.00"
                      readOnly
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white text-[14px]"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }} />
                  </div>
                  
                  <div>
                    <label className="text-[14px] text-[#10214F] block mb-2"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                      Loan amount
                    </label>
                    <input type="text" 
                      value={`$${listing.price ? fmt(listing.price * (1 - finIn.down_payment_percent / 100)) : '0'}`}
                      readOnly
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white text-[14px]"
                      style={{ fontFamily: 'Poppins, Arial, sans-serif' }} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[14px] text-[#10214F] block mb-2"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                        Loan term in years
                      </label>
                      <input type="number" value={finIn.term_years}
                        onChange={e => setFinIn(p => ({ ...p, term_years: Number(e.target.value) }))}
                        className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white text-[14px]"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }} />
                    </div>
                    <div>
                      <label className="text-[14px] text-[#10214F] block mb-2"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                        Loan term in months
                      </label>
                      <input type="text" value={finIn.term_years * 12}
                        readOnly
                        className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white text-[14px]"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[14px] text-[#10214F] block mb-2"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                        Interest Rate (APR)
                      </label>
                      <input type="number" step="0.01" value={finIn.interest_rate}
                        onChange={e => setFinIn(p => ({ ...p, interest_rate: Number(e.target.value) }))}
                        className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white text-[14px]"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }} />
                    </div>
                    <div className="flex items-end">
                      <button onClick={calcFinance}
                        className="w-full py-3 rounded-md text-white text-[14px] bg-[#01BBDC] hover:opacity-90 transition-all"
                        style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                        Calculate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Results side */}
              <div className="p-6 bg-[#F0FDFF]">
                <p className="text-[24px] font-semibold text-[#10214F] mb-2"
                  style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                  Monthly Payment
                </p>
                <p className="text-[48px] font-semibold text-[#10214F] mb-4"
                  style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                  ${finOut ? fmt(finOut.monthly_payment) : '1,970.48'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Description + Image */}
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-6">
            <h3 className="text-[30px] font-semibold text-[#01BBDC] mb-4"
              style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
              Description
            </h3>
            <div className="h-[1px] bg-[#01BBDC] mb-6" />
            
            {listing.description && (
              <div className="text-[16px] text-[#10214F] leading-relaxed space-y-4"
                style={{ fontFamily: 'Poppins, Arial, sans-serif' }}
                dangerouslySetInnerHTML={{ 
                  __html: listing.description.replace(/\n/g, '<br />') 
                }} />
            )}
          </div>
          
          <div className="col-span-6">
            {galleryItems[1] && (
              <div className="rounded-xl overflow-hidden">
                <img src={mediaUrl(galleryItems[1].url)} onError={onImgError}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                  style={{ height: '393px' }} />
              </div>
            )}
          </div>
        </div>

        {/* Specification */}
        <div className="mb-12">
          <h3 className="text-[30px] font-semibold text-[#01BBDC] mb-4"
            style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
            Specification
          </h3>
          <div className="h-[1px] bg-[#01BBDC] mb-6" />
          
          <div className="grid grid-cols-3 gap-x-12 gap-y-4 text-[16px]"
            style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
            {[
              { label: 'Name:', value: listing.title },
              { label: 'Stock:', value: `${listing.id}` },
              { label: 'Stock:', value: 'Yes' },
              { label: 'LOA:', value: listing.length_feet ? `${listing.length_feet} ft` : null },
              { label: 'Type:', value: listing.boat_type },
              { label: 'Year:', value: listing.year?.toString() },
              { label: 'Draft Max:', value: listing.draft_feet ? `${listing.draft_feet} ft` : null },
              { label: 'Cabins:', value: listing.cabins?.toString() },
              { label: 'Heads:', value: listing.heads?.toString() },
              { label: 'Maximum Speed:', value: listing.max_speed_knots ? `${listing.max_speed_knots} kts` : null },
              { label: 'Cruise Speed:', value: listing.cruising_speed_knots ? `${listing.cruising_speed_knots} kts` : null },
              { label: 'Fuel Type:', value: listing.fuel_type },
              { label: 'Hull Material:', value: listing.hull_material },
              { label: 'Hull Shape:', value: listing.hull_type },
              { label: 'Fuel Tank:', value: listing.fuel_capacity_gallons ? `${fmt(listing.fuel_capacity_gallons)} gal` : null },
              { label: 'Fresh Water:', value: listing.water_capacity_gallons ? `${fmt(listing.water_capacity_gallons)} gal` : null },
              { label: 'Holding Tank:', value: listing.additional_specs?.holding_tank_gallons ? `${fmt(listing.additional_specs.holding_tank_gallons)} gal` : null },
              { label: 'Dry Weight:', value: listing.additional_specs?.dry_weight_lbs ? `${fmt(listing.additional_specs.dry_weight_lbs)} lbs` : null },
            ].filter(spec => spec.value).map((spec, idx) => (
              <p key={idx} className="text-[#10214F]">
                <span className="font-normal">{spec.label}</span> {spec.value}
              </p>
            ))}
          </div>
        </div>

        {/* Engines */}
        {(listing.engine_make || listing.engine_model) && (
          <div className="mb-12">
            <h3 className="text-[30px] font-semibold text-[#01BBDC] mb-4"
              style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
              Engines
            </h3>
            <div className="h-[1px] bg-[#01BBDC] mb-6" />
            
            <div className="grid grid-cols-2 gap-x-12">
              <div>
                <h4 className="text-[24px] font-semibold text-[#10214F] mb-4"
                  style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
                  Engine 1
                </h4>
                <div className="space-y-2 text-[16px]"
                  style={{ fontFamily: 'Poppins, Arial, sans-serif' }}>
                  {listing.engine_make && <p>Engine Make: {listing.engine_make}</p>}
                  {listing.engine_model && <p>Engine Model: {listing.engine_model}</p>}
                  {listing.year && <p>Engine Year: {listing.year}</p>}
                  {listing.engine_type && <p>Engine Type: {listing.engine_type}</p>}
                  {listing.fuel_type && <p>Fuel Type: {listing.fuel_type}</p>}
                  {listing.engine_hours && <p>Hours: {fmt(listing.engine_hours)}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overview */}
        {listing.features && (
          <div className="mb-12">
            <h3 className="text-[30px] font-semibold text-[#01BBDC] mb-4"
              style={{ fontFamily: 'Bahnschrift, Arial, sans-serif' }}>
              Overview
            </h3>
            <div className="h-[1px] bg-[#01BBDC] mb-6" />
            
            <div className="text-[16px] text-[#10214F] leading-relaxed"
              style={{ fontFamily: 'Poppins, Arial, sans-serif' }}
              dangerouslySetInnerHTML={{ 
                __html: listing.features.replace(/\n/g, '<br />') 
              }} />
          </div>
        )}
      </div>
    </div>
  );
}
