const FALLBACK_PROD_API_BASE = 'https://yacht-platform.onrender.com';

function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }

  return FALLBACK_PROD_API_BASE;
}

const API_BASE = resolveApiBase().replace(/\/+$/, '');

export const API_ROOT = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ROOT}${normalizedPath}`;
}

export const FALLBACK_IMAGE = '/images/listing-fallback.png';

/**
 * Resolve a media/image URL returned by the backend.
 * Full URLs (http/https) pass through unchanged.
 * Relative paths like /uploads/... get the backend base prepended.
 * Known broken placeholders (e.g. "/placeholder.jpg") return the fallback.
 */
export function mediaUrl(url: string | undefined | null): string {
  if (!url || url === '/placeholder.jpg') return FALLBACK_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Strip trailing /api from API_ROOT to get the bare backend origin
  const base = API_ROOT.replace(/\/api$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * onError handler for <img> tags that gracefully falls back.
 * Usage: <img src={mediaUrl(url)} onError={onImgError} />
 */
export function onImgError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.src !== window.location.origin + FALLBACK_IMAGE) {
    img.src = FALLBACK_IMAGE;
  }
}
