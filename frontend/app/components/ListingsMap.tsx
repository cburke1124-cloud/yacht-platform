'use client';

import { useEffect, useRef } from 'react';

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

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject();
    if ((window as any).google?.maps) return resolve();
    if (document.getElementById('google-maps-script')) {
      // Script is already loading â€” wait for it
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
  listings: MapListing[];
}

export default function ListingsMap({ listings }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const mapped = listings.filter((l) => l.latitude && l.longitude);

  useEffect(() => {
    if (!mapRef.current || mapped.length === 0) return;

    loadGoogleMapsScript()
      .then(() => {
        const google = (window as any).google;

        // Init map once
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current!, {
            center: { lat: 37.5, lng: -96 },
            zoom: 4,
            scrollwheel: false,
            mapTypeControl: false,
            streetViewControl: false,
            styles: [
              { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b3d1e8' }] },
              { featureType: 'landscape', stylers: [{ color: '#f5f5f5' }] },
            ],
          });
        }

        const map = mapInstanceRef.current!;

        // Clear old markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const bounds = new google.maps.LatLngBounds();
        let openInfo: google.maps.InfoWindow | null = null;

        mapped.forEach((listing) => {
          const position = { lat: listing.latitude, lng: listing.longitude };
          bounds.extend(position);

          const marker = new google.maps.Marker({
            position,
            map,
            title: listing.title,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: listing.featured ? 10 : 7,
              fillColor: listing.featured ? '#f59e0b' : '#01BBDC',
              fillOpacity: 0.9,
              strokeColor: '#FFFFFF',
              strokeWeight: listing.featured ? 2.5 : 1.5,
            },
          });

          const locationLine = [listing.city, listing.state].filter(Boolean).join(', ');
          const descLine = [listing.year, listing.make, listing.model].filter(Boolean).join(' ');

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="min-width:160px;font-family:'Poppins',sans-serif;padding:4px">
                <p style="font-weight:600;color:#10214F;font-size:13px;margin:0 0 4px">${listing.title}</p>
                ${descLine ? `<p style="color:rgba(16,33,79,0.6);font-size:12px;margin:0 0 2px">${descLine}</p>` : ''}
                <p style="color:#01BBDC;font-weight:700;font-size:13px;margin:0 0 4px">${formatPrice(listing.price, listing.currency)}</p>
                ${locationLine ? `<p style="color:rgba(16,33,79,0.5);font-size:11px;margin:0 0 6px">ðŸ“ ${locationLine}</p>` : ''}
                <a href="/listings/${listing.id}" style="display:inline-block;background:#01BBDC;color:#FFF;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;text-decoration:none">View Listing â†’</a>
              </div>
            `,
          });

          marker.addListener('click', () => {
            if (openInfo) openInfo.close();
            infoWindow.open(map, marker);
            openInfo = infoWindow;
          });

          markersRef.current.push(marker);
        });

        if (mapped.length === 1) {
          map.setCenter({ lat: mapped[0].latitude, lng: mapped[0].longitude });
          map.setZoom(8);
        } else {
          map.fitBounds(bounds, 40);
        }
      })
      .catch(() => {});
  }, [mapped]);

  if (mapped.length === 0) return null;

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
    >
      <div ref={mapRef} style={{ height: 420, width: '100%' }} />
    </div>
  );
}
