'use client';

import { useState } from 'react';
import { Bell, X, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

interface PriceAlertButtonProps {
  listingId: number;
  currentPrice: number;
  currency?: string;
  listingTitle: string;
}

export default function PriceAlertButton({ 
  listingId, 
  currentPrice, 
  currency = 'USD',
  listingTitle 
}: PriceAlertButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetAlert = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push(`/login?redirect=/listings/${listingId}`);
      return;
    }

    if (!targetPrice || parseFloat(targetPrice) <= 0) {
      alert('Please enter a valid target price');
      return;
    }

    if (parseFloat(targetPrice) >= currentPrice) {
      alert('Target price must be lower than current price');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl('/price-alerts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_id: listingId,
          target_price: parseFloat(targetPrice),
          original_price: currentPrice
        })
      });

      if (response.ok) {
        alert('Price alert created! You\'ll be notified when the price drops.');
        setShowModal(false);
        setTargetPrice('');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create price alert');
      }
    } catch (error) {
      console.error('Failed to create alert:', error);
      alert('Failed to create price alert');
    } finally {
      setLoading(false);
    }
  };

  const suggestedPrices = [
    { label: '5% off', value: currentPrice * 0.95 },
    { label: '10% off', value: currentPrice * 0.90 },
    { label: '15% off', value: currentPrice * 0.85 },
    { label: '20% off', value: currentPrice * 0.80 }
  ];

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full px-4 py-3 bg-accent/20 text-accent border border-accent/40 rounded-lg font-medium hover:bg-accent/30 transition-colors flex items-center justify-center gap-2"
      >
        <Bell size={20} />
        Set Price Alert
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/20 rounded-lg">
                  <Bell className="text-accent" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Set Price Alert</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Listing Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">For listing:</p>
              <p className="font-medium text-gray-900 line-clamp-2 mb-2">{listingTitle}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-600">Current price:</span>
                <span className="text-xl font-bold text-gray-900">
                  ${currentPrice.toLocaleString()}
                </span>
                <span className="text-sm text-gray-600">{currency}</span>
              </div>
            </div>

            {/* Alert Explanation */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <TrendingDown className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-blue-800">
                  We'll notify you when the price drops to or below your target price
                </p>
              </div>
            </div>

            {/* Target Price Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Price ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                  $
                </span>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="Enter your target price"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                  min="0"
                  step="1000"
                />
              </div>
              {targetPrice && parseFloat(targetPrice) >= currentPrice && (
                <p className="mt-2 text-sm text-red-600">
                  Target price must be lower than current price
                </p>
              )}
            </div>

            {/* Quick Select Buttons */}
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">Or choose a discount:</p>
              <div className="grid grid-cols-2 gap-2">
                {suggestedPrices.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => setTargetPrice(Math.floor(suggestion.value).toString())}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    {suggestion.label}
                    <span className="block text-xs text-gray-500">
                      ${Math.floor(suggestion.value).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSetAlert}
                disabled={loading || !targetPrice || parseFloat(targetPrice) >= currentPrice}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Creating...' : 'Create Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}