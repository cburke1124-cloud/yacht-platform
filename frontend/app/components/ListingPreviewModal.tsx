'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin, Eye, Heart, Share2, Phone, Mail, MessageSquare, CheckCircle, Anchor, Fuel, BedDouble, Ruler } from 'lucide-react';
import { apiUrl, mediaUrl } from '@/app/lib/apiRoot';

interface PreviewListing {
  id: number;
  title: string;
  price?: number;
  year?: number;
  make?: string;
  model?: string;
  status: string;
  views: number;
  inquiries: number;
  featured: boolean;
  images: Array<{ url: string; is_primary?: boolean }>;
  city?: string;
  state?: string;
  // extended fields fetched on open
  description?: string;
  length_ft?: number;
  beam_ft?: number;
  draft_ft?: number;
  engine_hours?: number;
  hull_material?: string;
  fuel_type?: string;
  cabins?: number;
  berths?: number;
  dealer_name?: string;
  dealer_logo_url?: string;
  dealer_phone?: string;
  dealer_email?: string;
}

interface ListingPreviewModalProps {
  listing: PreviewListing | null;
  onClose: () => void;
}

function ImageCarousel({ images, title }: { images: Array<{ url: string }>; title: string }) {
  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === images.length - 1 ? 0 : i + 1));

  if (!images.length) {
    return (
      <div className="w-full h-[420px] bg-gray-100 flex items-center justify-center rounded-xl">
        <Anchor className="text-gray-300" size={56} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-[420px] rounded-xl overflow-hidden bg-gray-900 group">
      <img
        src={mediaUrl(images[idx]?.url)}
        alt={`${title} — image ${idx + 1}`}
        className="w-full h-full object-cover"
      />

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`transition-all rounded-full ${i === idx ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>

          {/* Counter */}
          <div className="absolute top-4 right-4 bg-black/50 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm">
            {idx + 1} / {images.length}
          </div>
        </>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 hidden sm:flex gap-2 px-4 pb-3 pt-8 bg-gradient-to-t from-black/50 to-transparent justify-center">
          {images.slice(0, 6).map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-12 h-9 rounded overflow-hidden flex-shrink-0 transition-all ${i === idx ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-90'}`}
            >
              <img src={mediaUrl(img.url)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="flex flex-col items-center gap-1 py-3 px-4 text-center">
      {Icon && <Icon size={16} className="text-[#01BBDC] mb-1" />}
      <span className="text-base font-bold text-[#10214F]">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default function ListingPreviewModal({ listing, onClose }: ListingPreviewModalProps) {
  const [detail, setDetail] = useState<PreviewListing | null>(null);
  const [fetching, setFetching] = useState(false);

  // Fetch full listing detail when opened
  useEffect(() => {
    if (!listing) { setDetail(null); return; }
    setDetail(listing); // show stub immediately
    setFetching(true);
    const token = localStorage.getItem('token');
    fetch(apiUrl(`/listings/${listing.id}`), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setDetail({ ...listing, ...data }); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [listing?.id]);

  if (!listing) return null;

  const d = detail ?? listing;
  const location = [d.city, d.state].filter(Boolean).join(', ');
  const specs = [
    d.year       && { label: 'Year',          value: String(d.year) },
    d.make       && { label: 'Make',           value: d.make },
    d.model      && { label: 'Model',          value: d.model },
    d.length_ft  && { label: 'Length',         value: `${d.length_ft} ft` },
    d.beam_ft    && { label: 'Beam',           value: `${d.beam_ft} ft` },
    d.draft_ft   && { label: 'Draft',          value: `${d.draft_ft} ft` },
    d.hull_material && { label: 'Hull',        value: d.hull_material },
    d.fuel_type  && { label: 'Fuel',           value: d.fuel_type },
    d.cabins     && { label: 'Cabins',         value: String(d.cabins) },
    d.berths     && { label: 'Berths',         value: String(d.berths) },
    d.engine_hours !== undefined && { label: 'Engine Hours', value: d.engine_hours!.toLocaleString() },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-5xl my-6 mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Preview Banner ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex items-center justify-between bg-[#10214F] px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-white text-sm font-semibold tracking-wide">
              LISTING PREVIEW — This is how buyers will see your listing
            </span>
            {d.status === 'draft' && (
              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded">
                DRAFT — Not yet published
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Main Content ───────────────────────────────────────────── */}
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left: images + details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Photo carousel */}
              <ImageCarousel images={d.images} title={d.title} />

              {/* Title + price */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#10214F] leading-tight">
                    {d.title || 'Untitled Listing'}
                  </h1>
                  {location && (
                    <div className="flex items-center gap-1.5 text-gray-500 mt-1.5">
                      <MapPin size={14} />
                      <span className="text-sm">{location}</span>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-3xl font-bold text-[#10214F]">
                    {d.price != null ? `$${d.price.toLocaleString()}` : 'Price on request'}
                  </div>
                  <div className="flex items-center gap-3 mt-1 justify-end text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Eye size={12} /> {d.views || 0} views</span>
                  </div>
                </div>
              </div>

              {/* Quick stats bar */}
              {(d.year || d.length_ft || d.make || d.engine_hours !== undefined) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 border border-gray-200 rounded-xl divide-x divide-gray-200 overflow-hidden">
                  {d.year       && <StatBox label="Year"      value={String(d.year)} />}
                  {d.length_ft  && <StatBox label="Length"    value={`${d.length_ft} ft`} icon={Ruler} />}
                  {d.make       && <StatBox label="Make"      value={d.make} icon={Anchor} />}
                  {d.engine_hours !== undefined && <StatBox label="Hours" value={d.engine_hours!.toLocaleString()} />}
                </div>
              )}

              {/* Description */}
              {d.description && (
                <div>
                  <h2 className="text-lg font-semibold text-[#10214F] mb-3">About this yacht</h2>
                  <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap">
                    {d.description}
                  </p>
                </div>
              )}

              {/* Specifications */}
              {specs.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-[#10214F] mb-3">Specifications</h2>
                  <div className="bg-gray-50 rounded-xl px-5 py-1">
                    {specs.map((spec) => (
                      <SpecRow key={spec.label} label={spec.label} value={spec.value} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: contact card + seller info */}
            <div className="lg:col-span-1 space-y-4">

              {/* Contact card */}
              <div
                className="rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4"
                style={{ position: 'sticky', top: 80 }}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#10214F]">
                    {d.price != null ? `$${d.price.toLocaleString()}` : 'Contact for price'}
                  </div>
                  {d.price && (
                    <span className="text-xs text-gray-400 mt-1 block">
                      Financing available · Save to compare
                    </span>
                  )}
                </div>

                {/* CTA buttons — disabled to make clear preview only */}
                <div className="space-y-2 pointer-events-none">
                  <button
                    className="w-full py-3.5 bg-[#10214F] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 opacity-80"
                    disabled
                  >
                    <MessageSquare size={16} />
                    Contact Dealer
                  </button>
                  <button
                    className="w-full py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 opacity-80"
                    disabled
                  >
                    <Phone size={16} />
                    Request a Call
                  </button>
                  <button
                    className="w-full py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 opacity-80"
                    disabled
                  >
                    <Heart size={16} />
                    Save Listing
                  </button>
                </div>

                <p className="text-xs text-center text-gray-400">
                  ↑ Buyer-facing buttons — disabled in preview
                </p>

                {/* Dealer info */}
                <div className="pt-4 border-t border-gray-100">
                  {d.dealer_logo_url ? (
                    <img src={mediaUrl(d.dealer_logo_url)} alt="Dealer logo" className="h-10 object-contain mb-3" />
                  ) : (
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-[#10214F] text-white flex items-center justify-center font-bold text-base flex-shrink-0">
                        {(d.dealer_name ?? 'D').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{d.dealer_name ?? 'Dealer'}</div>
                        <div className="flex items-center gap-1 text-xs text-[#01BBDC]">
                          <CheckCircle size={11} />
                          Verified Dealer
                        </div>
                      </div>
                    </div>
                  )}
                  {d.dealer_phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <Phone size={13} />
                      <span>{d.dealer_phone}</span>
                    </div>
                  )}
                  {d.dealer_email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <Mail size={13} />
                      <span>{d.dealer_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Share row */}
              <div className="flex items-center justify-center gap-4 text-sm text-gray-400 pointer-events-none">
                <button className="flex items-center gap-1.5 opacity-60" disabled>
                  <Share2 size={14} />
                  Share
                </button>
                <span>·</span>
                <button className="flex items-center gap-1.5 opacity-60" disabled>
                  <Heart size={14} />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer CTA ─────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 bg-gray-50 px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm text-gray-600">
            {d.status === 'draft'
              ? '⚠️ This listing is a draft. Publish it when you\'re ready for buyers to see it.'
              : '✅ This listing is live and visible to buyers.'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#10214F] text-white text-sm font-semibold rounded-lg hover:bg-[#0d1a3e] transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
