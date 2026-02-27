'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import {
  Plus, Edit, Trash2, Eye, EyeOff, Search, Filter, Image as ImageIcon, 
  Calendar, Tag, BarChart, TrendingUp, FileText, Settings, Upload, X,
  Clock, User, Save, Send, MoreVertical, Star, Copy
} from 'lucide-react';

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
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [userImages, setUserImages] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: '',
    tags: [] as string[],
    featured_image: '',
    featured_image_alt: '',
    status: 'draft',
    scheduled_for: '',
    featured: false,
    allow_comments: true,
    meta_title: '',
    meta_description: '',
    meta_keywords: ''
  });

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
    setFormData({
      title: '',
      excerpt: '',
      content: '',
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
    });
    setView('editor');
  };

  const handleEditPost = async (post: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/blog/posts/${post.slug}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const fullPost = await response.json();
        setEditingPost(fullPost);
        setFormData({
          title: fullPost.title,
          excerpt: fullPost.excerpt || '',
          content: fullPost.content,
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

  const handleSubmit = async (e: React.FormEvent, publishNow: boolean = false) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingPost
        ? apiUrl(`/admin/blog/posts/${editingPost.id}`)
        : apiUrl('/admin/blog/posts');
      
      const method = editingPost ? 'PUT' : 'POST';
      const submitData = { ...formData };
      
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
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingPost ? 'Edit Post' : 'Add New Post'}
          </h2>
          <div className="flex items-center gap-2">
            {editingPost?.slug && (
              <button
                onClick={() => window.open(`/blog/${editingPost.slug}`, '_blank')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Preview
              </button>
            )}
            <button
              onClick={() => setView('list')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Back to Posts
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <input
                type="text"
                placeholder="Enter title here"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full text-3xl font-bold border-none outline-none placeholder:text-gray-300 mb-4"
              />

              <textarea
                placeholder="Write your excerpt here..."
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                className="w-full border border-gray-200 rounded-lg p-4 text-gray-600 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary mb-4"
                rows={3}
              />

              <div className="mb-4 text-sm text-gray-600">
                <span className="font-medium">Permalink:</span>{' '}
                /blog/{(editingPost?.slug || formData.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'post-slug')}
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Content</span>
                  <button
                    type="button"
                    onClick={() => setShowImagePicker(true)}
                    className="text-sm text-primary hover:text-primary/90 flex items-center gap-1"
                  >
                    <ImageIcon size={16} />
                    Add Media
                  </button>
                </div>
                <textarea
                  placeholder="Start writing your content..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
                  rows={20}
                />
              </div>
            </div>

            {/* SEO Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart size={20} />
                SEO Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={formData.meta_title}
                    onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Leave empty to use post title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Description
                  </label>
                  <textarea
                    value={formData.meta_description}
                    onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Publish Box */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Publish</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>

                {formData.status === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule for
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.scheduled_for}
                      onChange={(e) => setFormData({ ...formData, scheduled_for: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                )}

    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Eye size={16} />
      <span>Visibility: <strong>Public</strong></span>
    </div>
  </div>

  <div className="space-y-2">
    <button
      onClick={(e) => handleSubmit(e, false)}
      className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
    >
      <Save size={16} />
      Save {formData.status === 'scheduled' ? 'Scheduled Post' : 'Draft'}
    </button>
    {formData.status !== 'scheduled' && (
      <button
        onClick={(e) => handleSubmit(e, true)}
        className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2"
      >
        <Send size={16} />
        Publish Now
      </button>
    )}
  </div>
</div>

            {/* Featured Image */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Featured Image</h3>
              
              {formData.featured_image ? (
                <div className="relative">
                  <img
                    src={formData.featured_image}
                    alt="Featured"
                    className="w-full h-48 object-cover rounded-lg mb-3"
                  />
                  <button
                    onClick={() => setFormData({ ...formData, featured_image: '' })}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder="Alt text"
                    value={formData.featured_image_alt}
                    onChange={(e) => setFormData({ ...formData, featured_image_alt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                      <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                      <span className="text-sm text-gray-600">
                        {uploadingImage ? 'Uploading...' : 'Upload Image'}
                      </span>
                    </div>
                  </label>
                  <button
                    onClick={() => setShowImagePicker(true)}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Choose from Library
                  </button>
                </div>
              )}
            </div>

            {/* Category & Tags */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Category & Tags</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.slug}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => setFormData({
                            ...formData,
                            tags: formData.tags.filter(t => t !== tag)
                          })}
                          className="hover:text-secondary"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <select
                    onChange={(e) => {
                      if (e.target.value && !formData.tags.includes(e.target.value)) {
                        setFormData({
                          ...formData,
                          tags: [...formData.tags, e.target.value]
                        });
                      }
                      e.target.value = '';
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Add tag...</option>
                    {tags.map(tag => (
                      <option key={tag.id} value={tag.slug}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Post Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Post Settings</h3>
              
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Feature this post</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allow_comments}
                    onChange={(e) => setFormData({ ...formData, allow_comments: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Allow comments</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Image Picker Modal */}
        {showImagePicker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">Media Library</h3>
                  <button
                    onClick={() => setShowImagePicker(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {userImages.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => {
                        const markdown = `\n![${image.filename}](${image.url})\n`;
                        setFormData({ ...formData, content: formData.content + markdown });
                        setShowImagePicker(false);
                      }}
                      className="relative group cursor-pointer"
                    >
                      <img
                        src={image.thumbnail_url || image.url}
                        alt={image.filename}
                        className="w-full h-32 object-cover rounded-lg hover:opacity-80"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 font-medium">
                          Insert
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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