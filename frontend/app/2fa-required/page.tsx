'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import SecuritySettingsComponent from '@/app/components/SecuritySettings';

export default function TwoFactorRequiredPage() {
  const router = useRouter();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);

  const checkStatus = async () => {
    try {
      const res = await fetch(apiUrl('/auth/me'));
      if (!res.ok) return;
      const data = await res.json();
      setTwoFactorEnabled(!!data.two_factor_enabled);
    } catch {
      // ignore — user can retry via the Continue button
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleContinue = async () => {
    await checkStatus();
  };

  useEffect(() => {
    if (twoFactorEnabled) {
      router.replace('/dashboard');
    }
  }, [twoFactorEnabled, router]);

  return (
    <div className="min-h-screen section-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 flex items-start gap-4">
          <ShieldAlert className="text-amber-600 flex-shrink-0" size={28} />
          <div>
            <h1 className="text-xl font-bold text-secondary mb-1">
              Two-factor authentication is required
            </h1>
            <p className="text-dark/70 text-sm">
              Admin and broker accounts must enable two-factor authentication before continuing.
              Turn it on below, then click Continue.
            </p>
          </div>
        </div>

        <SecuritySettingsComponent />

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleContinue}
            className="px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
