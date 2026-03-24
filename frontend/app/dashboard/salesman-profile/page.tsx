'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import SalesmanProfileForm from '@/app/dashboard/components/SalesmanProfileForm';

export default function SalesmanProfileEditPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen section-light py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-dark/60 hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-secondary">My Profile</h1>
        </div>
        <SalesmanProfileForm />
      </div>
    </div>
  );
}
