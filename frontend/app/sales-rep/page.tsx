'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Users, TrendingUp, Mail, Eye, MessageSquare, BarChart3, BookOpen, ChevronRight, X } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

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

export default function SalesRepDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDealer, setSelectedDealer] = useState<DealerStats | null>(null);
  const [deals, setDeals] = useState<SalesDeal[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocItem | null>(null);
  const [showDealModal, setShowDealModal] = useState(false);
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

  useEffect(() => {
    checkAuth();
  }, []);

  const fetchAnalytics = async (token: string) => {
    try {
      const response = await fetch(apiUrl('/sales-rep/analytics'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const fetchDeals = async (token: string) => {
    try {
      const response = await fetch(apiUrl('/sales-rep/deals'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDeals(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch deals:', error);
    }
  };

  const fetchDocs = async (token: string) => {
    try {
      const response = await fetch(apiUrl('/sales-rep/docs'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDocs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch docs:', error);
    }
  };

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

      if (!response.ok) throw new Error('Not authenticated');

      const userData = await response.json();
      
      if (userData.user_type !== 'salesman') {
        alert('Sales rep access required');
        router.push('/');
        return;
      }

      setUser(userData);
      await Promise.all([fetchAnalytics(token), fetchDeals(token), fetchDocs(token)]);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async () => {
    if (!analytics?.affiliate?.referral_link) return;
    const absoluteLink = `${window.location.origin}${analytics.affiliate.referral_link}`;
    await navigator.clipboard.writeText(absoluteLink);
    alert('Referral link copied!');
  };

  const copyDealSignupLink = async (dealCode: string) => {
    if (!analytics?.affiliate?.code) return;
    const url = `${window.location.origin}/register?user_type=dealer&ref=${encodeURIComponent(analytics.affiliate.code)}&deal=${encodeURIComponent(dealCode)}`;
    await navigator.clipboard.writeText(url);
    alert('Deal signup link copied!');
  };

  const createDeal = async () => {
    if (!dealForm.name.trim()) {
      alert('Deal name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/sales-rep/deals'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...dealForm,
          free_days: Number(dealForm.free_days || 0),
          discount_value: dealForm.discount_value === 0 ? null : Number(dealForm.discount_value),
          fixed_monthly_price: dealForm.fixed_monthly_price === '' ? null : Number(dealForm.fixed_monthly_price),
          term_months: dealForm.term_months === '' ? null : Number(dealForm.term_months),
        })
      });

      if (response.ok) {
        alert('Deal created successfully');
        setShowDealModal(false);
        setDealForm({
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
        if (token) await fetchDeals(token);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create deal');
      }
    } catch (error) {
      console.error('Failed to create deal:', error);
      alert('Failed to create deal');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

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

  if (loading) {
    return (
      <div className="min-h-screen section-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-light">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-primary">YachtVersal</h1>
              <span className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full font-semibold">
                Sales Rep
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/messages')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Messages
              </button>
              <span className="text-sm text-gray-600">
                {user?.first_name} {user?.last_name}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-secondary">
            Welcome back, {user?.first_name}!
          </h2>
          <p className="text-dark/70 mt-1">
            Track your dealers and commission earnings
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-dark/70 text-sm">Total Dealers</p>
                <p className="text-3xl font-bold text-secondary">
                  {analytics?.total_dealers || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-dark/70 text-sm">Active Dealers</p>
                <p className="text-3xl font-bold text-green-600">
                  {analytics?.active_dealers || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-dark/70 text-sm">Monthly Commission</p>
                <p className="text-3xl font-bold text-primary">
                  ${analytics?.monthly_commission.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <DollarSign className="text-accent" size={24} />
              </div>
              <div>
                <p className="text-dark/70 text-sm">Total Revenue</p>
                <p className="text-3xl font-bold text-accent">
                  ${analytics?.monthly_revenue.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Commission Banner */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">
                💰 ${analytics?.monthly_commission.toFixed(2) || '0.00'} / month
              </h3>
              <p className="text-white/80">
                You earn 10% recurring commission on all active dealer subscriptions
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-primary/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-secondary mb-1">Your Affiliate Link</h3>
              <p className="text-sm text-dark/70">Share this link for self-serve dealer signups credited to you.</p>
              <p className="text-xs text-dark/60 mt-1">Referral code: {analytics?.affiliate?.code || '—'}</p>
              <p className="text-sm font-mono text-primary mt-2 break-all">
                {analytics?.affiliate ? `${window.location.origin}${analytics.affiliate.referral_link}` : 'Loading...'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyReferralLink}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Copy Link
              </button>
              <button
                onClick={() => setShowDealModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Create Deal
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="p-6 border-b">
            <h3 className="text-xl font-semibold text-secondary">Your Active Deals</h3>
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
                    <td colSpan={5} className="px-6 py-8 text-center text-dark/70">No deals created yet.</td>
                  </tr>
                ) : (
                  deals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-section-light">
                      <td className="px-6 py-4">
                        <div className="font-medium text-secondary">{deal.name}</div>
                        <div className="text-xs text-dark/70">{deal.target_email || 'General offer'}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm">{deal.code}</td>
                      <td className="px-6 py-4 text-sm text-dark/80">
                        {deal.fixed_monthly_price != null ? `Fixed $${deal.fixed_monthly_price}/mo` : deal.discount_type ? `${deal.discount_value || 0}${deal.discount_type === 'percentage' ? '%' : '$'} off` : 'Custom'}
                        {deal.free_days ? ` • ${deal.free_days} free days` : ''}
                      </td>
                      <td className="px-6 py-4">
                        {analytics?.affiliate?.code ? (
                          <>
                            <div className="text-xs font-mono text-gray-600 break-all">
                              {`${window.location.origin}/register?user_type=dealer&ref=${encodeURIComponent(analytics.affiliate.code)}&deal=${encodeURIComponent(deal.code)}`}
                            </div>
                            <button
                              onClick={() => copyDealSignupLink(deal.code)}
                              className="mt-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              Copy link
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-dark/60">Referral code unavailable</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-primary">{deal.usage_count || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dealers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-xl font-semibold text-secondary">Your Dealers</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-section-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark/70 uppercase">
                    Dealer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Listings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Performance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {!analytics || analytics.dealers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-dark/70">
                      <Users size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-lg mb-2">No dealers assigned yet</p>
                      <p className="text-sm">Contact your admin to get dealers assigned</p>
                    </td>
                  </tr>
                ) : (
                  analytics.dealers.map((dealer) => (
                    <tr key={dealer.dealer_id} className="hover:bg-section-light">
                      <td className="px-6 py-4">
                        <div className="font-medium text-secondary">{dealer.dealer_name}</div>
                        <div className="text-sm text-dark/70">
                          Joined {new Date(dealer.joined_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getTierColor(dealer.subscription_tier)}`}>
                          {dealer.subscription_tier}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-semibold text-secondary">
                            {dealer.active_listings} active
                          </div>
                          <div className="text-dark/70">
                            {dealer.total_listings} total
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <Eye size={14} className="text-gray-400" />
                            <span>{dealer.total_views.toLocaleString()} views</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare size={14} className="text-gray-400" />
                            <span>{dealer.total_inquiries} inquiries</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-primary">
                          {getTierCommission(dealer.subscription_tier)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedDealer(dealer)}
                          className="text-primary hover:text-primary/90 text-sm font-medium flex items-center gap-1"
                        >
                          <BarChart3 size={16} />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-lg p-6">
          <h4 className="font-semibold text-secondary mb-3">💡 Maximize Your Earnings</h4>
          <ul className="text-sm text-dark space-y-2">
            <li>• Invite yacht brokers and dealers to join the platform</li>
            <li>• Help clients upgrade from Free → Basic → Premium for higher commissions</li>
            <li>• Refer large brokerages to the <strong>Ultimate</strong> tier — commission negotiated directly</li>
            <li>• Provide excellent support to retain clients long-term</li>
            <li>• You earn 10% recurring commission for as long as clients stay subscribed</li>
          </ul>
        </div>

        {/* Documentation */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="text-primary" size={22} />
            <h3 className="text-xl font-semibold text-secondary">Sales Documentation & Resources</h3>
          </div>
          {docs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-dark/50">
              <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
              <p>No documentation available yet. Ask your admin to publish sales resources.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setActiveDoc(doc)}
                  className="bg-white rounded-lg shadow-md p-5 text-left hover:shadow-lg transition-shadow border border-gray-100 hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold uppercase text-primary/70 tracking-wide">{doc.category}</span>
                      <h4 className="text-base font-semibold text-secondary mt-0.5">{doc.title}</h4>
                      {doc.description && (
                        <p className="text-sm text-dark/60 mt-1 line-clamp-2">{doc.description}</p>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-gray-400 shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dealer Detail Modal */}
      {selectedDealer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-secondary">{selectedDealer.dealer_name}</h2>
              <button
                onClick={() => setSelectedDealer(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-sm text-primary font-medium mb-1">Subscription</p>
                  <p className="text-2xl font-bold text-primary capitalize">
                    {selectedDealer.subscription_tier}
                  </p>
                </div>

                <div className="bg-accent/10 rounded-lg p-4">
                  <p className="text-sm text-accent font-medium mb-1">Your Commission</p>
                  <p className="text-2xl font-bold text-accent">
                    {getTierCommission(selectedDealer.subscription_tier)}
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium mb-1">Total Listings</p>
                  <p className="text-2xl font-bold text-green-900">
                    {selectedDealer.total_listings}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {selectedDealer.active_listings} active
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-sm text-yellow-600 font-medium mb-1">Total Views</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {selectedDealer.total_views.toLocaleString()}
                  </p>
                </div>
              </div>

                <div className="bg-section-light rounded-lg p-4">
                <p className="text-sm text-dark/70 font-medium mb-2">Inquiries</p>
                <p className="text-3xl font-bold text-secondary">
                  {selectedDealer.total_inquiries}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Total inquiries received
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    router.push(`/messages?contact=${selectedDealer.dealer_id}`);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Send Message
                </button>
                <button
                  onClick={() => setSelectedDealer(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDealModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-secondary">Create Dealer Deal</h3>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="text"
                placeholder="Deal name"
                value={dealForm.name}
                onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Deal code (optional)"
                  value={dealForm.code}
                  onChange={(e) => setDealForm({ ...dealForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Free days"
                  value={dealForm.free_days}
                  onChange={(e) => setDealForm({ ...dealForm, free_days: Number(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <input
                type="email"
                placeholder="Target dealer email (optional)"
                value={dealForm.target_email}
                onChange={(e) => setDealForm({ ...dealForm, target_email: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={dealForm.discount_type}
                  onChange={(e) => setDealForm({ ...dealForm, discount_type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="percentage">Percentage Off</option>
                  <option value="fixed">Fixed Amount Off</option>
                </select>
                <input
                  type="number"
                  placeholder="Discount value"
                  value={dealForm.discount_value}
                  onChange={(e) => setDealForm({ ...dealForm, discount_value: Number(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Fixed monthly price"
                  value={dealForm.fixed_monthly_price}
                  onChange={(e) => setDealForm({ ...dealForm, fixed_monthly_price: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Term months"
                  value={dealForm.term_months}
                  onChange={(e) => setDealForm({ ...dealForm, term_months: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowDealModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={createDeal} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg">Create Deal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doc Viewer Modal */}
      {activeDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8">
            <div className="p-6 border-b flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase text-primary/70 tracking-wide">{activeDoc.category}</span>
                <h2 className="text-2xl font-bold text-secondary mt-0.5">{activeDoc.title}</h2>
                {activeDoc.description && (
                  <p className="text-sm text-dark/60 mt-1">{activeDoc.description}</p>
                )}
              </div>
              <button
                onClick={() => setActiveDoc(null)}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div
                className="prose prose-sm max-w-none text-dark/80 whitespace-pre-wrap"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {activeDoc.content || 'No content available.'}
              </div>
              {activeDoc.updated_at && (
                <p className="text-xs text-dark/40 mt-6 border-t pt-3">
                  Last updated: {new Date(activeDoc.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setActiveDoc(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}