'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiUrl } from '@/app/lib/apiRoot';
import { Loader2 } from 'lucide-react';
import TermsAcceptanceModal from '@/app/components/TermsAcceptanceModal';

function BuyerLoginContent() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string>('/account');
  const [userName, setUserName] = useState<string | undefined>();
  const [userType, setUserType] = useState<string | undefined>();

  // 2FA state
  const [requires2fa, setRequires2fa] = useState(false);
  const [twoFaEmail, setTwoFaEmail] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');

  // Resend verification state
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/health'), { method: 'GET', cache: 'no-store' }).catch(() => {});
  }, []);

  const finishLogin = async (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    window.dispatchEvent(new Event('authChange'));

    const userResponse = await fetch(apiUrl('/auth/me'), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userResponse.json();

    let redirectTo = '/account';
    if (userData.user_type === 'admin') redirectTo = '/admin';
    else if (userData.user_type === 'salesman') redirectTo = '/sales-rep/dashboard';
    else if (userData.user_type === 'dealer' || userData.user_type === 'private') redirectTo = '/dashboard';

    // Fire-and-forget Stripe sync for broker/private accounts on every login
    if (userData.user_type === 'dealer' || userData.user_type === 'private') {
      fetch(apiUrl('/payments/sync-my-subscription'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => { /* non-critical, ignore errors */ });
    }

    if (userData.user_type !== 'admin' && !userData.agreed_terms) {
      setUserName(userData.first_name || undefined);
      setUserType(userData.user_type || undefined);
      setPendingRedirect(redirectTo);
      setShowTermsModal(true);
      return;
    }

    router.push(redirectTo);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Login failed');

      if (data.requires_2fa) {
        setTwoFaEmail(data.email || formData.email);
        setRequires2fa(true);
        return;
      }

      await finishLogin(data.access_token);
    } catch (err: any) {
      const msg: string = err.message || '';
      if (msg.toLowerCase().includes('failed to fetch')) {
        setError('Unable to reach the server. Please wait a moment and try again.');
      } else {
        setError(msg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/auth/2fa/complete-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: twoFaEmail, code: twoFaCode }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Invalid code. Please try again.');

      await finishLogin(data.access_token);
    } catch (err: any) {
      const msg: string = err.message || '';
      setError(msg || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      await fetch(apiUrl('/auth/resend-verification-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      setResendSent(true);
    } catch {
      // silent — server returns success either way to prevent enumeration
    } finally {
      setResendLoading(false);
    }
  };

  const handleTermsAccepted = () => { setShowTermsModal(false); router.push(pendingRedirect); };
  const handleTermsDecline = () => {
    setShowTermsModal(false);
    localStorage.removeItem('token');
    setError('You must accept the terms to continue.');
  };

  return (
    <>
      {showTermsModal && (
        <TermsAcceptanceModal
          onAccepted={handleTermsAccepted}
          onDecline={handleTermsDecline}
          userName={userName}
          userType={userType}
        />
      )}

      <div className="min-h-screen section-light flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">

          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex justify-center mb-4">
              <Image src="/logo/logo-full-cropped.png" alt="YachtVersal" width={220} height={55} priority />
            </Link>
            <h2 className="text-2xl font-semibold text-secondary">
              {requires2fa ? 'Two-Factor Authentication' : 'Buyer Sign In'}
            </h2>
            <p className="mt-2 text-dark/70">
              {requires2fa
                ? `Enter the verification code sent to ${twoFaEmail}`
                : 'Welcome back to your buyer account'}
            </p>
          </div>

          {/* ── Sign In / 2FA form ── */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
                {error.toLowerCase().includes('verify your email') && !resendSent && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="mt-2 text-sm font-medium text-primary hover:text-primary/80 underline hover:no-underline disabled:opacity-50"
                  >
                    {resendLoading ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                )}
                {resendSent && (
                  <p className="mt-2 text-sm text-green-700 font-medium">Confirmation email sent! Check your inbox.</p>
                )}
              </div>
            )}

            {requires2fa ? (
              <form onSubmit={handle2faSubmit} className="space-y-6">
                <div>
                  <label htmlFor="twofa-code" className="block text-sm font-medium text-dark mb-2">
                    Verification Code
                  </label>
                  <input
                    id="twofa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="000000"
                  />
                  <p className="mt-2 text-xs text-dark/50">Check your email for a 6-digit code.</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFaCode.length !== 6}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Verifying…' : 'Verify & Sign In'}
                </button>

                <button
                  type="button"
                  onClick={() => { setRequires2fa(false); setTwoFaCode(''); setError(''); }}
                  className="w-full text-sm text-dark/50 hover:text-dark/70"
                >
                  ← Back to sign in
                </button>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-dark mb-2">Email Address</label>
                    <input
                      id="email" name="email" type="email" required autoComplete="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-dark mb-2">Password</label>
                    <input
                      id="password" name="password" type="password" required autoComplete="current-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="........"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-primary focus:ring-primary border-gray-400 rounded" />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-dark">Remember me</label>
                    </div>
                    <div className="text-sm">
                      <Link href="/forgot-password" className="font-medium text-primary hover:text-primary/80">Forgot password?</Link>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                {/* ── Sign Up section ── */}
                <div className="mt-4 pt-5 border-t border-gray-100 space-y-3">
                  <p className="text-center text-sm text-dark/60">
                    Don't have an account?{' '}
                    <span className="font-medium text-secondary">Buyer accounts are always free.</span>
                  </p>
                  <Link
                    href="/register?user_type=buyer"
                    className="block w-full py-3 px-4 text-center rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#10214F' }}
                  >
                    Create a Free Buyer Account →
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* ── Cross-link ── */}
          {!requires2fa && (
            <div className="text-center mt-5 space-y-2">
              <p className="text-sm text-dark/50">
                Looking for the seller portal?{' '}
                <Link href="/login/seller" className="text-primary font-medium hover:text-primary/80">
                  Seller Sign In
                </Link>
              </p>
              <Link href="/" className="block text-sm text-dark/40 hover:text-dark/60">Back to home</Link>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

function BuyerLoginLoading() {
  return (
    <div className="min-h-screen section-light flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary" />
    </div>
  );
}

export default function BuyerLoginPage() {
  return (
    <Suspense fallback={<BuyerLoginLoading />}>
      <BuyerLoginContent />
    </Suspense>
  );
}
