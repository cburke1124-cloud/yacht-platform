'use client';

import { useState } from 'react';
import { Youtube, Video, Camera } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface VideoUploadFormProps {
  listingId: number;
  onVideoAdded: () => void;
}

export default function VideoUploadForm({ listingId, onVideoAdded }: VideoUploadFormProps) {
  const [videoType, setVideoType] = useState<'youtube' | 'vimeo' | 'tour'>('youtube');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoUrl.trim()) {
      alert('Please enter a video URL');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${listingId}/videos`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: videoType,
          url: videoUrl
        })
      });

      if (response.ok) {
        alert('Video added successfully!');
        setVideoUrl('');
        onVideoAdded();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to add video');
      }
    } catch (error) {
      console.error('Failed to add video:', error);
      alert('Failed to add video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Add Video</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video Platform
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setVideoType('youtube')}
              className={`p-4 border-2 rounded-lg transition-all ${
                videoType === 'youtube'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Youtube size={32} className={videoType === 'youtube' ? 'text-red-600' : 'text-gray-400'} />
              <p className="text-sm font-medium mt-2">YouTube</p>
            </button>

            <button
              type="button"
              onClick={() => setVideoType('vimeo')}
              className={`p-4 border-2 rounded-lg transition-all ${
                videoType === 'vimeo'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Video size={32} className={videoType === 'vimeo' ? 'text-blue-600' : 'text-gray-400'} />
              <p className="text-sm font-medium mt-2">Vimeo</p>
            </button>

            <button
              type="button"
              onClick={() => setVideoType('tour')}
              className={`p-4 border-2 rounded-lg transition-all ${
                videoType === 'tour'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Camera size={32} className={videoType === 'tour' ? 'text-purple-600' : 'text-gray-400'} />
              <p className="text-sm font-medium mt-2">360° Tour</p>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video URL
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder={
              videoType === 'youtube' ? 'https://www.youtube.com/watch?v=...' :
              videoType === 'vimeo' ? 'https://vimeo.com/...' :
              'https://...'
            }
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {videoType === 'youtube' && 'Paste the full YouTube video URL'}
            {videoType === 'vimeo' && 'Paste the full Vimeo video URL'}
            {videoType === 'tour' && 'Paste the virtual tour embed URL'}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
        >
          {loading ? 'Adding...' : 'Add Video'}
        </button>
      </form>
    </div>
  );
}