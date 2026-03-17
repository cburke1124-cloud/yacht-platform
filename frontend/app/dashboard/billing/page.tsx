'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Check, CreditCard, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  popular?: boolean;
  custom_price?: boolean;
}

interface SubscriptionInfo {
  active: boolean;
  tier: string;
  status?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  trial_active?: boolean;
  trial_end?: string;
}

function CheckoutForm({ tier }: { tier: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(apiUrl('/payments/create-subscription'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tier })
      });

      const { client_secret } = await response.json();

      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        }
      });

      if (result.error) {
        alert(result.error.message);
      } else {
        alert('Subscription activated!');
        window.location.href = '/dashboard';
      }
    } catch (error) {
      alert('Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border-2 border-gray-200 rounded-xl bg-white">
        <CardElement options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#2E2E2E',
              '::placeholder': { color: '#9CA3AF' },
            },
          },
        }} />
      </div>
      
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full px-6 py-4 bg-[#01BBDC] text-white rounded-xl hover:bg-[#00a5c4] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-all shadow-lg"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="animate-spin h-5 w-5" />
            Processing...
          </span>
        ) : (
          'Subscribe Now'
        )}
      </button>
    </form>
  );
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentTier, setCurrentTier] = useState('free');
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [managingBilling, setManagingBilling] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };

      const [plansRes, subRes] = await Promise.all([
        fetch(apiUrl('/payments/plans'), { headers }),
        fetch(apiUrl('/payments/subscription'), { headers }),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans || []);
        setCurrentTier(plansData.current_tier || 'free');
        // Default selection: current tier or the first plan
        setSelectedTier(plansData.current_tier !== 'free' ? plansData.current_tier : (plansData.plans?.[0]?.id || ''));
      }

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }
    } catch (err) {
      console.error('Failed to load billing data:', err);
      setError('Failed to load billing information.');
    } finally {
      setLoading(false);
    }
  };

  const openStripePortal = async () => {
    setManagingBilling(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/payments/billing-portal'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        alert('Unable to open billing portal.');
      }
    } catch {
      alert('Unable to open billing portal.');
    } finally {
      setManagingBilling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-10 w-10 text-[#01BBDC]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          {error}
        </div>
      </div>
    );
  }

  const selectedPlan = plans.find(p => p.id === selectedTier);
  const isCurrentPlan = selectedTier === currentTier;
  const hasActiveSubscription = subscription?.active && subscription?.status === 'active';

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-[#10214F] mb-3">Choose Your Plan</h1>
        <p className="text-lg text-gray-600">
          Select the perfect plan for your yacht dealership
        </p>
      </div>

      {/* Current subscription banner */}
      {hasActiveSubscription && (
        <div className="mb-8 bg-[#01BBDC]/10 border border-[#01BBDC]/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[#10214F]">
              Current Plan: <span className="text-[#01BBDC] capitalize">{currentTier}</span>
              {subscription.cancel_at_period_end && (
                <span className="ml-2 text-sm text-orange-600 font-medium">
                  (cancels at period end)
                </span>
              )}
            </p>
            {subscription.current_period_end && (
              <p className="text-sm text-gray-600 mt-1">
                Next billing date: {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={openStripePortal}
            disabled={managingBilling}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#01BBDC] text-[#01BBDC] rounded-xl font-semibold hover:bg-[#01BBDC] hover:text-white transition-all"
          >
            {managingBilling ? <Loader2 className="animate-spin h-4 w-4" /> : <ExternalLink size={16} />}
            Manage Billing
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div className={`grid gap-6 mb-10 ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentTier;
          const isSelected = plan.id === selectedTier;

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedTier(plan.id)}
              className={`relative p-8 border-2 rounded-2xl cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#01BBDC] bg-[#01BBDC]/5 shadow-xl scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-[#01BBDC] text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute top-4 right-4">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                    Current Plan
                  </span>
                </div>
              )}

              {isSelected && !isCurrent && (
                <div className="absolute top-6 right-6">
                  <div className="w-8 h-8 rounded-full bg-[#01BBDC] flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#10214F] mb-2">{plan.name}</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-[#01BBDC]">${plan.price}</span>
                  <span className="text-gray-500 text-lg">/{plan.interval}</span>
                </div>
                {plan.custom_price && (
                  <p className="text-xs text-[#01BBDC] font-medium mt-1">Custom pricing applied</p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#01BBDC] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  isCurrent
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : isSelected
                    ? 'bg-[#01BBDC] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {isCurrent ? 'Current Plan' : isSelected ? 'Selected' : 'Select Plan'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Payment form — show only if not on the selected plan already */}
      {!isCurrentPlan && selectedPlan && (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-[#01BBDC]/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#01BBDC]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#10214F]">Payment Details</h3>
              <p className="text-sm text-gray-500">
                {hasActiveSubscription ? 'Upgrade' : 'Subscribe'} to:{' '}
                <span className="font-semibold text-[#01BBDC]">
                  {selectedPlan.name} — ${selectedPlan.price}/{selectedPlan.interval}
                </span>
              </p>
            </div>
          </div>

          <Elements stripe={stripePromise}>
            <CheckoutForm tier={selectedTier} />
          </Elements>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              🔒 Secure payment powered by Stripe. Cancel anytime. No hidden fees.
            </p>
          </div>
        </div>
      )}

      {/* All plans include */}
      <div className="mt-10 bg-[#F5F7FA] border-2 border-gray-200 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-[#10214F] mb-4 text-center">
          All Plans Include
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl mb-2">📊</div>
            <h4 className="font-semibold text-[#10214F] mb-1">Analytics Dashboard</h4>
            <p className="text-sm text-gray-500">Track views and performance</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">📧</div>
            <h4 className="font-semibold text-[#10214F] mb-1">Lead Management</h4>
            <p className="text-sm text-gray-500">Manage inquiries easily</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">🔒</div>
            <h4 className="font-semibold text-[#10214F] mb-1">Secure Platform</h4>
            <p className="text-sm text-gray-500">Your data is protected</p>
          </div>
        </div>
      </div>
    </div>
  );
}