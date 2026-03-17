'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GitCompare, Trash2, ExternalLink, Ship } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const FALLBACK = '/images/listing-fallback.png';

type Comparison = {
  id: number;
  name: string;
  created_at: string;
  listings: { id: number; title: string; images: string[] }[];
};

export default function ComparisonsPage() {
  const router = useRouter();
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => { fetchComparisons(); }, []);

  const fetchComparisons = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const res = await fetch(apiUrl('/comparisons'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setComparisons(await res.json());
      else if (res.status === 401) router.push('/login');
    } catch (err) { console.error('Failed to fetch comparisons:', err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this comparison?')) return;
    setDeletingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/comparisons/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setComparisons(prev => prev.filter(c => c.id !== id));
    } catch (err) { console.error('Failed to delete comparison:', err); }
    finally { setDeletingId(null); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#01BBDC]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/account" className="text-sm text-[#01BBDC] hover:underline mb-4 inline-block font-medium">
            Back to Account
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <div className="w-14 h-14 rounded-2xl bg-[#01BBDC]/10 flex items-center justify-center flex-shrink-0">
              <GitCompare size={28} className="text-[#01BBDC]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#10214F]">My Comparisons</h1>
              <p className="text-gray-500 mt-0.5">{comparisons.length} comparison{comparisons.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {comparisons.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-16 text-center">
            <GitCompare size={64} className="mx-auto mb-5 text-gray-200" />
            <h3 className="text-2xl font-bold text-[#10214F] mb-2">No comparisons yet</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              On any listing page, tap Compare to start building a side-by-side comparison.
            </p>
            <Link href="/listings" className="inline-block px-8 py-3 bg-[#01BBDC] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity shadow-md">
              Browse Yachts
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {comparisons.map((comp) => (
              <div key={comp.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                {/* Thumbnail grid */}
                <div className="grid grid-cols-2 gap-0.5 bg-gray-100 h-40">
                  {comp.listings.slice(0, 4).map((l, i) => (
                    <div key={l.id} className="relative overflow-hidden bg-gray-200">
                      <img
                        src={l.images?.[0] || FALLBACK}
                        alt={l.title}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }}
                      />
                    </div>
                  ))}
                  {comp.listings.length === 0 && (
                    <div className="col-span-2 flex items-center justify-center text-gray-300">
                      <Ship size={40} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-[#10214F] mb-1">{comp.name}</h3>
                  <p className="text-sm text-gray-500 mb-1">{comp.listings.length} yacht{comp.listings.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-400 mb-5">
                    Created {new Date(comp.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>

                  <div className="flex gap-2 mt-auto">
                    <Link
                      href={`/comparison/${comp.id}`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#01BBDC] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity text-sm"
                    >
                      <ExternalLink size={14} /> View
                    </Link>
                    <button
                      onClick={() => handleDelete(comp.id)}
                      disabled={deletingId === comp.id}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-red-200 text-red-500 rounded-2xl font-semibold hover:bg-red-50 transition-colors text-sm"
                    >
                      {deletingId === comp.id
                        ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
