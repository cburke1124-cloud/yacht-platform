'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';
import { mediaUrl, onImgError } from '@/app/lib/apiRoot';

export interface BlogPostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image?: string | null;
  category_name?: string | null;
  reading_time?: number;
}

export default function BlogPostCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="hover-lift group block bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm"
    >
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {post.featured_image ? (
          <img
            src={mediaUrl(post.featured_image)}
            alt={post.title}
            onError={onImgError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <span className="text-4xl">📰</span>
          </div>
        )}
        {post.category_name && (
          <span className="absolute top-3 left-3 bg-white/90 text-[#10214F] text-xs font-semibold px-2.5 py-1 rounded-full">
            {post.category_name}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3
          className="font-semibold text-[#10214F] line-clamp-2 group-hover:text-primary transition-colors"
          style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 16 }}
        >
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-[#10214F]/60 mt-1.5 line-clamp-2 font-poppins">{post.excerpt}</p>
        )}
        {post.reading_time ? (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-[#10214F]/50 font-poppins">
            <Clock size={12} />
            {post.reading_time} min read
          </div>
        ) : null}
      </div>
    </Link>
  );
}
