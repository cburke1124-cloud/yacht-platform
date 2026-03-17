'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface FeaturedListing {
  id: number;
  title: string;
  price: number;
  currency: string;
  city: string;
  state: string;
  images: Array<{ url: string }>;
  featured_until: string;
}

export default function FeaturedListingsCarousel() {
  const [featuredListings, setFeaturedListings] = useState<FeaturedListing[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedListings();
  }, []);

  useEffect(() => {
    // Auto-rotate every 5 seconds (only if we have listings)
    if (featuredListings.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => 
          prev === featuredListings.length - 1 ? 0 : prev + 1
        );
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [featuredListings.length]);

  const fetchFeaturedListings = async () => {
    try {
      const response = await fetch(apiUrl('/featured-listings'));
      if (!response.ok) {
        throw new Error('Failed to fetch featured listings');
      }
      const data = await response.json();
      setFeaturedListings(data || []);
    } catch (error) {
      console.error('Failed to fetch featured listings:', error);
      setFeaturedListings([]);
    } finally {
      setLoading(false);
    }
  };

  const trackImpression = async (listingId: number) => {
    try {
      await fetch(apiUrl('/featured-listings/track-impression'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId })
      });
    } catch (error) {
      console.error('Failed to track impression:', error);
    }
  };

  const trackClick = async (listingId: number) => {
    try {
      await fetch(apiUrl('/featured-listings/track-click'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId })
      });
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  };

  useEffect(() => {
    if (featuredListings.length > 0 && featuredListings[currentIndex]) {
      trackImpression(featuredListings[currentIndex].id);
    }
  }, [currentIndex, featuredListings]);

  const nextSlide = () => {
    setCurrentIndex((prev) => 
      prev === featuredListings.length - 1 ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? featuredListings.length - 1 : prev - 1
    );
  };

  if (loading) {
    return (
      <section className="py-12 bg-gradient-to-r bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-light">Loading featured yachts...</div>
        </div>
      </section>
    );
  }

  if (featuredListings.length === 0) {
    return null; // Don't show anything if no featured listings
  }

  const currentListing = featuredListings[currentIndex];

  // Safely get image URL with fallback
  const imageUrl = currentListing?.images?.[0]?.url || '/images/listing-fallback.png';

  return (
    <section className="py-12 bg-gradient-to-r bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <Star className="text-yellow-400 fill-yellow-400 mr-3" size={32} />
          <h2 className="text-3xl font-bold text-white">Featured Yachts</h2>
          <Star className="text-yellow-400 fill-yellow-400 ml-3" size={32} />
        </div>

        {/* Carousel */}
        <div className="relative">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-2">
              {/* Image */}
              <div className="relative h-96 md:h-auto">
                <img
                  src={imageUrl}
                  alt={currentListing?.title || 'Featured Yacht'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    e.currentTarget.src = '/images/listing-fallback.png';
                  }}
                />
                
                {/* SPONSORED Badge */}
                <div className="absolute top-4 right-4 bg-accent text-dark px-4 py-2 rounded-full font-bold text-sm shadow-lg flex items-center gap-2">
                  <Star size={16} className="fill-white" />
                  SPONSORED
                </div>

                {/* Navigation Arrows */}
                {featuredListings.length > 1 && (
                  <>
                    <button
                      onClick={prevSlide}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all"
                      aria-label="Previous"
                    >
                      <ChevronLeft size={24} className="text-gray-800" />
                    </button>
                    <button
                      onClick={nextSlide}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all"
                      aria-label="Next"
                    >
                      <ChevronRight size={24} className="text-gray-800" />
                    </button>
                  </>
                )}
              </div>

              {/* Content */}
              <div className="p-8 md:p-12 flex flex-col justify-center">
                <h3 className="text-3xl font-bold text-dark mb-4">
                  {currentListing?.title || 'Featured Yacht'}
                </h3>

                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-4xl font-bold text-primary">
                    ${(currentListing?.price || 0).toLocaleString()}
                  </span>
                  <span className="text-lg text-dark/60">
                    {currentListing?.currency || 'USD'}
                  </span>
                </div>

                {currentListing?.city && currentListing?.state && (
                  <div className="text-dark/60 mb-8">
                    📍 {currentListing.city}, {currentListing.state}
                  </div>
                )}

                <Link
                  href={`/listings/${currentListing?.id}`}
                  onClick={() => currentListing && trackClick(currentListing.id)}
                  className="inline-block px-8 py-4 bg-primary text-light text-lg font-semibold rounded-lg hover-primary transition-colors text-center shadow-lg hover:shadow-xl"
                >
                  View Details →
                </Link>

                {/* Dots Indicator */}
                {featuredListings.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    {featuredListings.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === currentIndex
                            ? 'w-8 bg-primary'
                            : 'w-2 bg-light/30 hover:bg-light/50'
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Text */}
        <p className="text-center text-light/70 text-sm mt-6">
          Want to feature your yacht? <Link href="/pricing" className="underline hover:text-light">Learn more</Link>
        </p>
      </div>
    </section>
  );
}