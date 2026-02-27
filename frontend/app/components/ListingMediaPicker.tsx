import { useState, useEffect } from 'react';
import { Upload, Image, Video, Folder, Check, X, Star, Trash2, Search, Grid3x3, AlertCircle, ChevronRight, FolderOpen } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

// Type definitions
type MediaItem = {
  id: number;
  filename: string;
  url: string;
  thumbnail_url?: string;
  file_type: 'image' | 'video';
  file_size_mb: number;
  folder_id: number | null;
  alt_text?: string;
  width?: number;
  height?: number;
};

type MediaFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  item_count: number;
};

type AttachedMedia = MediaItem & {
  is_primary?: boolean;
  order?: number;
};

interface ListingMediaPickerProps {
  onMediaSelected: (media: AttachedMedia[]) => void;
  initialMedia?: AttachedMedia[];
  maxImages?: number;
  maxVideos?: number;
}

export default function ListingMediaPicker({
  onMediaSelected,
  initialMedia = [],
  maxImages = 15,
  maxVideos = 1
}: ListingMediaPickerProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('library');
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>(initialMedia);
  const [libraryMedia, setLibraryMedia] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [selectedFromLibrary, setSelectedFromLibrary] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');

  useEffect(() => {
    fetchFolders();
    fetchLibraryMedia();
  }, [currentFolder]);

  useEffect(() => {
    // Notify parent of changes
    onMediaSelected(attachedMedia);
  }, [attachedMedia]);

  const fetchFolders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/media/folders'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      // Mock data fallback
      setFolders([
        { id: 1, name: 'Yacht Exteriors', parent_id: null, item_count: 45 },
        { id: 2, name: 'Yacht Interiors', parent_id: null, item_count: 38 },
        { id: 3, name: 'Engine Room', parent_id: null, item_count: 12 },
        { id: 4, name: 'Deck Views', parent_id: null, item_count: 28 },
      ]);
    }
  };

  const fetchLibraryMedia = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (currentFolder) params.append('folder_id', currentFolder.toString());
      
      const response = await fetch(apiUrl(`/my-media?${params}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLibraryMedia(data.media || []);
      }
    } catch (error) {
      console.error('Failed to fetch media:', error);
      // Mock data fallback
      const mockMedia: MediaItem[] = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        filename: `yacht-${i + 1}.jpg`,
        url: `https://images.unsplash.com/photo-${1560807707019 + i * 1000}?w=800`,
        thumbnail_url: `https://images.unsplash.com/photo-${1560807707019 + i * 1000}?w=200`,
        file_type: i % 8 === 0 ? 'video' : 'image',
        file_size_mb: parseFloat((Math.random() * 5 + 0.5).toFixed(2)),
        folder_id: currentFolder,
        width: 1920,
        height: 1080
      }));
      setLibraryMedia(mockMedia);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    setUploadProgress(0);

    const newMedia: AttachedMedia[] = [];
    const totalFiles = files.length;
    let uploaded = 0;

    try {
      const token = localStorage.getItem('token');
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(apiUrl('/upload'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          newMedia.push({
            id: Date.now() + i,
            filename: file.name,
            url: data.url,
            thumbnail_url: data.thumbnail_url,
            file_type: file.type.startsWith('video/') ? 'video' : 'image',
            file_size_mb: file.size / (1024 * 1024),
            folder_id: currentFolder,
            order: attachedMedia.length + i,
            is_primary: attachedMedia.length === 0 && i === 0
          });
        }

        uploaded++;
        setUploadProgress((uploaded / totalFiles) * 100);
      }

      setAttachedMedia([...attachedMedia, ...newMedia]);
      setActiveTab('library');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Some files failed to upload');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const addFromLibrary = () => {
    const selected = libraryMedia.filter(m => selectedFromLibrary.has(m.id));
    const newAttached = selected.map((m, idx) => ({
      ...m,
      order: attachedMedia.length + idx,
      is_primary: attachedMedia.length === 0 && idx === 0
    }));
    
    setAttachedMedia([...attachedMedia, ...newAttached]);
    setSelectedFromLibrary(new Set());
  };

  const addEntireFolder = () => {
    const folderMedia = libraryMedia.filter(m => 
      filterType === 'all' ? true : m.file_type === filterType
    );
    
    const imageCount = attachedMedia.filter(m => m.file_type === 'image').length;
    const videoCount = attachedMedia.filter(m => m.file_type === 'video').length;
    const folderImages = folderMedia.filter(m => m.file_type === 'image');
    const folderVideos = folderMedia.filter(m => m.file_type === 'video');
    
    // Check limits
    if (imageCount + folderImages.length > maxImages) {
      alert(`This would exceed your image limit of ${maxImages}. Currently using ${imageCount}.`);
      return;
    }
    if (videoCount + folderVideos.length > maxVideos) {
      alert(`This would exceed your video limit of ${maxVideos}. Currently using ${videoCount}.`);
      return;
    }

    const newAttached = folderMedia.map((m, idx) => ({
      ...m,
      order: attachedMedia.length + idx,
      is_primary: attachedMedia.length === 0 && idx === 0
    }));
    
    setAttachedMedia([...attachedMedia, ...newAttached]);
  };

  const removeAttached = (id: number) => {
    const updated = attachedMedia.filter(m => m.id !== id);
    // If removing primary, make first item primary
    if (updated.length > 0 && !updated.some(m => m.is_primary)) {
      updated[0].is_primary = true;
    }
    // Re-order
    updated.forEach((m, idx) => { m.order = idx; });
    setAttachedMedia(updated);
  };

  const setPrimary = (id: number) => {
    const updated = attachedMedia.map(m => ({
      ...m,
      is_primary: m.id === id
    }));
    setAttachedMedia(updated);
  };

  const reorderMedia = (fromIndex: number, toIndex: number) => {
    const updated = [...attachedMedia];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    updated.forEach((m, idx) => { m.order = idx; });
    setAttachedMedia(updated);
  };

  const toggleLibrarySelection = (id: number) => {
    const item = libraryMedia.find(m => m.id === id);
    if (!item) return;

    const newSelected = new Set(selectedFromLibrary);
    const currentImages = attachedMedia.filter(m => m.file_type === 'image').length + 
                          Array.from(selectedFromLibrary).filter(id => {
                            const m = libraryMedia.find(m => m.id === id);
                            return m?.file_type === 'image';
                          }).length;
    const currentVideos = attachedMedia.filter(m => m.file_type === 'video').length + 
                          Array.from(selectedFromLibrary).filter(id => {
                            const m = libraryMedia.find(m => m.id === id);
                            return m?.file_type === 'video';
                          }).length;

    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      // Check limits
      if (item.file_type === 'image' && currentImages >= maxImages) {
        alert(`Image limit reached (${maxImages})`);
        return;
      }
      if (item.file_type === 'video' && currentVideos >= maxVideos) {
        alert(`Video limit reached (${maxVideos})`);
        return;
      }
      newSelected.add(id);
    }
    setSelectedFromLibrary(newSelected);
  };

  const filteredLibraryMedia = libraryMedia.filter(m => {
    const matchesType = filterType === 'all' || m.file_type === filterType;
    const matchesSearch = m.filename.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const imageCount = attachedMedia.filter(m => m.file_type === 'image').length;
  const videoCount = attachedMedia.filter(m => m.file_type === 'video').length;

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold">Media for Listing</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className={imageCount >= maxImages ? 'text-yellow-300 font-semibold' : ''}>
              📷 {imageCount} / {maxImages} images
            </span>
            <span className={videoCount >= maxVideos ? 'text-yellow-300 font-semibold' : ''}>
              🎥 {videoCount} / {maxVideos} videos
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'library'
                ? 'bg-white text-blue-600'
                : 'bg-blue-500 hover:bg-blue-400 text-white'
            }`}
          >
            📚 Media Library
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'upload'
                ? 'bg-white text-blue-600'
                : 'bg-blue-500 hover:bg-blue-400 text-white'
            }`}
          >
            ⬆️ Upload New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-gray-300">
        {/* Left Panel - Source */}
        <div className="col-span-2 h-96 overflow-y-auto">
          {activeTab === 'upload' ? (
            <div className="p-6">
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Images (JPG, PNG, WebP) and Videos (MP4, MOV)
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Choose Files
                </label>
              </div>

              {uploading && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Uploading...</span>
                    <span className="text-sm text-gray-600">{uploadProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full">
              {/* Folder Sidebar */}
              <div className="w-48 bg-gray-50 border-r overflow-y-auto p-2">
                <button
                  onClick={() => setCurrentFolder(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentFolder === null ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
                  }`}
                >
                  <FolderOpen size={16} />
                  <span>All Media</span>
                </button>
                <div className="mt-2 space-y-1">
                  {folders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => setCurrentFolder(folder.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        currentFolder === folder.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
                      }`}
                    >
                      <Folder size={16} />
                      <span className="flex-1 text-left truncate">{folder.name}</span>
                      <span className="text-xs text-gray-500">{folder.item_count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Media Grid */}
              <div className="flex-1 p-4">
                {/* Search & Actions */}
                <div className="mb-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search media..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFilterType('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFilterType('image')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          filterType === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                        }`}
                      >
                        Images
                      </button>
                      <button
                        onClick={() => setFilterType('video')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          filterType === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                        }`}
                      >
                        Videos
                      </button>
                    </div>

                    {currentFolder && (
                      <button
                        onClick={addEntireFolder}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                      >
                        + Add Entire Folder
                      </button>
                    )}
                  </div>

                  {selectedFromLibrary.size > 0 && (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <span className="text-sm font-medium text-blue-900">
                        {selectedFromLibrary.size} selected
                      </span>
                      <button
                        onClick={addFromLibrary}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                      >
                        Add Selected
                      </button>
                    </div>
                  )}
                </div>

                {/* Media Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {filteredLibraryMedia.map(item => (
                    <button
                      key={item.id}
                      onClick={() => toggleLibrarySelection(item.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedFromLibrary.has(item.id)
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {item.file_type === 'image' ? (
                        <img
                          src={item.thumbnail_url || item.url}
                          alt={item.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <Video size={24} className="text-white" />
                        </div>
                      )}

                      {selectedFromLibrary.has(item.id) && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {filteredLibraryMedia.length === 0 && (
                  <div className="text-center py-8">
                    <Image size={48} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">No media found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Attached Media */}
        <div className="bg-gray-50 p-4 h-96 overflow-y-auto">
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-gray-900 mb-1">
              Attached Media ({attachedMedia.length})
            </h4>
            <p className="text-xs text-gray-600">
              Drag to reorder • Click ⭐ to set primary
            </p>
          </div>

          {attachedMedia.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No media attached yet</p>
              <p className="text-xs text-gray-400 mt-1">Add from library or upload</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attachedMedia
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                      reorderMedia(fromIndex, index);
                    }}
                    className={`flex items-center gap-2 p-2 bg-white rounded-lg border transition-all cursor-move ${
                      item.is_primary ? 'border-yellow-400 ring-2 ring-yellow-200' : 'border-gray-200'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                      {item.file_type === 'image' ? (
                        <img
                          src={item.thumbnail_url || item.url}
                          alt={item.alt_text || item.caption || item.filename || 'Listing media'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                          <Video size={16} className="text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {item.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.file_size_mb.toFixed(1)} MB
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPrimary(item.id)}
                        className={`p-1 rounded transition-colors ${
                          item.is_primary
                            ? 'text-yellow-600'
                            : 'text-gray-400 hover:text-yellow-600'
                        }`}
                        title="Set as primary"
                      >
                        <Star size={16} fill={item.is_primary ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => removeAttached(item.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
