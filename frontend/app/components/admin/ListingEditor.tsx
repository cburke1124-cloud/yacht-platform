'use client';

import { useState } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface ListingEditorProps {
  listing: any;
  onClose: () => void;
  onSave: () => void;
}

// Save this file as: frontend/app/components/admin/ListingEditor.tsx

export default function ListingEditor({ listing: initialListing, onClose, onSave }: ListingEditorProps) {
  const [listing, setListing] = useState(initialListing);
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'media'>('basic');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/listings/${listing.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: listing.title,
          make: listing.make,
          model: listing.model,
          year: listing.year,
          price: listing.price,
          length_feet: listing.length_feet,
          beam_feet: listing.beam_feet,
          draft_feet: listing.draft_feet,
          boat_type: listing.boat_type,
          hull_material: listing.hull_material,
          engine_make: listing.engine_make,
          engine_model: listing.engine_model,
          engine_type: listing.engine_type,
          engine_hours: listing.engine_hours,
          fuel_type: listing.fuel_type,
          cabins: listing.cabins,
          berths: listing.berths,
          heads: listing.heads,
          city: listing.city,
          state: listing.state,
          country: listing.country,
          description: listing.description,
          condition: listing.condition,
          status: listing.status,
          featured: listing.featured
        })
      });

      if (response.ok) {
        alert('Listing updated successfully!');
        onSave();
      } else {
        const error = await response.json();
        alert(`Failed to update: ${error.detail}`);
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update listing');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploadingImages(true);
    const token = localStorage.getItem('token');
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(e.target.files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(apiUrl('/upload'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          uploadedUrls.push(data.url);
        }
      }

      // Add images to listing
      if (uploadedUrls.length > 0) {
        const addResponse = await fetch(
          apiUrl(`/listings/${listing.id}/images`),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(uploadedUrls)
          }
        );

        if (addResponse.ok) {
          // Refresh listing data to show new images
          const updatedListing = await fetch(
            apiUrl(`/listings/${listing.id}`),
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          );
          
          if (updatedListing.ok) {
            const data = await updatedListing.json();
            setListing(data);
          }
        }
      }
    } catch (error) {
      console.error('Image upload error:', error);
      alert('Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!confirm('Delete this image?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        apiUrl(`/listings/${listing.id}/images/${imageId}`),
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        setListing({
          ...listing,
          images: listing.images.filter((img: any) => img.id !== imageId)
        });
      }
    } catch (error) {
      console.error('Delete image error:', error);
    }
  };

  const setPrimaryImage = async (imageId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        apiUrl(`/listings/${listing.id}/images/${imageId}/set-primary`),
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        setListing({
          ...listing,
          images: listing.images.map((img: any) => ({
            ...img,
            is_primary: img.id === imageId
          }))
        });
      }
    } catch (error) {
      console.error('Set primary error:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Edit Listing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-1 px-6">
            {[
              { id: 'basic', label: 'Basic Info' },
              { id: 'specs', label: 'Specifications' },
              { id: 'media', label: 'Photos & Videos' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={listing.title}
                    onChange={(e) => setListing({...listing, title: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Make *
                    </label>
                    <input
                      type="text"
                      required
                      value={listing.make || ''}
                      onChange={(e) => setListing({...listing, make: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Model *
                    </label>
                    <input
                      type="text"
                      required
                      value={listing.model || ''}
                      onChange={(e) => setListing({...listing, model: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Year *
                    </label>
                    <input
                      type="number"
                      required
                      value={listing.year || ''}
                      onChange={(e) => setListing({...listing, year: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price (USD) *
                    </label>
                    <input
                      type="number"
                      required
                      value={listing.price || ''}
                      onChange={(e) => setListing({...listing, price: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Condition
                    </label>
                    <select
                      value={listing.condition || 'used'}
                      onChange={(e) => setListing({...listing, condition: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    >
                      <option value="new">New</option>
                      <option value="used">Used</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={listing.description || ''}
                    onChange={(e) => setListing({...listing, description: e.target.value})}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={listing.city || ''}
                      onChange={(e) => setListing({...listing, city: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      value={listing.state || ''}
                      onChange={(e) => setListing({...listing, state: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={listing.country || 'USA'}
                      onChange={(e) => setListing({...listing, country: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={listing.status}
                      onChange={(e) => setListing({...listing, status: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={listing.featured || false}
                        onChange={(e) => setListing({...listing, featured: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Featured Listing</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Specifications Tab */}
            {activeTab === 'specs' && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Length (feet)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={listing.length_feet || ''}
                      onChange={(e) => setListing({...listing, length_feet: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Beam (feet)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={listing.beam_feet || ''}
                      onChange={(e) => setListing({...listing, beam_feet: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Draft (feet)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={listing.draft_feet || ''}
                      onChange={(e) => setListing({...listing, draft_feet: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Boat Type
                    </label>
                    <input
                      type="text"
                      value={listing.boat_type || ''}
                      onChange={(e) => setListing({...listing, boat_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Motor Yacht"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hull Material
                    </label>
                    <input
                      type="text"
                      value={listing.hull_material || ''}
                      onChange={(e) => setListing({...listing, hull_material: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Fiberglass"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Engine Make
                    </label>
                    <input
                      type="text"
                      value={listing.engine_make || ''}
                      onChange={(e) => setListing({...listing, engine_make: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Engine Model
                    </label>
                    <input
                      type="text"
                      value={listing.engine_model || ''}
                      onChange={(e) => setListing({...listing, engine_model: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Engine Type
                    </label>
                    <input
                      type="text"
                      value={listing.engine_type || ''}
                      onChange={(e) => setListing({...listing, engine_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Engine Hours
                    </label>
                    <input
                      type="number"
                      value={listing.engine_hours || ''}
                      onChange={(e) => setListing({...listing, engine_hours: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fuel Type
                    </label>
                    <input
                      type="text"
                      value={listing.fuel_type || ''}
                      onChange={(e) => setListing({...listing, fuel_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Diesel"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cabins
                    </label>
                    <input
                      type="number"
                      value={listing.cabins || ''}
                      onChange={(e) => setListing({...listing, cabins: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Berths
                    </label>
                    <input
                      type="number"
                      value={listing.berths || ''}
                      onChange={(e) => setListing({...listing, berths: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heads
                    </label>
                    <input
                      type="number"
                      value={listing.heads || ''}
                      onChange={(e) => setListing({...listing, heads: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Media Tab */}
            {activeTab === 'media' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Images
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={uploadingImages}
                    />
                    <label
                      htmlFor="image-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload size={48} className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {uploadingImages ? 'Uploading...' : 'Click to upload images'}
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Current Images ({listing.images?.length || 0})
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {listing.images?.map((image: any) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt="Listing"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        {image.is_primary && (
                          <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                            Primary
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          {!image.is_primary && (
                            <button
                              type="button"
                              onClick={() => setPrimaryImage(image.id)}
                              className="bg-primary text-white px-3 py-1 rounded text-xs hover:bg-primary/90"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(image.id)}
                            className="bg-red-600 text-white p-2 rounded hover:bg-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-4 p-6 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}