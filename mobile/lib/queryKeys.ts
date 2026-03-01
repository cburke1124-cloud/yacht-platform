import type { ListingFilters } from '@/types';

export const QueryKeys = {
  // Auth
  me: ['auth', 'me'] as const,

  // Listings
  listings: (filters?: ListingFilters) => ['listings', filters] as const,
  listing: (id: number) => ['listings', id] as const,
  featured: ['listings', 'featured'] as const,
  saved: ['listings', 'saved'] as const,
  savedIds: ['listings', 'saved', 'ids'] as const,
  myListings: (page?: number, status?: string) => ['listings', 'my', page, status] as const,

  // Messages
  conversations: ['conversations'] as const,
  messages: (conversationId: number) => ['messages', conversationId] as const,
  unreadCount: ['messages', 'unread'] as const,
} as const;
