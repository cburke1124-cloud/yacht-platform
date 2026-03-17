// Listing Edit Page with Image Reordering
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';
import { GripVertical, Star, Trash2 } from 'lucide-react';

interface ListingMedia {
  id: number;
  media_id: number;
  url: string;
  thumbnail_url?: string;
  display_order: number;
  is_primary: boolean;
  caption?: string;
}

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const listingId = params?.id;
  const [images, setImages] = useState<ListingMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchImages();
  }, [listingId]);

  const fetchImages = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/listings/${listingId}/media`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setImages(data.attachments || []);
      } else {
        setError('Failed to load images');
      }
    } catch (e) {
      setError('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  // Drag-and-drop reordering
  const moveImage = (from: number, to: number) => {
    setImages((imgs) => {
      const arr = [...imgs];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr.map((img, idx) => ({ ...img, display_order: idx }));
    });
  };

  const setPrimary = (idx: number) => {
    setImages((imgs) =>
      imgs.map((img, i) => ({ ...img, is_primary: i === idx }))
    );
  };

  const saveOrder = async () => {
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`/listings/${listingId}/media/reorder`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attachments: images.map((img, idx) => ({
            id: img.id,
            display_order: idx,
            is_primary: img.is_primary,
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed to save order');
      await fetchImages();
    } catch (e) {
      setError('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Listing Images</h1>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <ul className="space-y-4">
            {images.map((img, idx) => (
              <li key={img.id} className="flex items-center gap-4 bg-white rounded shadow p-2">
                <span className="cursor-move"><GripVertical /></span>
                <img src={mediaUrl(img.thumbnail_url || img.url)} alt="" className="w-20 h-20 object-cover rounded" onError={onImgError} />
                <button
                  className={`ml-2 px-2 py-1 rounded ${img.is_primary ? 'bg-yellow-400 text-white' : 'bg-gray-200'}`}
                  onClick={() => setPrimary(idx)}
                  disabled={img.is_primary}
                  title="Set as Primary"
                >
                  <Star size={18} />
                </button>
                <span className="ml-auto text-xs text-gray-500">Order: {idx + 1}</span>
              </li>
            ))}
          </ul>
          <button
            className="mt-6 px-6 py-2 bg-[#01BBDC] text-white rounded hover:bg-[#0099B8]"
            onClick={saveOrder}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      )}
    </div>
  );
}
