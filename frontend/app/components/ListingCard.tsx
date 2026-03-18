'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Heart, Share2, Mail, Printer, Facebook, Twitter, Linkedin, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

type ListingCardProps = {
  id: number;
  title: string;
  price?: number;  // Made optional
  year?: number;
  make?: string;
  model?: string;
  boatType?: string;
  cabins?: number;
  length?: number;
  city?: string;
  state?: string;
  images?: string[];
  condition?: string;
  featured?: boolean;
  dealerInfo?: {
    name: string;
    company: string;
    slug?: string;
    photo?: string;
    logoUrl?: string;
  };
};

export default function ListingCard({
  id,
  title,
  price,
  year,
  make,
  model,
  boatType,
  cabins,
  length,
  city,
  state,
  images = [],
  condition,
  featured,
  dealerInfo
}: ListingCardProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const normalizedCondition = condition ? condition.charAt(0).toUpperCase() + condition.slice(1).toLowerCase() : '';

  // Updated to use the new fallback image
  const imageUrl = images && images.length > 0 
    ? mediaUrl(images[0]) 
    : '/images/listing-fallback.png';
    
  const listingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/listings/${id}`;

  useEffect(() => {
    checkIfSaved();
  }, [id]);

  const checkIfSaved = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(apiUrl('/saved-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const isSaved = data.some((item: any) => item.listing_id === id);
        setSaved(isSaved);
      }
    } catch (error) {
      console.error('Failed to check saved status:', error);
    }
  };

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/listings/' + id);
      return;
    }

    setLoading(true);

    try {
      if (saved) {
        const response = await fetch(apiUrl('/saved-listings'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const savedItem = data.find((item: any) => item.listing_id === id);
          
          if (savedItem) {
            await fetch(apiUrl(`/saved-listings/${savedItem.id}`), {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            setSaved(false);
          }
        }
      } else {
        const response = await fetch(apiUrl('/saved-listings'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ listing_id: id })
        });

        if (response.ok) {
          setSaved(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle save:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = (platform: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const encodedUrl = encodeURIComponent(listingUrl);
    const encodedTitle = encodeURIComponent(title);
    const encodedPrice = price ? encodeURIComponent(`$${price.toLocaleString()}`) : encodeURIComponent('Contact for Pricing');

    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle} - ${encodedPrice}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodedTitle}&body=Check out this yacht: ${encodedTitle} - ${encodedPrice}%0A%0A${encodedUrl}`;
        break;
      case 'print':
        window.open(listingUrl, '_blank');
        setTimeout(() => window.print(), 500);
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  return (
    <Link href={`/listings/${id}`} className="block">
      <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden">
        {/* Image with Featured Badge and Action Buttons */}
        <div className="relative h-64 bg-gray-200">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.src = '/images/listing-fallback.png';
            }}
          />
          
          {featured && (
            <div className="absolute top-3 left-3 z-10">
              <span className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-full">
                ⭐ FEATURED
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            <button
              onClick={handleToggleSave}
              disabled={loading}
              className={`p-2 rounded-full transition-all ${
                saved
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
              }`}
              title={saved ? 'Remove from saved' : 'Save this yacht'}
            >
              <Heart 
                size={20} 
                fill={saved ? 'currentColor' : 'none'}
                className={loading ? 'animate-pulse' : ''}
              />
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowShare(!showShare);
                }}
                className="p-2 bg-white text-gray-600 hover:bg-gray-100 border border-gray-300 rounded-full transition-all"
                title="Share this yacht"
              >
                <Share2 size={20} />
              </button>

              {/* Share Dropdown */}
              {showShare && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                  <button
                    onClick={(e) => handleShare('facebook', e)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Facebook size={16} className="text-blue-600" />
                    Facebook
                  </button>
                  <button
                    onClick={(e) => handleShare('twitter', e)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Twitter size={16} className="text-sky-500" />
                    Twitter
                  </button>
                  <button
                    onClick={(e) => handleShare('linkedin', e)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Linkedin size={16} className="text-blue-700" />
                    LinkedIn
                  </button>
                  <button
                    onClick={(e) => handleShare('email', e)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Mail size={16} className="text-gray-600" />
                    Email
                  </button>
                  <button
                    onClick={(e) => handleShare('print', e)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Printer size={16} className="text-gray-600" />
                    Print
                  </button>
                </div>
              )}
            </div>
          </div>

          {condition === 'new' && (
            <div className="absolute bottom-3 left-3">
              <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                NEW
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex justify-between items-start gap-3 mb-0.5">
            <h3 className="text-xl font-bold text-gray-900 line-clamp-2 flex-1">
              {title}
            </h3>
          </div>

          <div className="mb-2">
            {price ? (
              <p className="text-2xl font-bold text-[#01BBDC]">
                ${price.toLocaleString()}
              </p>
            ) : (
              <p className="text-2xl font-bold text-gray-700">
                Contact for Pricing
              </p>
            )}
            {(city || state) && (
              <p className="text-sm text-[#10214F] mt-1 inline-flex items-center gap-1.5">
                <MapPin size={14} className="text-[#01BBDC]" />
                {[city, state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-3 text-sm text-[#10214F]/80 mb-3">
            {boatType && (
              <span>{boatType}</span>
            )}
            {normalizedCondition && (
              <>
                {boatType && <span className="text-[#10214F]/40">•</span>}
                <span>{normalizedCondition}</span>
              </>
            )}
            {cabins && (
              <>
                {(boatType || normalizedCondition) && <span className="text-[#10214F]/40">•</span>}
                <span>{cabins} cabins</span>
              </>
            )}
          </div>

          {/* Dealer Info */}
          {dealerInfo && (
            <div className="pt-4 border-t border-gray-200">
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dealerInfo.slug) {
                    router.push(`/dealers/${dealerInfo.slug}`);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dealerInfo.slug) {
                      router.push(`/dealers/${dealerInfo.slug}`);
                    }
                  }
                }}
                className={`flex items-center gap-3 hover:bg-gray-50 p-2 -mx-2 rounded transition-colors ${dealerInfo.slug ? 'cursor-pointer' : ''}`}
                aria-label={`View dealer profile for ${dealerInfo.company}`}
              >
                {dealerInfo.logoUrl ? (
                  <img
                    src={mediaUrl(dealerInfo.logoUrl)}
                    alt={`${dealerInfo.company} logo`}
                    className="w-10 h-10 rounded-md object-contain bg-white border border-gray-200 p-1"
                    onError={onImgError}
                  />
                ) : dealerInfo.photo ? (
                  <img
                    src={mediaUrl(dealerInfo.photo)}
                    alt={`${dealerInfo.name} profile photo`}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={onImgError}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center" aria-hidden="true">
                    <span className="text-blue-600 font-semibold text-sm">
                      {dealerInfo.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {dealerInfo.name}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {dealerInfo.company}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}