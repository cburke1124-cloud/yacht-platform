'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiUrl } from '@/app/lib/apiRoot';
import { ChevronDown, Loader2, Check } from 'lucide-react';
import TermsAcceptanceModal from '@/app/components/TermsAcceptanceModal';

// Fallback broker tiers (used until API responds)
const BROKER_TIERS: Record<string, any> = {
  basic: {
    name: 'Basic',
    price: 199,
    trial_days: 14,
    features: ['25 active listings', '15 images per listing', '1 video per listing', 'Enhanced search visibility', 'Priority email support', 'Analytics dashboard'],
  },
  plus: {
    name: 'Plus',
    price: 299,
    trial_days: 14,
    features: ['75 active listings', '30 images per listing', '3 videos per listing', 'Priority search placement', 'Featured broker badge', 'Priority support', 'Advanced analytics'],
  },
  pro: {
    name: 'Pro',
    price: 499,
    trial_days: 30,
    features: ['Unlimited listings', '50 images per listing', '5 videos per listing', 'Top search placement', 'Featured broker badge', 'Dedicated account manager', 'Advanced analytics', 'AI scraper tools'],
  },
  ultimate: {
    name: 'Ultimate',
    price: null,
    trial_days: 0,
    features: ['Unlimited listings', 'Unlimited images & video', 'White-glove onboarding', 'Dedicated account manager', 'Custom API integrations', 'Premium search placement'],
  },
};

const PRIVATE_TIER: Record<string, any> = {
  private_basic: {
    name: 'Basic',
    price: 9,
    trial_days: 7,
    features: ['1 active listing', '20 photos per listing', '1 video per listing', 'Standard search visibility', 'Direct buyer messaging', 'Email support'],
  },
  private_plus: {
    name: 'Plus',
    price: 19,
    trial_days: 7,
    features: ['3 active listings', '35 photos per listing', '1 video per listing', 'Priority search placement', 'Direct buyer messaging', 'Listing analytics', 'Email support'],
  },
  private_pro: {
    name: 'Pro',
    price: 39,
    trial_days: 14,
    features: ['10 active listings', '50 photos per listing', '3 videos per listing', 'Top search placement', 'Featured badge', 'Priority support', 'Social media promotion'],
  },
};

function SellerLoginContent() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string>('/dashboard');
  const [userName, setUserName] = useState<string | undefined>();
  const [userType, setUserType] = useState<string | undefined>();

  // 2FA state
  const [requires2fa, setRequires2fa] = useState(false);
  const [twoFaEmail, setTwoFaEmail] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');

  // Resend verification state
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [liveBrokerTiers, setLiveBrokerTiers] = useState<Record<string, any>>(BROKER_TIERS);
  const [livePrivateTier, setLivePrivateTier] = useState<Record<string, any>>(PRIVATE_TIER);

  useEffect(() => {
    fetch(apiUrl('/health'), { method: 'GET', cache: 'no-store' }).catch(() => {});
    fetch(apiUrl('/pricing-tiers'), { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (data.broker) setLiveBrokerTiers(data.broker);
        if (data.private) {
          const activePrivate = Object.fromEntries(
            Object.entries(data.private).filter(([, t]: [string, any]) => t.active !== false)
          );
          if (Object.keys(activePrivate).length > 0) setLivePrivateTier(activePrivate);
        }
      })
      .catch(() => {});
  }, []);

  const finishLogin = async (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    window.dispatchEvent(new Event('authChange'));

    const userResponse = await fetch(apiUrl('/auth/me'), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userResponse.json();

    let redirectTo = '/dashboard';
    if (userData.user_type === 'admin') redirectTo = '/admin';
    else if (userData.user_type === 'salesman') redirectTo = '/sales-rep/dashboard';
    else if (userData.user_type === 'user') redirectTo = '/account';

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

      <div className="min-h-screen section-light flex flex-col items-center justify-start py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl">

          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex justify-center mb-4">
              <Image src="/logo/logo-full-cropped.png" alt="YachtVersal" width={220} height={55} priority />
            </Link>
            <h2 className="text-2xl font-semibold text-secondary">
              {requires2fa ? 'Two-Factor Authentication' : showSignup ? 'List Your Yacht' : 'Seller Sign In'}
            </h2>
            <p className="mt-2 text-dark/70">
              {requires2fa
                ? `Enter the verification code sent to ${twoFaEmail}`
                : showSignup ? 'Choose a plan and get started today' : 'Welcome back to your seller account'}
            </p>
          </div>

          {/* ── 2FA code entry (replaces everything when active) ── */}
          {requires2fa ? (
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
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
            </div>
          ) : (
          <>
          {/* ── Sign In form — constrained width, collapses when accordion open ── */}
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out max-w-md mx-auto"
            style={{ maxHeight: showSignup ? 0 : 9999, opacity: showSignup ? 0 : 1 }}
          >
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
            </div>
          </div>

          {/* ── Signup accordion with full plan cards ── */}
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{ maxHeight: showSignup ? 9999 : 0, opacity: showSignup ? 1 : 0 }}
          >
            {/* Broker tiers — 4 columns */}
            <div className="mb-8">
              <div className="mb-5">
                <h3 className="text-xl font-bold text-secondary">Yacht Broker</h3>
                <p className="text-sm text-dark/60">Professional brokerage with multiple listings</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                {Object.entries(liveBrokerTiers).map(([key, tier]) => {
                  const isUltimate = key === 'ultimate';
                  return (
                    <div key={key} className={`flex flex-col p-7 rounded-2xl shadow-xl relative ${
                      isUltimate
                        ? 'bg-secondary text-white border-2 border-secondary'
                        : key === 'plus'
                        ? 'bg-white border-4 border-primary'
                        : 'bg-white border border-gray-100'
                    }`}>
                      {key === 'plus' && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">MOST POPULAR</span>
                        </div>
                      )}
                      {isUltimate && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="bg-gold text-secondary px-4 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: '#D4AF37' }}>ENTERPRISE</span>
                        </div>
                      )}
                      <h4 className={`text-xl font-bold mb-1 ${isUltimate ? 'text-white' : 'text-secondary'}`}>{tier.name}</h4>
                      {isUltimate ? (
                        <div className="mb-4">
                          <span className="text-2xl font-bold text-white/90">Custom Pricing</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl font-bold text-primary">${tier.price}</span>
                          <span className="text-dark/50 text-sm">/month</span>
                        </div>
                      )}

                      {isUltimate && <p className="text-xs text-white/60 font-medium mb-4">Tailored to your brokerage</p>}
                      <ul className="space-y-2 mb-6 flex-1">
                        {(tier.features || []).map((f: string, i: number) => (
                          <li key={i} className={`flex items-start gap-2 text-sm ${isUltimate ? 'text-white/80' : 'text-dark/70'}`}>
                            <Check size={14} className={`${isUltimate ? 'text-white/60' : 'text-primary'} mt-0.5 shrink-0`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div>
                      {isUltimate ? (
                        <Link
                          href="/contact?tier=ultimate"
                          className="block w-full py-2.5 text-center rounded-lg text-sm font-semibold bg-white text-secondary transition-all duration-200 hover:scale-105 hover:shadow-lg"
                        >
                          Contact Us
                        </Link>
                      ) : (
                        <Link
                          href={`/register?user_type=dealer&subscription_tier=${key}`}
                          className={`block w-full py-2.5 text-center rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                            key === 'plus' ? 'bg-primary' : 'bg-secondary'
                          }`}
                        >
                          Get Started
                        </Link>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Private Seller tiers */}
            <div>
              <div className="mb-5">
                <h3 className="text-xl font-bold text-secondary">Private Seller</h3>
                <p className="text-sm text-dark/60">Selling your own yacht — no broker, no sales commission</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {Object.entries(livePrivateTier).map(([key, tier]) => (
                  <div key={key} className={`flex flex-col p-7 rounded-2xl shadow-xl relative ${
                    key === 'private_plus'
                      ? 'bg-white border-4 border-primary'
                      : 'bg-white border border-gray-100'
                  }`}>
                    {key === 'private_plus' && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">BEST VALUE</span>
                      </div>
                    )}
                    <h4 className="text-xl font-bold text-secondary mb-1">{(tier as any).name}</h4>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-primary">${(tier as any).price}</span>
                      <span className="text-dark/50 text-sm">/month</span>
                    </div>

                    <p className="text-xs text-dark/50 mb-4">No commission on your sale price — ever</p>
                    <ul className="space-y-2 mb-6 flex-1">
                      {((tier as any).features || []).map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-dark/70">
                          <Check size={14} className="text-primary mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/register?user_type=private&subscription_tier=${key}`}
                      className={`block w-full py-2.5 text-center rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                        key === 'private_plus' ? 'bg-primary' : 'bg-secondary'
                      }`}
                    >
                      Get Started
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border border-gray-200 rounded-xl px-6 py-4 bg-gray-50">
              <p className="text-xs text-dark/60 leading-relaxed text-center">
                All plans start with a free trial &mdash; no charge until your trial ends.{' '}
                Subscriptions renew automatically each month.{' '}
                <strong>You may cancel at any time</strong> from your Account Dashboard under{' '}
                <strong>Billing</strong>; your access continues through the end of your current paid period with no further charges.{' '}
                Private seller plans never charge sales commission.
              </p>
            </div>
          </div>

          {/* ── Toggle button ── */}
          <div className="mt-5 max-w-md mx-auto">
            <button
              onClick={() => { setShowSignup((v) => !v); setError(''); }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 bg-white rounded-xl shadow-sm text-sm font-medium text-secondary hover:bg-gray-50 transition-colors"
            >
              {showSignup ? 'Already have an account? Sign In' : "Don't have an account? View Plans"}
              <ChevronDown
                size={16}
                className={`text-dark/50 transition-transform duration-300 ${showSignup ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* ── Cross-link ── */}
          <div className="text-center mt-5 space-y-2 max-w-md mx-auto">
            <p className="text-sm text-dark/50">
              Looking to buy a yacht?{' '}
              <Link href="/login/buyer" className="text-primary font-medium hover:text-primary/80">
                Buyer Sign In
              </Link>
            </p>
            <Link href="/" className="block text-sm text-dark/40 hover:text-dark/60">Back to home</Link>
          </div>
          </>
          )}

        </div>
      </div>
    </>
  );
}

function SellerLoginLoading() {
  return (
    <div className="min-h-screen section-light flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary" />
    </div>
  );
}

export default function SellerLoginPage() {
  return (
    <Suspense fallback={<SellerLoginLoading />}>
      <SellerLoginContent />
    </Suspense>
  );
}
