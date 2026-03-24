'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, Video, FileText, Folder, Trash2, Search, Image, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

// Type definitions
type MediaFile = {
  id: number;
  filename: string;
  url: string;
  thumbnail_url?: string;
  file_type: 'image' | 'video' | 'pdf';
  file_size_mb: number;
  width?: number;
  height?: number;
  created_at: string;
};

type FilterType = 'all' | 'image' | 'video' | 'pdf';

export default function MediaGallery() {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [storageUsed, setStorageUsed] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [lightboxFile, setLightboxFile] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMedia();
  }, [filter]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLightboxFile(null); return; }
      if (!lightboxFile) return;
      const imgs = media.filter(m => m.file_type === 'image');
      const idx = imgs.findIndex(m => m.id === lightboxFile.id);
      if (e.key === 'ArrowLeft' && idx > 0) setLightboxFile(imgs[idx - 1]);
      if (e.key === 'ArrowRight' && idx < imgs.length - 1) setLightboxFile(imgs[idx + 1]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxFile, media]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('file_type', filter);
      const qs = params.toString();

      const [mediaRes, statsRes] = await Promise.all([
        fetch(apiUrl(`/media/my-media${qs ? '?' + qs : ''}`), { headers: getAuthHeaders() }),
        fetch(apiUrl('/media/stats'), { headers: getAuthHeaders() }),
      ]);

      if (mediaRes.ok) {
        const data = await mediaRes.json();
        setMedia(data.media || []);
        setTotalFiles(data.total || 0);
      } else {
        setMedia([]);
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setStorageUsed(stats.total_storage_mb || 0);
      }
    } catch (error) {
      console.error('Failed to fetch media:', error);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    await uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);

    try {
      if (files.length === 1) {
        setUploadProgress(`Uploading ${files[0].name}...`);
        const formData = new FormData();
        formData.append('file', files[0]);

        const res = await fetch(apiUrl('/media/upload'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Upload failed');
        }
      } else {
        setUploadProgress(`Uploading ${files.length} files...`);
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        const res = await fetch(apiUrl('/media/bulk-upload'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Bulk upload failed');
        }
      }

      await fetchMedia();
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const deleteMedia = async (mediaId: number) => {
    if (!confirm('Delete this file?')) return;

    try {
      const res = await fetch(apiUrl(`/media/${mediaId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        setMedia(prev => prev.filter(m => m.id !== mediaId));
        setSelectedFiles(prev => {
          const next = new Set(prev);
          next.delete(mediaId);
          return next;
        });
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file');
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedFiles.size} file(s)?`)) return;
    const ids = Array.from(selectedFiles);
    for (const id of ids) {
      try {
        await fetch(apiUrl(`/media/${id}`), {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
      } catch {}
    }
    setSelectedFiles(new Set());
    await fetchMedia();
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFiles(newSelected);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={40} className="text-[#01BBDC]" />;
      case 'video': return <Video size={40} className="text-purple-500" />;
      case 'pdf': return <FileText size={40} className="text-red-500" />;
      default: return <FileText size={40} className="text-gray-500" />;
    }
  };

  const filteredMedia = media.filter(m => {
    if (searchTerm && !m.filename.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const imageFiles = filteredMedia.filter(m => m.file_type === 'image');
  const lightboxIndex = lightboxFile ? imageFiles.findIndex(m => m.id === lightboxFile.id) : -1;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Media Gallery</h1>
        <p className="text-gray-600">
          Storage used: <span className="font-semibold">{storageUsed.toFixed(1)} MB</span>
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center transition-colors ${
          isDragging ? 'border-[#01BBDC] bg-[#01BBDC]/10' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {uploading ? (
          <div className="py-8">
            <Upload size={48} className="mx-auto mb-4 text-[#01BBDC] animate-pulse" />
            <p className="text-lg font-medium text-gray-900">{uploadProgress || 'Uploading files...'}</p>
          </div>
        ) : (
          <div className="py-4">
            <Upload size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">Drag & drop files here</p>
            <p className="text-sm text-gray-600 mb-4">Or click to browse (images, videos, PDFs up to 100MB)</p>
            <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-[#01BBDC] text-white rounded-lg hover:bg-[#00a5c4]">
              Browse Files
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4 mb-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          {(['all', 'image', 'video', 'pdf'] as FilterType[]).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-left ${
                filter === type ? 'bg-[#01BBDC] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01BBDC] focus:border-transparent"
          />
        </div>
      </div>

      {selectedFiles.size > 0 && (
        <div className="mb-4 p-4 bg-[#01BBDC]/10 border border-[#01BBDC]/30 rounded-lg flex items-center justify-between">
          <span className="font-medium text-[#10214F]">{selectedFiles.size} file(s) selected</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedFiles(new Set())} className="px-4 py-2 text-gray-700 hover:bg-white rounded-lg">
              Clear Selection
            </button>
            <button
              onClick={bulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#01BBDC] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading media...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="text-center py-12">
          <Folder size={64} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No files found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredMedia.map(file => (
            <div
              key={file.id}
              onClick={() => toggleSelect(file.id)}
              className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                selectedFiles.has(file.id) ? 'border-[#01BBDC] ring-2 ring-[#01BBDC]/30' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {file.file_type === 'image' ? (
                  <img src={mediaUrl(file.thumbnail_url || file.url)} alt={file.filename} className="w-full h-full object-cover" onError={onImgError} />
                ) : file.file_type === 'video' && file.thumbnail_url ? (
                  <img src={mediaUrl(file.thumbnail_url)} alt={file.filename} className="w-full h-full object-cover" onError={onImgError} />
                ) : (
                  getFileIcon(file.file_type)
                )}
              </div>

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                {file.file_type === 'image' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxFile(file); }}
                    className="opacity-0 group-hover:opacity-100 p-2 bg-white/80 text-gray-800 rounded-full hover:bg-white transition-opacity"
                  >
                    <ZoomIn size={16} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMedia(file.id); }}
                  className="opacity-0 group-hover:opacity-100 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>

              {selectedFiles.has(file.id) && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-[#01BBDC] rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                </div>
              )}

              <div className="p-2 bg-white">
                <p className="text-xs font-medium text-gray-900 truncate">{file.filename}</p>
                <p className="text-xs text-gray-500">{file.file_size_mb.toFixed(1)} MB</p>
              </div>
            </div>
          ))}
        </div>
      )}

    {/* Lightbox */}
    {lightboxFile && (
      <div
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        onClick={() => setLightboxFile(null)}
      >
        {/* Top bar: filename + controls */}
        <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-4 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white/80 text-sm truncate max-w-sm">
            {lightboxFile.filename} &middot; {lightboxFile.file_size_mb.toFixed(1)} MB
            {lightboxIndex >= 0 && ` · ${lightboxIndex + 1} / ${imageFiles.length}`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); deleteMedia(lightboxFile.id); setLightboxFile(null); }}
              className="p-2 bg-red-600/80 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxFile(null); }}
              className="p-2 bg-white/20 text-white rounded-full hover:bg-white/40 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Prev arrow */}
        {lightboxIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxFile(imageFiles[lightboxIndex - 1]); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-white/20 text-white rounded-full hover:bg-white/40 transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* Next arrow */}
        {lightboxIndex < imageFiles.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxFile(imageFiles[lightboxIndex + 1]); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-white/20 text-white rounded-full hover:bg-white/40 transition-colors"
          >
            <ChevronRight size={28} />
          </button>
        )}

        {/* Image */}
        <img
          src={mediaUrl(lightboxFile.url)}
          alt={lightboxFile.filename}
          className="max-w-[90vw] max-h-[85vh] object-contain select-none rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onError={onImgError}
        />
      </div>
    )}
    </>
  );
}