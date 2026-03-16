'use client';

import { useState, useEffect } from 'react';
import { Tag, UserPlus, DollarSign, Percent, Calendar, Check, X, Copy, RefreshCw, Briefcase, Plus } from 'lucide-react';

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

interface BrokerForm {
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  phone: string;
  subscription_tier: string;
  sales_rep_id: string; // string for select, convert to number or null
  custom_price: string; // string for input
}

export default function AdminSalesToolsTab() {
  const [activeTab, setActiveTab] = useState<'marketing' | 'registration'>('marketing');
  const [loading, setLoading] = useState(true);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  
  // Registration Form State
  const [regForm, setRegForm] = useState<BrokerForm>({
    email: '',
    first_name: '',
    last_name: '',
    company_name: '',
    phone: '',
    subscription_tier: 'basic',
    sales_rep_id: '',
    custom_price: ''
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState<any>(null);
  const [regError, setRegError] = useState<string | null>(null);

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
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch Sales Reps
      const repRes = await fetch('/api/admin/sales-reps');
      if (repRes.ok) {
        const reps = await repRes.json();
        setSalesReps(reps);
      }

      // Fetch Deals
      await fetchDeals();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeals = async () => {
    setLoadingDeals(true);
    try {
      const res = await fetch('/api/admin/deals');
      if (res.ok) {
        const data = await res.json();
        setDeals(data);
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
      const payload: any = { ...regForm };
      
      // Handle conversions
      if (payload.sales_rep_id) payload.sales_rep_id = parseInt(payload.sales_rep_id);
      else delete payload.sales_rep_id;
      
      if (payload.custom_price && payload.custom_price.trim() !== '') {
        payload.custom_price = parseFloat(payload.custom_price);
      } else {
        delete payload.custom_price;
      }

      const res = await fetch('/api/admin/register-broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        custom_price: ''
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
        payload.discount_value = parseFloat(dealForm.discount_value);
      } else if (dealForm.strategy === 'fixed_price') {
         if (dealForm.fixed_monthly_price) {
             payload.fixed_monthly_price = parseFloat(dealForm.fixed_monthly_price);
         }
      }

      if (dealForm.owner_sales_rep_id) {
        payload.owner_sales_rep_id = parseInt(dealForm.owner_sales_rep_id);
      }

      const res = await fetch('/api/admin/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create deal');
      }
      
      setShowDealModal(false);
      fetchDeals(); // Refresh list
      
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
      </div>

      {activeTab === 'marketing' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Active Deals & Coupons</h2>
            <button
              onClick={() => setShowDealModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Deal
            </button>
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

      {activeTab === 'registration' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Register New Broker</h2>
            <p className="text-sm text-gray-500 mb-6">Create a broker account manually and bypass payment if needed.</p>

            {regSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                  <Check className="w-5 h-5" />
                  Registration Successful
                </div>
                <div className="space-y-1 text-sm text-green-800">
                  <p>Account created for <span className="font-semibold">{regSuccess.email}</span></p>
                  <p>Temporary Password: <code className="bg-white px-2 py-0.5 rounded border border-green-200 font-mono select-all font-bold">{regSuccess.password}</code></p>
                  <p className="text-xs mt-2 text-green-600">Please share these credentials securely with the broker.</p>
                </div>
                <button 
                  onClick={() => setRegSuccess(null)}
                  className="mt-4 text-sm text-green-700 hover:text-green-800 font-medium"
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
                      <option value="basic">Basic ($29/mo)</option>
                      <option value="plus">Plus ($59/mo)</option>
                      <option value="pro">Pro ($99/mo)</option>
                      <option value="ultimate">Ultimate (Custom)</option>
                      <option value="free">Free</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Sales Rep</label>
                    <select
                      value={regForm.sales_rep_id}
                      onChange={e => setRegForm({...regForm, sales_rep_id: e.target.value})}
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
                          className="w-full pl-9 pr-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        />
                     </div>
                  </div>
                )}
                
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
