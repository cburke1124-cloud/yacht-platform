'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Mail, Clock, Search, User, Users, Paperclip, FileText, HelpCircle } from 'lucide-react';
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
  attachments?: Attachment[];
}

interface MessageDetail {
  message: Message;
  replies: Reply[];
}

interface MessageEntry {
  id: number;
  body: string;
  sender_name: string;
  is_from_buyer: boolean;
  created_at: string;
  attachments?: Attachment[];
}

interface Attachment {
  url: string;
  filename: string;
  content_type: string;
  size: number;
}

interface Inquiry {
  id: number;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  lead_stage: string;
  status: string;
  listing_title: string | null;
  created_at: string;
  message_id?: number | null;
  message_thread?: MessageEntry[];
}

export default function MessagingCenter({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<MessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'inquiry' | 'support_ticket' | 'inquiries'>('all');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [inquiryReplyText, setInquiryReplyText] = useState('');
  const [sendingInquiryReply, setSendingInquiryReply] = useState(false);
  const [sendError, setSendError] = useState('');

  // Attachment state
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
  const [inquiryAttachments, setInquiryAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const inquiryFileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [newMessageForm, setNewMessageForm] = useState({
    subject: '',
    body: '',
    message_type: 'support_ticket',
    priority: 'normal',
    category: 'general',
  });

  useEffect(() => {
    fetchInquiries();
    // Set up 30-second background polling for both lists
    pollRef.current = setInterval(() => {
      fetchMessagesSilent();
      fetchInquiriesSilent();
    }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filter === 'inquiries') {
      // already loaded on mount, refresh in case
      fetchInquiries();
    } else {
      fetchMessages();
    }
  }, [filter]);

  useEffect(() => {
    const el = threadEndRef.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedDetail, selectedInquiry?.message_thread?.length]);

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

  // Silent versions for background polling — don't trigger loading spinner
  const fetchMessagesSilent = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/messages'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMessages(await res.json());
    } catch {}
  };

  const fetchInquiriesSilent = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/inquiries'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.items ?? data);
      }
    } catch {}
  };

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/inquiries'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.items ?? data);
      }
    } catch (e) {
      console.error('Failed to fetch inquiries:', e);
    } finally {
      setLoading(false);
    }
  };

  const openInquiry = async (inq: Inquiry) => {
    setSelectedInquiry(inq);
    setSelectedDetail(null);
    setInquiryReplyText('');
    setSendError('');
    // Optimistically mark as read in the list immediately
    if (inq.status === 'new') {
      setInquiries(prev => prev.map(i => i.id === inq.id ? { ...i, status: 'read' } : i));
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/inquiries/${inq.id}`), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSelectedInquiry(prev => prev ? { ...prev, message_id: data.message_id, message_thread: data.message_thread ?? [], status: 'read' } : prev);
      }
    } catch (e) {
      console.error('Failed to load inquiry detail:', e);
    }
  };

  const sendInquiryReply = async () => {
    if (!selectedInquiry) return;
    if (!inquiryReplyText.trim() && inquiryAttachments.length === 0) return;
    setSendingInquiryReply(true);
    setSendError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/inquiries/${selectedInquiry.id}/reply`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: inquiryReplyText.trim(), attachments: inquiryAttachments }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedInquiry(prev => prev ? { ...prev, message_id: data.message_id, message_thread: data.message_thread ?? [] } : prev);
        setInquiryReplyText('');
        setInquiryAttachments([]);
      } else {
        const err = await res.json().catch(() => ({}));
        setSendError(err.detail ?? 'Failed to send. Please try again.');
      }
    } catch (e) {
      setSendError('Message failed to send. Please check your connection.');
      console.error('Failed to send inquiry reply:', e);
    } finally {
      setSendingInquiryReply(false);
    }
  };

  const openMessage = async (msg: Message) => {
    setLoadingDetail(true);
    setSelectedDetail(null);
    setSendError('');
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
    if (!selectedDetail) return;
    if (!replyText.trim() && replyAttachments.length === 0) return;
    setSending(true);
    setSendError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/messages/${selectedDetail.message.id}/reply`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: replyText, attachments: replyAttachments }),
      });
      if (res.ok) {
        setReplyText('');
        setReplyAttachments([]);
        // Reload detail to show new reply
        await openMessage(selectedDetail.message);
        setMessages((prev) =>
          prev.map((m) => (m.id === selectedDetail.message.id ? { ...m, status: 'replied' } : m))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        setSendError(err.detail ?? 'Failed to send. Please try again.');
      }
    } catch (e) {
      setSendError('Message failed to send. Please check your connection.');
      console.error('Failed to send reply:', e);
    } finally {
      setSending(false);
    }
  };

  const uploadAttachment = async (file: File, onDone: (att: Attachment) => void) => {
    setUploadingFile(true);
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(apiUrl('/messages/upload-attachment'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        onDone(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail ?? 'Upload failed');
      }
    } catch (e) {
      console.error('Attachment upload failed:', e);
    } finally {
      setUploadingFile(false);
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

  // Backend timestamps are naive UTC (no 'Z'); append it so JS parses correctly.
  const toUtc = (s: string) => new Date(s.includes('Z') || s.includes('+') ? s : s + 'Z');

  const formatDate = (dateString: string) => {
    const date = toUtc(dateString);
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

  const renderAttachments = (attachments: Attachment[] | undefined) => {
    if (!attachments?.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map((att, i) =>
          att.content_type.startsWith('image/') ? (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={att.url} alt={att.filename} className="max-w-[180px] max-h-[130px] rounded-lg object-cover border border-gray-200 hover:opacity-90 transition-opacity" />
            </a>
          ) : (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-primary hover:bg-gray-50 transition-colors max-w-[200px]">
              <FileText size={13} className="flex-shrink-0" />
              <span className="truncate">{att.filename}</span>
            </a>
          )
        )}
      </div>
    );
  };

  const AttachmentChips = ({ atts, onRemove }: { atts: Attachment[]; onRemove: (i: number) => void }) => (
    atts.length > 0 ? (
      <div className="flex flex-wrap gap-1.5 px-1 pt-1">
        {atts.map((att, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
            {att.content_type.startsWith('image/') ? att.filename : <><FileText size={11} /> {att.filename}</>}
            <button type="button" onClick={() => onRemove(i)} className="ml-0.5 text-gray-400 hover:text-red-500"><X size={11} /></button>
          </span>
        ))}
      </div>
    ) : null
  );

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gray-50'}>
      <div className={embedded ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
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
            <HelpCircle size={16} />
            Contact Support
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { id: 'all', label: 'All Messages', count: messages.length + inquiries.length },
            { id: 'inquiries', label: 'Inquiries', count: inquiries.length, icon: Users },
            { id: 'support_ticket', label: 'Support', count: messages.filter((m) => m.message_type === 'support_ticket').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilter(tab.id as typeof filter);
                setSelectedDetail(null);
                setSelectedInquiry(null);
              }}
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
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
              ) : filter === 'inquiries' ? (
                inquiries.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Users size={40} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No inquiries yet</p>
                  </div>
                ) : (
                  inquiries.map((inq) => (
                    <button
                      key={inq.id}
                      onClick={() => openInquiry(inq)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedInquiry?.id === inq.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${inq.status === 'new' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          <span className="text-sm font-semibold text-gray-900 truncate">{inq.sender_name}</span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatDate(inq.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 font-medium truncate ml-4">{inq.listing_title ?? 'General Inquiry'}</p>
                      <p className="text-xs text-gray-500 line-clamp-1 ml-4 mt-0.5">{inq.message}</p>
                      <div className="flex items-center gap-2 mt-1.5 ml-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">inquiry</span>
                        {inq.lead_stage && inq.lead_stage !== 'new' && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{inq.lead_stage}</span>
                        )}
                      </div>
                    </button>
                  ))
                )
              ) : (filter === 'all' && inquiries.length > 0 && filteredMessages.length === 0) || filter === 'all' ? (
                /* All tab: show inquiries first, then other messages */
                [...inquiries.map(inq => ({ _type: 'inquiry' as const, inq })),
                 ...filteredMessages.map(msg => ({ _type: 'message' as const, msg }))]
                  .filter(item => {
                    if (!searchQuery) return true;
                    if (item._type === 'inquiry') {
                      const i = item.inq;
                      return i.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             i.message?.toLowerCase().includes(searchQuery.toLowerCase());
                    } else {
                      const m = item.msg;
                      return m.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             m.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             m.sender_name?.toLowerCase().includes(searchQuery.toLowerCase());
                    }
                  })
                  .map(item =>
                    item._type === 'inquiry' ? (
                      <button
                        key={`inq-${item.inq.id}`}
                        onClick={() => openInquiry(item.inq)}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                          selectedInquiry?.id === item.inq.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${item.inq.status === 'new' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                            <span className="text-sm font-semibold text-gray-900 truncate">{item.inq.sender_name}</span>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatDate(item.inq.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 font-medium truncate ml-4">{item.inq.listing_title ?? 'General Inquiry'}</p>
                        <p className="text-xs text-gray-500 line-clamp-1 ml-4 mt-0.5">{item.inq.message}</p>
                        <span className="ml-4 mt-1.5 inline-block px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">inquiry</span>
                      </button>
                    ) : (
                      <button
                        key={`msg-${item.msg.id}`}
                        onClick={() => { openMessage(item.msg); setSelectedInquiry(null); }}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                          selectedDetail?.message.id === item.msg.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${statusDot[item.msg.status] ?? 'bg-gray-300'}`} />
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {item.msg.sender_name || item.msg.sender_email || 'Unknown'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatDate(item.msg.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 font-medium truncate ml-4">{item.msg.subject}</p>
                        <p className="text-xs text-gray-500 line-clamp-1 ml-4 mt-0.5">{item.msg.body}</p>
                        <div className="flex items-center gap-2 mt-2 ml-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor[item.msg.message_type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {item.msg.message_type.replace('_', ' ')}
                          </span>
                        </div>
                      </button>
                    )
                  )
              ) : filteredMessages.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Mail size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No messages found</p>
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => { openMessage(msg); setSelectedInquiry(null); }}
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

          {/* ── Right: conversation thread ── */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : selectedInquiry ? (
              <>
                {/* Inquiry thread header */}
                <div className="px-6 py-4 border-b flex items-start justify-between gap-4 bg-secondary">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-white truncate">{selectedInquiry.sender_name}</h2>
                    <p className="text-sm text-white/70 mt-0.5">{selectedInquiry.listing_title ?? 'General Inquiry'}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/60 flex-wrap">
                      <a href={`mailto:${selectedInquiry.sender_email}`} className="hover:text-white">{selectedInquiry.sender_email}</a>
                      {selectedInquiry.sender_phone && (
                        <a href={`tel:${selectedInquiry.sender_phone}`} className="hover:text-white">{selectedInquiry.sender_phone}</a>
                      )}
                      <span>{toUtc(selectedInquiry.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedInquiry.lead_stage && selectedInquiry.lead_stage !== 'new' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white">
                        {selectedInquiry.lead_stage}
                      </span>
                    )}
                    <button onClick={() => setSelectedInquiry(null)} className="text-white/50 hover:text-white ml-1">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Inquiry message thread */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {(selectedInquiry.message_thread && selectedInquiry.message_thread.length > 0) ? (
                    selectedInquiry.message_thread.map((entry) => (
                      <div key={entry.id} className={`flex gap-3 ${entry.is_from_buyer ? '' : 'flex-row-reverse'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${entry.is_from_buyer ? 'bg-gray-200' : 'bg-primary text-white'}`}>
                          <User size={14} className={entry.is_from_buyer ? 'text-gray-500' : 'text-white'} />
                        </div>
                        <div className={`flex-1 min-w-0 ${entry.is_from_buyer ? '' : 'items-end flex flex-col'}`}>
                          <div className={`flex items-baseline gap-2 mb-1 ${entry.is_from_buyer ? '' : 'flex-row-reverse'}`}>
                            <span className="text-sm font-semibold text-gray-800">{entry.sender_name}</span>
                            <span className="text-xs text-gray-400">{toUtc(entry.created_at).toLocaleString()}</span>
                          </div>
                          <div className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap border max-w-[85%] ${
                            entry.is_from_buyer
                              ? 'bg-gray-50 text-gray-700 border-gray-100 rounded-tl-sm'
                              : 'bg-primary text-white border-primary/20 rounded-tr-sm'
                          }`}>
                            {entry.body}
                          </div>
                          {renderAttachments(entry.attachments)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={14} className="text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800 mb-1">{selectedInquiry.sender_name}</p>
                        <div className="bg-gray-50 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
                          {selectedInquiry.message}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={threadEndRef} />
                </div>

                {/* Inquiry reply box */}
                <div className="px-6 py-4 border-t bg-gray-50">
                  <AttachmentChips atts={inquiryAttachments} onRemove={(i) => setInquiryAttachments(prev => prev.filter((_, idx) => idx !== i))} />
                  {sendError && <p className="text-xs text-red-600 mt-1 mb-0.5">{sendError}</p>}
                  <div className="flex gap-3 items-end mt-2">
                    <input ref={inquiryFileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadAttachment(f, (att) => setInquiryAttachments(prev => [...prev, att]));
                        e.target.value = '';
                      }}
                    />
                    <textarea
                      value={inquiryReplyText}
                      onChange={(e) => setInquiryReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendInquiryReply(); }}
                      rows={3}
                      placeholder={`Reply to ${selectedInquiry.sender_name}… (Ctrl+Enter to send)`}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => inquiryFileRef.current?.click()}
                      disabled={uploadingFile}
                      className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-primary hover:border-primary transition-colors flex-shrink-0 disabled:opacity-50"
                      title="Attach image or PDF"
                    >
                      <Paperclip size={15} />
                    </button>
                    <button
                      onClick={sendInquiryReply}
                      disabled={sendingInquiryReply || (!inquiryReplyText.trim() && inquiryAttachments.length === 0)}
                      className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 font-medium flex items-center gap-2 text-sm disabled:opacity-50 flex-shrink-0"
                    >
                      <Send size={15} />
                      {sendingInquiryReply ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              </>
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
                        {toUtc(selectedDetail.message.created_at).toLocaleString()}
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
                        <span className="text-xs text-gray-400">{toUtc(selectedDetail.message.created_at).toLocaleString()}</span>
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
                            <span className="text-xs text-gray-400">{toUtc(reply.created_at).toLocaleString()}</span>
                          </div>
                          <div className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap border max-w-[85%] ${
                            isMine
                              ? 'bg-primary text-white border-primary/20 rounded-tr-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-100 rounded-tl-sm'
                          }`}>
                            {reply.body}
                          </div>
                          {renderAttachments(reply.attachments)}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {/* Reply box */}
                {selectedDetail.message.status !== 'closed' && (
                  <div className="px-6 py-4 border-t bg-gray-50">
                    <AttachmentChips atts={replyAttachments} onRemove={(i) => setReplyAttachments(prev => prev.filter((_, idx) => idx !== i))} />
                    {sendError && <p className="text-xs text-red-600 mt-1 mb-0.5">{sendError}</p>}
                    <div className="flex gap-3 items-end mt-2">
                      <input ref={replyFileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadAttachment(f, (att) => setReplyAttachments(prev => [...prev, att]));
                          e.target.value = '';
                        }}
                      />
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                        rows={3}
                        placeholder="Type your reply… (Ctrl+Enter to send)"
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => replyFileRef.current?.click()}
                        disabled={uploadingFile}
                        className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-primary hover:border-primary transition-colors flex-shrink-0 disabled:opacity-50"
                        title="Attach image or PDF"
                      >
                        <Paperclip size={15} />
                      </button>
                      <button
                        onClick={sendReply}
                        disabled={sending || (!replyText.trim() && replyAttachments.length === 0)}
                        className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 font-medium flex items-center gap-2 text-sm disabled:opacity-50 flex-shrink-0"
                      >
                        <Send size={15} />
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contact Support Modal */}
      {showNewMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <HelpCircle size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-secondary">Contact Support</h2>
                  <p className="text-xs text-gray-500">We typically respond within 24 hours</p>
                </div>
              </div>
              <button onClick={() => setShowNewMessage(false)} className="text-gray-400 hover:text-gray-600 ml-4">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={createNewMessage} className="p-6 space-y-4">
              <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                Your message will go directly to the YachtVersal support team.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
                <input
                  type="text"
                  required
                  value={newMessageForm.subject}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                  placeholder="Brief description of your question or issue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
                <textarea
                  required
                  value={newMessageForm.body}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, body: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary min-h-[140px] resize-none"
                  placeholder="How can we help you?"
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
                  Send to Support
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
