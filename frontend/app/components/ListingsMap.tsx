'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapListing {
  id: number | string;
  title: string;
  price?: number;
  currency?: string;
  make?: string;
  model?: string;
  year?: number;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  featured?: boolean;
}

function formatPrice(price?: number, currency = 'USD'): string {
  if (!price) return 'Price on Request';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

// Re-centers the map whenever listings change
function AutoBounds({ listings }: { listings: MapListing[] }) {
  const map = useMap();
  useEffect(() => {
    if (listings.length === 0) return;
    if (listings.length === 1) {
      map.setView([listings[0].latitude, listings[0].longitude], 8);
      return;
    }
    const lats = listings.map((l) => l.latitude);
    const lngs = listings.map((l) => l.longitude);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40] }
    );
  }, [listings, map]);
  return null;
}

interface Props {
  listings: MapListing[];
}

export default function ListingsMap({ listings }: Props) {
  const mapped = listings.filter((l) => l.latitude && l.longitude);
  if (mapped.length === 0) return null;

  // Default center: mid-US fallback, immediately overridden by AutoBounds
  const defaultCenter: [number, number] = [37.5, -96];

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={4}
        style={{ height: 420, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoBounds listings={mapped} />

        {mapped.map((listing) => (
          <CircleMarker
            key={listing.id}
            center={[listing.latitude, listing.longitude]}
            radius={listing.featured ? 10 : 7}
            pathOptions={{
              color: listing.featured ? '#FFFFFF' : '#FFFFFF',
              weight: listing.featured ? 2.5 : 1.5,
              fillColor: listing.featured ? '#f59e0b' : '#01BBDC',
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div style={{ minWidth: 160, fontFamily: 'Poppins, sans-serif' }}>
                <p style={{ fontWeight: 600, color: '#10214F', marginBottom: 2, fontSize: 13, lineHeight: '1.3' }}>
                  {listing.title}
                </p>
                {(listing.year || listing.make) && (
                  <p style={{ color: 'rgba(16,33,79,0.6)', fontSize: 12, marginBottom: 2 }}>
                    {[listing.year, listing.make, listing.model].filter(Boolean).join(' ')}
                  </p>
                )}
                <p style={{ color: '#01BBDC', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  {formatPrice(listing.price, listing.currency)}
                </p>
                {(listing.city || listing.state) && (
                  <p style={{ color: 'rgba(16,33,79,0.5)', fontSize: 11 }}>
                    📍 {[listing.city, listing.state].filter(Boolean).join(', ')}
                  </p>
                )}
                <a
                  href={`/listings/${listing.id}`}
                  style={{
                    display: 'inline-block', marginTop: 8,
                    backgroundColor: '#01BBDC', color: '#FFF',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  View Listing →
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
