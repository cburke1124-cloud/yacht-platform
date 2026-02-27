'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, Video, FileText, Folder, Trash2, Search, Image } from 'lucide-react';

// Type definitions
type MediaFile = {
  id: number;
  filename: string;
  url: string;
  file_type: 'image' | 'video' | 'pdf';
  file_size_mb: number;
  created_at: string;
};

type FilterType = 'all' | 'image' | 'video' | 'pdf';

export default function MediaGallery() {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [storageUsed, setStorageUsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMedia();
  }, [filter]);

  const fetchMedia = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('file_type', filter);
      
      // Demo data
      const data = {
        media: [
          {
            id: 1,
            filename: 'yacht1.jpg',
            url: '/uploads/yacht1.jpg',
            file_type: 'image' as const,
            file_size_mb: 2.4,
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            filename: 'brochure.pdf',
            url: '/uploads/brochure.pdf',
            file_type: 'pdf' as const,
            file_size_mb: 1.2,
            created_at: new Date().toISOString()
          }
        ],
        total_storage_mb: 3.6
      };
      
      setMedia(data.media);
      setStorageUsed(data.total_storage_mb);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch media:', error);
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
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      fetchMedia();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const deleteMedia = async (mediaId: number) => {
    if (!confirm('Delete this file?')) return;
    setMedia(media.filter(m => m.id !== mediaId));
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
      case 'image': return <Image size={40} className="text-blue-500" />;
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

  return (
    <div className="max-w-7xl mx-auto p-6">
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
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
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
            <Upload size={48} className="mx-auto mb-4 text-blue-600 animate-pulse" />
            <p className="text-lg font-medium text-gray-900">Uploading files...</p>
          </div>
        ) : (
          <div className="py-4">
            <Upload size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">Drag & drop files here</p>
            <p className="text-sm text-gray-600 mb-4">Or click to browse (images, videos, PDFs up to 100MB)</p>
            <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                filter === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {selectedFiles.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="font-medium text-blue-900">{selectedFiles.size} file(s) selected</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedFiles(new Set())} className="px-4 py-2 text-gray-700 hover:bg-white rounded-lg">
              Clear Selection
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedFiles.size} files?`)) {
                  selectedFiles.forEach(id => deleteMedia(id));
                  setSelectedFiles(new Set());
                }
              }}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
                selectedFiles.has(file.id) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {file.file_type === 'image' ? (
                  <img src={file.url} alt={file.filename} className="w-full h-full object-cover" />
                ) : (
                  getFileIcon(file.file_type)
                )}
              </div>

              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMedia(file.id); }}
                  className="opacity-0 group-hover:opacity-100 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>

              {selectedFiles.has(file.id) && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
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
    </div>
  );
}