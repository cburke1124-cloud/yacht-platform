'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Image as ImageIcon, Upload, X, BarChart, Save, Send, Eye, History,
} from 'lucide-react';
import type { PartialBlock } from '@blocknote/core';
import { legacyTextToBlocks } from './BlogContentEditor';
import BlogRevisionsPanel from './BlogRevisionsPanel';
import ImageCropModal from '../../ImageCropModal';

// BlockNote/Prosemirror isn't SSR-safe.
const BlogContentEditor = dynamic(() => import('./BlogContentEditor'), { ssr: false });

export interface BlogFormData {
  title: string;
  excerpt: string;
  content: string;
  content_blocks: string;
  content_html: string;
  category: string;
  tags: string[];
  featured_image: string;
  featured_image_alt: string;
  status: string;
  scheduled_for: string;
  featured: boolean;
  allow_comments: boolean;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
}

interface BlogPostEditorProps {
  editingPost: any;
  formData: BlogFormData;
  setFormData: (updater: BlogFormData | ((prev: BlogFormData) => BlogFormData)) => void;
  categories: any[];
  tags: any[];
  userImages: any[];
  uploadingImage: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent, publishNow: boolean) => void;
  onBack: () => void;
  onPostRestored: () => Promise<void>;
}

export default function BlogPostEditor({
  editingPost,
  formData,
  setFormData,
  categories,
  tags,
  userImages,
  uploadingImage,
  onImageUpload,
  onSubmit,
  onBack,
  onPostRestored,
}: BlogPostEditorProps) {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  // Featured image goes through crop/rotate before it's handed to the
  // existing onImageUpload uploader (owned by the parent page).
  const [pendingFeaturedFile, setPendingFeaturedFile] = useState<File[] | null>(null);
  // Escape hatch for the first rollout cycle — writers can fall back to the
  // plain textarea if the block editor misbehaves. Defaults on whenever the
  // post already has block content (or is new); off only if explicitly chosen.
  const [useClassicEditor, setUseClassicEditor] = useState(false);

  const initialBlocks: PartialBlock[] = formData.content_blocks
    ? JSON.parse(formData.content_blocks)
    : legacyTextToBlocks(formData.content || '');

  const handleContentChange = (blocks: PartialBlock[], html: string) => {
    setFormData((prev) => ({
      ...prev,
      content_blocks: JSON.stringify(blocks),
      content_html: html,
    }));
  };

  const handleRestored = async () => {
    setShowRevisions(false);
    await onPostRestored();
  };

  // onImageUpload (owned by the parent) expects a real ChangeEvent with
  // target.files — synthesize one around the cropped/rotated File so the
  // existing upload logic doesn't need to change.
  const buildFakeFileEvent = (file: File): React.ChangeEvent<HTMLInputElement> => {
    const dt = new DataTransfer();
    dt.items.add(file);
    return { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
  };

  const handleFeaturedImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      setPendingFeaturedFile([file]);
      e.target.value = '';
    } else {
      onImageUpload(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {editingPost ? 'Edit Post' : 'Add New Post'}
        </h2>
        <div className="flex items-center gap-2">
          {editingPost?.id && (
            <button
              onClick={() => setShowRevisions(true)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <History size={16} />
              Revisions
            </button>
          )}
          {editingPost?.slug && (
            <button
              onClick={() => window.open(`/blog/${editingPost.slug}`, '_blank')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Preview
            </button>
          )}
          <button
            onClick={onBack}
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
                <div className="flex items-center gap-3">
                  {useClassicEditor && (
                    <button
                      type="button"
                      onClick={() => setShowImagePicker(true)}
                      className="text-sm text-primary hover:text-primary/90 flex items-center gap-1"
                    >
                      <ImageIcon size={16} />
                      Add Media
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setUseClassicEditor((v) => !v)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {useClassicEditor ? 'Switch to block editor' : 'Switch to classic editor'}
                  </button>
                </div>
              </div>

              {useClassicEditor ? (
                <textarea
                  placeholder="Start writing your content..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value, content_blocks: '', content_html: '' })}
                  className="w-full border border-gray-200 rounded-lg p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
                  rows={20}
                />
              ) : (
                <BlogContentEditor
                  key={`${editingPost?.id ?? 'new'}-${editingPost?.updated_at ?? ''}`}
                  initialBlocks={initialBlocks}
                  onChange={handleContentChange}
                />
              )}
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
                onClick={(e) => onSubmit(e, false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Save {formData.status === 'scheduled' ? 'Scheduled Post' : 'Draft'}
              </button>
              {formData.status !== 'scheduled' && (
                <button
                  onClick={(e) => onSubmit(e, true)}
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
                      onChange={handleFeaturedImageSelected}
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
                  {categories.map((cat) => (
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
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => setFormData({
                          ...formData,
                          tags: formData.tags.filter((t) => t !== tag),
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
                        tags: [...formData.tags, e.target.value],
                      });
                    }
                    e.target.value = '';
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Add tag...</option>
                  {tags.map((tag) => (
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
                      if (useClassicEditor) {
                        const markdown = `\n![${image.filename}](${image.url})\n`;
                        setFormData({ ...formData, content: formData.content + markdown });
                      } else {
                        setFormData({ ...formData, featured_image: image.url });
                      }
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
                        {useClassicEditor ? 'Insert' : 'Set as Featured'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showRevisions && editingPost?.id && (
        <BlogRevisionsPanel
          postId={editingPost.id}
          onClose={() => setShowRevisions(false)}
          onRestored={handleRestored}
        />
      )}

      {pendingFeaturedFile && (
        <ImageCropModal
          files={pendingFeaturedFile}
          onComplete={(edited) => {
            setPendingFeaturedFile(null);
            if (edited[0]) onImageUpload(buildFakeFileEvent(edited[0]));
          }}
          onCancel={() => setPendingFeaturedFile(null)}
        />
      )}
    </div>
  );
}
