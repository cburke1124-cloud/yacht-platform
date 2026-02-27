import { useState, useEffect, useRef } from 'react';
import { Upload, Folder, FolderPlus, Image, Video, Trash2, X, Check, Search, Grid3x3, List, Move, FolderOpen, ChevronRight, MoreVertical, Edit2, Download, Star } from 'lucide-react';

// Type definitions
type MediaItem = {
  id: number;
  filename: string;
  url: string;
  thumbnail_url?: string;
  file_type: 'image' | 'video' | 'pdf';
  file_size_mb: number;
  folder_id: number | null;
  created_at: string;
  alt_text?: string;
  width?: number;
  height?: number;
};

type MediaFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  item_count: number;
  created_at: string;
};

type ViewMode = 'grid' | 'list';
type SelectionMode = 'single' | 'multiple';

interface DealerMediaGalleryProps {
  mode?: 'standalone' | 'picker';
  selectionMode?: SelectionMode;
  onSelectMedia?: (media: MediaItem[]) => void;
  maxSelection?: number;
  filterType?: 'all' | 'image' | 'video';
}

export default function DealerMediaGallery({
  mode = 'standalone',
  selectionMode = 'single',
  onSelectMedia,
  maxSelection,
  filterType = 'all'
}: DealerMediaGalleryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, item: MediaItem} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscription tier limits (from user context)
  const [tierLimits, setTierLimits] = useState({
    images_per_listing: 15,
    videos_per_listing: 1,
    total_storage_gb: 5
  });

  useEffect(() => {
    fetchFolders();
    fetchMedia();
  }, [currentFolder]);

  const fetchFolders = async () => {
    // Mock data - replace with API call
    setFolders([
      { id: 1, name: 'Yacht Exteriors', parent_id: null, item_count: 45, created_at: new Date().toISOString() },
      { id: 2, name: 'Yacht Interiors', parent_id: null, item_count: 38, created_at: new Date().toISOString() },
      { id: 3, name: 'Engine Room', parent_id: null, item_count: 12, created_at: new Date().toISOString() },
      { id: 4, name: 'Deck & Flybridge', parent_id: null, item_count: 28, created_at: new Date().toISOString() },
      { id: 5, name: 'Videos', parent_id: null, item_count: 5, created_at: new Date().toISOString() },
    ]);
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      // Mock data - replace with API call
      const mockMedia: MediaItem[] = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        filename: `yacht-${i + 1}.jpg`,
        url: `https://images.unsplash.com/photo-${1560807707019 + i * 1000}-${Math.random().toString(36).substr(2, 9)}?w=800`,
        thumbnail_url: `https://images.unsplash.com/photo-${1560807707019 + i * 1000}-${Math.random().toString(36).substr(2, 9)}?w=200`,
        file_type: i % 10 === 0 ? 'video' : 'image',
        file_size_mb: parseFloat((Math.random() * 5 + 0.5).toFixed(2)),
        folder_id: currentFolder,
        created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
        alt_text: `Yacht image ${i + 1}`,
        width: 1920,
        height: 1080
      }));
      
      setMedia(mockMedia);
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (files: FileList) => {
    setUploading(true);
    setUploadProgress(0);

    const totalFiles = files.length;
    let uploaded = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        if (currentFolder) {
          formData.append('folder_id', currentFolder.toString());
        }

        // Mock upload - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        uploaded++;
        setUploadProgress((uploaded / totalFiles) * 100);
      }

      alert(`Successfully uploaded ${totalFiles} file(s)!`);
      fetchMedia();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Some files failed to upload');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleBulkUpload(e.dataTransfer.files);
    }
  };

  const toggleSelectMedia = (id: number) => {
    const newSelected = new Set(selectedMedia);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      if (selectionMode === 'single') {
        newSelected.clear();
      }
      if (!maxSelection || newSelected.size < maxSelection) {
        newSelected.add(id);
      }
    }
    setSelectedMedia(newSelected);
  };

  const selectAllInFolder = () => {
    const folderMedia = media.filter(m => 
      (filterType === 'all' || m.file_type === filterType) &&
      m.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (maxSelection && folderMedia.length > maxSelection) {
      alert(`You can only select up to ${maxSelection} items`);
      return;
    }
    
    setSelectedMedia(new Set(folderMedia.map(m => m.id)));
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      // Mock API call
      const newFolder: MediaFolder = {
        id: folders.length + 1,
        name: newFolderName,
        parent_id: currentFolder,
        item_count: 0,
        created_at: new Date().toISOString()
      };
      
      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setShowNewFolderModal(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const moveSelectedToFolder = async (folderId: number | null) => {
    try {
      // Mock API call
      setMedia(media.map(m => 
        selectedMedia.has(m.id) ? { ...m, folder_id: folderId } : m
      ));
      setSelectedMedia(new Set());
      setShowMoveModal(false);
    } catch (error) {
      console.error('Failed to move items:', error);
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selectedMedia.size} item(s)?`)) return;
    
    try {
      setMedia(media.filter(m => !selectedMedia.has(m.id)));
      setSelectedMedia(new Set());
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleConfirmSelection = () => {
    if (onSelectMedia) {
      const selected = media.filter(m => selectedMedia.has(m.id));
      onSelectMedia(selected);
    }
  };

  const getBreadcrumbs = () => {
    const crumbs = [{ id: null, name: 'All Media' }];
    if (currentFolder) {
      const folder = folders.find(f => f.id === currentFolder);
      if (folder) crumbs.push({ id: folder.id, name: folder.name });
    }
    return crumbs;
  };

  const filteredMedia = media.filter(m => {
    const matchesType = filterType === 'all' || m.file_type === filterType;
    const matchesSearch = m.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (m.alt_text && m.alt_text.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const getStorageUsage = () => {
    const totalMB = media.reduce((sum, m) => sum + m.file_size_mb, 0);
    return {
      used: totalMB / 1024, // Convert to GB
      total: tierLimits.total_storage_gb,
      percentage: (totalMB / 1024 / tierLimits.total_storage_gb) * 100
    };
  };

  const storage = getStorageUsage();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Media Gallery</h2>
            <p className="text-sm text-gray-600">
              {storage.used.toFixed(2)} GB / {storage.total} GB used
              <span className="ml-2 text-xs">
                ({storage.percentage.toFixed(1)}%)
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <FolderPlus size={18} />
              New Folder
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-400"
            >
              <Upload size={18} />
              Upload Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Storage Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className={`h-2 rounded-full transition-all ${
              storage.percentage > 90 ? 'bg-red-600' :
              storage.percentage > 75 ? 'bg-yellow-600' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(storage.percentage, 100)}%` }}
          />
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search media..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
            >
              <Grid3x3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Folders */}
        <div className="w-64 bg-white border-r overflow-y-auto">
          <div className="p-4">
            <button
              onClick={() => setCurrentFolder(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                currentFolder === null ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <FolderOpen size={18} />
              <span className="font-medium">All Media</span>
              <span className="ml-auto text-xs text-gray-500">{media.length}</span>
            </button>

            <div className="mt-4 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">Folders</p>
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolder(folder.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    currentFolder === folder.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <Folder size={18} />
                  <span className="flex-1 text-left text-sm">{folder.name}</span>
                  <span className="text-xs text-gray-500">{folder.item_count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumbs & Actions */}
          <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {getBreadcrumbs().map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {idx > 0 && <ChevronRight size={14} className="text-gray-400" />}
                  <button
                    onClick={() => setCurrentFolder(crumb.id)}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </div>

            {selectedMedia.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {selectedMedia.size} selected
                </span>
                <button
                  onClick={selectAllInFolder}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Select All
                </button>
                <button
                  onClick={() => setShowMoveModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                >
                  <Move size={14} />
                  Move
                </button>
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
                {mode === 'picker' && (
                  <button
                    onClick={handleConfirmSelection}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    <Check size={14} />
                    Use Selected ({selectedMedia.size})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Uploading files...
                </span>
                <span className="text-sm text-blue-700">
                  {uploadProgress.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Media Grid/List */}
          <div 
            className="flex-1 overflow-y-auto p-6"
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            {isDragging && (
              <div className="absolute inset-0 bg-blue-50 border-4 border-dashed border-blue-400 flex items-center justify-center z-10">
                <div className="text-center">
                  <Upload size={64} className="text-blue-600 mx-auto mb-4" />
                  <p className="text-xl font-bold text-blue-900">Drop files to upload</p>
                  <p className="text-blue-700">to current folder</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="text-center py-12">
                <Image size={64} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">No media found</p>
                <p className="text-gray-500 text-sm">Upload files or try a different search</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredMedia.map(item => (
                  <div
                    key={item.id}
                    onClick={() => toggleSelectMedia(item.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, item });
                    }}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedMedia.has(item.id)
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-square bg-gray-100">
                      {item.file_type === 'image' ? (
                        <img
                          src={item.thumbnail_url || item.url}
                          alt={item.alt_text || item.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video size={48} className="text-gray-400" />
                        </div>
                      )}
                    </div>

                    {selectedMedia.has(item.id) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check size={16} className="text-white" />
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs truncate">{item.filename}</p>
                      <p className="text-white/80 text-xs">{item.file_size_mb.toFixed(2)} MB</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-12 px-4 py-3"></th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Preview</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Size</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Dimensions</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="w-12 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMedia.map(item => (
                      <tr
                        key={item.id}
                        onClick={() => toggleSelectMedia(item.id)}
                        className={`cursor-pointer transition-colors ${
                          selectedMedia.has(item.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedMedia.has(item.id)}
                            onChange={() => {}}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                            {item.file_type === 'image' ? (
                              <img src={item.thumbnail_url || item.url} alt={item.alt_text || item.filename || 'Media item'} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video size={24} className="text-gray-400" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{item.filename}</p>
                          <p className="text-sm text-gray-500">{item.alt_text}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.file_size_mb.toFixed(2)} MB
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.width && item.height ? `${item.width} × ${item.height}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenu({ x: e.clientX, y: e.clientY, item });
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Move {selectedMedia.size} item(s) to...</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              <button
                onClick={() => moveSelectedToFolder(null)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3"
              >
                <FolderOpen size={18} />
                Root / All Media
              </button>
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => moveSelectedToFolder(folder.id)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                >
                  <Folder size={18} />
                  {folder.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMoveModal(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
