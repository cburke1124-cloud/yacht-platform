'use client';

import { Share2, Facebook, Twitter, Mail, Link2, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function ShareButton({ listingId, listingTitle, listingPrice }: {
  listingId: number;
  listingTitle: string;
  listingPrice: number;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/listings/${listingId}`;
  const shareText = `Check out this yacht: ${listingTitle} - $${listingPrice.toLocaleString()}`;

  const handleShare = async (platform: string) => {
    // Track share
    await fetch(apiUrl(`/listings/${listingId}/track-share`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform })
    });

    let url = '';
    switch (platform) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
      case 'email':
        url = `mailto:?subject=${encodeURIComponent(listingTitle)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
        break;
    }

    if (url) window.open(url, '_blank', 'width=600,height=400');
    setShowMenu(false);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    await fetch(apiUrl(`/listings/${listingId}/track-share`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'copy' })
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-4 py-3 bg-soft text-dark rounded-lg font-medium hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
      >
        <Share2 size={20} />
        Share
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
          <div className="p-2 space-y-1">
            <button onClick={() => handleShare('facebook')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg">
              <Facebook size={20} className="text-blue-600" />
              <span>Facebook</span>
            </button>
            <button onClick={() => handleShare('twitter')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg">
              <Twitter size={20} className="text-blue-400" />
              <span>Twitter</span>
            </button>
            <button onClick={() => handleShare('linkedin')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-700" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              <span>LinkedIn</span>
            </button>
            <button onClick={() => handleShare('whatsapp')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg">
              <MessageCircle size={20} className="text-green-600" />
              <span>WhatsApp</span>
            </button>
            <button onClick={() => handleShare('email')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg">
              <Mail size={20} className="text-gray-600" />
              <span>Email</span>
            </button>
            <div className="border-t my-1"></div>
            <button onClick={copyLink} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg">
              <Link2 size={20} className="text-gray-600" />
              <span>{copied ? '✓ Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}