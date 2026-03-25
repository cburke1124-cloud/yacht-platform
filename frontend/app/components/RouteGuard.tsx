'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredUserType?: 'admin' | 'salesman' | 'dealer' | 'team_member' | 'private' | 'buyer' | 'user';
  allowedUserTypes?: Array<'admin' | 'salesman' | 'dealer' | 'team_member' | 'private' | 'buyer' | 'user'>;
  requiresAuth?: boolean;
}

export default function RouteGuard({ 
  children, 
  requiredUserType, 
  allowedUserTypes,
  requiresAuth = true 
}: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isAuthenticated, redirectToDashboard } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Public routes that don't require auth
    const publicRoutes = ['/', '/listings', '/dealers', '/blog', '/login', '/register'];
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

    // If route requires auth and user is not authenticated
    if (requiresAuth && !isAuthenticated && !isPublicRoute) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // If user is authenticated but shouldn't be on this page
    if (isAuthenticated && user) {
      // Check specific user type requirement
      if (requiredUserType && user.user_type !== requiredUserType) {
        // Redirect to appropriate dashboard
        alert(`This page requires ${requiredUserType} access`);
        redirectToDashboard(user.user_type);
        return;
      }

      // Check allowed user types
      if (allowedUserTypes && allowedUserTypes.length > 0) {
        if (!allowedUserTypes.includes(user.user_type)) {
          alert(`Access denied. This page is only for ${allowedUserTypes.join(', ')} users.`);
          redirectToDashboard(user.user_type);
          return;
        }
      }

      // Specific route checks
      if (pathname.startsWith('/admin') && user.user_type !== 'admin') {
        alert('Admin access required');
        redirectToDashboard(user.user_type);
        return;
      }

      if (pathname.startsWith('/sales-rep') && user.user_type !== 'salesman' && user.user_type !== 'admin') {
        alert('Sales rep access required');
        redirectToDashboard(user.user_type);
        return;
      }

      if (pathname.startsWith('/dashboard') && user.user_type !== 'dealer' && user.user_type !== 'admin' && user.user_type !== 'team_member') {
        alert('Broker access required');
        redirectToDashboard(user.user_type);
        return;
      }

      if (pathname === '/account' && user.user_type !== 'user') {
        redirectToDashboard(user.user_type);
        return;
      }
    }
  }, [loading, isAuthenticated, user, pathname, requiredUserType, allowedUserTypes, router, redirectToDashboard, requiresAuth]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-dark/60">Loading...</p>
        </div>
      </div>
    );
  }

  // If requires auth but not authenticated, show nothing (will redirect)
  if (requiresAuth && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}


// HOC for easy route protection
export function withRouteGuard<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requiredUserType?: 'admin' | 'salesman' | 'dealer' | 'team_member' | 'private' | 'buyer' | 'user';
    allowedUserTypes?: Array<'admin' | 'salesman' | 'dealer' | 'team_member' | 'private' | 'buyer' | 'user'>;
    requiresAuth?: boolean;
  }
) {
  return function GuardedComponent(props: P) {
    return (
      <RouteGuard {...options}>
        <Component {...props} />
      </RouteGuard>
    );
  };
}


// Specific guards for common use cases
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard requiredUserType="admin" requiresAuth={true}>
      {children}
    </RouteGuard>
  );
}

export function SalesRepRouteGuard({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedUserTypes={['salesman', 'admin']} requiresAuth={true}>
      {children}
    </RouteGuard>
  );
}

export function DealerRouteGuard({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedUserTypes={['dealer', 'admin']} requiresAuth={true}>
      {children}
    </RouteGuard>
  );
}

export function UserRouteGuard({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard requiredUserType="user" requiresAuth={true}>
      {children}
    </RouteGuard>
  );
}