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
      // Log a pending scraper job for admin processing
      await fetch(apiUrl('/broker/import-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: trimmed, import_type: 'single' }),
      });

      // Also file a support ticket so every admin is notified
      await fetch(apiUrl('/messages/support-ticket'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: 'Listing import request',
          category: 'listings',
          priority: 'high',
          body: `A broker has requested a listing import from the following URL:\n\n${trimmed}\n\nPlease review and configure the scraper job manually.`,
        }),
      });

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
            <h3 className="font-semibold text-dark mb-1">Request submitted!</h3>
            <p className="text-sm text-dark/70 mb-4">
              We&apos;ve received your listing import request and will have it set up for you shortly.
              You&apos;ll be notified once your listings are live.
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
        Enter the URL of a listing page on your brokerage website. Our team will configure
        the import and notify you once your listings are live.
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
          {step === 'submitting' ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs text-dark/40 pt-1">
        Only URLs from your registered brokerage website are accepted.
      </p>
    </div>
  );
}
