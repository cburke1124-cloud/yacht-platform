import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Config } from '@/constants/config';
import { getToken, clearTokens } from '@/lib/storage';
import type { AuthTokens, ListingFilters, ListingsPage, Listing, Conversation, Message, MessagesPage, InquiryPayload, User } from '@/types';

// ─── Axios Instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: Config.API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// Attach JWT on every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await clearTokens();
      // The auth store listens and will redirect to login
    }
    return Promise.reject(error);
  },
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    const form = new FormData();
    form.append('username', email);
    form.append('password', password);
    const { data } = await api.post<AuthTokens>('/auth/token', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  register: async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: 'buyer' | 'dealer';
    agreed_terms: boolean;
  }): Promise<AuthTokens> => {
    const { data } = await api.post<AuthTokens>('/auth/register', payload);
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  acceptTerms: async (): Promise<void> => {
    await api.post('/auth/accept-terms');
  },

  updateProfile: async (payload: Partial<Pick<User, 'first_name' | 'last_name'>>): Promise<User> => {
    const { data } = await api.patch<User>('/auth/me', payload);
    return data;
  },

  changePassword: async (current_password: string, new_password: string): Promise<void> => {
    await api.post('/auth/change-password', { current_password, new_password });
  },
};

// ─── Listings ────────────────────────────────────────────────────────────────
export const listingsApi = {
  getListings: async (filters: ListingFilters = {}): Promise<ListingsPage> => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
    );
    const { data } = await api.get<ListingsPage>('/listings', { params });
    return data;
  },

  getListing: async (id: number): Promise<Listing> => {
    const { data } = await api.get<Listing>(`/listings/${id}`);
    return data;
  },

  getFeatured: async (): Promise<Listing[]> => {
    const { data } = await api.get<Listing[]>('/listings/featured');
    return data;
  },

  getSaved: async (): Promise<Listing[]> => {
    const { data } = await api.get<Listing[]>('/listings/saved');
    return data;
  },

  saveListing: async (id: number): Promise<void> => {
    await api.post(`/listings/${id}/save`);
  },

  unsaveListing: async (id: number): Promise<void> => {
    await api.delete(`/listings/${id}/save`);
  },

  getSavedIds: async (): Promise<number[]> => {
    const { data } = await api.get<number[]>('/listings/saved/ids');
    return data;
  },

  submitInquiry: async (payload: InquiryPayload): Promise<void> => {
    await api.post('/inquiries', payload);
  },
};

// ─── Messages ────────────────────────────────────────────────────────────────
export const messagesApi = {
  getConversations: async (): Promise<Conversation[]> => {
    const { data } = await api.get<Conversation[]>('/messages/conversations');
    return data;
  },

  getMessages: async (conversationId: number, page = 1): Promise<MessagesPage> => {
    const { data } = await api.get<MessagesPage>(`/messages/conversations/${conversationId}/messages`, {
      params: { page, per_page: 50 },
    });
    return data;
  },

  sendMessage: async (conversationId: number, body: string): Promise<Message> => {
    const { data } = await api.post<Message>(`/messages/conversations/${conversationId}/messages`, { body });
    return data;
  },

  startConversation: async (listingId: number, dealerId: number, body: string): Promise<Conversation> => {
    const { data } = await api.post<Conversation>('/messages/conversations', {
      listing_id: listingId,
      dealer_id: dealerId,
      initial_message: body,
    });
    return data;
  },

  markRead: async (conversationId: number): Promise<void> => {
    await api.post(`/messages/conversations/${conversationId}/read`);
  },

  getUnreadCount: async (): Promise<number> => {
    const { data } = await api.get<{ count: number }>('/messages/unread-count');
    return data.count;
  },
};

// ─── Dealer ──────────────────────────────────────────────────────────────────
export const dealerApi = {
  getMyListings: async (page = 1, status?: string): Promise<ListingsPage> => {
    const { data } = await api.get<ListingsPage>('/listings/my', {
      params: { page, per_page: 20, status },
    });
    return data;
  },

  createListing: async (payload: FormData): Promise<Listing> => {
    const { data } = await api.post<Listing>('/listings', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  updateListing: async (id: number, payload: Partial<Listing>): Promise<Listing> => {
    const { data } = await api.patch<Listing>(`/listings/${id}`, payload);
    return data;
  },

  deleteListing: async (id: number): Promise<void> => {
    await api.delete(`/listings/${id}`);
  },
};

// ─── Push Notifications ──────────────────────────────────────────────────────
export const notificationsApi = {
  registerPushToken: async (token: string, platform: 'ios' | 'android'): Promise<void> => {
    await api.post('/notifications/push-token', { token, platform });
  },
};

export default api;
