import { useState, useEffect } from 'react';
import { Search, Filter, Image, Video, FileText, Trash2, Download, TrendingUp, HardDrive, Users, BarChart3, AlertTriangle, Eye, X, Check, MoreVertical } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type MediaItem = {
  id: number;
  filename: string;
  url: string;
  thumbnail_url?: string;
  alt_text?: string;
  file_type: 'image' | 'video' | 'pdf';
  file_size_mb: number;
  owner_id: number;
  owner_name: string;
  owner_company: string;
  owner_type: 'dealer' | 'salesman' | 'admin';
  created_at: string;
  used_in_listings: number;
  views: number;
};

type StorageStats = {
  total_files: number;
  total_size_gb: number;
  by_type: {
    images: { count: number; size_gb: number };
    videos: { count: number; size_gb: number };
    pdfs: { count: number; size_gb: number };
  };
  by_dealer: Array<{
    dealer_id: number;
    dealer_name: string;
    file_count: number;
    size_gb: number;
    tier: string;
  }>;
  orphaned_files: number;
  large_files: number;
};

type StorageHealth = {
  backend: 'local' | 's3';
  ready: boolean;
  details?: Record<string, string>;
  issues?: string[];
};

type StorageTestResult = {
  success: boolean;
  backend: 'local' | 's3';
  message: string;
  issues?: string[];
};

export default function AdminMediaDashboard() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'pdf'>('all');
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'usage'>('date');
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState<MediaItem | null>(null);
  const [activeView, setActiveView] = useState<'stats' | 'media'>('stats');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [storageHealthLoading, setStorageHealthLoading] = useState(false);
  const [storageTestLoading, setStorageTestLoading] = useState(false);
  const [storageTestResult, setStorageTestResult] = useState<StorageTestResult | null>(null);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchStats();
    fetchMedia();
  }, [currentPage, filterType, filterOwner, sortBy]);

  useEffect(() => {
    fetchStorageHealth();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/media/stats'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('skip', ((currentPage - 1) * itemsPerPage).toString());
      params.append('limit', itemsPerPage.toString());
      if (filterType !== 'all') params.append('file_type', filterType);
      if (filterOwner) params.append('owner_id', filterOwner);
      if (searchTerm) params.append('search', searchTerm);
      params.append('sort', sortBy);

      const response = await fetch(apiUrl(`/admin/media?${params}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setMedia(data.media || []);
        setTotalPages(Math.ceil(data.total / itemsPerPage));
      }
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageHealth = async () => {
    setStorageHealthLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/storage/health'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStorageHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch storage health:', error);
    } finally {
      setStorageHealthLoading(false);
    }
  };

  const handleRunStorageTest = async () => {
    setStorageTestLoading(true);
    setStorageTestResult(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/storage/health/test'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStorageTestResult(data);
      } else {
        setStorageTestResult({
          success: false,
          backend: storageHealth?.backend || 'local',
          message: 'Storage test request failed'
        });
      }
    } catch (error) {
      console.error('Failed to run storage test:', error);
      setStorageTestResult({
        success: false,
        backend: storageHealth?.backend || 'local',
        message: 'Storage test request failed'
      });
    } finally {
      setStorageTestLoading(false);
      fetchStorageHealth();
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedMedia.size} file(s)? This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(apiUrl('/admin/media/bulk-delete'), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ media_ids: Array.from(selectedMedia) })
      });

      setMedia(media.filter(m => !selectedMedia.has(m.id)));
      setSelectedMedia(new Set());
      fetchStats();
    } catch (error) {
      console.error('Failed to delete media:', error);
      alert('Failed to delete some files');
    }
  };

  const cleanupOrphanedFiles = async () => {
    if (!confirm('Delete all orphaned files (not used in any listings)?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/admin/media/cleanup-orphaned'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Cleaned up ${data.count} orphaned files`);
        fetchStats();
        fetchMedia();
      }
    } catch (error) {
      console.error('Failed to cleanup:', error);
    }
  };

  const toggleSelectMedia = (id: number) => {
    const newSelected = new Set(selectedMedia);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedMedia(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedMedia.size === media.length) {
      setSelectedMedia(new Set());
    } else {
      setSelectedMedia(new Set(media.map(m => m.id)));
    }
  };

  const filteredMedia = media.filter(m => {
    const matchesSearch = m.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         m.owner_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={20} className="text-primary" />;
      case 'video': return <Video size={20} className="text-purple-500" />;
      case 'pdf': return <FileText size={20} className="text-red-500" />;
      default: return <FileText size={20} className="text-gray-500" />;
    }
  };

  if (!stats && activeView === 'stats') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Platform Media Management</h2>
          <p className="text-gray-600 mt-1">Monitor and manage all media across the platform</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveView('stats')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'stats' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            📊 Statistics
          </button>
          <button
            onClick={() => setActiveView('media')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'media' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            🖼️ All Media
          </button>
        </div>
      </div>

      {/* Statistics View */}
      {activeView === 'stats' && stats && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <HardDrive className="text-primary" size={32} />
                <TrendingUp className="text-green-600" size={20} />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {stats.total_size_gb.toFixed(1)} GB
              </div>
              <p className="text-sm text-gray-600">Total Storage Used</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <Image className="text-green-600" size={32} />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {stats.total_files.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Total Files</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="text-purple-600" size={32} />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {stats.by_dealer.length}
              </div>
              <p className="text-sm text-gray-600">Active Dealers</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle className="text-orange-600" size={32} />
              </div>
              <div className="text-3xl font-bold text-orange-600 mb-1">
                {stats.orphaned_files}
              </div>
              <p className="text-sm text-gray-600">Orphaned Files</p>
            </div>
          </div>

          {/* Storage Health */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Storage Health</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchStorageHealth}
                  disabled={storageHealthLoading}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                >
                  {storageHealthLoading ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={handleRunStorageTest}
                  disabled={storageTestLoading}
                  className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
                >
                  {storageTestLoading ? 'Running test...' : 'Run Test'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-gray-500 mb-1">Backend</p>
                <p className="text-lg font-semibold text-gray-900">{storageHealth?.backend?.toUpperCase() || 'Unknown'}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-gray-500 mb-1">Status</p>
                <p className={`text-lg font-semibold ${storageHealth?.ready ? 'text-green-600' : 'text-red-600'}`}>
                  {storageHealth?.ready ? 'Ready' : 'Not Ready'}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-gray-500 mb-1">Issues</p>
                <p className="text-lg font-semibold text-gray-900">{storageHealth?.issues?.length || 0}</p>
              </div>
            </div>

            {storageHealth?.issues && storageHealth.issues.length > 0 && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-800 mb-1">Configuration Issues</p>
                <ul className="text-sm text-red-700 list-disc pl-5">
                  {storageHealth.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {storageTestResult && (
              <div className={`rounded-lg border p-3 ${storageTestResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <p className={`text-sm font-medium ${storageTestResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {storageTestResult.message}
                </p>
                {storageTestResult.issues && storageTestResult.issues.length > 0 && (
                  <ul className={`mt-1 text-sm list-disc pl-5 ${storageTestResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {storageTestResult.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* File Type Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Storage by Type</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <Image size={48} className="text-primary mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">
                  {stats.by_type.images.count.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 mb-2">Images</p>
                <div className="text-lg font-semibold text-primary">
                  {stats.by_type.images.size_gb.toFixed(1)} GB
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${(stats.by_type.images.size_gb / stats.total_size_gb) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <Video size={48} className="text-purple-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">
                  {stats.by_type.videos.count.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 mb-2">Videos</p>
                <div className="text-lg font-semibold text-purple-600">
                  {stats.by_type.videos.size_gb.toFixed(1)} GB
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${(stats.by_type.videos.size_gb / stats.total_size_gb) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <FileText size={48} className="text-red-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">
                  {stats.by_type.pdfs.count.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 mb-2">PDFs</p>
                <div className="text-lg font-semibold text-red-600">
                  {stats.by_type.pdfs.size_gb.toFixed(1)} GB
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full"
                    style={{ width: `${(stats.by_type.pdfs.size_gb / stats.total_size_gb) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Top Dealers by Storage */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Storage by Dealer</h3>
              <button
                onClick={cleanupOrphanedFiles}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Trash2 size={16} />
                Cleanup Orphaned Files
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dealer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Files</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.by_dealer.map(dealer => (
                  <tr key={dealer.dealer_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{dealer.dealer_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        dealer.tier === 'premium' ? 'bg-purple-100 text-purple-800' :
                        dealer.tier === 'basic' ? 'bg-primary/10 text-primary' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {dealer.tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{dealer.file_count.toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-900">{dealer.size_gb.toFixed(1)} GB</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(dealer.size_gb / stats.total_size_gb) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {((dealer.size_gb / stats.total_size_gb) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Media Browser View */}
      {activeView === 'media' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search files or dealers..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Types</option>
                <option value="image">Images Only</option>
                <option value="video">Videos Only</option>
                <option value="pdf">PDFs Only</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="date">Sort by Date</option>
                <option value="size">Sort by Size</option>
                <option value="usage">Sort by Usage</option>
              </select>

              {selectedMedia.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 size={18} />
                  Delete ({selectedMedia.size})
                </button>
              )}
            </div>
          </div>

          {/* Media Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedMedia.size === filteredMedia.length && filteredMedia.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Preview</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">File</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Owner</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Size</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Usage</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="w-24 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredMedia.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <Image size={64} className="mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-600 text-lg">No media found</p>
                          <p className="text-gray-500 text-sm">Try adjusting your filters</p>
                        </td>
                      </tr>
                    ) : (
                      filteredMedia.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedMedia.has(item.id)}
                              onChange={() => toggleSelectMedia(item.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                              {item.file_type === 'image' ? (
                                <img src={item.thumbnail_url || item.url} alt={item.alt_text || item.filename || 'Media item'} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getFileIcon(item.file_type)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{item.filename}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                {getFileIcon(item.file_type)}
                                <span>{item.file_type.toUpperCase()}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{item.owner_company}</p>
                              <p className="text-sm text-gray-500">{item.owner_name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.file_size_mb.toFixed(2)} MB
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Eye size={14} />
                              <span>{item.views}</span>
                              <span className="text-gray-400">•</span>
                              <span>{item.used_in_listings} listing(s)</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(item.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setShowPreview(item)}
                                className="p-2 text-primary hover:bg-primary/10 rounded"
                                title="Preview"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => window.open(item.url, '_blank')}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                                title="Download"
                              >
                                <Download size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">{showPreview.filename}</h3>
              <button
                onClick={() => setShowPreview(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {showPreview.file_type === 'image' ? (
                <img src={showPreview.url} alt={showPreview.filename} className="w-full h-auto rounded-lg" />
              ) : showPreview.file_type === 'video' ? (
                <video src={showPreview.url} controls className="w-full h-auto rounded-lg" />
              ) : (
                <div className="text-center py-12">
                  <FileText size={64} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">PDF preview not available</p>
                  <a
                    href={showPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    Open PDF
                  </a>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Owner</p>
                  <p className="font-medium">{showPreview.owner_company}</p>
                </div>
                <div>
                  <p className="text-gray-600">Size</p>
                  <p className="font-medium">{showPreview.file_size_mb.toFixed(2)} MB</p>
                </div>
                <div>
                  <p className="text-gray-600">Used in Listings</p>
                  <p className="font-medium">{showPreview.used_in_listings}</p>
                </div>
                <div>
                  <p className="text-gray-600">Views</p>
                  <p className="font-medium">{showPreview.views}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
