'use client';

import { useState } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import {
  HelpCircle, BookOpen, MessageSquare, ChevronDown, ChevronUp,
  PlayCircle, CheckCircle, Send, Loader2, AlertCircle,
  BarChart3, Image, Users, Star, CreditCard, Settings,
  Building2, Key, Archive, Mail, FileText, Upload,
} from 'lucide-react';

interface HelpCenterProps {
  userType: 'dealer' | 'team_member' | 'admin';
  onOpenOnboarding: () => void;
  onNavigate?: (tab: string) => void;
}

type HelpTab = 'getting-started' | 'faq' | 'contact';

interface FaqItem {
  question: string;
  answer: string;
}

// ── FAQ content ──────────────────────────────────────────────────────────────

const COMMON_FAQS: FaqItem[] = [
  {
    question: 'How does the inquiries and messaging system work?',
    answer:
      'All buyer inquiries and direct messages appear in your Inquiries tab in the sidebar. Each inquiry opens a thread where you can reply — buyers receive your response by email automatically. A blue dot on an inquiry means it is unread; once you open it the dot clears.',
  },
  {
    question: 'How do I reply to a message or inquiry?',
    answer:
      'Open the Inquiries tab, click on any message to expand the thread, type your reply in the text box at the bottom, and click Send. The buyer receives your reply by email instantly.',
  },
  {
    question: 'How do I update my account settings?',
    answer:
      'Click the Account tab in the sidebar. From there you can update your display name, email address, phone number, and notification preferences.',
  },
  {
    question: 'How do I change my notification preferences?',
    answer:
      'Go to the Account tab and open the Preferences section. You can configure email, SMS, and in-app notifications independently for new inquiries, new messages, and billing alerts.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. All data is encrypted in transit (TLS 1.2+) and at rest. We follow industry-standard security practices and do not sell or share your personal information with third parties.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'Use the "Contact Support" tab on this page. Describe your issue and our team will respond within one business day.',
  },
];

const BROKER_FAQS: FaqItem[] = [
  {
    question: 'How do I add a new listing?',
    answer:
      'Go to the My Listings tab and click the blue "+" button. Fill in the listing details — title, price, year, length, location, and description — then upload photos. You can save as a draft or publish immediately.',
  },
  {
    question: 'How do I feature a listing?',
    answer:
      'In the My Listings tab, click the star icon on any listing to feature it. You can also manage placements and durations from the Featured tab. Featured listings appear at the top of search results on public pages.',
  },
  {
    question: 'How do I invite team members?',
    answer:
      'Go to the Team tab and click "Invite Team Member." Enter the person\'s email and assign their permissions. They will receive an email invitation with instructions to set up their account.',
  },
  {
    question: 'What permissions can I grant to team members?',
    answer:
      'You can grant access to: creating and editing listings, managing the media gallery, viewing analytics, managing the CRM, handling inquiries, and managing the team itself. Each permission can be toggled on or off independently.',
  },
  {
    question: 'How does billing work?',
    answer:
      'Visit the Billing tab to view your current plan, update your payment method, and download invoices. Subscription fees are charged monthly. If a payment lapses, your listings are suspended until the account is brought current.',
  },
  {
    question: 'How do I bulk import listings?',
    answer:
      'Open the Bulk Tools tab to upload a CSV file using the provided template, or use the Getting Started guide to submit an import request and we will pull your existing listings from another site on your behalf.',
  },
  {
    question: 'How do I set up my broker profile?',
    answer:
      'Go to the Broker Page tab. Fill in your brokerage name, description, logo, and contact details. Enable co-brokering if you accept co-brokered deals. Toggle "Personal Profile" to add your individual photo, bio, and social media links.',
  },
  {
    question: 'How do I use the CRM?',
    answer:
      'The CRM tab lets you manage leads and contacts. Every inquiry automatically creates a lead that you can move through pipeline stages (New → Contacted → Qualified → Closed). You can add notes and track follow-up activity from each lead card.',
  },
  {
    question: 'How do I generate API keys?',
    answer:
      'Go to the API Keys tab to create access keys for programmatic access to your listings and inventory data. These keys can be used to integrate with your own website, a CMS, or third-party tools.',
  },
  {
    question: 'How do I use the Media Gallery?',
    answer:
      'The Media Gallery tab is a central library for all your uploaded images and videos. You can organize files into folders, drag-and-drop new uploads, and attach media directly to listings from here.',
  },
];

const TEAM_MEMBER_FAQS: FaqItem[] = [
  {
    question: 'What can I do as a team member?',
    answer:
      'As a team member you help manage your brokerage\'s listings, media, and buyer communications. Your broker controls exactly which features you can access — common tasks include managing listings, handling inquiries, uploading media, and tracking leads.',
  },
  {
    question: 'Why can\'t I see certain features?',
    answer:
      'Feature access is controlled by your broker. Tools like Bulk Import, Analytics, Team management, and the CRM are only visible when your broker has granted you the corresponding permission. Contact your broker if you need additional access.',
  },
  {
    question: 'How do I add or edit a listing?',
    answer:
      'If you have listing permissions, click the "+" button in the My Listings tab to create a new listing, or click the Edit (pencil) icon on an existing one to modify it. Draft listings are only visible to your team until published.',
  },
  {
    question: 'How do I upload media for a listing?',
    answer:
      'Go to the Media Gallery tab and drag-and-drop images or videos onto the upload area. You can also open any listing and use the inline uploader. Media can be organized into folders and linked to specific listings.',
  },
  {
    question: 'How do I handle buyer inquiries?',
    answer:
      'Open the Inquiries tab in the sidebar. Click any inquiry to view the buyer\'s details and message. Type your response in the text box at the bottom of the thread and click Send — the buyer receives it by email.',
  },
  {
    question: 'How do I update my salesman profile?',
    answer:
      'Go to the Broker Page tab. Toggle "Personal Profile" on to reveal your profile form. Add your photo, bio, certifications, and social media links. This info can appear publicly on your brokerage\'s listing pages.',
  },
  {
    question: 'Can I invite other team members?',
    answer:
      'Only team members with "Manage Team" permission can invite others. If you need to add a colleague and lack that permission, ask your broker to send the invitation.',
  },
];

// ── Getting Started step definitions ──────────────────────────────────────────

const BROKER_STEPS = [
  {
    icon: Building2,
    title: 'Set up your broker profile',
    description: 'Add your brokerage name, logo, and contact details so buyers know they can trust you.',
    action: 'Go to Broker Page tab',
    tabId: 'profile',
  },
  {
    icon: FileText,
    title: 'Add your first listing',
    description: 'Create a listing with photos, pricing, specs, and a detailed description.',
    action: 'Go to My Listings',
    tabId: 'listings',
  },
  {
    icon: Upload,
    title: 'Upload photos and media',
    description: 'High-quality photos dramatically increase inquiry rates. Use the Media Gallery to organize your files.',
    action: 'Go to Media Gallery',
    tabId: 'media',
  },
  {
    icon: Users,
    title: 'Invite your team',
    description: 'Add salespeople and assign them permissions to manage specific parts of your dashboard.',
    action: 'Go to Team',
    tabId: 'team',
  },
  {
    icon: Settings,
    title: 'Configure preferences',
    description: 'Set up your notification preferences so you never miss an inquiry or message.',
    action: 'Go to Account',
    tabId: 'account',
  },
];

const TEAM_STEPS = [
  {
    icon: BarChart3,
    title: 'Review your assigned listings',
    description: 'Familiarize yourself with your brokerage\'s current inventory in the My Listings tab.',
    action: 'Go to My Listings',
    tabId: 'listings',
  },
  {
    icon: Mail,
    title: 'Handle incoming inquiries',
    description: 'Monitor the Inquiries tab for new buyer messages and reply promptly to stay engaged.',
    action: 'Go to Inquiries',
    tabId: 'messages',
  },
  {
    icon: Upload,
    title: 'Upload and organize media',
    description: 'Keep listing photos current using the Media Gallery. Organize files into folders for easy access.',
    action: 'Go to Media Gallery',
    tabId: 'media',
  },
  {
    icon: Building2,
    title: 'Set up your personal profile',
    description: 'Add your own photo, bio, and social links to be featured on listing pages.',
    action: 'Go to Broker Page',
    tabId: 'profile',
  },
  {
    icon: Settings,
    title: 'Set your notification preferences',
    description: 'Configure how and when you are notified about new messages and listing activity.',
    action: 'Go to Account',
    tabId: 'account',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function HelpCenter({ userType, onOpenOnboarding, onNavigate }: HelpCenterProps) {
  const [activeHelpTab, setActiveHelpTab] = useState<HelpTab>('getting-started');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [form, setForm] = useState({ subject: '', category: 'general', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const isDealer = userType === 'dealer' || userType === 'admin';
  const faqs = [...COMMON_FAQS, ...(isDealer ? BROKER_FAQS : TEAM_MEMBER_FAQS)];
  const steps = isDealer ? BROKER_STEPS : TEAM_STEPS;

  const submitTicket = async () => {
    if (!form.subject.trim() || !form.body.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${apiUrl}/messages/support-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, priority: 'high' }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSubmitted(true);
      setForm({ subject: '', category: 'general', body: '' });
    } catch {
      setSubmitError('Unable to submit your ticket. Please try again or email support directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const helpTabs = [
    { id: 'getting-started' as HelpTab, label: 'Getting Started', icon: PlayCircle },
    { id: 'faq' as HelpTab, label: 'FAQ', icon: BookOpen },
    { id: 'contact' as HelpTab, label: 'Contact Support', icon: MessageSquare },
  ];

  return (
    <div className="space-y-4">
      {/* Header card with sub-tab nav */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-secondary">Help Center</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isDealer
                ? 'Guides, documentation, and support for managing your brokerage.'
                : 'Guides and support for your day-to-day tasks on the platform.'}
            </p>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex gap-1 border-b border-gray-100">
          {helpTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveHelpTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                  activeHelpTab === tab.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-500 hover:text-secondary hover:border-gray-300'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Getting Started ─────────────────────────────────────────────────── */}
      {activeHelpTab === 'getting-started' && (
        <div className="space-y-4">
          {/* Launch tour card */}
          <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-secondary">Interactive Setup Tour</h3>
              <p className="text-sm text-gray-500 mt-1">
                Walk through the platform step-by-step with an interactive guide that shows you exactly where to click and what to fill in.
              </p>
            </div>
            <button
              onClick={onOpenOnboarding}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <PlayCircle size={18} />
              Launch Tour
            </button>
          </div>

          {/* Quick-start checklist */}
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold text-secondary mb-4">Quick-Start Checklist</h3>
            <div className="space-y-4">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const clickable = !!(onNavigate && step.tabId);
                return (
                  <div
                    key={i}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => onNavigate!(step.tabId!) : undefined}
                    onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate!(step.tabId!); } : undefined}
                    className={`flex items-start gap-4 p-4 rounded-xl bg-soft transition-colors ${
                      clickable ? 'hover:bg-primary/10 cursor-pointer' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="text-primary" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <p className="font-semibold text-secondary text-sm">{step.title}</p>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 ml-7">{step.description}</p>
                      <p className="text-xs text-primary font-medium mt-1.5 ml-7">→ {step.action}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick reference */}
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold text-secondary mb-4">Dashboard Quick Reference</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(isDealer ? [
                { icon: BarChart3, label: 'My Listings', desc: 'Create, edit, and manage all your boat listings.' },
                { icon: Image, label: 'Media Gallery', desc: 'Central library for all uploaded photos and videos.' },
                { icon: Mail, label: 'Inquiries', desc: 'Buyer messages, lead threads, and replies.' },
                { icon: Star, label: 'Featured', desc: 'Purchase and manage featured placements.' },
                { icon: Archive, label: 'Bulk Tools', desc: 'CSV import/export and batch listing updates.' },
                { icon: Users, label: 'Team', desc: 'Invite team members and assign permissions.' },
                { icon: CreditCard, label: 'Billing', desc: 'Plan, payment method, and invoices.' },
                { icon: Building2, label: 'Broker Page', desc: 'Public brokerage profile and personal profile.' },
                { icon: Key, label: 'API Keys', desc: 'Programmatic access keys for integrations.' },
                { icon: Settings, label: 'Account', desc: 'Profile settings and notification preferences.' },
              ] : [
                { icon: BarChart3, label: 'My Listings', desc: 'View and manage listings you have access to.' },
                { icon: Image, label: 'Media Gallery', desc: 'Upload and organize listing photos and videos.' },
                { icon: Mail, label: 'Inquiries', desc: 'Buyer messages, lead threads, and replies.' },
                { icon: Building2, label: 'Broker Page', desc: 'Your personal profile and public bio.' },
                { icon: Settings, label: 'Account', desc: 'Profile settings and notification preferences.' },
              ]).map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-soft">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Icon className="text-primary" size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-secondary">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      {activeHelpTab === 'faq' && (
        <div className="glass-card p-6">
          <h3 className="text-base font-semibold text-secondary mb-1">
            Frequently Asked Questions
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            {isDealer ? 'Common questions for brokers and brokerage administrators.' : 'Common questions for team members.'}
          </p>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-soft transition-colors"
                >
                  <span className="font-medium text-secondary text-sm">{faq.question}</span>
                  {openFaqIndex === i
                    ? <ChevronUp size={16} className="flex-shrink-0 text-primary" />
                    : <ChevronDown size={16} className="flex-shrink-0 text-gray-400" />
                  }
                </button>
                {openFaqIndex === i && (
                  <div className="px-5 pb-4 bg-soft/50">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-sm text-secondary font-medium">Didn't find your answer?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Open the{' '}
              <button
                onClick={() => setActiveHelpTab('contact')}
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Contact Support
              </button>{' '}
              tab and our team will get back to you.
            </p>
          </div>
        </div>
      )}

      {/* ── Contact Support ─────────────────────────────────────────────────── */}
      {activeHelpTab === 'contact' && (
        <div className="glass-card p-6">
          <h3 className="text-base font-semibold text-secondary mb-1">Contact Support</h3>
          <p className="text-sm text-gray-500 mb-6">
            Submit a support ticket and our team will respond within one business day.
          </p>

          {submitted ? (
            <div className="flex flex-col items-center py-10 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="text-green-500" size={28} />
              </div>
              <p className="font-semibold text-secondary text-lg">Ticket submitted!</p>
              <p className="text-sm text-gray-500 max-w-sm">
                We've received your message and will respond within one business day. Check your email for a confirmation.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Submit another ticket
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-w-xl">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Brief summary of your issue"
                  maxLength={200}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-secondary bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-secondary bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                >
                  <option value="general">General</option>
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing</option>
                  <option value="listings">Listings</option>
                  <option value="account">Account</option>
                </select>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Message</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Describe your issue in detail. Include any steps to reproduce the problem, error messages you saw, or relevant listing IDs."
                  rows={6}
                  maxLength={4000}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-secondary bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{form.body.length}/4000</p>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {submitError}
                </div>
              )}

              <button
                onClick={submitTicket}
                disabled={submitting || !form.subject.trim() || !form.body.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {submitting ? 'Sending…' : 'Submit Ticket'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
