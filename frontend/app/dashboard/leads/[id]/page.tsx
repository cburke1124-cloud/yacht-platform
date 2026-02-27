'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MessageSquare, Mail, Phone, Calendar, ArrowLeft, Copy, Link as LinkIcon } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  interested_in: string;
  date: string;
  unread_count?: number;
  last_message?: string;
}

interface Conversation {
  id: number;
  sender: string;
  message: string;
  timestamp: string;
  is_from_lead: boolean;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (leadId) {
      fetchLeadData();
    }
  }, [leadId]);

  const fetchLeadData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch conversations
      const conversationResponse = await fetch(
        apiUrl(`/leads/${leadId}/conversations`),
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (conversationResponse.ok) {
        const conversationData = await conversationResponse.json();
        setConversations(conversationData);
        
        // Extract lead info from first message
        if (conversationData.length > 0) {
          const firstMsg = conversationData[0];
          setLead({
            id: parseInt(leadId),
            name: firstMsg.sender,
            email: firstMsg.sender, // Will be updated below
            phone: '',
            interested_in: 'Unknown',
            date: firstMsg.timestamp,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch lead data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!replyMessage.trim()) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        apiUrl(`/leads/${leadId}/reply`),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: replyMessage })
        }
      );

      if (response.ok) {
        setReplyMessage('');
        await fetchLeadData();
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-primary hover:bg-cyan-50 rounded-lg transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <div className="text-center py-12">
            <MessageSquare size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 text-lg">Lead not found</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract lead info from conversations
  const leadName = conversations.length > 0 ? conversations[0].sender : lead.name;

  return (
    <div className="min-h-screen bg-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-primary hover:bg-cyan-50 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Leads
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead Info Card */}
          <div className="lg:col-span-1">
            <div className="glass-card p-6 sticky top-4">
              {/* Avatar */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="text-4xl font-bold text-white">
                    {leadName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-secondary">{leadName}</h2>
              </div>

              {/* Contact Information */}
              <div className="space-y-3 mb-6">
                {/* Email */}
                <div className="flex items-start gap-3 p-3 bg-soft rounded-lg">
                  <Mail className="text-primary mt-1 flex-shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 mb-1">Email</p>
                    <p className="text-sm font-semibold text-secondary break-all">
                      {lead.email}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(lead.email)}
                    className="p-1 hover:bg-primary/10 rounded transition-colors flex-shrink-0"
                    title="Copy email"
                  >
                    <Copy size={16} className="text-primary" />
                  </button>
                </div>

                {/* Phone */}
                {lead.phone && (
                  <div className="flex items-start gap-3 p-3 bg-soft rounded-lg">
                    <Phone className="text-primary mt-1 flex-shrink-0" size={20} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Phone</p>
                      <p className="text-sm font-semibold text-secondary">{lead.phone}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lead.phone)}
                      className="p-1 hover:bg-primary/10 rounded transition-colors flex-shrink-0"
                      title="Copy phone"
                    >
                      <Copy size={16} className="text-primary" />
                    </button>
                  </div>
                )}

                {/* Interested In */}
                {lead.interested_in && (
                  <div className="flex items-start gap-3 p-3 bg-soft rounded-lg">
                    <LinkIcon className="text-secondary mt-1 flex-shrink-0" size={20} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Interested In</p>
                      <p className="text-sm font-semibold text-secondary">{lead.interested_in}</p>
                    </div>
                  </div>
                )}

                {/* Date */}
                <div className="flex items-start gap-3 p-3 bg-soft rounded-lg">
                  <Calendar className="text-accent mt-1 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 mb-1">First Contact</p>
                    <p className="text-sm font-semibold text-secondary">
                      {new Date(lead.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => window.location.href = `mailto:${lead.email}`}
                  className="w-full px-4 py-2 bg-primary text-light rounded-lg hover-primary font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Mail size={18} />
                  Send Email
                </button>
                {lead.phone && (
                  <button
                    onClick={() => window.location.href = `tel:${lead.phone}`}
                    className="w-full px-4 py-2 bg-secondary text-light rounded-lg hover:bg-secondary/90 font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone size={18} />
                    Call Lead
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conversation Thread */}
          <div className="lg:col-span-2">
            <div className="glass-card p-6 h-full flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-secondary mb-2">Conversation History</h3>
                <p className="text-sm text-gray-600">
                  {conversations.length} message{conversations.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto mb-6 space-y-4 min-h-96 p-4 bg-white/50 rounded-lg">
                {conversations.length > 0 ? (
                  conversations.map((msg, index) => (
                    <div
                      key={`${msg.id}-${index}`}
                      className={`flex ${msg.is_from_lead ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                          msg.is_from_lead
                            ? 'bg-soft text-secondary border border-primary/10'
                            : 'bg-primary text-light'
                        }`}
                      >
                        <p className="text-sm break-words">{msg.message}</p>
                        <p
                          className={`text-xs mt-2 ${
                            msg.is_from_lead ? 'text-gray-600' : 'text-white/70'
                          }`}
                        >
                          {new Date(msg.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-600">No conversations yet</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reply Form */}
              <div className="border-t border-gray-200 pt-4">
                <form onSubmit={handleSendReply} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Your Reply
                    </label>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your message and press Send..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!replyMessage.trim() || sending}
                      className="flex-1 px-4 py-2 bg-primary text-light rounded-lg hover-primary disabled:bg-gray-300 font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <MessageSquare size={18} />
                          Send Reply
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyMessage('')}
                      className="px-4 py-2 bg-soft text-secondary rounded-lg hover:bg-primary/10 font-semibold transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  <p className="text-xs text-gray-600">
                    💡 An email notification will be sent to the lead when you reply.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
