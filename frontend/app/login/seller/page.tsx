'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiUrl } from '@/app/lib/apiRoot';
import { ChevronDown, Loader2, Star } from 'lucide-react';
import TermsAcceptanceModal from '@/app/components/TermsAcceptanceModal';

const BROKER_PLANS = [
  { key: 'basic',   name: 'Basic',          price: 29,  trial: 14, popular: false },
  { key: 'plus',    name: 'Plus',           price: 59,  trial: 14, popular: true  },
  { key: 'pro',     name: 'Pro',            price: 99,  trial: 30, popular: false },
];

const PRIVATE_PLAN = { key: 'private_basic', name: 'Private Seller', price: 9, trial: 7 };

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

  useEffect(() => {
    fetch(apiUrl('/health'), { method: 'GET', cache: 'no-store' }).catch(() => {});
  }, []);

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
            <Link href="/" className="inline-flex justify-center mb-4">
              <Image src="/logo/logo-full-cropped.png" alt="YachtVersal" width={220} height={55} priority />
            </Link>
            <h2 className="text-2xl font-semibold text-secondary">
              {showSignup ? 'List Your Yacht' : 'Seller Sign In'}
            </h2>
            <p className="mt-2 text-dark/70">
              {showSignup ? 'Choose a plan and get started today' : 'Welcome back to your seller account'}
            </p>
          </div>

          {/* ── Sign In form — collapses when accordion open ── */}
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

          {/* ── Signup accordion with pricing ── */}
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{ maxHeight: showSignup ? 9999 : 0, opacity: showSignup ? 1 : 0 }}
          >
            <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">

              {/* Broker / Dealer plans */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-dark/40 mb-2">
                  🏢 Broker / Dealer
                </p>
                <div className="space-y-2">
                  {BROKER_PLANS.map((plan) => (
                    <Link
                      key={plan.key}
                      href={`/register?user_type=dealer&subscription_tier=${plan.key}`}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors hover:bg-primary/5 ${
                        plan.popular
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-secondary text-sm">{plan.name}</span>
                        {plan.popular && (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-primary">
                            <Star size={10} fill="currentColor" /> POPULAR
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-secondary">${plan.price}<span className="text-xs font-normal text-dark/50">/mo</span></span>
                        <span className="text-xs text-primary font-semibold">Get Started →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Private seller plan */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-dark/40 mb-2">
                  🏠 Private Seller
                </p>
                <Link
                  href={`/register?user_type=private&subscription_tier=${PRIVATE_PLAN.key}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 transition-colors hover:bg-primary/5"
                >
                  <span className="font-semibold text-secondary text-sm">{PRIVATE_PLAN.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-secondary">${PRIVATE_PLAN.price}<span className="text-xs font-normal text-dark/50">/mo</span></span>
                    <span className="text-xs text-primary font-semibold">Get Started →</span>
                  </div>
                </Link>
              </div>

              <p className="text-center text-xs text-dark/40 pt-1">
                All plans include a free trial · No commission on sales
              </p>
            </div>
          </div>

          {/* ── Toggle button ── */}
          <div className="mt-5">
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
          <div className="text-center mt-5 space-y-2">
            <p className="text-sm text-dark/50">
              Looking to buy a yacht?{' '}
              <Link href="/login/buyer" className="text-primary font-medium hover:text-primary/80">
                Buyer Sign In
              </Link>
            </p>
            <Link href="/" className="block text-sm text-dark/40 hover:text-dark/60">Back to home</Link>
          </div>

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
