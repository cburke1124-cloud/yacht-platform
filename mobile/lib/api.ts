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
    const { data } = await api.post<AuthTokens>('/auth/login', { email, password });
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
    const { data } = await api.get<Listing[]>('/featured-listings');
    return data;
  },

  getSaved: async (): Promise<Listing[]> => {
    const { data } = await api.get<any[]>('/saved-listings');
    return data.filter((s) => s.listing).map((s) => s.listing);
  },

  saveListing: async (id: number): Promise<void> => {
    await api.post('/saved-listings', { listing_id: id });
  },

  unsaveListing: async (id: number): Promise<void> => {
    await api.delete(`/saved-listings/by-listing/${id}`);
  },

  getSavedIds: async (): Promise<number[]> => {
    const { data } = await api.get<any[]>('/saved-listings');
    return data.map((s) => s.listing_id);
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
    const { data } = await api.get<{ count: number }>('/notifications/count');
    return data.count;
  },
};

// ─── Dealer ──────────────────────────────────────────────────────────────────
export const dealerApi = {
  getMyListings: async (page = 1, status?: string): Promise<ListingsPage> => {
    const { data } = await api.get<ListingsPage>('/listings/my-listings', {
      params: { page, per_page: 20, status },
    });
    return data;
  },

  createListing: async (payload: Record<string, unknown>): Promise<Listing> => {
    const { data } = await api.post<Listing>('/listings', payload);
    return data;
  },

  updateListing: async (id: number, payload: Record<string, unknown>): Promise<Listing> => {
    const { data } = await api.put<Listing>(`/listings/${id}`, payload);
    return data;
  },

  attachMedia: async (listingId: number, mediaIds: number[]): Promise<void> => {
    await api.post(`/listings/${listingId}/media/attach`, { media_ids: mediaIds });
  },

  deleteListing: async (id: number): Promise<void> => {
    await api.delete(`/listings/${id}`);
  },
};

// ─── Media ───────────────────────────────────────────────────────────────────
export const mediaApi = {
  uploadPhoto: async (uri: string, listingId?: number): Promise<{ id: number; url: string }> => {
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    const form = new FormData();
    form.append('file', { uri, name: filename, type: 'image/jpeg' } as any);
    if (listingId != null) form.append('listing_id', String(listingId));
    const { data } = await api.post<{ id: number; url: string }>(
      '/media/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },
};

// ─── Push Notifications ──────────────────────────────────────────────────────
export const notificationsApi = {
  registerPushToken: async (token: string, platform: 'ios' | 'android'): Promise<void> => {
    await api.post('/notifications/push-token', { token, platform });
  },
};

export default api;
