'use client';

import { useState } from 'react';
import {
  Upload,
  Youtube,
  Video as VideoIcon,
  Film,
  X,
  Loader,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API_ROOT = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

interface MediaUploadProps {
  onUploadComplete: (media: any[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  acceptImages?: boolean;
  acceptVideos?: boolean;
  acceptDocuments?: boolean;
  showAltText?: boolean;
  showCaption?: boolean;
  folderId?: number | null;
}

export default function MediaUpload({
  onUploadComplete,
  maxFiles = 20,
  maxFileSize = 50,
  acceptImages = true,
  acceptVideos = true,
  acceptDocuments = false,
  showAltText = false,
  showCaption = false,
  folderId = null,
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showVideoEmbed, setShowVideoEmbed] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoType, setVideoType] = useState<'youtube' | 'vimeo' | 'tour'>(
    'youtube'
  );

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    const uploadedMedia: any[] = [];

    try {
      const token = localStorage.getItem('token');

      for (const file of files) {
        if (file.size > maxFileSize * 1024 * 1024) {
          alert(`${file.name} exceeds ${maxFileSize}MB`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        if (folderId) {
          formData.append('folder_id', folderId.toString());
        }

        const response = await fetch(
          `${API_ROOT}/media/upload`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (response.ok) {
          const data = await response.json();
          uploadedMedia.push(data?.media || data);
        }
      }

      if (uploadedMedia.length > 0) {
        onUploadComplete(uploadedMedia);
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleVideoEmbed = async () => {
    if (!videoUrl.trim()) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_ROOT}/media/video-embed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            url: videoUrl,
            type: videoType,
            folder_id: folderId,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        onUploadComplete([data]);
        setVideoUrl('');
        setShowVideoEmbed(false);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to add video');
      }
    } catch (err) {
      console.error(err);
      alert('Video embed failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File upload */}
      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <input
          type="file"
          id="media-upload"
          className="hidden"
          multiple
          accept={[
            acceptImages ? 'image/*' : '',
            acceptVideos ? 'video/*' : '',
            acceptDocuments ? 'application/pdf' : '',
          ]
            .filter(Boolean)
            .join(',')}
          onChange={handleFileUpload}
          disabled={uploading}
        />

        <label
          htmlFor="media-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          {uploading ? (
            <>
              <Loader className="animate-spin mb-4" size={48} />
              <p>Uploading…</p>
            </>
          ) : (
            <>
              <Upload size={48} className="mb-4" />
              <p className="font-medium">
                Click to upload or drag & drop
              </p>
              <p className="text-sm text-gray-500">
                Max {maxFileSize}MB per file
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {acceptDocuments ? 'Supports photos, videos, and PDF files' : 'Supports photos and videos'}
              </p>
            </>
          )}
        </label>
      </div>

      {/* Video embed */}
      {acceptVideos && (
        <>
          {!showVideoEmbed ? (
            <button
              onClick={() => setShowVideoEmbed(true)}
              className="w-full p-3 border rounded-lg flex justify-center gap-2"
            >
              <Youtube size={20} />
              Add YouTube / Vimeo
            </button>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex justify-between mb-3">
                <h3 className="font-semibold">Add Video</h3>
                <button onClick={() => setShowVideoEmbed(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <button onClick={() => setVideoType('youtube')}>
                  <Youtube />
                </button>
                <button onClick={() => setVideoType('vimeo')}>
                  <VideoIcon />
                </button>
                <button onClick={() => setVideoType('tour')}>
                  <Film />
                </button>
              </div>

              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Video URL"
                className="w-full border rounded px-3 py-2 mb-3"
              />

              <button
                onClick={handleVideoEmbed}
                disabled={uploading}
                className="w-full bg-blue-600 text-white rounded py-2"
              >
                Add Video
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
