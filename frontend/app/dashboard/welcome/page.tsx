'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    // Welcome flow is handled by the BrokerOnboarding in /dashboard
    router.replace('/dashboard');
  }, [router]);

  return null;
}