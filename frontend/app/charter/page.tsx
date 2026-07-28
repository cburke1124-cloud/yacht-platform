import type { Metadata } from 'next';
import { API_ROOT } from '@/app/lib/apiRoot';
import CharterBrowseContent from './CharterBrowseContent';
import type { CharterListing } from '@/app/components/CharterCard';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://yachtversal.com';

const TITLE = 'Yacht Charters — Search Crewed & Bareboat Charters | YachtVersal';
const DESCRIPTION = 'Search yacht charters worldwide by destination, dates, guests, and budget. Browse crewed and bareboat charters from verified charter companies.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/charter` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/charter`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

async function fetchInitialCharters(): Promise<{ charters: CharterListing[]; total: number; ok: boolean }> {
  try {
    const res = await fetch(`${API_ROOT}/charter?page=1&limit=24`, { next: { revalidate: 300 } });
    if (!res.ok) return { charters: [], total: 0, ok: false };
    const data = await res.json();
    return { charters: data.results ?? [], total: data.total ?? 0, ok: true };
  } catch {
    return { charters: [], total: 0, ok: false };
  }
}

export default async function CharterPage() {
  const { charters, total, ok } = await fetchInitialCharters();

  return (
    <CharterBrowseContent
      initialCharters={charters}
      initialTotal={total}
      hasInitialData={ok}
    />
  );
}
