'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Mail, Phone, Calendar, Search, Filter } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  interested_in: string;
  date: string;
  unread_count: number;
  last_message: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/leads'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLeads(data || []);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Coming soon — full CRM paused for launch
  return (
    <div className="min-h-screen bg-soft flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Search size={36} className="text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-secondary mb-4">Enhanced CRM Coming Soon</h1>
        <p className="text-gray-600 text-lg mb-6">
          We&apos;re building a powerful leads and CRM system to help you track and manage every buyer conversation.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          In the meantime, all buyer inquiries and messages are available in your inbox.
        </p>
        <a
          href="/messages"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm"
        >
          <Mail size={18} />
          View Messages &amp; Inquiries
        </a>
      </div>
    </div>
  );
}
