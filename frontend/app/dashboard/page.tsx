"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import DealerFeaturedTab from '@/app/components/DealerFeaturedTab';
import {
  PlusCircle, Eye, Edit, Trash2, Star, Users, Settings, User,
  BarChart3, MessageSquare, Bell, Globe, Heart, Search,
  CheckSquare, X, Archive, RefreshCw, Image, DollarSign,
  Building2, Link2, Link, Upload, CreditCard, Key, CheckCircle,
  XCircle, Check, Zap,
  MapPin, Phone, Mail, Facebook, Instagram, Twitter, Linkedin, Save, Share2,
  Folder, FolderPlus, FolderOpen, FileText, Film, MoreVertical, Move, Filter,
  Loader2, AlertCircle, ExternalLink, Ruler, Clock, Copy, AlertTriangle,
  UserPlus, Shield, LayoutDashboard, ClipboardList, ChevronLeft
} from 'lucide-react';
import BulkImportExportTools from '@/app/components/BulkImportExportTools';

type TabId = 'listings' | 'featured' | 'media' | 'bulk' | 'team' | 'analytics' | 'crm' | 'billing' | 'account' | 'profile' | 'api-keys' | 'salesman-profile';

interface MediaFileItem {
  id: number;
  filename: string;
  url: string;
  thumbnail_url?: string;
  file_type: string;
  file_size_mb: number;
  folder_id?: number | null;
  width?: number;
  height?: number;
  created_at?: string;
}

interface MediaFolderItem {
  id: number;
  name: string;
  file_count: number;
}

interface Listing {
  id: number;
  title: string;
  price?: number;
  status: string;
  year?: number;
  length_feet?: number;
  city?: string;
  state?: string;
  views?: number;
  inquiries?: number;
  featured?: boolean;
  featured_until?: string;
  images?: Array<{ url: string }>;
}

interface DashboardStats {
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalInquiries: number;
  featuredListings: number;
}

interface QuickEditDraft {
  title: string;
  price: string;
  status: string;
}

type SyncSettings = {
  sync_enabled: boolean;
  sync_leads: boolean;
  sync_contacts: boolean;
  sync_messages: boolean;
};

type RecentSync = {
  type: string;
  status: string;
  synced_at: string;
};

type CRMStatus = {
  connected: boolean;
  crm_type?: string;
  settings?: SyncSettings;
  last_sync?: string;
  recent_syncs?: RecentSync[];
};

type Credentials = {
  api_key: string;
  access_token: string;
  account_id: string;
  portal_id: string;
  instance_url: string;
  api_endpoint: string;
};

type SettingConfig = {
  key: keyof SyncSettings;
  label: string;
  desc: string;
};

type AnalyticsRange = '7d' | '30d' | '90d';

type TeamPerformanceMember = {
  id: number;
  name: string;
  email: string;
  role?: string;
  listings_total: number;
  listings_active: number;
  views_total: number;
  listing_inquiries_total: number;
  inquiries_total: number;
  inquiries_current_period: number;
  pending_inquiries: number;
  replied_inquiries: number;
  response_rate: number;
  avg_response_hours: number | null;
  last_message_at: string | null;
  joined_at: string | null;
  active: boolean;
};

type TeamPerformanceData = {
  range_days: number;
  summary: {
    team_members: number;
    period_leads: number;
    previous_period_leads: number;
    lead_delta: number;
    lead_delta_percent: number;
    pending_inquiries: number;
    average_response_rate: number;
  };
  members: TeamPerformanceMember[];
};

// ─── Team types ────────────────────────────────────────────────────────────
interface TeamMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  permissions: {
    can_create_listings: boolean;
    can_edit_own_listings: boolean;
    can_edit_all_listings: boolean;
    can_delete_listings: boolean;
    can_view_inquiries: boolean;
    can_manage_team: boolean;
    can_view_analytics: boolean;
  };
  active: boolean;
  public_profile: boolean;
  created_at: string;
}
interface MemberMessage {
  id: number;
  subject: string;
  body: string;
  sender_id: number;
  recipient_id: number;
  sender_name: string;
  listing_id: number | null;
  created_at: string;
}
interface MemberInquiry {
  id: number;
  sender_name: string;
  sender_email: string;
  lead_stage: string;
  lead_score: number;
  listing_title: string | null;
  created_at: string;
}
interface MemberOverview {
  member: { id: number; name: string; email: string; phone: string; role: string; active: boolean; joined_at: string; };
  listings: { total: number; active: number };
  inquiries: { total: number; by_stage: Record<string, number> };
  messages: { total: number; pending: number };
}
const STAGE_COLORS: Record<string, string> = {
  new:       'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-yellow-100 text-yellow-700',
  proposal:  'bg-orange-100 text-orange-700',
  won:       'bg-green-100 text-green-700',
  lost:      'bg-red-100 text-red-700',
};

// ─── Billing types ──────────────────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  popular?: boolean;
  custom_price?: boolean;
}
interface SubscriptionInfo {
  active: boolean;
  tier: string;
  status?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  trial_active?: boolean;
  trial_end?: string;
}
// ─── API Keys types ───────────────────────────────────────────────────────────
interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  is_active: boolean;
  rate_limit: number;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
}
// ─── Preferences types ────────────────────────────────────────────────────────
type Preferences = {
  language: string;
  currency: string;
  units: string;
  timezone: string;
  marketing_opt_in: boolean;
  communication_email: boolean;
  communication_sms: boolean;
  communication_push: boolean;
};
type CurrencyRate = { [key: string]: number };

const sortApiKeys = (keys: APIKey[]) =>
  [...keys].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

export default function EnhancedDealerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListings, setSelectedListings] = useState<Set<number>>(new Set());
  const [dealerLogoUrl, setDealerLogoUrl] = useState<string | null>(null);

  // Broker profile inline state
  const [brokerProfile, setBrokerProfile] = useState({
    company_name: '', name: '', email: '', phone: '',
    address: '', city: '', state: '', zip_code: '', country: 'USA',
    website: '', description: '', logo_url: '', banner_url: '',
    facebook_url: '', instagram_url: '', twitter_url: '', linkedin_url: '',
    slug: '', cobrokering_enabled: true, show_team_on_profile: false
  });
  const [brokerProfileSaving, setBrokerProfileSaving] = useState(false);
  const [brokerProfileSaved, setBrokerProfileSaved] = useState(false);

  // Media manager inline state
  const [mediaFiles, setMediaFiles] = useState<MediaFileItem[]>([]);
  const [mediaFolders, setMediaFolders] = useState<MediaFolderItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video' | 'pdf'>('all');
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaCurrentFolder, setMediaCurrentFolder] = useState<number | null | 'all'>('all');
  const [mediaSelected, setMediaSelected] = useState<Set<number>>(new Set());
  const [mediaStorageStats, setMediaStorageStats] = useState({ total_files: 0, total_size_gb: 0, images: 0, videos: 0, pdfs: 0 });
  const [mediaNewFolderName, setMediaNewFolderName] = useState('');
  const [mediaShowNewFolder, setMediaShowNewFolder] = useState(false);
  const [mediaDragging, setMediaDragging] = useState(false);
  const [mediaMovingId, setMediaMovingId] = useState<number | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalListings: 0,
    activeListings: 0,
    totalViews: 0,
    totalInquiries: 0,
    featuredListings: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [quickEdits, setQuickEdits] = useState<Record<number, QuickEditDraft>>({});
  const [savingQuickEditId, setSavingQuickEditId] = useState<number | null>(null);
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('30d');
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformanceData | null>(null);
  const [teamPerformanceLoading, setTeamPerformanceLoading] = useState(false);

  // Team management state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [viewingMemberId, setViewingMemberId] = useState<number | null>(null);
  const [memberOverview, setMemberOverview] = useState<MemberOverview | null>(null);
  const [memberMessages, setMemberMessages] = useState<MemberMessage[]>([]);
  const [memberInquiries, setMemberInquiries] = useState<MemberInquiry[]>([]);
  const [memberOverviewTab, setMemberOverviewTab] = useState<'overview' | 'messages' | 'leads'>('overview');
  const [memberOverviewLoading, setMemberOverviewLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'team_member',
    permissions: {
      can_create_listings: true,
      can_edit_own_listings: true,
      can_edit_all_listings: false,
      can_delete_listings: false,
      can_view_inquiries: true,
      can_manage_team: false,
      can_view_analytics: true
    }
  });

  // CRM State
  const [crmConnected, setCrmConnected] = useState(false);
  const [crmType, setCrmType] = useState('');
  const [crmLoading, setCrmLoading] = useState(true);
  const [crmConnecting, setCrmConnecting] = useState(false);
  const [crmStatus, setCrmStatus] = useState<CRMStatus | null>(null);
  const [selectedCRM, setSelectedCRM] = useState<'hubspot' | 'gohighlevel' | 'pipedrive' | 'zoho' | 'activecampaign' | 'salesforce'>('hubspot');
  const [credentials, setCredentials] = useState<Credentials>({
    api_key: '',
    access_token: '',
    account_id: '',
    portal_id: '',
    instance_url: '',
    api_endpoint: ''
  });
  const [crmSyncSettings, setCrmSyncSettings] = useState<SyncSettings>({
    sync_enabled: true,
    sync_leads: true,
    sync_contacts: true,
    sync_messages: true
  });
  const [crmSubTab, setCrmSubTab] = useState<'crm' | 'webhook'>('crm');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookFormat, setWebhookFormat] = useState<'json' | 'adf_xml'>('json');
  const [webhookAuthType, setWebhookAuthType] = useState<'none' | 'api_key' | 'bearer' | 'basic'>('none');
  const [webhookAuthToken, setWebhookAuthToken] = useState('');
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [webhookTestPassed, setWebhookTestPassed] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);

  // Billing state
  const [billingPlans, setBillingPlans] = useState<Plan[]>([]);
  const [currentTier, setCurrentTier] = useState('free');
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [selectedTier, setSelectedTier] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [managingBilling, setManagingBilling] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState<Preferences>({
    language: 'en', currency: 'USD', units: 'imperial', timezone: 'America/New_York',
    marketing_opt_in: false, communication_email: true, communication_sms: false, communication_push: true
  });
  const [prefRates, setPrefRates] = useState<CurrencyRate>({});
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);
  const [newKeyName, setNewKeyName] = useState('Primary API Key');
  const [creatingKey, setCreatingKey] = useState(false);
  const [fullKeys, setFullKeys] = useState<Record<number, string>>({});
  const [regeneratingKeyId, setRegeneratingKeyId] = useState<number | null>(null);
  const [togglingKeyId, setTogglingKeyId] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchTeamMembers();
    fetchCRMStatus();
    fetchWebhookConfig();
    fetchBillingData();
    fetchPreferences();
    fetchPrefRates();
    fetchAPIKeys();
    const token = localStorage.getItem('token');
    if (token) {
      fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setCurrentUser(data); })
        .catch(() => {});
      // Fetch logo_url for the sidebar brand area
      fetch(apiUrl('/users/me'), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.logo_url) setDealerLogoUrl(data.logo_url); })
        .catch(() => {});
      // Fetch broker profile for inline editor
      fetchBrokerProfile(token);
    }

    // Confirm Stripe checkout session immediately when redirected back from Stripe
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('payment') === 'success' && sessionId && token) {
      fetch(apiUrl('/payments/confirm-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            // Refresh user so subscription_tier reflects the new plan
            return fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : null)
              .then(me => { if (me) setCurrentUser(me); });
          }
        })
        .catch(() => {});
      // Remove payment query params from URL without reloading
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
    }
  }, []);

  useEffect(() => {
    const days = analyticsRange === '7d' ? 7 : analyticsRange === '90d' ? 90 : 30;
    fetchTeamPerformance(days);
  }, [analyticsRange]);

  useEffect(() => {
    if (activeTab === 'media') {
      fetchMediaFiles();
    }
  }, [activeTab, mediaFilter, mediaCurrentFolder]);

  const fetchBrokerProfile = async (tok?: string) => {
    const token = tok || localStorage.getItem('token') || '';
    try {
      const [userRes, profileRes] = await Promise.all([
        fetch(apiUrl('/users/me'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/dealer-profile'), { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const userData = userRes.ok ? await userRes.json() : {};
      if (profileRes.ok) {
        const p = await profileRes.json();
        setBrokerProfile({
          company_name: p.company_name || userData.company_name || '',
          name: p.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: p.email || userData.email || '',
          phone: p.phone || userData.phone || '',
          address: p.address || '', city: p.city || '', state: p.state || '',
          zip_code: p.zip_code || '', country: p.country || 'USA',
          website: p.website || '', description: p.description || '',
          logo_url: p.logo_url || '', banner_url: p.banner_url || '',
          facebook_url: p.facebook_url || '', instagram_url: p.instagram_url || '',
          twitter_url: p.twitter_url || '', linkedin_url: p.linkedin_url || '',
          slug: p.slug || '',
          cobrokering_enabled: p.cobrokering_enabled !== false,
          show_team_on_profile: p.show_team_on_profile ?? false
        });
      } else {
        setBrokerProfile(prev => ({
          ...prev,
          company_name: userData.company_name || '',
          name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: userData.email || '',
          phone: userData.phone || ''
        }));
      }
    } catch { /* non-fatal */ }
  };

  const handleBrokerImageUpload = async (field: 'logo_url' | 'banner_url', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/media/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        const url = data?.media?.url ?? data?.url;
        if (url) {
          setBrokerProfile(prev => ({ ...prev, [field]: url }));
          if (field === 'logo_url') setDealerLogoUrl(url);
        }
      }
    } catch { /* non-fatal */ }
  };

  const handleBrokerSave = async () => {
    setBrokerProfileSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/dealer-profile'), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(brokerProfile)
      });
      if (res.ok) {
        setBrokerProfileSaved(true);
        setTimeout(() => setBrokerProfileSaved(false), 3000);
      }
    } catch { /* non-fatal */ } finally {
      setBrokerProfileSaving(false);
    }
  };

  // ── Media Manager functions ─────────────────────────────────────────────────

  const fetchMediaFiles = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setMediaLoading(true);
    try {
      const params = new URLSearchParams();
      if (mediaFilter !== 'all') params.set('file_type', mediaFilter);
      if (mediaCurrentFolder !== 'all' && mediaCurrentFolder !== null) {
        params.set('folder_id', String(mediaCurrentFolder));
      }
      params.set('limit', '200');

      const [filesRes, statsRes, foldersRes] = await Promise.all([
        fetch(apiUrl(`/media/my-media?${params}`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/media/stats'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/media/folders'), { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (filesRes.ok) {
        const data = await filesRes.json();
        setMediaFiles(data.media || []);
      }
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setMediaStorageStats(stats);
      }
      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setMediaFolders(data.folders || []);
      }
    } catch { /* non-fatal */ } finally {
      setMediaLoading(false);
    }
  }, [mediaFilter, mediaCurrentFolder]);

  const handleMediaUploadFiles = async (files: FileList | File[]) => {
    const token = localStorage.getItem('token');
    if (!token || !files || files.length === 0) return;
    setMediaUploading(true);
    try {
      const fileArr = Array.from(files);
      if (fileArr.length === 1) {
        const fd = new FormData();
        fd.append('file', fileArr[0]);
        if (mediaCurrentFolder !== 'all' && mediaCurrentFolder !== null) {
          fd.append('folder_id', String(mediaCurrentFolder));
        }
        await fetch(apiUrl('/media/upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
      } else {
        const fd = new FormData();
        fileArr.forEach(f => fd.append('files', f));
        if (mediaCurrentFolder !== 'all' && mediaCurrentFolder !== null) {
          fd.append('folder_id', String(mediaCurrentFolder));
        }
        await fetch(apiUrl('/media/bulk-upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
      }
      await fetchMediaFiles();
    } catch { /* non-fatal */ } finally {
      setMediaUploading(false);
    }
  };

  const handleMediaDelete = async (id: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    await fetch(apiUrl(`/media/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    setMediaFiles(prev => prev.filter(f => f.id !== id));
    setMediaSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleMediaBulkDelete = async () => {
    if (mediaSelected.size === 0) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    await Promise.all(Array.from(mediaSelected).map(id =>
      fetch(apiUrl(`/media/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    ));
    setMediaFiles(prev => prev.filter(f => !mediaSelected.has(f.id)));
    setMediaSelected(new Set());
  };

  const handleCreateFolder = async () => {
    const name = mediaNewFolderName.trim();
    if (!name) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(apiUrl(`/media/folders?name=${encodeURIComponent(name)}`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const folder = await res.json();
      setMediaFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setMediaNewFolderName('');
      setMediaShowNewFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    await fetch(apiUrl(`/media/folders/${folderId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    setMediaFolders(prev => prev.filter(f => f.id !== folderId));
    if (mediaCurrentFolder === folderId) setMediaCurrentFolder('all');
    // files unfoldered on backend, refresh
    await fetchMediaFiles();
  };

  const handleMoveToFolder = async (mediaId: number, folderId: number | null) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const url = folderId != null
      ? apiUrl(`/media/${mediaId}/folder?folder_id=${folderId}`)
      : apiUrl(`/media/${mediaId}/folder`);
    await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    setMediaMovingId(null);
    await fetchMediaFiles();
  };

  const toggleMediaSelect = (id: number) => {
    setMediaSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/my-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) {
          setLoading(false);
          return;
        }
        throw new Error(`Failed to load listings: ${response.status}`);
      }
      const data = await response.json();
      const listings = Array.isArray(data) ? data : [];
      setListings(listings);
      setQuickEdits(
        listings.reduce((acc: Record<number, QuickEditDraft>, listing: Listing) => {
          acc[listing.id] = {
            title: listing.title || '',
            price: listing.price != null ? String(listing.price) : '',
            status: listing.status || 'draft'
          };
          return acc;
        }, {})
      );

      const totalViews = listings.reduce((sum: number, l: Listing) => sum + (l.views || 0), 0);
      const totalInquiries = listings.reduce((sum: number, l: Listing) => sum + (l.inquiries || 0), 0);
      const featuredCount = listings.filter((l: Listing) => l.featured).length;

      setStats({
        totalListings: listings.length,
        activeListings: listings.filter((l: Listing) => l.status === 'active').length,
        totalViews,
        totalInquiries,
        featuredListings: featuredCount
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleListingSelection = (listingId: number) => {
    const newSelected = new Set(selectedListings);
    if (newSelected.has(listingId)) {
      newSelected.delete(listingId);
    } else {
      newSelected.add(listingId);
    }
    setSelectedListings(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedListings.size} listings?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/bulk-delete'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: Array.from(selectedListings) })
      });

      if (response.ok) {
        await fetchDashboardData();
        setSelectedListings(new Set());
        alert('Listings deleted successfully');
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Failed to delete listings');
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/listings/bulk-status'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          ids: Array.from(selectedListings),
          status 
        })
      });

      if (response.ok) {
        await fetchDashboardData();
        setSelectedListings(new Set());
        alert(`Status changed to ${status}`);
      }
    } catch (error) {
      console.error('Bulk status change failed:', error);
      alert('Failed to change status');
    }
  };

  const updateQuickEditField = (listingId: number, field: keyof QuickEditDraft, value: string) => {
    setQuickEdits(prev => ({
      ...prev,
      [listingId]: {
        ...(prev[listingId] || { title: '', price: '', status: 'draft' }),
        [field]: value
      }
    }));
  };

  const saveQuickEdit = async (listingId: number) => {
    const draft = quickEdits[listingId];
    if (!draft) return;

    const payload: Record<string, unknown> = {
      title: draft.title.trim(),
      status: draft.status
    };

    if (draft.price.trim() === '') {
      payload.price = null;
    } else {
      const parsed = Number(draft.price);
      if (Number.isNaN(parsed)) {
        alert('Please enter a valid price');
        return;
      }
      payload.price = parsed;
    }

    setSavingQuickEditId(listingId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${listingId}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        alert(error.detail || 'Failed to save quick edit');
        return;
      }

      setListings(prev => prev.map((listing) =>
        listing.id === listingId
          ? {
              ...listing,
              title: String(payload.title ?? listing.title),
              status: String(payload.status ?? listing.status),
              price: payload.price == null ? undefined : Number(payload.price)
            }
          : listing
      ));
    } catch (error) {
      console.error('Quick edit failed:', error);
      alert('Failed to save quick edit');
    } finally {
      setSavingQuickEditId(null);
    }
  };

  const fetchTeamMembers = async () => {
    setTeamMembersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/team/members'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setTeamMembersLoading(false);
    }
  };

  const openMemberDashboard = async (memberId: number) => {
    setViewingMemberId(memberId);
    setMemberOverviewTab('overview');
    setMemberOverviewLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [ovRes, msgRes, inqRes] = await Promise.all([
        fetch(apiUrl(`/team/members/${memberId}/overview`), { headers }),
        fetch(apiUrl(`/team/members/${memberId}/messages?limit=30`), { headers }),
        fetch(apiUrl(`/team/members/${memberId}/inquiries?limit=30`), { headers }),
      ]);
      if (ovRes.ok)  setMemberOverview(await ovRes.json());
      if (msgRes.ok) { const d = await msgRes.json(); setMemberMessages(d.items ?? d); }
      if (inqRes.ok) { const d = await inqRes.json(); setMemberInquiries(d.items ?? d); }
    } catch (e) {
      console.error('Failed to load member dashboard:', e);
    } finally {
      setMemberOverviewLoading(false);
    }
  };

  const closeMemberDashboard = () => {
    setViewingMemberId(null);
    setMemberOverview(null);
    setMemberMessages([]);
    setMemberInquiries([]);
  };

  const handleInviteMember = async () => {
    if (!inviteForm.email || !inviteForm.first_name) {
      alert('Please fill in required fields');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/team/invite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(inviteForm)
      });
      if (response.ok) {
        alert('Team member invited successfully! They will receive an email with login instructions.');
        setShowInviteModal(false);
        fetchTeamMembers();
        setInviteForm({
          email: '', first_name: '', last_name: '', phone: '', role: 'team_member',
          permissions: { can_create_listings: true, can_edit_own_listings: true, can_edit_all_listings: false, can_delete_listings: false, can_view_inquiries: true, can_manage_team: false, can_view_analytics: true }
        });
      } else {
        const err = await response.json();
        alert(err.detail || 'Failed to invite team member');
      }
    } catch (error) {
      console.error('Failed to invite:', error);
      alert('Failed to invite team member');
    }
  };

  const handleUpdatePermissions = async (memberId: number, permissions: TeamMember['permissions'], public_profile: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/team/members/${memberId}/permissions`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ permissions, public_profile })
      });
      if (response.ok) {
        alert('Permissions updated successfully');
        fetchTeamMembers();
        setEditingMember(null);
      }
    } catch (error) {
      console.error('Failed to update permissions:', error);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('Remove this team member? Their listings will be reassigned to you.')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/team/members/${memberId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        alert('Team member removed');
        fetchTeamMembers();
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const fetchTeamPerformance = async (days: number) => {
    setTeamPerformanceLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/team/performance?days=${days}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        setTeamPerformance(null);
        return;
      }

      const data = await response.json();
      setTeamPerformance(data);
    } catch (error) {
      console.error('Failed to fetch team performance:', error);
      setTeamPerformance(null);
    } finally {
      setTeamPerformanceLoading(false);
    }
  };

  // CRM Functions
  const fetchCRMStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/integrations'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const statusData: CRMStatus = {
          connected: data.length > 0,
          crm_type: data[0]?.crm_type,
          settings: data[0] ? {
            sync_enabled: data[0].active,
            sync_leads: data[0].sync_leads,
            sync_contacts: data[0].sync_contacts,
            sync_messages: data[0].sync_messages
          } : crmSyncSettings,
          last_sync: data[0]?.last_sync
        };
        
        setCrmStatus(statusData);
        setCrmConnected(statusData.connected);
        if (statusData.connected && statusData.crm_type) {
          setCrmType(statusData.crm_type);
          setCrmSyncSettings(statusData.settings || crmSyncSettings);
        }
      }
      setCrmLoading(false);
    } catch (error) {
      console.error('Failed to fetch CRM status:', error);
      setCrmLoading(false);
    }
  };

  const handleCrmConnect = async () => {
    setCrmConnecting(true);
    
    try {
      let apiKey = '';
      
      switch(selectedCRM) {
        case 'hubspot':
          apiKey = credentials.access_token;
          break;
        case 'gohighlevel':
          apiKey = credentials.api_key;
          break;
        case 'pipedrive':
          apiKey = credentials.api_key;
          break;
        case 'zoho':
          apiKey = credentials.api_key;
          break;
        case 'activecampaign':
          apiKey = credentials.api_key;
          break;
        case 'salesforce':
          apiKey = `${credentials.instance_url}|${credentials.access_token}`;
          break;
        default:
          apiKey = '';
      }
      
      if (!apiKey || apiKey === '|') {
        alert('Please provide valid credentials');
        setCrmConnecting(false);
        return;
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/integrations'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          crm_type: selectedCRM,
          api_key: apiKey,
          sync_leads: true,
          sync_contacts: true,
          sync_messages: true
        })
      });
      
      if (response.ok) {
        alert('CRM connected successfully!');
        fetchCRMStatus();
        setCredentials({ api_key: '', access_token: '', account_id: '', portal_id: '', instance_url: '', api_endpoint: '' });
      } else {
        alert('Failed to connect CRM');
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect CRM');
    } finally {
      setCrmConnecting(false);
    }
  };

  const getCrmCredentialValid = () => {
    switch(selectedCRM) {
      case 'hubspot':
        return !!credentials.access_token;
      case 'gohighlevel':
        return !!credentials.api_key;
      case 'pipedrive':
        return !!credentials.api_key;
      case 'zoho':
        return !!credentials.api_key;
      case 'activecampaign':
        return !!credentials.api_key;
      case 'salesforce':
        return !!credentials.instance_url && !!credentials.access_token;
      default:
        return false;
    }
  };

  const handleCrmUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/settings'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(crmSyncSettings)
      });
      
      if (response.ok) {
        alert('Settings updated!');
        fetchCRMStatus();
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update settings');
    }
  };

  const handleCrmDisconnect = async () => {
    if (!confirm('Disconnect CRM? This will stop all syncing.')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/crm/disconnect'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('CRM disconnected');
        fetchCRMStatus();
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const fetchWebhookConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/webhooks/config'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.url || '');
        setWebhookFormat(data.format || 'json');
        setWebhookAuthType(data.auth_type || 'none');
        setWebhookAuthToken(data.auth_token || '');
        setWebhookConfigured(!!data.url);
      }
    } catch (err) {
      console.error('Failed to fetch webhook config:', err);
    }
  };

  const handleSaveWebhook = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/webhooks/config'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, format: webhookFormat, auth_type: webhookAuthType, auth_token: webhookAuthToken })
      });
      if (res.ok) {
        setWebhookConfigured(true);
        setWebhookTestPassed(false);
        alert('Webhook saved!');
      } else {
        alert('Failed to save webhook');
      }
    } catch (err) {
      console.error('Save webhook error:', err);
    }
  };

  const handleTestWebhook = async () => {
    setWebhookTesting(true);
    setWebhookTestPassed(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/webhooks/test'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setWebhookTestPassed(true);
        alert('Webhook test successful!');
      } else {
        alert('Webhook test failed. Check your URL and settings.');
      }
    } catch (err) {
      console.error('Test webhook error:', err);
    } finally {
      setWebhookTesting(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!confirm('Remove webhook configuration?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/webhooks/config'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setWebhookUrl('');
        setWebhookFormat('json');
        setWebhookAuthType('none');
        setWebhookAuthToken('');
        setWebhookConfigured(false);
        setWebhookTestPassed(false);
        alert('Webhook removed');
      }
    } catch (err) {
      console.error('Delete webhook error:', err);
    }
  };

  // ─── Billing handlers ────────────────────────────────────────────────────
  const fetchBillingData = async () => {
    setBillingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [plansRes, subRes] = await Promise.all([
        fetch(apiUrl('/payments/plans'), { headers }),
        fetch(apiUrl('/payments/subscription'), { headers }),
      ]);
      if (plansRes.ok) {
        const d = await plansRes.json();
        setBillingPlans(d.plans || []);
        setCurrentTier(d.current_tier || 'free');
        setSelectedTier(d.current_tier !== 'free' ? d.current_tier : (d.plans?.[0]?.id || ''));
      }
      if (subRes.ok) setSubscription(await subRes.json());
    } catch {
      setBillingError('Failed to load billing information.');
    } finally {
      setBillingLoading(false);
    }
  };

  const openStripePortal = async () => {
    setManagingBilling(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/payments/billing-portal'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        alert('Unable to open billing portal.');
      }
    } catch {
      alert('Unable to open billing portal.');
    } finally {
      setManagingBilling(false);
    }
  };

  // ─── Preferences handlers ────────────────────────────────────────────────
  const fetchPreferences = async () => {
    setPrefLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/preferences'), { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPreferences(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setPrefLoading(false);
    }
  };

  const fetchPrefRates = async () => {
    try {
      const res = await fetch(apiUrl('/currencies/rates'));
      if (res.ok) {
        const data = await res.json();
        setPrefRates(data.rates || {});
      }
    } catch (err) {
      console.error('Failed to fetch rates:', err);
    }
  };

  const handleSavePreferences = async () => {
    setPrefSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/preferences'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(preferences)
      });
      if (res.ok) {
        alert('✅ Preferences saved! Reload the page to see changes.');
      } else {
        alert('Failed to save preferences');
      }
    } catch {
      alert('Failed to save preferences');
    } finally {
      setPrefSaving(false);
    }
  };

  // ─── API Keys handlers ────────────────────────────────────────────────────
  const fetchAPIKeys = async () => {
    setApiKeysLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/api-keys'), { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setApiKeys(sortApiKeys(data));
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setApiKeysLoading(false);
    }
  };

  const copyKeyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { alert('Please enter a key name'); return; }
    setCreatingKey(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/api-keys'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newKeyName.trim() })
      });
      const result = await res.json();
      if (!res.ok) { alert(result.detail || 'Failed to create API key'); return; }
      const created: APIKey = {
        id: result.id, name: result.name, key_prefix: result.key_prefix,
        is_active: true, rate_limit: 1000, created_at: result.created_at,
      };
      setApiKeys(prev => sortApiKeys([created, ...prev]));
      setFullKeys(prev => ({ ...prev, [result.id]: result.key }));
      alert('New API key created. Copy it now—this is the only time the full key is shown.');
    } catch {
      alert('Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRegenerateKey = async (key: APIKey) => {
    if (!confirm(`Regenerate "${key.name}"? The old key will be deactivated immediately.`)) return;
    setRegeneratingKeyId(key.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/api-keys/${key.id}/regenerate`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (!res.ok) { alert(result.detail || 'Failed to regenerate API key'); return; }
      setApiKeys(prev => {
        const updated = prev.map(k => k.id === result.old_key_id ? { ...k, is_active: false } : k);
        const newEntry: APIKey = {
          id: result.id, name: result.name, key_prefix: result.key_prefix,
          is_active: result.is_active, rate_limit: result.rate_limit,
          created_at: result.created_at, expires_at: result.expires_at,
        };
        return sortApiKeys([newEntry, ...updated]);
      });
      setFullKeys(prev => ({ ...prev, [result.id]: result.key }));
      alert('API key regenerated. Copy the new full key now.');
    } catch {
      alert('Failed to regenerate API key');
    } finally {
      setRegeneratingKeyId(null);
    }
  };

  const handleToggleKeyActive = async (key: APIKey) => {
    setTogglingKeyId(key.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/api-keys/${key.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_active: !key.is_active })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { alert(result.detail || 'Failed to update key status'); return; }
      setApiKeys(prev => sortApiKeys(prev.map(k => k.id === key.id ? { ...k, is_active: !k.is_active } : k)));
    } catch {
      alert('Failed to update key status');
    } finally {
      setTogglingKeyId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Permission helpers — handles both 'create_listings' and 'can_create_listings' key formats
  const isDealer = !currentUser || currentUser.user_type === 'dealer' || currentUser.user_type === 'admin';
  const isTeamMember = currentUser?.user_type === 'team_member';
  const teamMemberCan = (perm: string): boolean => {
    if (!currentUser || isDealer) return isDealer;
    const p = currentUser.permissions as Record<string, boolean> | undefined;
    if (!p) return false;
    const raw = perm.startsWith('can_') ? perm.slice(4) : perm;
    const can = perm.startsWith('can_') ? perm : `can_${perm}`;
    return !!(p[perm] ?? p[raw] ?? p[can]);
  };

  const tabs = [
    { id: 'listings', label: 'My Listings', icon: BarChart3 },
    { id: 'media', label: 'Media Gallery', icon: Image },
    ...(isDealer || teamMemberCan('create_listings') ? [{ id: 'bulk', label: 'Bulk Tools', icon: Archive }] : []),
    ...(isDealer || teamMemberCan('view_analytics') ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3 }] : []),
    ...(isDealer || teamMemberCan('manage_team') ? [{ id: 'team', label: 'Team', icon: Users }] : []),
    ...(isDealer ? [{ id: 'crm', label: 'CRM', icon: Link2 }] : []),
    ...(isDealer ? [{ id: 'billing', label: 'Billing', icon: CreditCard }] : []),
    { id: 'account', label: 'Account', icon: Settings },
    ...(isDealer ? [{ id: 'profile', label: 'Broker Page', icon: Building2 }] : []),
    ...(isTeamMember || isDealer ? [{ id: 'salesman-profile', label: 'My Profile', icon: User }] : []),
    ...(isDealer ? [{ id: 'api-keys', label: 'API Keys', icon: Key }] : []),
  ] as { id: TabId; label: string; icon: any }[];

  const paidTiers = new Set(['basic','plus','pro','premium','private_basic','private_plus','private_pro']);
  const paymentLapsed = currentUser &&
    (currentUser.user_type === 'dealer' || currentUser.user_type === 'private') &&
    !currentUser.always_free &&
    !paidTiers.has(currentUser.subscription_tier || '');

  return (
    <div className="min-h-screen bg-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Payment lapsed banner */}
        {paymentLapsed && (
          <div className="mb-6 flex items-start justify-between gap-4 p-4 bg-red-50 border border-red-300 rounded-xl">
            <div>
              <p className="font-semibold text-red-700">Subscription inactive — action required</p>
              <p className="text-sm text-red-600 mt-0.5">Your listings are suspended and new listings cannot be created until payment is complete. Update your payment method to restore access.</p>
            </div>
            <button
              onClick={() => setActiveTab('billing')}
              className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Update payment
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <BarChart3 className="text-primary" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Total Listings</p>
            </div>
            <p className="text-3xl font-bold text-secondary">{stats.totalListings}</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Eye className="text-primary" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Active</p>
            </div>
            <p className="text-3xl font-bold text-primary">{stats.activeListings}</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Star className="text-accent fill-accent" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Featured</p>
            </div>
            <p className="text-3xl font-bold text-accent">{stats.featuredListings}</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-cyan-50 rounded-lg">
                <Eye className="text-primary" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Total Views</p>
            </div>
            <p className="text-3xl font-bold text-primary">{stats.totalViews.toLocaleString()}</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <MessageSquare className="text-secondary" size={24} />
              </div>
              <p className="text-gray-600 text-sm">Inquiries</p>
            </div>
            <p className="text-3xl font-bold text-secondary">{stats.totalInquiries}</p>
          </div>
        </div>

        {/* Tabs + Content */}
        <div className="mb-20 flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-64 xl:w-72 shrink-0">
            <div className="glass-card p-3 lg:sticky lg:top-6">
              {/* Brand logo area */}
              <div className="mb-3 px-2 pt-2 pb-3 border-b border-gray-100">
                {dealerLogoUrl ? (
                  <img
                    src={mediaUrl(dealerLogoUrl)}
                    alt="Company logo"
                    className="max-h-14 max-w-full object-contain"
                    onError={onImgError}
                  />
                ) : (
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                  >
                    <Upload size={20} className="text-gray-400 group-hover:text-primary transition-colors" />
                    <span className="text-xs text-gray-400 group-hover:text-primary text-center leading-tight transition-colors">
                      Add your logo
                    </span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabId)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
                        activeTab === tab.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-600 hover:bg-soft hover:text-secondary'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => router.push('/messages')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-left text-gray-600 hover:bg-soft hover:text-secondary"
                >
                  <Mail size={18} />
                  <span>Inquiries</span>
                </button>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
          {/* Listings Tab */}
          {activeTab === 'listings' && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary">Listings</h3>
                  <p className="text-sm text-gray-600">Use Quick Edit Mode to update title, price, and status safely.</p>
                </div>
                <button
                  onClick={() => setQuickEditMode((prev) => !prev)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${quickEditMode ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-primary text-white hover:bg-primary/90'}`}
                >
                  {quickEditMode ? 'Exit Quick Edit Mode' : 'Enter Quick Edit Mode'}
                </button>
              </div>
              <div>
                <table className="w-full table-fixed">
                  <thead className="bg-soft">
                    <tr>
                      <th className="px-3 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selectedListings.size === listings.length && listings.length > 0}
                          onChange={() => {
                            if (selectedListings.size === listings.length) {
                              setSelectedListings(new Set());
                            } else {
                              setSelectedListings(new Set(listings.map(l => l.id)));
                            }
                          }}
                          className="w-5 h-5 rounded"
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[36%]">
                        Yacht
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[16%]">
                        Price
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[14%]">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[10%]">
                        Views
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase w-[24%]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {listings.map((listing) => (
                      <tr 
                        key={listing.id}
                        className={selectedListings.has(listing.id) ? 'bg-cyan-50' : 'hover:bg-soft'}
                      >
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={selectedListings.has(listing.id)}
                            onChange={() => toggleListingSelection(listing.id)}
                            className="w-5 h-5 rounded"
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-3">
                            {listing.images && listing.images.length > 0 ? (
                              <img 
                                src={mediaUrl(listing.images[0].url)} 
                                alt={listing.title}
                                className="w-12 h-12 object-cover rounded-lg"
                                onError={onImgError}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-400 text-xs">No image</span>
                              </div>
                            )}
                            <div className="min-w-0 w-full">
                              {quickEditMode ? (
                                <input
                                  type="text"
                                  value={quickEdits[listing.id]?.title ?? listing.title}
                                  onChange={(e) => updateQuickEditField(listing.id, 'title', e.target.value)}
                                  className="font-semibold text-secondary rounded px-2 py-1 border border-gray-200 bg-white w-full"
                                />
                              ) : (
                                <p className="font-semibold text-secondary truncate pr-2">
                                  {quickEdits[listing.id]?.title ?? listing.title}
                                </p>
                              )}
                              <p className="text-sm text-gray-600">
                                {[listing.city, listing.state].filter(Boolean).join(', ') || 'Location not set'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-secondary">$</span>
                            {quickEditMode ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={quickEdits[listing.id]?.price ?? (listing.price != null ? String(listing.price) : '')}
                                onChange={(e) => updateQuickEditField(listing.id, 'price', e.target.value)}
                                className="rounded px-2 py-1 w-full border border-gray-200 bg-white"
                                placeholder="Price"
                              />
                            ) : (
                              <span className="text-secondary font-medium truncate">
                                {quickEdits[listing.id]?.price ?? (listing.price != null ? String(listing.price) : 'N/A')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            (quickEdits[listing.id]?.status || listing.status) === 'active' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-soft text-dark'
                          }`}>
                            {quickEdits[listing.id]?.status || listing.status}
                          </span>
                          {quickEditMode && (
                            <select
                              value={quickEdits[listing.id]?.status ?? listing.status}
                              onChange={(e) => updateQuickEditField(listing.id, 'status', e.target.value)}
                              className="mt-2 block text-sm border border-gray-200 rounded px-2 py-1"
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="sold">Sold</option>
                              <option value="archived">Archived</option>
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <Eye size={16} className="text-gray-400" />
                            <span className="text-gray-900">{listing.views || 0}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => window.location.href = `/listings/${listing.id}`}
                              className="p-2 text-primary hover:bg-cyan-50 rounded transition-colors"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => window.location.href = `/listings/${listing.id}/edit`}
                              className="p-2 text-secondary hover:bg-soft rounded transition-colors"
                            >
                              <Edit size={18} />
                            </button>
                            {quickEditMode && (
                              <button
                                onClick={() => saveQuickEdit(listing.id)}
                                disabled={savingQuickEditId === listing.id}
                                className="px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:bg-gray-400"
                              >
                                {savingQuickEditId === listing.id ? 'Saving...' : 'Save'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Featured Tab — hidden until feature is ready */}

          {/* Media Gallery Tab */}
          {activeTab === 'media' && (
            <div className="space-y-4">
              {/* Header bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: '#10214F' }}>Media Library</h2>
                  <p className="text-sm text-gray-500">
                    {mediaStorageStats.total_files} files · {mediaStorageStats.total_size_gb.toFixed(2)} GB used
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {mediaSelected.size > 0 && (
                    <button
                      onClick={handleMediaBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition"
                    >
                      <Trash2 size={14} />
                      Delete ({mediaSelected.size})
                    </button>
                  )}
                  <button
                    onClick={() => mediaFileInputRef.current?.click()}
                    disabled={mediaUploading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition"
                    style={{ background: '#01BBDC' }}
                  >
                    <Upload size={14} />
                    {mediaUploading ? 'Uploading…' : 'Upload Files'}
                  </button>
                  <input
                    ref={mediaFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,application/pdf"
                    className="hidden"
                    onChange={e => { if (e.target.files) handleMediaUploadFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                {/* Folder sidebar */}
                <div className="w-52 flex-shrink-0 space-y-1">
                  <button
                    onClick={() => setMediaCurrentFolder('all')}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      mediaCurrentFolder === 'all' ? 'text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    style={mediaCurrentFolder === 'all' ? { background: '#10214F' } : {}}
                  >
                    <FolderOpen size={15} />
                    <span className="flex-1 text-left">All Files</span>
                    <span className="text-xs opacity-70">{mediaStorageStats.total_files}</span>
                  </button>

                  {mediaFolders.map(folder => (
                    <div key={folder.id} className="group relative">
                      <button
                        onClick={() => setMediaCurrentFolder(folder.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                          mediaCurrentFolder === folder.id ? 'text-white font-medium' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        style={mediaCurrentFolder === folder.id ? { background: '#10214F' } : {}}
                      >
                        <Folder size={15} />
                        <span className="flex-1 text-left truncate">{folder.name}</span>
                        <span className="text-xs opacity-70">{folder.file_count}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        title="Delete folder"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {/* New folder input */}
                  {mediaShowNewFolder ? (
                    <div className="flex gap-1 pt-1">
                      <input
                        autoFocus
                        value={mediaNewFolderName}
                        onChange={e => setMediaNewFolderName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setMediaShowNewFolder(false); setMediaNewFolderName(''); } }}
                        placeholder="Folder name"
                        className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#01BBDC]"
                      />
                      <button onClick={handleCreateFolder} className="px-2 py-1 bg-[#01BBDC] text-white rounded text-xs">+</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setMediaShowNewFolder(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition"
                    >
                      <FolderPlus size={15} />
                      New Folder
                    </button>
                  )}

                  {/* Type filters */}
                  <div className="pt-3 border-t mt-3 space-y-1">
                    {(['all', 'image', 'video', 'pdf'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setMediaFilter(type)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                          mediaFilter === type ? 'font-medium' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        style={mediaFilter === type ? { color: '#01BBDC' } : {}}
                      >
                        {type === 'all' && <Filter size={14} />}
                        {type === 'image' && <Image size={14} />}
                        {type === 'video' && <Film size={14} />}
                        {type === 'pdf' && <FileText size={14} />}
                        {type === 'all' ? 'All types' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                        {type !== 'all' && (
                          <span className="ml-auto text-xs text-gray-400">
                            {type === 'image' ? mediaStorageStats.images : type === 'video' ? mediaStorageStats.videos : mediaStorageStats.pdfs}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main content area */}
                <div className="flex-1 min-w-0">
                  {/* Search bar */}
                  <div className="relative mb-4">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search files…"
                      value={mediaSearch}
                      onChange={e => setMediaSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#01BBDC]"
                    />
                  </div>

                  {/* Drag-drop upload zone */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 transition ${
                      mediaDragging ? 'border-[#01BBDC] bg-cyan-50' : 'border-gray-200 hover:border-[#01BBDC]'
                    }`}
                    onDragOver={e => { e.preventDefault(); setMediaDragging(true); }}
                    onDragLeave={() => setMediaDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setMediaDragging(false);
                      if (e.dataTransfer.files.length > 0) handleMediaUploadFiles(e.dataTransfer.files);
                    }}
                    onClick={() => mediaFileInputRef.current?.click()}
                    style={{ cursor: 'pointer' }}
                  >
                    {mediaUploading ? (
                      <div className="flex items-center justify-center gap-2 text-[#01BBDC]">
                        <RefreshCw size={20} className="animate-spin" />
                        <span className="text-sm font-medium">Uploading…</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-[#01BBDC]">Click to upload</span> or drag & drop
                        </p>
                        <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, MP4, MOV, PDF · Up to 50 MB each</p>
                      </>
                    )}
                  </div>

                  {/* File grid */}
                  {mediaLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <RefreshCw size={24} className="animate-spin text-gray-400" />
                    </div>
                  ) : (() => {
                    const filtered = mediaFiles.filter(f => {
                      if (mediaSearch && !f.filename.toLowerCase().includes(mediaSearch.toLowerCase())) return false;
                      return true;
                    });
                    return filtered.length === 0 ? (
                      <div className="text-center py-16">
                        <Image size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-400 text-sm">No files here yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                        {filtered.map(file => {
                          const isImg = file.file_type === 'image';
                          const isVideo = file.file_type === 'video';
                          const isSelected = mediaSelected.has(file.id);
                          const isMoving = mediaMovingId === file.id;
                          return (
                            <div
                              key={file.id}
                              className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                                isSelected ? 'border-[#01BBDC] ring-2 ring-[#01BBDC]/30' : 'border-transparent hover:border-gray-200'
                              }`}
                            >
                              {/* Thumbnail */}
                              {isImg ? (
                                <img
                                  src={mediaUrl(file.thumbnail_url || file.url)}
                                  alt={file.filename}
                                  className="w-full h-24 sm:h-28 object-cover bg-gray-100"
                                />
                              ) : isVideo ? (
                                <div className="w-full h-24 sm:h-28 bg-gray-900 flex flex-col items-center justify-center gap-1">
                                  <Film size={22} className="text-gray-400" />
                                  <span className="text-xs text-gray-500 px-2 truncate max-w-full">{file.filename}</span>
                                </div>
                              ) : (
                                <div className="w-full h-24 sm:h-28 bg-gray-100 flex flex-col items-center justify-center gap-1">
                                  <FileText size={22} className="text-gray-400" />
                                  <span className="text-xs text-gray-500 px-2 truncate max-w-full">{file.filename}</span>
                                </div>
                              )}

                              {/* Selection checkbox */}
                              <button
                                onClick={() => toggleMediaSelect(file.id)}
                                className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                  isSelected
                                    ? 'bg-[#01BBDC] border-[#01BBDC]'
                                    : 'bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {isSelected && <Check size={11} className="text-white" />}
                              </button>

                              {/* Move to folder button */}
                              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition">
                                {isMoving ? (
                                  <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 min-w-[120px]" style={{ zIndex: 10 }}>
                                    <p className="text-xs font-medium text-gray-700 px-2 py-1">Move to folder</p>
                                    <button
                                      onClick={() => handleMoveToFolder(file.id, null)}
                                      className="w-full text-left text-xs px-2 py-1 hover:bg-gray-100 rounded"
                                    >
                                      No folder
                                    </button>
                                    {mediaFolders.map(f => (
                                      <button
                                        key={f.id}
                                        onClick={() => handleMoveToFolder(file.id, f.id)}
                                        className={`w-full text-left text-xs px-2 py-1 hover:bg-gray-100 rounded ${file.folder_id === f.id ? 'text-[#01BBDC] font-medium' : ''}`}
                                      >
                                        {f.name}
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => setMediaMovingId(null)}
                                      className="w-full text-left text-xs px-2 py-1 text-gray-400 hover:bg-gray-100 rounded"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setMediaMovingId(isMoving ? null : file.id)}
                                    className="w-6 h-6 rounded bg-white/90 shadow flex items-center justify-center hover:bg-white transition"
                                    title="Move to folder"
                                  >
                                    <Move size={12} className="text-gray-600" />
                                  </button>
                                )}
                              </div>

                              {/* Delete button */}
                              <button
                                onClick={() => handleMediaDelete(file.id)}
                                className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                              >
                                <X size={10} />
                              </button>

                              {/* File size label */}
                              <div className="px-2 py-1 bg-white border-t border-gray-100">
                                <p className="text-xs text-gray-500 truncate">{file.filename}</p>
                                <p className="text-[10px] text-gray-400">{file.file_size_mb.toFixed(1)} MB</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Bulk Tools Tab */}
          {activeTab === 'bulk' && (
            <BulkImportExportTools mode="standalone" userRole="dealer" />
          )}

          {/* CRM Tab */}
          {activeTab === 'crm' && (
            <div className="space-y-6">
              {/* Sub-tab navigation */}
              <div className="flex gap-2 border-b border-gray-200">
                {[
                  { id: 'crm', label: 'CRM Integration' },
                  { id: 'webhook', label: 'Direct Webhook', indicator: webhookConfigured }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCrmSubTab(tab.id as 'crm' | 'webhook')}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 -mb-px ${
                      crmSubTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-600 hover:text-secondary'
                    }`}
                  >
                    {tab.label}
                    {tab.indicator && <span className="w-2 h-2 rounded-full bg-green-500" title="Configured" />}
                  </button>
                ))}
              </div>

              {crmSubTab === 'crm' && (<>
              {crmConnected ? (
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-primary/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="text-primary" size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-secondary">
                          Connected to {crmType === 'hubspot' ? 'HubSpot' : crmType.charAt(0).toUpperCase() + crmType.slice(1).replace(/([A-Z])/g, ' $1')}
                        </h2>
                        <p className="text-sm text-gray-600">
                          Last sync: {crmStatus?.last_sync ? new Date(crmStatus.last_sync).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleCrmDisconnect} 
                      className="px-5 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium flex items-center gap-2"
                    >
                      <XCircle size={18} />
                      Disconnect
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-secondary text-lg">Sync Settings</h3>
                    
                    {[
                      { key: 'sync_enabled', label: 'Enable Auto-Sync', desc: 'Automatically sync new data' },
                      { key: 'sync_leads', label: 'Sync Leads', desc: 'Create leads/contacts from inquiries' },
                      { key: 'sync_contacts', label: 'Sync Contacts', desc: 'Keep contact information updated' },
                      { key: 'sync_messages', label: 'Sync Messages', desc: 'Add messages as notes/activities' }
                    ].map(setting => (
                      <div key={setting.key} className="flex items-center justify-between p-4 bg-soft rounded-xl border border-gray-200">
                        <div>
                          <p className="font-semibold text-secondary">{setting.label}</p>
                          <p className="text-sm text-gray-600">{setting.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={crmSyncSettings[setting.key as keyof SyncSettings]}
                            onChange={(e) => setCrmSyncSettings({ ...crmSyncSettings, [setting.key]: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    ))}

                    <button 
                      onClick={handleCrmUpdateSettings} 
                      className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 font-semibold transition-all shadow-lg mt-4"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-8">
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-secondary mb-3">Connect Your CRM</h2>
                    <p className="text-gray-600 mb-6">Automatically sync leads, contacts, and messages with your CRM</p>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                      {[
                        { id: 'hubspot', emoji: '🟠', name: 'HubSpot', desc: 'Connect with HubSpot CRM' },
                        { id: 'gohighlevel', emoji: '⚡', name: 'GoHighLevel', desc: 'Connect with GHL' },
                        { id: 'pipedrive', emoji: '📊', name: 'Pipedrive', desc: 'Sales-focused CRM' },
                        { id: 'zoho', emoji: '🎯', name: 'Zoho CRM', desc: 'Feature-rich platform' },
                        { id: 'activecampaign', emoji: '✉️', name: 'ActiveCampaign', desc: 'CRM + automation' },
                        { id: 'salesforce', emoji: '☁️', name: 'Salesforce', desc: 'Enterprise CRM' }
                      ].map((crm) => (
                        <button
                          key={crm.id}
                          onClick={() => setSelectedCRM(crm.id as any)}
                          className={`p-5 border-2 rounded-xl transition-all ${
                            selectedCRM === crm.id 
                              ? 'border-primary bg-primary/5 shadow-lg' 
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-4xl mb-2">{crm.emoji}</div>
                            <h3 className="font-bold text-secondary text-sm">{crm.name}</h3>
                            <p className="text-xs text-gray-600 mt-1">{crm.desc}</p>
                            {selectedCRM === crm.id && (
                              <div className="mt-2">
                                <span className="inline-flex items-center gap-1 text-primary text-xs font-semibold">
                                  <Check size={14} /> Selected
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    {selectedCRM === 'hubspot' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Access Token *</label>
                        <input
                          type="password"
                          value={credentials.access_token}
                          onChange={(e) => setCredentials({ ...credentials, access_token: e.target.value })}
                          placeholder="pat-na1-..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from HubSpot Settings → Integrations → Private Apps
                        </p>
                      </div>
                    ) : selectedCRM === 'gohighlevel' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">API Key *</label>
                        <input
                          type="password"
                          value={credentials.api_key}
                          onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                          placeholder="Your GoHighLevel API key"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from GHL Settings → API
                        </p>
                      </div>
                    ) : selectedCRM === 'pipedrive' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">API Token *</label>
                        <input
                          type="password"
                          value={credentials.api_key}
                          onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                          placeholder="Your Pipedrive API token"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from Pipedrive Settings → Personal Preferences → API
                        </p>
                      </div>
                    ) : selectedCRM === 'zoho' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">OAuth Token *</label>
                        <input
                          type="password"
                          value={credentials.api_key}
                          onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                          placeholder="Your Zoho OAuth token"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from Zoho Settings → Integrations → Connections
                        </p>
                      </div>
                    ) : selectedCRM === 'activecampaign' ? (
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">API Token *</label>
                        <input
                          type="password"
                          value={credentials.api_key}
                          onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                          placeholder="Your ActiveCampaign API token"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                        <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                          <span>💡</span>
                          Get from ActiveCampaign Settings → Integrations → API
                        </p>
                      </div>
                    ) : selectedCRM === 'salesforce' ? (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-secondary mb-2">Instance URL *</label>
                          <input
                            type="text"
                            value={credentials.instance_url}
                            onChange={(e) => setCredentials({ ...credentials, instance_url: e.target.value })}
                            placeholder="https://yourinstance.salesforce.com"
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-secondary mb-2">Access Token *</label>
                          <input
                            type="password"
                            value={credentials.access_token}
                            onChange={(e) => setCredentials({ ...credentials, access_token: e.target.value })}
                            placeholder="Your Salesforce access token"
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                          />
                        </div>
                        <p className="text-xs text-gray-600 flex items-start gap-2">
                          <span>💡</span>
                          Get from Salesforce Setup → Apps → App Manager → Create OAuth app
                        </p>
                      </>
                    ) : null}

                    <button
                      onClick={handleCrmConnect}
                      disabled={crmConnecting || !getCrmCredentialValid()}
                      className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      {crmConnecting ? (
                        <>
                          <RefreshCw size={20} className="animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Link size={20} />
                          Connect {selectedCRM.charAt(0).toUpperCase() + selectedCRM.slice(1).replace(/([A-Z])/g, ' $1')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="glass-card p-6 bg-gradient-to-br from-primary/10 to-soft">
                <h3 className="font-bold text-secondary mb-4 flex items-center gap-2">
                  <Zap size={22} className="text-primary" />
                  How CRM Integration Works
                </h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                    <span>New inquiries automatically create contacts/leads in your CRM</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                    <span>Deals/opportunities are created with yacht details and pricing</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                    <span>Messages are added as notes/activities on contact records</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary flex-shrink-0 mt-0.5">✓</span>
                    <span>All syncing happens in real-time in the background</span>
                  </li>
                </ul>
              </div>
              </>)}

              {/* Direct Webhook Sub-tab */}
              {crmSubTab === 'webhook' && (
                <div className="space-y-6">
                  <div className="glass-card p-8">
                    <h2 className="text-2xl font-bold text-secondary mb-2 flex items-center gap-3">
                      <Zap size={28} className="text-primary" />
                      Direct Webhook
                      {webhookConfigured && <span className="inline-flex items-center gap-1 text-green-600 text-base font-semibold"><CheckCircle size={18} /> Configured</span>}
                    </h2>
                    <p className="text-gray-600 mb-8">Send lead data directly to any URL when a buyer submits an inquiry</p>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Webhook URL *</label>
                        <input
                          type="url"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://your-crm.com/webhook"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Payload Format</label>
                        <select
                          value={webhookFormat}
                          onChange={(e) => setWebhookFormat(e.target.value as 'json' | 'adf_xml')}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        >
                          <option value="json">JSON — standard REST integration</option>
                          <option value="adf_xml">ADF XML — compatible with most DMS systems</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Authentication</label>
                        <select
                          value={webhookAuthType}
                          onChange={(e) => setWebhookAuthType(e.target.value as 'none' | 'api_key' | 'bearer' | 'basic')}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                        >
                          <option value="none">None</option>
                          <option value="api_key">API Key (header)</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="basic">Basic Auth</option>
                        </select>
                      </div>
                      {webhookAuthType !== 'none' && (
                        <div>
                          <label className="block text-sm font-semibold text-secondary mb-2">
                            {webhookAuthType === 'basic' ? 'Username:Password' : 'Token / Key'}
                          </label>
                          <input
                            type="password"
                            value={webhookAuthToken}
                            onChange={(e) => setWebhookAuthToken(e.target.value)}
                            placeholder={webhookAuthType === 'basic' ? 'user:password' : 'your-token-here'}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-secondary"
                          />
                        </div>
                      )}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleSaveWebhook}
                          disabled={!webhookUrl}
                          className="flex-1 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-all"
                        >
                          Save Webhook
                        </button>
                        {webhookConfigured && (
                          <>
                            <button
                              onClick={handleTestWebhook}
                              disabled={webhookTesting}
                              className="px-5 py-3 border-2 border-primary text-primary rounded-xl hover:bg-primary/5 font-semibold transition-all flex items-center gap-2"
                            >
                              {webhookTesting ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                              {webhookTesting ? 'Testing...' : 'Test'}
                            </button>
                            <button
                              onClick={handleDeleteWebhook}
                              className="px-5 py-3 border-2 border-red-300 text-red-600 rounded-xl hover:bg-red-50 font-semibold transition-all"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                      {webhookTestPassed && (
                        <div className="flex items-center gap-2 text-green-600 font-semibold">
                          <CheckCircle size={18} /> Test passed — webhook is working
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Webhook Info Box */}
                  <div className="glass-card p-6 bg-gradient-to-br from-primary/10 to-soft">
                    <h3 className="font-bold text-secondary mb-4 flex items-center gap-2">
                      <Zap size={22} className="text-primary" />
                      How Webhooks Work
                    </h3>
                    <ul className="space-y-3 text-sm text-gray-700">
                      <li className="flex items-start gap-3"><span className="text-primary flex-shrink-0 mt-0.5">✓</span><span>When a buyer submits an inquiry, we POST the lead data to your webhook URL</span></li>
                      <li className="flex items-start gap-3"><span className="text-primary flex-shrink-0 mt-0.5">✓</span><span>Choose JSON format for custom integrations, or ADF XML for DMS compatibility</span></li>
                      <li className="flex items-start gap-3"><span className="text-primary flex-shrink-0 mt-0.5">✓</span><span>Includes buyer contact info (name, email, phone) and yacht listing details</span></li>
                      <li className="flex items-start gap-3"><span className="text-primary flex-shrink-0 mt-0.5">✓</span><span>Authenticate with API key, Bearer token, or Basic auth if needed</span></li>
                      <li className="flex items-start gap-3"><span className="text-primary flex-shrink-0 mt-0.5">✓</span><span>Real-time delivery with automatic retry on failure</span></li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="max-w-5xl mx-auto">
              {billingLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin h-10 w-10 text-primary" />
                </div>
              ) : billingError ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3">
                  <AlertCircle size={20} />{billingError}
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-secondary mb-3">Choose Your Plan</h2>
                    <p className="text-gray-600">Select the perfect plan for your yacht dealership</p>
                  </div>

                  {/* Active subscription banner */}
                  {subscription?.active && subscription?.status === 'active' && (
                    <div className="mb-8 bg-primary/10 border border-primary/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-secondary">
                          Current Plan: <span className="text-primary capitalize">{currentTier}</span>
                          {subscription.cancel_at_period_end && <span className="ml-2 text-sm text-orange-600 font-medium">(cancels at period end)</span>}
                        </p>
                        {subscription.current_period_end && (
                          <p className="text-sm text-gray-600 mt-1">
                            Next billing: {new Date(Number(subscription.current_period_end) * 1000).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button onClick={openStripePortal} disabled={managingBilling}
                        className="flex items-center gap-2 px-5 py-2.5 border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary hover:text-white transition-all">
                        {managingBilling ? <Loader2 className="animate-spin h-4 w-4" /> : <ExternalLink size={16} />}
                        Manage Billing
                      </button>
                    </div>
                  )}

                  {/* Plan cards */}
                  <div className={`grid gap-6 mb-10 ${billingPlans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                    {billingPlans.map(plan => {
                      const isCurrent = plan.id === currentTier;
                      const isSelected = plan.id === selectedTier;
                      return (
                        <div key={plan.id} onClick={() => setSelectedTier(plan.id)}
                          className={`relative p-8 border-2 rounded-2xl cursor-pointer transition-all ${
                            isSelected ? 'border-primary bg-primary/5 shadow-xl scale-[1.02]'
                                       : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
                          }`}>
                          {plan.popular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                              <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">Most Popular</span>
                            </div>
                          )}
                          {isCurrent && (
                            <div className="absolute top-4 right-4">
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">Current Plan</span>
                            </div>
                          )}
                          {isSelected && !isCurrent && (
                            <div className="absolute top-6 right-6">
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="mb-6">
                            <h3 className="text-2xl font-bold text-secondary mb-2">{plan.name}</h3>
                            <div className="flex items-baseline gap-2">
                              <span className="text-5xl font-bold text-primary">${plan.price}</span>
                              <span className="text-gray-500 text-lg">/{plan.interval}</span>
                            </div>
                            {plan.custom_price && <p className="text-xs text-primary font-medium mt-1">Custom pricing applied</p>}
                          </div>
                          <ul className="space-y-3 mb-6">
                            {plan.features.map((f, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <span className="text-gray-700">{f}</span>
                              </li>
                            ))}
                          </ul>
                          <button className={`w-full py-3 rounded-lg font-semibold transition-all ${
                            isCurrent ? 'bg-green-50 text-green-700 border border-green-200'
                                      : isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                            {isCurrent ? 'Current Plan' : isSelected ? 'Selected' : 'Select Plan'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Checkout form */}
                  {selectedTier !== currentTier && billingPlans.find(p => p.id === selectedTier) && (
                    <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg mb-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-secondary">Payment Details</h3>
                          <p className="text-sm text-gray-500">
                            {subscription?.active ? 'Upgrade' : 'Subscribe'} to:{' '}
                            <span className="font-semibold text-primary">
                              {billingPlans.find(p => p.id === selectedTier)?.name} — ${billingPlans.find(p => p.id === selectedTier)?.price}/{billingPlans.find(p => p.id === selectedTier)?.interval}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => { window.location.href = '/dashboard/billing'; }}
                        className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 font-semibold transition-all shadow-lg"
                      >
                        Continue to Checkout
                      </button>
                      <p className="text-xs text-gray-500 text-center mt-4">Secure payment powered by Stripe. Cancel anytime.</p>
                    </div>
                  )}

                  {/* All plans include */}
                  <div className="bg-soft border-2 border-gray-200 rounded-2xl p-8">
                    <h3 className="text-lg font-bold text-secondary mb-4 text-center">All Plans Include</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="text-center"><div className="text-3xl mb-2">📊</div><h4 className="font-semibold text-secondary mb-1">Analytics Dashboard</h4><p className="text-sm text-gray-500">Track views and performance</p></div>
                      <div className="text-center"><div className="text-3xl mb-2">📧</div><h4 className="font-semibold text-secondary mb-1">Lead Management</h4><p className="text-sm text-gray-500">Manage inquiries easily</p></div>
                      <div className="text-center"><div className="text-3xl mb-2">🔒</div><h4 className="font-semibold text-secondary mb-1">Secure Platform</h4><p className="text-sm text-gray-500">Your data is protected</p></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Account Settings Tab */}
          {activeTab === 'account' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-secondary mb-2">Regional Preferences</h2>
                <p className="text-gray-600">Customize language, currency, and units for your region</p>
              </div>
              {prefLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                </div>
              ) : (
                <>
                  {/* Language */}
                  <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Globe className="text-primary" size={24} />
                      <h3 className="text-xl font-semibold text-secondary">Language</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { code: 'en', name: 'English', flag: '🇺🇸' },
                        { code: 'es', name: 'Español', flag: '🇪🇸' },
                        { code: 'fr', name: 'Français', flag: '🇫🇷' },
                        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
                        { code: 'it', name: 'Italiano', flag: '🇮🇹' },
                        { code: 'pt', name: 'Português', flag: '🇵🇹' },
                        { code: 'zh', name: '中文', flag: '🇨🇳' }
                      ].map(lang => (
                        <button key={lang.code} onClick={() => setPreferences({ ...preferences, language: lang.code })}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            preferences.language === lang.code ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                          }`}>
                          <div className="text-3xl mb-2">{lang.flag}</div>
                          <div className="font-medium text-sm">{lang.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <DollarSign className="text-green-600" size={24} />
                      <h3 className="text-xl font-semibold text-secondary">Currency</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {[
                        { code: 'USD', symbol: '$', name: 'US Dollar' },
                        { code: 'EUR', symbol: '€', name: 'Euro' },
                        { code: 'GBP', symbol: '£', name: 'British Pound' },
                        { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
                        { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
                        { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
                        { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
                        { code: 'MXN', symbol: '$', name: 'Mexican Peso' }
                      ].map(curr => (
                        <button key={curr.code} onClick={() => setPreferences({ ...preferences, currency: curr.code })}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            preferences.currency === curr.code ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                          }`}>
                          <div className="text-2xl font-bold mb-1">{curr.symbol}</div>
                          <div className="font-medium text-sm">{curr.code}</div>
                          <div className="text-xs text-gray-600">{curr.name}</div>
                        </button>
                      ))}
                    </div>
                    {preferences.currency !== 'USD' && prefRates[preferences.currency] && (
                      <div className="mt-4 p-4 bg-soft rounded-lg">
                        <p className="text-sm text-gray-700 mb-2">💱 Currency Conversion Example:</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-semibold">$100,000 USD</span>
                          <span className="text-gray-500">→</span>
                          <span className="font-semibold text-green-600">
                            {(100000 * prefRates[preferences.currency]).toFixed(2)} {preferences.currency}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Exchange rate: 1 USD = {prefRates[preferences.currency]?.toFixed(4)} {preferences.currency}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Units */}
                  <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Ruler className="text-purple-600" size={24} />
                      <h3 className="text-xl font-semibold text-secondary">Measurement Units</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[{value:'imperial',emoji:'📏',label:'Imperial',desc:'Feet, Gallons, Knots',note:'Common in USA'},
                        {value:'metric',emoji:'📐',label:'Metric',desc:'Meters, Liters, Km/h',note:'International standard'}].map(opt => (
                        <button key={opt.value} onClick={() => setPreferences({ ...preferences, units: opt.value })}
                          className={`p-6 rounded-lg border-2 transition-all ${
                            preferences.units === opt.value ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                          }`}>
                          <div className="text-3xl mb-2">{opt.emoji}</div>
                          <div className="font-semibold text-lg mb-2">{opt.label}</div>
                          <div className="text-sm text-gray-600">{opt.desc}</div>
                          <div className="text-xs text-gray-500 mt-2">{opt.note}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Clock className="text-orange-600" size={24} />
                      <h3 className="text-xl font-semibold text-secondary">Timezone</h3>
                    </div>
                    <select value={preferences.timezone}
                      onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary">
                      {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
                        'Europe/London','Europe/Paris','Asia/Tokyo','Australia/Sydney'].map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>

                  {/* Communication */}
                  <div className="glass-card p-6">
                    <h3 className="text-xl font-semibold text-secondary mb-4">Communication Preferences</h3>
                    <p className="text-sm text-gray-600 mb-5">Manage how YachtVersal can contact you about account activity and updates.</p>
                    <div className="space-y-4">
                      {[
                        { key: 'communication_email' as const, label: 'Account Emails', desc: 'Receive important account and marketplace emails.' },
                        { key: 'communication_sms' as const, label: 'Text Messages (SMS)', desc: 'Allow SMS notifications for urgent account updates.' },
                        { key: 'communication_push' as const, label: 'Push Notifications', desc: 'Enable push notifications for the web and future mobile app.' },
                      ].map(item => (
                        <label key={item.key} className="flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" checked={preferences[item.key]}
                            onChange={(e) => setPreferences({ ...preferences, [item.key]: e.target.checked })}
                            className="mt-1 h-4 w-4 rounded border-gray-300" />
                          <div>
                            <p className="font-medium text-secondary">{item.label}</p>
                            <p className="text-sm text-gray-600">{item.desc}</p>
                          </div>
                        </label>
                      ))}
                      <label className="flex items-start gap-3 pt-2 border-t border-gray-100 cursor-pointer">
                        <input type="checkbox" checked={preferences.marketing_opt_in}
                          onChange={(e) => setPreferences({ ...preferences, marketing_opt_in: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-gray-300" />
                        <div>
                          <p className="font-medium text-secondary">Marketing Emails (Optional)</p>
                          <p className="text-sm text-gray-600">Product updates, promotions, and listing growth tips.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Save */}
                  <div className="glass-card p-6">
                    <button onClick={handleSavePreferences} disabled={prefSaving}
                      className="w-full px-6 py-4 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:bg-gray-400 font-semibold text-lg flex items-center justify-center gap-3">
                      {prefSaving ? 'Saving...' : <><Save size={20} />Save Preferences</>}
                    </button>
                    <p className="text-sm text-gray-600 text-center mt-3">Changes will take effect after you reload the page</p>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                    <h4 className="font-semibold text-secondary mb-3">💡 How Preferences Work</h4>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li>• All yacht prices will be converted to your selected currency automatically</li>
                      <li>• Measurements (length, capacity, speed) will display in your chosen units</li>
                      <li>• The interface will display in your selected language</li>
                      <li>• Exchange rates are updated daily for accurate pricing</li>
                      <li>• Your preferences are saved across all devices</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Broker Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-secondary">Broker Page</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Customize how your dealership appears to buyers</p>
                </div>
                <div className="flex items-center gap-3">
                  {brokerProfile.slug && (
                    <button
                      onClick={() => window.open(`/dealers/${brokerProfile.slug}`, '_blank')}
                      className="flex items-center gap-2 px-4 py-2 border border-primary/20 text-secondary rounded-lg hover:bg-soft text-sm"
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                  )}
                  <button
                    onClick={handleBrokerSave}
                    disabled={brokerProfileSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-light rounded-lg hover-primary disabled:bg-gray-400 font-semibold text-sm"
                  >
                    {brokerProfileSaved ? <CheckCircle size={16} /> : <Save size={16} />}
                    {brokerProfileSaving ? 'Saving…' : brokerProfileSaved ? 'Saved!' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Banner */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-5 border-b border-primary/10">
                  <h3 className="text-base font-semibold text-secondary">Cover Photo</h3>
                  <p className="text-sm text-gray-500">Hero image shown at the top of your public broker page</p>
                </div>
                <div className="p-5">
                  <div className="relative h-52 bg-soft rounded-lg overflow-hidden border-2 border-dashed border-primary/20">
                    {brokerProfile.banner_url ? (
                      <img src={mediaUrl(brokerProfile.banner_url)} alt="Banner" className="w-full h-full object-cover" onError={onImgError} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Upload className="mx-auto text-gray-400 mb-2" size={36} />
                          <p className="text-gray-500 text-sm">Click to upload cover photo</p>
                        </div>
                      </div>
                    )}
                    <label className="absolute inset-0 cursor-pointer hover:bg-black/10 transition-all">
                      <input type="file" accept="image/*" onChange={(e) => handleBrokerImageUpload('banner_url', e)} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-base font-semibold text-secondary mb-5">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                    <div className="relative w-28 h-28 bg-soft rounded-lg overflow-hidden border-2 border-dashed border-primary/20">
                      {brokerProfile.logo_url ? (
                        <img src={mediaUrl(brokerProfile.logo_url)} alt="Logo" className="w-full h-full object-cover" onError={onImgError} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Building2 className="text-gray-400" size={36} />
                        </div>
                      )}
                      <label className="absolute inset-0 cursor-pointer hover:bg-black/10 transition-all flex items-center justify-center">
                        <input type="file" accept="image/*" onChange={(e) => handleBrokerImageUpload('logo_url', e)} className="hidden" />
                        <Upload className="text-white opacity-0 hover:opacity-100" size={20} />
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">Company Name *</label>
                      <input type="text" value={brokerProfile.company_name}
                        onChange={(e) => setBrokerProfile(p => ({...p, company_name: e.target.value}))}
                        className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                        placeholder="Your Company Name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">Contact Person</label>
                      <input type="text" value={brokerProfile.name}
                        onChange={(e) => setBrokerProfile(p => ({...p, name: e.target.value}))}
                        className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                        placeholder="John Doe" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">About Your Business</label>
                  <textarea value={brokerProfile.description}
                    onChange={(e) => setBrokerProfile(p => ({...p, description: e.target.value}))}
                    rows={4}
                    className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                    placeholder="Tell buyers about your dealership, experience, and what makes you unique…" />
                </div>
              </div>

              {/* Contact */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-base font-semibold text-secondary mb-5">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      <span className="flex items-center gap-1.5"><Mail size={14} /> Email *</span>
                    </label>
                    <input type="email" value={brokerProfile.email}
                      onChange={(e) => setBrokerProfile(p => ({...p, email: e.target.value}))}
                      className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                      placeholder="contact@yourdealership.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      <span className="flex items-center gap-1.5"><Phone size={14} /> Phone *</span>
                    </label>
                    <input type="tel" value={brokerProfile.phone}
                      onChange={(e) => setBrokerProfile(p => ({...p, phone: e.target.value}))}
                      className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                      placeholder="(555) 123-4567" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-secondary mb-1">
                      <span className="flex items-center gap-1.5"><Globe size={14} /> Website</span>
                    </label>
                    <input type="url" value={brokerProfile.website}
                      onChange={(e) => setBrokerProfile(p => ({...p, website: e.target.value}))}
                      className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                      placeholder="https://www.yourdealership.com" />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-base font-semibold text-secondary mb-5 flex items-center gap-2">
                  <MapPin size={18} className="text-primary" /> Location
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Street Address</label>
                    <input type="text" value={brokerProfile.address}
                      onChange={(e) => setBrokerProfile(p => ({...p, address: e.target.value}))}
                      className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                      placeholder="123 Marina Boulevard" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-secondary mb-1">City *</label>
                      <input type="text" value={brokerProfile.city}
                        onChange={(e) => setBrokerProfile(p => ({...p, city: e.target.value}))}
                        className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                        placeholder="Miami" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">State *</label>
                      <input type="text" value={brokerProfile.state}
                        onChange={(e) => setBrokerProfile(p => ({...p, state: e.target.value}))}
                        className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                        placeholder="FL" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">ZIP</label>
                      <input type="text" value={brokerProfile.zip_code}
                        onChange={(e) => setBrokerProfile(p => ({...p, zip_code: e.target.value}))}
                        className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                        placeholder="33139" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Country</label>
                    <input type="text" value={brokerProfile.country}
                      onChange={(e) => setBrokerProfile(p => ({...p, country: e.target.value}))}
                      className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                      placeholder="USA" />
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-base font-semibold text-secondary mb-5">Social Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {([
                    { field: 'facebook_url' as const, Icon: Facebook, color: 'text-blue-600', label: 'Facebook', placeholder: 'https://facebook.com/yourdealership' },
                    { field: 'instagram_url' as const, Icon: Instagram, color: 'text-pink-500', label: 'Instagram', placeholder: 'https://instagram.com/yourdealership' },
                    { field: 'twitter_url' as const, Icon: Twitter, color: 'text-sky-400', label: 'Twitter / X', placeholder: 'https://twitter.com/yourdealership' },
                    { field: 'linkedin_url' as const, Icon: Linkedin, color: 'text-blue-700', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourdealership' },
                  ]).map(({ field, Icon, color, label, placeholder }) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-secondary mb-1">
                        <span className="flex items-center gap-1.5"><Icon size={14} className={color} /> {label}</span>
                      </label>
                      <input type="url" value={brokerProfile[field]}
                        onChange={(e) => setBrokerProfile(p => ({...p, [field]: e.target.value}))}
                        className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                        placeholder={placeholder} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Show Team toggle */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-5 border-b border-primary/10 flex items-center gap-3">
                  <Users size={18} className="text-primary" />
                  <div>
                    <h3 className="text-base font-semibold text-secondary">Team on Broker Page</h3>
                    <p className="text-sm text-gray-500">Show your team members on your public broker profile</p>
                  </div>
                </div>
                <div className="p-5 flex items-start justify-between gap-6">
                  <p className="text-sm text-gray-500 flex-1">
                    When enabled, your active team members will appear on your public broker profile. Each card links to their individual profile and listings.
                    Team members must complete their <strong>My Profile</strong> in their dashboard to show a photo and title.
                  </p>
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <button type="button"
                      onClick={() => setBrokerProfile(p => ({...p, show_team_on_profile: !p.show_team_on_profile}))}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${brokerProfile.show_team_on_profile ? 'bg-primary' : 'bg-gray-300'}`}
                      aria-pressed={brokerProfile.show_team_on_profile}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${brokerProfile.show_team_on_profile ? 'translate-x-8' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-xs font-semibold ${brokerProfile.show_team_on_profile ? 'text-primary' : 'text-gray-400'}`}>
                      {brokerProfile.show_team_on_profile ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Co-brokering toggle */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-5 border-b border-primary/10 flex items-center gap-3">
                  <Share2 size={18} className="text-accent" />
                  <div>
                    <h3 className="text-base font-semibold text-secondary">Co-Brokering &amp; API Access</h3>
                    <p className="text-sm text-gray-500">Control whether your listings are accessible to other brokers via the platform API</p>
                  </div>
                </div>
                <div className="p-5 flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-secondary mb-1">Enable Co-Brokering</p>
                    <p className="text-sm text-gray-500">
                      When enabled, your active listings appear in the platform&apos;s co-brokering API so other licensed brokers can present them to their clients.
                      When <strong>disabled</strong>, none of your listings will be accessible via the API regardless of individual listing settings.
                    </p>
                    {!brokerProfile.cobrokering_enabled && (
                      <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                        <strong>Co-brokering is off for your entire account.</strong> Save Changes to apply.
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <button type="button"
                      onClick={() => setBrokerProfile(p => ({...p, cobrokering_enabled: !p.cobrokering_enabled}))}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${brokerProfile.cobrokering_enabled ? 'bg-accent' : 'bg-gray-300'}`}
                      aria-pressed={brokerProfile.cobrokering_enabled}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${brokerProfile.cobrokering_enabled ? 'translate-x-8' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-xs font-semibold ${brokerProfile.cobrokering_enabled ? 'text-accent' : 'text-gray-400'}`}>
                      {brokerProfile.cobrokering_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom save */}
              <div className="flex justify-end">
                <button
                  onClick={handleBrokerSave}
                  disabled={brokerProfileSaving}
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-light rounded-lg hover-primary disabled:bg-gray-400 font-semibold"
                >
                  {brokerProfileSaved ? <CheckCircle size={18} /> : <Save size={18} />}
                  {brokerProfileSaving ? 'Saving…' : brokerProfileSaved ? 'Saved!' : 'Save All Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="glass-card p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-secondary">Performance Analytics</h2>
                    <p className="text-sm text-gray-600 mt-1">Track leads achieved and compare performance over time.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {([
                      { id: '7d', label: 'Last 7 days' },
                      { id: '30d', label: 'Last 30 days' },
                      { id: '90d', label: 'Last 90 days' },
                    ] as const).map((range) => (
                      <button
                        key={range.id}
                        onClick={() => setAnalyticsRange(range.id)}
                        className={`px-3 py-2 text-sm rounded-lg border ${analyticsRange === range.id ? 'bg-primary text-white border-primary' : 'bg-white text-secondary border-gray-200 hover:bg-soft'}`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Leads Achieved</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{teamPerformance?.summary.period_leads ?? stats.totalInquiries}</p>
                    <p className="text-xs text-gray-500 mt-1">{analyticsRange === '7d' ? 'week over week' : analyticsRange === '30d' ? 'month over month' : 'period over period'}</p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Lead Change</p>
                    <p className={`text-2xl font-bold mt-1 ${(teamPerformance?.summary.lead_delta ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {(teamPerformance?.summary.lead_delta ?? 0) >= 0 ? '+' : ''}{teamPerformance?.summary.lead_delta ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{(teamPerformance?.summary.lead_delta_percent ?? 0).toFixed(1)}%</p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Team Response Rate</p>
                    <p className="text-2xl font-bold text-primary mt-1">{(teamPerformance?.summary.average_response_rate ?? 0).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-1">Replied inquiries across team</p>
                  </div>
                  <div className="border border-primary/10 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Pending Follow-ups</p>
                    <p className={`text-2xl font-bold mt-1 ${(teamPerformance?.summary.pending_inquiries ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {teamPerformance?.summary.pending_inquiries ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Unanswered inquiries</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="font-semibold text-secondary mb-4">Top Listings by Lead Volume</h3>
                  <div className="space-y-3">
                    {[...listings]
                      .sort((a, b) => (b.inquiries || 0) - (a.inquiries || 0))
                      .slice(0, 5)
                      .map((listing) => (
                        <div key={listing.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-secondary truncate flex-1">{listing.title}</span>
                          <span className="text-sm font-semibold text-primary">{listing.inquiries || 0} leads</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-semibold text-secondary mb-4">Team Snapshot</h3>
                  {teamPerformanceLoading ? (
                    <p className="text-sm text-gray-600">Loading team metrics...</p>
                  ) : teamPerformance && teamPerformance.members.length > 0 ? (
                    <div className="space-y-3">
                      {teamPerformance.members.slice(0, 5).map((member) => (
                        <div key={member.id} className="flex items-center justify-between gap-3 border border-primary/10 rounded-lg p-3">
                          <div className="min-w-0">
                            <p className="font-medium text-secondary truncate">{member.name}</p>
                            <p className="text-xs text-gray-600 truncate">{member.pending_inquiries} pending · {member.inquiries_current_period} leads</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${member.response_rate >= 70 ? 'bg-emerald-100 text-emerald-700' : member.response_rate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {member.response_rate.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No team data available yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-secondary">Team Management</h2>
                  <p className="text-gray-600 mt-1">Manage your sales team and their permissions</p>
                </div>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-light rounded-lg hover-primary transition-colors"
                >
                  <UserPlus size={20} />
                  Invite Team Member
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-5">
                  <p className="text-gray-600 text-sm mb-1">Total Members</p>
                  <p className="text-3xl font-bold text-secondary">{teamMembers.length}</p>
                </div>
                <div className="glass-card p-5">
                  <p className="text-gray-600 text-sm mb-1">Active Members</p>
                  <p className="text-3xl font-bold text-emerald-600">{teamMembers.filter(m => m.active).length}</p>
                </div>
                <div className="glass-card p-5">
                  <p className="text-gray-600 text-sm mb-1">Leads ({teamPerformance?.range_days ?? 30}d)</p>
                  <p className="text-3xl font-bold text-primary">{teamPerformance?.summary.period_leads ?? 0}</p>
                </div>
                <div className="glass-card p-5">
                  <p className="text-gray-600 text-sm mb-1">Avg Response Rate</p>
                  <p className="text-3xl font-bold text-secondary">{(teamPerformance?.summary.average_response_rate ?? 0).toFixed(1)}%</p>
                </div>
              </div>

              {/* Team Members List */}
              <div className="glass-card overflow-hidden">
                <div className="p-5 border-b border-primary/10">
                  <h3 className="text-xl font-semibold text-secondary">Team Members</h3>
                </div>
                <div className="divide-y">
                  {teamMembersLoading ? (
                    <div className="p-12 flex justify-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <UserPlus size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-lg mb-2">No team members yet</p>
                      <p className="text-sm mb-4">Invite your sales team to start collaborating</p>
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-6 py-3 bg-primary text-light rounded-lg hover-primary"
                      >
                        Invite First Member
                      </button>
                    </div>
                  ) : (
                    teamMembers.map((member) => (
                      <div key={member.id} className="p-5 hover:bg-soft transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-primary font-semibold text-lg">
                                {member.first_name?.[0]}{member.last_name?.[0]}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-semibold text-lg text-secondary">{member.first_name} {member.last_name}</h4>
                                {!member.active && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">Inactive</span>
                                )}
                              </div>
                              <div className="space-y-0.5 text-sm text-gray-600">
                                <div className="flex items-center gap-2"><Mail size={13} />{member.email}</div>
                                {member.phone && <div className="flex items-center gap-2"><Phone size={13} />{member.phone}</div>}
                                <div className="flex items-center gap-2"><Shield size={13} /><span className="capitalize">{member.role.replace('_', ' ')}</span></div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {member.permissions.can_create_listings && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full">Create Listings</span>}
                                {member.permissions.can_edit_all_listings && <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">Edit All</span>}
                                {member.permissions.can_view_inquiries && <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">View Inquiries</span>}
                                {member.permissions.can_view_analytics && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">Analytics</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => openMemberDashboard(member.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View Dashboard">
                              <LayoutDashboard size={18} />
                            </button>
                            <button onClick={() => setEditingMember(member)} className="p-2 text-gray-600 hover:bg-soft rounded transition-colors" title="Edit Permissions">
                              <Edit size={18} />
                            </button>
                            <button onClick={() => handleRemoveMember(member.id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors" title="Remove">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rep Performance Table */}
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-secondary">Rep Performance</h3>
                  <div className="flex items-center gap-2">
                    {(['7d', '30d', '90d'] as const).map(r => (
                      <button key={r} onClick={() => setAnalyticsRange(r)}
                        className={`px-3 py-1.5 text-sm rounded ${analyticsRange === r ? 'bg-primary text-white' : 'bg-soft text-secondary'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {teamPerformanceLoading ? (
                  <div className="p-6 text-sm text-gray-600">Loading performance data...</div>
                ) : !teamPerformance || teamPerformance.members.length === 0 ? (
                  <div className="p-6 text-sm text-gray-600">No performance data available yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-soft">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Rep</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Listings</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Leads</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Pending</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Response Rate</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">Avg Response</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {teamPerformance.members.map((member) => (
                          <tr key={member.id} className="hover:bg-soft">
                            <td className="px-4 py-3">
                              <p className="font-medium text-secondary">{member.name}</p>
                              <p className="text-xs text-gray-600">{member.email}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary">{member.listings_active} active / {member.listings_total} total</td>
                            <td className="px-4 py-3 text-sm text-secondary">{member.inquiries_current_period} ({teamPerformance.range_days}d)</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${member.pending_inquiries > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {member.pending_inquiries}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-secondary">{member.response_rate.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-sm text-secondary">{member.avg_response_hours != null ? `${member.avg_response_hours.toFixed(1)}h` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-primary/10">
                <div className="p-6 border-b border-primary/10 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-secondary">Invite Team Member</h2>
                  <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                      <input type="text" value={inviteForm.first_name}
                        onChange={(e) => setInviteForm({...inviteForm, first_name: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                      <input type="text" value={inviteForm.last_name}
                        onChange={(e) => setInviteForm({...inviteForm, last_name: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input type="email" value={inviteForm.email}
                      onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input type="tel" value={inviteForm.phone}
                      onChange={(e) => setInviteForm({...inviteForm, phone: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Permissions</h3>
                    <div className="space-y-2">
                      {Object.entries(inviteForm.permissions).map(([key, value]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input type="checkbox" checked={value}
                            onChange={(e) => setInviteForm({...inviteForm, permissions: {...inviteForm.permissions, [key]: e.target.checked}})}
                            className="rounded text-primary" />
                          <span className="text-sm text-gray-700">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setShowInviteModal(false)} className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleInviteMember} className="flex-1 px-6 py-3 bg-primary text-light rounded-lg hover-primary">Send Invitation</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Permissions Modal */}
          {editingMember && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-primary/10">
                <div className="p-6 border-b border-primary/10 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-secondary">Edit Permissions — {editingMember.first_name} {editingMember.last_name}</h2>
                  <button onClick={() => setEditingMember(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-3">
                  <label className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <input type="checkbox" checked={editingMember.public_profile ?? false}
                      onChange={(e) => setEditingMember({...editingMember, public_profile: e.target.checked})}
                      className="rounded text-primary" />
                    <div>
                      <span className="text-sm font-medium text-gray-800">Public Broker Profile</span>
                      <p className="text-xs text-gray-500">Appears as a broker on the brokerage's public page</p>
                    </div>
                  </label>
                  {Object.entries(editingMember.permissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3">
                      <input type="checkbox" checked={value}
                        onChange={(e) => setEditingMember({...editingMember, permissions: {...editingMember.permissions, [key]: e.target.checked}})}
                        className="rounded text-primary" />
                      <span className="text-sm text-gray-700">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </label>
                  ))}
                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setEditingMember(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={() => handleUpdatePermissions(editingMember.id, editingMember.permissions, editingMember.public_profile ?? false)} className="flex-1 px-4 py-2 bg-primary text-light rounded-lg hover-primary">Save Changes</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Member Dashboard Drawer */}
          {viewingMemberId !== null && (
            <div className="fixed inset-0 z-50 flex justify-end" onClick={closeMemberDashboard}>
              <div className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
                  <button onClick={closeMemberDashboard} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={22} /></button>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{memberOverview?.member.name ?? 'Team Member'}</p>
                    <p className="text-xs text-gray-400">{memberOverview?.member.email}</p>
                  </div>
                  <button onClick={closeMemberDashboard} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <div className="flex border-b">
                  {([
                    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
                    { key: 'messages', label: 'Messages', icon: MessageSquare },
                    { key: 'leads',    label: 'Leads',    icon: ClipboardList },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setMemberOverviewTab(key)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${memberOverviewTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                      <Icon size={15} />{label}
                    </button>
                  ))}
                </div>
                {memberOverviewLoading ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {memberOverviewTab === 'overview' && memberOverview && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Listings',    value: memberOverview.listings.total },
                            { label: 'Active',      value: memberOverview.listings.active },
                            { label: 'Total Leads', value: memberOverview.inquiries.total },
                            { label: 'Messages',    value: memberOverview.messages.total },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-gray-800">{value}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                            </div>
                          ))}
                        </div>
                        {memberOverview.messages.pending > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-800">
                            {memberOverview.messages.pending} message(s) awaiting response
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lead Pipeline</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(memberOverview.inquiries.by_stage).map(([stage, cnt]) => (
                              <span key={stage} className={`px-3 py-1 rounded-full text-xs font-semibold ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600'}`}>
                                {stage}: {cnt}
                              </span>
                            ))}
                            {Object.keys(memberOverview.inquiries.by_stage).length === 0 && (
                              <p className="text-sm text-gray-400 italic">No leads yet.</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                    {memberOverviewTab === 'messages' && (
                      memberMessages.length === 0 ? (
                        <p className="text-sm text-gray-400 italic text-center py-10">No messages found.</p>
                      ) : (
                        <div className="space-y-2">
                          {memberMessages.map((msg) => (
                            <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex justify-between items-start gap-2">
                                <p className="font-medium text-sm text-gray-800 truncate flex-1">{msg.subject || '(No subject)'}</p>
                                <p className="text-xs text-gray-400 whitespace-nowrap">{new Date(msg.created_at).toLocaleDateString()}</p>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">From: {msg.sender_name}</p>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{msg.body}</p>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                    {memberOverviewTab === 'leads' && (
                      memberInquiries.length === 0 ? (
                        <p className="text-sm text-gray-400 italic text-center py-10">No leads assigned.</p>
                      ) : (
                        <div className="space-y-2">
                          {memberInquiries.map((inq) => (
                            <div key={inq.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-800">{inq.sender_name}</p>
                                  <p className="text-xs text-gray-500 truncate">{inq.sender_email}</p>
                                  {inq.listing_title && <p className="text-xs text-gray-400 mt-0.5 truncate">Listing: {inq.listing_title}</p>}
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STAGE_COLORS[inq.lead_stage] ?? 'bg-gray-100 text-gray-600'}`}>{inq.lead_stage}</span>
                                  <span className="text-xs text-gray-400">Score: {inq.lead_score}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api-keys' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-secondary mb-2">API Keys</h2>
                <p className="text-secondary/70">Manage your YachtVersal API keys for programmatic access</p>
              </div>

              <div className="glass-card p-4 mb-6">
                <p className="text-sm text-gray-600 mb-3">Create a new key (full key shown once at creation)</p>
                <div className="flex flex-col md:flex-row gap-3">
                  <input type="text" value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Key name" />
                  <button onClick={handleCreateKey} disabled={creatingKey}
                    className="px-6 py-2 bg-primary text-light rounded-lg hover-primary disabled:bg-gray-400">
                    {creatingKey ? 'Creating...' : 'Create API Key'}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-secondary/80">
                    <strong>Important:</strong> Full API keys are only shown once when created. Existing keys are stored securely and can only be displayed by prefix.
                  </p>
                </div>
              </div>

              {apiKeysLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-12 bg-soft rounded-2xl border-2 border-gray-200">
                  <Key className="w-12 h-12 text-secondary/40 mx-auto mb-4" />
                  <p className="text-secondary/70 font-medium">No API keys found</p>
                  <p className="text-sm text-secondary/50 mt-2">API keys are automatically generated when you create an account</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeys.map(key => (
                    <div key={key.id} className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center min-w-0">
                              <h3 className="text-lg font-semibold text-secondary truncate">{key.name}</h3>
                              <span className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${
                                key.is_active ? 'bg-primary/10 text-primary border border-primary/20'
                                              : 'bg-gray-100 text-secondary/60 border border-gray-200'
                              }`}>{key.is_active ? 'Active' : 'Inactive'}</span>
                            </div>
                            <button onClick={() => handleRegenerateKey(key)} disabled={regeneratingKeyId === key.id}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-soft border border-gray-200 text-secondary rounded-lg hover:bg-primary/10 disabled:opacity-60">
                              <RefreshCw size={14} className={regeneratingKeyId === key.id ? 'animate-spin' : ''} />
                              {regeneratingKeyId === key.id ? 'Regenerating...' : 'Regenerate'}
                            </button>
                            <button onClick={() => handleToggleKeyActive(key)} disabled={togglingKeyId === key.id}
                              className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border disabled:opacity-60 ${
                                key.is_active ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                             : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              }`}>
                              {togglingKeyId === key.id ? 'Saving...' : key.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                          <div className="mb-4">
                            <label className="text-xs font-semibold text-secondary/60 uppercase tracking-wide block mb-2">API Key</label>
                            <div className="flex items-center gap-2">
                              <code className="bg-soft px-4 py-3 rounded-lg font-mono text-sm flex-1 text-secondary border border-gray-200">
                                {fullKeys[key.id] || `${key.key_prefix}••••••••••••••••••••••••••`}
                              </code>
                              <button onClick={() => copyKeyToClipboard(fullKeys[key.id] || key.key_prefix, key.id)}
                                className="p-3 text-secondary/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all border border-gray-200" title="Copy key">
                                {copiedKeyId === key.id ? <Check className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5" />}
                              </button>
                            </div>
                            {copiedKeyId === key.id && <p className="text-xs text-emerald-700 mt-2">Copied to clipboard.</p>}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-soft p-3 rounded-lg border border-gray-200">
                              <span className="text-secondary/60 block mb-1 text-xs font-medium">Created:</span>
                              <p className="text-secondary font-semibold">{new Date(key.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-soft p-3 rounded-lg border border-gray-200">
                              <span className="text-secondary/60 block mb-1 text-xs font-medium">Rate Limit:</span>
                              <p className="text-secondary font-semibold">{key.rate_limit.toLocaleString()} req/hr</p>
                            </div>
                            {key.last_used_at && (
                              <div className="bg-soft p-3 rounded-lg border border-gray-200">
                                <span className="text-secondary/60 block mb-1 text-xs font-medium">Last Used:</span>
                                <p className="text-secondary font-semibold">{new Date(key.last_used_at).toLocaleDateString()}</p>
                              </div>
                            )}
                            {key.expires_at && (
                              <div className="bg-soft p-3 rounded-lg border border-gray-200">
                                <span className="text-secondary/60 block mb-1 text-xs font-medium">Expires:</span>
                                <p className="text-secondary font-semibold">{new Date(key.expires_at).toLocaleDateString()}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 bg-primary/5 border-2 border-primary/20 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-secondary mb-2 flex items-center gap-2"><span className="text-2xl">📚</span>API Documentation</h3>
                <p className="text-secondary/70 mb-4">Learn how to use your API key to access YachtVersal programmatically</p>
                <a href="/api/docs" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center text-primary hover:text-primary/80 font-semibold transition-colors">
                  View API Documentation
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>

              <div className="mt-6 bg-secondary rounded-2xl p-6">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><span className="text-xl">💻</span>Usage Example</h4>
                <pre className="text-primary text-sm overflow-x-auto bg-secondary/80 p-4 rounded-lg">{`curl https://api.yachtversal.com/api/listings \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
              </div>
            </div>
          )}

          {/* Salesman Profile Tab */}
          {activeTab === 'salesman-profile' && (
            <div className="glass-card p-8">
              <div className="text-center mb-6">
                <User className="mx-auto text-primary mb-4" size={64} />
                <h2 className="text-2xl font-bold text-secondary mb-2">My Profile</h2>
                <p className="text-gray-600 mb-6">
                  {isDealer
                    ? 'Set up your personal broker profile and optionally appear on your brokerage\'s public page.'
                    : 'Manage your public profile, bio, and contact info shown to buyers.'}
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/dashboard/salesman-profile'}
                className="w-full px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors"
              >
                Edit My Profile
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedListings.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="glass-card rounded-xl shadow-2xl border-2 border-primary p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-cyan-100 rounded-lg">
                <CheckSquare className="text-primary" size={20} />
                <span className="font-semibold text-secondary">
                  {selectedListings.size} selected
                </span>
              </div>

              <div className="h-8 w-px bg-primary/20" />

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button className="px-4 py-2 bg-soft hover:bg-primary/10 rounded-lg font-medium text-secondary transition-colors">
                    Change Status
                  </button>
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-white rounded-lg shadow-xl border border-primary/10 py-2 w-40">
                    {['active', 'draft', 'archived'].map(status => (
                      <button
                        key={status}
                        onClick={() => handleBulkStatusChange(status)}
                        className="w-full px-4 py-2 text-left hover:bg-soft text-secondary capitalize transition-colors"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 rounded-lg font-medium text-red-800 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>

              <div className="h-8 w-px bg-primary/20" />

              <button
                onClick={() => setSelectedListings(new Set())}
                className="p-2 hover:bg-soft rounded-lg transition-colors text-secondary"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
