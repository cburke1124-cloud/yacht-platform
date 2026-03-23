'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Edit, Trash2, Mail, Phone, Shield, X, LayoutDashboard, MessageSquare, ClipboardList, ChevronLeft } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface TeamMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  permissions: {
    can_create_listings: boolean;
    can_edit_own_listings: boolean;
    can_edit_all_listings: boolean;
    can_delete_listings: boolean;
    can_view_inquiries: boolean;
    can_manage_team: boolean;
    can_view_analytics: boolean;
  };
  active: boolean;
  public_profile: boolean;
  created_at: string;
}

// ─── Member overview types ──────────────────────────────────────────────────
interface MemberMessage {
  id: number;
  subject: string;
  body: string;
  sender_id: number;
  recipient_id: number;
  sender_name: string;
  listing_id: number | null;
  created_at: string;
}

interface MemberInquiry {
  id: number;
  sender_name: string;
  sender_email: string;
  lead_stage: string;
  lead_score: number;
  listing_title: string | null;
  created_at: string;
}

interface MemberOverview {
  member: {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
    active: boolean;
    joined_at: string;
  };
  listings: { total: number; active: number };
  inquiries: { total: number; by_stage: Record<string, number> };
  messages: { total: number; pending: number };
}

const STAGE_COLORS: Record<string, string> = {
  new:       'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-yellow-100 text-yellow-700',
  proposal:  'bg-orange-100 text-orange-700',
  won:       'bg-green-100 text-green-700',
  lost:      'bg-red-100 text-red-700',
};

export default function TeamManagementPage() {
  const router = useRouter();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { router.replace('/login'); return; }
        const perms = (u.permissions || {}) as Record<string, boolean>;
        const canManage = u.user_type === 'dealer' || u.user_type === 'admin' ||
          !!(perms.manage_team ?? perms.can_manage_team);
        if (!canManage) router.replace('/dashboard');
      });
  }, []);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // Member overview state
  const [viewingMemberId, setViewingMemberId] = useState<number | null>(null);
  const [overview, setOverview] = useState<MemberOverview | null>(null);
  const [memberMessages, setMemberMessages] = useState<MemberMessage[]>([]);
  const [memberInquiries, setMemberInquiries] = useState<MemberInquiry[]>([]);
  const [overviewTab, setOverviewTab] = useState<'overview' | 'messages' | 'leads'>('overview');
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'team_member',
    permissions: {
      can_create_listings: true,
      can_edit_own_listings: true,
      can_edit_all_listings: false,
      can_delete_listings: false,
      can_view_inquiries: true,
      can_manage_team: false,
      can_view_analytics: true
    }
  });

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/team/members'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const openMemberDashboard = async (memberId: number) => {
    setViewingMemberId(memberId);
    setOverviewTab('overview');
    setOverviewLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [ovRes, msgRes, inqRes] = await Promise.all([
        fetch(apiUrl(`/team/members/${memberId}/overview`), { headers }),
        fetch(apiUrl(`/team/members/${memberId}/messages?limit=30`), { headers }),
        fetch(apiUrl(`/team/members/${memberId}/inquiries?limit=30`), { headers }),
      ]);
      if (ovRes.ok)  setOverview(await ovRes.json());
      if (msgRes.ok) { const d = await msgRes.json(); setMemberMessages(d.items ?? d); }
      if (inqRes.ok) { const d = await inqRes.json(); setMemberInquiries(d.items ?? d); }
    } catch (e) {
      console.error('Failed to load member dashboard:', e);
    } finally {
      setOverviewLoading(false);
    }
  };

  const closeMemberDashboard = () => {
    setViewingMemberId(null);
    setOverview(null);
    setMemberMessages([]);
    setMemberInquiries([]);
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.first_name) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/team/invite'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inviteForm)
      });

      if (response.ok) {
        alert('Team member invited successfully! They will receive an email with login instructions.');
        setShowInviteModal(false);
        fetchTeamMembers();
        // Reset form
        setInviteForm({
          email: '',
          first_name: '',
          last_name: '',
          phone: '',
          role: 'team_member',
          permissions: {
            can_create_listings: true,
            can_edit_own_listings: true,
            can_edit_all_listings: false,
            can_delete_listings: false,
            can_view_inquiries: true,
            can_manage_team: false,
            can_view_analytics: true
          }
        });
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to invite team member');
      }
    } catch (error) {
      console.error('Failed to invite:', error);
      alert('Failed to invite team member');
    }
  };

  const handleUpdatePermissions = async (memberId: number, permissions: any, public_profile: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/team/members/${memberId}/permissions`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ permissions, public_profile })
      });

      if (response.ok) {
        alert('Permissions updated successfully');
        fetchTeamMembers();
        setEditingMember(null);
      }
    } catch (error) {
      console.error('Failed to update permissions:', error);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('Remove this team member? Their listings will be reassigned to you.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/team/members/${memberId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Team member removed');
        fetchTeamMembers();
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-secondary">Team Management</h1>
            <p className="text-gray-600 mt-1">Manage your sales team and their permissions</p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-light rounded-lg hover-primary transition-colors"
          >
            <UserPlus size={20} />
            Invite Team Member
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6">
            <p className="text-gray-600 text-sm mb-1">Total Members</p>
            <p className="text-3xl font-bold text-secondary">{teamMembers.length}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-gray-600 text-sm mb-1">Active Members</p>
            <p className="text-3xl font-bold text-emerald-600">
              {teamMembers.filter(m => m.active).length}
            </p>
          </div>
          <div className="glass-card p-6">
            <p className="text-gray-600 text-sm mb-1">Sales Reps</p>
            <p className="text-3xl font-bold text-primary">
              {teamMembers.filter(m => m.role === 'team_member').length}
            </p>
          </div>
        </div>

        {/* Team Members List */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-primary/10">
            <h2 className="text-xl font-semibold text-secondary">Team Members</h2>
          </div>

          <div className="divide-y">
            {teamMembers.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <UserPlus size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">No team members yet</p>
                <p className="text-sm mb-4">Invite your sales team to start collaborating</p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-6 py-3 bg-primary text-light rounded-lg hover-primary"
                >
                  Invite First Member
                </button>
              </div>
            ) : (
              teamMembers.map((member) => (
                <div key={member.id} className="p-6 hover:bg-soft transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-semibold text-lg">
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg text-secondary">
                            {member.first_name} {member.last_name}
                          </h3>
                          {!member.active && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Mail size={14} />
                            {member.email}
                          </div>
                          {member.phone && (
                            <div className="flex items-center gap-2">
                              <Phone size={14} />
                              {member.phone}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Shield size={14} />
                            <span className="capitalize">{member.role.replace('_', ' ')}</span>
                          </div>
                        </div>

                        {/* Permissions Summary */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {member.permissions.can_create_listings && (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                              Create Listings
                            </span>
                          )}
                          {member.permissions.can_edit_all_listings && (
                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                              Edit All
                            </span>
                          )}
                          {member.permissions.can_view_inquiries && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                              View Inquiries
                            </span>
                          )}
                          {member.permissions.can_view_analytics && (
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">
                              Analytics
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openMemberDashboard(member.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View Dashboard"
                      >
                        <LayoutDashboard size={18} />
                      </button>
                      <button
                        onClick={() => setEditingMember(member)}
                        className="p-2 text-gray-600 hover:bg-soft rounded transition-colors"
                        title="Edit Permissions"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-primary/10">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-secondary">Invite Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={inviteForm.first_name}
                    onChange={(e) => setInviteForm({...inviteForm, first_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm({...inviteForm, last_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({...inviteForm, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Permissions</h3>
                <div className="space-y-2">
                  {Object.entries(inviteForm.permissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setInviteForm({
                          ...inviteForm,
                          permissions: {...inviteForm.permissions, [key]: e.target.checked}
                        })}
                        className="rounded text-primary"
                      />
                      <span className="text-sm text-gray-700">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  className="flex-1 px-6 py-3 bg-primary text-light rounded-lg hover-primary"
                >
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-primary/10">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-secondary">Edit Permissions</h2>
              <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <label className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <input type="checkbox" checked={editingMember.public_profile ?? false}
                  onChange={(e) => setEditingMember({...editingMember, public_profile: e.target.checked})}
                  className="rounded text-primary" />
                <div>
                  <span className="text-sm font-medium text-gray-800">Public Broker Profile</span>
                  <p className="text-xs text-gray-500">Appears as a broker on the brokerage's public page</p>
                </div>
              </label>
              {Object.entries(editingMember.permissions).map(([key, value]) => (
                <label key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setEditingMember({
                      ...editingMember,
                      permissions: {...editingMember.permissions, [key]: e.target.checked}
                    })}
                    className="rounded text-primary"
                  />
                  <span className="text-sm text-gray-700">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </label>
              ))}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingMember(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdatePermissions(editingMember.id, editingMember.permissions, editingMember.public_profile ?? false)}
                  className="flex-1 px-4 py-2 bg-primary text-light rounded-lg hover-primary"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Member Dashboard Drawer */}
      {viewingMemberId !== null && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={closeMemberDashboard}>
          <div
            className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
              <button onClick={closeMemberDashboard} className="text-gray-400 hover:text-gray-600">
                <ChevronLeft size={22} />
              </button>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{overview?.member.name ?? 'Team Member'}</p>
                <p className="text-xs text-gray-400">{overview?.member.email}</p>
              </div>
              <button onClick={closeMemberDashboard} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {([
                { key: 'overview', label: 'Overview', icon: LayoutDashboard },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
                { key: 'leads',    label: 'Leads',    icon: ClipboardList },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setOverviewTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    overviewTab === key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            {overviewLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* ── Overview tab ───────────────────────────────────── */}
                {overviewTab === 'overview' && overview && (
                  <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Listings',    value: overview.listings.total },
                        { label: 'Active',      value: overview.listings.active },
                        { label: 'Total Leads', value: overview.inquiries.total },
                        { label: 'Messages',    value: overview.messages.total },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-gray-800">{value}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Pending messages */}
                    {overview.messages.pending > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-800">
                        {overview.messages.pending} message(s) awaiting response
                      </div>
                    )}

                    {/* Leads by stage */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Lead Pipeline
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(overview.inquiries.by_stage).map(([stage, cnt]) => (
                          <span
                            key={stage}
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {stage}: {cnt}
                          </span>
                        ))}
                        {Object.keys(overview.inquiries.by_stage).length === 0 && (
                          <p className="text-sm text-gray-400 italic">No leads yet.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Messages tab ───────────────────────────────────── */}
                {overviewTab === 'messages' && (
                  <>
                    {memberMessages.length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-10">No messages found.</p>
                    ) : (
                      <div className="space-y-2">
                        {memberMessages.map((msg) => (
                          <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-start gap-2">
                              <p className="font-medium text-sm text-gray-800 truncate flex-1">
                                {msg.subject || '(No subject)'}
                              </p>
                              <p className="text-xs text-gray-400 whitespace-nowrap">
                                {new Date(msg.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">From: {msg.sender_name}</p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{msg.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── Leads tab ──────────────────────────────────────── */}
                {overviewTab === 'leads' && (
                  <>
                    {memberInquiries.length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-10">No leads assigned.</p>
                    ) : (
                      <div className="space-y-2">
                        {memberInquiries.map((inq) => (
                          <div key={inq.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-800">{inq.sender_name}</p>
                                <p className="text-xs text-gray-500 truncate">{inq.sender_email}</p>
                                {inq.listing_title && (
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                                    Listing: {inq.listing_title}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STAGE_COLORS[inq.lead_stage] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {inq.lead_stage}
                                </span>
                                <span className="text-xs text-gray-400">
                                  Score: {inq.lead_score}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}