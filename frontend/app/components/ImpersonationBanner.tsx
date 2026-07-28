"use client"

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';

const EXEMPT_PATHS = ['/login', '/register', '/logout'];

interface Impersonator {
  id: number;
  email: string;
  name: string;
}

/**
 * Persistent, unmissable banner shown whenever the current session was
 * started via POST /admin/users/{id}/impersonate ("View As" in the admin
 * Users tab) — so it's never ambiguous which account is currently acting,
 * and there's always a one-click way back to the admin's own session.
 *
 * Mounted once in the root layout, alongside AuthGuard.
 */
export default function ImpersonationBanner() {
  const pathname = usePathname();
  const [impersonator, setImpersonator] = useState<Impersonator | null>(null);
  const [viewingName, setViewingName] = useState('');
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { setImpersonator(null); return; }
    if (EXEMPT_PATHS.some((p) => pathname?.startsWith(p))) return;

    fetch(apiUrl('/auth/me'))
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => {
        if (user?.impersonator) {
          setImpersonator(user.impersonator);
          setViewingName(
            `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
          );
        } else {
          setImpersonator(null);
        }
      })
      .catch(() => {});
  }, [pathname]);

  async function handleExit() {
    setExiting(true);
    try {
      const res = await fetch(apiUrl('/admin/impersonate/exit'), { method: 'POST' });
      if (res.ok) {
        window.location.href = '/admin';
      } else {
        setExiting(false);
      }
    } catch {
      setExiting(false);
    }
  }

  if (!impersonator) return null;

  return (
    <div
      className="sticky top-0 z-[9998] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white"
      style={{ backgroundColor: '#B45309' }}
    >
      <span>
        Viewing as <strong>{viewingName}</strong> — impersonated by {impersonator.name}
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 transition disabled:opacity-50"
      >
        {exiting ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  );
}
