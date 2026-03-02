'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

// Centers + zooms to the given coords whenever they change
function SetView({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
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
