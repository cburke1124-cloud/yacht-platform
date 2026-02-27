'use client';

import { useState } from 'react';
import { Play, X } from 'lucide-react';

interface VideoPlayerProps {
  videos: Array<{
    type: 'youtube' | 'vimeo' | 'tour';
    url: string;
    thumbnail?: string;
  }>;
}

export default function VideoPlayer({ videos }: VideoPlayerProps) {
  const [activeVideo, setActiveVideo] = useState<number | null>(null);

  if (!videos || videos.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Video Tour
      </h2>

      <div className="space-y-4">
        {videos.map((video, index) => (
          <div key={index}>
            {activeVideo === index ? (
              <div className="relative">
                <button
                  onClick={() => setActiveVideo(null)}
                  className="absolute top-2 right-2 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
                >
                  <X size={20} />
                </button>
                <div className="aspect-video rounded-lg overflow-hidden">
                  <iframe
                    src={video.url}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={() => setActiveVideo(index)}
                className="relative w-full aspect-video rounded-lg overflow-hidden group"
              >
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br bg-primary flex items-center justify-center">
                    <Play size={64} className="text-light" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                  <div className="bg-white bg-opacity-90 p-4 rounded-full">
                    <Play size={32} className="text-primary" />
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm">
                    {video.type === 'youtube' && 'YouTube Video Tour'}
                    {video.type === 'vimeo' && 'Vimeo Video Tour'}
                    {video.type === 'tour' && '360° Virtual Tour'}
                  </div>
                </div>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}