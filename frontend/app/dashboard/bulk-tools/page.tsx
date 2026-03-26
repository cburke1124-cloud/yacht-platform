"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/apiRoot';
import BulkImportExportTools from "@/app/components/BulkImportExportTools";
import SingleListingScraper from "@/app/dashboard/components/SingleListingScraper";
import { Globe, FileSpreadsheet, ArrowLeft } from 'lucide-react';

type Tab = 'scraper' | 'bulk';

export default function BulkToolsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const [tab, setTab] = useState<Tab>(modeParam === 'bulk' ? 'bulk' : 'scraper');

  useEffect(() => {
    if (modeParam === 'bulk') setTab('bulk');
    else if (modeParam === 'scraper') setTab('scraper');
  }, [modeParam]);

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
        {/* Back */}
        <Link
          href="/listings/add"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-secondary transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Add a Listing
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-dark mb-2">Listing Import Tools</h1>
          <p className="text-dark/70">
            Import listings directly from your website or upload a spreadsheet in bulk.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
          <button
            onClick={() => setTab('scraper')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'scraper'
                ? 'bg-white text-dark shadow-sm'
                : 'text-dark/60 hover:text-dark'
            }`}
          >
            <Globe size={15} />
            Import from Website
          </button>
          <button
            onClick={() => setTab('bulk')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'bulk'
                ? 'bg-white text-dark shadow-sm'
                : 'text-dark/60 hover:text-dark'
            }`}
          >
            <FileSpreadsheet size={15} />
            Bulk CSV Import / Export
          </button>
        </div>

        {/* Content */}
        {tab === 'scraper' ? (
          <div className="max-w-2xl">
            <SingleListingScraper />
          </div>
        ) : (
          <BulkImportExportTools
            mode="standalone"
            userRole="dealer"
          />
        )}
      </div>
    </div>
  );
}