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
