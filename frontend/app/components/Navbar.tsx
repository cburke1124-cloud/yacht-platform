'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';
import {
  Menu, X, Ship, User, PlusCircle, Bell, MessageSquare, 
  Heart, Search, Settings, ChevronDown, DollarSign, BarChart3
} from 'lucide-react';

type UserType = 'admin' | 'salesman' | 'dealer' | 'user';

interface NavUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  user_type: UserType;
  company_name?: string;
  permissions?: {
    can_create_listings: boolean;
    can_manage_team: boolean;
  };
}

// ─── Dropdown Menu Component ─────────────────────────────────────────────────
function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-dark/80 hover:text-primary font-medium transition-colors text-sm"
        style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
      >
        {label}
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg overflow-hidden z-50"
          style={{ border: '1px solid rgba(0,0,0,0.05)', minWidth: 200 }}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-5 py-3 text-sm font-medium transition-colors hover:bg-gray-50"
              style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Navbar ─────────────────────────────────────────────────────────────
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<NavUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [mobileSellOpen, setMobileSellOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        setLoading(false);
        return;
      }

      const response = await fetch(apiUrl('/auth/me'), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Not authenticated');

      const userData = await response.json();
      const normalizedUser = {
        ...userData,
        user_type: normalizeUserType(userData.user_type)
      };

      setUser(normalizedUser);
      setIsLoggedIn(true);
      fetchUnreadCount(token);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      setIsLoggedIn(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const normalizeUserType = (type: string): UserType => {
    const normalized = type.toLowerCase();
    if (['admin', 'salesman', 'dealer', 'user'].includes(normalized)) {
      return normalized as UserType;
    }
    return 'user';
  };

  const fetchUnreadCount = async (token: string) => {
    try {
      const response = await fetch(apiUrl('/notifications?unread_only=true'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(Array.isArray(data) ? data.length : 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUser(null);
    setShowUserMenu(false);
    router.push('/');
  };

  const getDashboardLink = () => {
    if (!user) return '/';
    switch (user.user_type) {
      case 'admin': return '/admin';
      case 'salesman': return '/sales-rep/dashboard';
      case 'dealer': return '/dashboard';
      case 'user': return '/account';
      default: return '/';
    }
  };

  const canCreateListings = () => {
    if (!user) return false;
    return user.user_type === 'dealer' || 
           user.user_type === 'admin' || 
           user.permissions?.can_create_listings === true;
  };

  const showSavedFeatures = () => {
    if (!user) return false;
    return user.user_type === 'user' || user.user_type === 'dealer';
  };

  const getUserDisplayName = () => {
    if (!user) return 'Account';
    if (user.first_name) {
      return `${user.first_name}${user.last_name ? ' ' + user.last_name.charAt(0) + '.' : ''}`;
    }
    return user.email.split('@')[0];
  };

  if (pathname === '/login' || pathname === '/register') return null;

  // ─── Nav link definitions (matches Figma) ───────────────────────────────
  const sellItems = [
    { label: 'Yacht Brokers', href: '/sell/brokers' },
    { label: 'Private Sellers', href: '/sell/private' },
  ];

  const resourceItems = [
    { label: 'How Buying Works / Buyer\'s Guide', href: '/resources/how-buying-works' },
    { label: 'Financing', href: '/resources/financing' },
    { label: 'Blog', href: '/blog' },
    { label: 'Boat Shows', href: '/resources/boat-shows' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 py-2">

          {/* ── Logo ── */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              {!logoError ? (
                <Image
                  src="/logo/logo-full.png"
                  alt="YachtVersal"
                  width={280}
                  height={70}
                  className="h-full w-auto"
                  onError={() => setLogoError(true)}
                  priority
                />
              ) : (
                <>
                  <Ship className="h-7 w-7 text-primary" />
                  <span className="text-xl font-bold text-dark ml-2">
                    Yacht<span className="text-primary">Versal</span>
                  </span>
                </>
              )}
              <span
                className="ml-2 text-[10px] font-medium uppercase tracking-[0.08em] text-dark/60"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Early Access
              </span>
            </Link>
          </div>

          {/* ── Desktop Nav Links ── */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/listings"
              className="text-dark/80 hover:text-primary font-medium transition-colors text-sm"
              style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
            >
              Search Listings
            </Link>

            <NavDropdown label="Sell / List" items={sellItems} />
            <NavDropdown label="Resources" items={resourceItems} />
          </div>

          {/* ── Right Side ── */}
          <div className="hidden md:flex items-center space-x-3">
            {loading ? (
              <div className="w-32 h-10 bg-gray-100 animate-pulse rounded" />
            ) : isLoggedIn && user ? (
              <>
                {/* Messages */}
                <Link
                  href="/messages"
                  className="relative p-2 text-dark/70 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                  title="Messages"
                >
                  <MessageSquare size={20} />
                </Link>

                {/* Notifications */}
                <Link
                  href="/notifications"
                  className="relative p-2 text-dark/70 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                  title="Notifications"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 text-xs flex items-center justify-center text-white bg-primary rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* List a Yacht CTA */}
                {canCreateListings() && (
                  <Link
                    href="/listings/create"
                    className="px-5 py-2 text-white font-medium text-sm rounded-xl transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#01BBDC', borderRadius: 12, fontFamily: 'Poppins, sans-serif' }}
                  >
                    List a Yacht
                  </Link>
                )}

                {/* User menu */}
                <div ref={userMenuRef} className="relative">
                  <button
                    onClick={() => setShowUserMenu((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium text-dark">{getUserDisplayName()}</span>
                    <ChevronDown
                      size={14}
                      className={`text-dark/50 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showUserMenu && (
                    <div
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg overflow-hidden z-50"
                      style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                    >
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-dark">{getUserDisplayName()}</p>
                        <p className="text-xs text-dark/50 truncate">{user.email}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                          user.user_type === 'admin' ? 'bg-accent/20 text-dark' :
                          user.user_type === 'salesman' ? 'bg-primary/20 text-dark' :
                          user.user_type === 'dealer' ? 'bg-primary/10 text-dark' :
                          'bg-gray-100 text-dark'
                        }`}>
                          {user.user_type === 'salesman' ? 'Sales Rep' :
                           user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1)}
                        </span>
                      </div>

                      {/* Dashboard */}
                      <Link
                        href={getDashboardLink()}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark/80 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <BarChart3 size={16} />
                        Dashboard
                      </Link>

                      {/* Saved features */}
                      {showSavedFeatures() && (
                        <>
                          <Link
                            href="/saved-listings"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark/80 hover:bg-gray-50 transition-colors"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <Heart size={16} />
                            Saved Yachts
                          </Link>
                          <Link
                            href="/search-alerts"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark/80 hover:bg-gray-50 transition-colors"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <Search size={16} />
                            Saved Searches
                          </Link>
                          <Link
                            href="/price-alerts"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark/80 hover:bg-gray-50 transition-colors"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <DollarSign size={16} />
                            Price Alerts
                          </Link>
                        </>
                      )}

                      <div className="border-t border-gray-100">
                        <Link
                          href="/settings"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark/80 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Settings size={16} />
                          Settings
                        </Link>
                      </div>

                      <div className="border-t border-gray-100">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors"
                        >
                          <X size={16} />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-dark/80 hover:text-primary rounded-lg transition-colors font-medium text-sm"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Sign In
                </Link>
                <Link
                  href="/listings/create"
                  className="px-6 py-2 text-white rounded-xl font-medium text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#01BBDC', borderRadius: 12, fontFamily: 'Poppins, sans-serif' }}
                >
                  List a Yacht
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile menu button ── */}
          <div className="md:hidden flex items-center gap-2">
            {isLoggedIn && (
              <>
                <Link href="/notifications" className="relative p-2 text-dark/70">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 text-xs flex items-center justify-center text-white bg-primary rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link href="/messages" className="p-2 text-dark/70">
                  <MessageSquare size={20} />
                </Link>
              </>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-dark/70 hover:text-primary"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-4 py-4 space-y-1">

            {/* Search Listings */}
            <Link
              href="/listings"
              className="block text-dark/80 hover:text-primary font-medium py-2.5 px-2"
              style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Search Listings
            </Link>

            {/* Sell / List accordion */}
            <div>
              <button
                onClick={() => setMobileSellOpen((v) => !v)}
                className="w-full flex items-center justify-between text-dark/80 font-medium py-2.5 px-2"
                style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
              >
                Sell / List
                <ChevronDown
                  size={16}
                  className={`transition-transform ${mobileSellOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {mobileSellOpen && (
                <div className="pl-4 space-y-1 pb-2">
                  {sellItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block py-2 px-2 text-sm text-dark/70 hover:text-primary"
                      style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Resources accordion */}
            <div>
              <button
                onClick={() => setMobileResourcesOpen((v) => !v)}
                className="w-full flex items-center justify-between text-dark/80 font-medium py-2.5 px-2"
                style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
              >
                Resources
                <ChevronDown
                  size={16}
                  className={`transition-transform ${mobileResourcesOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {mobileResourcesOpen && (
                <div className="pl-4 space-y-1 pb-2">
                  {resourceItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block py-2 px-2 text-sm text-dark/70 hover:text-primary"
                      style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Auth section */}
            <div className="pt-4 border-t border-gray-200 space-y-2">
              {loading ? (
                <div className="h-10 bg-gray-100 animate-pulse rounded" />
              ) : isLoggedIn && user ? (
                <>
                  <div className="text-sm font-semibold text-dark px-2 py-2 bg-gray-50 rounded">
                    {user.first_name || user.email}
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      user.user_type === 'admin' ? 'bg-accent/20 text-dark' :
                      user.user_type === 'salesman' ? 'bg-primary/20 text-dark' :
                      user.user_type === 'dealer' ? 'bg-primary/10 text-dark' :
                      'bg-gray-100 text-dark'
                    }`}>
                      {user.user_type === 'salesman' ? 'Sales Rep' :
                       user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1)}
                    </span>
                  </div>

                  {canCreateListings() && (
                    <Link
                      href="/listings/create"
                      className="block w-full px-4 py-2 text-white text-center rounded-xl font-medium text-sm"
                      style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      + List a Yacht
                    </Link>
                  )}

                  <Link
                    href={getDashboardLink()}
                    className="block w-full px-4 py-2 text-dark/80 text-center border border-gray-200 rounded-lg font-medium text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>

                  {showSavedFeatures() && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs font-semibold text-dark/60 uppercase px-2 py-2">Saved</p>
                      <Link href="/saved-listings" className="block px-2 py-2 text-sm text-dark/80" onClick={() => setMobileMenuOpen(false)}>
                        <Heart className="inline w-4 h-4 mr-2" />Saved Yachts
                      </Link>
                      <Link href="/search-alerts" className="block px-2 py-2 text-sm text-dark/80" onClick={() => setMobileMenuOpen(false)}>
                        <Search className="inline w-4 h-4 mr-2" />Saved Searches
                      </Link>
                      <Link href="/price-alerts" className="block px-2 py-2 text-sm text-dark/80" onClick={() => setMobileMenuOpen(false)}>
                        <DollarSign className="inline w-4 h-4 mr-2" />Price Alerts
                      </Link>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200">
                    <Link href="/settings" className="block px-2 py-2 text-sm text-dark/80" onClick={() => setMobileMenuOpen(false)}>
                      <Settings className="inline w-4 h-4 mr-2" />Settings
                    </Link>
                  </div>

                  <button
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="block w-full px-4 py-2 text-primary text-center border border-primary/30 rounded-lg font-medium text-sm"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="block w-full px-4 py-2 text-dark/80 text-center border border-gray-200 rounded-lg font-medium text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/listings/create"
                    className="block w-full px-4 py-2 text-white text-center rounded-xl font-medium text-sm"
                    style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    List a Yacht
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}