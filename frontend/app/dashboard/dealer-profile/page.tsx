'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/apiRoot';
import {
  Building2, 
  Upload, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin,
  Save,
  Eye,
  ArrowLeft
} from 'lucide-react';

export default function DealerProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    website: '',
    description: '',
    logo_url: '',
    banner_url: '',
    facebook_url: '',
    instagram_url: '',
    twitter_url: '',
    linkedin_url: '',
    slug: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch user info
      const userResponse = await fetch(apiUrl('/users/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userResponse.json();

      // Fetch dealer profile if exists
      try {
        const profileResponse = await fetch(apiUrl('/dealer-profile'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setProfile({
            company_name: profileData.company_name || userData.company_name || '',
            name: profileData.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || '',
            email: profileData.email || userData.email || '',
            phone: profileData.phone || userData.phone || '',
            address: profileData.address || '',
            city: profileData.city || '',
            state: profileData.state || '',
            zip_code: profileData.zip_code || '',
            country: profileData.country || 'USA',
            website: profileData.website || '',
            description: profileData.description || '',
            logo_url: profileData.logo_url || '',
            banner_url: profileData.banner_url || '',
            facebook_url: profileData.facebook_url || '',
            instagram_url: profileData.instagram_url || '',
            twitter_url: profileData.twitter_url || '',
            linkedin_url: profileData.linkedin_url || '',
            slug: profileData.slug || ''
          });
        } else {
          // Initialize with user data
          setProfile(prev => ({
            ...prev,
            company_name: userData.company_name || '',
            name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || '',
            email: userData.email || '',
            phone: userData.phone || ''
          }));
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (field: 'logo_url' | 'banner_url', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/media/upload'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(prev => ({ ...prev, [field]: data.url }));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/dealer-profile'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        alert('Profile saved successfully!');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-soft py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-secondary hover:text-dark mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-secondary">Edit Broker Profile</h1>
              <p className="text-gray-600 mt-1">Customize how your dealership appears to buyers</p>
            </div>
            
            <div className="flex gap-3">
              {profile.slug && (
                <button
                  onClick={() => window.open(`/dealers/${profile.slug}`, '_blank')}
                  className="flex items-center gap-2 px-4 py-2 border border-primary/20 text-secondary rounded-lg hover:bg-soft"
                >
                  <Eye size={20} />
                  Preview
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-light rounded-lg hover-primary disabled:bg-gray-400"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Banner Image */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-6 border-b border-primary/10">
              <h2 className="text-xl font-semibold text-secondary">Cover Photo</h2>
              <p className="text-sm text-gray-600">This appears at the top of your broker page</p>
            </div>
            <div className="p-6">
              <div className="relative h-64 bg-soft rounded-lg overflow-hidden border-2 border-dashed border-primary/20">
                {profile.banner_url ? (
                  <img src={profile.banner_url} alt={`${profile.company_name || 'Company'} banner`} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Upload className="mx-auto text-gray-400 mb-2" size={48} />
                      <p className="text-gray-600">Upload cover photo</p>
                    </div>
                  </div>
                )}
                <label className="absolute inset-0 cursor-pointer hover:bg-black hover:bg-opacity-10 transition-all flex items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload('banner_url', e)}
                    className="hidden"
                  />
                  <Upload className="text-white opacity-0 hover:opacity-100" size={32} />
                </label>
              </div>
            </div>
          </div>

          {/* Logo & Basic Info */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary mb-6">Company Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Logo
                </label>
                <div className="relative w-32 h-32 bg-soft rounded-lg overflow-hidden border-2 border-dashed border-primary/20">
                  {profile.logo_url ? (
                    <img src={profile.logo_url} alt={`${profile.company_name || 'Company'} logo`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Building2 className="text-gray-400" size={48} />
                    </div>
                  )}
                  <label className="absolute inset-0 cursor-pointer hover:bg-black hover:bg-opacity-10 transition-all flex items-center justify-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload('logo_url', e)}
                      className="hidden"
                    />
                    <Upload className="text-white opacity-0 hover:opacity-100" size={24} />
                  </label>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={profile.company_name}
                    onChange={(e) => setProfile({...profile, company_name: e.target.value})}
                    className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Your Company Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({...profile, name: e.target.value})}
                    className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  About Your Business
                </label>
                <textarea
                  value={profile.description}
                  onChange={(e) => setProfile({...profile, description: e.target.value})}
                  rows={4}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="Tell buyers about your dealership, your experience, and what makes you unique..."
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary mb-6">Contact Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  <div className="flex items-center gap-2">
                    <Mail size={16} />
                    Email *
                  </div>
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({...profile, email: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="contact@yourdealership.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  <div className="flex items-center gap-2">
                    <Phone size={16} />
                    Phone *
                  </div>
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-secondary mb-2">
                  <div className="flex items-center gap-2">
                    <Globe size={16} />
                    Website
                  </div>
                </label>
                <input
                  type="url"
                  value={profile.website}
                  onChange={(e) => setProfile({...profile, website: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="https://www.yourdealership.com"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary mb-6">
              <div className="flex items-center gap-2">
                <MapPin size={24} />
                Location
              </div>
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={profile.address}
                  onChange={(e) => setProfile({...profile, address: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="123 Marina Boulevard"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={profile.city}
                    onChange={(e) => setProfile({...profile, city: e.target.value})}
                    className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Miami"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    value={profile.state}
                    onChange={(e) => setProfile({...profile, state: e.target.value})}
                    className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="FL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={profile.zip_code}
                    onChange={(e) => setProfile({...profile, zip_code: e.target.value})}
                    className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="33139"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Country
                </label>
                <input
                  type="text"
                  value={profile.country}
                  onChange={(e) => setProfile({...profile, country: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="USA"
                />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary mb-6">Social Media</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  <div className="flex items-center gap-2">
                    <Facebook size={16} className="text-primary" />
                    Facebook
                  </div>
                </label>
                <input
                  type="url"
                  value={profile.facebook_url}
                  onChange={(e) => setProfile({...profile, facebook_url: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="https://facebook.com/yourdealership"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  <div className="flex items-center gap-2">
                    <Instagram size={16} className="text-accent" />
                    Instagram
                  </div>
                </label>
                <input
                  type="url"
                  value={profile.instagram_url}
                  onChange={(e) => setProfile({...profile, instagram_url: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="https://instagram.com/yourdealership"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  <div className="flex items-center gap-2">
                    <Twitter size={16} className="text-primary" />
                    Twitter
                  </div>
                </label>
                <input
                  type="url"
                  value={profile.twitter_url}
                  onChange={(e) => setProfile({...profile, twitter_url: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="https://twitter.com/yourdealership"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  <div className="flex items-center gap-2">
                    <Linkedin size={16} className="text-secondary" />
                    LinkedIn
                  </div>
                </label>
                <input
                  type="url"
                  value={profile.linkedin_url}
                  onChange={(e) => setProfile({...profile, linkedin_url: e.target.value})}
                  className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="https://linkedin.com/company/yourdealership"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 border border-primary/20 text-secondary rounded-lg hover:bg-soft"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-light rounded-lg hover-primary disabled:bg-gray-400 font-semibold"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}