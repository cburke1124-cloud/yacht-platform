'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/apiRoot';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import TermsAcceptanceModal from '@/app/components/TermsAcceptanceModal';

// Fallback tiers for the signup accordion
const BROKER_TIERS: Record<string, any> = {
  basic: { name: 'Basic', price: 29, trial_days: 14, features: ['25 active listings', '15 images/listing', 'Analytics dashboard'] },
  plus:  { name: 'Plus',  price: 59, trial_days: 14, features: ['75 active listings', '30 images/listing', 'Priority placement', 'Featured badge'] },
  pro:   { name: 'Pro',   price: 99, trial_days: 30, features: ['Unlimited listings', '50 images/listing', 'Dedicated manager', 'AI tools'] },
};
const PRIVATE_TIER: Record<string, any> = {
  private_basic: { name: 'Private Seller', price: 9, trial_days: 7, features: ['1 active listing', '20 photos', 'Direct buyer messaging', 'No sales commission'] },
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string>('/dashboard');
  const [userName, setUserName] = useState<string | undefined>();
  const [userType, setUserType] = useState<string | undefined>();

  // Accordion state: showSignup=true collapses the login form and shows signup plans
  const [showSignup, setShowSignup] = useState(false);

  const [liveBrokerTiers, setLiveBrokerTiers] = useState<Record<string, any>>(BROKER_TIERS);
  const [livePrivateTier, setLivePrivateTier] = useState<Record<string, any>>(PRIVATE_TIER);

  // Pre-warm backend + fetch tiers + check URL param
  useEffect(() => {
    fetch(apiUrl('/health'), { method: 'GET', cache: 'no-store' }).catch(() => {});
    fetch(apiUrl('/pricing-tiers'), { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (data.broker) setLiveBrokerTiers(data.broker);
        if (data.private) {
          const k = Object.keys(data.private)[0];
          if (k) setLivePrivateTier({ private_basic: data.private[k] });
        }
      })
      .catch(() => {});

    // If coming from "Sign In as Seller" in navbar, open signup section immediately
    if (searchParams.get('type') === 'seller') setShowSignup(true);
  }, [searchParams]);

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

      localStorage.setItem('token', data.access_token);
      window.dispatchEvent(new Event('authChange'));

      const userResponse = await fetch(apiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const userData = await userResponse.json();

      let redirectTo = '/dashboard';
      if (userData.user_type === 'admin') redirectTo = '/admin';
      else if (userData.user_type === 'salesman') redirectTo = '/sales-rep/dashboard';
      else if (userData.user_type === 'user') redirectTo = '/account';

      if (userData.user_type !== 'admin' && !userData.agreed_terms) {
        setUserName(userData.first_name || undefined);
        setUserType(userData.user_type || undefined);
        setPendingRedirect(redirectTo);
        setShowTermsModal(true);
        return;
      }

      router.push(redirectTo);
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
            <Link href="/" className="inline-block">
              <h1 className="text-4xl font-bold text-primary mb-2">YachtVersal</h1>
            </Link>
            <h2 className="text-2xl font-semibold text-secondary">{showSignup ? 'Create Your Account' : 'Welcome Back'}</h2>
            <p className="mt-2 text-dark/70">{showSignup ? 'Select a plan to get started' : 'Sign in to your account'}</p>
          </div>

          {/* ── Sign In section — collapses when showSignup is true ── */}
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{ maxHeight: showSignup ? 0 : 9999, opacity: showSignup ? 0 : 1 }}
          >
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-dark mb-2">Email Address</label>
                  <input
                    id="email" name="email" type="email" required autoComplete="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-dark mb-2">Password</label>
                  <input
                    id="password" name="password" type="password" required autoComplete="current-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="........"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-primary focus:ring-primary border-gray-200 rounded" />
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

          {/* ── Sign Up section — expands when showSignup is true ── */}
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{ maxHeight: showSignup ? 9999 : 0, opacity: showSignup ? 1 : 0 }}
          >
            <div className="space-y-4">
              {/* Broker tiers */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-dark/50 mb-4">Yacht Broker / Dealer</p>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(liveBrokerTiers).map(([key, tier]) => (
                    <Link
                      key={key}
                      href={`/register?user_type=dealer&subscription_tier=${key}`}
                      className={`block p-4 rounded-xl border-2 text-center transition-all hover:border-primary hover:shadow-md ${key === 'plus' ? 'border-primary bg-primary/5' : 'border-gray-100'}`}
                    >
                      <p className="font-bold text-secondary text-sm">{tier.name}</p>
                      <p className="text-2xl font-bold text-primary mt-1">${tier.price}</p>
                      <p className="text-xs text-dark/50">/month</p>
                      {tier.trial_days > 0 && <p className="text-xs text-primary mt-1">{tier.trial_days}-day trial</p>}
                      <ul className="mt-3 space-y-1 text-left">
                        {(tier.features as string[]).map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-1 text-xs text-dark/70">
                            <Check size={10} className="text-green-500 mt-0.5 flex-shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Private seller tier */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-dark/50 mb-4">Private Seller</p>
                {Object.entries(livePrivateTier).map(([key, tier]) => (
                  <Link
                    key={key}
                    href={`/register?user_type=private&subscription_tier=${key}`}
                    className="flex items-center justify-between p-4 rounded-xl border-2 border-primary/20 hover:border-primary transition-all hover:shadow-md"
                  >
                    <div>
                      <p className="font-bold text-secondary">{tier.name}</p>
                      {tier.trial_days > 0 && <p className="text-xs text-primary">{tier.trial_days}-day free trial</p>}
                      <ul className="mt-1 space-y-0.5">
                        {(tier.features as string[]).map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-1 text-xs text-dark/70">
                            <Check size={10} className="text-green-500 mt-0.5 flex-shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-3xl font-bold text-primary">${tier.price}</p>
                      <p className="text-xs text-dark/50">/month</p>
                    </div>
                  </Link>
                ))}
              </div>

              <p className="text-center text-xs text-dark/50 pb-2">
                All plans billed via Stripe. Cancel anytime. No sales commission.
              </p>
            </div>
          </div>

          {/* ── Toggle button — "Don't have an account?" / "Already have an account?" ── */}
          <div className="mt-5">
            <button
              onClick={() => { setShowSignup((v) => !v); setError(''); }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 bg-white rounded-xl shadow-sm text-sm font-medium text-secondary hover:bg-gray-50 transition-colors"
            >
              {showSignup ? 'Already have an account? Sign In' : "Don't Have an Account? Sign Up Now"}
              <ChevronDown
                size={16}
                className={`text-dark/50 transition-transform duration-300 ${showSignup ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          <div className="text-center mt-6">
            <Link href="/" className="text-sm text-primary hover:text-primary/80">Back to home</Link>
          </div>
        </div>
      </div>
    </>
  );
}

function LoginLoading() {
  return (
    <div className="min-h-screen section-light flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
