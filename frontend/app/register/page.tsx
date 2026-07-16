'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Loader2, ChevronLeft, ShieldCheck, Zap, Users } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { apiUrl, markLoggedIn } from '@/app/lib/apiRoot';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// --- One-time signup fees ------------------------------------------------------
const SIGNUP_FEE = 199;
const PRIVATE_SIGNUP_FEE = 149;

const INCLUDED_FEATURES = [
  'Unlimited active listings',
  'Unlimited photos & videos per listing',
  'Full buyer messaging & inquiry management',
  'AI-powered search placement',
  'Broker profile page with team roster',
  'Analytics dashboard',
  'Data feed sync & bulk import tools',
  'Co-brokering network access',
  'Full platform access',
];

const BUYER_FEATURES = [
  'Save unlimited favorite yachts',
  'Message sellers and brokers directly',
  'AI-powered search matched to your needs',
  'Price-drop and new-listing alerts',
  'Full access to every listing on the platform',
];

const PRIVATE_FEATURES = [
  'List your yacht for sale',
  'Professional listing presentation',
  'Global marketplace exposure',
  'Direct buyer inquiries',
  'Support from our team when you need it',
];

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBuyer = searchParams.get('user_type') === 'buyer';
  const isPrivate = searchParams.get('user_type') === 'private';
  const ref = searchParams.get('ref');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    website: '',
    agree_terms: false,
    agree_broker_terms: false,
    agree_communications: false,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!formData.agree_terms) {
      setError('You must agree to the Terms and Privacy Policy');
      return;
    }
    if (!isBuyer && !isPrivate && !formData.agree_broker_terms) {
      setError('You must read and agree to the Broker Services Agreement');
      return;
    }
    if (!isBuyer && !isPrivate && !formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }
    if (!formData.agree_communications) {
      setError('You must agree to receive account communications');
      return;
    }

    setLoading(true);
    try {
      const regRes = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          user_type: isPrivate ? 'private' : isBuyer ? 'buyer' : 'dealer',
          company_name: formData.company_name,
          ...(!isBuyer && !isPrivate ? { website: formData.website } : {}),
          subscription_tier: isPrivate ? 'private_active' : isBuyer ? 'free' : 'pro',
          agree_terms: formData.agree_terms,
          agree_communications: formData.agree_communications,
          ...(!isBuyer && ref ? { referral_code: ref } : {}),
        }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.detail || regData.error || 'Registration failed');

      markLoggedIn();
      window.dispatchEvent(new Event('authChange'));

      if (isBuyer) {
        router.push('/account');
        return;
      }

      setRedirecting(true);
      setLoading(false);

      const checkoutRes = await fetch(apiUrl(isPrivate ? '/payments/create-private-setup-fee-session' : '/payments/create-setup-fee-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regData.access_token}`,
        },
        body: JSON.stringify({
          embedded: true,
          return_url: `${window.location.origin}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        }),
      });

      const checkoutData = await checkoutRes.json();
      setRedirecting(false);
      if (!checkoutRes.ok) {
        const msg = checkoutData?.detail || checkoutData?.error || 'Payment setup failed. You can complete payment from your billing dashboard.';
        setError(`Account created, but payment setup failed: ${msg}`);
        setTimeout(() => router.push('/dashboard/billing?payment=required'), 3000);
        return;
      }
      setCheckoutSecret(checkoutData.client_secret);
      setCheckoutSessionId(checkoutData.session_id);
    } catch (err: any) {
      setError(err.message || 'Failed to register. Please try again.');
      setRedirecting(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutComplete = () => {
    router.push(`/dashboard?payment=success&session_id=${checkoutSessionId}`);
  };

  const submitLabel = redirecting
    ? 'Redirecting to payment...'
    : loading
    ? 'Creating account...'
    : isBuyer
    ? 'Create Free Account'
    : 'Register Account';

  return (
    <div className="min-h-screen section-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex justify-center mb-4">
            <Image src="/logo/logo-full-cropped.png" alt="YachtVersal" width={220} height={55} priority />
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* -- Left: value prop ------------------------------------------- */}
          <div>
            {isBuyer ? (
              <div className="inline-block mb-3 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary uppercase tracking-wide">
                Always Free
              </div>
            ) : isPrivate ? (
              <div className="inline-block mb-3 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Private Seller
              </div>
            ) : (
              <div className="inline-block mb-3 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Founding Member Offer
              </div>
            )}
            <h1 className="text-3xl font-bold text-secondary mb-2">
              {isBuyer ? 'Find Your Next Yacht' : isPrivate ? 'List Your Yacht Privately' : 'Join YachtVersal'}
            </h1>
            <p className="text-dark/60 mb-8 text-lg">
              {isBuyer
                ? 'Create a free buyer account to save listings, message sellers, and get alerts — no fees, ever.'
                : isPrivate
                ? 'Get started with a single listing fee — list your yacht and reach buyers worldwide.'
                : 'Get started with a single setup fee and full access to every tool on the platform.'}
            </p>

            {/* Pricing / features card */}
            <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-8 mb-8">
              {isBuyer ? (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-5xl font-extrabold text-primary">$0</span>
                    <span className="text-dark/50 text-lg font-medium">forever</span>
                  </div>
                  <p className="text-dark/60 text-sm mb-6">No credit card required.</p>
                </>
              ) : isPrivate ? (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-5xl font-extrabold text-primary">${PRIVATE_SIGNUP_FEE}</span>
                    <span className="text-dark/50 text-lg font-medium">one-time</span>
                  </div>
                  <p className="text-dark/60 text-sm mb-6">One-time payment. List your yacht from day one.</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-5xl font-extrabold text-primary">${SIGNUP_FEE}</span>
                    <span className="text-dark/50 text-lg font-medium">setup fee</span>
                  </div>
                  <p className="text-dark/60 text-sm mb-6">One-time payment. Full platform access from day one.</p>
                </>
              )}

              <ul className="space-y-3">
                {(isBuyer ? BUYER_FEATURES : isPrivate ? PRIVATE_FEATURES : INCLUDED_FEATURES).map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-dark/80">
                    <Check size={16} className="text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <ShieldCheck size={22} className="text-primary mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-secondary">{isBuyer ? 'Secure Account' : 'Secure Checkout'}</p>
                <p className="text-xs text-dark/50">{isBuyer ? 'Data protected' : 'Powered by Stripe'}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <Zap size={22} className="text-primary mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-secondary">Instant Access</p>
                <p className="text-xs text-dark/50">Go live today</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <Users size={22} className="text-primary mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-secondary">{isBuyer ? 'No Commitment' : isPrivate ? 'Real Support' : 'Team Support'}</p>
                <p className="text-xs text-dark/50">{isBuyer ? 'Cancel anytime' : isPrivate ? 'We help along the way' : 'Add salesmen free'}</p>
              </div>
            </div>
          </div>

          {/* -- Right: registration form / embedded payment ----------------- */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {checkoutSecret ? (
              <>
                <h2 className="text-xl font-semibold text-secondary mb-6">Complete Your Payment</h2>
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{ clientSecret: checkoutSecret, onComplete: handleCheckoutComplete }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </>
            ) : (
            <>
            <h2 className="text-xl font-semibold text-secondary mb-6">Create Your Account</h2>

            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-first-name" className="block text-sm font-medium text-dark mb-1.5">First Name *</label>
                  <input
                    id="reg-first-name"
                    type="text" required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="reg-last-name" className="block text-sm font-medium text-dark mb-1.5">Last Name *</label>
                  <input
                    id="reg-last-name"
                    type="text" required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {!isBuyer && !isPrivate && (
                <div>
                  <label htmlFor="reg-company" className="block text-sm font-medium text-dark mb-1.5">Brokerage / Company Name *</label>
                  <input
                    id="reg-company"
                    type="text" required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Your brokerage or company name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-dark mb-1.5">Email Address *</label>
                <input
                  id="reg-email"
                  type="email" required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={isBuyer || isPrivate ? 'you@example.com' : 'you@brokerage.com'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-dark mb-1.5">
                  Phone Number{!isBuyer && !isPrivate ? ' *' : ''}
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  required={!isBuyer && !isPrivate}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {!isBuyer && !isPrivate && (
                <div>
                  <label htmlFor="reg-website" className="block text-sm font-medium text-dark mb-1.5">Website (optional)</label>
                  <input
                    id="reg-website"
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourbrokerage.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-dark mb-1.5">Password *</label>
                  <input
                    id="reg-password"
                    type="password" required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min. 6 characters"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-dark mb-1.5">Confirm Password *</label>
                  <input
                    id="reg-confirm-password"
                    type="password" required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Repeat password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Agreements */}
              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-2">
                  <input
                    id="terms" type="checkbox"
                    checked={formData.agree_terms}
                    onChange={(e) => setFormData({ ...formData, agree_terms: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded mt-0.5"
                  />
                  <label htmlFor="terms" className="text-sm text-dark">
                    I agree to the{' '}
                    <Link href="/terms" target="_blank" className="text-primary hover:underline">Terms and Conditions</Link>{' '}
                    and{' '}
                    <Link href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>. *
                  </label>
                </div>

                {!isBuyer && !isPrivate && (
                  <div className="flex items-start gap-2">
                    <input
                      id="broker-terms" type="checkbox"
                      checked={formData.agree_broker_terms}
                      onChange={(e) => setFormData({ ...formData, agree_broker_terms: e.target.checked })}
                      className="h-4 w-4 text-primary border-gray-300 rounded mt-0.5"
                    />
                    <label htmlFor="broker-terms" className="text-sm text-dark">
                      I have read and agree to the{' '}
                      <Link href="/terms/broker" target="_blank" className="text-primary hover:underline">Broker Services Agreement</Link>
                      , including data import authorization, API co-brokering rights, and media licensing terms. *
                    </label>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <input
                    id="comms" type="checkbox"
                    checked={formData.agree_communications}
                    onChange={(e) => setFormData({ ...formData, agree_communications: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded mt-0.5"
                  />
                  <label htmlFor="comms" className="text-sm text-dark">
                    I agree to receive account and transactional communications via email. *
                  </label>
                </div>
              </div>

              {/* Payment note */}
              {isBuyer ? (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                  <p className="font-medium mb-0.5">Buyer accounts are always free</p>
                  <p className="text-blue-600">
                    Your account activates immediately after you sign up — no payment, no card required.
                  </p>
                </div>
              ) : isPrivate ? (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                  <p className="font-medium mb-0.5">Secure payment via Stripe</p>
                  <p className="text-blue-600">
                    After creating your account, enter your card right here to pay the{' '}
                    <strong>${PRIVATE_SIGNUP_FEE} one-time fee</strong>. Your account activates immediately after payment.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                  <p className="font-medium mb-0.5">Secure payment via Stripe</p>
                  <p className="text-blue-600">
                    After creating your account, enter your card right here to pay the{' '}
                    <strong>${SIGNUP_FEE} setup fee</strong>. Your account activates immediately after payment.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || redirecting}
                className="w-full py-3 px-4 rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(loading || redirecting) && <Loader2 size={16} className="animate-spin" />}
                {submitLabel}
              </button>

              <Link
                href={isBuyer ? '/login/buyer' : '/login/seller'}
                className="w-full flex items-center justify-center gap-1 text-sm text-dark/60 hover:text-dark transition-colors"
              >
                <ChevronLeft size={14} /> Already have an account? Sign in
              </Link>
            </form>
            </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-dark/40 mt-10">
          &copy; {new Date().getFullYear()} YachtVersal
        </p>
      </div>
    </div>
  );
}

function RegisterLoading() {
  return (
    <div className="min-h-screen section-light flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoading />}>
      <RegisterContent />
    </Suspense>
  );
}
