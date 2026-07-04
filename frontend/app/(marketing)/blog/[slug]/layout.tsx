import type { Metadata } from 'next';
import { apiUrl } from '@/app/lib/apiRoot';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

interface BlogPostSummary {
  title?: string;
  excerpt?: string;
  meta_description?: string;
  featured_image?: string;
  featured_image_alt?: string;
}

async function fetchPost(slug: string): Promise<BlogPostSummary | null> {
  try {
    const res = await fetch(apiUrl(`/blog/posts/${slug}`), { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  const title = post.title || 'YachtVersal Blog';
  const description = post.meta_description || post.excerpt || `Read "${title}" on the YachtVersal blog.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/blog/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/blog/${slug}`,
      type: 'article',
      images: post.featured_image ? [{ url: post.featured_image, alt: post.featured_image_alt || title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.featured_image ? [post.featured_image] : undefined,
    },
  };
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
