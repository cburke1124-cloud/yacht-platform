'use client';

import { useState, useEffect, useRef } from 'react';
import { apiUrl, mediaUrl } from '@/app/lib/apiRoot';
import {
  X, Search, Folder, FolderOpen, FolderPlus, Film, FileText,
  Image, Filter, Check, Upload, RefreshCw
} from 'lucide-react';

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
}

interface MediaFolderItem {
  id: number;
  name: string;
  file_count: number;
}

interface MediaLibraryPickerProps {
  /** Called when the user confirms their selection */
  onSelect: (files: MediaFileItem[]) => void;
  onClose: () => void;
  /** Allow selecting more than one file (default true) */
  multiple?: boolean;
  /** Accept filter: 'all' | 'image' | 'video' | 'pdf' */
  accept?: 'all' | 'image' | 'video' | 'pdf';
}

export default function MediaLibraryPicker({
  onSelect,
  onClose,
  multiple = true,
  accept = 'all',
}: MediaLibraryPickerProps) {
  const [files, setFiles] = useState<MediaFileItem[]>([]);
  const [folders, setFolders] = useState<MediaFolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'pdf'>(accept === 'all' ? 'all' : accept);
  const [search, setSearch] = useState('');
  const [currentFolder, setCurrentFolder] = useState<number | 'all'>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('file_type', filter);
      if (currentFolder !== 'all') params.set('folder_id', String(currentFolder));
      params.set('limit', '200');

      const [filesRes, foldersRes] = await Promise.all([
        fetch(apiUrl(`/media/my-media?${params}`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/media/folders'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.media || []);
      }
      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.folders || []);
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter, currentFolder]);

  const handleUpload = async (fileList: FileList | File[]) => {
    const token = localStorage.getItem('token');
    if (!token || !fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const arr = Array.from(fileList);
      if (arr.length === 1) {
        const fd = new FormData();
        fd.append('file', arr[0]);
        if (currentFolder !== 'all') fd.append('folder_id', String(currentFolder));
        await fetch(apiUrl('/media/upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      } else {
        const fd = new FormData();
        arr.forEach(f => fd.append('files', f));
        if (currentFolder !== 'all') fd.append('folder_id', String(currentFolder));
        await fetch(apiUrl('/media/bulk-upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      }
      await fetchData();
    } catch { /* non-fatal */ } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(apiUrl(`/media/folders?name=${encodeURIComponent(name)}`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const folder = await res.json();
      setFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const toggleSelect = (id: number) => {
    if (!multiple) {
      setSelected(new Set([id]));
      return;
    }
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const filteredFiles = files.filter(f => {
    if (search && !f.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleConfirm = () => {
    const picked = files.filter(f => selected.has(f.id));
    onSelect(picked);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 1000, height: '85vh', maxHeight: 700 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#10214F' }}>
              Choose from Media Library
            </h2>
            {selected.size > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {selected.size} file{selected.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-60"
              style={{ background: '#01BBDC' }}
            >
              <Upload size={13} />
              {uploading ? 'Uploading…' : 'Upload New'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={e => { if (e.target.files) handleUpload(e.target.files); e.target.value = ''; }}
            />
            <button
              disabled={selected.size === 0}
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-40 transition"
              style={{ background: '#10214F' }}
            >
              <Check size={13} />
              Use Selected ({selected.size})
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-44 flex-shrink-0 border-r border-gray-100 p-3 space-y-1 overflow-y-auto">
            <button
              onClick={() => setCurrentFolder('all')}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                currentFolder === 'all' ? 'text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
              style={currentFolder === 'all' ? { background: '#10214F' } : {}}
            >
              <FolderOpen size={14} />
              <span className="flex-1 text-left">All Files</span>
            </button>

            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => setCurrentFolder(f.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${
                  currentFolder === f.id ? 'text-white font-medium' : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={currentFolder === f.id ? { background: '#10214F' } : {}}
              >
                <Folder size={14} />
                <span className="flex-1 text-left truncate">{f.name}</span>
                <span className="opacity-60">{f.file_count}</span>
              </button>
            ))}

            {showNewFolder ? (
              <div className="flex gap-1 pt-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
                  }}
                  placeholder="Name"
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#01BBDC]"
                />
                <button onClick={handleCreateFolder} className="px-1.5 py-1 bg-[#01BBDC] text-white rounded text-xs">+</button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition"
              >
                <FolderPlus size={14} />
                New Folder
              </button>
            )}

            <div className="pt-2 border-t mt-2 space-y-0.5">
              {(['all', 'image', 'video', 'pdf'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${
                    filter === type ? 'font-medium' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  style={filter === type ? { color: '#01BBDC' } : {}}
                >
                  {type === 'all' && <Filter size={12} />}
                  {type === 'image' && <Image size={12} />}
                  {type === 'video' && <Film size={12} />}
                  {type === 'pdf' && <FileText size={12} />}
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                </button>
              ))}
            </div>
          </div>

          {/* File grid */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Search */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-50">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search files…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#01BBDC]"
                />
              </div>
            </div>

            {/* Drop zone hint */}
            <div
              className={`mx-4 mt-2 mb-3 border border-dashed rounded-lg py-2 text-center text-xs transition ${
                isDragging ? 'border-[#01BBDC] bg-cyan-50 text-[#01BBDC]' : 'border-gray-200 text-gray-400'
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
              }}
            >
              Drop files here to upload
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading || uploading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={22} className="animate-spin text-gray-400" />
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-12">
                  <Image size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">No files found</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {filteredFiles.map(file => {
                    const isImg = file.file_type === 'image';
                    const isVideo = file.file_type === 'video';
                    const isSelected = selected.has(file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => toggleSelect(file.id)}
                        className={`relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                          isSelected
                            ? 'border-[#01BBDC] ring-2 ring-[#01BBDC]/30'
                            : 'border-transparent hover:border-gray-200'
                        }`}
                      >
                        {isImg ? (
                          <img
                            src={mediaUrl(file.thumbnail_url || file.url)}
                            alt={file.filename}
                            className="w-full h-20 object-cover bg-gray-100"
                          />
                        ) : isVideo ? (
                          <div className="w-full h-20 bg-gray-900 flex flex-col items-center justify-center">
                            <Film size={18} className="text-gray-400" />
                          </div>
                        ) : (
                          <div className="w-full h-20 bg-gray-100 flex flex-col items-center justify-center">
                            <FileText size={18} className="text-gray-400" />
                          </div>
                        )}

                        {/* Selected overlay checkmark */}
                        {isSelected && (
                          <div
                            className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: '#01BBDC' }}
                          >
                            <Check size={11} className="text-white" />
                          </div>
                        )}

                        <div className="px-1.5 py-1 bg-white">
                          <p className="text-[10px] text-gray-500 truncate">{file.filename}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
