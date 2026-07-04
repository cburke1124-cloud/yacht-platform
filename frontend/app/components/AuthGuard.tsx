"use client"

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { API_ROOT, apiUrl, markLoggedOut } from '@/app/lib/apiRoot';

const TWO_FA_EXEMPT_PATHS = ['/2fa-required', '/login', '/register', '/logout'];

declare global {
  interface Window {
    __yvFetchPatched?: boolean;
  }
}

/**
 * Patches window.fetch for two things:
 *  1. Attaches `credentials: 'include'` on requests to our own API so the
 *     browser sends the httpOnly session cookie (the real auth credential).
 *  2. Intercepts 401 responses: if the user thought they were logged in,
 *     clears auth state and redirects to /login?expired=1 so they see a
 *     clear "session expired" message rather than a broken empty page.
 *
 * Applied at module scope (not inside a React effect) so it's guaranteed to
 * be in place before any component's mount-time fetch calls run — effect
 * ordering across sibling components isn't a contract worth relying on for
 * something this security-relevant.
 */
function requestUrl(args: Parameters<typeof fetch>): string {
  try {
    if (typeof args[0] === 'string') return args[0];
    if (args[0] instanceof URL) return args[0].href;
    if (args[0] instanceof Request) return args[0].url;
  } catch (_) { /* ignore */ }
  return '';
}

if (typeof window !== 'undefined' && !window.__yvFetchPatched) {
  window.__yvFetchPatched = true;
  const originalFetch = window.fetch;

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const url = requestUrl(args);

    // Only attach credentials for requests to our own API — third-party
    // scripts (analytics, chat widgets, Stripe) shouldn't get our cookie.
    if (url.startsWith(API_ROOT) && !(args[0] instanceof Request)) {
      const init = { ...(args[1] || {}), credentials: 'include' as RequestCredentials };
      args = [args[0], init];
    }

    const response = await originalFetch(...args);

    if (response.status === 401) {
      const token = localStorage.getItem('token');
      // Only redirect if the user was authenticated — avoids interfering
      // with public pages where a 401 is a normal "not logged in" response.
      if (token) {
        const isAuthEndpoint = /\/(auth\/login|auth\/register|auth\/forgot-password|auth\/reset-password|2fa\/complete-login)/.test(url);
        if (!isAuthEndpoint) {
          markLoggedOut();
          originalFetch(apiUrl('/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => {});
          window.location.href = '/login?expired=1';
        }
      }
    }

    return response;
  };
}

/**
 * Enforces mandatory 2FA for admin/dealer accounts: on every navigation,
 * checks /auth/me and redirects to /2fa-required if that role hasn't set it
 * up yet — a real hard gate, not just a one-time check at login.
 *
 * Mounted once in the root layout — no changes needed on individual pages.
 */
export default function AuthGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    if (TWO_FA_EXEMPT_PATHS.some((p) => pathname?.startsWith(p))) return;

    fetch(apiUrl('/auth/me'))
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => {
        if (user && ['admin', 'dealer'].includes(user.user_type) && !user.two_factor_enabled) {
          router.replace('/2fa-required');
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  return null;
}
