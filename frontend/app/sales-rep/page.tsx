'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Users, TrendingUp, Eye, MessageSquare, BarChart3,
  BookOpen, ChevronRight, X, Link2, Plus, Monitor, Copy, ExternalLink,
  Handshake, UserPlus, Activity, Check, ChevronDown, Star, Shield,
  Zap, Crown,
} from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import ReactMarkdown from 'react-markdown';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

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

interface TierData {
  name: string;
  price: number;
  listings: number;
  images_per_listing: number;
  videos_per_listing: number;
  features: string[];
  trial_days: number;
  active: boolean;
  is_custom_pricing?: boolean;
}

type Tab = 'overview' | 'deals' | 'dealers' | 'register' | 'demo' | 'resources';

/* ================================================================== */
/*  Sidebar tabs                                                       */
/* ================================================================== */

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview',  label: 'Overview',         icon: BarChart3 },
  { id: 'deals',     label: 'Deals & Links',    icon: Handshake },
  { id: 'dealers',   label: 'My Dealers',       icon: Users },
  { id: 'register',  label: 'Register Broker',  icon: UserPlus },
  { id: 'demo',      label: 'Demo Portal',      icon: Monitor },
  { id: 'resources', label: 'Resources',        icon: BookOpen },
];

const TIER_ICONS: Record<string, any> = {
  basic: Shield,
  plus: Star,
  pro: Zap,
  ultimate: Crown,
};

const TIER_ACCENT: Record<string, string> = {
  basic:    'border-sky-300    bg-sky-50     text-sky-700',
  plus:     'border-blue-400   bg-blue-50    text-blue-700',
  pro:      'border-purple-400 bg-purple-50  text-purple-700',
  ultimate: 'border-amber-400  bg-amber-50   text-amber-700',
};

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function SalesRepDashboard() {
  const router = useRouter();

  /* --- state ---------------------------------------------------- */
  const [user, setUser]                     = useState<any>(null);
  const [analytics, setAnalytics]           = useState<AnalyticsData | null>(null);
  const [loading, setLoading]               = useState(true);
  const [selectedDealer, setSelectedDealer] = useState<DealerStats | null>(null);
  const [deals, setDeals]                   = useState<SalesDeal[]>([]);
  const [docs, setDocs]                     = useState<DocItem[]>([]);
  const [activeDoc, setActiveDoc]           = useState<DocItem | null>(null);
  const [demo, setDemo]                     = useState<DemoAccount | null>(null);
  const [showDealModal, setShowDealModal]   = useState(false);
  const [activeTab, setActiveTab]           = useState<Tab>('overview');
  const [copiedText, setCopiedText]         = useState('');
  const [tiers, setTiers]                   = useState<Record<string, TierData>>({});

  const [dealForm, setDealForm] = useState({
    name: '', code: '', target_email: '', free_days: 0,
    discount_type: 'percentage', discount_value: 0,
    fixed_monthly_price: '', term_months: '', lifetime: false, notes: '',
  });

  const [brokerForm, setBrokerForm] = useState({
    email: '', first_name: '', last_name: '', phone: '',
    company_name: '', subscription_tier: 'basic',
    custom_price: '',
    free_days: '',
    discount_type: 'percentage',
    discount_value: '',
    applied_deal_id: null as number | null,
    always_free: false,
  });
  const [brokerResult, setBrokerResult]       = useState<any>(null);
  const [brokerSubmitting, setBrokerSubmitting] = useState(false);

  useEffect(() => { checkAuth(); }, []);

  const disableDiscounts = brokerForm.subscription_tier === 'ultimate' && brokerForm.custom_price !== '';
  const disablePricingFields = disableDiscounts || brokerForm.always_free;

  /* --- data fetchers -------------------------------------------- */

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

  const fetchTiers = async (token: string) => {
    try {
      const r = await fetch(apiUrl('/sales-rep/broker-tiers'), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setTiers(d.tiers || {}); }
    } catch (e) { console.error('Failed to fetch tiers:', e); }
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
      await Promise.all([
        fetchAnalytics(token), fetchDeals(token),
        fetchDocs(token), fetchDemo(token), fetchTiers(token),
      ]);
    } catch (e) { console.error('Auth check failed:', e); localStorage.removeItem('token'); router.push('/login'); }
    finally { setLoading(false); }
  };

  /* --- actions -------------------------------------------------- */

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
        body: JSON.stringify({
          ...brokerForm,
          custom_price: brokerForm.custom_price === '' ? null : Number(brokerForm.custom_price),
          free_days: brokerForm.free_days === '' ? null : Number(brokerForm.free_days),
          discount_value: brokerForm.discount_value === '' ? null : Number(brokerForm.discount_value),
        }),
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

  /* --- helpers -------------------------------------------------- */

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'ultimate': return 'bg-secondary text-white';
      case 'pro':      return 'bg-purple-100 text-purple-800';
      case 'premium':  return 'bg-purple-100 text-purple-800';
      case 'plus':     return 'bg-blue-100 text-blue-800';
      case 'basic':    return 'bg-sky-100 text-sky-800';
      case 'trial':    return 'bg-yellow-100 text-yellow-800';
      default:         return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierPrice = (tier: string) => {
    if (tiers[tier]) return tiers[tier].price;
    const prices: Record<string, number> = { free: 0, basic: 29, plus: 59, pro: 99, premium: 99, trial: 0 };
    return prices[tier] ?? 0;
  };

  const getTierCommission = (tier: string) => {
    if (tier === 'ultimate') return 'Custom';
    const price = getTierPrice(tier);
    return price > 0 ? `$${(price * 0.10).toFixed(2)}/mo` : '$0.00/mo';
  };

  const affiliateLink = analytics?.affiliate
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${analytics.affiliate.referral_link}`
    : '';

  const dealSignupLink = (code: string) =>
    analytics?.affiliate?.code
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?user_type=dealer&ref=${encodeURIComponent(analytics.affiliate.code)}&deal=${encodeURIComponent(code)}`
      : '';

  const tierOrder = ['basic', 'plus', 'pro', 'ultimate'];
  const orderedTiers = tierOrder
    .filter((k) => tiers[k])
    .map((k) => ({ key: k, ...tiers[k] }));

  /* --- loading -------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-secondary">Sales Dashboard</h1>
          <p className="text-sm text-dark/60">Manage your brokers, deals, and pipeline</p>
        </div>

        {/* Grid: sidebar + content */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">

          {/* ===== SIDEBAR ===== */}
          <aside className="bg-white rounded-xl border border-gray-200 p-3 h-fit lg:sticky lg:top-6">
            <nav className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      activeTab === tab.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ===== CONTENT ===== */}
          <section className="min-w-0">

            {/* Copied Toast */}
            {copiedText && (
              <div className="fixed top-20 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
                <Check size={14} /> Copied!
              </div>
            )}

{/* ====== TAB: OVERVIEW ========================================= */}
{activeTab === 'overview' && (
  <>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-secondary">Welcome back, {user?.first_name}!</h2>
      <p className="text-dark/70 mt-1">Track your dealers, commission earnings, and pipeline.</p>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Total Dealers',      value: analytics?.total_dealers || 0,                                   icon: Users,      bg: 'bg-blue-50',    ic: 'text-blue-600' },
        { label: 'Active Dealers',     value: analytics?.active_dealers || 0,                                  icon: TrendingUp, bg: 'bg-green-50',   ic: 'text-green-600' },
        { label: 'Monthly Commission', value: `$${analytics?.monthly_commission?.toFixed(2) || '0.00'}`,       icon: DollarSign, bg: 'bg-primary/10', ic: 'text-primary' },
        { label: 'Total Revenue',      value: `$${analytics?.monthly_revenue?.toFixed(2) || '0.00'}`,          icon: DollarSign, bg: 'bg-amber-50',   ic: 'text-amber-600' },
      ].map((s, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-4">
            <div className={`p-3 ${s.bg} rounded-lg`}><s.icon className={s.ic} size={20} /></div>
            <div>
              <p className="text-dark/60 text-xs font-medium uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold ${s.ic}`}>{s.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Commission Banner */}
    <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-6 mb-6 text-white">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-white/70 text-sm font-medium mb-1">Monthly Commission</p>
          <h3 className="text-3xl font-bold">${analytics?.monthly_commission?.toFixed(2) || '0.00'}</h3>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-sm">Commission Rate</p>
          <p className="text-xl font-semibold">{analytics?.affiliate?.commission_rate || 10}%</p>
        </div>
      </div>
    </div>

    {/* Referral + Recent Dealers */}
    <div className="grid lg:grid-cols-2 gap-6 mb-6">
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2"><Link2 size={16} /> Referral Link</h4>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
          <p className="text-sm font-mono text-primary flex-1 break-all truncate">{affiliateLink || 'Loading...'}</p>
          <button onClick={() => copyToClipboard(affiliateLink, 'ref')} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 shrink-0 flex items-center gap-1"><Copy size={12} /> Copy</button>
        </div>
        <p className="text-xs text-dark/50 mt-2">Code: <span className="font-mono">{analytics?.affiliate?.code || '\u2014'}</span> &middot; {analytics?.affiliate?.referred_signups || 0} signups</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
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
          <p className="text-sm text-dark/50">No dealers yet. Share your referral link or register a broker.</p>
        )}
      </div>
    </div>

    {/* Tips */}
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
      <h4 className="font-semibold text-secondary mb-3">Quick Tips</h4>
      <ul className="text-sm text-dark space-y-1.5">
        <li>&#8226; Share your <strong>referral link</strong> for self-serve signups credited to you</li>
        <li>&#8226; Create <strong>custom deals</strong> with free trial days, discounts, or fixed pricing</li>
        <li>&#8226; Use <strong>Register Broker</strong> to manually sign up a broker</li>
        <li>&#8226; Use the <strong>Demo Portal</strong> to walk prospects through the platform live</li>
        <li>&#8226; Help clients upgrade Basic &rarr; Plus &rarr; Pro for higher commissions</li>
        <li>&#8226; Refer large brokerages to <strong>Ultimate</strong> — commission negotiated directly</li>
      </ul>
    </div>
  </>
)}

{/* ====== TAB: DEALS & LINKS ==================================== */}
{activeTab === 'deals' && (
  <>
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-secondary">Deals &amp; Referral Links</h2>
        <p className="text-dark/70 mt-1">Share your link or create custom deals for prospects.</p>
      </div>
    </div>

    {/* Affiliate Link */}
    <div className="bg-white rounded-xl border border-primary/20 p-5 mb-6">
      <h3 className="font-semibold text-secondary mb-2">Your Affiliate Link</h3>
      <p className="text-sm text-dark/70 mb-1">Self-serve dealer signups credited to you.</p>
      <p className="text-xs text-dark/50 mb-3">Code: <span className="font-mono">{analytics?.affiliate?.code || '\u2014'}</span></p>
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
        <p className="text-sm font-mono text-primary flex-1 break-all">{affiliateLink || 'Loading...'}</p>
        <button onClick={() => copyToClipboard(affiliateLink, 'ref')} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 shrink-0 flex items-center gap-1"><Copy size={12} /> Copy</button>
      </div>
    </div>

    {/* Deals Table */}
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-5 border-b flex items-center justify-between">
        <h3 className="font-semibold text-secondary">Your Deals</h3>
        <span className="text-sm text-dark/50">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deal</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terms</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signup Link</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {deals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-dark/50">
                  <Handshake size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="mb-2">No deals created yet</p>
                </td>
              </tr>
            ) : deals.map((deal) => (
              <tr key={deal.id} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div className="font-medium text-secondary">{deal.name}</div>
                  <div className="text-xs text-dark/60">{deal.target_email || 'General offer'}</div>
                </td>
                <td className="px-5 py-4 font-mono text-sm">{deal.code}</td>
                <td className="px-5 py-4 text-sm text-dark/80">
                  {deal.fixed_monthly_price != null ? `Fixed $${deal.fixed_monthly_price}/mo` : deal.discount_type ? `${deal.discount_value || 0}${deal.discount_type === 'percentage' ? '%' : '$'} off` : 'Custom'}
                  {deal.free_days ? ` + ${deal.free_days} free days` : ''}
                </td>
                <td className="px-5 py-4">
                  {dealSignupLink(deal.code) ? (
                    <button onClick={() => copyToClipboard(dealSignupLink(deal.code), deal.code)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><Copy size={12} /> Copy link</button>
                  ) : <span className="text-xs text-dark/40">Unavailable</span>}
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-primary">{deal.usage_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
)}

{/* ====== TAB: MY DEALERS ======================================= */}
{activeTab === 'dealers' && (
  <>
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-secondary">My Dealers</h2>
        <p className="text-dark/70 mt-1">All dealers assigned or referred by you.</p>
      </div>
      <button onClick={() => setActiveTab('register')} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
        <UserPlus size={16} /> Register Broker
      </button>
    </div>

    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dealer</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listings</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!analytics || analytics.dealers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-dark/50">
                  <Users size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg mb-2">No dealers yet</p>
                  <p className="text-sm mb-4">Share your referral link or register a broker</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => setActiveTab('deals')} className="text-primary font-medium text-sm hover:text-primary/80">Deals &amp; Links</button>
                    <span className="text-dark/30">|</span>
                    <button onClick={() => setActiveTab('register')} className="text-primary font-medium text-sm hover:text-primary/80">Register Broker</button>
                  </div>
                </td>
              </tr>
            ) : analytics.dealers.map((dealer) => (
              <tr key={dealer.dealer_id} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div className="font-medium text-secondary">{dealer.dealer_name}</div>
                  <div className="text-sm text-dark/60">Joined {new Date(dealer.joined_date).toLocaleDateString()}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getTierColor(dealer.subscription_tier)}`}>{dealer.subscription_tier}</span>
                </td>
                <td className="px-5 py-4 text-sm">
                  <div className="font-semibold text-secondary">{dealer.active_listings} active</div>
                  <div className="text-dark/60">{dealer.total_listings} total</div>
                </td>
                <td className="px-5 py-4 text-sm space-y-1">
                  <div className="flex items-center gap-2"><Eye size={14} className="text-gray-400" />{dealer.total_views.toLocaleString()} views</div>
                  <div className="flex items-center gap-2"><MessageSquare size={14} className="text-gray-400" />{dealer.total_inquiries} inquiries</div>
                </td>
                <td className="px-5 py-4">
                  <span className="font-semibold text-primary">{getTierCommission(dealer.subscription_tier)}</span>
                </td>
                <td className="px-5 py-4">
                  <button onClick={() => setSelectedDealer(dealer)} className="text-primary hover:text-primary/90 text-sm font-medium flex items-center gap-1"><BarChart3 size={16} /> Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
)}

{/* ====== TAB: REGISTER BROKER ================================== */}
{activeTab === 'register' && (
  <>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-secondary">Register a New Broker</h2>
      <p className="text-dark/70 mt-1">Manually sign up a broker — they&apos;ll be assigned to you with referral tracking.</p>
    </div>

    {/* Tier Cards — dynamic from backend */}
    {orderedTiers.length > 0 && (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {orderedTiers.map((t) => {
          const TierIcon = TIER_ICONS[t.key] || Shield;
          const accent = TIER_ACCENT[t.key] || 'border-gray-300 bg-gray-50 text-gray-700';
          const selected = brokerForm.subscription_tier === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setBrokerForm({ ...brokerForm, subscription_tier: t.key })}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                selected
                  ? `${accent} ring-2 ring-primary shadow-md`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <TierIcon size={18} className={selected ? '' : 'text-gray-400'} />
                <span className="font-bold text-secondary">{t.name}</span>
              </div>
              <div className="mb-3">
                {t.is_custom_pricing ? (
                  <span className="text-lg font-bold text-secondary">Custom Pricing</span>
                ) : (
                  <span className="text-lg font-bold text-secondary">${t.price}<span className="text-sm font-normal text-dark/50">/mo</span></span>
                )}
              </div>
              <div className="text-xs text-dark/60 space-y-1">
                <p className="font-medium text-dark/80 mb-1">{t.listings >= 999999 ? 'Unlimited' : t.listings} listings &middot; {t.images_per_listing >= 999999 ? '∞' : t.images_per_listing} images &middot; {t.videos_per_listing >= 999999 ? '∞' : t.videos_per_listing} videos</p>
                {t.trial_days > 0 && <p className="text-primary font-medium">{t.trial_days}-day free trial</p>}
              </div>
              <ul className="mt-3 space-y-1">
                {t.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-dark/70">
                    <Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {selected && (
                <div className="mt-3 text-xs font-semibold text-primary flex items-center gap-1"><Check size={12} /> Selected</div>
              )}
            </button>
          );
        })}
      </div>
    )}

    <div className="grid lg:grid-cols-5 gap-8">
      {/* Form */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-secondary mb-5">Broker Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Email Address *</label>
              <input type="email" placeholder="broker@example.com" value={brokerForm.email} onChange={(e) => setBrokerForm({ ...brokerForm, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark/70 mb-1">First Name</label>
                <input type="text" placeholder="John" value={brokerForm.first_name} onChange={(e) => setBrokerForm({ ...brokerForm, first_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark/70 mb-1">Last Name</label>
                <input type="text" placeholder="Smith" value={brokerForm.last_name} onChange={(e) => setBrokerForm({ ...brokerForm, last_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Company / Brokerage *</label>
              <input type="text" placeholder="Oceanside Yacht Brokerage" value={brokerForm.company_name} onChange={(e) => setBrokerForm({ ...brokerForm, company_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">Phone</label>
              <input type="tel" placeholder="+1 (555) 123-4567" value={brokerForm.phone} onChange={(e) => setBrokerForm({ ...brokerForm, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>

            {/* Deal / Discount options */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-900">Deals & Discounts</p>
                  <p className="text-xs text-blue-800/80">Apply a sales deal or set a custom trial/discount.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-blue-900">Apply deal</label>
                  <select
                    value={brokerForm.applied_deal_id ?? ''}
                    onChange={(e) => {
                      const selected = deals.find(d => d.id === Number(e.target.value));
                      if (!selected) {
                        setBrokerForm({ ...brokerForm, applied_deal_id: null });
                        return;
                      }
                      setBrokerForm({
                        ...brokerForm,
                        applied_deal_id: selected.id,
                        free_days: selected.free_days != null ? String(selected.free_days) : '',
                        discount_type: selected.discount_type || 'percentage',
                        discount_value: selected.discount_value != null ? String(selected.discount_value) : '',
                        // Avoid conflicting with custom Ultimate price; deals govern pricing/discounts
                        custom_price: brokerForm.subscription_tier === 'ultimate' ? '' : brokerForm.custom_price,
                      });
                    }}
                    className="px-3 py-2 text-sm border border-blue-200 rounded-md bg-white shadow-sm"
                    disabled={disablePricingFields}
                  >
                    <option value="">None</option>
                    {deals.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">Free Trial Days</label>
                  <input
                    type="number"
                    min="0"
                    value={brokerForm.free_days}
                    onChange={(e) => setBrokerForm({ ...brokerForm, free_days: e.target.value })}
                    className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-primary/30 text-sm"
                    disabled={disablePricingFields}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">Discount Type</label>
                  <select
                    value={brokerForm.discount_type}
                    onChange={(e) => setBrokerForm({ ...brokerForm, discount_type: e.target.value })}
                    className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-primary/30 text-sm"
                    disabled={disablePricingFields}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="amount">Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">Discount Value</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={brokerForm.discount_value}
                    onChange={(e) => setBrokerForm({ ...brokerForm, discount_value: e.target.value })}
                    className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-primary/30 text-sm"
                    disabled={disablePricingFields}
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-xs text-blue-800">For fixed-price deals, set the negotiated monthly price below.</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3">
              <input
                id="always-free"
                type="checkbox"
                checked={brokerForm.always_free}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setBrokerForm({
                    ...brokerForm,
                    always_free: checked,
                    applied_deal_id: checked ? null : brokerForm.applied_deal_id,
                    free_days: checked ? '' : brokerForm.free_days,
                    discount_value: checked ? '' : brokerForm.discount_value,
                    custom_price: checked ? '' : brokerForm.custom_price,
                  });
                }}
                className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <div className="space-y-1">
                <label htmlFor="always-free" className="text-sm font-semibold text-secondary block">Mark account as always free</label>
                <p className="text-xs text-dark/60">Bypass billing for this broker. No charges will be applied and pricing/discount fields are disabled.</p>
              </div>
            </div>
            
            {brokerForm.subscription_tier === 'ultimate' && (
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <Crown size={16} className="text-amber-600" />
                  <h4 className="font-bold text-amber-800 text-sm">Custom Ultimate Bundle</h4>
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Negotiated Monthly Price ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={brokerForm.custom_price || ''}
                    onChange={(e) => setBrokerForm({
                      ...brokerForm,
                      custom_price: e.target.value,
                      // clear conflicting deal/discount when custom price is set
                      applied_deal_id: brokerForm.subscription_tier === 'ultimate' ? null : brokerForm.applied_deal_id,
                      discount_value: brokerForm.subscription_tier === 'ultimate' ? '' : brokerForm.discount_value,
                    })}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500/30 outline-none text-sm bg-white text-amber-900"
                    disabled={brokerForm.always_free}
                  />
                  <p className="text-xs text-amber-700/70 mt-1">Set the recurring monthly price for this custom deal.</p>
                </div>
              </div>
            )}

            {/* Tier shown as read-only from cards above */}
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-dark/50 uppercase">Selected Tier</p>
                <p className="font-semibold text-secondary capitalize">{tiers[brokerForm.subscription_tier]?.name || brokerForm.subscription_tier}</p>
              </div>
              <p className="font-bold text-primary">
                {brokerForm.always_free
                  ? 'Always free'
                  : brokerForm.subscription_tier === 'ultimate' && brokerForm.custom_price
                  ? `$${Number(brokerForm.custom_price).toFixed(2)}/mo`
                  : tiers[brokerForm.subscription_tier]?.is_custom_pricing
                    ? 'Custom'
                    : `$${tiers[brokerForm.subscription_tier]?.price ?? 29}/mo`}
              </p>
            </div>
            <button onClick={registerBroker} disabled={brokerSubmitting}
              className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {brokerSubmitting ? (<><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Registering...</>) : (<><UserPlus size={16} /> Register Broker</>)}
            </button>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="lg:col-span-2 space-y-6">
        {/* Success result */}
        {brokerResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3"><Check size={18} className="text-green-600" /><h4 className="font-semibold text-green-800">Broker Registered!</h4></div>
            <div className="space-y-2 text-sm">
              <div><span className="text-green-700 font-medium">Email:</span> <span className="text-green-900">{brokerResult.email}</span></div>
              {brokerResult.company_name && <div><span className="text-green-700 font-medium">Company:</span> <span className="text-green-900">{brokerResult.company_name}</span></div>}
              <div><span className="text-green-700 font-medium">Tier:</span> <span className="text-green-900 capitalize">{brokerResult.subscription_tier}</span></div>
              <div className="pt-2 border-t border-green-200 mt-2">
                <span className="text-green-700 font-medium">Temporary Password:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-white px-2 py-1 rounded border border-green-200 text-green-900 font-mono">{brokerResult.temp_password}</code>
                  <button onClick={() => copyToClipboard(brokerResult.temp_password, 'pw')} className="p-1 text-green-600 hover:text-green-800"><Copy size={14} /></button>
                </div>
                <p className="text-xs text-green-600 mt-2">Share these credentials with the broker.</p>
              </div>
            </div>
            <button onClick={() => { setBrokerResult(null); setBrokerForm({ email: '', first_name: '', last_name: '', phone: '', company_name: '', subscription_tier: 'basic', custom_price: '', free_days: '', discount_type: 'percentage', discount_value: '', applied_deal_id: null }); }}
              className="mt-4 text-sm text-green-700 font-medium hover:text-green-900">Register another &rarr;</button>
          </div>
        )}

        {/* How it works */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h4 className="font-semibold text-secondary mb-3">How It Works</h4>
          <div className="space-y-3">
            {[
              'Fill in the broker\'s details and pick a tier',
              'A temporary password is auto-generated',
              'The broker is assigned to you with referral tracking',
              'Share the credentials — they can log in immediately',
              'You earn commission from their subscription',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                <p className="text-sm text-dark/70">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </>
)}

{/* ====== TAB: DEMO PORTAL ====================================== */}
{activeTab === 'demo' && (
  <>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-secondary">Demo Portal</h2>
      <p className="text-dark/70 mt-1">Walk prospects through the full YachtVersal experience.</p>
    </div>

    {demo?.exists ? (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-green-200 p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-green-700">Active</span>
              </div>
              <h3 className="text-xl font-bold text-secondary">{demo.company_name || 'Demo Brokerage'}</h3>
              <p className="text-sm text-dark/60 mt-1">Email: <span className="font-mono">{demo.email}</span></p>
              <p className="text-sm text-dark/60">Listings: <span className="font-semibold">{demo.listings || 0} pre-loaded</span></p>
            </div>
            <a href="/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"><ExternalLink size={14} /> Open Demo Dashboard</a>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-secondary mb-4">Demo Walkthrough</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { s: '1', t: 'Listings Tour',       d: 'Show pre-loaded yachts — 40+ spec fields, gallery, AI text import.' },
              { s: '2', t: 'Search & Discovery',  d: 'AI-powered natural language search and advanced filters.' },
              { s: '3', t: 'Lead Management',     d: 'Pipeline with lead scoring, notes, stage progression.' },
              { s: '4', t: 'CRM & Webhooks',      d: '6 CRM integrations (HubSpot, GoHighLevel, etc.).' },
              { s: '5', t: 'Analytics & Media',   d: 'Dashboard analytics and media library with optimisation.' },
              { s: '6', t: 'Team & Billing',      d: 'Team management with permissions and Stripe billing.' },
            ].map(({ s, t, d }) => (
              <div key={s} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{s}</div>
                  <div><h4 className="font-semibold text-secondary text-sm">{t}</h4><p className="text-xs text-dark/60 mt-1">{d}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <Monitor size={56} className="mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-secondary mb-2">Demo Account Not Set Up</h3>
        <p className="text-dark/60 mb-6 max-w-md mx-auto">Contact your admin to provision a demo account pre-loaded with sample yacht listings.</p>
        <button onClick={() => router.push('/messages')} className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">Message Admin</button>
      </div>
    )}
  </>
)}

{/* ====== TAB: RESOURCES ======================================== */}
{activeTab === 'resources' && (
  <>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-secondary">Sales Resources &amp; Documentation</h2>
      <p className="text-dark/70 mt-1">Guides and reference docs to help you sell YachtVersal.</p>
    </div>

    {docs.length === 0 ? (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-dark/50">
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
                <button key={doc.id} onClick={() => setActiveDoc(doc)}
                  className="bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-sm transition-shadow hover:border-primary/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-secondary">{doc.title}</h4>
                      {doc.description && <p className="text-xs text-dark/60 mt-1 line-clamp-2">{doc.description}</p>}
                      {doc.updated_at && <p className="text-xs text-dark/40 mt-2">Updated {new Date(doc.updated_at).toLocaleDateString()}</p>}
                    </div>
                    <ChevronRight size={16} className="text-gray-400 shrink-0 mt-0.5" />
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

          </section>
        </div>
      </div>

      {/* ============================================================= */}
      {/*  MODALS                                                        */}
      {/* ============================================================= */}

      {/* Dealer Detail */}
      {selectedDealer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-secondary">{selectedDealer.dealer_name}</h2>
              <button onClick={() => setSelectedDealer(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/10 rounded-lg p-4"><p className="text-sm text-primary font-medium mb-1">Subscription</p><p className="text-2xl font-bold text-primary capitalize">{selectedDealer.subscription_tier}</p></div>
                <div className="bg-amber-50 rounded-lg p-4"><p className="text-sm text-amber-600 font-medium mb-1">Your Commission</p><p className="text-2xl font-bold text-amber-700">{getTierCommission(selectedDealer.subscription_tier)}</p></div>
                <div className="bg-green-50 rounded-lg p-4"><p className="text-sm text-green-600 font-medium mb-1">Listings</p><p className="text-2xl font-bold text-green-900">{selectedDealer.active_listings} <span className="text-sm font-normal text-green-700">/ {selectedDealer.total_listings}</span></p></div>
                <div className="bg-blue-50 rounded-lg p-4"><p className="text-sm text-blue-600 font-medium mb-1">Performance</p><p className="text-lg font-bold text-blue-900">{selectedDealer.total_views.toLocaleString()} views</p><p className="text-sm text-blue-700">{selectedDealer.total_inquiries} inquiries</p></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => router.push(`/messages?contact=${selectedDealer.dealer_id}`)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Send Message</button>
                <button onClick={() => setSelectedDealer(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      {showDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold text-secondary">Create Deal</h3>
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
              <div className="prose prose-sm max-w-none text-dark/80"><ReactMarkdown>{activeDoc.content || 'No content available.'}</ReactMarkdown></div>
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
