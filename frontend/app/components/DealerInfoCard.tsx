import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, ExternalLink, User, Building2, Award } from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface DealerInfo {
  id: number;
  name: string;
  company_name?: string;
  email: string;
  phone: string;
  slug?: string;
  logo_url?: string;
  photo_url?: string;
}

interface SalesmanInfo {
  id: number;
  first_name: string;
  last_name: string;
  photo_url?: string;
  title?: string;
}

interface DealerInfoCardProps {
  dealerId: number;
  salesmanId?: number;
}

export default function DealerInfoCard({ dealerId, salesmanId }: DealerInfoCardProps) {
  const [dealer, setDealer] = useState<DealerInfo | null>(null);
  const [salesman, setSalesman] = useState<SalesmanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDealerInfo();
  }, [dealerId]);

  const fetchDealerInfo = async () => {
    try {
      const response = await fetch(apiUrl(`/users/${dealerId}`));
      const data = await response.json();
      setDealer(data);

      // Fetch salesman info if different from dealer
      if (salesmanId && salesmanId !== dealerId) {
        const salesmanResponse = await fetch(apiUrl(`/users/${salesmanId}`));
        const salesmanData = await salesmanResponse.json();
        setSalesman(salesmanData);
      }
    } catch (error) {
      console.error('Failed to fetch dealer info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-20 bg-gray-200 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (!dealer) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Dealer/Company Header */}
      <div className="bg-secondary p-6 text-light">
        <div className="flex items-center gap-4">
          {dealer.logo_url ? (
            <img
              src={mediaUrl(dealer.logo_url)}
              alt={dealer.company_name || dealer.name}
              className="w-16 h-16 rounded-lg object-cover bg-white p-1"
              onError={onImgError}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-primary flex items-center justify-center">
              <Building2 size={32} />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-2xl font-bold">{dealer.company_name || dealer.name}</h3>
            {dealer.company_name && (
              <p className="text-light/80 text-sm">{dealer.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="p-6 space-y-4">
        {/* Salesman Info (if different from dealer) */}
        {salesman && (
          <div className="pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              {salesman.photo_url ? (
                <img
                  src={mediaUrl(salesman.photo_url)}
                  alt={`${salesman.first_name} ${salesman.last_name}`}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={onImgError}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User size={24} className="text-gray-500" />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">
                  Your Sales Representative
                </p>
                <p className="text-sm text-gray-600">
                  {salesman.first_name} {salesman.last_name}
                </p>
                {salesman.title && (
                  <p className="text-xs text-gray-500">{salesman.title}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contact Details */}
        <div className="space-y-3">
          <a
            href={`mailto:${dealer.email}`}
            className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <Mail size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="font-medium">{dealer.email}</p>
            </div>
          </a>

          <a
            href={`tel:${dealer.phone}`}
            className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-50 group-hover:bg-green-100 flex items-center justify-center transition-colors">
              <Phone size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="font-medium">{dealer.phone}</p>
            </div>
          </a>
        </div>

        {/* Dealer Profile Link */}
        {dealer.slug && (
          <div className="pt-4 border-t border-gray-200">
            <a
              href={`/dealers/${dealer.slug}`}
              className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Award size={18} className="text-blue-600" />
                <span className="font-medium text-gray-900">View Broker Profile</span>
              </div>
              <ExternalLink size={16} className="text-gray-400 group-hover:text-blue-600" />
            </a>
          </div>
        )}

        {/* Trust Badge */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Award size={16} className="text-green-600" />
            <span>Verified Dealer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
