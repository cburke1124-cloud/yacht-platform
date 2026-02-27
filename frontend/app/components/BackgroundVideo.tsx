'use client';

import { useEffect, useRef } from 'react';

interface BackgroundVideoProps {
  src: string;
  opacity?: number;
  blur?: boolean;
  gradient?: boolean;
}

export default function BackgroundVideo({ 
  src, 
  opacity = 0.5, 
  blur = false,
  gradient = true 
}: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.log("Video autoplay failed:", error);
      });
    }
  }, []);

  return (
    <div className="absolute inset-0 -z-20 overflow-hidden">
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover ${blur ? 'blur-sm' : ''}`}
        style={{ opacity }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Brighter light blue overlay - more vibrant and visible */}
      {gradient && (
        <>
          <div 
            className="absolute inset-0 bg-gradient-to-br from-lightblue/50 via-lightblue/40 to-primary/30"
          />
          {/* Additional brightness layer */}
          <div className="absolute inset-0 bg-lightblue/15" />
        </>
      )}
    </div>
  );
}