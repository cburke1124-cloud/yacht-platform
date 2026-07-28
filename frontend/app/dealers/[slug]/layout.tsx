import type { Metadata } from 'next';
import { apiUrl, mediaUrl } from '@/app/lib/apiRoot';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://yachtversal.com';

interface DealerSummary {
  business_name?: string;
  bio?: string;
  logo_url?: string;
  cover_image_url?: string;
  city?: string;
  state?: string;
  active_listings?: number;
}

async function fetchDealer(slug: string): Promise<DealerSummary | null> {
  try {
    const res = await fetch(apiUrl(`/dealers/${slug}?skip=0&limit=1`), { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.dealer || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const dealer = await fetchDealer(slug);

  if (!dealer) {
    return { title: 'Broker Not Found' };
  }

  const title = dealer.business_name || 'Yacht Broker';
  const location = [dealer.city, dealer.state].filter(Boolean).join(', ');
  const description = dealer.bio?.slice(0, 160)
    || `${title}${location ? ` — ${location}` : ''}. ${dealer.active_listings ?? 0} active yacht listings on YachtVersal.`;

  const imageUrl = dealer.logo_url ? mediaUrl(dealer.logo_url) : (dealer.cover_image_url ? mediaUrl(dealer.cover_image_url) : undefined);

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/dealers/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/dealers/${slug}`,
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

export default function DealerProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
