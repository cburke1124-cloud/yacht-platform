import Link from 'next/link';
import { Search, Home, Ship } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-section-light to-soft flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <Ship size={120} className="mx-auto text-primary opacity-20" />
        </div>

        {/* 404 Number */}
        <h1 className="text-9xl font-bold text-primary mb-4">404</h1>

        {/* Message */}
        <h2 className="text-3xl font-bold text-secondary mb-4">
          Page Not Found
        </h2>
        <p className="text-xl text-dark/70 mb-8">
          Looks like this yacht has sailed away! The page you're looking for doesn't exist.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold text-lg"
          >
            <Home size={20} />
            Go Home
          </Link>

          <Link
            href="/listings"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary border-2 border-primary rounded-lg hover:bg-primary/5 transition-colors font-semibold text-lg"
          >
            <Search size={20} />
            Browse Yachts
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-dark/10">
          <p className="text-sm text-dark/70 mb-4">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/listings" className="text-primary hover:text-primary/80 font-medium">
              Browse Listings
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="/dealers" className="text-primary hover:text-primary/80 font-medium">
              Find Dealers
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="/search" className="text-primary hover:text-primary/80 font-medium">
              Advanced Search
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="/blog" className="text-primary hover:text-primary/80 font-medium">
              Blog
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="/about" className="text-primary hover:text-primary/80 font-medium">
              About Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
