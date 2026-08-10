'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CreditCard, Loader2, AlertCircle, ShieldCheck, Infinity } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');
  const [paidDate, setPaidDate] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }

    const sessionId = searchParams.get('session_id');
    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');

    if (success && sessionId) {
      // Coming back from Stripe — confirm the session
      confirmSession(token, sessionId);
    } else if (cancelled) {
      setLoading(false);
      setError('Payment was cancelled. You can try again whenever you\'re ready.');
      checkStatus(token);
    } else {
      checkStatus(token);
    }
  }, []);

  const checkStatus = async (token: string) => {
    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { router.replace('/login'); return; }
      const user = await res.json();

      if (user.user_type !== 'dealer' && user.user_type !== 'admin') {
        router.replace('/dashboard');
        return;
      }

      // subscription_start_date is only set by a confirmed Stripe webhook or
      // session-confirm call — unlike subscription_tier, it can't be set by a
      // sales rep/admin manually creating a broker account, so it's the only
      // reliable signal that this account has actually paid.
      if (user.always_free || user.subscription_start_date) {
        setIsPaid(true);
        if (user.subscription_start_date) {
          setPaidDate(new Date(user.subscription_start_date).toLocaleDateString());
        }
      }
    } catch {
      setError('Failed to load account status.');
    } finally {
      setLoading(false);
    }
  };

  const confirmSession = async (token: string, sessionId: string) => {
    setConfirming(true);
    try {
      const res = await fetch(apiUrl('/payments/confirm-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        setIsPaid(true);
        // Clean up URL params
        window.history.replaceState({}, '', '/dashboard/billing');
      } else {
        setError('Payment confirmation failed. Please contact support if you were charged.');
        await checkStatus(token);
      }
    } catch {
      setError('Failed to confirm payment. Please contact support.');
      await checkStatus(token);
    } finally {
      setConfirming(false);
      setLoading(false);
    }
  };

  const startCheckout = async () => {
    setRedirecting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const origin = window.location.origin;
      const res = await fetch(apiUrl('/payments/create-setup-fee-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          success_url: `${origin}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/dashboard/billing?cancelled=1`,
        }),
      });
      if (!res.ok) throw new Error();
      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch {
      setError('Unable to start checkout. Please try again.');
      setRedirecting(false);
    }
  };

  if (loading || confirming) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-[#01BBDC]" />
        <p className="text-gray-500 text-sm">{confirming ? 'Confirming your payment…' : 'Loading…'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">

      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {isPaid ? (
        /* ── PAID STATE ── */
        <div>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
              <ShieldCheck className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-[#10214F] mb-2">You're all set</h1>
            <p className="text-gray-500">
              Your one-time setup fee has been paid. Your account is active for life — no renewals, no monthly charges.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="font-semibold text-green-800">Account Active — Free for Life</span>
            </div>
            <ul className="space-y-2 ml-8">
              {[
                'Unlimited yacht listings',
                'Full CRM and lead management',
                'Analytics dashboard',
                'Team management',
                'Charter listings',
                'Priority support',
                'All future features included',
              ].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-green-700">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {paidDate && (
              <p className="mt-4 ml-8 text-xs text-green-600">Member since {paidDate}</p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
            <Infinity className="w-8 h-8 text-[#01BBDC] mx-auto mb-2" />
            <h3 className="font-semibold text-[#10214F] mb-1">No renewals. Ever.</h3>
            <p className="text-sm text-gray-500">
              You paid once and you're done. Your listing access, leads, and tools will never be paywalled again.
            </p>
          </div>
        </div>
      ) : (
        /* ── UNPAID STATE ── */
        <div>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#10214F] mb-2">Activate Your Account</h1>
            <p className="text-gray-500">
              One payment. No subscriptions. Free access for the life of your account.
            </p>
          </div>

          {/* Offer card */}
          <div className="border-2 border-[#01BBDC] rounded-2xl p-8 mb-6 bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#01BBDC] text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
              ONE-TIME ONLY
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#10214F] mb-1">Founding Member</h2>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-6xl font-bold text-[#01BBDC]">$200</span>
                <div className="text-left">
                  <p className="text-gray-400 line-through text-lg">$299</p>
                  <p className="text-sm font-semibold text-amber-600">Launch pricing</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-2">One-time setup fee — never pay again</p>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'Unlimited yacht and charter listings',
                'Full CRM and inquiry management',
                'Analytics and performance dashboard',
                'Team management and multi-user access',
                'API access for inventory sync',
                'All future features at no additional cost',
                'Priority support',
              ].map(f => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#01BBDC] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 text-sm">{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={startCheckout}
              disabled={redirecting}
              className="w-full py-4 bg-[#01BBDC] hover:bg-[#00a5c4] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {redirecting ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Redirecting to checkout…
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  Pay $200 — Activate Account
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              🔒 Secure payment via Stripe. No subscription. No renewals. Cancel-free.
            </p>
          </div>

          {/* Reassurance */}
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: '🔒', title: 'Secure', desc: 'Stripe-encrypted checkout' },
              { icon: '♾️', title: 'Lifetime', desc: 'One payment, forever' },
              { icon: '🚀', title: 'Instant', desc: 'Access activates immediately' },
            ].map(item => (
              <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="font-semibold text-[#10214F] text-sm">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-10 w-10 text-[#01BBDC]" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
