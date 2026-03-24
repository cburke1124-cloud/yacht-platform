'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

// Type definitions
type Message = {
  id: number;
  subject: string;
  body: string;
  message_type: string;
  ticket_number: string;
  priority: string;
  category: string;
  status: string;
  sender_name: string;
  sender_email: string;
  created_at: string;
};

type Reply = {
  id: number;
  body: string;
  sender_name: string;
  created_at: string;
};

type MessageDetail = {
  message: Message;
  replies: Reply[];
};

type MessageEntry = {
  id: number;
  body: string;
  sender_name: string;
  is_from_buyer: boolean;
  created_at: string;
};

type Inquiry = {
  id: number;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  lead_stage: string;
  listing_title: string | null;
  created_at: string;
  message_id?: number | null;
  message_thread?: MessageEntry[];
};

export default function MessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'replied' | 'inquiries'>('all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [inquiryReplyText, setInquiryReplyText] = useState('');
  const [sendingInquiryReply, setSendingInquiryReply] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(apiUrl('/auth/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Not authenticated');
      }

      const userData = await response.json();
      setUser(userData);
      await fetchMessages(token);
      await fetchInquiries(token);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (token: string) => {
    try {
      const response = await fetch(apiUrl('/messages'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data: Message[] = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const fetchInquiries = async (token: string) => {
    try {
      const response = await fetch(apiUrl('/inquiries'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setInquiries(data.items ?? data);
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
    }
  };

  const loadInquiryDetail = async (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setSelectedMessage(null);
    setInquiryReplyText('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/inquiries/${inquiry.id}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedInquiry(prev => prev ? { ...prev, message_id: data.message_id, message_thread: data.message_thread ?? [] } : prev);
      }
    } catch (error) {
      console.error('Failed to load inquiry detail:', error);
    }
  };

  const handleInquiryReply = async () => {
    if (!inquiryReplyText.trim() || !selectedInquiry) return;
    setSendingInquiryReply(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/inquiries/${selectedInquiry.id}/reply`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ body: inquiryReplyText.trim() }),
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedInquiry(prev => prev ? { ...prev, message_id: data.message_id, message_thread: data.message_thread ?? [] } : prev);
        setInquiryReplyText('');
      }
    } catch (error) {
      console.error('Failed to send inquiry reply:', error);
    } finally {
      setSendingInquiryReply(false);
    }
  };

  const loadMessageDetail = async (messageId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/messages/${messageId}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const detail: MessageDetail = {
          message: data.message,
          replies: data.replies || []
        };
        setSelectedMessage(detail);
      }
    } catch (error) {
      console.error('Failed to load message:', error);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedMessage) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/messages/${selectedMessage.message.id}/reply`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ body: replyText })
      });

      if (response.ok) {
        setReplyText('');
        // Reload message to show new reply
        await loadMessageDetail(selectedMessage.message.id);
        // Refresh messages list
        await fetchMessages(token || '');
        alert('Reply sent successfully!');
      } else {
        alert('Failed to send reply');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleCreateTicket = async () => {
    const subject = prompt('Enter ticket subject:');
    if (!subject) return;

    const message = prompt('Enter your message:');
    if (!message) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/messages'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message_type: 'support_ticket',
          subject,
          body: message,
          priority: 'normal',
          category: 'general'
        })
      });

      if (response.ok) {
        alert('Support ticket created successfully!');
        await fetchMessages(token || '');
      } else {
        alert('Failed to create ticket');
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      alert('Failed to create ticket');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'normal': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-blue-600 bg-blue-100';
      case 'replied': return 'text-green-600 bg-green-100';
      case 'closed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'inquiries') return false;
    if (filter === 'all') return true;
    if (filter === 'new') return msg.status === 'new' || msg.status === 'read';
    if (filter === 'replied') return msg.status === 'replied';
    return true;
  });

  const getStageStyle = (stage: string) => {
    switch (stage) {
      case 'new': return 'bg-gray-100 text-gray-700';
      case 'contacted': return 'bg-blue-100 text-blue-700';
      case 'qualified': return 'bg-yellow-100 text-yellow-700';
      case 'proposal': return 'bg-orange-100 text-orange-700';
      case 'won': return 'bg-green-100 text-green-700';
      case 'lost': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-900">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-secondary">Messages & Support</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleCreateTicket}
                className="px-4 py-2 bg-primary text-white rounded-lg hover-primary"
              >
                + New Support Ticket
              </button>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-44 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 p-3 space-y-2">
                  {[
                    { id: 'all' as const, label: 'Support', count: messages.length },
                    { id: 'new' as const, label: 'New', count: messages.filter(m => m.status === 'new' || m.status === 'read').length },
                    { id: 'replied' as const, label: 'Replied', count: messages.filter(m => m.status === 'replied').length },
                    { id: 'inquiries' as const, label: 'Inquiries', count: inquiries.length }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { setFilter(tab.id); setSelectedMessage(null); setSelectedInquiry(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                        filter === tab.id
                          ? 'bg-primary text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="text-xs opacity-75">({tab.count})</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 divide-y max-h-[600px] overflow-y-auto">
                {filter === 'inquiries' ? (
                  inquiries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Mail size={48} className="mx-auto mb-4 text-gray-400" />
                      <p>No inquiries yet</p>
                    </div>
                  ) : (
                    inquiries.map((inquiry) => (
                      <button
                        key={inquiry.id}
                        onClick={() => loadInquiryDetail(inquiry)}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                          selectedInquiry?.id === inquiry.id ? 'bg-[#01BCDD]/10' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900">{inquiry.sender_name}</p>
                          <span className="text-xs text-gray-500">{formatDate(inquiry.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{inquiry.listing_title ?? 'General Inquiry'}</p>
                        <p className="text-sm text-gray-600 line-clamp-2">{inquiry.message}</p>
                        <div className="mt-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStageStyle(inquiry.lead_stage)}`}>
                            {inquiry.lead_stage ?? 'new'}
                          </span>
                        </div>
                      </button>
                    ))
                  )
                ) : filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Mail size={48} className="mx-auto mb-4 text-gray-400" />
                    <p>No messages</p>
                  </div>
                ) : (
                  filteredMessages.map((message) => (
                    <button
                      key={message.id}
                      onClick={() => { loadMessageDetail(message.id); setSelectedInquiry(null); }}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedMessage?.message.id === message.id ? 'bg-[#01BCDD]/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(message.priority)}`}>
                            {message.priority}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(message.created_at)}
                        </span>
                      </div>

                      {message.ticket_number && (
                        <p className="text-xs text-gray-500 mb-1">Ticket: {message.ticket_number}</p>
                      )}

                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        {message.subject}
                      </p>

                      <p className="text-sm text-gray-600 line-clamp-2">
                        {message.body}
                      </p>

                      <div className="mt-2">
                        <span className="text-xs text-gray-500">From: {message.sender_name}</span>
                      </div>
                    </button>
                  ))
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
            {selectedInquiry ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b bg-secondary">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{selectedInquiry.sender_name}</h3>
                      <p className="text-sm text-white/70">{selectedInquiry.listing_title ?? 'General Inquiry'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStageStyle(selectedInquiry.lead_stage)}`}>
                      {selectedInquiry.lead_stage ?? 'new'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-2">{formatDate(selectedInquiry.created_at)}</p>
                </div>
                <div className="p-6 bg-gray-50 border-b">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</span>
                  <p className="text-sm text-gray-900 mt-1">
                    <a href={`mailto:${selectedInquiry.sender_email}`} className="text-primary hover:underline">{selectedInquiry.sender_email}</a>
                  </p>
                  {selectedInquiry.sender_phone && (
                    <p className="text-sm text-gray-900">
                      <a href={`tel:${selectedInquiry.sender_phone}`} className="text-primary hover:underline">{selectedInquiry.sender_phone}</a>
                    </p>
                  )}
                </div>

                {/* Message thread */}
                <div className="p-6 space-y-4 max-h-[360px] overflow-y-auto">
                  {(selectedInquiry.message_thread && selectedInquiry.message_thread.length > 0) ? (
                    selectedInquiry.message_thread.map((entry) => (
                      <div key={entry.id} className={`flex ${entry.is_from_buyer ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-xl px-4 py-3 ${entry.is_from_buyer ? 'bg-gray-100 text-gray-800' : 'bg-primary text-white'}`}>
                          <p className={`text-xs font-semibold mb-1 ${entry.is_from_buyer ? 'text-gray-500' : 'text-white/70'}`}>{entry.sender_name}</p>
                          <p className="text-sm whitespace-pre-wrap">{entry.body}</p>
                          <p className={`text-xs mt-1 ${entry.is_from_buyer ? 'text-gray-400' : 'text-white/50'}`}>{formatDate(entry.created_at)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <p className="text-gray-800 whitespace-pre-wrap">{selectedInquiry.message}</p>
                    </div>
                  )}
                </div>

                {/* Reply box */}
                <div className="p-6 border-t">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Reply to {selectedInquiry.sender_name}</h4>
                  <textarea
                    value={inquiryReplyText}
                    onChange={(e) => setInquiryReplyText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01BCDD] mb-4"
                    rows={3}
                    placeholder="Type your reply..."
                  />
                  <div className="flex items-center justify-between gap-3">
                    <a href={`/dashboard/inquiries`} className="text-xs text-gray-500 hover:text-primary transition-colors">
                      Manage pipeline in Leads Manager →
                    </a>
                    <button
                      onClick={handleInquiryReply}
                      disabled={sendingInquiryReply || !inquiryReplyText.trim()}
                      className="px-5 py-2 bg-primary text-white rounded-lg hover-primary disabled:bg-gray-400 flex items-center gap-2 text-sm"
                    >
                      {sendingInquiryReply ? 'Sending...' : (<><Send size={14} />Send Reply</>)}
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedMessage ? (
              <div className="bg-white rounded-lg shadow">
                {/* Message Header */}
                <div className="p-6 border-b">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {selectedMessage.message.subject}
                      </h3>
                      {selectedMessage.message.ticket_number && (
                        <p className="text-sm text-gray-600 mb-2">
                          Ticket: {selectedMessage.message.ticket_number}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedMessage.message.priority)}`}>
                        {selectedMessage.message.priority.toUpperCase()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedMessage.message.status)}`}>
                        {selectedMessage.message.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock size={14} />
                    <span>{formatDate(selectedMessage.message.created_at)}</span>
                  </div>
                </div>

                {/* Original Message */}
                <div className="p-6 bg-gray-50 border-b">
                  <div className="mb-3">
                    <span className="text-sm font-semibold text-gray-700">From:</span>
                    <span className="text-sm text-gray-900 ml-2">{selectedMessage.message.sender_name}</span>
                  </div>
                  <div className="bg-white rounded-lg p-4 border">
                    <p className="text-gray-800 whitespace-pre-wrap">{selectedMessage.message.body}</p>
                  </div>
                </div>

                {/* Replies */}
                {selectedMessage.replies.length > 0 && (
                  <div className="p-6 border-b">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">Replies ({selectedMessage.replies.length})</h4>
                    <div className="space-y-4">
                      {selectedMessage.replies.map((reply: Reply) => (
                        <div key={reply.id} className="bg-[#01BCDD]/10 rounded-lg p-4 border border-[#01BCDD]/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-900">{reply.sender_name}</span>
                            <span className="text-xs text-gray-500">{formatDate(reply.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{reply.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply Form */}
                <div className="p-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Send Reply</h4>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01BCDD] mb-4"
                    rows={4}
                    placeholder="Type your reply..."
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleSendReply}
                      disabled={sending || !replyText.trim()}
                      className="px-6 py-2 bg-primary text-white rounded-lg hover-primary disabled:bg-gray-400 flex items-center gap-2"
                    >
                      {sending ? (
                        'Sending...'
                      ) : (
                        <>
                          <Send size={16} />
                          Send Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow h-full flex items-center justify-center p-12">
                <div className="text-center text-gray-500">
                  <Mail size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">Select a message to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-[#01BCDD]/10 border border-[#01BCDD]/30 rounded-lg p-6">
          <h4 className="font-semibold text-secondary mb-3">💡 Using the Messaging System</h4>
          <ul className="text-sm text-secondary/80 space-y-2">
            <li>• Click “New Support Ticket” to contact support</li>
            <li>• Switch to the <strong>Inquiries</strong> tab to see buyer messages about your listings</li>
            <li>• Reply directly to support messages to maintain conversation history</li>
            <li>• Tickets are automatically assigned unique tracking numbers</li>
            <li>• You'll receive email notifications for new messages</li>
          </ul>
        </div>
      </main>
    </div>
  );
}