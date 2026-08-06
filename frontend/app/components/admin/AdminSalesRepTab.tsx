'use client';

import { useState, useEffect, Fragment } from 'react';
import { UserPlus, DollarSign, Users, Link2, X, Mail, Edit, TrendingUp, History, ChevronDown, ChevronRight } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface SalesRep {
  id: number;
  name: string;
  email: string;
  dealer_count: number;
  active_dealers: number;
  monthly_commission: number;
  total_revenue: number;
  commission_rate: number;
  referral_code?: string;
  referral_link?: string;
  private_referral_link?: string;
  referred_signups?: number;
}

interface AffiliateAccount {
  id: number;
  name: string;
  email?: string;
  code: string;
  account_type: string;
  commission_rate: number;
  active: boolean;
  referral_link: string;
  private_referral_link: string;
}

interface DealPerformanceRow {
  deal_id: number;
  crm_sync_key: string;
  name: string;
  code: string;
  owner_sales_rep_name?: string;
  affiliate_name?: string;
  signup_count: number;
  active_paid_accounts: number;
  monthly_revenue: number;
  monthly_commission: number;
  active: boolean;
  created_at?: string;
}

interface DealPerformanceResponse {
  deals: DealPerformanceRow[];
  summary_by_sales_rep: Array<{
    sales_rep_id: number;
    sales_rep_name?: string;
    signup_count: number;
    active_paid_accounts: number;
    monthly_revenue: number;
    monthly_commission: number;
  }>;
  summary_by_affiliate: Array<{
    affiliate_account_id: number;
    affiliate_name?: string;
    code?: string;
    signup_count: number;
    active_paid_accounts: number;
    monthly_revenue: number;
    monthly_commission: number;
  }>;
  generated_at: string;
}

interface Dealer {
  id: number;
  user_type: string;
  company_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  subscription_tier: string;
  assigned_sales_rep_id?: number;
  created_at?: string;
  subscription_monthly_price?: number | null;
  custom_subscription_price?: number | null;
  trial_active?: boolean;
  always_free?: boolean;
}

interface CommissionHistory {
  old_rate: number;
  new_rate: number;
  reason: string;
  changed_at: string;
  changed_by: number;
}

interface PayoutLineItem {
  referral_signup_id: number | null;
  account_id: number;
  account_name: string;
  account_email: string;
  user_type: string;
  price: number;
  commission_rate: number;
  commission_amount: number;
  backfilled: boolean;
}

interface PayoutStatement {
  sales_rep_id: number;
  sales_rep_name: string;
  generated_at: string;
  total_commission_owed: number;
  line_item_count: number;
  line_items: PayoutLineItem[];
  payout_id: number | null;
}

interface PayoutHistoryEntry {
  id: number;
  amount: number;
  referral_count: number;
  notes: string | null;
  paid_by: number | null;
  paid_at: string | null;
}

export default function AdminSalesRepTab() {
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [selectedRep, setSelectedRep] = useState<SalesRep | null>(null);
  const [commissionHistory, setCommissionHistory] = useState<CommissionHistory[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateAccount[]>([]);
  const [dealPerformance, setDealPerformance] = useState<DealPerformanceResponse | null>(null);
  const [expandedReps, setExpandedReps] = useState<Set<number>>(new Set());

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutRep, setPayoutRep] = useState<SalesRep | null>(null);
  const [payoutStatement, setPayoutStatement] = useState<PayoutStatement | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [confirmingPayout, setConfirmingPayout] = useState(false);
  const [showPayoutHistoryModal, setShowPayoutHistoryModal] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistoryEntry[]>([]);

  const TIER_PRICES: Record<string, number> = {
    basic: 29, plus: 59, pro: 99, premium: 99,
    private_basic: 9, private_plus: 19, private_pro: 39,
    free: 0, trial: 0,
  };

  const toggleRepExpand = (repId: number) => {
    setExpandedReps(prev => {
      const next = new Set(prev);
      next.has(repId) ? next.delete(repId) : next.add(repId);
      return next;
    });
  };
  
  const [newRep, setNewRep] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: ''
  });

  const [inviteForm, setInviteForm] = useState({
    sales_rep_id: 0,
    email: '',
    company_name: '',
    first_name: '',
    last_name: ''
  });

  const [affiliateForm, setAffiliateForm] = useState({
    name: '',
    email: '',
    code: '',
    commission_rate: 10,
    account_type: 'affiliate',
  });

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      alert(`${label} copied`);
    } catch (error) {
      console.error('Failed to copy value:', error);
      alert(`Failed to copy ${label}`);
    }
  };

  const buildAbsoluteSignupLink = (relativeLink?: string) => {
    if (!relativeLink) return '';
    return `${window.location.origin}${relativeLink}`;
  };

  const exportDealPerformanceCsv = () => {
    if (!dealPerformance || dealPerformance.deals.length === 0) {
      alert('No deal performance data to export');
      return;
    }

    const headers = [
      'deal_id',
      'crm_sync_key',
      'name',
      'code',
      'owner_sales_rep_name',
      'affiliate_name',
      'signup_count',
      'active_paid_accounts',
      'monthly_revenue',
      'monthly_commission',
      'active',
      'created_at',
    ];

    const escapeCsv = (value: unknown) => {
      const stringValue = String(value ?? '');
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = dealPerformance.deals.map((row) => [
      row.deal_id,
      row.crm_sync_key,
      row.name,
      row.code,
      row.owner_sales_rep_name || '',
      row.affiliate_name || '',
      row.signup_count,
      row.active_paid_accounts,
      Number(row.monthly_revenue || 0).toFixed(2),
      Number(row.monthly_commission || 0).toFixed(2),
      row.active ? 'true' : 'false',
      row.created_at || '',
    ]);

    const csv = [headers, ...rows]
      .map((line) => line.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `deal-performance-${datePart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [commissionForm, setCommissionForm] = useState({
    commission_rate: 10,
    reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const [repsRes, dealersRes, affiliatesRes, performanceRes] = await Promise.all([
        fetch(apiUrl('/admin/sales-reps'), {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(apiUrl('/admin/dealers?include_private=true'), {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(apiUrl('/admin/affiliates'), {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(apiUrl('/admin/deal-performance'), {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (repsRes.ok) {
        const repsData = await repsRes.json();
        setSalesReps(repsData);
      }

      if (dealersRes.ok) {
        const dealersData = await dealersRes.json();
        setDealers(Array.isArray(dealersData) ? dealersData : (dealersData.dealers ?? []));
      }

      if (affiliatesRes.ok) {
        const affiliatesData = await affiliatesRes.json();
        setAffiliates(Array.isArray(affiliatesData) ? affiliatesData : []);
      }

      if (performanceRes.ok) {
        const performanceData = await performanceRes.json();
        setDealPerformance(performanceData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRep = async () => {
    if (!newRep.email || !newRep.password || !newRep.first_name) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/sales-reps'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newRep,
          commission_rate: commissionForm.commission_rate || 10,
        })
      });

      if (response.ok) {
        alert('Sales rep created successfully!');
        setShowCreateModal(false);
        setNewRep({ email: '', password: '', first_name: '', last_name: '' });
        fetchData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create sales rep');
      }
    } catch (error) {
      console.error('Failed to create rep:', error);
      alert('Failed to create sales rep');
    }
  };

  const sendInvitation = async () => {
    if (!inviteForm.email || !inviteForm.company_name || !inviteForm.first_name || !inviteForm.sales_rep_id) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/invitations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inviteForm)
      });

      if (response.ok) {
        alert('Invitation sent successfully!');
        setShowInviteModal(false);
        setInviteForm({ sales_rep_id: 0, email: '', company_name: '', first_name: '', last_name: '' });
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation');
    }
  };

  const handleCreateAffiliate = async () => {
    if (!affiliateForm.name || !affiliateForm.code) {
      alert('Affiliate name and code are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/affiliates'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(affiliateForm)
      });

      if (response.ok) {
        alert('Affiliate account created successfully!');
        setShowAffiliateModal(false);
        setAffiliateForm({ name: '', email: '', code: '', commission_rate: 10, account_type: 'affiliate' });
        fetchData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create affiliate account');
      }
    } catch (error) {
      console.error('Failed to create affiliate account:', error);
      alert('Failed to create affiliate account');
    }
  };

  const handleAssignDealer = async (repId: number | null) => {
    if (!selectedDealer) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/assign-sales-rep'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dealer_id: selectedDealer.id,
          sales_rep_id: repId
        })
      });

      if (response.ok) {
        alert(repId ? 'Account assigned successfully!' : 'Account unassigned successfully!');
        setShowAssignModal(false);
        setSelectedDealer(null);
        fetchData();
      } else {
        alert(repId ? 'Failed to assign account' : 'Failed to unassign account');
      }
    } catch (error) {
      console.error('Failed to assign:', error);
      alert('Failed to assign account');
    }
  };

  const fetchPayoutStatement = async (rep: SalesRep) => {
    setPayoutRep(rep);
    setPayoutStatement(null);
    setShowPayoutModal(true);
    setPayoutLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/sales-reps/${rep.id}/payout-statement`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPayoutStatement(data);
      } else {
        alert('Failed to generate statement');
        setShowPayoutModal(false);
      }
    } catch (error) {
      console.error('Failed to fetch payout statement:', error);
      alert('Failed to generate statement');
      setShowPayoutModal(false);
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleConfirmPayout = async () => {
    if (!payoutRep || !payoutStatement) return;
    setConfirmingPayout(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/sales-reps/${payoutRep.id}/confirm-payout`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      if (response.ok) {
        const result = await response.json();
        alert(`Paid $${result.total_commission_owed.toFixed(2)} to ${payoutRep.name} — commission now starts at $0.`);
        setShowPayoutModal(false);
        setPayoutRep(null);
        setPayoutStatement(null);
        fetchData();
      } else {
        alert('Failed to confirm payout');
      }
    } catch (error) {
      console.error('Failed to confirm payout:', error);
      alert('Failed to confirm payout');
    } finally {
      setConfirmingPayout(false);
    }
  };

  const exportPayoutStatementCsv = () => {
    if (!payoutStatement || payoutStatement.line_items.length === 0) {
      alert('No statement data to export');
      return;
    }

    const headers = ['account_name', 'account_email', 'user_type', 'price', 'commission_rate', 'commission_amount', 'backfilled'];
    const escapeCsv = (value: unknown) => {
      const stringValue = String(value ?? '');
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = payoutStatement.line_items.map((item) => [
      item.account_name,
      item.account_email,
      item.user_type,
      item.price.toFixed(2),
      item.commission_rate.toFixed(1),
      item.commission_amount.toFixed(2),
      item.backfilled ? 'true' : 'false',
    ]);

    const csv = [headers, ...rows].map((line) => line.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `commission-statement-${payoutStatement.sales_rep_id}-${datePart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchPayoutHistory = async (repId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/sales-reps/${repId}/payouts`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPayoutHistory(data);
        setShowPayoutHistoryModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch payout history:', error);
    }
  };

  const handleUpdateCommission = async () => {
    if (!selectedRep) return;

    if (commissionForm.commission_rate < 0 || commissionForm.commission_rate > 100) {
      alert('Commission rate must be between 0 and 100');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/sales-reps/${selectedRep.id}/commission`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(commissionForm)
      });

      if (response.ok) {
        alert('Commission rate updated successfully!');
        setShowCommissionModal(false);
        setSelectedRep(null);
        setCommissionForm({ commission_rate: 10, reason: '' });
        fetchData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to update commission');
      }
    } catch (error) {
      console.error('Failed to update commission:', error);
      alert('Failed to update commission');
    }
  };

  const fetchCommissionHistory = async (repId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/sales-reps/${repId}/commission-history`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCommissionHistory(data);
        setShowHistoryModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Sales Representatives</h2>
          <p className="text-gray-600 mt-1">Manage your sales team and commission rates</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAffiliateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Link2 size={20} />
            Add Affiliate
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Mail size={20} />
            Invite Broker
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
          >
            <UserPlus size={20} />
            Add Sales Rep
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Sales Reps</p>
              <p className="text-3xl font-bold text-gray-900">{salesReps.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Brokers Managed</p>
              <p className="text-3xl font-bold text-gray-900">
                {salesReps.reduce((sum, rep) => sum + (rep.dealer_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Commissions</p>
              <p className="text-3xl font-bold text-gray-900">
                ${salesReps.reduce((sum, rep) => sum + (rep.monthly_commission || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold">Sales Representatives</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rep</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brokers</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission Owed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referral</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {salesReps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <UserPlus size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No sales reps yet. Click Add Sales Rep to create one.</p>
                  </td>
                </tr>
              ) : (
                salesReps.map((rep) => {
                  const repDealers = dealers.filter(d => d.assigned_sales_rep_id === rep.id);
                  const isExpanded = expandedReps.has(rep.id);
                  return (
                    <Fragment key={rep.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{rep.name}</div>
                          <div className="text-sm text-gray-500">{rep.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleRepExpand(rep.id)}
                            className="flex items-center gap-2 text-left group"
                            title={isExpanded ? 'Collapse brokers' : 'View brokers'}
                          >
                            <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded border ${isExpanded ? 'bg-primary border-primary text-white' : 'border-gray-300 text-gray-500 group-hover:border-primary group-hover:text-primary'} transition-colors`}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            <div className="text-sm">
                              <div className="font-semibold text-gray-900">{rep.dealer_count || 0} total</div>
                              <div className="text-gray-500">{rep.active_dealers || 0} active</div>
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">
                            ${(rep.total_revenue || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              (rep.commission_rate || 10) === 10 
                                ? 'bg-gray-100 text-gray-800'
                                : (rep.commission_rate || 10) > 10
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {(rep.commission_rate || 10).toFixed(1)}%
                            </span>
                            <button
                              onClick={() => {
                                setSelectedRep(rep);
                                setCommissionForm({
                                  commission_rate: rep.commission_rate || 10,
                                  reason: ''
                                });
                                setShowCommissionModal(true);
                              }}
                              className="p-1 text-primary hover:bg-primary/10 rounded"
                              title="Edit commission rate"
                            >
                              <Edit size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-green-600">
                            ${(rep.monthly_commission || 0).toFixed(2)} owed
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-semibold text-gray-900">{rep.referral_code || '—'}</div>
                            <div className="text-gray-500">{rep.referred_signups || 0} signups</div>
                            {rep.referral_link && (
                              <>
                                <div className="mt-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Broker</div>
                                <div className="text-xs font-mono text-gray-600 break-all">
                                  {buildAbsoluteSignupLink(rep.referral_link)}
                                </div>
                                <button
                                  onClick={() => copyToClipboard(buildAbsoluteSignupLink(rep.referral_link), 'Signup link')}
                                  className="mt-1 text-xs text-primary hover:text-primary/90"
                                >
                                  Copy signup link
                                </button>
                              </>
                            )}
                            {rep.private_referral_link && (
                              <>
                                <div className="mt-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Private Seller</div>
                                <div className="text-xs font-mono text-gray-600 break-all">
                                  {buildAbsoluteSignupLink(rep.private_referral_link)}
                                </div>
                                <button
                                  onClick={() => copyToClipboard(buildAbsoluteSignupLink(rep.private_referral_link), 'Private seller signup link')}
                                  className="mt-1 text-xs text-primary hover:text-primary/90"
                                >
                                  Copy signup link
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => fetchCommissionHistory(rep.id)}
                              className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"
                              title="View commission rate history"
                            >
                              <History size={16} /> Rate History
                            </button>
                            <button
                              onClick={() => fetchPayoutHistory(rep.id)}
                              className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"
                              title="View payout history"
                            >
                              <History size={16} /> Payout History
                            </button>
                            <button
                              onClick={() => fetchPayoutStatement(rep)}
                              className="text-primary hover:text-primary/90 text-sm font-medium flex items-center gap-1"
                              title="Generate commission statement"
                            >
                              <DollarSign size={16} /> Payout
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-blue-50/40">
                          <td colSpan={7} className="px-6 py-4">
                            {repDealers.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">No accounts assigned to this rep yet.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Name / Company</th>
                                    <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Type</th>
                                    <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Email</th>
                                    <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Tier</th>
                                    <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Monthly Price</th>
                                    <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Signed Up</th>
                                    <th className="text-left pb-2 font-medium text-gray-600 text-xs uppercase">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {repDealers.map(dealer => (
                                    <tr key={dealer.id} className="hover:bg-blue-50/60">
                                      <td className="py-2 pr-4 font-medium text-gray-900">
                                        {dealer.company_name || `${dealer.first_name || ''} ${dealer.last_name || ''}`.trim() || '—'}
                                      </td>
                                      <td className="py-2 pr-4">
                                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 capitalize">
                                          {dealer.user_type === 'private' ? 'Private Seller' : 'Broker'}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4 text-gray-600">{dealer.email}</td>
                                      <td className="py-2 pr-4">
                                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-secondary/10 text-secondary capitalize">
                                          {dealer.subscription_tier || 'free'}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4 text-gray-700">
                                        {(() => {
                                          if (dealer.always_free) return <span className="text-gray-500">Free (admin)</span>;
                                          if (dealer.trial_active) return <span className="text-amber-600 font-medium">$0/mo (Trial)</span>;
                                          if (dealer.subscription_monthly_price != null) return `$${dealer.subscription_monthly_price.toFixed(2)}/mo`;
                                          if (dealer.custom_subscription_price != null) return `$${dealer.custom_subscription_price.toFixed(2)}/mo`;
                                          const fallback = TIER_PRICES[dealer.subscription_tier];
                                          return fallback != null ? `$${fallback}/mo` : '—';
                                        })()}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-500">
                                        {dealer.created_at
                                          ? new Date(dealer.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                          : '—'}
                                      </td>
                                      <td className="py-2">
                                        <button
                                          onClick={() => {
                                            setSelectedDealer(dealer);
                                            setShowAssignModal(true);
                                          }}
                                          className="text-primary hover:text-primary/90 text-xs font-medium"
                                        >
                                          Reassign
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mt-8">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold">Affiliate Accounts</h3>
          <p className="text-sm text-gray-600 mt-1">Create and manage external referral partners alongside internal reps.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signup Link</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {affiliates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No affiliate accounts yet.</td>
                </tr>
              ) : (
                affiliates.map((affiliate) => (
                  <tr key={affiliate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{affiliate.name}</div>
                      <div className="text-sm text-gray-500">{affiliate.email || '—'}</div>
                    </td>
                    <td className="px-6 py-4 capitalize">{affiliate.account_type.replace('_', ' ')}</td>
                    <td className="px-6 py-4 font-mono text-sm">{affiliate.code}</td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Broker</div>
                      <div className="text-xs font-mono text-gray-600 break-all">
                        {buildAbsoluteSignupLink(affiliate.referral_link)}
                      </div>
                      <button
                        onClick={() => copyToClipboard(buildAbsoluteSignupLink(affiliate.referral_link), 'Affiliate signup link')}
                        className="mt-1 text-xs text-primary hover:text-primary/90"
                      >
                        Copy signup link
                      </button>
                      <div className="mt-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Private Seller</div>
                      <div className="text-xs font-mono text-gray-600 break-all">
                        {buildAbsoluteSignupLink(affiliate.private_referral_link)}
                      </div>
                      <button
                        onClick={() => copyToClipboard(buildAbsoluteSignupLink(affiliate.private_referral_link), 'Affiliate private seller signup link')}
                        className="mt-1 text-xs text-primary hover:text-primary/90"
                      >
                        Copy signup link
                      </button>
                    </td>
                    <td className="px-6 py-4">{(affiliate.commission_rate || 0).toFixed(1)}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${affiliate.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {affiliate.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mt-8">
        <div className="p-6 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold">Deal Performance</h3>
              <p className="text-sm text-gray-600 mt-1">Tracks signups, active paid accounts, revenue, and commission by deal. Includes CRM sync keys for future HighLevel sync.</p>
            </div>
            <button
              onClick={exportDealPerformanceCsv}
              className="px-3 py-2 text-sm bg-secondary text-white rounded-lg hover:bg-secondary/90"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CRM Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signups</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active Paid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!dealPerformance || dealPerformance.deals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No deal performance data yet.</td>
                </tr>
              ) : (
                dealPerformance.deals.map((row) => (
                  <tr key={row.deal_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{row.name}</div>
                      <div className="text-sm text-gray-500">{row.code}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-700">{row.crm_sync_key}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{row.owner_sales_rep_name || row.affiliate_name || '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.signup_count}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-primary">{row.active_paid_accounts}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">${(row.monthly_revenue || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-700">${(row.monthly_commission || 0).toFixed(2)} owed</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {dealPerformance && (dealPerformance.summary_by_sales_rep.length > 0 || dealPerformance.summary_by_affiliate.length > 0) && (
          <div className="p-6 border-t bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Sales Rep Summary</h4>
              <div className="space-y-2">
                {dealPerformance.summary_by_sales_rep.map((row) => (
                  <div key={row.sales_rep_id} className="text-sm text-gray-700 flex items-center justify-between">
                    <span>{row.sales_rep_name || `Rep #${row.sales_rep_id}`}</span>
                    <span className="font-medium">{row.signup_count} signups • ${row.monthly_commission.toFixed(2)} owed</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Affiliate Summary</h4>
              <div className="space-y-2">
                {dealPerformance.summary_by_affiliate.map((row) => (
                  <div key={row.affiliate_account_id} className="text-sm text-gray-700 flex items-center justify-between">
                    <span>{row.affiliate_name || `Affiliate #${row.affiliate_account_id}`}</span>
                    <span className="font-medium">{row.signup_count} signups • ${row.monthly_commission.toFixed(2)} owed</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold">Unassigned Accounts</h3>
          <p className="text-sm text-gray-600 mt-1">Assign these brokers or private sellers to a sales rep for account management</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscription</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dealers.filter(d => !d.assigned_sales_rep_id).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    All accounts are assigned to sales reps
                  </td>
                </tr>
              ) : (
                dealers.filter(d => !d.assigned_sales_rep_id).map((dealer) => (
                  <tr key={dealer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {dealer.company_name || `${dealer.first_name || ''} ${dealer.last_name || ''}`.trim() || '—'}
                      </div>
                      <div className="text-sm text-gray-500">{dealer.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 capitalize">
                        {dealer.user_type === 'private' ? 'Private Seller' : 'Broker'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold capitalize bg-gray-100 text-gray-800">
                        {dealer.subscription_tier}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedDealer(dealer);
                          setShowAssignModal(true);
                        }}
                        className="flex items-center gap-2 text-primary hover:text-primary/90 text-sm font-medium"
                      >
                        <Link2 size={16} />
                        Assign to Rep
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold">Create Sales Rep</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  value={newRep.first_name}
                  onChange={(e) => setNewRep({ ...newRep, first_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  value={newRep.last_name}
                  onChange={(e) => setNewRep({ ...newRep, last_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={newRep.email}
                  onChange={(e) => setNewRep({ ...newRep, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Temporary Password *</label>
                <input
                  type="password"
                  value={newRep.password}
                  onChange={(e) => setNewRep({ ...newRep, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Min 8 characters"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRep}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Create Rep
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCommissionModal && selectedRep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Update Commission Rate</h3>
                <p className="text-sm text-gray-600 mt-1">{selectedRep.name}</p>
              </div>
              <button onClick={() => setShowCommissionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Commission Rate (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={commissionForm.commission_rate}
                  onChange={(e) => setCommissionForm({ ...commissionForm, commission_rate: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Standard rate is 10%. Current: {(selectedRep.commission_rate || 10).toFixed(1)}%
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Change</label>
                <textarea
                  value={commissionForm.reason}
                  onChange={(e) => setCommissionForm({ ...commissionForm, reason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  rows={3}
                  placeholder="e.g., Senior rep bonus, temporary promotion"
                />
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <TrendingUp className="text-primary flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm">
                    <p className="font-medium text-secondary mb-1">Estimated Impact</p>
                    <p className="text-primary">
                      Current owed: <span className="font-semibold">${(selectedRep.monthly_commission || 0).toFixed(2)}</span>
                      <br />
                      Estimated at new rate: <span className="font-semibold">${((selectedRep.total_revenue || 0) * (commissionForm.commission_rate / 100)).toFixed(2)}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCommissionModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateCommission}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Update Rate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold">Commission Rate History</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {commissionHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No rate changes recorded</div>
              ) : (
                <div className="space-y-4">
                  {commissionHistory.map((record, idx) => (
                    <div key={idx} className="border-l-4 border-primary pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">
                          {record.old_rate.toFixed(1)}% → {record.new_rate.toFixed(1)}%
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(record.changed_at).toLocaleDateString()}
                        </span>
                      </div>
                      {record.reason && <p className="text-sm text-gray-600">{record.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold">Invite New Broker</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign To Sales Rep *</label>
                <select
                  value={inviteForm.sales_rep_id || ''}
                  onChange={(e) => setInviteForm({ ...inviteForm, sales_rep_id: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="">Select sales rep</option>
                  {salesReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>{rep.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                <input
                  type="text"
                  value={inviteForm.company_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  value={inviteForm.first_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  value={inviteForm.last_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={sendInvitation}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAffiliateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold">Create Affiliate Account</h3>
              <button onClick={() => setShowAffiliateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={affiliateForm.name}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={affiliateForm.email}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code *</label>
                  <input
                    type="text"
                    value={affiliateForm.code}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="YVPARTNER01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Commission %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={affiliateForm.commission_rate}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, commission_rate: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAffiliateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAffiliate}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create Affiliate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && selectedDealer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">
                {selectedDealer.assigned_sales_rep_id ? 'Reassign' : 'Assign'} {selectedDealer.company_name || `${selectedDealer.first_name || ''} ${selectedDealer.last_name || ''}`.trim()}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Select a sales rep to manage this {selectedDealer.user_type === 'private' ? 'private seller' : 'broker'}
              </p>
            </div>

            <div className="p-6 space-y-3">
              {salesReps.filter(rep => rep.id !== selectedDealer.assigned_sales_rep_id).map((rep) => (
                <button
                  key={rep.id}
                  onClick={() => handleAssignDealer(rep.id)}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/10 transition-all text-left"
                >
                  <div className="font-semibold text-gray-900">{rep.name}</div>
                  <div className="text-sm text-gray-600">
                    {rep.dealer_count} accounts · ${rep.monthly_commission.toFixed(2)} owed
                  </div>
                </button>
              ))}

              {selectedDealer.assigned_sales_rep_id && (
                <button
                  onClick={() => handleAssignDealer(null)}
                  className="w-full p-4 border-2 border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all text-left text-red-700 font-semibold"
                >
                  Unassign from current rep
                </button>
              )}

              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDealer(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 mt-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPayoutModal && payoutRep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Commission Statement — {payoutRep.name}</h3>
                <p className="text-sm text-gray-600 mt-1">Review before confirming payout. Confirming marks everything below as paid and resets the owed total to $0.</p>
              </div>
              <button onClick={() => { setShowPayoutModal(false); setPayoutRep(null); setPayoutStatement(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {payoutLoading ? (
                <div className="text-center py-8 text-gray-500">Generating statement...</div>
              ) : !payoutStatement || payoutStatement.line_items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Nothing owed — commission is already at $0.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Account</th>
                      <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Type</th>
                      <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Price</th>
                      <th className="text-left pb-2 pr-4 font-medium text-gray-600 text-xs uppercase">Rate</th>
                      <th className="text-left pb-2 font-medium text-gray-600 text-xs uppercase">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payoutStatement.line_items.map((item) => (
                      <tr key={item.referral_signup_id ?? `${item.account_id}-backfilled`}>
                        <td className="py-2 pr-4">
                          <div className="font-medium text-gray-900">{item.account_name}</div>
                          <div className="text-xs text-gray-500">{item.account_email}</div>
                        </td>
                        <td className="py-2 pr-4 capitalize text-gray-700">{item.user_type === 'private' ? 'Private Seller' : 'Broker'}</td>
                        <td className="py-2 pr-4 text-gray-700">${item.price.toFixed(2)}</td>
                        <td className="py-2 pr-4 text-gray-700">{item.commission_rate.toFixed(1)}%</td>
                        <td className="py-2 font-semibold text-green-700">${item.commission_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-lg">
                Total owed: <span className="font-bold text-secondary">${(payoutStatement?.total_commission_owed || 0).toFixed(2)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={exportPayoutStatementCsv}
                  disabled={!payoutStatement || payoutStatement.line_items.length === 0}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-medium disabled:opacity-50"
                >
                  Download CSV
                </button>
                <button
                  onClick={handleConfirmPayout}
                  disabled={confirmingPayout || !payoutStatement || payoutStatement.total_commission_owed <= 0}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
                >
                  {confirmingPayout ? 'Confirming...' : 'Confirm Payout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPayoutHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold">Payout History</h3>
              <button onClick={() => setShowPayoutHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {payoutHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No payouts recorded yet</div>
              ) : (
                <div className="space-y-4">
                  {payoutHistory.map((record) => (
                    <div key={record.id} className="border-l-4 border-primary pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">
                          ${record.amount.toFixed(2)} · {record.referral_count} account{record.referral_count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-sm text-gray-500">
                          {record.paid_at ? new Date(record.paid_at).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      {record.notes && <p className="text-sm text-gray-600">{record.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}