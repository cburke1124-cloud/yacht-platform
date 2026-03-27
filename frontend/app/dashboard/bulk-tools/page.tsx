"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/apiRoot';
import { Globe, Layers, ArrowLeft, Loader2, Upload, CheckCircle, AlertTriangle } from 'lucide-react';

type Mode = 'single' | 'bulk';

export default function BulkToolsPage() {
  return (
    <Suspense>
      <BulkToolsInner />
    </Suspense>
  );
}

function BulkToolsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const [mode, setMode] = useState<Mode>(modeParam === 'bulk' ? 'bulk' : 'single');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (modeParam === 'bulk') setMode('bulk');
    else setMode('single');
  }, [modeParam]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { router.replace('/login'); return; }
        const perms = (u.permissions || {}) as Record<string, boolean>;
        const canCreate = u.user_type === 'dealer' || u.user_type === 'admin' ||
          !!(perms.create_listings ?? perms.can_create_listings);
        if (!canCreate) router.replace('/dashboard');
      });
  }, []);

  const handleSwitch = (newMode: Mode) => {
    setMode(newMode);
    setUrl('');
    setSubmitted(false);
    setError(null);
  };

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Please enter a full URL starting with https://');
      return;
    }
    setError(null);
    setSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      if (mode === 'single') {
        const res = await fetch(apiUrl('/scraper/dealer/import'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: trimmed }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const detail: string = data.detail || 'Failed to import listing. Please check the URL and try again.';
          setError(
            detail.toLowerCase().includes('website') || detail.toLowerCase().includes('dealer profile')
              ? detail + ' Go to Account › Broker Page to add your website.'
              : detail
          );
          return;
        }
      } else {
        await fetch(apiUrl('/broker/import-request'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: trimmed, import_type: 'bulk' }),
        });
      }
      setSubmitted(true);
    } catch {
      if (mode === 'bulk') setSubmitted(true);
      else setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const singleSteps = [
    {
      num: '1.',
      title: 'Copy & Paste the Listing URL',
      body: 'Copy the direct URL of an actual yacht listing from your website — a specific vessel page, not your homepage or a page showing multiple listings — and paste it into the field below.',
    },
    {
      num: '2.',
      title: 'Click Import Listing',
      body: 'Click Import Listing to begin. YachtVersal will automatically scan the page and extract the available listing details, images, and specifications.',
    },
    {
      num: '3.',
      title: 'We Prepare Your Listing',
      body: 'Our system will process the page content and prepare the imported listing for review inside your dashboard.',
    },
    {
      num: '4.',
      title: 'Review For Approval',
      body: 'Check the Needs Approval section of your dashboard. Your imported listing will appear there once it is ready for review, editing, and approval.',
    },
  ];

  const bulkSteps = [
    {
      num: '1.',
      title: 'Copy & Paste the Listings Page URL',
      body: 'Copy the URL on your brokerage website where multiple yacht listings are displayed, and paste it below. This should be a page that shows multiple listings — not a single listing or your homepage.',
    },
    {
      num: '2.',
      title: 'Click Import All Listings',
      body: 'Click Import All Listings to begin. YachtVersal will automatically scan the page and extract ALL listing details, images, and specifications.',
    },
    {
      num: '3.',
      title: 'We Prepare Your Listings',
      body: 'Our system will process the page content and prepare all imported listings for review inside your dashboard.',
    },
    {
      num: '4.',
      title: 'Review For Approval',
      body: 'Check the Needs Approval section of your dashboard. All imported listings will appear there once they are ready for review, editing, and approval.',
    },
  ];

  const steps = mode === 'single' ? singleSteps : bulkSteps;

  return (
    <div className="min-h-screen bg-white py-10 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Back */}
        <Link
          href="/listings/add"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-secondary transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Add a Listing
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary mb-2">Import Listings from Your Website</h1>
          <p className="text-dark/70">Our scraper pulls in your yacht details, photos, and specs automatically.</p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-10">
          <button
            onClick={() => handleSwitch('single')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'single' ? 'bg-white text-dark shadow-sm' : 'text-dark/60 hover:text-dark'
            }`}
          >
            <Globe size={15} />
            Import Single Listing
          </button>
          <button
            onClick={() => handleSwitch('bulk')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'bulk' ? 'bg-white text-dark shadow-sm' : 'text-dark/60 hover:text-dark'
            }`}
          >
            <Layers size={15} />
            Import Bulk Listings
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <CheckCircle size={52} className="text-primary" />
            <p className="text-xl font-bold text-secondary">
              {mode === 'single' ? 'Listing Imported!' : 'Import Request Submitted!'}
            </p>
            <p className="text-sm text-gray-600 text-center max-w-sm">
              {mode === 'single'
                ? "We're processing your listing. Check the Needs Approval section of your dashboard shortly."
                : "We've received your request and will process your listings. Check the Needs Approval section shortly."}
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setSubmitted(false); setUrl(''); setError(null); }}
                className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Import Another
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-2.5 bg-secondary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Intro text */}
            <p className="text-sm font-medium mb-2" style={{ color: '#01BBDC' }}>
              {mode === 'single'
                ? 'Quickly add one yacht listing from your website by pasting the listing URL below.'
                : 'Bring your full inventory into YachtVersal in just a few steps.'}
            </p>
            <p className="text-sm text-gray-600 mb-8 leading-relaxed">
              {mode === 'single'
                ? 'Paste the direct URL from your brokerage website for the specific yacht listing. Our system will review the page and pull in the listing information, images, specifications, and descriptions. Once submitted, the listing will appear in the Needs Approval section of your dashboard for final review.'
                : 'Simply paste the link to your brokerage website listings page — where multiple yachts are displayed — and our system will automatically scan the page and import all available listings, including details, photos, and specifications. All imported listings will appear in the Needs Approval section of your dashboard for review.'}
            </p>

            {/* Steps */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {steps.map((s) => (
                <div key={s.num} className="border border-secondary/20 rounded-xl p-4">
                  <p className="text-xl font-bold text-secondary mb-2">{s.num}</p>
                  <p className="font-bold text-secondary text-sm mb-2">{s.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>

            {/* URL input + submit */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">
                  Enter URL:
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                  placeholder={
                    mode === 'single'
                      ? 'https://yourbrokerage.com/listings/yacht-name'
                      : 'https://yourbrokerage.com/listings'
                  }
                  disabled={submitting}
                  className="w-full px-4 py-3 border-2 border-secondary/30 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !url.trim()}
                className="flex items-center gap-2 px-7 py-3 bg-secondary text-white font-bold text-sm tracking-wide rounded-xl hover:bg-primary disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors self-end whitespace-nowrap"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {submitting ? 'Importing…' : mode === 'single' ? 'Import Listing' : 'Import All Listings'}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5 mt-3">
                <AlertTriangle size={14} className="flex-shrink-0" />
                {error}
              </p>
            )}

            <p className="text-xs text-dark/40 mt-4">
              Only URLs from your registered brokerage website are accepted. Marketplace sites (e.g. YachtWorld, Boat Trader) are not permitted.
            </p>
          </>
        )}

      </div>
    </div>
  );
}
