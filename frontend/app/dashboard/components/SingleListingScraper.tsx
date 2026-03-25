'use client';

import { useState, useEffect } from 'react';
import { Globe, AlertTriangle, Link2, Check, Loader2, ExternalLink, ArrowRight, Download } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import { useRouter } from 'next/navigation';

type Step = 'input' | 'previewing' | 'preview' | 'importing' | 'done';

interface ScrapedData {
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  length_feet?: number;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  images?: string[];
}

function getHostname(website: string): string {
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

export default function SingleListingScraper() {
  const router = useRouter();
  const [website, setWebsite] = useState<string | null>(null);
  const [websiteLoading, setWebsiteLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [preview, setPreview] = useState<ScrapedData | null>(null);
  const [listingId, setListingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(apiUrl('/dealer-profile'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        setWebsite(data?.website || null);
        setWebsiteLoading(false);
      })
      .catch(() => setWebsiteLoading(false));
  }, []);

  async function handlePreview() {
    if (!url.trim()) return;
    setError(null);
    setStep('previewing');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl('/scraper/dealer/preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.detail || data.message || 'Failed to scrape listing');
        setStep('input');
        return;
      }
      setPreview(data.data);
      setStep('preview');
    } catch {
      setError('Network error. Please try again.');
      setStep('input');
    }
  }

  async function handleImport() {
    setError(null);
    setStep('importing');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl('/scraper/dealer/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.detail || data.message || 'Import failed');
        setStep('preview');
        return;
      }
      setListingId(data.listing_id);
      setStep('done');
    } catch {
      setError('Network error. Please try again.');
      setStep('preview');
    }
  }

  function reset() {
    setStep('input');
    setUrl('');
    setPreview(null);
    setListingId(null);
    setError(null);
  }

  if (websiteLoading) {
    return (
      <div className="flex items-center gap-2 text-secondary text-sm py-4">
        <Loader2 size={16} className="animate-spin" />
        Loading…
      </div>
    );
  }

  // No website set — gate the feature
  if (!website) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 rounded-lg bg-amber-100">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-dark mb-1">Brokerage website required</h3>
            <p className="text-sm text-dark/70 mb-4">
              Add your website to your Dealer Profile before using the listing importer.
              This lets us confirm you&apos;re importing from your own site — not a marketplace.
            </p>
            <button
              onClick={() => router.push('/dashboard/dealer-profile')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Globe size={15} />
              Go to Dealer Profile
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (step === 'done' && listingId) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50/60 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 rounded-lg bg-green-100">
            <Check size={20} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-dark mb-1">Listing imported!</h3>
            <p className="text-sm text-dark/70 mb-4">
              &ldquo;{preview?.title || 'Your listing'}&rdquo; was saved as a draft.
              Review the details and publish when ready.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/dashboard/listings/${listingId}/edit`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Edit Listing
                <ArrowRight size={14} />
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 border border-gray-200 text-dark text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Import Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hostname = getHostname(website);

  return (
    <div className="space-y-5">
      {/* URL input card */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={17} className="text-primary" />
          <h3 className="font-semibold text-dark">Import from URL</h3>
        </div>
        <p className="text-sm text-dark/60 mb-4">
          Paste a listing URL from your website{' '}
          <span className="font-medium text-primary/80">({hostname})</span>.
          Marketplace URLs (YachtWorld, Yachtr, etc.) are not permitted.
        </p>

        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (step === 'input' || step === 'preview')) handlePreview();
            }}
            placeholder={`https://${hostname}/your-listing`}
            disabled={step === 'previewing' || step === 'importing'}
            className="flex-1 min-w-0 px-4 py-2.5 border border-primary/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          {step === 'preview' ? (
            <button
              onClick={reset}
              className="px-4 py-2 border border-gray-200 text-dark text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Clear
            </button>
          ) : (
            <button
              onClick={handlePreview}
              disabled={!url.trim() || step === 'previewing'}
              className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {step === 'previewing' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : null}
              {step === 'previewing' ? 'Scraping…' : 'Preview'}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5">
            <AlertTriangle size={14} className="flex-shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* Preview card */}
      {step === 'preview' && preview && (
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-dark">Preview</h3>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary/60 flex items-center gap-1 hover:text-primary transition-colors"
            >
              View source <ExternalLink size={11} />
            </a>
          </div>

          {preview.images?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.images[0]}
              alt={preview.title || 'Listing image'}
              className="w-full h-52 object-cover rounded-xl"
            />
          )}

          <div>
            <h4 className="text-lg font-semibold text-dark leading-snug">
              {preview.title || 'Untitled Listing'}
            </h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-dark/60">
              {preview.year && <span>{preview.year}</span>}
              {preview.make && <span>{preview.make}</span>}
              {preview.model && <span>{preview.model}</span>}
              {preview.length_feet && <span>{preview.length_feet} ft</span>}
              {preview.price != null && (
                <span className="font-semibold text-dark">
                  ${preview.price.toLocaleString()}
                </span>
              )}
              {(preview.city || preview.state) && (
                <span>{[preview.city, preview.state].filter(Boolean).join(', ')}</span>
              )}
            </div>
          </div>

          {preview.description && (
            <p className="text-sm text-dark/60 line-clamp-3">{preview.description}</p>
          )}

          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleImport}
              disabled={step === 'importing'}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {step === 'importing' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {step === 'importing' ? 'Importing…' : 'Import as Draft'}
            </button>
            <p className="text-xs text-dark/40">Saved as a draft — review before publishing.</p>
          </div>
        </div>
      )}
    </div>
  );
}
