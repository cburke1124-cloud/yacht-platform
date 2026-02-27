'use client';

import { useParams } from 'next/navigation';
import { ListingEditorPage } from '@/app/listings/create/page';

export default function DealerEditListingPage() {
  const params = useParams();
  const id = (params?.id as string) || '';

  return <ListingEditorPage mode="edit" listingId={id} />;
}
