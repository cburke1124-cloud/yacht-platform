'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/apiRoot';
import { Shield, FileText, ExternalLink } from 'lucide-react';

interface TermsAcceptanceModalProps {
  onAccepted: () => void;
  onDecline: () => void;
  userName?: string;
  userType?: string;
}

export default function TermsAcceptanceModal({
  onAccepted,
  onDecline,
  userName,
  userType,
}: TermsAcceptanceModalProps) {
  const isDealer = userType === 'dealer';
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedDealerTerms, setAgreedDealerTerms] = useState(false);
  const [agreedCommunications, setAgreedCommunications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    if (!agreedTerms || !agreedCommunications || (isDealer && !agreedDealerTerms)) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Session expired. Please log in again.');
        return;
      }

      const response = await fetch(apiUrl('/auth/accept-terms'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Failed to accept terms');
      }

      onAccepted();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-5 text-white"
          style={{ backgroundColor: '#10214F' }}
        >
          <div className="flex items-center gap-3">
            <Shield size={28} />
            <div>
              <h2 className="text-xl font-bold">
                {userName ? `Welcome, ${userName}!` : 'Welcome to YachtVersal'}
              </h2>
              <p className="text-sm text-white/80 mt-0.5">
                Please review and accept our terms before continuing
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <p className="text-sm text-gray-600 leading-relaxed">
            Before you can access your account, we need you to agree to our
            Terms of Service and Privacy Policy. This is a one-time step.
          </p>

          {/* Links to legal pages */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <Link
                href="/terms"
                target="_blank"
                className="flex-1 flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              >
                <FileText size={16} className="text-primary shrink-0" />
                Terms of Service
                <ExternalLink size={12} className="ml-auto text-gray-400" />
              </Link>
              <Link
                href="/privacy"
                target="_blank"
                className="flex-1 flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              >
                <Shield size={16} className="text-primary shrink-0" />
                Privacy Policy
                <ExternalLink size={12} className="ml-auto text-gray-400" />
              </Link>
            </div>
            {isDealer && (
              <Link
                href="/terms/dealer"
                target="_blank"
                className="flex items-center gap-2 px-4 py-3 border border-[#01BBDC]/40 bg-[#01BBDC]/5 rounded-xl hover:bg-[#01BBDC]/10 transition-colors text-sm font-medium text-[#10214F]"
              >
                <FileText size={16} className="text-[#01BBDC] shrink-0" />
                Dealer Services Agreement
                <ExternalLink size={12} className="ml-auto text-gray-400" />
              </Link>
            )}
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="text-primary underline hover:text-primary/80">Terms of Service</Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" className="text-primary underline hover:text-primary/80">Privacy Policy</Link>
              </span>
            </label>

            {isDealer && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedDealerTerms}
                  onChange={(e) => setAgreedDealerTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  I have read and agree to the{' '}
                  <Link href="/terms/dealer" target="_blank" className="text-primary underline hover:text-primary/80">Dealer Services Agreement</Link>,
                  including website data import authorization, API co-brokering rights, and media licensing terms
                </span>
              </label>
            )}

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedCommunications}
                onChange={(e) => setAgreedCommunications(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                I agree to receive account-related communications (e.g.,
                security alerts, billing updates, and service notifications)
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onDecline}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            Log Out
          </button>
          <button
            onClick={handleAccept}
            disabled={!agreedTerms || !agreedCommunications || (isDealer && !agreedDealerTerms) || loading}
            className="px-6 py-2.5 text-sm font-medium text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
          >
            {loading ? 'Accepting…' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
