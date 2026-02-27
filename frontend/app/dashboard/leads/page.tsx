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

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-secondary">Inbound Leads</h1>
            <p className="text-gray-600 mt-1">
              {leads.length} lead{leads.length !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter size={20} />
            Filter
          </button>
        </div>

        {/* Leads Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-soft">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Interested In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Messages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-soft transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-secondary">{lead.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{lead.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{lead.phone || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{lead.interested_in}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {new Date(lead.date).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {lead.unread_count > 0 && (
                            <span className="px-2 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                              {lead.unread_count}
                            </span>
                          )}
                          <span className="text-sm text-gray-600 truncate">
                            {lead.last_message || 'No messages'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/dashboard/leads/${lead.id}`}
                            className="p-2 text-primary hover:bg-cyan-50 rounded transition-colors inline-flex"
                            title="View conversations"
                          >
                            <MessageSquare size={18} />
                          </a>
                          <a
                            href={`mailto:${lead.email}`}
                            className="p-2 text-secondary hover:bg-soft rounded transition-colors inline-flex"
                            title="Send email"
                          >
                            <Mail size={18} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-600">
                        {searchTerm ? 'No leads found matching your search' : 'No leads yet'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
