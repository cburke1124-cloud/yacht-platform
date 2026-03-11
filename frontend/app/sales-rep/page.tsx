'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Users, TrendingUp, Eye, MessageSquare, BarChart3,
  BookOpen, ChevronRight, X, Link2, Plus, Monitor, Copy, ExternalLink,
  Handshake,
} from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

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

type Tab = 'overview' | 'deals' | 'dealers' | 'demo' | 'resources';

/* --- Tab definitions ------------------------------------------ */
const TAB_ITEMS: { key: Tab; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'deals', label: 'Deals & Links', icon: Handshake },
  { key: 'dealers', label: 'My Dealers', icon: Users },
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

  const handleLogout = () => { localStorage.removeItem('token'); router.push('/'); };

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
    <div className="min-h-screen section-light">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-primary">YachtVersal</h1>
              <span className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full font-semibold">Sales Rep</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/messages')} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm">Messages</button>
              <span className="text-sm text-gray-600">{user?.first_name} {user?.last_name}</span>
              <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">Logout</button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="bg-white border-b shadow-sm sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Copied Toast */}
      {copiedText && (
        <div className="fixed top-20 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-pulse">
          Copied!
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ====== TAB: OVERVIEW ====== */}
        {activeTab === 'overview' && (
          <>
            {/* Welcome */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-secondary">Welcome back, {user?.first_name}!</h2>
              <p className="text-dark/70 mt-1">Track your dealers, commission earnings, and pipeline at a glance.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Total Dealers', value: analytics?.total_dealers || 0, icon: Users, color: 'primary', textColor: 'text-secondary' },
                { label: 'Active Dealers', value: analytics?.active_dealers || 0, icon: TrendingUp, color: 'green', textColor: 'text-green-600' },
                { label: 'Monthly Commission', value: `$${analytics?.monthly_commission?.toFixed(2) || '0.00'}`, icon: DollarSign, color: 'primary', textColor: 'text-primary' },
                { label: 'Total Revenue', value: `$${analytics?.monthly_revenue?.toFixed(2) || '0.00'}`, icon: DollarSign, color: 'accent', textColor: 'text-accent' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 bg-${s.color}/10 rounded-lg`}><s.icon className={s.textColor} size={24} /></div>
                    <div>
                      <p className="text-dark/70 text-sm">{s.label}</p>
                      <p className={`text-3xl font-bold ${s.textColor}`}>{s.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Commission Banner */}
            <div className="bg-gradient-to-r from-primary to-secondary rounded-lg shadow-lg p-6 mb-8 text-white">
              <h3 className="text-2xl font-bold mb-2">
                ${analytics?.monthly_commission?.toFixed(2) || '0.00'} / month
              </h3>
              <p className="text-white/80">You earn 10% recurring commission on all active dealer subscriptions</p>
            </div>

            {/* Quick-Link Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <button onClick={() => setActiveTab('deals')} className="bg-white rounded-lg shadow-md p-5 text-left hover:shadow-lg transition-shadow border border-gray-100 hover:border-primary/30 group">
                <Link2 className="text-primary mb-2" size={22} />
                <h4 className="font-semibold text-secondary group-hover:text-primary">Referral Link</h4>
                <p className="text-xs text-dark/60 mt-1">Copy your link or create custom deals</p>
              </button>
              <button onClick={() => setActiveTab('dealers')} className="bg-white rounded-lg shadow-md p-5 text-left hover:shadow-lg transition-shadow border border-gray-100 hover:border-primary/30 group">
                <Users className="text-primary mb-2" size={22} />
                <h4 className="font-semibold text-secondary group-hover:text-primary">My Dealers</h4>
                <p className="text-xs text-dark/60 mt-1">{analytics?.total_dealers || 0} dealers, {analytics?.active_dealers || 0} active</p>
              </button>
              <button onClick={() => setActiveTab('demo')} className="bg-white rounded-lg shadow-md p-5 text-left hover:shadow-lg transition-shadow border border-gray-100 hover:border-primary/30 group">
                <Monitor className="text-primary mb-2" size={22} />
                <h4 className="font-semibold text-secondary group-hover:text-primary">Demo Portal</h4>
                <p className="text-xs text-dark/60 mt-1">{demo?.exists ? 'Access your demo account' : 'Request a demo account'}</p>
              </button>
              <button onClick={() => setActiveTab('resources')} className="bg-white rounded-lg shadow-md p-5 text-left hover:shadow-lg transition-shadow border border-gray-100 hover:border-primary/30 group">
                <BookOpen className="text-primary mb-2" size={22} />
                <h4 className="font-semibold text-secondary group-hover:text-primary">Resources</h4>
                <p className="text-xs text-dark/60 mt-1">{docs.length} guides available</p>
              </button>
            </div>

            {/* Tips */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
              <h4 className="font-semibold text-secondary mb-3">Quick Tips</h4>
              <ul className="text-sm text-dark space-y-2">
                <li>&#8226; Share your <strong>referral link</strong> for self-serve signups that credit to you automatically</li>
                <li>&#8226; Create <strong>custom deals</strong> with free trial days, discounts, or fixed pricing for specific prospects</li>
                <li>&#8226; Use the <strong>Demo Portal</strong> to walk prospects through the platform live</li>
                <li>&#8226; Help clients upgrade from Basic &#8594; Plus &#8594; Pro for higher commissions</li>
                <li>&#8226; Refer large brokerages to the <strong>Ultimate</strong> tier &#8212; commission negotiated directly</li>
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
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-primary/20">
              <h3 className="text-lg font-semibold text-secondary mb-2">Your Affiliate Link</h3>
              <p className="text-sm text-dark/70 mb-1">Share this link for self-serve dealer signups credited to you.</p>
              <p className="text-xs text-dark/50 mb-3">Referral code: <span className="font-mono">{analytics?.affiliate?.code || '\u2014'}</span></p>
              <div className="flex items-center gap-2 bg-section-light rounded-lg p-3">
                <p className="text-sm font-mono text-primary flex-1 break-all">{affiliateLink || 'Loading...'}</p>
                <button onClick={() => copyToClipboard(affiliateLink, 'referral-link')} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 shrink-0 flex items-center gap-1">
                  <Copy size={12} /> Copy
                </button>
              </div>
            </div>

            {/* Deals Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-5 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-secondary">Your Deals</h3>
                <span className="text-sm text-dark/50">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-section-light">
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
                      <tr key={deal.id} className="hover:bg-section-light">
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
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-secondary">My Dealers</h2>
              <p className="text-dark/70 mt-1">All dealers assigned or referred by you.</p>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-section-light">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-dark/70 uppercase">Dealer</th>
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
                          <p className="text-sm mb-4">Share your referral link or create a deal to get started</p>
                          <button onClick={() => setActiveTab('deals')} className="text-primary font-medium text-sm hover:text-primary/80">Go to Deals &amp; Links</button>
                        </td>
                      </tr>
                    ) : analytics.dealers.map((dealer) => (
                      <tr key={dealer.dealer_id} className="hover:bg-section-light">
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

        {/* ====== TAB: DEMO PORTAL ====== */}
        {activeTab === 'demo' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-secondary">Demo Portal</h2>
              <p className="text-dark/70 mt-1">Use your demo dealer account to walk prospects through the full YachtVersal experience.</p>
            </div>

            {demo?.exists ? (
              <div className="space-y-6">
                {/* Demo Account Card */}
                <div className="bg-white rounded-xl shadow-md p-6 border border-green-200">
                  <div className="flex items-start justify-between">
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

                {/* Demo Tips */}
                <div className="bg-white rounded-xl shadow-md p-6">
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
                      <div key={step} className="border rounded-lg p-4">
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
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
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
              <div className="bg-white rounded-lg shadow-md p-12 text-center text-dark/50">
                <BookOpen size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-lg mb-2">No documentation available yet</p>
                <p className="text-sm">Ask your admin to publish sales resources.</p>
              </div>
            ) : (
              <>
                {/* Group by category */}
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
                          className="bg-white rounded-lg shadow-md p-5 text-left hover:shadow-lg transition-shadow border border-gray-100 hover:border-primary/30"
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
                <div className="bg-accent/10 rounded-lg p-4">
                  <p className="text-sm text-accent font-medium mb-1">Your Commission</p>
                  <p className="text-2xl font-bold text-accent">{getTierCommission(selectedDealer.subscription_tier)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium mb-1">Listings</p>
                  <p className="text-2xl font-bold text-green-900">{selectedDealer.active_listings} <span className="text-sm font-normal text-green-700">active / {selectedDealer.total_listings} total</span></p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-sm text-yellow-600 font-medium mb-1">Performance</p>
                  <p className="text-lg font-bold text-yellow-900">{selectedDealer.total_views.toLocaleString()} views</p>
                  <p className="text-sm text-yellow-700">{selectedDealer.total_inquiries} inquiries</p>
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
              <div className="prose prose-sm max-w-none text-dark/80" style={{ whiteSpace: 'pre-wrap' }}>{activeDoc.content || 'No content available.'}</div>
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
