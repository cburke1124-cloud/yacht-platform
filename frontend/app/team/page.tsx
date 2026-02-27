"use client";

import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Shield } from 'lucide-react';
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
  created_at: string;
}

interface InviteFormData {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
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
}

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
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
        setMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
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
        alert('Team member invited successfully!');
        setShowInviteModal(false);
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
        fetchTeamMembers();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to invite team member');
      }
    } catch (error) {
      console.error('Failed to invite:', error);
      alert('Failed to invite team member');
    }
  };

  const handleUpdatePermissions = async (memberId: number, permissions: TeamMember['permissions']) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/team/members/${memberId}/permissions`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ permissions })
      });

      if (response.ok) {
        alert('Permissions updated!');
        setEditingMember(null);
        fetchTeamMembers();
      }
    } catch (error) {
      console.error('Failed to update permissions:', error);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('Are you sure? Their listings will be transferred to you.')) return;
    
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

  const handlePermissionChange = (key: keyof TeamMember['permissions'], value: boolean) => {
    if (editingMember) {
      setEditingMember({
        ...editingMember,
        permissions: {
          ...editingMember.permissions,
          [key]: value
        }
      });
    }
  };

  const handleInvitePermissionChange = (key: keyof InviteFormData['permissions'], value: boolean) => {
    setInviteForm({
      ...inviteForm,
      permissions: {
        ...inviteForm.permissions,
        [key]: value
      }
    });
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen section-light p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-secondary">Team Management</h1>
            <p className="text-dark/70 mt-1">Manage your sales team and their permissions</p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus size={20} />
            Invite Team Member
          </button>
        </div>

        {members.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users size={64} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold mb-2">No team members yet</h3>
            <p className="text-gray-600 mb-6">Invite sales reps to help manage your listings</p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Invite Your First Team Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => (
              <div key={member.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-secondary">
                      {member.first_name} {member.last_name}
                    </h3>
                    <p className="text-sm text-dark/70">{member.email}</p>
                    {member.phone && (
                      <p className="text-sm text-dark/70">{member.phone}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    member.active 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {member.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mb-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    <Shield size={12} />
                    {member.role === 'owner' ? 'Owner' : 
                     member.role === 'manager' ? 'Manager' : 'Sales Rep'}
                  </span>
                </div>

                <div className="mb-4 space-y-1">
                  <p className="text-xs font-semibold text-dark mb-2">Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {member.permissions?.can_create_listings && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">Create</span>
                    )}
                    {member.permissions?.can_edit_own_listings && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Edit Own</span>
                    )}
                    {member.permissions?.can_edit_all_listings && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">Edit All</span>
                    )}
                    {member.permissions?.can_view_inquiries && (
                      <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded">Inquiries</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingMember(member)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    <Edit size={14} className="inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-secondary mb-6">Invite Team Member</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark mb-2">First Name *</label>
                    <input
                      type="text"
                      value={inviteForm.first_name}
                      onChange={(e) => setInviteForm({...inviteForm, first_name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-dark mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={inviteForm.last_name}
                      onChange={(e) => setInviteForm({...inviteForm, last_name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-2">Email *</label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-2">Phone</label>
                  <input
                    type="tel"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({...inviteForm, phone: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-3">Permissions</label>
                  <div className="space-y-2 bg-section-light p-4 rounded-lg">
                    {[
                      { key: 'can_create_listings' as const, label: 'Create Listings' },
                      { key: 'can_edit_own_listings' as const, label: 'Edit Own Listings' },
                      { key: 'can_edit_all_listings' as const, label: 'Edit All Listings' },
                      { key: 'can_delete_listings' as const, label: 'Delete Listings' },
                      { key: 'can_view_inquiries' as const, label: 'View Inquiries' },
                      { key: 'can_manage_team' as const, label: 'Manage Team' },
                      { key: 'can_view_analytics' as const, label: 'View Analytics' }
                    ].map((perm) => (
                      <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteForm.permissions[perm.key]}
                          onChange={(e) => handleInvitePermissionChange(perm.key, e.target.checked)}
                          className="rounded text-primary"
                        />
                        <span className="text-sm text-dark">{perm.label}</span>
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
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Send Invitation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
              <h2 className="text-2xl font-bold text-secondary mb-6">
                Edit Permissions - {editingMember.first_name} {editingMember.last_name}
              </h2>
              
              <div className="space-y-3 mb-6">
                {[
                  { key: 'can_create_listings' as const, label: 'Create Listings' },
                  { key: 'can_edit_own_listings' as const, label: 'Edit Own Listings' },
                  { key: 'can_edit_all_listings' as const, label: 'Edit All Listings' },
                  { key: 'can_delete_listings' as const, label: 'Delete Listings' },
                  { key: 'can_view_inquiries' as const, label: 'View Inquiries' },
                  { key: 'can_manage_team' as const, label: 'Manage Team' },
                  { key: 'can_view_analytics' as const, label: 'View Analytics' }
                ].map((perm) => (
                  <label key={perm.key} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-section-light">
                    <input
                      type="checkbox"
                      checked={editingMember.permissions?.[perm.key] || false}
                      onChange={(e) => handlePermissionChange(perm.key, e.target.checked)}
                      className="rounded text-primary w-5 h-5"
                    />
                    <span className="text-dark">{perm.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingMember(null)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdatePermissions(editingMember.id, editingMember.permissions)}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
