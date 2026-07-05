'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import {
  Plus, Edit, Trash2, Eye, Search, BarChart, TrendingUp, FileText, User, Copy, Tag
} from 'lucide-react';
import BlogPostEditor, { BlogFormData } from './blog/BlogPostEditor';

const EMPTY_FORM_DATA: BlogFormData = {
  title: '',
  excerpt: '',
  content: '',
  content_blocks: '',
  content_html: '',
  category: '',
  tags: [],
  featured_image: '',
  featured_image_alt: '',
  status: 'draft',
  scheduled_for: '',
  featured: false,
  allow_comments: true,
  meta_title: '',
  meta_description: '',
  meta_keywords: ''
};

export default function AdminBlogTab() {
  const [view, setView] = useState<'list' | 'editor' | 'stats'>('list');
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedPosts, setSelectedPosts] = useState<number[]>([]);
  const [userImages, setUserImages] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState<BlogFormData>(EMPTY_FORM_DATA);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchPosts(),
      fetchStats(),
      fetchCategories(),
      fetchTags(),
      fetchUserImages()
    ]);
    setLoading(false);
  };

  const fetchPosts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/blog/posts?limit=100'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/blog/stats'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(apiUrl('/blog/categories'));
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch(apiUrl('/blog/tags'));
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const fetchUserImages = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/media/my-media?file_type=image'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserImages(data.media || []);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploadingImage(true);
    const token = localStorage.getItem('token');

    try {
      const file = e.target.files[0];
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch(apiUrl('/media/upload'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataUpload
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, featured_image: data.media.url });
        await fetchUserImages();
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreatePost = () => {
    setEditingPost(null);
    setFormData(EMPTY_FORM_DATA);
    setView('editor');
  };

  const loadPostIntoEditor = async (slug: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/blog/posts/${slug}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const fullPost = await response.json();
        setEditingPost(fullPost);
        setFormData({
          title: fullPost.title,
          excerpt: fullPost.excerpt || '',
          content: fullPost.content,
          content_blocks: fullPost.content_blocks || '',
          content_html: fullPost.content_html || '',
          category: fullPost.category || '',
          tags: fullPost.tags?.map((t: any) => t.slug) || [],
          featured_image: fullPost.featured_image || '',
          featured_image_alt: fullPost.featured_image_alt || '',
          status: fullPost.status,
          scheduled_for: fullPost.scheduled_for ? new Date(fullPost.scheduled_for).toISOString().slice(0, 16) : '',
          featured: fullPost.featured,
          allow_comments: fullPost.allow_comments,
          meta_title: fullPost.meta_title || '',
          meta_description: fullPost.meta_description || '',
          meta_keywords: fullPost.meta_keywords || ''
        });
        setView('editor');
      }
    } catch (error) {
      console.error('Failed to fetch post:', error);
    }
  };

  const handleEditPost = async (post: any) => {
    await loadPostIntoEditor(post.slug);
  };

  const handlePostRestored = async () => {
    if (editingPost?.slug) {
      await loadPostIntoEditor(editingPost.slug);
    }
  };

  const handleSubmit = async (e: React.FormEvent, publishNow: boolean = false) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const url = editingPost
        ? apiUrl(`/admin/blog/posts/${editingPost.id}`)
        : apiUrl('/admin/blog/posts');

      const method = editingPost ? 'PUT' : 'POST';
      const submitData: any = { ...formData };

      if (publishNow) {
        submitData.status = 'published';
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        alert(publishNow
          ? 'Post published successfully!'
          : editingPost ? 'Post updated' : 'Post saved as draft'
        );
        setView('list');
        await fetchPosts();
        await fetchStats();
      } else {
        const error = await response.json();
        alert(`Failed to save: ${error.detail}`);
      }
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('Failed to save post');
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('Move this post to trash?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/admin/blog/posts/${postId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchPosts();
        await fetchStats();
        alert('Post moved to trash');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedPosts.length === 0) {
      alert('No posts selected');
      return;
    }

    if (!confirm(`${action} ${selectedPosts.length} post(s)?`)) return;

    const token = localStorage.getItem('token');

    for (const postId of selectedPosts) {
      try {
        if (action === 'Delete') {
          await fetch(apiUrl(`/admin/blog/posts/${postId}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } else if (action === 'Publish') {
          await fetch(apiUrl(`/admin/blog/posts/${postId}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'published' })
          });
        }
      } catch (error) {
        console.error(`Failed to ${action} post ${postId}:`, error);
      }
    }

    setSelectedPosts([]);
    await fetchPosts();
    await fetchStats();
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || post.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || post.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // STATS VIEW
  if (view === 'stats') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Blog Statistics</h2>
          <button
            onClick={() => setView('list')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Back to Posts
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="text-primary" size={24} />
                <span className="text-sm font-medium text-gray-600">Total Posts</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_posts}</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Eye className="text-green-600" size={24} />
                <span className="text-sm font-medium text-gray-600">Total Views</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_views.toLocaleString()}</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Tag className="text-purple-600" size={24} />
                <span className="text-sm font-medium text-gray-600">Categories</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_categories}</div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="text-orange-600" size={24} />
                <span className="text-sm font-medium text-gray-600">Published</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.published_posts}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // EDITOR VIEW
  if (view === 'editor') {
    return (
      <BlogPostEditor
        editingPost={editingPost}
        formData={formData}
        setFormData={setFormData}
        categories={categories}
        tags={tags}
        userImages={userImages}
        uploadingImage={uploadingImage}
        onImageUpload={handleImageUpload}
        onSubmit={handleSubmit}
        onBack={() => setView('list')}
        onPostRestored={handlePostRestored}
      />
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Posts</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('stats')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <BarChart size={18} />
            Stats
          </button>

          <button
            onClick={handleCreatePost}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus size={18} />
            Add New
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            onChange={(e) => {
              if (e.target.value) {
                handleBulkAction(e.target.value);
                e.target.value = '';
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>Bulk actions</option>
            <option value="Publish">Publish</option>
            <option value="Delete">Delete</option>
          </select>
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-12 px-6 py-3">
                <input
                  type="checkbox"
                  checked={
                    selectedPosts.length === filteredPosts.length &&
                    filteredPosts.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPosts(filteredPosts.map(p => p.id));
                    } else {
                      setSelectedPosts([]);
                    }
                  }}
                  className="rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <Eye size={14} className="inline" /> Views
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </td>
              </tr>
            ) : filteredPosts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No posts found</p>
                </td>
              </tr>
            ) : (
              filteredPosts.map(post => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedPosts.includes(post.id)}
                      onChange={(e) => {
                        setSelectedPosts(
                          e.target.checked
                            ? [...selectedPosts, post.id]
                            : selectedPosts.filter(id => id !== post.id)
                        );
                      }}
                      className="rounded"
                    />
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleEditPost(post)}
                      className="font-medium text-gray-900 hover:text-primary"
                    >
                      {post.title}
                    </button>
                    <div className="text-xs text-gray-500">/{post.slug}</div>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    <User size={14} className="inline mr-1" />
                    {post.author}
                  </td>

                  <td className="px-6 py-4 text-sm">
                    {post.category_name}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {post.tags?.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {post.view_count || 0}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString()
                      : 'Draft'}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                        className="p-2 hover:text-primary"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        onClick={() => handleEditPost(post)}
                        className="p-2 hover:text-green-600"
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/blog/${post.slug}`
                          );
                          alert('Link copied');
                        }}
                        className="p-2 hover:text-purple-600"
                      >
                        <Copy size={16} />
                      </button>

                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-2 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">All Posts</div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.total_posts}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Published</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.published_posts}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Drafts</div>
            <div className="text-2xl font-bold text-gray-600">
              {stats.draft_posts}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Views</div>
            <div className="text-2xl font-bold text-primary">
              {stats.total_views.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
