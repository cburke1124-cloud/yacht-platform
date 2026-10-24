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

/**
 * The real session credential is an httpOnly cookie the browser manages
 * automatically — this localStorage flag is NOT a secret and can't be used
 * to authenticate on its own. It exists purely so existing UI code that
 * checks `localStorage.getItem('token')` for "is the user logged in?"
 * keeps working without being rewritten everywhere.
 */
export function markLoggedIn(): void {
  localStorage.setItem('token', '1');
}

/**
 * Only used when the browser refuses the session cookie (the API lives on a
 * different site than the pages, so Safari, Brave, strict-Firefox and
 * incognito treat it as a blocked third-party cookie). In that case AuthGuard
 * keeps the login token here — per-tab, cleared on logout — and sends it as a
 * Bearer header so those users aren't bounced back to /login. It is never set
 * for browsers where the cookie works.
 */
export const COOKIE_FALLBACK_KEY = 'yv_session_fallback';

export function markLoggedOut(): void {
  try { sessionStorage.removeItem(COOKIE_FALLBACK_KEY); } catch { /* storage unavailable */ }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
