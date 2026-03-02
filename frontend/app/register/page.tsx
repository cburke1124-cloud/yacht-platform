'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

// ─── Dealer tiers (mirrors DEFAULT_DEALER_TIERS in admin settings) ────────────
// Internal keys are stable DB/Stripe identifiers.
// Display names (name field) are editable in Admin → Dealer Subscriptions and
// stored in the subscription_tiers table — these are just the registration fallbacks.
const DEALER_TIERS = {
  basic: {
    name: 'Basic',
    price: 29,
    trial_days: 14,
    features: ['25 active listings', '15 images per listing', '1 video per listing', 'Enhanced search visibility', 'Priority email support', 'Analytics dashboard'],
  },
  plus: {
    name: 'Plus',
    price: 59,
    trial_days: 14,
    features: ['75 active listings', '30 images per listing', '3 videos per listing', 'Priority search placement', 'Featured dealer badge', 'Priority support', 'Advanced analytics'],
  },
  pro: {
    name: 'Pro',
    price: 99,
    trial_days: 30,
    features: ['Unlimited listings', '50 images per listing', '5 videos per listing', 'Top search placement', 'Featured dealer badge', 'Dedicated account manager', 'Advanced analytics', 'AI scraper tools'],
  },
};

// ─── Private seller tiers (mirrors DEFAULT_PRIVATE_TIERS in admin settings) ──
// Completely separate from dealer tiers — different prices, different Stripe price IDs.
// Internal keys prefixed with private_ to avoid collisions with dealer keys in DB.
const PRIVATE_TIERS = {
  private_basic: {
    name: 'Basic',
    price: 9,
    trial_days: 7,
    features: ['1 active listing', '20 photos per listing', 'Standard search visibility', 'Email support'],
  },
  private_plus: {
    name: 'Plus',
    price: 19,
    trial_days: 7,
    features: ['3 active listings', '35 photos per listing', '1 video per listing', 'Priority search placement', 'Listing analytics'],
  },
  private_pro: {
    name: 'Pro',
    price: 39,
    trial_days: 14,
    features: ['10 active listings', '50 photos per listing', '3 videos per listing', 'Top search placement', 'Featured badge', 'Priority support', 'Social media promotion'],
  },
};

// All tiers now require Stripe — no free tier on either side.
// Keys must exactly match STRIPE_PRICES dict in stripe_service.py.
const PAID_DEALER_TIERS = new Set(['basic', 'plus', 'pro']);
const PAID_PRIVATE_TIERS = new Set(['private_basic', 'private_plus', 'private_pro']);

type DealerTierKey = keyof typeof DEALER_TIERS;
type PrivateTierKey = keyof typeof PRIVATE_TIERS;

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    user_type: 'buyer',
    company_name: '',
    subscription_tier: 'basic',
    agree_terms: false,
    agree_communications: false,
    marketing_opt_in: false,
    referral_code: '',
    deal_code: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stripeRedirecting, setStripeRedirecting] = useState(false);

  // ─── Deep-link from marketing pages ─────────────────────────────────────
  // /sell/list-brokers  → /register?user_type=dealer&subscription_tier=basic
  // /sell/private       → /register?user_type=private&subscription_tier=private_basic
  useEffect(() => {
    const userType = searchParams.get('user_type');
    const tier = searchParams.get('subscription_tier');
    const referralCode = searchParams.get('ref');
    const dealCode = searchParams.get('deal');

    if (referralCode || dealCode) {
      setFormData((prev) => ({
        ...prev,
        referral_code: referralCode || prev.referral_code,
        deal_code: dealCode || prev.deal_code,
      }));
    }

    if (userType === 'dealer' && tier && tier in DEALER_TIERS) {
      setFormData((prev) => ({ ...prev, user_type: 'dealer', subscription_tier: tier }));
      setStep(3);
    } else if (userType === 'private') {
      const resolvedTier = tier && tier in PRIVATE_TIERS ? tier : 'private_basic';
      setFormData((prev) => ({ ...prev, user_type: 'private', subscription_tier: resolvedTier }));
      setStep(3);
    }
  }, [searchParams]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const isPaidTier = (userType: string, tier: string): boolean => {
    if (userType === 'dealer') return PAID_DEALER_TIERS.has(tier);
    if (userType === 'private') return PAID_PRIVATE_TIERS.has(tier);
    return false;
  };

  const getTierInfo = (userType: string, tier: string) => {
    if (userType === 'dealer') return DEALER_TIERS[tier as DealerTierKey] ?? DEALER_TIERS.basic;
    if (userType === 'private') return PRIVATE_TIERS[tier as PrivateTierKey] ?? PRIVATE_TIERS.private_basic;
    return null;
  };

  const getSubmitLabel = () => {
    if (stripeRedirecting) return 'Redirecting to payment…';
    if (loading) return 'Creating account…';
    return isPaidTier(formData.user_type, formData.subscription_tier)
      ? 'Create Account & Pay'
      : 'Create Account';
  };

  // ─── Form submit ─────────────────────────────────────────────────────────
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
    if (!formData.agree_communications) {
      setError('You must agree to receive account communications');
      return;
    }

    setLoading(true);
    try {
      // 1. Create the account
      const regRes = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          user_type: formData.user_type,
          company_name: formData.company_name,
          subscription_tier: formData.subscription_tier,
          agree_terms: formData.agree_terms,
          agree_communications: formData.agree_communications,
          marketing_opt_in: formData.marketing_opt_in,
          referral_code: formData.referral_code || undefined,
          deal_code: formData.deal_code || undefined,
        }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.detail || regData.error || 'Registration failed');
      localStorage.setItem('token', regData.access_token);
      window.dispatchEvent(new Event('authChange'));

      // 2. If paid tier, redirect to Stripe Checkout
      if (isPaidTier(formData.user_type, formData.subscription_tier)) {
        setStripeRedirecting(true);
        setLoading(false);

        const checkoutRes = await fetch(
          apiUrl('/payments/create-checkout-session'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${regData.access_token}`,
            },
            body: JSON.stringify({
              subscription_tier: formData.subscription_tier,
              // Backend uses user_type to look up the correct STRIPE_PRICES entry
              user_type: formData.user_type,
              success_url: `${window.location.origin}/dashboard?payment=success`,
              cancel_url: `${window.location.origin}/register?payment=cancelled&user_type=${formData.user_type}&subscription_tier=${formData.subscription_tier}`,
            }),
          }
        );

        const checkoutData = await checkoutRes.json();

        if (!checkoutRes.ok) {
          // Account created but checkout session failed — don't block onboarding
          console.error('Checkout error:', checkoutData);
          router.push('/dashboard?payment=pending');
          return;
        }

        // Full-page redirect to Stripe hosted checkout
        window.location.href = checkoutData.checkout_url;
        return;
      }

      // All tiers are paid — go to dashboard after Stripe (handled above).
      // For buyers, no Stripe needed, go straight to account.
      router.push(formData.user_type === 'buyer' ? '/account' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to register. Please try again.');
      setStripeRedirecting(false);
    } finally {
      setLoading(false);
    }
  };

  const selectedTierInfo = getTierInfo(formData.user_type, formData.subscription_tier);
  const currentIsPaid = isPaidTier(formData.user_type, formData.subscription_tier);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Account Type
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-section-light to-soft py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Link href="/"><h1 className="text-4xl font-bold text-primary mb-2">YachtVersal</h1></Link>
            <h2 className="text-2xl font-semibold text-secondary">Choose Your Account Type</h2>
            <p className="mt-2 text-dark/70">Select the option that best fits your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* BUYER */}
            <button
              onClick={() => { setFormData({ ...formData, user_type: 'buyer', subscription_tier: '' }); setStep(3); }}
              className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary text-left"
            >
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-secondary mb-3">Yacht Buyer</h3>
              <p className="text-dark/70 mb-4">Looking to purchase a yacht? Create a free account</p>
              <ul className="text-sm text-dark space-y-2">
                {['Always free', 'Save unlimited yachts', 'Price drop alerts', 'Saved search alerts', 'Message dealers'].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={16} className="text-green-600 flex-shrink-0" />{f}</li>
                ))}
              </ul>
            </button>

            {/* DEALER */}
            <button
              onClick={() => { setFormData({ ...formData, user_type: 'dealer' }); setStep(2); }}
              className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary text-left"
            >
              <div className="text-5xl mb-4">🏢</div>
              <h3 className="text-2xl font-bold text-secondary mb-3">Yacht Dealer / Broker</h3>
              <p className="text-dark/70 mb-4">Professional broker or dealership selling multiple vessels</p>
              <ul className="text-sm text-dark space-y-2">
                {['Multiple listings', 'Business profile page', 'Advanced analytics', 'AI scraper tools', 'Dedicated account support'].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={16} className="text-green-600 flex-shrink-0" />{f}</li>
                ))}
              </ul>
            </button>

            {/* PRIVATE SELLER */}
            <button
              onClick={() => { setFormData({ ...formData, user_type: 'private' }); setStep(4); }}
              className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary text-left"
            >
              <div className="text-5xl mb-4">👤</div>
              <h3 className="text-2xl font-bold text-secondary mb-3">Private Seller</h3>
              <p className="text-dark/70 mb-4">Selling your own yacht — no broker, no commissions</p>
              <ul className="text-sm text-dark space-y-2">
                {['List your own yacht', 'No sales commission', 'Direct buyer contact', 'Full listing control', 'Plans from $9/month'].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={16} className="text-green-600 flex-shrink-0" />{f}</li>
                ))}
              </ul>
            </button>
          </div>

          <div className="text-center">
            <Link href="/login" className="text-sm text-primary hover:text-primary/90">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Dealer Tier Selection
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 2 && formData.user_type === 'dealer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-section-light to-soft py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Link href="/"><h1 className="text-4xl font-bold text-primary mb-2">YachtVersal</h1></Link>
            <h2 className="text-2xl font-semibold text-secondary">Choose Your Dealer Plan</h2>
            <p className="mt-2 text-dark/70">Select the subscription tier that fits your business</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {Object.entries(DEALER_TIERS).map(([key, tier]) => (
              <div key={key} className={`bg-white p-8 rounded-2xl shadow-xl relative ${key === 'plus' ? 'border-4 border-primary' : ''}`}>
                {key === 'plus' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">MOST POPULAR</span>
                  </div>
                )}
                <h3 className="text-2xl font-bold text-secondary mb-2">{tier.name}</h3>
                <div className="mb-1">
                  <span className="text-4xl font-bold text-secondary">${tier.price}</span>
                  <span className="text-dark/70">/month</span>
                </div>
                {tier.trial_days > 0 && <p className="text-xs text-primary font-medium mb-3">{tier.trial_days}-day free trial</p>}
                <p className="text-xs text-dark/50 mb-4">🔒 Billed securely via Stripe</p>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-dark">
                      <Check size={16} className="text-green-600 mt-1 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { setFormData({ ...formData, subscription_tier: key }); setStep(3); }}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${key === 'plus' ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 text-secondary hover:bg-gray-200'}`}
                >
                  {`Select ${tier.name} — $${tier.price}/mo`}
                </button>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button onClick={() => setStep(1)} className="text-sm text-dark/70 hover:text-dark">← Back to account type</button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Private Seller Tier Selection
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 4 && formData.user_type === 'private') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-section-light to-soft py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Link href="/"><h1 className="text-4xl font-bold text-primary mb-2">YachtVersal</h1></Link>
            <h2 className="text-2xl font-semibold text-secondary">Choose Your Listing Plan</h2>
            <p className="mt-2 text-dark/70">Pick the plan that suits your sale. No commission on your sale price — ever.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {Object.entries(PRIVATE_TIERS).map(([key, tier]) => (
              <div key={key} className={`bg-white p-8 rounded-2xl shadow-xl relative ${key === 'private_plus' ? 'border-4 border-primary' : ''}`}>
                {key === 'private_plus' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">MOST POPULAR</span>
                  </div>
                )}
                <h3 className="text-2xl font-bold text-secondary mb-2">{tier.name}</h3>
                <div className="mb-1">
                  <span className="text-4xl font-bold text-secondary">${tier.price}</span>
                  <span className="text-dark/70">/month</span>
                </div>
                {tier.trial_days > 0 && <p className="text-xs text-primary font-medium mb-3">{tier.trial_days}-day free trial</p>}
                <p className="text-xs text-dark/50 mb-4">🔒 Billed securely via Stripe</p>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-dark">
                      <Check size={16} className="text-green-600 mt-1 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { setFormData({ ...formData, subscription_tier: key }); setStep(3); }}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${key === 'private_plus' ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 text-secondary hover:bg-gray-200'}`}
                >
                  {tier.trial_days > 0
                    ? `Start ${tier.trial_days}-day trial — $${tier.price}/mo`
                    : `Select ${tier.name} — $${tier.price}/mo`}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-dark/50 mb-4">
            No commission on your sale price. Cancel your subscription anytime.
          </p>
          <div className="text-center">
            <button onClick={() => setStep(1)} className="text-sm text-dark/70 hover:text-dark">← Back to account type</button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Registration Form (all user types land here)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-section-light to-soft py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/"><h1 className="text-4xl font-bold text-primary mb-2">YachtVersal</h1></Link>
          <h2 className="text-2xl font-semibold text-secondary">Complete Your Registration</h2>

          {selectedTierInfo && formData.user_type !== 'buyer' && (
            <p className="mt-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-secondary rounded-full text-sm font-medium">
                {selectedTierInfo.name} Plan — ${selectedTierInfo.price}/month
                {currentIsPaid && <span className="text-xs text-dark/50">· payment via Stripe</span>}
              </span>
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {searchParams.get('payment') === 'cancelled' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Payment was cancelled.</strong> Your account has been created — you can complete payment from your dashboard at any time.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">First Name *</label>
                <input type="text" required value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Last Name *</label>
                <input type="text" required value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">Email Address *</label>
              <input type="email" required value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">Phone Number</label>
              <input type="tel" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="+1 (555) 000-0000" />
            </div>

            {formData.user_type === 'dealer' && (
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Company Name *</label>
                <input type="text" required value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Your brokerage or company name" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Password *</label>
                <input type="password" required value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Confirm Password *</label>
                <input type="password" required value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start">
                <input
                  id="terms"
                  type="checkbox"
                  checked={formData.agree_terms}
                  onChange={(e) => setFormData({ ...formData, agree_terms: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-dark">
                  I agree to the <Link href="/terms" className="text-primary hover:text-primary/90">Terms and Conditions</Link> and <Link href="/privacy" className="text-primary hover:text-primary/90">Privacy Policy</Link>. *
                </label>
              </div>

              <div className="flex items-start">
                <input
                  id="communications"
                  type="checkbox"
                  checked={formData.agree_communications}
                  onChange={(e) => setFormData({ ...formData, agree_communications: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1"
                />
                <label htmlFor="communications" className="ml-2 block text-sm text-dark">
                  I agree to receive account communications from YachtVersal, including emails, SMS/text messages (data rates may apply), and push notifications when available. *
                </label>
              </div>

              <div className="flex items-start">
                <input
                  id="marketing"
                  type="checkbox"
                  checked={formData.marketing_opt_in}
                  onChange={(e) => setFormData({ ...formData, marketing_opt_in: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1"
                />
                <label htmlFor="marketing" className="ml-2 block text-sm text-dark">
                  I want to receive marketing emails about product updates, offers, and yacht marketplace insights. (Optional)
                </label>
              </div>
            </div>

            {currentIsPaid && selectedTierInfo && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">🔒 Secure payment via Stripe</p>
                <p className="text-blue-600">
                  After creating your account you'll be taken to Stripe's secure checkout to complete
                  your <strong>{selectedTierInfo.name}</strong> subscription (${selectedTierInfo.price}/month).
                  You can cancel anytime from your dashboard.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || stripeRedirecting}
              className="w-full py-3 px-4 rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {(loading || stripeRedirecting) && <Loader2 size={16} className="animate-spin" />}
              {getSubmitLabel()}
            </button>

            <button
              type="button"
              onClick={() => {
                if (formData.user_type === 'dealer') setStep(2);
                else if (formData.user_type === 'private') setStep(4);
                else setStep(1);
              }}
              className="w-full text-center text-sm text-dark/70 hover:text-dark"
            >
              ← Back
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-primary hover:text-primary/90">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

function RegisterLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-section-light to-soft py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto text-center">
        <Loader2 size={24} className="animate-spin mx-auto text-primary" />
      </div>
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