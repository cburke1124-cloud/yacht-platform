import { MetadataRoute } from 'next';
import * as Sentry from '@sentry/nextjs';
import { getBoatTypes } from '@/app/lib/boatTypeData';
import { getDestinations } from '@/app/lib/destinationData';
import { fetchLocationNodes } from '@/app/lib/listingLocationsData';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'https://www.yachtversal.com';
const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'https://yacht-platform.onrender.com/api').replace(/\/+$/, '');

// Static pages with their priority and change frequency
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
  { url: `${SITE_URL}/listings`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
  { url: `${SITE_URL}/ai-search`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/sell`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  { url: `${SITE_URL}/boat-types`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${SITE_URL}/makes`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/charter-destinations`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${SITE_URL}/yachts-for-sale`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  { url: `${SITE_URL}/charter`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  { url: `${SITE_URL}/dealers`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/resources/how-buying-works`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/resources/financing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
];

async function fetchAllListings(): Promise<{ id: number; updated_at?: string }[]> {
  try {
    // Fetch in pages of 500 until exhausted
    const allListings: { id: number; updated_at?: string }[] = [];
    let skip = 0;
    const limit = 500;

    while (true) {
      const res = await fetch(
        `${API_ROOT}/listings?status=active&limit=${limit}&skip=${skip}`,
        { next: { revalidate: 3600 } } // cache for 1 hour at build/ISR time
      );
      if (!res.ok) {
        Sentry.captureMessage(`sitemap: listings fetch returned ${res.status} at skip=${skip}`, { tags: { sitemap_source: 'listings' } });
        break;
      }
      const data = await res.json();
      const page: any[] = Array.isArray(data) ? data : (data.listings ?? []);
      if (page.length === 0) break;
      allListings.push(...page.map((l: any) => ({ id: l.id, updated_at: l.updated_at })));
      if (page.length < limit) break;
      skip += limit;
    }
    return allListings;
  } catch (err) {
    Sentry.captureException(err, { tags: { sitemap_source: 'listings' } });
    return [];
  }
}

async function fetchAllDealers(): Promise<{ slug: string; updated_at?: string }[]> {
  try {
    const res = await fetch(`${API_ROOT}/dealers?limit=500`, { next: { revalidate: 86400 } });
    if (!res.ok) {
      Sentry.captureMessage(`sitemap: dealers fetch returned ${res.status}`, { tags: { sitemap_source: 'dealers' } });
      return [];
    }
    const data = await res.json();
    const dealers: any[] = Array.isArray(data) ? data : (data.dealers ?? []);
    return dealers.filter((d: any) => d.slug).map((d: any) => ({ slug: d.slug, updated_at: d.updated_at }));
  } catch (err) {
    Sentry.captureException(err, { tags: { sitemap_source: 'dealers' } });
    return [];
  }
}

async function fetchAllBlogSlugs(): Promise<{ slug: string; updated_at?: string }[]> {
  try {
    const res = await fetch(`${API_ROOT}/blog?limit=500&status=published`, { next: { revalidate: 86400 } });
    if (!res.ok) {
      Sentry.captureMessage(`sitemap: blog fetch returned ${res.status}`, { tags: { sitemap_source: 'blog' } });
      return [];
    }
    const data = await res.json();
    const posts: any[] = Array.isArray(data) ? data : (data.posts ?? []);
    return posts.filter((p: any) => p.slug).map((p: any) => ({ slug: p.slug, updated_at: p.updated_at }));
  } catch (err) {
    Sentry.captureException(err, { tags: { sitemap_source: 'blog' } });
    return [];
  }
}

async function fetchAllCharters(): Promise<{ id: number; updated_at?: string }[]> {
  try {
    const allCharters: { id: number; updated_at?: string }[] = [];
    let page = 1;
    const limit = 500;

    while (true) {
      const res = await fetch(
        `${API_ROOT}/charter?page=${page}&limit=${limit}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) {
        Sentry.captureMessage(`sitemap: charter fetch returned ${res.status}`, { tags: { sitemap_source: 'charter' } });
        break;
      }
      const data = await res.json();
      const results: any[] = data.results ?? [];
      if (results.length === 0) break;
      allCharters.push(...results.map((c: any) => ({ id: c.id, updated_at: c.updated_at })));
      if (results.length < limit) break;
      page += 1;
    }
    return allCharters;
  } catch (err) {
    Sentry.captureException(err, { tags: { sitemap_source: 'charter' } });
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, dealers, blogPosts, locationNodes, charters] = await Promise.all([
    fetchAllListings(),
    fetchAllDealers(),
    fetchAllBlogSlugs(),
    fetchLocationNodes(),
    fetchAllCharters(),
  ]);

  const listingEntries: MetadataRoute.Sitemap = listings.map(({ id, updated_at }) => ({
    url: `${SITE_URL}/listings/${id}`,
    lastModified: updated_at ? new Date(updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const charterEntries: MetadataRoute.Sitemap = charters.map(({ id, updated_at }) => ({
    url: `${SITE_URL}/charter/${id}`,
    lastModified: updated_at ? new Date(updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const dealerEntries: MetadataRoute.Sitemap = dealers.map(({ slug, updated_at }) => ({
    url: `${SITE_URL}/dealers/${slug}`,
    lastModified: updated_at ? new Date(updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const blogEntries: MetadataRoute.Sitemap = blogPosts.map(({ slug, updated_at }) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: updated_at ? new Date(updated_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  const boatTypeEntries: MetadataRoute.Sitemap = getBoatTypes().map(({ slug }) => ({
    url: `${SITE_URL}/boat-types/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const destinations = getDestinations();
  const destinationEntries: MetadataRoute.Sitemap = destinations.map((d) => ({
    url:
      d.type === 'region'
        ? `${SITE_URL}/charter-destinations/${d.slug}`
        : `${SITE_URL}/charter-destinations/${d.parentRegion}/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: d.type === 'region' ? 0.6 : 0.5,
  }));

  const locationEntries: MetadataRoute.Sitemap = locationNodes.map((node) => ({
    url: `${SITE_URL}/yachts-for-sale/${node.path.join('/')}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: node.type === 'country' ? 0.6 : node.type === 'state' ? 0.55 : 0.5,
  }));

  return [
    ...STATIC_PAGES,
    ...listingEntries,
    ...charterEntries,
    ...dealerEntries,
    ...blogEntries,
    ...boatTypeEntries,
    ...destinationEntries,
    ...locationEntries,
  ];
}
