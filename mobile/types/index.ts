// ─── Auth ───────────────────────────────────────────────────────────────────
export type UserRole = 'buyer' | 'dealer' | 'admin';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  agreed_terms: boolean;
  subscription_tier?: string;
  profile_image_url?: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

// ─── Listings ───────────────────────────────────────────────────────────────
export type ListingStatus = 'active' | 'draft' | 'sold' | 'pending';

export interface ListingMedia {
  id: number;
  url: string;
  is_primary: boolean;
  order_index: number;
}

export interface Listing {
  id: number;
  title: string;
  slug: string;
  price: number;
  year: number;
  make: string;
  model: string;
  length_ft: number;
  location: string;
  description?: string;
  status: ListingStatus;
  is_featured: boolean;
  media: ListingMedia[];
  primary_image_url?: string;
  dealer_id: number;
  dealer_name?: string;
  dealer_logo_url?: string;
  engine_hours?: number;
  hull_material?: string;
  fuel_type?: string;
  beam_ft?: number;
  draft_ft?: number;
  cabins?: number;
  berths?: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface ListingsPage {
  listings: Listing[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ListingFilters {
  search?: string;
  min_price?: number;
  max_price?: number;
  min_year?: number;
  max_year?: number;
  min_length?: number;
  max_length?: number;
  make?: string;
  location?: string;
  is_featured?: boolean;
  sort_by?: 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'length_asc';
  page?: number;
  per_page?: number;
}

// ─── Messages ───────────────────────────────────────────────────────────────
export interface Conversation {
  id: number;
  listing_id?: number;
  listing_title?: string;
  listing_image_url?: string;
  other_user_id: number;
  other_user_name: string;
  other_user_image?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface MessagesPage {
  messages: Message[];
  total: number;
}

// ─── Inquiries ──────────────────────────────────────────────────────────────
export interface InquiryPayload {
  listing_id: number;
  message: string;
  phone?: string;
}

// ─── Dealer ─────────────────────────────────────────────────────────────────
export interface DealerProfile {
  id: number;
  user_id: number;
  company_name: string;
  logo_url?: string;
  bio?: string;
  phone?: string;
  website?: string;
  location?: string;
  verified: boolean;
}

// ─── API Generic ────────────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
