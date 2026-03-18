'use client';

import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

interface ListingLocationMapProps {
  city: string;
  state: string;
  country?: string;
}

// TypeScript declarations for Google Maps
declare global {
  interface Window {
    google: {
      maps: {
        Map: new (element: HTMLElement, options: any) => any;
        Marker: new (options: any) => any;
        Geocoder: new () => {
          geocode: (
            request: { address: string },
            callback: (results: any[], status: string) => void
          ) => void;
        };
      };
    };
  }
}

export default function ListingLocationMap({ city, state, country = 'USA' }: ListingLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Google Maps script
    if (!window.google) {
      const script = document.createElement('script');
      // Replace YOUR_API_KEY with your actual Google Maps API key
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY`;
      script.async = true;
      script.defer = true;
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }
  }, [city, state, country]);

  const initMap = async () => {
    if (!mapRef.current || !window.google) return;

    // Geocode the address
    const geocoder = new window.google.maps.Geocoder();
    const address = `${city}, ${state}, ${country}`;

    geocoder.geocode({ address }, (results: any[], status: string) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;

        // Create map
        const map = new window.google.maps.Map(mapRef.current!, {
          center: location,
          zoom: 12,
          styles: [
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#193341' }]
            },
            {
              featureType: 'landscape',
              elementType: 'geometry',
              stylers: [{ color: '#f5f5f5' }]
            }
          ]
        });

        // Add marker
        new window.google.maps.Marker({
          position: location,
          map: map,
          title: `${city}, ${state}`
        });
      }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <MapPin size={20} className="text-blue-600" />
          Location
        </h3>
      </div>
      
      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="w-full h-64 bg-gray-200"
        style={{ minHeight: '256px' }}
      >
        {/* Fallback if Google Maps doesn't load */}
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <MapPin size={48} className="text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">{city}, {state}</p>
            <p className="text-gray-500 text-sm">{country}</p>
          </div>
        </div>
      </div>

      {/* Location Details */}
      <div className="p-4 bg-gray-50">
        <div className="flex items-start gap-2 text-gray-700">
          <MapPin size={16} className="mt-0.5 text-blue-600" />
          <div>
            <p className="font-medium">{city}, {state}</p>
            <p className="text-sm text-gray-600">{country}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city}, ${state}, ${country}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline mt-2 inline-block"
            >
              Open in Google Maps ΓåÆ
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
