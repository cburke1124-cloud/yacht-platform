'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Globe, Facebook, Instagram, Twitter, Linkedin, CheckCircle, Star, Building2, Users, ExternalLink } from 'lucide-react';
import ListingCard from '@/app/components/ListingCard';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface TeamMember {
  id: number;
  name: string;
  title: string;
  photo_url?: string;
}

export default function DealerProfilePage() {
  const params = useParams();
  const [dealer, setDealer] = useState<any>(null);
  const [listings, setListings] = useState([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDealerProfile();
  }, [params.slug]);

  const fetchDealerProfile = async () => {
    try {
      const response = await fetch(apiUrl(`/dealers/${params.slug}`));
      const data = await response.json();
      setDealer(data.dealer);
      setListings(data.listings);

      if (data.dealer?.show_team_on_profile) {
        try {
          const teamRes = await fetch(apiUrl(`/dealers/${params.slug}/team`));
          if (teamRes.ok) setTeam(await teamRes.json());
        } catch {
          // team is non-critical
        }
      }
    } catch (error) {
      console.error('Error fetching dealer:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center section-light">
        <LoadingSpinner />
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="min-h-screen flex items-center justify-center section-light">
        <div className="text-center bg-white rounded-3xl shadow-lg border border-gray-200 p-12 max-w-md">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <Building2 size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-secondary mb-2">Broker Not Found</h2>
          <p className="text-dark/70">This broker profile does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-light">
      {/* Cover Image with Gradient Overlay */}
      <div className="relative h-64 bg-gradient-to-br from-primary/20 to-primary/10 overflow-hidden">
        {dealer.cover_image_url && (
          <img 
            src={mediaUrl(dealer.cover_image_url)}
            alt="Cover"
            className="w-full h-full object-cover opacity-50"
            onError={onImgError}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-50 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Broker Header Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 -mt-20 mb-8 p-8 relative z-10">
          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Logo */}
            <div className="flex-shrink-0">
              {dealer.logo_url ? (
                <img 
                  src={mediaUrl(dealer.logo_url)} 
                  alt={dealer.business_name}
                  className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-lg"
                  onError={onImgError}
                />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-primary/10 border-4 border-white shadow-lg flex items-center justify-center">
                  <Building2 className="text-primary" size={48} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Title and Badges */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1 className="text-3xl md:text-4xl font-bold text-secondary">
                  {dealer.business_name}
                </h1>
                {dealer.is_verified && (
                  <span className="flex items-center gap-1.5 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold border border-primary/30">
                    <CheckCircle size={16} />
                    Verified
                  </span>
                )}
                {dealer.is_featured && (
                  <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5">
                    <Star size={16} fill="currentColor" />
                    Featured
                  </span>
                )}
              </div>

              {/* Location and Stats */}
              <div className="flex flex-wrap items-center gap-4 text-dark/70 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-primary" />
                  <span>{dealer.city}, {dealer.state}</span>
                </div>
                <span className="text-gray-300">•</span>
                <span className="font-semibold text-primary">{dealer.active_listings} Active Listings</span>
              </div>

              {/* Bio */}
              {dealer.bio && (
                <p className="text-dark/70 mb-6 leading-relaxed">{dealer.bio}</p>
              )}

              {/* Contact Buttons */}
              <div className="flex flex-wrap gap-3 mb-4">
                {dealer.phone && (
                  <a 
                    href={`tel:${dealer.phone}`}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-md hover:shadow-lg"
                  >
                    <Phone size={18} />
                    {dealer.phone}
                  </a>
                )}
                {dealer.email && (
                  <a 
                    href={`mailto:${dealer.email}`}
                    className="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-xl hover:bg-secondary/90 transition-all font-semibold"
                  >
                    <Mail size={18} />
                    Email
                  </a>
                )}
                {dealer.website && (
                  <a 
                    href={dealer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-xl hover:bg-secondary/90 transition-all font-semibold"
                  >
                    <Globe size={18} />
                    Website
                  </a>
                )}
              </div>

              {/* Social Media */}
              {(dealer.facebook_url || dealer.instagram_url || dealer.twitter_url || dealer.linkedin_url) && (
                <div className="flex gap-4">
                  {dealer.facebook_url && (
                    <a 
                      href={dealer.facebook_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors"
                    >
                      <Facebook size={20} />
                    </a>
                  )}
                  {dealer.instagram_url && (
                    <a 
                      href={dealer.instagram_url} 
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center hover:from-purple-600 hover:to-pink-600 transition-colors"
                    >
                      <Instagram size={20} />
                    </a>
                  )}
                  {dealer.twitter_url && (
                    <a
                      href={dealer.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600 transition-colors"
                    >
                      <Twitter size={20} />
                    </a>
                  )}
                  {dealer.linkedin_url && (
                    <a
                      href={dealer.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center hover:bg-blue-800 transition-colors"
                    >
                      <Linkedin size={20} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Team Section */}
        {dealer.show_team_on_profile && team.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <Users className="text-primary" size={28} />
              <h2 className="text-3xl font-bold text-secondary">Meet Our Team</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {team.map((member) => (
                <Link
                  key={member.id}
                  href={`/salesmen/${member.id}`}
                  className="group bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-primary/30 transition-all p-5 flex flex-col items-center text-center"
                >
                  {member.photo_url ? (
                    <img
                      src={mediaUrl(member.photo_url)}
                      alt={member.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 group-hover:border-primary/50 transition-colors mb-3"
                      onError={onImgError}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold text-primary">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <p className="font-semibold text-secondary text-sm group-hover:text-primary transition-colors line-clamp-2 leading-tight mb-1">
                    {member.name}
                  </p>
                  <p className="text-xs text-dark/60 line-clamp-1">{member.title}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    View Profile <ExternalLink size={11} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Listings Section */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-secondary">
              Available Yachts ({listings.length})
            </h2>
          </div>
          
          {listings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {listings.map((listing: any) => (
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
                  images={listing.images?.map((img: any) => img.url) || []}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                <Building2 size={40} className="text-gray-400" />
              </div>
              <p className="text-dark/70 text-lg">
                This broker currently has no active listings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}