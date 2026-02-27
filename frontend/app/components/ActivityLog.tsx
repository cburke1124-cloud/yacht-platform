'use client';

import { useState, useEffect } from 'react';
import { Activity, MapPin, Monitor, Clock, Shield, Key, FileText, Mail, LogIn, LogOut, Edit, Trash2 } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface ActivityLogEntry {
  id: number;
  action: string;
  details: any;
  ip_address: string;
  created_at: string;
}

export default function ActivityLogComponent() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchLogs();
  }, [limit]);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/activity-log?limit=${limit}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Failed to fetch activity log:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
      case 'login_2fa':
        return <LogIn className="text-green-600" size={20} />;
      case 'logout':
        return <LogOut className="text-gray-600" size={20} />;
      case 'register':
        return <Shield className="text-blue-600" size={20} />;
      case 'password_reset':
      case 'password_change':
        return <Key className="text-yellow-600" size={20} />;
      case 'email_verified':
        return <Mail className="text-green-600" size={20} />;
      case 'listing_published':
      case 'listing_created':
        return <FileText className="text-blue-600" size={20} />;
      case 'listing_updated':
        return <Edit className="text-gray-600" size={20} />;
      case 'listing_deleted':
        return <Trash2 className="text-red-600" size={20} />;
      case '2fa_enabled':
      case '2fa_disabled':
        return <Shield className="text-purple-600" size={20} />;
      default:
        return <Activity className="text-gray-600" size={20} />;
    }
  };

  const getActionLabel = (action: string, details: any) => {
    switch (action) {
      case 'login':
        return 'Signed in';
      case 'login_2fa':
        return `Signed in with 2FA (${details.method || 'email'})`;
      case 'logout':
        return 'Signed out';
      case 'register':
        return 'Account created';
      case 'password_reset':
        return 'Password reset via email';
      case 'password_change':
        return 'Password changed';
      case 'email_verified':
        return 'Email verified';
      case 'listing_published':
        return `Published listing #${details.listing_id}`;
      case 'listing_created':
        return `Created listing #${details.listing_id}`;
      case 'listing_updated':
        return `Updated listing #${details.listing_id}`;
      case 'listing_deleted':
        return `Deleted listing #${details.listing_id}`;
      case '2fa_enabled':
        return 'Enabled two-factor authentication';
      case '2fa_disabled':
        return 'Disabled two-factor authentication';
      default:
        return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold">Activity Log</h2>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold">Activity Log</h2>
        </div>
        
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value={25}>Last 25 activities</option>
          <option value={50}>Last 50 activities</option>
          <option value={100}>Last 100 activities</option>
        </select>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">No activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                {getActionIcon(log.action)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {getActionLabel(log.action, log.details)}
                </p>
                
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(log.created_at)}
                  </div>
                  
                  {log.ip_address && (
                    <div className="flex items-center gap-1">
                      <MapPin size={12} />
                      {log.ip_address}
                    </div>
                  )}
                  
                  {log.details.remember_me && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Monitor size={12} />
                      Remembered
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>🔒 Security Tip:</strong> Review your activity regularly. If you notice any suspicious activity, 
          change your password immediately and contact support.
        </p>
      </div>
    </div>
  );
}