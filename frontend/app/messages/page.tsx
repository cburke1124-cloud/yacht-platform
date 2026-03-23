'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Mail, MailOpen, CheckCircle, Clock, Search, ChevronRight, User } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface Message {
  id: number;
  ticket_number: string;
  subject: string;
  body: string;
  message_type: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  sender_id: number | null;
  recipient_id: number;
  sender_name: string;
  sender_email: string;
  external_sender_email?: string;
  listing_id?: number | null;
}

interface Reply {
  id: number;
  body: string;
  sender_name: string;
  created_at: string;
}

interface MessageDetail {
  message: Message;
  replies: Reply[];
}

export default function MessagingCenter() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<MessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'inquiry' | 'support_ticket' | 'direct'>('all');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);

  const [newMessageForm, setNewMessageForm] = useState({
    subject: '',
    body: '',
    message_type: 'support_ticket',
    priority: 'normal',
    category: 'general',
  });

  useEffect(() => { fetchMessages(); }, [filter]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedDetail]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = filter === 'all'
        ? apiUrl('/messages')
        : apiUrl(`/messages?message_type=${filter}`);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMessages(await res.json());
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    } finally {
      setLoading(false);
    }
  };

  const openMessage = async (msg: Message) => {
    setLoadingDetail(true);
    setSelectedDetail(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/messages/${msg.id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedDetail({ message: data.message, replies: data.replies ?? [] });
        // Refresh list status (new â†’ read)
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id && m.status === 'new' ? { ...m, status: 'read' } : m))
        );
      }
    } catch (e) {
      console.error('Failed to load message detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const sendReply = async () => {
    if (!selectedDetail || !replyText.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/messages/${selectedDetail.message.id}/reply`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: replyText }),
      });
      if (res.ok) {
        setReplyText('');
        // Reload detail to show new reply
        await openMessage(selectedDetail.message);
        setMessages((prev) =>
          prev.map((m) => (m.id === selectedDetail.message.id ? { ...m, status: 'replied' } : m))
        );
      }
    } catch (e) {
      console.error('Failed to send reply:', e);
    } finally {
      setSending(false);
    }
  };

  const createNewMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newMessageForm),
      });
      if (res.ok) {
        setShowNewMessage(false);
        setNewMessageForm({ subject: '', body: '', message_type: 'support_ticket', priority: 'normal', category: 'general' });
        fetchMessages();
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const updateStatus = async (messageId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(apiUrl(`/messages/${messageId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: newStatus } : m)));
      if (selectedDetail?.message.id === messageId) {
        setSelectedDetail((d) => d ? { ...d, message: { ...d.message, status: newStatus } } : d);
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffH = (now.getTime() - date.getTime()) / 3_600_000;
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffH < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredMessages = messages.filter((msg) =>
    searchQuery === '' ||
    msg.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.sender_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const typeColor: Record<string, string> = {
    inquiry: 'bg-teal-100 text-teal-700',
    support_ticket: 'bg-purple-100 text-purple-700',
    direct: 'bg-blue-100 text-blue-700',
  };

  const statusDot: Record<string, string> = {
    new: 'bg-blue-500',
    read: 'bg-gray-300',
    replied: 'bg-green-500',
    closed: 'bg-gray-300',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-secondary">Messages</h1>
            <p className="text-dark/60 mt-0.5 text-sm">Manage your conversations and support tickets</p>
          </div>
          <button
            onClick={() => setShowNewMessage(true)}
            className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-2 text-sm"
          >
            <Mail size={16} />
            New Message
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { id: 'all', label: 'All', count: messages.length },
            { id: 'inquiry', label: 'Inquiries', count: messages.filter((m) => m.message_type === 'inquiry').length },
            { id: 'support_ticket', label: 'Support', count: messages.filter((m) => m.message_type === 'support_ticket').length },
            { id: 'direct', label: 'Direct', count: messages.filter((m) => m.message_type === 'direct').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === tab.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-dark border-gray-200 hover:border-gray-400'
              }`}
            >
              {tab.label} <span className="opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Split pane */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-260px)] min-h-[500px]">
          {/* â”€â”€ Left: message list â”€â”€ */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Searchâ€¦"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loadingâ€¦</div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Mail size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No messages found</p>
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedDetail?.message.id === msg.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${statusDot[msg.status] ?? 'bg-gray-300'}`} />
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {msg.sender_name || msg.sender_email || 'Unknown'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatDate(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium truncate ml-4">{msg.subject}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 ml-4 mt-0.5">{msg.body}</p>
                    <div className="flex items-center gap-2 mt-2 ml-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor[msg.message_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {msg.message_type.replace('_', ' ')}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* â”€â”€ Right: conversation thread â”€â”€ */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loadingâ€¦</div>
            ) : !selectedDetail ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Mail size={56} className="mb-4 text-gray-200" />
                <p className="font-medium">No message selected</p>
                <p className="text-sm mt-1">Choose a message from the list to view details</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-6 py-4 border-b flex items-start justify-between gap-4 bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-gray-900 truncate">{selectedDetail.message.subject}</h2>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {selectedDetail.message.sender_name || selectedDetail.message.sender_email || 'Unknown'}
                        {selectedDetail.message.external_sender_email && (
                          <span className="text-gray-400">({selectedDetail.message.external_sender_email})</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(selectedDetail.message.created_at).toLocaleString()}
                      </span>
                      {selectedDetail.message.ticket_number && (
                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                          {selectedDetail.message.ticket_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedDetail.message.status !== 'closed' && (
                      <button
                        onClick={() => updateStatus(selectedDetail.message.id, 'closed')}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 text-xs font-medium text-gray-600"
                      >
                        Close
                      </button>
                    )}
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold ${typeColor[selectedDetail.message.message_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {selectedDetail.message.message_type.replace('_', ' ')}
                    </span>
                    <button onClick={() => setSelectedDetail(null)} className="text-gray-400 hover:text-gray-600 ml-1">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Message thread */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {/* Original message */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={14} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800">
                          {selectedDetail.message.sender_name || selectedDetail.message.external_sender_email || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(selectedDetail.message.created_at).toLocaleString()}</span>
                      </div>
                      <div className="bg-gray-50 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
                        {selectedDetail.message.body}
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {selectedDetail.replies.map((reply) => {
                    const isMine = reply.sender_name !== (selectedDetail.message.sender_name || selectedDetail.message.external_sender_email);
                    return (
                      <div key={reply.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isMine ? 'bg-primary text-white' : 'bg-gray-200'}`}>
                          <User size={14} className={isMine ? 'text-white' : 'text-gray-500'} />
                        </div>
                        <div className={`flex-1 min-w-0 ${isMine ? 'items-end flex flex-col' : ''}`}>
                          <div className={`flex items-baseline gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm font-semibold text-gray-800">{reply.sender_name}</span>
                            <span className="text-xs text-gray-400">{new Date(reply.created_at).toLocaleString()}</span>
                          </div>
                          <div className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap border max-w-[85%] ${
                            isMine
                              ? 'bg-primary text-white border-primary/20 rounded-tr-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-100 rounded-tl-sm'
                          }`}>
                            {reply.body}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {/* Reply box */}
                {selectedDetail.message.status !== 'closed' && (
                  <div className="px-6 py-4 border-t bg-gray-50">
                    <div className="flex gap-3 items-end">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                        rows={3}
                        placeholder="Type your replyâ€¦ (Ctrl+Enter to send)"
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-white"
                      />
                      <button
                        onClick={sendReply}
                        disabled={sending || !replyText.trim()}
                        className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 font-medium flex items-center gap-2 text-sm disabled:opacity-50 flex-shrink-0"
                      >
                        <Send size={15} />
                        {sending ? 'Sendingâ€¦' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-secondary">New Message</h2>
              <button onClick={() => setShowNewMessage(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={createNewMessage} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                  <select
                    value={newMessageForm.message_type}
                    onChange={(e) => setNewMessageForm({ ...newMessageForm, message_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                  >
                    <option value="support_ticket">Support Ticket</option>
                    <option value="direct">Direct Message</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <select
                    value={newMessageForm.priority}
                    onChange={(e) => setNewMessageForm({ ...newMessageForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
                <input
                  type="text"
                  required
                  value={newMessageForm.subject}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                  placeholder="Brief description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
                <textarea
                  required
                  value={newMessageForm.body}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, body: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary min-h-[140px] resize-none"
                  placeholder="Describe your issue or questionâ€¦"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewMessage(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Send size={15} />
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
