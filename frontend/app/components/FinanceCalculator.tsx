'use client';

import { useState } from 'react';
import { Calculator, DollarSign, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function FinanceCalculator({ listingId, price }: { listingId: number; price: number }) {
  const [showCalculator, setShowCalculator] = useState(false);
  const [downPayment, setDownPayment] = useState(20);
  const [interestRate, setInterestRate] = useState(5.5);
  const [termYears, setTermYears] = useState(20);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/listings/${listingId}/calculate-financing`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          down_payment_percent: downPayment,
          interest_rate: interestRate,
          term_years: termYears
        })
      });
      
      if (!response.ok) {
        throw new Error('Calculation failed');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Calculation failed:', error);
      alert('Failed to calculate financing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <button
        onClick={() => setShowCalculator(!showCalculator)}
        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Calculator size={24} className="text-primary" />
          <div className="text-left">
            <h3 className="font-bold text-dark">Financing Calculator</h3>
            <p className="text-sm text-dark/60">Estimate your monthly payments</p>
          </div>
        </div>
        {showCalculator ? (
          <ChevronUp size={20} className="text-secondary/40" />
        ) : (
          <ChevronDown size={20} className="text-secondary/40" />
        )}
      </button>

      {showCalculator && (
        <div className="p-6 border-t border-primary/20 bg-soft space-y-4">
          {/* Down Payment */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-dark">
                Down Payment
              </label>
              <span className="text-sm font-semibold text-primary">
                {downPayment}% (${((price * downPayment) / 100).toLocaleString()})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={downPayment}
              onChange={(e) => setDownPayment(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Interest Rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Interest Rate
              </label>
              <span className="text-sm font-semibold text-blue-600">
                {interestRate}%
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="12"
              step="0.5"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>2%</span>
              <span>12%</span>
            </div>
          </div>

          {/* Loan Term */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Loan Term
              </label>
              <span className="text-sm font-semibold text-blue-600">
                {termYears} years
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={termYears}
              onChange={(e) => setTermYears(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5 yrs</span>
              <span>30 yrs</span>
            </div>
          </div>

          <button
            onClick={calculate}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors shadow-md"
          >
            {loading ? 'Calculating...' : 'Calculate Payment'}
          </button>

          {result && (
            <div className="mt-6 space-y-4 animate-fadeIn">
              {/* Main Payment Display */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-lg">
                <p className="text-sm opacity-90 mb-1">Estimated Monthly Payment</p>
                <p className="text-4xl font-bold">
                  ${result.monthly_payment?.toLocaleString() || '0'}
                </p>
                <p className="text-xs opacity-75 mt-2">Principal + Interest</p>
              </div>

              {/* Breakdown */}
              <div className="bg-white rounded-lg p-4 space-y-3 border border-gray-200">
                <h4 className="font-semibold text-gray-900 text-sm mb-3">Payment Breakdown</h4>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monthly Payment (P&I):</span>
                  <span className="font-semibold">${result.monthly_payment?.toLocaleString() || '0'}</span>
                </div>
                
                {result.insurance_monthly && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Insurance (est.):</span>
                    <span className="font-semibold">${result.insurance_monthly?.toLocaleString() || '0'}</span>
                  </div>
                )}
                
                {result.maintenance_monthly && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Maintenance (est.):</span>
                    <span className="font-semibold">${result.maintenance_monthly?.toLocaleString() || '0'}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm pt-3 border-t border-gray-200 font-bold">
                  <span className="text-gray-900">Total Monthly Cost:</span>
                  <span className="text-blue-600">${result.total_monthly_cost?.toLocaleString() || '0'}</span>
                </div>
              </div>

              {/* Loan Summary */}
              <div className="bg-white rounded-lg p-4 space-y-2 border border-gray-200">
                <h4 className="font-semibold text-gray-900 text-sm mb-3">Loan Summary</h4>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Purchase Price:</span>
                  <span className="font-semibold">${result.purchase_price?.toLocaleString() || '0'}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Down Payment:</span>
                  <span className="font-semibold">${result.down_payment?.toLocaleString() || '0'}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Loan Amount:</span>
                  <span className="font-semibold">${result.loan_amount?.toLocaleString() || '0'}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Interest:</span>
                  <span className="font-semibold text-orange-600">${result.total_interest?.toLocaleString() || '0'}</span>
                </div>
                
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="font-bold text-gray-900">${result.total_cost?.toLocaleString() || '0'}</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Disclaimer:</strong> These are estimates only. Actual rates, terms, and monthly payments may vary based on your credit score, lender requirements, and market conditions. Insurance and maintenance costs are approximations.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}