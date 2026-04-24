import { Platform } from 'react-native';

// expo-secure-store is native-only; fall back to localStorage on web.
const store = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    const SecureStore = await import('expo-secure-store');
    return SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    const SecureStore = await import('expo-secure-store');
    return SecureStore.deleteItemAsync(key);
  },
};

const TOKEN_KEY = 'yachtversal_access_token';
const USER_KEY = 'yachtversal_user';

export const getToken = (): Promise<string | null> => store.getItemAsync(TOKEN_KEY);

export const saveToken = (token: string): Promise<void> => store.setItemAsync(TOKEN_KEY, token);

export const clearTokens = async (): Promise<void> => {
  await store.deleteItemAsync(TOKEN_KEY);
  await store.deleteItemAsync(USER_KEY);
};

export const getCachedUser = async () => {
  const raw = await store.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const cacheUser = async (user: object): Promise<void> => {
  await store.setItemAsync(USER_KEY, JSON.stringify(user));
};
