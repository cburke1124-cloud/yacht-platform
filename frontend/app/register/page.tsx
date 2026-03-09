'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Loader2, ChevronLeft } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

// --- Fallback broker tiers ---
const BROKER_TIERS: Record<string, any> = {
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
    features: ['75 active listings', '30 images per listing', '3 videos per listing', 'Priority search placement', 'Featured broker badge', 'Priority support', 'Advanced analytics'],
  },
  pro: {
    name: 'Pro',
    price: 99,
    trial_days: 30,
    features: ['Unlimited listings', '50 images per listing', '5 videos per listing', 'Top search placement', 'Featured broker badge', 'Dedicated account manager', 'Advanced analytics', 'AI scraper tools'],
  },
};

// --- Fallback private seller tier (single plan) ---
const PRIVATE_TIER: Record<string, any> = {
  private_basic: {
    name: 'Private Seller',
    price: 9,
    trial_days: 7,
    features: ['1 active listing', '20 photos per listing', '1 video per listing', 'Standard search visibility', 'Direct buyer messaging', 'Email support'],
  },
};

const PAID_TIERS = new Set(['basic', 'plus', 'pro', 'private_basic']);

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    user_type: 'dealer' as 'dealer' | 'private' | 'buyer',
    company_name: '',
    subscription_tier: 'basic',
    agree_terms: false,
    agree_broker_terms: false,
    agree_communications: false,
    marketing_opt_in: false,
    referral_code: '',
    deal_code: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stripeRedirecting, setStripeRedirecting] = useState(false);

  const [liveBrokerTiers, setLiveBrokerTiers] = useState<Record<string, any>>(BROKER_TIERS);
  const [livePrivateTier, setLivePrivateTier] = useState<Record<string, any>>(PRIVATE_TIER);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const userType = searchParams.get('user_type');
    const tier = searchParams.get('subscription_tier');
    const ref = searchParams.get('ref');
    const deal = searchParams.get('deal');

    if (ref || deal) {
      setFormData((prev) => ({
        ...prev,
        referral_code: ref || prev.referral_code,
        deal_code: deal || prev.deal_code,
      }));
    }

    if (userType === 'buyer') {
      setFormData((prev) => ({ ...prev, user_type: 'buyer', subscription_tier: '' }));
      setShowForm(true);
    } else if (userType === 'dealer' && tier && tier in BROKER_TIERS) {
      setFormData((prev) => ({ ...prev, user_type: 'dealer', subscription_tier: tier }));
      setShowForm(true);
    } else if (userType === 'private') {
      setFormData((prev) => ({ ...prev, user_type: 'private', subscription_tier: 'private_basic' }));
      setShowForm(true);
    }
  }, [searchParams]);

  const selectPlan = (userType: 'dealer' | 'private', tierKey: string) => {
    setFormData((prev) => ({ ...prev, user_type: userType, subscription_tier: tierKey }));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getSelectedTierInfo = () => {
    if (formData.user_type === 'dealer') return liveBrokerTiers[formData.subscription_tier] ?? liveBrokerTiers['basic'];
    return livePrivateTier['private_basic'];
  };

  const getSubmitLabel = () => {
    if (stripeRedirecting) return 'Redirecting to payment...';
    if (loading) return 'Creating account...';
    return PAID_TIERS.has(formData.subscription_tier) ? 'Create Account & Pay' : 'Create Account';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!formData.agree_terms) { setError('You must agree to the Terms and Privacy Policy'); return; }
    if (formData.user_type === 'dealer' && formData.subscription_tier !== '' && !formData.agree_broker_terms) {
      setError('Brokers must read and agree to the Broker Services Agreement'); return;
    }
    if (!formData.agree_communications) { setError('You must agree to receive account communications'); return; }

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

      if (PAID_TIERS.has(formData.subscription_tier)) {
        setStripeRedirecting(true);
        setLoading(false);

        const checkoutRes = await fetch(apiUrl('/payments/create-checkout-session'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${regData.access_token}`,
          },
          body: JSON.stringify({
            subscription_tier: formData.subscription_tier,
            user_type: formData.user_type,
            success_url: `${window.location.origin}/dashboard?payment=success`,
            cancel_url: `${window.location.origin}/register?payment=cancelled&user_type=${formData.user_type}&subscription_tier=${formData.subscription_tier}`,
          }),
        });

        const checkoutData = await checkoutRes.json();
        if (!checkoutRes.ok) { router.push('/dashboard?payment=pending'); return; }
        window.location.href = checkoutData.checkout_url;
        return;
      }

      router.push(formData.user_type === 'buyer' ? '/account' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to register. Please try again.');
      setStripeRedirecting(false);
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // PLAN SELECTION
  // ===========================================================================
  if (!showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-section-light to-soft py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex justify-center mb-4">
              <Image src="/logo/logo-full-cropped.png" alt="YachtVersal" width={220} height={55} priority />
            </Link>
            <h2 className="text-2xl font-semibold text-secondary">Choose Your Plan</h2>
            <p className="mt-2 text-dark/70">All plans include a free trial. Cancel anytime. No commission on sales.</p>
          </div>

          {/* Yacht Broker tiers */}
          <div className="mb-10">
            <h3 className="text-base font-bold text-secondary mb-2">Yacht Broker</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
              {Object.entries(liveBrokerTiers).map(([key, tier]) => (
                <div key={key} className={`bg-white p-8 rounded-2xl shadow-xl relative flex flex-col ${key === 'plus' ? 'border-4 border-primary' : 'border border-gray-100'}`}>
                  {key === 'plus' && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">MOST POPULAR</span>
                    </div>
                  )}
                  <h4 className="text-xl font-bold text-secondary mb-1">{tier.name}</h4>
                  <div className="mb-1">
                    <span className="text-4xl font-bold text-secondary">${tier.price}</span>
                    <span className="text-dark/70">/month</span>
                  </div>
                  {tier.trial_days > 0 && <p className="text-xs text-primary font-medium mb-3">{tier.trial_days}-day free trial</p>}
                  <p className="text-xs text-dark/50 mb-4">Billed securely via Stripe</p>
                  <ul className="space-y-2 mb-8 mt-auto">
                    {(tier.features as string[]).map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-dark">
                        <Check size={14} className="text-green-600 mt-0.5 flex-shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => selectPlan('dealer', key)}
                    className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${key === 'plus' ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 text-secondary hover:bg-gray-200'}`}
                  >
                    Get Started
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-gradient-to-br from-section-light to-soft text-dark/50 text-sm">or</span>
            </div>
          </div>

          {/* Private Seller — full width */}
          <div className="mb-10">
            <h3 className="text-base font-bold text-secondary mb-4">Private Seller</h3>
            {Object.entries(livePrivateTier).map(([key, tier]) => (
              <div key={key} className="bg-white p-8 rounded-2xl shadow-xl border-2 border-primary/20">
                <div className="flex flex-wrap items-end gap-x-8 gap-y-1 mb-6">
                  <div>
                    <h4 className="text-xl font-bold text-secondary mb-0.5">{tier.name.toLowerCase() === 'basic' ? 'Owner' : tier.name}</h4>
                    <p className="text-xs text-dark/50">No commission on your sale price — ever</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-secondary">${tier.price}</span>
                    <span className="text-dark/70 text-sm">/month</span>
                  </div>
                  {tier.trial_days > 0 && (
                    <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full">
                      {tier.trial_days}-day free trial
                    </span>
                  )}
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 mb-6">
                  {(tier.features as string[]).map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-dark">
                      <Check size={14} className="text-green-600 mt-0.5 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => selectPlan('private', key)}
                  className="w-full py-3 rounded-lg font-semibold text-sm bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>

          <div className="text-center mt-4">
            <p className="text-sm text-dark/50">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // REGISTRATION FORM
  // ===========================================================================
  const selectedTierInfo = getSelectedTierInfo();
  const isBuyer = formData.user_type === 'buyer';

  return (
    <div className="min-h-screen bg-gradient-to-br from-section-light to-soft py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex justify-center mb-4">
            <Image src="/logo/logo-full-cropped.png" alt="YachtVersal" width={220} height={55} priority />
          </Link>
          <h2 className="text-2xl font-semibold text-secondary">
            {isBuyer ? 'Create a Free Buyer Account' : 'Complete Your Registration'}
          </h2>

          {selectedTierInfo && !isBuyer && (
            <p className="mt-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-secondary rounded-full text-sm font-medium">
                {selectedTierInfo.name} Plan � ${selectedTierInfo.price}/month
                <span className="text-xs text-dark/50">� payment via Stripe</span>
              </span>
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {searchParams.get('payment') === 'cancelled' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Payment was cancelled.</strong> Your account has been created � complete payment from your dashboard at any time.
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
                  className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Last Name *</label>
                <input type="text" required value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">Email Address *</label>
              <input type="email" required value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">Phone Number</label>
              <input type="tel" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="+1 (555) 000-0000" />
            </div>

            {formData.user_type === 'dealer' && !isBuyer && (
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Company / Brokerage Name *</label>
                <input type="text" required value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Your brokerage or company name" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Password *</label>
                <input type="password" required value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="........" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Confirm Password *</label>
                <input type="password" required value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="........" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start">
                <input id="terms" type="checkbox" checked={formData.agree_terms}
                  onChange={(e) => setFormData({ ...formData, agree_terms: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1" />
                <label htmlFor="terms" className="ml-2 block text-sm text-dark">
                  I agree to the <Link href="/terms" target="_blank" className="text-primary hover:text-primary/90">Terms and Conditions</Link>{' '}
                  and <Link href="/privacy" target="_blank" className="text-primary hover:text-primary/90">Privacy Policy</Link>. *
                </label>
              </div>

              {formData.user_type === 'dealer' && !isBuyer && (
                <div className="flex items-start">
                  <input id="broker-terms" type="checkbox" checked={formData.agree_broker_terms}
                    onChange={(e) => setFormData({ ...formData, agree_broker_terms: e.target.checked })}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1" />
                  <label htmlFor="broker-terms" className="ml-2 block text-sm text-dark">
                    I have read and agree to the{' '}
                    <Link href="/terms/broker" target="_blank" className="text-primary hover:text-primary/90">Broker Services Agreement</Link>
                    , including website data import authorization, API co-brokering rights, and media licensing terms. *
                  </label>
                </div>
              )}

              <div className="flex items-start">
                <input id="communications" type="checkbox" checked={formData.agree_communications}
                  onChange={(e) => setFormData({ ...formData, agree_communications: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1" />
                <label htmlFor="communications" className="ml-2 block text-sm text-dark">
                  I agree to receive account communications from YachtVersal, including emails and SMS (data rates may apply). *
                </label>
              </div>

              <div className="flex items-start">
                <input id="marketing" type="checkbox" checked={formData.marketing_opt_in}
                  onChange={(e) => setFormData({ ...formData, marketing_opt_in: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1" />
                <label htmlFor="marketing" className="ml-2 block text-sm text-dark">
                  I want to receive marketing emails about product updates, offers, and yacht marketplace insights. (Optional)
                </label>
              </div>
            </div>

            {!isBuyer && selectedTierInfo && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">Secure payment via Stripe</p>
                <p className="text-blue-600">
                  After creating your account you will be taken to Stripe checkout to complete your{' '}
                  <strong>{selectedTierInfo.name}</strong> subscription (${selectedTierInfo.price}/month).
                  Cancel anytime from your dashboard.
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

            {isBuyer ? (
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-1 text-sm text-dark/70 hover:text-dark transition-colors"
              >
                <ChevronLeft size={14} /> Back to sign in
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(''); }}
                className="w-full flex items-center justify-center gap-1 text-sm text-dark/70 hover:text-dark transition-colors"
              >
                <ChevronLeft size={14} /> Back to plan selection
              </button>
            )}
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-primary hover:text-primary/80">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

function RegisterLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-section-light to-soft flex items-center justify-center">
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
