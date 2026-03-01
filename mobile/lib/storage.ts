import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'yachtversal_access_token';
const USER_KEY = 'yachtversal_user';

export const getToken = (): Promise<string | null> => SecureStore.getItemAsync(TOKEN_KEY);

export const saveToken = (token: string): Promise<void> => SecureStore.setItemAsync(TOKEN_KEY, token);

export const clearTokens = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
};

export const getCachedUser = async () => {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const cacheUser = async (user: object): Promise<void> => {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
};
