import { notFound } from 'next/navigation';
import { API_ROOT } from '@/app/lib/apiRoot';
import BlogPostClient from './BlogPostClient';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://yachtversal.com';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

async function fetchPost(slug: string): Promise<{ post: any | null; is404: boolean }> {
  try {
    const res = await fetch(`${API_ROOT}/blog/posts/${slug}`, { next: { revalidate: 3600 } });
    if (res.status === 404) return { post: null, is404: true };
    if (!res.ok) return { post: null, is404: false };
    return { post: await res.json(), is404: false };
  } catch {
    return { post: null, is404: false };
  }
}

async function fetchRelatedPosts(slug: string) {
  try {
    const res = await fetch(`${API_ROOT}/blog/posts?status=published&limit=3`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []).filter((p: any) => p.slug !== slug);
  } catch {
    return [];
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [{ post, is404 }, relatedPosts] = await Promise.all([fetchPost(slug), fetchRelatedPosts(slug)]);

  if (is404) {
    notFound();
  }

  const jsonLd = post ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description || post.excerpt,
    image: post.featured_image ? [post.featured_image] : undefined,
    datePublished: post.published_at,
    author: post.author ? { '@type': 'Person', name: post.author } : undefined,
  } : null;

  const breadcrumbJsonLd = post ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${slug}` },
    ],
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <BlogPostClient initialPost={post} initialRelatedPosts={relatedPosts} />
    </>
  );
}
