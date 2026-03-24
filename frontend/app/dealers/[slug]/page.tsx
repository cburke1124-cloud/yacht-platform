'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Globe, Facebook, Instagram, Twitter, Linkedin, CheckCircle, Star, Building2, Users, ExternalLink, Calendar } from 'lucide-react';
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
        <div className="glass-card rounded-3xl p-12 max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Building2 size={40} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-secondary mb-2">Broker Not Found</h2>
          <p className="text-dark/70">This broker profile does not exist.</p>
        </div>
      </div>
    );
  }

  const memberSince = dealer.member_since
    ? new Date(dealer.member_since).getFullYear()
    : null;
  const location = [dealer.city, dealer.state].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen section-light">
      {/* Hero Cover */}
      <div className="relative h-80 overflow-hidden bg-secondary">
        {dealer.cover_image_url ? (
          <img
            src={mediaUrl(dealer.cover_image_url)}
            alt="Cover"
            className="w-full h-full object-cover"
            onError={onImgError}
          />
        ) : (
          <div className="w-full h-full ocean-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/30 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Broker Header Card */}
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl -mt-16 mb-8 p-8 relative z-10">
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

              {/* Location, Stats and Member Since */}
              <div className="flex flex-wrap items-center gap-4 text-dark/60 mb-4 text-sm">
                {location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={16} className="text-primary" />
                    <span>{location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Building2 size={16} />
                  <span>{dealer.active_listings} Active Listings</span>
                </div>
                {memberSince && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={16} className="text-primary" />
                    <span>Member since {memberSince}</span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {dealer.bio && (
                <p className="text-dark/70 mb-6 leading-relaxed max-w-2xl">{dealer.bio}</p>
              )}

              {/* Contact Buttons */}
              <div className="flex flex-wrap gap-3 mb-4">
                {dealer.phone && (
                  <a
                    href={`tel:${dealer.phone}`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-light rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-sm"
                  >
                    <Phone size={17} />
                    {dealer.phone}
                  </a>
                )}
                {dealer.email && (
                  <a
                    href={`mailto:${dealer.email}`}
                    className="flex items-center gap-2 px-5 py-2.5 border border-secondary/30 text-secondary rounded-xl hover:bg-secondary hover:text-white transition-all font-semibold"
                  >
                    <Mail size={17} />
                    Email Us
                  </a>
                )}
                {dealer.website?.trim() && (
                  <a
                    href={dealer.website.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 border border-secondary/30 text-secondary rounded-xl hover:bg-secondary hover:text-white transition-all font-semibold"
                  >
                    <Globe size={17} />
                    Website
                  </a>
                )}
              </div>

              {/* Social Media */}
              {(dealer.facebook_url || dealer.instagram_url || dealer.twitter_url || dealer.linkedin_url) && (
                <div className="flex gap-2">
                  {dealer.facebook_url && (
                    <a
                      href={dealer.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center hover:bg-primary hover:text-light transition-all"
                      aria-label="Facebook"
                    >
                      <Facebook size={18} />
                    </a>
                  )}
                  {dealer.instagram_url && (
                    <a
                      href={dealer.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center hover:bg-primary hover:text-light transition-all"
                      aria-label="Instagram"
                    >
                      <Instagram size={18} />
                    </a>
                  )}
                  {dealer.twitter_url && (
                    <a
                      href={dealer.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center hover:bg-primary hover:text-light transition-all"
                      aria-label="Twitter"
                    >
                      <Twitter size={18} />
                    </a>
                  )}
                  {dealer.linkedin_url && (
                    <a
                      href={dealer.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center hover:bg-primary hover:text-light transition-all"
                      aria-label="LinkedIn"
                    >
                      <Linkedin size={18} />
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
              <Users className="text-primary" size={26} />
              <h2 className="text-2xl font-bold text-secondary">Meet Our Team</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {team.map((member) => (
                <Link
                  key={member.id}
                  href={`/salesmen/${member.id}`}
                  className="group glass-card rounded-2xl hover-lift p-5 flex flex-col items-center text-center"
                >
                  {member.photo_url ? (
                    <img
                      src={mediaUrl(member.photo_url)}
                      alt={member.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 group-hover:border-primary/60 transition-colors mb-3"
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
                  {(member as any).is_owner && (
                    <span className="mt-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Owner</span>
                  )}
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
            <h2 className="text-2xl font-bold text-secondary">
              Available Yachts
              <span className="ml-2 text-lg font-normal text-dark/50">({listings.length})</span>
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
            <div className="glass-card rounded-2xl p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Building2 size={40} className="text-primary" />
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