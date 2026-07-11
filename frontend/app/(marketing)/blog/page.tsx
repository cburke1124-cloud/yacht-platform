import type { Metadata } from 'next';
import { API_ROOT } from '@/app/lib/apiRoot';
import BlogBrowseContent from './BlogBrowseContent';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

const TITLE = 'YachtVersal Blog — Yacht Buying Guides & Market Insights';
const DESCRIPTION = 'Guides, market insights, and practical ownership content for yacht buyers and sellers.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

interface BlogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function fetchInitialBlogData(params: Record<string, string | string[] | undefined>) {
  try {
    const qs = new URLSearchParams();
    qs.set('status', 'published');
    qs.set('limit', '50');
    for (const key of ['category', 'tag', 'search']) {
      const value = params[key];
      if (typeof value === 'string' && value) qs.set(key, value);
    }

    const [postsRes, categoriesRes, statsRes] = await Promise.all([
      fetch(`${API_ROOT}/blog/posts?${qs.toString()}`, { next: { revalidate: 300 } }),
      fetch(`${API_ROOT}/blog/categories`, { next: { revalidate: 3600 } }),
      fetch(`${API_ROOT}/blog/stats`, { next: { revalidate: 3600 } }),
    ]);

    const posts = postsRes.ok ? ((await postsRes.json()).posts ?? []) : [];
    const categoriesData = categoriesRes.ok ? await categoriesRes.json() : [];
    const stats = statsRes.ok ? await statsRes.json() : null;

    return {
      posts,
      categories: Array.isArray(categoriesData) ? categoriesData : [],
      stats,
      ok: postsRes.ok,
    };
  } catch {
    return { posts: [], categories: [], stats: null, ok: false };
  }
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const { posts, categories, stats, ok } = await fetchInitialBlogData(params);

  return (
    <BlogBrowseContent
      initialPosts={posts}
      initialCategories={categories}
      initialStats={stats}
      hasInitialData={ok}
    />
  );
}
