'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Mail } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  // Poll for unread counts every 30s once user is loaded
  useEffect(() => {
    if (!user) return;
    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCounts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(apiUrl('/notifications/count'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifs(data.notifications ?? 0);
        setUnreadMessages(data.messages ?? 0);
      }
    } catch {}
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(apiUrl('/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Not authenticated');
      }

      const userData = await response.json();
      
      if (userData.user_type !== 'admin') {
        alert('Admin access required');
        router.push('/');
        return;
      }

      setUser(userData);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin top bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <span className="text-sm font-semibold text-gray-700">Admin Dashboard</span>
        <div className="flex items-center gap-2">
          <Link
            href="/messages"
            className="relative p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Messages"
          >
            <Mail size={20} />
            {unreadMessages > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 text-xs flex items-center justify-center text-white bg-red-500 rounded-full">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
          <Link
            href="/notifications"
            className="relative p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadNotifs > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 text-xs flex items-center justify-center text-white bg-primary rounded-full">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1.5 text-sm text-gray-600 hover:text-primary border border-gray-200 rounded-lg hover:border-primary transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}