'use client';

import { useState, useEffect } from 'react';
import { Mail, MailOpen, Clock, Check } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface Inquiry {
  id: number;
  listing_title: string;
  listing_id: number;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  message: string;
  status: string;
  created_at: string;
}

export default function InquiriesTab() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'replied'>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/inquiries'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInquiries(data);
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (inquiryId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/inquiries/${inquiryId}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'read' })
      });

      if (response.ok) {
        setInquiries(inquiries.map(inq => 
          inq.id === inquiryId ? { ...inq, status: 'read' } : inq
        ));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAsReplied = async (inquiryId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/inquiries/${inquiryId}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'replied' })
      });

      if (response.ok) {
        setInquiries(inquiries.map(inq => 
          inq.id === inquiryId ? { ...inq, status: 'replied' } : inq
        ));
        setSelectedInquiry(null);
        alert('Marked as replied!');
      }
    } catch (error) {
      console.error('Failed to mark as replied:', error);
    }
  };

  const filteredInquiries = inquiries.filter(inq => {
    if (filter === 'all') return true;
    if (filter === 'new') return inq.status === 'new' || inq.status === 'read';
    if (filter === 'replied') return inq.status === 'replied';
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return <div className="text-center py-8">Loading inquiries...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Inbox List */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Inquiries</h2>
            
            {/* Filter Tabs */}
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All', count: inquiries.length },
                { id: 'new', label: 'New', count: inquiries.filter(i => i.status === 'new' || i.status === 'read').length },
                { id: 'replied', label: 'Replied', count: inquiries.filter(i => i.status === 'replied').length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                    filter === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1">({tab.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Inquiry List */}
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {filteredInquiries.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Mail size={48} className="mx-auto mb-4 text-gray-400" />
                <p>No inquiries yet</p>
              </div>
            ) : (
              filteredInquiries.map((inquiry) => (
                <button
                  key={inquiry.id}
                  onClick={() => {
                    setSelectedInquiry(inquiry);
                    if (inquiry.status === 'new') markAsRead(inquiry.id);
                  }}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedInquiry?.id === inquiry.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {inquiry.status === 'new' ? (
                        <Mail size={16} className="text-blue-600" />
                      ) : inquiry.status === 'replied' ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <MailOpen size={16} className="text-gray-400" />
                      )}
                      <span className={`font-semibold text-sm ${
                        inquiry.status === 'new' ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {inquiry.sender_name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(inquiry.created_at)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 font-medium mb-1">
                    {inquiry.listing_title}
                  </p>
                  
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {inquiry.message}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Inquiry Detail */}
      <div className="lg:col-span-2">
        {selectedInquiry ? (
          <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {selectedInquiry.sender_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    About: <span className="font-medium">{selectedInquiry.listing_title}</span>
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {selectedInquiry.status !== 'replied' && (
                    <button
                      onClick={() => markAsReplied(selectedInquiry.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                    >
                      Mark as Replied
                    </button>
                  )}
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedInquiry.status === 'new' ? 'bg-blue-100 text-blue-800' :
                    selectedInquiry.status === 'replied' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedInquiry.status === 'new' ? 'New' :
                     selectedInquiry.status === 'replied' ? 'Replied' : 'Read'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={14} />
                <span>{formatDate(selectedInquiry.created_at)}</span>
              </div>
            </div>

            {/* Contact Info */}
            <div className="p-6 bg-gray-50 border-b">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Email</label>
                  <a
                    href={`mailto:${selectedInquiry.sender_email}`}
                    className="block text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedInquiry.sender_email}
                  </a>
                </div>
                {selectedInquiry.sender_phone && (
                  <div>
                    <label className="text-xs text-gray-500">Phone</label>
                    <a
                      href={`tel:${selectedInquiry.sender_phone}`}
                      className="block text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {selectedInquiry.sender_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Message */}
            <div className="p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Message</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {selectedInquiry.message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-gray-50">
              <div className="flex gap-3">
                <a
                  href={`mailto:${selectedInquiry.sender_email}?subject=Re: ${selectedInquiry.listing_title}`}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
                >
                  Reply via Email
                </a>
                <a
                  href={`/listings/${selectedInquiry.listing_id}`}
                  target="_blank"
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
                >
                  View Listing
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Mail size={64} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Select an inquiry to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}