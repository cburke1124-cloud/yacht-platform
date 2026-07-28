import type { Metadata } from 'next';
import { API_ROOT, mediaUrl } from '@/app/lib/apiRoot';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://yachtversal.com';

interface CharterSummary {
  title?: string;
  day_rate?: number;
  week_rate?: number;
  currency?: string;
  boat_type?: string;
  length_feet?: number;
  home_port_city?: string;
  home_port_state?: string;
  description?: string;
  images?: Array<{ url: string; is_primary?: boolean } | string>;
}

async function fetchCharter(id: string): Promise<CharterSummary | null> {
  try {
    const res = await fetch(`${API_ROOT}/charter/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const charter = await fetchCharter(id);

  if (!charter) {
    return { title: 'Charter Not Found' };
  }

  const title = charter.title || 'Yacht Charter';
  const location = [charter.home_port_city, charter.home_port_state].filter(Boolean).join(', ');
  const rateStr = charter.day_rate
    ? `${charter.currency || 'USD'} ${charter.day_rate.toLocaleString()}/day`
    : charter.week_rate
      ? `${charter.currency || 'USD'} ${charter.week_rate.toLocaleString()}/week`
      : undefined;
  const descriptionParts = [
    charter.boat_type,
    charter.length_feet ? `${charter.length_feet}ft` : undefined,
    rateStr,
    location,
  ].filter(Boolean);
  const description = descriptionParts.length > 0
    ? `${title} — ${descriptionParts.join(' | ')}`
    : (charter.description?.slice(0, 160) || `Charter ${title} on YachtVersal.`);

  const primaryImage = charter.images?.find((img) => typeof img !== 'string' && img.is_primary) || charter.images?.[0];
  const imageUrl = primaryImage ? mediaUrl(typeof primaryImage === 'string' ? primaryImage : primaryImage.url) : undefined;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/charter/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/charter/${id}`,
      type: 'website',
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default function CharterDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
