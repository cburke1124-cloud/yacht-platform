'use client';

import { useState } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';

interface ManualRequestFormProps {
  /** Which feature was unavailable; tells the team where the lead came from. */
  source: 'chatbot' | 'ai_search';
  /** The AI search text the visitor tried (shown to the team and prefilled). */
  query?: string;
  /** Chat conversation to attach the message to. */
  sessionId?: string;
  listingId?: number;
  pageUrl?: string;
  compact?: boolean;
}

/** Fallback shown when the AI can't help: collects the visitor's details and
 *  request so a team member can follow up by hand. */
export default function ManualRequestForm({ source, query, sessionId, listingId, pageUrl, compact }: ManualRequestFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(query ? `I'm looking for: ${query}` : '');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/manual-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          name,
          email,
          phone: phone || null,
          message,
          query: query || null,
          session_id: sessionId || null,
          listing_id: listingId ?? null,
          page_url: pageUrl || (typeof window !== 'undefined' ? window.location.href : null),
          website: honeypot,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || data?.error || 'Could not send your message.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        Thank you! Your message has been sent to our team and we&apos;ll follow up at {email}.
      </div>
    );
  }

  const input = 'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <form onSubmit={submit} className={`space-y-2 ${compact ? '' : 'rounded-lg border border-gray-200 bg-white p-4'}`}>
      <div className={compact ? 'space-y-2' : 'grid gap-2 sm:grid-cols-2'}>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={input} />
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" className={input} />
      </div>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" aria-label="Phone (optional)" className={input} />
      <textarea
        required
        rows={compact ? 3 : 4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What can we help you find?"
        aria-label="Your message"
        className={input}
      />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        name="website"
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send to our team'}
      </button>
    </form>
  );
}
