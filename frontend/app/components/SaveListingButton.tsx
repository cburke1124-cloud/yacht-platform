'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SaveListingButton({ 
  listingId,
  className = ""
}: { 
  listingId: number;
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIfSaved();
  }, [listingId]);

  const checkIfSaved = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(apiUrl('/saved-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const isSaved = data.some((item: any) => item.listing_id === listingId);
        setSaved(isSaved);
      }
    } catch (error) {
      console.error('Failed to check saved status:', error);
    }
  };

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if button is in a link
    e.stopPropagation();

    const token = localStorage.getItem('token');
    if (!token) {
      // Redirect to login
      router.push('/login?redirect=/listings/' + listingId);
      return;
    }

    setLoading(true);

    try {
      if (saved) {
        // Find the saved listing ID and delete it
        const response = await fetch(apiUrl('/saved-listings'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const savedItem = data.find((item: any) => item.listing_id === listingId);
          
          if (savedItem) {
            await fetch(apiUrl(`/saved-listings/${savedItem.id}`), {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            setSaved(false);
          }
        }
      } else {
        // Save the listing
        const response = await fetch(apiUrl('/saved-listings'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ listing_id: listingId })
        });

        if (response.ok) {
          setSaved(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle save:', error);
      alert('Failed to save listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleSave}
      disabled={loading}
      className={`p-2 rounded-full transition-all ${
        saved
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
      } ${className}`}
      title={saved ? 'Remove from saved' : 'Save this yacht'}
    >
      <Heart 
        size={20} 
        fill={saved ? 'currentColor' : 'none'}
        className={loading ? 'animate-pulse' : ''}
      />
    </button>
  );
}


// ADD TO ListingCard.tsx:
// Import the component at the top:
import SaveListingButton from './SaveListingButton';
import { apiUrl } from '@/app/lib/apiRoot';

// Then in the card, add this button (typically in the top-right corner of the image):
<div className="absolute top-3 right-3 z-10">
  <SaveListingButton listingId={id} />
</div>