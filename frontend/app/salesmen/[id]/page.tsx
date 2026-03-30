'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Mail, Phone, Building2, MessageSquare,
  Globe, Instagram, Linkedin, Facebook, ArrowLeft, Anchor
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import ListingCard from '@/app/components/ListingCard';

interface SalesmanProfile {
  id: number;
  name: string;
  title: string;
  bio?: string;
  email: string;
  phone?: string;
  photo_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  facebook_url?: string;
  website?: string;
  dealer?: {
    id: number;
    name: string;
    slug?: string;
    logo_url?: string;
  };
}

interface ListingData {
  id: number;
  title: string;
  price?: number;
  year?: number;
  make?: string;
  model?: string;
  length_feet?: number;
  city?: string;
  state?: string;
  images?: { url: string }[];
  condition?: string;
  featured?: boolean;
}

export default function SalesmanProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [salesman, setSalesman] = useState<SalesmanProfile | null>(null);
  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (id) fetchSalesman();
  }, [id]);

  const fetchSalesman = async () => {
    try {
      const response = await fetch(apiUrl(`/salesmen/${id}`));
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSalesman(data.salesman);
      setListings(data.listings || []);
    } catch (error) {
      console.error('Failed to fetch salesman:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push(`/login?redirect=/salesmen/${id}`);
      return;
    }
    router.push(`/messages?new=true&recipient_id=${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || !salesman) {
    return (
      <div className="min-h-screen bg-soft flex flex-col items-center justify-center gap-4">
        <Anchor size={48} className="text-secondary/30" />
        <p className="text-xl text-secondary/60 font-medium">Profile not found.</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-primary hover:underline font-medium"
        >
          <ArrowLeft size={16} /> Go back
        </button>
      </div>
    );
  }

  const fullName = salesman.name;
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hasSocial = salesman.instagram_url || salesman.linkedin_url || salesman.facebook_url || salesman.website;

  return (
    <div className="min-h-screen bg-soft">
      {/* Sticky nav */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-secondary/60 hover:text-secondary transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </div>

      {/* Hero banner */}
      <div className="relative h-48 md:h-64 ocean-bg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 via-secondary/20 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Profile card — overlaps hero */}
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl -mt-16 mb-8 p-6 md:p-8 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {salesman.photo_url ? (
                <img
                  src={mediaUrl(salesman.photo_url)}
                  alt={fullName}
                  onError={onImgError}
                  className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-secondary/10 border-4 border-white shadow-lg flex items-center justify-center text-secondary text-3xl font-bold">
                  {initials}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-secondary">{fullName}</h1>
                  {salesman.title && (
                    <p className="text-primary font-semibold mt-0.5">{salesman.title}</p>
                  )}
                  {salesman.dealer && (
                    <Link
                      href={salesman.dealer.slug ? `/dealers/${salesman.dealer.slug}` : '#'}
                      className="mt-2 inline-flex items-center gap-2 text-secondary/60 hover:text-primary transition-colors text-sm font-medium"
                    >
                      <Building2 size={15} />
                      {salesman.dealer.name}
                    </Link>
                  )}
                </div>

                <button
                  onClick={handleMessage}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-sm whitespace-nowrap"
                >
                  <MessageSquare size={17} />
                  Send Message
                </button>
              </div>

              {salesman.bio && (
                <p className="mt-4 text-dark/70 leading-relaxed max-w-2xl">{salesman.bio}</p>
              )}

              {/* Contact */}
              <div className="mt-5 flex flex-wrap gap-3">
                {salesman.email && (
                  <a
                    href={`mailto:${salesman.email}`}
                    className="flex items-center gap-2 px-4 py-2 border border-secondary/20 text-secondary rounded-xl hover:bg-secondary hover:text-white transition-all text-sm font-medium"
                  >
                    <Mail size={15} />
                    {salesman.email}
                  </a>
                )}
                {salesman.phone && (
                  <a
                    href={`tel:${salesman.phone}`}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all text-sm font-semibold shadow-sm"
                  >
                    <Phone size={15} />
                    {salesman.phone}
                  </a>
                )}
              </div>

              {/* Social */}
              {hasSocial && (
                <div className="mt-4 flex gap-2">
                  {salesman.instagram_url && (
                    <a href={salesman.instagram_url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-xl border border-secondary/20 text-secondary/60 hover:text-pink-500 hover:border-pink-300 transition-all" title="Instagram">
                      <Instagram size={18} />
                    </a>
                  )}
                  {salesman.linkedin_url && (
                    <a href={salesman.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-xl border border-secondary/20 text-secondary/60 hover:text-blue-700 hover:border-blue-300 transition-all" title="LinkedIn">
                      <Linkedin size={18} />
                    </a>
                  )}
                  {salesman.facebook_url && (
                    <a href={salesman.facebook_url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-xl border border-secondary/20 text-secondary/60 hover:text-blue-600 hover:border-blue-300 transition-all" title="Facebook">
                      <Facebook size={18} />
                    </a>
                  )}
                  {salesman.website && (
                    <a href={salesman.website} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-xl border border-secondary/20 text-secondary/60 hover:text-primary hover:border-primary/40 transition-all" title="Website">
                      <Globe size={18} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Listings */}
        {listings.length > 0 ? (
          <div>
            <h2 className="text-2xl font-bold text-secondary mb-1">
              Listings by {fullName.split(' ')[0]}
            </h2>
            <p className="text-dark/50 text-sm mb-6">
              {listings.length} active listing{listings.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  title={listing.title}
                  price={listing.price}
                  year={listing.year}
                  make={listing.make}
                  model={listing.model}
                  length={listing.length_feet}
                  city={listing.city}
                  state={listing.state}
                  condition={listing.condition}
                  featured={listing.featured}
                  images={listing.images?.map(img => img.url) || []}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-10 text-center">
            <Anchor size={36} className="mx-auto text-secondary/20 mb-3" />
            <p className="text-secondary/60 font-medium">No active listings at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
