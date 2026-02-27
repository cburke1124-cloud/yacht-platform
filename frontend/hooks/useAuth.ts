import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

export type UserType = 'admin' | 'salesman' | 'dealer' | 'team_member' | 'private' | 'buyer' | 'user';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  user_type: UserType;
  company_name?: string;
  phone?: string;
  subscription_tier?: string;
  parent_dealer_id?: number;
  assigned_sales_rep_id?: number;
  permissions?: {
    can_create_listings: boolean;
    can_manage_team: boolean;
    can_view_all_listings: boolean;
    can_modify_dealer_page: boolean;
    can_view_analytics: boolean;
  };
}

type PermissionKey = keyof NonNullable<User['permissions']>;

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await fetch(apiUrl('/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const userData = await response.json();
      
      // Normalize user type
      const normalizedUser = {
        ...userData,
        user_type: normalizeUserType(userData.user_type)
      };

      setUser(normalizedUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const normalizeUserType = (type: string): UserType => {
    const normalized = type.toLowerCase();
    if (['admin', 'salesman', 'dealer', 'team_member', 'private', 'buyer', 'user'].includes(normalized)) {
      return normalized as UserType;
    }
    // Default to user if type is unknown
    return 'user';
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      
      await checkAuth();
      
      // Redirect based on user type
      redirectToDashboard(data.user_type);
      
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    router.push('/');
  };

  const redirectToDashboard = (userType: string) => {
    const normalized = normalizeUserType(userType);
    
    switch (normalized) {
      case 'admin':
        router.push('/admin');
        break;
      case 'salesman':
        router.push('/sales-rep/dashboard');
        break;
      case 'dealer':
        router.push('/dashboard');
        break;
      case 'user':
        router.push('/account');
        break;
      default:
        router.push('/');
    }
  };

  const hasPermission = (permission: PermissionKey): boolean => {
    if (!user) return false;
    
    // Admins have all permissions
    if (user.user_type === 'admin') return true;
    
    // Sales reps have limited permissions
    if (user.user_type === 'salesman') {
      return ['can_view_analytics'].includes(permission);
    }
    
    // Check user-specific permissions
    return user.permissions?.[permission] ?? false;
  };

  const canAccessRoute = (route: string): boolean => {
    if (!user) return false;

    const userType = user.user_type;

    // Admin routes
    if (route.startsWith('/admin')) {
      return userType === 'admin';
    }

    // Sales rep routes
    if (route.startsWith('/sales-rep')) {
      return userType === 'salesman' || userType === 'admin';
    }

    // Dealer dashboard routes
    if (route.startsWith('/dashboard')) {
      return userType === 'dealer' || userType === 'admin';
    }

    // User account routes
    if (route.startsWith('/account')) {
      return userType === 'user';
    }

    // Listing creation - dealers and team members with permission
    if (route.startsWith('/listings/create')) {
          if (userType === 'admin') return true;

          const tier = (user.subscription_tier || '').toLowerCase();
          const paidDealerTiers = new Set(['basic', 'plus', 'pro', 'premium']);
          const paidPrivateTiers = new Set(['private_basic', 'private_plus', 'private_pro']);

          return (userType === 'dealer' && paidDealerTiers.has(tier)) ||
            (userType === 'private' && paidPrivateTiers.has(tier)) ||
            hasPermission('can_create_listings');
    }

    // Messages - all authenticated users
    if (route.startsWith('/messages')) {
      return true;
    }

    // Public routes
    return true;
  };

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    checkAuth,
    hasPermission,
    canAccessRoute,
    redirectToDashboard
  };
}
