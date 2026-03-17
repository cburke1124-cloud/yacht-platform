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

/**
 * Resolve a media/image URL returned by the backend.
 * Full URLs (http/https) pass through unchanged.
 * Relative paths like /uploads/... get the backend base prepended.
 */
export function mediaUrl(url: string | undefined | null): string {
  if (!url) return '/images/listing-fallback.png';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Strip trailing /api from API_ROOT to get the bare backend origin
  const base = API_ROOT.replace(/\/api$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
