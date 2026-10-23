'use client';

import { useState } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';

/**
 * Email-free login handoff for sales reps: fetches the account's pending
 * set-password link and shows a ready-to-paste message, for when the setup
 * email didn't arrive. Only works while the account hasn't set a password yet.
 */
export default function LoginLinkButton({ accountId, name }: { accountId: number; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState('');

  const fetchLink = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/sales-rep/dealers/${accountId}/login-link`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.setup_url) {
        setError(data.detail || 'Could not get a login link');
        return;
      }
      setLink(data.setup_url);
      setMessage(
        `Hi ${name},\n\nYour YachtVersal account is ready. Use this link to set your password:\n${data.setup_url}\n\nThen sign in at ${data.login_url} with ${data.email}.`
      );
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div>
      <button onClick={fetchLink} disabled={busy}
        className="px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60">
        {busy ? 'Getting link…' : 'Get login link (no email)'}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {message && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-600 mb-2">No email is sent. Pass this on directly — they use it to set their own password.</p>
          <textarea readOnly rows={6} value={message} onFocus={e => e.currentTarget.select()}
            className="w-full text-xs font-mono p-2 border border-gray-200 rounded bg-white" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => copy(message, 'message')} className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg">
              {copied === 'message' ? 'Copied!' : 'Copy message'}
            </button>
            <button onClick={() => copy(link, 'link')} className="px-3 py-1.5 bg-white border border-gray-300 text-xs font-medium rounded-lg">
              {copied === 'link' ? 'Copied!' : 'Copy link only'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
