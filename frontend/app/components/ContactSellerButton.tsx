'use client';

import { useState } from 'react';
import { Send, X, Mail } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface ContactSellerButtonProps {
  listingId: number;
  listingTitle: string;
  dealerName?: string;
}

export default function ContactSellerButton({ listingId, listingTitle, dealerName }: ContactSellerButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sender_name: '',
    sender_email: '',
    sender_phone: '',
    message: `Hi, I'm interested in ${listingTitle}. Please contact me with more details.`
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/inquiries'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listing_id: listingId,
          ...formData
        })
      });

      if (response.ok) {
        alert('✅ Message sent! The dealer will contact you soon.');
        setShowModal(false);
        setFormData({
          sender_name: '',
          sender_email: '',
          sender_phone: '',
          message: ''
        });
      } else {
        alert('❌ Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Failed to send inquiry:', error);
      alert('❌ Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full px-8 py-4 bg-primary text-light text-lg font-bold rounded-lg hover-primary transition-colors flex items-center justify-center gap-2 shadow-lg"
      >
        <Mail size={24} />
        Contact Seller
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b bg-primary text-light rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Contact Seller</h2>
                  <p className="text-light/80 text-sm">{listingTitle}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-light hover:text-light/80"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-sm text-primary">
                <p className="font-medium mb-1">✉️ Your message will be sent directly to {dealerName || 'the seller'}</p>
                <p className="text-xs">They'll respond to you via email or phone within 24 hours.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.sender_name}
                  onChange={(e) => setFormData({...formData, sender_name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.sender_email}
                  onChange={(e) => setFormData({...formData, sender_email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.sender_phone}
                  onChange={(e) => setFormData({...formData, sender_phone: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary min-h-[120px]"
                  placeholder="Tell the seller what you'd like to know..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include questions about price, condition, location, or availability.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium flex items-center justify-center gap-2 disabled:bg-secondary/50"
                >
                  {loading ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send size={18} />
                      Send Message
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
