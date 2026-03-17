'use client';

import { useState, useEffect } from 'react';
import { apiUrl, mediaUrl } from '@/app/lib/apiRoot';
import { Award, Building2, Mail, MapPin, MessageSquare, Phone, User } from 'lucide-react';

interface DealerSalesmanCardProps {
  listingId: number;
}

interface DealerInfo {
  id: number;
  company_name: string;
  logo_url?: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  slug?: string;
}

interface SalesmanInfo {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  photo_url?: string;
  title?: string;
  bio?: string;
}

export default function DealerSalesmanCard({ listingId }: DealerSalesmanCardProps) {
  const [dealer, setDealer] = useState<DealerInfo | null>(null);
  const [salesman, setSalesman] = useState<SalesmanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const response = await fetch(apiUrl(`/listings/${listingId}/contact-info`));
        if (response.ok) {
          const data = await response.json();
          setDealer(data.dealer);
          setSalesman(data.salesman);
        }
      } catch (error) {
        console.error('Failed to fetch contact info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContactInfo();
  }, [listingId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-20 bg-gray-200 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (!dealer) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-primary/20">
      <div className="bg-secondary p-6 text-light">
        <div className="flex items-center gap-4">
          {dealer.logo_url ? (
            <img
              src={mediaUrl(dealer.logo_url)}
              alt={dealer.company_name}
              className="w-16 h-16 rounded-lg object-cover bg-white p-2"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-light/20 flex items-center justify-center">
              <Building2 size={32} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold truncate">{dealer.company_name}</h3>
            {dealer.city && dealer.state && (
              <p className="text-light/80 text-sm flex items-center gap-1 mt-1">
                <MapPin size={14} />
                {dealer.city}, {dealer.state}
              </p>
            )}
          </div>
          <Award size={20} className="text-accent" />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {salesman && (
          <div className="pb-6 border-b border-primary/20">
            <div className="flex items-start gap-4">
              {salesman.photo_url ? (
                <img
                  src={mediaUrl(salesman.photo_url)}
                  alt={`${salesman.first_name} ${salesman.last_name}`}
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary/30"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br bg-primary/20 flex items-center justify-center border-2 border-primary/40">
                  <User size={28} className="text-primary" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Your Sales Representative
                </p>
                <h4 className="font-bold text-lg text-gray-900">
                  {salesman.first_name} {salesman.last_name}
                </h4>
                {salesman.title && <p className="text-sm text-gray-600">{salesman.title}</p>}
                {salesman.bio && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{salesman.bio}</p>}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <a
                href={`mailto:${salesman.email}`}
                className="flex items-center gap-3 text-dark hover:text-primary transition-colors group p-2 rounded-lg hover:bg-primary/5"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                  <Mail size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">Direct Email</p>
                  <p className="font-medium text-sm truncate">{salesman.email}</p>
                </div>
              </a>

              {salesman.phone && (
                <a
                  href={`tel:${salesman.phone}`}
                  className="flex items-center gap-3 text-gray-700 hover:text-green-600 transition-colors group p-2 rounded-lg hover:bg-green-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-50 group-hover:bg-green-100 flex items-center justify-center transition-colors">
                    <Phone size={16} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Direct Line</p>
                    <p className="font-medium text-sm">{salesman.phone}</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Dealership Contact
          </p>
          <div className="space-y-2">
            <a
              href={`mailto:${dealer.email}`}
              className="flex items-center gap-3 text-dark hover:text-primary transition-colors group p-2 rounded-lg hover:bg-primary/5"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                <Mail size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Main Email</p>
                <p className="font-medium text-sm truncate">{dealer.email}</p>
              </div>
            </a>

            <a
              href={`tel:${dealer.phone}`}
              className="flex items-center gap-3 text-dark hover:text-primary transition-colors group p-2 rounded-lg hover:bg-primary/5"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                <Phone size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Main Phone</p>
                <p className="font-medium text-sm">{dealer.phone}</p>
              </div>
            </a>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-primary/20">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-light rounded-lg hover-primary transition-colors font-semibold shadow-md hover:shadow-lg">
            <MessageSquare size={18} />
            Send Inquiry
          </button>

          {dealer.slug && (
            <a
              href={`/dealers/${dealer.slug}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-soft text-dark rounded-lg hover:bg-primary/10 transition-colors font-medium"
            >
              <Building2 size={18} />
              View Dealer Profile
            </a>
          )}
        </div>

        <div className="pt-4 border-t border-primary/20">
          <div className="flex items-center justify-center gap-2 text-sm text-primary bg-primary/10 px-4 py-2 rounded-lg">
            <Award size={16} />
            <span className="font-medium">Verified Dealer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
