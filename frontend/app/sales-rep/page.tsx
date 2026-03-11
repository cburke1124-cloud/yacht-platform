'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Users, TrendingUp, Eye, MessageSquare, BarChart3,
  BookOpen, ChevronRight, X, Link2, Plus, Monitor, Copy, ExternalLink,
  Handshake, UserPlus, Activity, Check, ChevronDown,
} from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import ReactMarkdown from 'react-markdown';

/* --- Types ---------------------------------------------------- */

interface DealerStats {
  dealer_id: number;
  dealer_name: string;
  subscription_tier: string;
  total_listings: number;
  active_listings: number;
  total_views: number;
  total_inquiries: number;
  joined_date: string;
}

interface AnalyticsData {
  total_dealers: number;
  active_dealers: number;
  monthly_revenue: number;
  monthly_commission: number;
  dealers: DealerStats[];
  affiliate?: {
    code: string;
    referral_link: string;
    commission_rate: number;
    referred_signups: number;
  };
}

interface SalesDeal {
  id: number;
  name: string;
  code: string;
  target_email?: string;
  free_days: number;
  discount_type?: string;
  discount_value?: number;
  fixed_monthly_price?: number;
  term_months?: number;
  lifetime: boolean;
  active: boolean;
  usage_count: number;
}

interface DocItem {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  content: string;
  updated_at: string | null;
}

interface DemoAccount {
  exists: boolean;
  id?: number;
  email?: string;
  company_name?: string;
  listings?: number;
}

type Tab = 'overview' | 'deals' | 'dealers' | 'register' | 'demo' | 'resources';

/* --- Sidebar nav items ---------------------------------------- */
const NAV_ITEMS: { key: Tab; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'deals', label: 'Deals & Links', icon: Handshake },
  { key: 'dealers', label: 'My Dealers', icon: Users },
  { key: 'register', label: 'Register Broker', icon: UserPlus },
  { key: 'demo', label: 'Demo Portal', icon: Monitor },
  { key: 'resources', label: 'Resources', icon: BookOpen },
];

/* --- Component ------------------------------------------------ */

export default function SalesRepDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDealer, setSelectedDealer] = useState<DealerStats | null>(null);
  const [deals, setDeals] = useState<SalesDeal[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocItem | null>(null);
  const [demo, setDemo] = useState<DemoAccount | null>(null);
  const [showDealModal, setShowDealModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copiedText, setCopiedText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dealForm, setDealForm] = useState({
    name: '',
    code: '',
    target_email: '',
    free_days: 0,
    discount_type: 'percentage',
    discount_value: 0,
    fixed_monthly_price: '',
    term_months: '',
    lifetime: false,
    notes: '',
  });
  const [brokerForm, setBrokerForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    subscription_tier: 'basic',
  });
  const [brokerResult, setBrokerResult] = useState<any>(null);
  const [brokerSubmitting, setBrokerSubmitting] = useState(false);

  useEffect(() => { checkAuth(); }, []);

  /* --- Data fetchers ------------------------------------------ */

  const fetchAnalytics = async (token: string) => {
    try {
      const r = await fetch(apiUrl('/sales-rep/analytics'), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setAnalytics(await r.json());
    } catch (e) { console.error('Failed to fetch analytics:', e); }
  };

  const fetchDeals = async (token: string) => {
    try {
      const r = await fetch(apiUrl('/sales-rep/deals'), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setDeals(Array.isArray(d) ? d : []); }
    } catch (e) { console.error('Failed to fetch deals:', e); }
  };

  const fetchDocs = async (token: string) => {
    try {
      const r = await fetch(apiUrl('/sales-rep/docs'), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setDocs(Array.isArray(d) ? d : []); }
    } catch (e) { console.error('Failed to fetch docs:', e); }
  };

  const fetchDemo = async (token: string) => {
    try {
      const r = await fetch(apiUrl('/sales-rep/demo-account'), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setDemo(await r.json());
    } catch (e) { console.error('Failed to fetch demo:', e); }
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const r = await fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Not authenticated');
      const userData = await r.json();
      if (userData.user_type !== 'salesman') { alert('Sales rep access required'); router.push('/'); return; }
      setUser(userData);
      await Promise.all([fetchAnalytics(token), fetchDeals(token), fetchDocs(token), fetchDemo(token)]);
    } catch (e) { console.error('Auth check failed:', e); localStorage.removeItem('token'); router.push('/login'); }
    finally { setLoading(false); }
  };

  /* --- Actions ------------------------------------------------ */

  const copyToClipboard = async (text: string, label?: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(label || text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const createDeal = async () => {
    if (!dealForm.name.trim()) { alert('Deal name is required'); return; }
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(apiUrl('/sales-rep/deals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...dealForm,
          free_days: Number(dealForm.free_days || 0),
          discount_value: dealForm.discount_value === 0 ? null : Number(dealForm.discount_value),
          fixed_monthly_price: dealForm.fixed_monthly_price === '' ? null : Number(dealForm.fixed_monthly_price),
          term_months: dealForm.term_months === '' ? null : Number(dealForm.term_months),
        }),
      });
      if (r.ok) {
        alert('Deal created successfully');
        setShowDealModal(false);
        setDealForm({ name: '', code: '', target_email: '', free_days: 0, discount_type: 'percentage', discount_value: 0, fixed_monthly_price: '', term_months: '', lifetime: false, notes: '' });
        if (token) await fetchDeals(token);
      } else { const e = await r.json(); alert(e.detail || 'Failed to create deal'); }
    } catch (e) { console.error('Failed to create deal:', e); alert('Failed to create deal'); }
  };

  const registerBroker = async () => {
    if (!brokerForm.email.trim()) { alert('Email is required'); return; }
    if (!brokerForm.company_name.trim() && !brokerForm.first_name.trim()) {
      alert('Company name or contact name is required'); return;
    }
    setBrokerSubmitting(true);
    setBrokerResult(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(apiUrl('/sales-rep/register-broker'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(brokerForm),
      });
      const result = await r.json();
      if (r.ok) {
        setBrokerResult(result);
        if (token) await fetchAnalytics(token);
      } else {
        alert(result.detail || 'Failed to register broker');
      }
    } catch (e) { console.error('Failed to register broker:', e); alert('Failed to register broker'); }
    finally { setBrokerSubmitting(false); }
  };

  /* --- Helpers ------------------------------------------------ */

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'ultimate': return 'bg-secondary text-white';
      case 'pro': return 'bg-purple-100 text-purple-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      case 'plus': return 'bg-blue-100 text-blue-800';
      case 'basic': return 'bg-sky-100 text-sky-800';
      case 'trial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierPrice = (tier: string) => {
    const prices: Record<string, number> = { free: 0, basic: 29, plus: 59, pro: 99, premium: 99, trial: 0 };
    return prices[tier] ?? 0;
  };

  const getTierCommission = (tier: string) => {
    if (tier === 'ultimate') return 'Custom';
    const price = getTierPrice(tier);
    return price > 0 ? `$${(price * 0.10).toFixed(2)}/mo` : '$0.00/mo';
  };

  const affiliateLink = analytics?.affiliate ? `${typeof window !== 'undefined' ? window.location.origin : ''}${analytics.affiliate.referral_link}` : '';

  const dealSignupLink = (code: string) =>
    analytics?.affiliate?.code ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?user_type=dealer&ref=${encodeURIComponent(analytics.affiliate.code)}&deal=${encodeURIComponent(code)}` : '';

  /* --- Loading ------------------------------------------------ */

  if (loading) {
    return (
      <div className="min-h-screen section-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  /* --- Render ------------------------------------------------- */

  return (
    <div className="min-h-screen section-light flex">
      {/* ===== SIDEBAR (below main navbar) ===== */}
      <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-secondary text-white z-30 transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-56' : 'w-16'}`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
          {sidebarOpen && <span className="text-lg font-bold tracking-tight">Sales Hub</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto p-1.5 rounded hover:bg-white/10 transition-colors"
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-90' : '-rotate-90'}`} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-white/15 text-white border-l-[3px] border-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white border-l-[3px] border-transparent'
              }`}
              title={label}
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* User info at bottom */}
        <div className="border-t border-white/10 px-4 py-3 shrink-0">
          {sidebarOpen ? (
            <div>
              <p className="text-sm font-medium truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-white/50 truncate">{user?.email}</p>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {user?.first_name?.[0] || 'S'}
            </div>
          )}
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-16'}`}>
        {/* Copied Toast */}
        {copiedText && (
          <div className="fixed top-20 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
            <Check size={14} /> Copied!
          </div>
        )}

        <main className="max-w-6xl mx-auto px-6 py-8">

          {/* ====== TAB: OVERVIEW ====== */}
          {activeTab === 'overview' && (
            <>
              {/* Welcome */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-secondary">Welcome back, {user?.first_name}!</h2>
                <p className="text-dark/70 mt-1">Track your dealers, commission earnings, and pipeline at a glance.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {[
                  { label: 'Total Dealers', value: analytics?.total_dealers || 0, icon: Users, bg: 'bg-blue-50', ic: 'text-blue-600' },
                  { label: 'Active Dealers', value: analytics?.active_dealers || 0, icon: TrendingUp, bg: 'bg-green-50', ic: 'text-green-600' },
                  { label: 'Monthly Commission', value: `$${analytics?.monthly_commission?.toFixed(2) || '0.00'}`, icon: DollarSign, bg: 'bg-primary/10', ic: 'text-primary' },
                  { label: 'Total Revenue', value: `$${analytics?.monthly_revenue?.toFixed(2) || '0.00'}`, icon: DollarSign, bg: 'bg-amber-50', ic: 'text-amber-600' },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 ${s.bg} rounded-lg`}><s.icon className={s.ic} size={22} /></div>
                      <div>
                        <p className="text-dark/60 text-xs font-medium uppercase tracking-wide">{s.label}</p>
                        <p className={`text-2xl font-bold ${s.ic}`}>{s.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Commission Banner */}
              <div className="bg-gradient-to-r from-primary to-secondary rounded-xl shadow-lg p-6 mb-8 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-white/70 text-sm font-medium mb-1">Your Monthly Commission</p>
                    <h3 className="text-3xl font-bold">
                      ${analytics?.monthly_commission?.toFixed(2) || '0.00'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-white/70 text-sm">Commission Rate</p>
                    <p className="text-xl font-semibold">{analytics?.affiliate?.commission_rate || 10}%</p>
                  </div>
                </div>
                <p className="text-white/60 text-sm mt-3">You earn {analytics?.affiliate?.commission_rate || 10}% recurring commission on all active dealer subscriptions.</p>
              </div>

              {/* Recent Dealers + Referral Quick Copy */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* Quick Referral */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2"><Link2 size={16} /> Your Referral Link</h4>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-mono text-primary flex-1 break-all truncate">{affiliateLink || 'Loading...'}</p>
                    <button onClick={() => copyToClipboard(affiliateLink, 'referral-link')} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 shrink-0 flex items-center gap-1">
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                  <p className="text-xs text-dark/50 mt-2">Referral code: <span className="font-mono">{analytics?.affiliate?.code || '\u2014'}</span> &middot; {analytics?.affiliate?.referred_signups || 0} signups</p>
                </div>

                {/* Recent Dealers */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2"><Activity size={16} /> Recent Dealers</h4>
                  {analytics && analytics.dealers.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.dealers.slice(0, 4).map((d) => (
                        <div key={d.dealer_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-secondary">{d.dealer_name}</p>
                            <p className="text-xs text-dark/50">{new Date(d.joined_date).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${getTierColor(d.subscription_tier)}`}>{d.subscription_tier}</span>
                        </div>
                      ))}
                      {analytics.dealers.length > 4 && (
                        <button onClick={() => setActiveTab('dealers')} className="text-primary text-xs font-medium mt-1">View all {analytics.dealers.length} dealers &rarr;</button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-dark/50">No dealers yet. Share your referral link or register a broker to get started.</p>
                  )}
                </div>
              </div>

              {/* Tips */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                <h4 className="font-semibold text-secondary mb-3">Quick Tips</h4>
                <ul className="text-sm text-dark space-y-2">
                  <li>&#8226; Share your <strong>referral link</strong> for self-serve signups credited to you automatically</li>
                  <li>&#8226; Create <strong>custom deals</strong> with free trial days, discounts, or fixed pricing for prospects</li>
                  <li>&#8226; Use <strong>Register Broker</strong> to manually sign up a broker and hand them their credentials</li>
                  <li>&#8226; Use the <strong>Demo Portal</strong> to walk prospects through the platform live</li>
                  <li>&#8226; Help clients upgrade Basic &rarr; Plus &rarr; Pro for higher commissions</li>
                  <li>&#8226; Refer large brokerages to the <strong>Ultimate</strong> tier &mdash; commission negotiated directly</li>
                </ul>
              </div>
            </>
          )}

          {/* ====== TAB: DEALS & LINKS ====== */}
          {activeTab === 'deals' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-secondary">Deals &amp; Referral Links</h2>
                  <p className="text-dark/70 mt-1">Share your link or create custom deals for prospects.</p>
                </div>
                <button onClick={() => setShowDealModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                  <Plus size={16} /> New Deal
                </button>
              </div>

              {/* Affiliate Link Card */}
              <div className="bg-white rounded-xl shadow-sm border border-primary/20 p-6 mb-6">
                <h3 className="text-lg font-semibold text-secondary mb-2">Your Affiliate Link</h3>
                <p className="text-sm text-dark/70 mb-1">Share this link for self-serve dealer signups credited to you.</p>
                <p className="text-xs text-dark/50 mb-3">Referral code: <span className="font-mono">{analytics?.affiliate?.code || '\u2014'}</span></p>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-mono text-primary flex-1 break-all">{affiliateLink || 'Loading...'}</p>
                  <button onClick={() => copyToClipboard(affiliateLink, 'referral-link')} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 shrink-0 flex items-center gap-1">
                    <Copy size={12} /> Copy
                  </button>
                </div>
              </div>

              {/* Deals Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-secondary">Your Deals</h3>
                  <span className="text-sm text-dark/50">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deal</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terms</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signup Link</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {deals.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-dark/50">
                            <Handshake size={40} className="mx-auto mb-3 text-gray-300" />
                            <p className="mb-2">No deals created yet</p>
                            <button onClick={() => setShowDealModal(true)} className="text-primary font-medium text-sm hover:text-primary/80">Create your first deal</button>
                          </td>
                        </tr>
                      ) : deals.map((deal) => (
                        <tr key={deal.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-secondary">{deal.name}</div>
                            <div className="text-xs text-dark/60">{deal.target_email || 'General offer'}</div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm">{deal.code}</td>
                          <td className="px-6 py-4 text-sm text-dark/80">
                            {deal.fixed_monthly_price != null ? `Fixed $${deal.fixed_monthly_price}/mo` : deal.discount_type ? `${deal.discount_value || 0}${deal.discount_type === 'percentage' ? '%' : '$'} off` : 'Custom'}
                            {deal.free_days ? ` + ${deal.free_days} free days` : ''}
                          </td>
                          <td className="px-6 py-4">
                            {dealSignupLink(deal.code) ? (
                              <button onClick={() => copyToClipboard(dealSignupLink(deal.code), deal.code)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                                <Copy size={12} /> Copy signup link
                              </button>
                            ) : <span className="text-xs text-dark/40">Unavailable</span>}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-primary">{deal.usage_count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ====== TAB: MY DEALERS ====== */}
          {activeTab === 'dealers' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-secondary">My Dealers</h2>
                  <p className="text-dark/70 mt-1">All dealers assigned or referred by you.</p>
                </div>
                <button onClick={() => setActiveTab('register')} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
                  <UserPlus size={16} /> Register New Broker
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dealer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listings</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {!analytics || analytics.dealers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center text-dark/50">
                            <Users size={48} className="mx-auto mb-4 text-gray-300" />
                            <p className="text-lg mb-2">No dealers yet</p>
                            <p className="text-sm mb-4">Share your referral link or register a broker to get started</p>
                            <div className="flex gap-3 justify-center">
                              <button onClick={() => setActiveTab('deals')} className="text-primary font-medium text-sm hover:text-primary/80">Go to Deals &amp; Links</button>
                              <span className="text-dark/30">|</span>
                              <button onClick={() => setActiveTab('register')} className="text-primary font-medium text-sm hover:text-primary/80">Register a Broker</button>
                            </div>
                          </td>
                        </tr>
                      ) : analytics.dealers.map((dealer) => (
                        <tr key={dealer.dealer_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-secondary">{dealer.dealer_name}</div>
                            <div className="text-sm text-dark/60">Joined {new Date(dealer.joined_date).toLocaleDateString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getTierColor(dealer.subscription_tier)}`}>{dealer.subscription_tier}</span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="font-semibold text-secondary">{dealer.active_listings} active</div>
                            <div className="text-dark/60">{dealer.total_listings} total</div>
                          </td>
                          <td className="px-6 py-4 text-sm space-y-1">
                            <div className="flex items-center gap-2"><Eye size={14} className="text-gray-400" />{dealer.total_views.toLocaleString()} views</div>
                            <div className="flex items-center gap-2"><MessageSquare size={14} className="text-gray-400" />{dealer.total_inquiries} inquiries</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-primary">{getTierCommission(dealer.subscription_tier)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <button onClick={() => setSelectedDealer(dealer)} className="text-primary hover:text-primary/90 text-sm font-medium flex items-center gap-1">
                              <BarChart3 size={16} /> Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ====== TAB: REGISTER BROKER ====== */}
          {activeTab === 'register' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-secondary">Register a New Broker</h2>
                <p className="text-dark/70 mt-1">Manually sign up a broker. They&apos;ll be automatically assigned to you and credited to your referral account.</p>
              </div>

              <div className="grid lg:grid-cols-5 gap-8">
                {/* Form */}
                <div className="lg:col-span-3">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-secondary mb-5">Broker Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-dark/70 mb-1">Email Address *</label>
                        <input
                          type="email"
                          placeholder="broker@example.com"
                          value={brokerForm.email}
                          onChange={(e) => setBrokerForm({ ...brokerForm, email: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-dark/70 mb-1">First Name</label>
                          <input
                            type="text"
                            placeholder="John"
                            value={brokerForm.first_name}
                            onChange={(e) => setBrokerForm({ ...brokerForm, first_name: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-dark/70 mb-1">Last Name</label>
                          <input
                            type="text"
                            placeholder="Smith"
                            value={brokerForm.last_name}
                            onChange={(e) => setBrokerForm({ ...brokerForm, last_name: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark/70 mb-1">Company / Brokerage Name *</label>
                        <input
                          type="text"
                          placeholder="Oceanside Yacht Brokerage"
                          value={brokerForm.company_name}
                          onChange={(e) => setBrokerForm({ ...brokerForm, company_name: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark/70 mb-1">Phone</label>
                        <input
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          value={brokerForm.phone}
                          onChange={(e) => setBrokerForm({ ...brokerForm, phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark/70 mb-1">Subscription Tier</label>
                        <select
                          value={brokerForm.subscription_tier}
                          onChange={(e) => setBrokerForm({ ...brokerForm, subscription_tier: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none bg-white"
                        >
                          <option value="basic">Basic — $29/mo</option>
                          <option value="plus">Plus — $59/mo</option>
                          <option value="pro">Pro — $99/mo</option>
                          <option value="ultimate">Ultimate — Custom Pricing</option>
                        </select>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={registerBroker}
                          disabled={brokerSubmitting}
                          className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {brokerSubmitting ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Registering...</>
                          ) : (
                            <><UserPlus size={16} /> Register Broker</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info / Result panel */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Success result */}
                  {brokerResult && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Check size={18} className="text-green-600" />
                        <h4 className="font-semibold text-green-800">Broker Registered!</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-green-700 font-medium">Email:</span>
                          <span className="ml-2 text-green-900">{brokerResult.email}</span>
                        </div>
                        {brokerResult.company_name && (
                          <div>
                            <span className="text-green-700 font-medium">Company:</span>
                            <span className="ml-2 text-green-900">{brokerResult.company_name}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-green-700 font-medium">Tier:</span>
                          <span className="ml-2 text-green-900 capitalize">{brokerResult.subscription_tier}</span>
                        </div>
                        <div className="pt-2 border-t border-green-200 mt-2">
                          <span className="text-green-700 font-medium">Temporary Password:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-sm bg-white px-2 py-1 rounded border border-green-200 text-green-900 font-mono">{brokerResult.temp_password}</code>
                            <button
                              onClick={() => copyToClipboard(brokerResult.temp_password, 'password')}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="Copy password"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          <p className="text-xs text-green-600 mt-2">Share these credentials with the broker. They should change their password on first login.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setBrokerResult(null);
                          setBrokerForm({ email: '', first_name: '', last_name: '', phone: '', company_name: '', subscription_tier: 'basic' });
                        }}
                        className="mt-4 text-sm text-green-700 font-medium hover:text-green-900"
                      >
                        Register another broker &rarr;
                      </button>
                    </div>
                  )}

                  {/* How it works */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h4 className="font-semibold text-secondary mb-3">How It Works</h4>
                    <div className="space-y-3">
                      {[
                        { step: '1', text: 'Fill in the broker\'s details and pick a tier' },
                        { step: '2', text: 'A temporary password is auto-generated' },
                        { step: '3', text: 'The broker is assigned to you with your referral code' },
                        { step: '4', text: 'Share the credentials — they can log in and start listing' },
                        { step: '5', text: 'You earn commission from their subscription automatically' },
                      ].map(({ step, text }) => (
                        <div key={step} className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{step}</div>
                          <p className="text-sm text-dark/70">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Commission info */}
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-5">
                    <h4 className="font-semibold text-secondary mb-2 text-sm">Commission Rates</h4>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-dark/60">Basic ($29/mo)</span><span className="font-semibold text-primary">$2.90/mo</span></div>
                      <div className="flex justify-between"><span className="text-dark/60">Plus ($59/mo)</span><span className="font-semibold text-primary">$5.90/mo</span></div>
                      <div className="flex justify-between"><span className="text-dark/60">Pro ($99/mo)</span><span className="font-semibold text-primary">$9.90/mo</span></div>
                      <div className="flex justify-between"><span className="text-dark/60">Ultimate (Custom)</span><span className="font-semibold text-primary">Negotiated</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ====== TAB: DEMO PORTAL ====== */}
          {activeTab === 'demo' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-secondary">Demo Portal</h2>
                <p className="text-dark/70 mt-1">Use your demo dealer account to walk prospects through the full YachtVersal experience.</p>
              </div>

              {demo?.exists ? (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm font-semibold text-green-700">Demo Account Active</span>
                        </div>
                        <h3 className="text-xl font-bold text-secondary">{demo.company_name || 'Demo Brokerage'}</h3>
                        <p className="text-sm text-dark/60 mt-1">Email: <span className="font-mono">{demo.email}</span></p>
                        <p className="text-sm text-dark/60">Listings: <span className="font-semibold">{demo.listings || 0} pre-loaded</span></p>
                      </div>
                      <a href="/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
                        <ExternalLink size={14} /> Open Demo Dashboard
                      </a>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="font-semibold text-secondary mb-4">Demo Walkthrough Guide</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { step: '1', title: 'Listings Tour', desc: 'Show the pre-loaded yacht listings. Edit one to show the 40+ spec fields, photo gallery, and AI text import.' },
                        { step: '2', title: 'Search & Discovery', desc: 'Open the public search page. Demo the AI-powered natural language search and advanced filters.' },
                        { step: '3', title: 'Lead Management', desc: 'Show the inquiry pipeline with lead scoring, notes, and stage progression from New to Won.' },
                        { step: '4', title: 'CRM & Webhooks', desc: 'Demonstrate the 6 CRM integrations (HubSpot, GoHighLevel, etc.) and custom webhook delivery.' },
                        { step: '5', title: 'Analytics & Media', desc: 'Walk through the analytics dashboard and media library with auto image/video optimization.' },
                        { step: '6', title: 'Team & Billing', desc: 'Show team member management with granular permissions, and Stripe billing flow.' },
                      ].map(({ step, title, desc }) => (
                        <div key={step} className="border border-gray-100 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{step}</div>
                            <div>
                              <h4 className="font-semibold text-secondary text-sm">{title}</h4>
                              <p className="text-xs text-dark/60 mt-1">{desc}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <Monitor size={56} className="mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold text-secondary mb-2">Demo Account Not Set Up</h3>
                  <p className="text-dark/60 mb-6 max-w-md mx-auto">
                    Your demo dealer account hasn&apos;t been created yet. Contact your admin to provision a demo account
                    pre-loaded with sample yacht listings.
                  </p>
                  <button onClick={() => router.push('/messages')} className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
                    Message Admin
                  </button>
                </div>
              )}
            </>
          )}

          {/* ====== TAB: RESOURCES ====== */}
          {activeTab === 'resources' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-secondary">Sales Resources &amp; Documentation</h2>
                <p className="text-dark/70 mt-1">Guides, training materials, and reference docs to help you sell YachtVersal.</p>
              </div>

              {docs.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-dark/50">
                  <BookOpen size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-lg mb-2">No documentation available yet</p>
                  <p className="text-sm">Ask your admin to publish sales resources.</p>
                </div>
              ) : (
                <>
                  {Object.entries(
                    docs.reduce<Record<string, DocItem[]>>((acc, doc) => {
                      const cat = doc.category || 'General';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(doc);
                      return acc;
                    }, {})
                  ).map(([category, catDocs]) => (
                    <div key={category} className="mb-8">
                      <h3 className="text-lg font-semibold text-secondary mb-3 capitalize">{category.replace(/_/g, ' ')}</h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {catDocs.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => setActiveDoc(doc)}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-left hover:shadow-md transition-shadow hover:border-primary/30"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-base font-semibold text-secondary">{doc.title}</h4>
                                {doc.description && <p className="text-sm text-dark/60 mt-1 line-clamp-2">{doc.description}</p>}
                                {doc.updated_at && <p className="text-xs text-dark/40 mt-2">Updated {new Date(doc.updated_at).toLocaleDateString()}</p>}
                              </div>
                              <ChevronRight size={18} className="text-gray-400 shrink-0 mt-1" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* === MODALS === */}

      {/* Dealer Detail */}
      {selectedDealer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-secondary">{selectedDealer.dealer_name}</h2>
              <button onClick={() => setSelectedDealer(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-sm text-primary font-medium mb-1">Subscription</p>
                  <p className="text-2xl font-bold text-primary capitalize">{selectedDealer.subscription_tier}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-amber-600 font-medium mb-1">Your Commission</p>
                  <p className="text-2xl font-bold text-amber-700">{getTierCommission(selectedDealer.subscription_tier)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium mb-1">Listings</p>
                  <p className="text-2xl font-bold text-green-900">{selectedDealer.active_listings} <span className="text-sm font-normal text-green-700">active / {selectedDealer.total_listings} total</span></p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium mb-1">Performance</p>
                  <p className="text-lg font-bold text-blue-900">{selectedDealer.total_views.toLocaleString()} views</p>
                  <p className="text-sm text-blue-700">{selectedDealer.total_inquiries} inquiries</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => router.push(`/messages?contact=${selectedDealer.dealer_id}`)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Send Message</button>
                <button onClick={() => setSelectedDealer(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Deal */}
      {showDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold text-secondary">Create Dealer Deal</h3>
              <button onClick={() => setShowDealModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" placeholder="Deal name *" value={dealForm.name} onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Deal code (auto if blank)" value={dealForm.code} onChange={(e) => setDealForm({ ...dealForm, code: e.target.value.toUpperCase() })} className="w-full px-4 py-2 border rounded-lg" />
                <input type="number" placeholder="Free days" value={dealForm.free_days} onChange={(e) => setDealForm({ ...dealForm, free_days: Number(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <input type="email" placeholder="Target dealer email (optional)" value={dealForm.target_email} onChange={(e) => setDealForm({ ...dealForm, target_email: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <select value={dealForm.discount_type} onChange={(e) => setDealForm({ ...dealForm, discount_type: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                  <option value="percentage">Percentage Off</option>
                  <option value="fixed">Fixed Amount Off</option>
                </select>
                <input type="number" placeholder="Discount value" value={dealForm.discount_value} onChange={(e) => setDealForm({ ...dealForm, discount_value: Number(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Fixed monthly price" value={dealForm.fixed_monthly_price} onChange={(e) => setDealForm({ ...dealForm, fixed_monthly_price: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                <input type="number" placeholder="Term months" value={dealForm.term_months} onChange={(e) => setDealForm({ ...dealForm, term_months: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowDealModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button onClick={createDeal} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">Create Deal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doc Viewer */}
      {activeDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8">
            <div className="p-6 border-b flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase text-primary/70 tracking-wide">{activeDoc.category?.replace(/_/g, ' ')}</span>
                <h2 className="text-2xl font-bold text-secondary mt-0.5">{activeDoc.title}</h2>
                {activeDoc.description && <p className="text-sm text-dark/60 mt-1">{activeDoc.description}</p>}
              </div>
              <button onClick={() => setActiveDoc(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={20} /></button>
            </div>
            <div className="p-6">
              <div className="prose prose-sm max-w-none text-dark/80">
                <ReactMarkdown>{activeDoc.content || 'No content available.'}</ReactMarkdown>
              </div>
              {activeDoc.updated_at && <p className="text-xs text-dark/40 mt-6 border-t pt-3">Last updated: {new Date(activeDoc.updated_at).toLocaleDateString()}</p>}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setActiveDoc(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
