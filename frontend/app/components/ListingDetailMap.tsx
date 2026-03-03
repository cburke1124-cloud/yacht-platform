'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject();
    if ((window as any).google?.maps) return resolve();
    if (document.getElementById('google-maps-script')) {
      const check = setInterval(() => {
        if ((window as any).google?.maps) { clearInterval(check); resolve(); }
      }, 50);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

interface Props {
  latitude?: number;
  longitude?: number;
  locationString?: string;
  title?: string;
}

export default function ListingDetailMap({ latitude, longitude, locationString, title }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [resolvedLat, setResolvedLat] = useState<number | null>(latitude ?? null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(longitude ?? null);
  const [geocodeAttempted, setGeocodeAttempted] = useState(false);
  const mapInitialized = useRef(false);

  // Geocode via Google Geocoding API when no direct coords available
  useEffect(() => {
    if (latitude && longitude) return;
    if (!locationString || geocodeAttempted) return;
    setGeocodeAttempted(true);

    loadGoogleMapsScript()
      .then(() => {
        const google = (window as any).google;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: locationString }, (results: any, status: any) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location;
            setResolvedLat(loc.lat());
            setResolvedLng(loc.lng());
          }
        });
      })
      .catch(() => {});
  }, [latitude, longitude, locationString, geocodeAttempted]);

  // Init / update map when coords are available
  useEffect(() => {
    if (!mapRef.current || !resolvedLat || !resolvedLng) return;

    loadGoogleMapsScript()
      .then(() => {
        const google = (window as any).google;
        const zoom = latitude && longitude ? 12 : 10;
        const center = { lat: resolvedLat, lng: resolvedLng };

        if (!mapInitialized.current) {
          mapInitialized.current = true;
          const map = new google.maps.Map(mapRef.current!, {
            center,
            zoom,
            scrollwheel: false,
            mapTypeControl: false,
            streetViewControl: false,
            styles: [
              { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b3d1e8' }] },
              { featureType: 'landscape', stylers: [{ color: '#f5f5f5' }] },
            ],
          });

          const marker = new google.maps.Marker({
            position: center,
            map,
            title: title ?? locationString,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#01BBDC',
              fillOpacity: 0.9,
              strokeColor: '#FFFFFF',
              strokeWeight: 2.5,
            },
          });

          if (title) {
            const infoWindow = new google.maps.InfoWindow({
              content: `<span style="font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;color:#10214F">${title}</span>`,
            });
            marker.addListener('click', () => infoWindow.open(map, marker));
          }
        }
      })
      .catch(() => {});
  }, [resolvedLat, resolvedLng, latitude, longitude, title, locationString]);

  if (!resolvedLat || !resolvedLng) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex flex-col items-center justify-center">
        <MapPin size={48} className="text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">
          {locationString ? 'Locating…' : 'Location not specified'}
        </p>
      </div>
    );
  }

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
{ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map]);
  return null;
}

interface Props {
  latitude?: number;
  longitude?: number;
  locationString?: string;
  title?: string;
}

export default function ListingDetailMap({ latitude, longitude, locationString, title }: Props) {
  const [resolvedLat, setResolvedLat] = useState<number | null>(latitude ?? null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(longitude ?? null);
  const [geocodeAttempted, setGeocodeAttempted] = useState(false);

  // Geocode via Nominatim when no direct coords available
  useEffect(() => {
    if (latitude && longitude) return; // already have coords
    if (!locationString || geocodeAttempted) return;
    setGeocodeAttempted(true);

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(locationString)}`;
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then((r) => r.json())
      .then((data) => {
        if (data && data[0]) {
          setResolvedLat(parseFloat(data[0].lat));
          setResolvedLng(parseFloat(data[0].lon));
        }
      })
      .catch(() => {});
  }, [latitude, longitude, locationString, geocodeAttempted]);

  if (!resolvedLat || !resolvedLng) {
    // Placeholder while geocoding or if no location at all
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex flex-col items-center justify-center">
        <MapPin size={48} className="text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">
          {locationString ? 'Locating…' : 'Location not specified'}
        </p>
      </div>
    );
  }

  const zoom = latitude && longitude ? 12 : 10;

  return (
    <MapContainer
      center={[resolvedLat, resolvedLng]}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={false}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <SetView lat={resolvedLat} lng={resolvedLng} zoom={zoom} />
      <CircleMarker
        center={[resolvedLat, resolvedLng]}
        radius={10}
        pathOptions={{
          color: '#FFFFFF',
          weight: 2.5,
          fillColor: '#01BBDC',
          fillOpacity: 0.9,
        }}
      >
        {title && (
          <Popup>
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 600, color: '#10214F' }}>
              {title}
            </span>
          </Popup>
        )}
      </CircleMarker>
    </MapContainer>
  );
}
