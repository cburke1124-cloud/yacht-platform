"use client"

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-section-light to-soft flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8">
          <AlertTriangle size={100} className="mx-auto text-primary opacity-30" />
        </div>

        <h1 className="text-7xl font-bold text-primary mb-4">500</h1>

        <h2 className="text-3xl font-bold text-secondary mb-4">
          Something Went Wrong
        </h2>
        <p className="text-xl text-dark/70 mb-8">
          We hit an unexpected error. Our team has been notified. Please try again or return home.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold text-lg"
          >
            <RefreshCw size={20} />
            Try Again
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary border-2 border-primary rounded-lg hover:bg-primary/5 transition-colors font-semibold text-lg"
          >
            <Home size={20} />
            Go Home
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-dark/10">
          <p className="text-sm text-dark/70 mb-4">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/listings" className="text-primary hover:text-primary/80 font-medium">
              Browse Listings
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="/contact" className="text-primary hover:text-primary/80 font-medium">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
