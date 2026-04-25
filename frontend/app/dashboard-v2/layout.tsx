'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Ship, MessageSquare, Users, BarChart3,
  CreditCard, Settings, Key, Star, Image, FileText, ChevronLeft,
  ChevronRight, Bell, Search, Menu, X, LogOut, User, Anchor,
  HelpCircle, Zap, ChevronDown, Globe
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | null;
}

const NAV: NavItem[] = [
  { href: '/dashboard-v2', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { href: '/dashboard-v2/listings', label: 'Listings', icon: <Ship size={18} /> },
  { href: '/dashboard-v2/inquiries', label: 'Inquiries', icon: <MessageSquare size={18} /> },
  { href: '/dashboard-v2/team', label: 'Team', icon: <Users size={18} /> },
  { href: '/dashboard-v2/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
  { href: '/dashboard-v2/media', label: 'Media', icon: <Image size={18} /> },
  { href: '/dashboard-v2/featured', label: 'Featured', icon: <Star size={18} /> },
];

const BOTTOM_NAV: NavItem[] = [
  { href: '/dashboard-v2/billing', label: 'Billing', icon: <CreditCard size={18} /> },
  { href: '/dashboard-v2/api-keys', label: 'API Keys', icon: <Key size={18} /> },
  { href: '/dashboard-v2/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export default function DashboardV2Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { router.replace('/login'); return; }
        if (u.user_type !== 'dealer' && u.user_type !== 'admin') {
          router.replace('/dashboard');
        }
        setUser(u);
      });
    fetch(apiUrl('/notifications/count'), {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.count) setUnreadCount(d.count);
    }).catch(() => {});
  }, []);

  const PAGE_TITLES: Record<string, string> = {
    '/dashboard-v2': 'Overview',
    '/dashboard-v2/listings': 'Listings',
    '/dashboard-v2/inquiries': 'Inquiries',
    '/dashboard-v2/team': 'Team',
    '/dashboard-v2/analytics': 'Analytics',
    '/dashboard-v2/media': 'Media',
    '/dashboard-v2/featured': 'Featured',
    '/dashboard-v2/billing': 'Billing',
    '/dashboard-v2/api-keys': 'API Keys',
    '/dashboard-v2/settings': 'Settings',
  };
  const pageTitle = PAGE_TITLES[pathname] ?? 'Dashboard';

  const navItems = NAV.map(item => ({
    ...item,
    badge: item.href === '/dashboard-v2/inquiries' && unreadCount > 0 ? unreadCount : null,
  }));

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-[#C9A84C] rounded-lg flex items-center justify-center flex-shrink-0">
          <Anchor size={16} className="text-[#10214F]" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-sm tracking-wide" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', letterSpacing: '0.05em' }}>
            YACHTVERSAL
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard-v2' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {item.badge && item.badge > 0 && (
                <span className={`ml-auto bg-[#C9A84C] text-[#10214F] text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none ${collapsed ? 'absolute -top-1 -right-1' : ''}`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#C9A84C] rounded-r" />}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="my-3 border-t border-white/10" />

        {BOTTOM_NAV.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className={`px-2 py-3 border-t border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center text-[#10214F] text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-medium truncate">{user?.name || user?.email || 'Dealer'}</p>
              <p className="text-white/40 text-xs truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-white/40 hover:text-white transition-colors" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button onClick={handleLogout} className="text-white/40 hover:text-white transition-colors p-2" title="Sign out">
            <LogOut size={16} />
          </button>
        )}
      </div>

      {/* Collapse toggle (desktop) */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="hidden lg:flex items-center justify-center w-full py-2 text-white/30 hover:text-white hover:bg-white/5 transition-colors border-t border-white/10"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#0d1a40] transition-all duration-200 ${collapsed ? 'w-[64px]' : 'w-[220px]'} flex-shrink-0`}
        style={{ background: 'linear-gradient(180deg, #0d1a40 0%, #10214F 100%)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 flex flex-col w-[220px]"
            style={{ background: 'linear-gradient(180deg, #0d1a40 0%, #10214F 100%)' }}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 h-14 flex items-center gap-3 px-5 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-800 p-1"
          >
            <Menu size={20} />
          </button>
          <p className="hidden lg:block text-sm font-semibold text-gray-800">{pageTitle}</p>
          <div className="flex-1" />
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-gray-300"
          >
            <Globe size={12} /> Classic view
          </Link>
          <button className="relative text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#C9A84C] rounded-full" />
            )}
          </button>
          <div className="w-8 h-8 rounded-full bg-[#10214F] flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#10214F]/10">
            {initials}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
