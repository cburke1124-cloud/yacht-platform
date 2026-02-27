'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Clock, Eye, Tag, Calendar, ChevronRight } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function BlogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<any[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [stats, setStats] = useState<any>(null);

  const selectedCategory = searchParams.get('category') || '';
  const selectedTag = searchParams.get('tag') || '';
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory, selectedTag, searchQuery]);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    fetchMeta();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('status', 'published');
      params.append('limit', '50');
      
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedTag) params.append('tag', selectedTag);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(
        apiUrl(`/blog/posts?${params.toString()}`)
      );
      
      if (response.ok) {
        const data = await response.json();
        const nextPosts = data.posts || [];
        setPosts(nextPosts);
        setRecentPosts(nextPosts.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [statsRes, categoriesRes] = await Promise.all([
        fetch(apiUrl('/blog/stats')),
        fetch(apiUrl('/blog/categories')),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (categoriesRes.ok) {
        const categoryData = await categoriesRes.json();
        setCategories(Array.isArray(categoryData) ? categoryData : []);
      }
    } catch (error) {
      console.error('Failed to fetch blog meta:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchInput.trim()) {
      params.set('search', searchInput.trim());
    } else {
      params.delete('search');
    }
    router.push(`/blog${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleCategoryClick = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) {
      params.set('category', slug);
    } else {
      params.delete('category');
    }
    params.delete('tag');
    router.push(`/blog${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleTagClick = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) {
      params.set('tag', slug);
    } else {
      params.delete('tag');
    }
    router.push(`/blog${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="min-h-screen section-light">
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl md:text-5xl font-bold text-secondary mb-3">YachtVersal Blog</h1>
          <p className="text-dark/70 max-w-3xl">Guides, market insights, and practical ownership content for buyers and sellers.</p>

          <form onSubmit={handleSearch} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-3xl">
            <div className="flex-1 flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search blog posts"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-11 outline-none text-sm"
              />
            </div>
            <button type="submit" className="px-5 h-11 bg-primary text-white rounded-lg hover:bg-primary/90">
              Search
            </button>
          </form>

          {stats && (
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-dark/70">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">{stats.published_posts} posts</span>
              <span className="px-3 py-1 rounded-full bg-gray-100">{stats.total_categories} categories</span>
              <span className="px-3 py-1 rounded-full bg-gray-100">{stats.total_views?.toLocaleString()} views</span>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8">
          <section className="min-w-0">
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => handleCategoryClick('')}
                className={`px-3 py-1.5 rounded-full text-sm border ${!selectedCategory ? 'bg-primary text-white border-primary' : 'bg-white text-dark/70 border-gray-300 hover:border-primary/40'}`}
              >
                All Posts
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.slug)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${selectedCategory === category.slug ? 'bg-primary text-white border-primary' : 'bg-white text-dark/70 border-gray-300 hover:border-primary/40'}`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-16 text-dark/70">Loading articles...</div>
            ) : posts.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-dark/70">No posts found for the selected filters.</div>
            ) : (
              <div className="space-y-5">
                {posts.map((post) => (
                  <article key={post.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <Link href={`/blog/${post.slug}`} className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
                      {post.featured_image ? (
                        <img src={post.featured_image} alt={post.title} className="w-full h-full min-h-[180px] object-cover" />
                      ) : (
                        <div className="bg-gray-100 min-h-[180px]" />
                      )}

                      <div className="p-5">
                        {post.category_name && (
                          <span className="inline-block px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full mb-2">{post.category_name}</span>
                        )}
                        <h2 className="text-xl font-bold text-secondary mb-2 line-clamp-2">{post.title}</h2>
                        {post.excerpt && <p className="text-dark/70 mb-3 line-clamp-3">{post.excerpt}</p>}

                        <div className="flex flex-wrap gap-4 text-xs text-dark/60 mb-3">
                          <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(post.published_at)}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{post.reading_time} min</span>
                          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{post.view_count || 0}</span>
                        </div>

                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {post.tags.slice(0, 4).map((tag: string) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleTagClick(tag);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${selectedTag === tag ? 'bg-primary text-white' : 'bg-gray-100 text-dark/70 hover:bg-gray-200'}`}
                              >
                                <Tag className="w-3 h-3" />
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="inline-flex items-center gap-1 text-primary text-sm font-medium">
                          Read more
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-secondary mb-3">Categories</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.slug)}
                    className="w-full text-left text-sm text-dark/70 hover:text-primary"
                  >
                    {category.name} ({category.post_count || 0})
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-secondary mb-3">Recent Posts</h3>
              <div className="space-y-3">
                {recentPosts.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="block text-sm text-dark/80 hover:text-primary">
                    {post.title}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}