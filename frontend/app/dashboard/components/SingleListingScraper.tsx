'use client';

import { useState } from 'react';
import { Globe, AlertTriangle, Check, Loader2, ArrowRight } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type Step = 'input' | 'submitting' | 'done';

export default function SingleListingScraper() {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Please enter a full URL starting with https://');
      return;
    }
    setError(null);
    setStep('submitting');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl('/scraper/dealer/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Failed to import listing. Please check the URL and try again.');
        setStep('input');
        return;
      }

      setStep('done');
    } catch {
      setError('Something went wrong. Please try again.');
      setStep('input');
    }
  }

  if (step === 'done') {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50/60 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 rounded-lg bg-green-100">
            <Check size={20} className="text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-dark mb-1">Listing imported!</h3>
            <p className="text-sm text-dark/70 mb-4">
              Your listing has been scraped and saved as a draft. Head to the
              <strong> Needs Approval</strong> section of your dashboard to review, edit, and publish it.
            </p>
            <button
              onClick={() => { setStep('input'); setUrl(''); setError(null); }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-dark text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Submit another URL
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Globe size={17} className="text-primary" />
        <h3 className="font-semibold text-dark">Import from your website</h3>
      </div>
      <p className="text-sm text-dark/60">
        Enter the URL of a listing page on your brokerage website. Our scraper will pull in
        the listing details automatically and save it as a draft for your review.
      </p>

      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="https://your-website.com/your-listing"
          disabled={step === 'submitting'}
          className="flex-1 min-w-0 px-4 py-2.5 border border-primary/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!url.trim() || step === 'submitting'}
          className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          {step === 'submitting' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ArrowRight size={15} />
          )}
          {step === 'submitting' ? 'Importing…' : 'Import Listing'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs text-dark/40 pt-1">
        Only URLs from your registered brokerage website are accepted. Marketplace sites (e.g. YachtWorld, Boat Trader) are not permitted.
      </p>
    </div>
  );
}
