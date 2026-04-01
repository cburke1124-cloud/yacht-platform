'use client';

import { useState, useEffect } from 'react';
import { Tag, UserPlus, DollarSign, Check, X, Copy, RefreshCw, Plus, ExternalLink, Link2, Pencil, Trash2, Gift } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface SalesRep {
  id: number;
  name: string;
  email: string;
}

interface Deal {
  id: number;
  name: string;
  code: string;
  active: boolean;
  discount_type: 'percentage' | 'fixed_amount' | null;
  discount_value: number | null;
  free_days: number;
  fixed_monthly_price: number | null;
  term_months: number | null;
  lifetime: boolean;
  target_email?: string;
  owner_sales_rep_id?: number;
  affiliate_account_id?: number;
  usage_count: number;
  created_at: string;
  end_date?: string;
}

interface PartnerOffer {
  id: number;
  name: string;
  description: string | null;
  terms_summary: string | null;
  stripe_payment_link_url: string | null;
  coupon_id: string | null;
  tier: string | null;
  sort_order: number;
  active: boolean;
  created_at: string | null;
}

interface OfferForm {
  name: string;
  description: string;
  terms_summary: string;
  coupon_id: string;
  stripe_payment_link_url: string; // manual URL override
  tier: string;         // 'all' | 'basic' | 'plus' | 'pro' | 'private_basic' | ''
  sort_order: string;
  active: boolean;
}

interface BrokerForm {
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  phone: string;
  subscription_tier: string;
  sales_rep_id: string; // string for select, convert to number or null
  custom_price: string; // string for input
  always_free: boolean;
}



const BLANK_OFFER_FORM: OfferForm = {
  name: '',
  description: '',
  terms_summary: '',
  coupon_id: '',
  stripe_payment_link_url: '',
  tier: 'all',
  sort_order: '0',
  active: true,
};

export default function AdminSalesToolsTab() {
  const [activeTab, setActiveTab] = useState<'marketing' | 'registration' | 'offers'>('marketing');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [activeDealsSalesRepId, setActiveDealsSalesRepId] = useState<string>('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [tiers, setTiers] = useState<Record<string, any>>({});
  
  // Registration Form State
  const [regForm, setRegForm] = useState<BrokerForm>({
    email: '',
    first_name: '',
    last_name: '',
    company_name: '',
    phone: '',
    subscription_tier: 'basic',
    sales_rep_id: '',
    custom_price: '',
    always_free: false
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState<any>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendResult, setResendResult] = useState<{ email_sent: boolean; setup_url: string; message: string } | null>(null);

  // Offers State
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<PartnerOffer | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm>(BLANK_OFFER_FORM);
  const [offerSaving, setOfferSaving] = useState(false);

  // Deal Form State
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealForm, setDealForm] = useState({
    name: '',
    code: '',
    strategy: 'pcent', // pcent, fixed_price
    discount_value: '',
    free_days: '0',
    term_months: '',
    fixed_monthly_price: '',
    lifetime: false,
    owner_sales_rep_id: '',
    active: true
  });
  const [dealLoading, setDealLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
    fetchOffers();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchDeals(token, activeDealsSalesRepId || regForm.sales_rep_id);
    }
  }, [activeDealsSalesRepId]);

  const fetchInitialData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadError('No authentication token found');
        setLoading(false);
        return;
      }

      // Fetch Broker Tiers
      try {
        console.log('Fetching broker tiers...');
        const tiersRes = await fetch(apiUrl('/sales-rep/broker-tiers'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (tiersRes.ok) {
          const tiersData = await tiersRes.json();
          console.log('Tiers fetched:', tiersData);
          setTiers(tiersData?.tiers || {});
        } else {
          console.warn(`Failed to fetch tiers (${tiersRes.status}):`, tiersRes.statusText);
        }
      } catch (tierError) {
        console.warn('Error fetching tiers:', tierError);
      }

      // Fetch Sales Reps (admin user filter)
      console.log('Fetching sales reps...');
      const repRes = await fetch(apiUrl('/admin/users?user_type=salesman&limit=200'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Sales reps response status:', repRes.status, repRes.statusText);
      
      if (repRes.ok) {
        const repData = await repRes.json();
        console.log('Sales reps fetched:', repData);
        const reps = (repData?.users || []).map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          email: u.email,
        }));
        setSalesReps(reps);

        const defaultRepId = reps[0]?.id ? String(reps[0].id) : '';
        setActiveDealsSalesRepId((current) => current || defaultRepId);
        setRegForm((prev) => ({ ...prev, sales_rep_id: prev.sales_rep_id || defaultRepId }));
        await fetchDeals(token, defaultRepId);
      } else {
        const errorData = await repRes.json().catch(() => ({}));
        const errorMsg = errorData?.error || errorData?.detail || `Failed to fetch sales reps`;
        console.error('Sales reps error:', errorMsg);
        setLoadError(`Sales reps fetch failed (${repRes.status}): ${errorMsg}`);
        setSalesReps([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setLoadError(`Failed to fetch data: ${message}`);
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async () => {
    setOffersLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(apiUrl('/admin/offers'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setOffers(await res.json());
    } catch (err) {
      console.error('Failed to fetch offers', err);
    } finally {
      setOffersLoading(false);
    }
  };

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfferSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');
      const payload = {
        ...offerForm,
        sort_order: parseInt(offerForm.sort_order) || 0,
      };
      const url = editingOffer
        ? apiUrl(`/admin/offers/${editingOffer.id}`)
        : apiUrl('/admin/offers');
      const res = await fetch(url, {
        method: editingOffer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Save failed');
      }
      setShowOfferModal(false);
      setEditingOffer(null);
      setOfferForm(BLANK_OFFER_FORM);
      fetchOffers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setOfferSaving(false);
    }
  };

  const handleOfferDelete = async (offerId: number) => {
    if (!confirm('Delete this offer? Sales reps will lose access to this link.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/admin/offers/${offerId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchOffers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleOfferEdit = (offer: PartnerOffer) => {
    setEditingOffer(offer);
    setOfferForm({
      name: offer.name,
      description: offer.description ?? '',
      terms_summary: offer.terms_summary ?? '',
      coupon_id: offer.coupon_id ?? '',
      stripe_payment_link_url: offer.stripe_payment_link_url ?? '',
      tier: offer.tier ?? '',
      sort_order: String(offer.sort_order),
      active: offer.active,
    });
    setShowOfferModal(true);
  };

  const fetchDeals = async (token?: string, repId?: string) => {
    setLoadingDeals(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const targetRep = repId || activeDealsSalesRepId || regForm.sales_rep_id;
      if (!authToken || !targetRep) {
        setDeals([]);
        return;
      }

      const res = await fetch(apiUrl(`/sales-rep/deals?sales_rep_id=${targetRep}`), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeals(data);
      } else {
        setDeals([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDeals(false);
    }
  };

  const handleRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const payload: any = { ...regForm };
      
      // Handle conversions
      if (payload.sales_rep_id) payload.sales_rep_id = parseInt(payload.sales_rep_id);
      else delete payload.sales_rep_id;
      
      if (payload.custom_price && payload.custom_price.trim() !== '') {
        payload.custom_price = parseFloat(payload.custom_price);
      } else {
        delete payload.custom_price;
      }

      if (payload.always_free) {
        payload.custom_price = null;
      }

      const res = await fetch(apiUrl('/sales-rep/register-broker'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Registration failed');

      setRegSuccess(data);
      setRegForm({
        email: '',
        first_name: '',
        last_name: '',
        company_name: '',
        phone: '',
        subscription_tier: 'basic',
        sales_rep_id: '',
        custom_price: '',
        always_free: false
      });
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDealLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const payload: any = {
        name: dealForm.name,
        code: dealForm.code,
        active: dealForm.active,
        lifetime: dealForm.lifetime,
        free_days: parseInt(dealForm.free_days) || 0,
       // term_months logic below
      };

      if (dealForm.term_months) {
        payload.term_months = parseInt(dealForm.term_months);
      }

      // Handle Discount/Pricing Strategy
      if (dealForm.strategy === 'pcent') {
        payload.discount_type = 'percentage';
        if (dealForm.discount_value) payload.discount_value = parseFloat(dealForm.discount_value);
      } else if (dealForm.strategy === 'fixed_price') {
         if (dealForm.fixed_monthly_price) {
             payload.fixed_monthly_price = parseFloat(dealForm.fixed_monthly_price);
         }
      }

      const ownerId = dealForm.owner_sales_rep_id || activeDealsSalesRepId || regForm.sales_rep_id;
      if (!ownerId) throw new Error('Please select a sales rep for this deal');
      if (ownerId) {
        payload.sales_rep_id = parseInt(ownerId);
      }

      const res = await fetch(apiUrl('/sales-rep/deals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create deal');
      }
      
      setShowDealModal(false);
      fetchDeals(token, ownerId);
      
      // Reset form
      setDealForm({
        name: '', 
        code: '', 
        strategy: 'pcent', 
        discount_value: '',
        free_days: '0', 
        term_months: '', 
        fixed_monthly_price: '',
        lifetime: false, 
        owner_sales_rep_id: '', 
        active: true
      });
    } catch (err: any) {
      alert(`Error creating deal: ${err.message}`);
    } finally {
      setDealLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-700">
          <X className="w-5 h-5" />
          <div>
            <div className="font-medium">Failed to load admin data</div>
            <div className="text-sm text-red-600">{loadError}</div>
          </div>
        </div>
      )}

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('marketing')}
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${
            activeTab === 'marketing'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Marketing Deals
          </div>
        </button>
        <button
          onClick={() => setActiveTab('registration')}
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${
            activeTab === 'registration'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Register Broker
          </div>
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${
            activeTab === 'offers'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Pre-Made Offers
          </div>
        </button>
      </div>

      {activeTab === 'marketing' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Active Deals & Coupons</h2>
            <div className="flex items-center gap-3">
              <select
                value={activeDealsSalesRepId}
                onChange={(e) => {
                  setActiveDealsSalesRepId(e.target.value);
                  setDealForm({ ...dealForm, owner_sales_rep_id: e.target.value });
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Select sales rep</option>
                {salesReps.map(rep => (
                  <option key={rep.id} value={rep.id}>{rep.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowDealModal(true)}
                disabled={!activeDealsSalesRepId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Create New Deal
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-500">Name / Code</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Value</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Terms</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Owner</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Usage</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900">{deal.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-600">
                          {deal.code}
                        </code>
                        <button
                          onClick={() => copyToClipboard(deal.code)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Copy Code"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                       {deal.fixed_monthly_price !== null ? (
                         <div className="font-medium text-green-700">
                           ${deal.fixed_monthly_price}/mo
                         </div>
                       ) : deal.discount_value ? (
                         <div className="font-medium text-blue-700">
                           {deal.discount_type === 'percentage' 
                             ? `${deal.discount_value}% OFF`
                             : `$${deal.discount_value} OFF`}
                         </div>
                       ) : (
                         <span className="text-gray-400">-</span>
                       )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {deal.free_days > 0 && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100">
                             {deal.free_days} Days Free
                          </span>
                        )}
                        {deal.lifetime && (
                           <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">
                             Lifetime
                           </span>
                        )}
                        {deal.term_months && (
                          <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-100">
                            {deal.term_months}mo Term
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                       {deal.owner_sales_rep_id ? (
                         <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                           Rep #{deal.owner_sales_rep_id}
                         </span>
                       ) : (
                         <span className="text-xs text-gray-400">System</span>
                       )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                       {deal.usage_count} uses
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        deal.active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {deal.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {/* Placeholder for future actions */}
                    </td>
                  </tr>
                ))}
                {loadingDeals && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Loading deals...
                    </td>
                  </tr>
                )}
                {!loadingDeals && deals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No active deals found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'offers' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Pre-Made Stripe Offers</h2>
              <p className="text-sm text-gray-500 mt-0.5">Create offers backed by Stripe Payment Links. Sales reps can copy and share these with prospects.</p>
            </div>
            <button
              onClick={() => { setEditingOffer(null); setOfferForm(BLANK_OFFER_FORM); setShowOfferModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Offer
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Terms</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Tier</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Link</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offersLoading && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading offers...</td></tr>
                )}
                {!offersLoading && offers.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No offers yet. Create your first offer above.</td></tr>
                )}
                {offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900">{offer.name}</div>
                      {offer.description && <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{offer.description}</div>}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {offer.terms_summary || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-3">
                      {offer.tier ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100 capitalize">{offer.tier}</span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-3">
                      {(() => {
                        const shareUrl = offer.coupon_id
                          ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?coupon=${offer.coupon_id}`
                          : offer.stripe_payment_link_url;
                        return shareUrl ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={shareUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              title="Open link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => copyToClipboard(shareUrl)}
                              className="text-gray-400 hover:text-blue-600"
                              title="Copy shareable URL"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        ) : <span className="text-gray-400">—</span>;
                      })()}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        offer.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {offer.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOfferEdit(offer)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOfferDelete(offer.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'registration' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Register New Broker</h2>
            <p className="text-sm text-gray-500 mb-6">Create a broker account manually and bypass payment if needed.</p>

            {regSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-medium">
                  <Check className="w-5 h-5" />
                  Registration Successful
                </div>
                <div className="space-y-1 text-sm text-green-800">
                  <p>Account created for <span className="font-semibold">{regSuccess.email}</span></p>
                  {regSuccess.password_setup_email_sent
                    ? <p className="text-green-700">✓ Setup email sent to broker.</p>
                    : <p className="text-amber-700 font-medium">⚠ Email delivery failed — use the button below to resend or copy the setup link.</p>
                  }
                </div>

                {/* Resend / copy setup link */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={async () => {
                      setResendLoading(true);
                      setResendResult(null);
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch(apiUrl(`/admin/broker/${regSuccess.dealer_id}/resend-setup`), {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        const d = await res.json();
                        setResendResult(d);
                      } catch {
                        setResendResult({ email_sent: false, setup_url: '', message: 'Network error.' });
                      } finally {
                        setResendLoading(false);
                      }
                    }}
                    disabled={resendLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                    {resendLoading ? 'Sending…' : 'Resend Setup Email'}
                  </button>
                </div>

                {resendResult && (
                  <div className={`text-sm rounded-lg p-3 space-y-2 ${
                    resendResult.email_sent ? 'bg-green-100 text-green-800' : 'bg-amber-50 text-amber-800'
                  }`}>
                    <p>{resendResult.message}</p>
                    {resendResult.setup_url && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs break-all flex-1">{resendResult.setup_url}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(resendResult!.setup_url)}
                          className="shrink-0 p-1.5 bg-white border rounded hover:bg-gray-50"
                          title="Copy link"
                        >
                          <Copy className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => { setRegSuccess(null); setResendResult(null); }}
                  className="text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  Register Another
                </button>
              </div>
            )}

            {regError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-700">
                <X className="w-5 h-5" />
                {regError}
              </div>
            )}

            {!regSuccess && (
              <form onSubmit={handleRegSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={regForm.first_name}
                      onChange={e => setRegForm({...regForm, first_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={regForm.last_name}
                      onChange={e => setRegForm({...regForm, last_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={e => setRegForm({...regForm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={regForm.company_name}
                    onChange={e => setRegForm({...regForm, company_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={regForm.phone}
                    onChange={e => setRegForm({...regForm, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Tier</label>
                    <select
                      value={regForm.subscription_tier}
                      onChange={e => setRegForm({...regForm, subscription_tier: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      {Object.entries(tiers).map(([key, tier]: [string, any]) => (
                        <option key={key} value={key}>
                          {tier.name || key.charAt(0).toUpperCase() + key.slice(1)} 
                          {tier.price ? ` ($${tier.price}/mo)` : (key === 'ultimate' ? ' (Custom)' : '')}
                        </option>
                      ))}
                      {Object.keys(tiers).length === 0 && (
                        <>
                          <option value="basic">Basic ($199/mo)</option>
                          <option value="plus">Plus ($299/mo)</option>
                          <option value="pro">Pro ($499/mo)</option>
                          <option value="ultimate">Ultimate (Custom)</option>
                          <option value="free">Free</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Sales Rep</label>
                    <select
                      value={regForm.sales_rep_id}
                      onChange={e => {
                        setRegForm({...regForm, sales_rep_id: e.target.value});
                        if (e.target.value) setActiveDealsSalesRepId(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">-- No Assignment --</option>
                      {salesReps.map(rep => (
                        <option key={rep.id} value={rep.id}>
                          {rep.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {regForm.subscription_tier === 'ultimate' && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                     <label className="block text-sm font-medium text-yellow-800 mb-1">Custom Monthly Price ($)</label>
                     <p className="text-xs text-yellow-600 mb-2">Set the recurring monthly charge for this Ultimate account.</p>
                     <div className="relative">
                        <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-yellow-600" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 500.00"
                          value={regForm.custom_price}
                          onChange={e => setRegForm({...regForm, custom_price: e.target.value})}
                         className="w-full pl-9 pr-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:opacity-50"
                         disabled={regForm.always_free}
                        />
                     </div>
                  </div>
                )}
                  <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <input
                      id="admin-always-free"
                      type="checkbox"
                      checked={regForm.always_free}
                      onChange={(e) => setRegForm({
                        ...regForm,
                        always_free: e.target.checked,
                        custom_price: e.target.checked ? '' : regForm.custom_price,
                      })}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="space-y-1">
                      <label htmlFor="admin-always-free" className="text-sm font-semibold text-gray-800">Mark account as always free</label>
                      <p className="text-xs text-gray-600">Bypass billing entirely for this broker. Custom pricing and deals will be ignored.</p>
                    </div>
                  </div>
                
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                  >
                    {regLoading ? (
                      <>Processing...</> 
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Register Broker Account
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* OFFER CREATE/EDIT MODAL */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowOfferModal(false); setEditingOffer(null); setOfferForm(BLANK_OFFER_FORM); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-gray-900">{editingOffer ? 'Edit Offer' : 'New Pre-Made Offer'}</h3>
              </div>
              <button onClick={() => { setShowOfferModal(false); setEditingOffer(null); setOfferForm(BLANK_OFFER_FORM); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleOfferSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Offer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4 Months Free — Basic"
                  value={offerForm.name}
                  onChange={e => setOfferForm({ ...offerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              {/* Coupon ID — drives the shareable /register?coupon= URL */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Coupon ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mFbVt7bD"
                  value={offerForm.coupon_id}
                  onChange={e => setOfferForm({ ...offerForm, coupon_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Shareable link will be <span className="font-mono">/register?coupon=&#123;id&#125;</span> — customer picks their tier at checkout.
                </p>
              </div>

              {/* Tier — when set to 'all', the backend creates one row per subscription tier */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tier</label>
                <select
                  value={offerForm.tier}
                  onChange={e => setOfferForm({ ...offerForm, tier: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  {!editingOffer && <option value="all">All tiers (creates 4 offers)</option>}
                  <option value="">— Any —</option>
                  <option value="private_basic">Private Basic</option>
                  <option value="basic">Basic</option>
                  <option value="plus">Plus</option>
                  <option value="pro">Pro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Terms Summary</label>
                <input
                  type="text"
                  placeholder="e.g. 4 months free, then $199/mo"
                  value={offerForm.terms_summary}
                  onChange={e => setOfferForm({ ...offerForm, terms_summary: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Description (shown to sales reps)</label>
                <textarea
                  rows={2}
                  placeholder="Optional: Additional context for sales reps about when to use this offer"
                  value={offerForm.description}
                  onChange={e => setOfferForm({ ...offerForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Sort Order</label>
                <input
                  type="number"
                  min="0"
                  value={offerForm.sort_order}
                  onChange={e => setOfferForm({ ...offerForm, sort_order: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm w-32"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="offer-active"
                  type="checkbox"
                  checked={offerForm.active}
                  onChange={e => setOfferForm({ ...offerForm, active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="offer-active" className="text-sm text-gray-700">Active (visible to sales reps)</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowOfferModal(false); setEditingOffer(null); setOfferForm(BLANK_OFFER_FORM); }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={offerSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {offerSaving ? 'Saving…' : editingOffer ? 'Update Offer' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DEAL MODAL */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDealModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
               <h3 className="font-semibold text-gray-900">Create Marketing Deal</h3>
               <button onClick={() => setShowDealModal(false)} className="text-gray-400 hover:text-gray-600">
                 <X className="w-5 h-5" />
               </button>
            </div>
            
            <form onSubmit={handleDealSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Internal Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Boat Show Special 2024"
                  value={dealForm.name}
                  onChange={e => setDealForm({...dealForm, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Coupon Code (Optional)</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Leave blank to auto-generate"
                    value={dealForm.code}
                    onChange={e => setDealForm({...dealForm, code: e.target.value.toUpperCase()})}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase"
                  />
                  <button type="button" onClick={() => setDealForm({...dealForm, code: ''})} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Auto
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Assigned Rep (Optional)</label>
                   <select
                     value={dealForm.owner_sales_rep_id}
                     onChange={e => setDealForm({...dealForm, owner_sales_rep_id: e.target.value})}
                     className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                   >
                     <option value="">-- None --</option>
                     {salesReps.map(r => (
                       <option key={r.id} value={r.id}>{r.name}</option>
                     ))}
                   </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Free Trial (Days)</label>
                  <input 
                    type="number"
                    min="0"
                    value={dealForm.free_days}
                    onChange={e => setDealForm({...dealForm, free_days: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                 <label className="block text-sm font-medium text-gray-900 mb-3">Pricing Strategy</label>
                 
                 <div className="space-y-3">
                   {/* Percentage Option */}
                   <div 
                     className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${dealForm.strategy === 'pcent' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'hover:bg-gray-50 border-gray-200'}`}
                     onClick={() => setDealForm({...dealForm, strategy: 'pcent'})}
                   >
                      <input 
                        type="radio" 
                        name="strategy" 
                        checked={dealForm.strategy === 'pcent'} 
                        onChange={() => setDealForm({...dealForm, strategy: 'pcent'})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm block">Percentage Discount</span>
                      </div>
                      {dealForm.strategy === 'pcent' && (
                         <div className="w-24 relative">
                           <input 
                             type="number" 
                             placeholder="20"
                             className="w-full pr-6 pl-2 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-blue-500"
                             value={dealForm.discount_value}
                             onChange={e => setDealForm({...dealForm, discount_value: e.target.value})}
                             onClick={e => e.stopPropagation()}
                           />
                           <span className="absolute right-2 top-1.5 text-gray-500 text-xs">%</span>
                         </div>
                      )}
                   </div>

                   {/* Fixed Price Option */}
                   <div 
                     className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${dealForm.strategy === 'fixed_price' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'hover:bg-gray-50 border-gray-200'}`}
                     onClick={() => setDealForm({...dealForm, strategy: 'fixed_price'})}
                   >
                      <input 
                        type="radio" 
                        name="strategy" 
                        checked={dealForm.strategy === 'fixed_price'} 
                        onChange={() => setDealForm({...dealForm, strategy: 'fixed_price'})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm block">Fixed Monthly Price</span>
                      </div>
                      {dealForm.strategy === 'fixed_price' && (
                         <div className="w-32 relative">
                           <span className="absolute left-2 top-1.5 text-gray-500 text-sm">$</span>
                           <input 
                             type="number" 
                             placeholder="299.00"
                             className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-blue-500"
                             value={dealForm.fixed_monthly_price}
                             onChange={e => setDealForm({...dealForm, fixed_monthly_price: e.target.value})}
                             onClick={e => e.stopPropagation()}
                           />
                         </div>
                      )}
                   </div>
                 </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowDealModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dealLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {dealLoading ? 'Creating...' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
