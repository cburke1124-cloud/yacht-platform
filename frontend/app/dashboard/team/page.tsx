'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Mail, Phone, Shield, X } from 'lucide-react';
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

export default function TeamManagementPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: 'changeme123',
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
          password: 'changeme123',
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

  const handleUpdatePermissions = async (memberId: number, permissions: any) => {
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
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-primary/10">
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
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-primary/10">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-secondary">Edit Permissions</h2>
              <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-3">
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
                  onClick={() => handleUpdatePermissions(editingMember.id, editingMember.permissions)}
                  className="flex-1 px-4 py-2 bg-primary text-light rounded-lg hover-primary"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}