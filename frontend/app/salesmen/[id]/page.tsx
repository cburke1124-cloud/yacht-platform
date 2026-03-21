'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Mail, Phone, User, Building2, MessageSquare,
  Globe, Instagram, Linkedin, Facebook, ArrowLeft
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (notFound || !salesman) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-xl text-gray-600">Salesman profile not found.</p>
        <button onClick={() => router.back()} className="text-blue-600 hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Go back
        </button>
      </div>
    );
  }

  const fullName = salesman.name;
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-800" />
          <div className="px-8 pb-8">
            {/* Avatar */}
            <div className="-mt-14 mb-4">
              {salesman.photo_url ? (
                <img
                  src={mediaUrl(salesman.photo_url)}
                  alt={fullName}
                  onError={onImgError}
                  className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-blue-600 border-4 border-white shadow-md flex items-center justify-center text-white text-3xl font-bold">
                  {initials}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>
                {salesman.title && (
                  <p className="text-lg text-blue-600 font-medium mt-1">{salesman.title}</p>
                )}

                {/* Brokerage link */}
                {salesman.dealer && (
                  <Link
                    href={salesman.dealer.slug ? `/dealers/${salesman.dealer.slug}` : '#'}
                    className="mt-2 inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <Building2 size={16} />
                    <span className="text-sm font-medium">{salesman.dealer.name}</span>
                  </Link>
                )}
              </div>

              <button
                onClick={handleMessage}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap"
              >
                <MessageSquare size={18} />
                Message Salesman
              </button>
            </div>

            {/* Bio */}
            {salesman.bio && (
              <p className="mt-6 text-gray-700 leading-relaxed">{salesman.bio}</p>
            )}

            {/* Contact + Social */}
            <div className="mt-6 flex flex-wrap gap-4">
              {salesman.email && (
                <a
                  href={`mailto:${salesman.email}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Mail size={16} />
                  {salesman.email}
                </a>
              )}
              {salesman.phone && (
                <a
                  href={`tel:${salesman.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Phone size={16} />
                  {salesman.phone}
                </a>
              )}
              {salesman.instagram_url && (
                <a
                  href={salesman.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-pink-600 transition-colors"
                >
                  <Instagram size={16} />
                  Instagram
                </a>
              )}
              {salesman.linkedin_url && (
                <a
                  href={salesman.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-700 transition-colors"
                >
                  <Linkedin size={16} />
                  LinkedIn
                </a>
              )}
              {salesman.facebook_url && (
                <a
                  href={salesman.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Facebook size={16} />
                  Facebook
                </a>
              )}
              {salesman.website && (
                <a
                  href={salesman.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Globe size={16} />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Listings */}
        {listings.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Listings by {fullName}
            </h2>
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
                  images={listing.images?.map(img => img.url) || []}
                />
              ))}
            </div>
          </div>
        )}

        {listings.length === 0 && (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center text-gray-500">
            No active listings at this time.
          </div>
        )}
      </div>
    </div>
  );
}
