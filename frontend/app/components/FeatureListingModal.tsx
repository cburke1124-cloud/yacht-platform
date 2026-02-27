'use client';

import { useState } from 'react';
import { X, Star, TrendingUp, Zap } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiUrl } from '@/app/lib/apiRoot';

// Initialize Stripe (replace with your publishable key from .env)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...');

interface FeatureListingModalProps {
  listingId: number;
  listingTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

type FeaturePlan = {
  name: string;
  price: number;
  days: number;
  description: string;
  color: string;
  popular?: boolean;
};

const PLANS: Record<'7day' | '30day' | '90day', FeaturePlan> = {
  '7day': { 
    name: '7 Days', 
    price: 49, 
    days: 7,
    description: 'Perfect for quick sales',
    color: 'from-primary to-primary'
  },
  '30day': { 
    name: '30 Days', 
    price: 149, 
    days: 30,
    description: 'Most popular choice',
    popular: true,
    color: 'from-secondary to-secondary'
  },
  '90day': { 
    name: '90 Days', 
    price: 399, 
    days: 90,
    description: 'Maximum exposure',
    color: 'from-accent/70 to-accent'
  }
};

function CheckoutForm({ listingId, listingTitle, selectedPlan, onSuccess, onClose }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Send to backend
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/featured-listings/purchase'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_id: listingId,
          plan: selectedPlan,
          payment_method_id: paymentMethod.id
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Success! Your listing is now featured!');
        onSuccess();
        onClose();
      } else {
        throw new Error(data.detail || 'Payment failed');
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const plan = PLANS[selectedPlan as keyof typeof PLANS];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Listing:</span>
          <span className="font-semibold text-gray-900">{listingTitle}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Plan:</span>
          <span className="font-semibold text-gray-900">{plan.name}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t">
          <span>Total:</span>
          <span className="text-blue-600">${plan.price}</span>
        </div>
      </div>

      {/* Card Element */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information
        </label>
        <div className="border border-gray-300 rounded-lg p-4">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !stripe}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
        >
          {loading ? 'Processing...' : `Pay $${plan.price}`}
        </button>
      </div>

      {/* Test Mode Notice */}
      <p className="text-xs text-gray-500 text-center">
        🧪 Test mode: Use card 4242 4242 4242 4242
      </p>
    </form>
  );
}

export default function FeatureListingModal({ listingId, listingTitle, onClose, onSuccess }: FeatureListingModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS>('30day');
  const [showCheckout, setShowCheckout] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Star className="fill-yellow-400 text-yellow-400" size={32} />
            <div>
              <h2 className="text-2xl font-bold">Feature Your Listing</h2>
              <p className="text-blue-100 text-sm">Get maximum exposure and more inquiries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {!showCheckout ? (
            <>
              {/* Benefits */}
              <div className="mb-8 grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Zap className="text-blue-600 mx-auto mb-2" size={32} />
                  <h3 className="font-semibold text-gray-900 mb-1">Priority Placement</h3>
                  <p className="text-sm text-gray-600">Appears at the top of search results</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <TrendingUp className="text-purple-600 mx-auto mb-2" size={32} />
                  <h3 className="font-semibold text-gray-900 mb-1">10x More Views</h3>
                  <p className="text-sm text-gray-600">Featured listings get seen by everyone</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Star className="text-yellow-600 mx-auto mb-2 fill-yellow-600" size={32} />
                  <h3 className="font-semibold text-gray-900 mb-1">Homepage Featured</h3>
                  <p className="text-sm text-gray-600">Shown in premium carousel spot</p>
                </div>
              </div>

              {/* Plans */}
              <h3 className="text-xl font-bold mb-4 text-center">Choose Your Plan</h3>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {Object.entries(PLANS).map(([key, plan]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlan(key as keyof typeof PLANS)}
                    className={`relative p-6 rounded-xl border-2 transition-all ${
                      selectedPlan === key
                        ? 'border-blue-600 bg-blue-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-xs font-bold">
                        MOST POPULAR
                      </div>
                    )}
                    
                    <div className={`text-3xl font-bold bg-gradient-to-r ${plan.color} bg-clip-text text-transparent mb-2`}>
                      ${plan.price}
                    </div>
                    
                    <div className="font-bold text-lg mb-1">{plan.name}</div>
                    <div className="text-sm text-gray-600 mb-3">{plan.description}</div>
                    
                    <div className="text-xs text-gray-500">
                      ${(plan.price / plan.days).toFixed(2)}/day
                    </div>
                    
                    {selectedPlan === key && (
                      <div className="absolute top-3 right-3">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowCheckout(true)}
                className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 shadow-lg"
              >
                Continue to Payment →
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Cancel anytime. Money-back guarantee if not satisfied.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-blue-600 hover:text-blue-700 mb-4 text-sm font-medium"
              >
                ← Back to Plans
              </button>
              
              <Elements stripe={stripePromise}>
                <CheckoutForm
                  listingId={listingId}
                  listingTitle={listingTitle}
                  selectedPlan={selectedPlan}
                  onSuccess={onSuccess}
                  onClose={onClose}
                />
              </Elements>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


