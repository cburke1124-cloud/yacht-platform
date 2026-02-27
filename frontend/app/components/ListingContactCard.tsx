'use client';

import { useState, useEffect } from 'react';
import { Mail, Phone, User, Building2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

interface ContactInfo {
  dealer: {
    name: string;
    email: string;
    phone?: string;
    logo_url?: string;
    slug?: string;
  };
  sales_contact?: {
    name: string;
    title?: string;
    email: string;
    phone?: string;
    photo_url?: string;
    bio?: string;
  };
}

interface ListingContactCardProps {
  listingId: number;
}

export default function ListingContactCard({ listingId }: ListingContactCardProps) {
  const router = useRouter();
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState<'dealer' | 'sales'>('dealer');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    fetchContactInfo();
  }, [listingId]);

  const fetchContactInfo = async () => {
    try {
      const response = await fetch(apiUrl(`/listings/${listingId}/contact-info`));
      if (response.ok) {
        const data = await response.json();
        setContact(data);
      }
    } catch (error) {
      console.error('Failed to fetch contact info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = (type: 'dealer' | 'sales') => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/messages');
      return;
    }
    setMessageRecipient(type);
    setShowMessageModal(true);
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) {
      alert('Please enter a message');
      return;
    }
    router.push(`/messages?new=true&recipient=${messageRecipient}&message=${encodeURIComponent(messageText)}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Broker Section */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-start gap-4">
            {contact.dealer.logo_url ? (
              <img
                src={contact.dealer.logo_url}
                alt={contact.dealer.name}
                className="w-20 h-20 rounded-lg object-cover border-2 border-white shadow"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow">
                {contact.dealer.name.charAt(0)}
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={18} className="text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">
                  {contact.dealer.name}
                </h3>
              </div>
              
              <div className="space-y-2">
                <a
                  href={`mailto:${contact.dealer.email}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <Mail size={14} />
                  {contact.dealer.email}
                </a>
                
                {contact.dealer.phone && (
                  <a
                    href={`tel:${contact.dealer.phone}`}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <Phone size={14} />
                    {contact.dealer.phone}
                  </a>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleContactClick('dealer')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <MessageSquare size={16} />
                  Contact Broker
                </button>
                
                {contact.dealer.slug && (
                  <button
                    onClick={() => router.push(`/dealers/${contact.dealer.slug}`)}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                  >
                    View Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sales Contact Section */}
        {contact.sales_contact && (
          <div className="p-6 bg-gray-50">
            <div className="flex items-start gap-4">
              {contact.sales_contact.photo_url ? (
                <img
                  src={contact.sales_contact.photo_url}
                  alt={contact.sales_contact.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold text-lg">
                  {contact.sales_contact.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <User size={16} className="text-gray-600" />
                  <h4 className="font-bold text-gray-900">
                    {contact.sales_contact.name}
                  </h4>
                </div>
                
                {contact.sales_contact.title && (
                  <p className="text-sm text-gray-600 mb-2">
                    {contact.sales_contact.title}
                  </p>
                )}

                {contact.sales_contact.bio && (
                  <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                    {contact.sales_contact.bio}
                  </p>
                )}
                
                <div className="space-y-1 mb-3">
                  <a
                    href={`mailto:${contact.sales_contact.email}`}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <Mail size={14} />
                    {contact.sales_contact.email}
                  </a>
                  
                  {contact.sales_contact.phone && (
                    <a
                      href={`tel:${contact.sales_contact.phone}`}
                      className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      <Phone size={14} />
                      {contact.sales_contact.phone}
                    </a>
                  )}
                </div>

                <button
                  onClick={() => handleContactClick('sales')}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <MessageSquare size={16} />
                  Contact Sales Rep
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="p-4 bg-blue-600 text-white text-center">
          <p className="text-sm font-medium">
            Interested in this yacht? Get in touch today!
          </p>
        </div>
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">
                Send Message to {messageRecipient === 'dealer' ? contact.dealer.name : contact.sales_contact?.name}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="I'm interested in this yacht..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMessageModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}