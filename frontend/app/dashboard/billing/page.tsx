'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Check, CreditCard } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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
      
      // Create subscription
      const response = await fetch(apiUrl('/payments/create-subscription'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tier })
      });

      const { client_secret } = await response.json();

      // Confirm payment
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
        className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-all shadow-lg"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
  const [selectedTier, setSelectedTier] = useState<'basic' | 'premium'>('basic');

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 29,
      features: [
        '25 listings',
        'Featured listings',
        'Basic analytics',
        'Email support'
      ]
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 99,
      popular: true,
      features: [
        'Unlimited listings',
        'Priority featured',
        'Advanced analytics',
        'API access',
        'CRM integration',
        'Priority support'
      ]
    }
  ];

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-dark mb-3">Choose Your Plan</h1>
        <p className="text-lg text-dark/70">
          Select the perfect plan for your yacht dealership
        </p>
      </div>
      
      {/* Plan selection */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedTier(plan.id as 'basic' | 'premium')}
            className={`relative p-8 border-2 rounded-2xl cursor-pointer transition-all ${
              selectedTier === plan.id 
                ? 'border-primary bg-primary/5 shadow-xl scale-105' 
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                  Most Popular
                </span>
              </div>
            )}
            
            {selectedTier === plan.id && (
              <div className="absolute top-6 right-6">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-dark mb-2">{plan.name}</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-primary">${plan.price}</span>
                <span className="text-dark/60 text-lg">/month</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-dark/80">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                selectedTier === plan.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-dark/70 hover:bg-gray-200'
              }`}
            >
              {selectedTier === plan.id ? 'Selected' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>

      {/* Payment form */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-dark">Payment Details</h3>
            <p className="text-sm text-dark/60">
              Selected: <span className="font-semibold text-primary">
                {selectedTier === 'basic' ? 'Basic' : 'Premium'} - $
                {selectedTier === 'basic' ? '29' : '99'}/month
              </span>
            </p>
          </div>
        </div>

        <Elements stripe={stripePromise}>
          <CheckoutForm tier={selectedTier} />
        </Elements>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-dark/60 text-center">
            🔒 Secure payment powered by Stripe. Cancel anytime. No hidden fees.
          </p>
        </div>
      </div>

      {/* Features comparison */}
      <div className="mt-10 bg-soft border-2 border-gray-200 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-dark mb-4 text-center">
          All Plans Include
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl mb-2">📊</div>
            <h4 className="font-semibold text-dark mb-1">Analytics Dashboard</h4>
            <p className="text-sm text-dark/60">Track views and performance</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">📧</div>
            <h4 className="font-semibold text-dark mb-1">Lead Management</h4>
            <p className="text-sm text-dark/60">Manage inquiries easily</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">🔒</div>
            <h4 className="font-semibold text-dark mb-1">Secure Platform</h4>
            <p className="text-sm text-dark/60">Your data is protected</p>
          </div>
        </div>
      </div>
    </div>
  );
}