'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiUrl } from '@/app/lib/apiRoot';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please check the link in your email.');
      return;
    }

    fetch(apiUrl(`/auth/verify-email?token=${encodeURIComponent(token)}`))
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus('success');
          setMessage(data.message || 'Your email has been verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.detail || data.message || 'Verification failed. The link may have expired.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Unable to reach the server. Please try again later.');
      });
  }, [token]);

  return (
    <div className="min-h-screen section-light flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">

        <Link href="/" className="inline-flex justify-center mb-8">
          <Image src="/logo/logo-full-cropped.png" alt="YachtVersal" width={200} height={50} priority />
        </Link>

        <div className="bg-white rounded-2xl shadow-xl p-10">
          {status === 'loading' && (
            <>
              <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-secondary mb-2">Verifying…</h2>
              <p className="text-dark/60">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-secondary mb-2">Email Verified!</h2>
              <p className="text-dark/60 mb-6">{message}</p>
              <Link
                href="/login/seller"
                className="inline-block w-full py-3 px-6 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Sign In to Your Account
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle size={48} className="text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-secondary mb-2">Verification Failed</h2>
              <p className="text-dark/60 mb-6">{message}</p>
              <ResendVerificationForm />
            </>
          )}
        </div>

        <Link href="/" className="block mt-5 text-sm text-dark/40 hover:text-dark/60">
          Back to home
        </Link>
      </div>
    </div>
  );
}

function ResendVerificationForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/resend-verification-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.detail || 'Failed to resend. Please try again.');
      }
    } catch {
      setError('Unable to reach the server. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        A new verification link has been sent if that email is registered.
      </p>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-3">
      <p className="text-sm text-dark/60">Enter your email to receive a new verification link:</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-secondary text-white rounded-lg font-semibold text-sm hover:bg-secondary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Sending…' : 'Resend Verification Email'}
      </button>
    </form>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="min-h-screen section-light flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
