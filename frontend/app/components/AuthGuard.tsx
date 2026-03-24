"use client"

import { useEffect } from 'react';

/**
 * Globally intercepts any fetch response with status 401.
 * If the user has a token stored (i.e. they think they're logged in),
 * clears auth state and redirects to /login?expired=1 so they see
 * a clear "session expired" message rather than a broken empty page.
 *
 * Mounted once in the root layout — no changes needed on individual pages.
 */
export default function AuthGuard() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function (...args: Parameters<typeof fetch>) {
      const response = await originalFetch(...args);

      if (response.status === 401) {
        const token = localStorage.getItem('token');
        // Only redirect if the user was authenticated — avoids interfering
        // with public pages where a 401 is a normal "not logged in" response.
        if (token) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url ?? '';
          const isAuthEndpoint = /\/(auth\/login|auth\/register|auth\/forgot-password|auth\/reset-password|2fa\/complete-login)/.test(url);
          if (!isAuthEndpoint) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login?expired=1';
          }
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
