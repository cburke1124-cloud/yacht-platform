"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';
import BulkImportExportTools from "@/app/components/BulkImportExportTools";

export default function BulkToolsPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { router.replace('/login'); return; }
        const perms = (u.permissions || {}) as Record<string, boolean>;
        const canCreate = u.user_type === 'dealer' || u.user_type === 'admin' ||
          !!(perms.create_listings ?? perms.can_create_listings);
        if (!canCreate) router.replace('/dashboard');
      });
  }, []);
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">Bulk Import & Export Tools</h1>
          <p className="text-dark/70">
            Manage your listings in bulk with our powerful import and export tools
          </p>
        </div>

        {/* Component */}
        <BulkImportExportTools 
          mode="standalone"
          userRole="dealer"
        />
      </div>
    </div>
  );
}