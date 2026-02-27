'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Eye, Calendar, Tag, Share2, User } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function BlogPostPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [post, setPost] = useState<any>(null);
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (slug) {
      fetchPost();
      fetchRelatedPosts();
    }
  }, [slug]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl(`/blog/posts/${slug}`));
      
      if (response.ok) {
        const data = await response.json();
        setPost(data);
      } else {
        setError('Post not found');
      }
    } catch (error) {
      console.error('Failed to fetch post:', error);
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedPosts = async () => {
    try {
      const response = await fetch(
        apiUrl('/blog/posts?status=published&limit=3')
      );
      
      if (response.ok) {
        const data = await response.json();
        setRelatedPosts((data.posts || []).filter((p: any) => p.slug !== slug));
      }
    } catch (error) {
      console.error('Failed to fetch related posts:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const sharePost = (platform: string) => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(post.title);
    
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };
    
    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen section-light flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <div className="text-xl text-dark/60">Loading article...</div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen section-light flex items-center justify-center">
        <div className="text-center bg-white border border-gray-200 rounded-2xl p-12 max-w-md mx-auto">
          <div className="text-6xl mb-4">📄</div>
          <div className="text-xl text-dark/60 mb-6">{error || 'Post not found'}</div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-light">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>

      {/* Article Header */}
      <article className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-10">
          {/* Category Badge */}
          {post.category_name && (
            <div className="mb-6">
              <Link
                href={`/blog?category=${post.category}`}
                className="inline-block px-4 py-2 text-sm font-semibold text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
              >
                {post.category_name}
              </Link>
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-dark mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-xl text-dark/70 mb-8 leading-relaxed">
              {post.excerpt}
            </p>
          )}

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-6 pb-8 mb-8 border-b border-dark/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold text-dark">{post.author}</div>
                <div className="text-sm text-dark/70">Author</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-dark/70">
              <Calendar className="w-5 h-5" />
              <span>{formatDate(post.published_at)}</span>
            </div>

            <div className="flex items-center gap-2 text-dark/60">
              <Clock className="w-5 h-5" />
              <span>{post.reading_time} min read</span>
            </div>

            <div className="flex items-center gap-2 text-dark/60">
              <Eye className="w-5 h-5" />
              <span>{post.view_count} views</span>
            </div>
          </div>

          {/* Featured Image */}
          {post.featured_image && (
            <div className="mb-12 rounded-2xl overflow-hidden border border-gray-200">
              <img
                src={post.featured_image}
                alt={post.featured_image_alt || post.title}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Article Content */}
          <div className="prose prose-lg max-w-none mb-12">
            <div 
              className="text-dark/80 leading-relaxed"
              style={{ 
                fontSize: '1.125rem', 
                lineHeight: '1.875',
                whiteSpace: 'pre-wrap'
              }}
            >
              {post.content}
            </div>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mb-12 pb-12 border-b border-dark/10">
              <h3 className="text-lg font-semibold text-dark mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-3">
                {post.tags.map((tag: any) => (
                  <Link
                    key={tag.id}
                    href={`/blog?tag=${tag.slug}`}
                    className="px-4 py-2 bg-dark/5 text-dark/70 rounded-full text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Share Section */}
          <div className="mb-12 pb-12 border-b border-dark/10">
            <h3 className="text-lg font-semibold text-dark mb-4 flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Share this article
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => sharePost('twitter')}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
              >
                Twitter
              </button>
              <button
                onClick={() => sharePost('facebook')}
                className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 text-sm"
              >
                Facebook
              </button>
              <button
                onClick={() => sharePost('linkedin')}
                className="px-4 py-2 bg-dark text-white rounded-lg hover:opacity-90 text-sm"
              >
                LinkedIn
              </button>
            </div>
          </div>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <div className="mt-10">
              <h3 className="text-3xl font-bold text-dark mb-6">Related Articles</h3>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.slice(0, 3).map((relatedPost) => (
                  <Link
                    key={relatedPost.id}
                    href={`/blog/${relatedPost.slug}`}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden group"
                  >
                    {relatedPost.featured_image && (
                      <div className="aspect-video bg-gray-200 overflow-hidden">
                        <img
                          src={relatedPost.featured_image}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      {relatedPost.category_name && (
                        <span className="inline-block px-3 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full mb-3">
                          {relatedPost.category_name}
                        </span>
                      )}
                      <h4 className="font-bold text-dark mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {relatedPost.title}
                      </h4>
                      <div className="flex items-center gap-4 text-xs text-dark/50">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{relatedPost.reading_time}m</span>
                        </div>
                        <span>{formatDate(relatedPost.published_at)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}