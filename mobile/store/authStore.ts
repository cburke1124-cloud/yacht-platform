import { create } from 'zustand';
import { authApi } from '@/lib/api';
import { saveToken, clearTokens, cacheUser } from '@/lib/storage';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: 'buyer' | 'dealer';
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  hydrateFromCache: () => Promise<User | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  signIn: async (email, password) => {
    const tokens = await authApi.login(email, password);
    await saveToken(tokens.access_token);
    const user = await authApi.me();
    await cacheUser(user);
    set({ user, isAuthenticated: true });
  },

  register: async (payload) => {
    const tokens = await authApi.register({ ...payload, agreed_terms: true });
    await saveToken(tokens.access_token);
    const user = await authApi.me();
    await cacheUser(user);
    set({ user, isAuthenticated: true });
  },

  signOut: async () => {
    await clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    try {
      const user = await authApi.me();
      await cacheUser(user);
      set({ user });
    } catch {
      // Token expired or network error ΓÇö the axios interceptor handles 401
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  hydrateFromCache: async () => {
    const { getToken } = await import('@/lib/storage');
    const token = await getToken();
    if (!token) {
      set({ isLoading: false });
      return null;
    }
    try {
      const user = await authApi.me();
      await cacheUser(user);
      set({ user, isAuthenticated: true, isLoading: false });
      return user;
    } catch {
      await clearTokens();
      set({ isLoading: false });
      return null;
    }
  },
}));
