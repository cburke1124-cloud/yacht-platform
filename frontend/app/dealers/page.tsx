'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, MapPin, Phone, Mail, Globe, Ship, Building2, CheckCircle, Star, Filter } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface Dealer {
  id: number;
  name: string;
  company_name: string;
  slug: string;
  logo_url?: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
  total_listings: number;
  active_listings: number;
  subscription_tier: string;
}

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [states, setStates] = useState<string[]>([]);

  useEffect(() => {
    fetchDealers();
    fetchStates();
  }, [selectedState]);

  const fetchDealers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedState) params.append('state', selectedState);
      
      const response = await fetch(apiUrl(`/dealers?${params}`));
      const data = await response.json();
      setDealers(data.dealers || []);
    } catch (error) {
      console.error('Error fetching dealers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStates = async () => {
    try {
      const response = await fetch(apiUrl('/dealers/locations/states'));
      if (response.ok) {
        const data = await response.json();
        setStates(Array.isArray(data) ? data : []);
      } else {
        setStates([]);
      }
    } catch (error) {
      console.error('Error fetching states:', error);
      setStates([]);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDealers();
  };

  return (
    <div className="min-h-screen section-light">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-white to-primary/5 py-20 border-b border-primary/20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 mb-6">
              <Building2 className="w-10 h-10 text-primary" />
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-secondary mb-6">
              Find Yacht Brokers
            </h1>
            
            <p className="text-xl text-dark/70 mb-8 max-w-2xl mx-auto">
              Connect with trusted yacht brokers worldwide
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-primary/20 p-6 shadow-xl">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search brokers by name or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="relative">
                    <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="pl-12 pr-8 py-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all bg-white min-w-[150px]"
                    >
                      <option value="">All States</option>
                      {Array.isArray(states) && states.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSearch}
                    className="px-8 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:scale-105 whitespace-nowrap"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brokers Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <LoadingSpinner />
          ) : dealers.length > 0 ? (
            <>
              <div className="mb-8">
                <p className="text-dark text-lg">
                  <span className="font-semibold text-2xl text-secondary">{dealers.length}</span> 
                  <span className="text-dark/70 ml-2">verified brokers found</span>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {dealers.map((dealer) => (
                  <Link
                    key={dealer.id}
                    href={`/dealers/${dealer.slug}`}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:border-primary/30 transition-all overflow-hidden"
                  >
                    {/* Logo/Header */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 h-40 flex items-center justify-center relative p-6">
                      {dealer.logo_url ? (
                        <img
                          src={mediaUrl(dealer.logo_url)}
                          alt={dealer.company_name}
                          className="max-h-24 w-auto object-contain bg-white p-3 rounded-xl shadow-md"
                          onError={onImgError}
                        />
                      ) : (
                        <div className="bg-white rounded-2xl p-6 shadow-md">
                          <Building2 className="text-primary" size={48} />
                        </div>
                      )}
                      
                      {/* Premium Badge */}
                      {dealer.subscription_tier === 'premium' && (
                        <div className="absolute top-4 right-4">
                          <span className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-lg">
                            <Star size={14} fill="currentColor" />
                            PREMIUM
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-xl font-bold text-secondary line-clamp-1 flex-1 group-hover:text-primary transition-colors">
                          {dealer.company_name || dealer.name}
                        </h3>
                        <CheckCircle size={22} className="text-primary flex-shrink-0 ml-2" />
                      </div>

                      {dealer.description && (
                        <p className="text-dark/70 text-sm mb-4 line-clamp-2 leading-relaxed">
                          {dealer.description}
                        </p>
                      )}

                      {/* Location */}
                      {(dealer.city || dealer.state) && (
                        <div className="flex items-center gap-2 text-dark/70 text-sm mb-4 pb-4 border-b border-gray-100">
                          <MapPin size={16} className="flex-shrink-0 text-primary" />
                          <span className="truncate">
                            {dealer.city}{dealer.city && dealer.state && ', '}{dealer.state}
                          </span>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-2 text-sm mb-4 pb-4 border-b border-gray-100">
                        <Ship size={18} className="flex-shrink-0 text-primary" />
                        <span className="text-dark/70">
                          <span className="font-bold text-primary text-lg">{dealer.active_listings}</span>
                          <span className="ml-1">active listings</span>
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-2 mb-4">
                        {dealer.phone && (
                          <div className="flex items-center gap-2 text-sm text-dark/70">
                            <Phone size={14} className="flex-shrink-0 text-primary" />
                            <span className="truncate">{dealer.phone}</span>
                          </div>
                        )}
                        {dealer.website && (
                          <div className="flex items-center gap-2 text-sm text-primary">
                            <Globe size={14} className="flex-shrink-0" />
                            <span className="truncate hover:underline">
                              {dealer.website.replace(/^https?:\/\//, '')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* View Profile Button */}
                      <div className="pt-4 border-t border-gray-100">
                        <div className="w-full px-4 py-3 bg-primary text-white rounded-xl group-hover:bg-primary/90 transition-all text-center font-semibold shadow-sm group-hover:shadow-md flex items-center justify-center gap-2">
                          View Profile
                          <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-12 max-w-md mx-auto">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                  <Building2 size={40} className="text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-secondary mb-3">
                  No Brokers Found
                </h3>
                <p className="text-dark/70 mb-6">
                  {searchQuery || selectedState 
                    ? 'Try adjusting your search criteria' 
                    : 'No brokers are currently listed'}
                </p>
                {(searchQuery || selectedState) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedState('');
                    }}
                    className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-lg hover:shadow-xl"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-3xl shadow-2xl border border-primary/20 p-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-4">
              Are You a Yacht Broker?
            </h2>
            
            <p className="text-xl text-dark/70 mb-8">
              Join YachtVersal and reach thousands of qualified buyers worldwide
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/sell"
                className="px-8 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105"
              >
                Join as a Broker
              </Link>
              <Link
                href="/pricing"
                className="px-8 py-4 bg-white text-primary border-2 border-primary rounded-xl hover:bg-primary/5 transition-all font-semibold"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}