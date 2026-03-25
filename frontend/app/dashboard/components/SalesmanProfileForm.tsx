'use client';

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  User, Upload, Mail, Phone, Save, CheckCircle,
  Briefcase, Globe, Instagram, Linkedin, Facebook
} from 'lucide-react';
import { apiUrl, mediaUrl, onImgError } from '@/app/lib/apiRoot';

export interface SalesmanProfileFormHandle {
  save: () => Promise<void>;
}

interface SalesmanProfileFormProps {
  onSaved?: () => void;
  /** When true, hides the standalone save button row (used when embedded in a
   *  parent page that provides its own save button). */
  hideHeader?: boolean;
}

const SalesmanProfileForm = forwardRef<SalesmanProfileFormHandle, SalesmanProfileFormProps>(
  function SalesmanProfileForm({ onSaved, hideHeader = false }, ref) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userType, setUserType] = useState<string>('team_member');
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    photo_url: '',
    title: '',
    bio: '',
    instagram_url: '',
    linkedin_url: '',
    facebook_url: '',
    website: '',
    public_profile: false,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/salesman-profile'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserType(data.user_type || 'team_member');
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          phone: data.phone || '',
          photo_url: data.photo_url || '',
          title: data.title || '',
          bio: data.bio || '',
          instagram_url: data.instagram_url || '',
          linkedin_url: data.linkedin_url || '',
          facebook_url: data.facebook_url || '',
          website: data.website || '',
          public_profile: data.public_profile || false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/media/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        const url = data?.media?.url ?? data?.url ?? data?.photo_url;
        if (url) setProfile(prev => ({ ...prev, photo_url: url }));
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/salesman-profile'), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        onSaved?.();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  // Expose save() so a parent page can trigger it imperatively
  useImperativeHandle(ref, () => ({ save: handleSave }));

  const isDealer = userType === 'dealer' || userType === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Standalone save row — hidden when parent provides its own save */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {isDealer
              ? 'Your personal broker profile — visible to buyers when you enable it'
              : 'Your public sales profile shown to buyers on your listings'}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 font-semibold text-sm transition-all"
          >
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* Public Profile Toggle */}
      <div
        className={`rounded-xl border-2 p-5 flex items-start gap-4 transition-colors ${
          profile.public_profile ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-secondary text-sm">
            {isDealer
              ? "Show me as an active broker on this brokerage's public page"
              : 'Show my public broker profile'}
          </p>
          <p className="text-xs text-dark/60 mt-1">
            {isDealer
              ? "When enabled, your name, photo, bio, and contact details appear in the Brokers section of your company's public profile page."
              : 'When enabled, your profile appears on the brokerage public page.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={profile.public_profile}
          onClick={() => setProfile(p => ({ ...p, public_profile: !p.public_profile }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            profile.public_profile ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              profile.public_profile ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Photo & Basic Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-base font-semibold text-secondary mb-5">Photo &amp; Name</h3>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-primary/30 bg-soft flex-shrink-0">
              {profile.photo_url ? (
                <img
                  src={mediaUrl(profile.photo_url)}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={onImgError}
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-primary/5">
                  <User className="text-primary/40" size={36} />
                </div>
              )}
              <label className="absolute inset-0 cursor-pointer flex items-end justify-center pb-2 bg-gradient-to-t from-black/30 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                <span className="text-white text-xs font-medium flex items-center gap-1">
                  <Upload size={11} /> Upload
                </span>
              </label>
            </div>
            <p className="text-xs text-dark/50">Click to change</p>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-dark/70 mb-1">First Name *</label>
                <input
                  type="text"
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark/70 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  placeholder="Smith"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark/70 mb-1">
                <span className="flex items-center gap-1"><Briefcase size={13} /> Job Title</span>
              </label>
              <input
                type="text"
                value={profile.title}
                onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                placeholder={isDealer ? 'Principal Broker' : 'Senior Sales Consultant'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-base font-semibold text-secondary mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark/70 mb-1">
              <span className="flex items-center gap-1"><Mail size={13} /> Email *</span>
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              placeholder="john@brokerage.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark/70 mb-1">
              <span className="flex items-center gap-1"><Phone size={13} /> Phone</span>
            </label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-base font-semibold text-secondary mb-3">Professional Bio</h3>
        <textarea
          value={profile.bio}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          rows={4}
          maxLength={600}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm"
          placeholder="Tell buyers about your experience, specialties, and what makes you a great yacht broker…"
        />
        <p className="text-xs text-dark/50 mt-1">{profile.bio.length}/600 characters</p>
      </div>

      {/* Social Links */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-base font-semibold text-secondary mb-4">Social Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { key: 'instagram_url', label: 'Instagram', Icon: Instagram, placeholder: 'https://instagram.com/yourprofile' },
            { key: 'linkedin_url',  label: 'LinkedIn',  Icon: Linkedin,  placeholder: 'https://linkedin.com/in/yourprofile' },
            { key: 'facebook_url',  label: 'Facebook',  Icon: Facebook,  placeholder: 'https://facebook.com/yourprofile' },
            { key: 'website',       label: 'Website',   Icon: Globe,     placeholder: 'https://yourwebsite.com' },
          ] as const).map(({ key, label, Icon, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-dark/70 mb-1">
                <span className="flex items-center gap-1"><Icon size={13} /> {label}</span>
              </label>
              <input
                type="url"
                value={profile[key]}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Footer save — only shown in standalone (non-embedded) mode */}
      {!hideHeader && (
        <div className="flex justify-end pb-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-7 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 font-semibold transition-all shadow-sm text-sm"
          >
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
});

export default SalesmanProfileForm;
