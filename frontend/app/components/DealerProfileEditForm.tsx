'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/apiRoot';
import { Edit2 } from 'lucide-react';
import ImageCropModal from './ImageCropModal';

interface DealerProfileEditFormProps {
  dealerId: number;
  dealerName: string;
  /** '/admin/dealers' or '/sales-rep/dealers' — same response shape from both. */
  apiBase: string;
  /** Admins can toggle Verified/Active; sales reps cannot (admin-only trust flags). */
  showTrustToggles: boolean;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Shared "Edit Broker Profile" form — extracted from AdminDealersTab.tsx so
 * both the admin panel and the sales-rep managed-account page use the exact
 * same fields/upload behavior instead of two drifting copies.
 */
export default function DealerProfileEditForm({
  dealerId,
  dealerName,
  apiBase,
  showTrustToggles,
  onSaved,
  onCancel,
}: DealerProfileEditFormProps) {
  const [profileForm, setProfileForm] = useState<Record<string, any>>({});
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState<Record<string, boolean>>({});
  // Only used for the "Edit" flow on an already-uploaded logo/banner — new
  // uploads go straight through (see handleFileSelected below).
  const [pendingCropFile, setPendingCropFile] = useState<{ key: string; file: File; mediaId: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`${apiBase}/${dealerId}/profile`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setProfileForm(data);
        }
      } catch { /* swallow */ }
      finally { if (!cancelled) setProfileLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId, apiBase]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl(`${apiBase}/${dealerId}/profile`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        onSaved();
      } else {
        const err = await res.json();
        alert(err.detail || 'Save failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleMediaUpload = async (key: string, file: File) => {
    setMediaUploading(prev => ({ ...prev, [key]: true }));
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      // Attribute the upload to the dealer whose profile this is, not the
      // caller doing the editing — otherwise it lands in the caller's own
      // personal media library instead of this dealer's.
      fd.append('as_dealer_id', String(dealerId));
      const res = await fetch(apiUrl('/media/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setProfileForm((f: Record<string, any>) => ({ ...f, [key]: data.media.url }));
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setMediaUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Logo/banner are single-file uploads — upload immediately, no forced
  // crop modal. Use the "Edit" button on an existing logo/banner to crop it.
  const handleFileSelected = (key: string, file: File) => {
    handleMediaUpload(key, file);
  };

  // Edit an already-uploaded logo/banner. profileForm only stores the plain
  // URL, so first recover the MediaFile id by matching against the org's
  // media library, then re-open the crop modal on the full-res image.
  const startEditLogoBanner = async (key: string, url: string) => {
    setMediaUploading(prev => ({ ...prev, [key]: true }));
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ limit: '200', as_dealer_id: String(dealerId) });
      const res = await fetch(apiUrl(`/media/my-media?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      let mediaId: number | null = null;
      if (res.ok) {
        const data = await res.json();
        const match = (data.media || []).find((m: any) => m.url === url);
        if (match) mediaId = match.id;
      }
      if (mediaId == null) {
        alert('Could not find this photo in the media library to edit it.');
        return;
      }
      const imgRes = await fetch(url);
      const blob = await imgRes.blob();
      const file = new File([blob], `${key}.jpg`, { type: blob.type || 'image/jpeg' });
      setPendingCropFile({ key, file, mediaId });
    } catch {
      alert('Could not load this photo for editing');
    } finally {
      setMediaUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  const finishEditLogoBanner = async (edited: File[]) => {
    if (!pendingCropFile) return;
    const { key, mediaId } = pendingCropFile;
    setPendingCropFile(null);
    if (!edited[0]) return;

    setMediaUploading(prev => ({ ...prev, [key]: true }));
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', edited[0]);
      fd.append('as_dealer_id', String(dealerId));
      const r = await fetch(apiUrl(`/media/${mediaId}/replace`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (r.ok) {
        const data = await r.json();
        setProfileForm((f: Record<string, any>) => ({ ...f, [key]: data.media.url }));
      } else {
        alert('Failed to save edited photo');
      }
    } catch {
      alert('Failed to save edited photo');
    } finally {
      setMediaUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-secondary">Edit Broker Profile</h2>
            <p className="text-xs text-dark/50 mt-0.5">{dealerName}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {profileLoading ? (
          <div className="p-12 text-center text-sm text-dark/40">Loading profile...</div>
        ) : Object.keys(profileForm).length === 0 ? (
          <div className="p-12 text-center text-sm text-dark/40">No profile found for this broker.</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Basic info */}
            <div>
              <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Business Info</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Display Name', key: 'name' },
                  { label: 'Company Name', key: 'company_name' },
                  { label: 'Email', key: 'email' },
                  { label: 'Phone', key: 'phone' },
                  { label: 'Website', key: 'website' },
                  { label: 'Primary Color', key: 'primary_color' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-dark/60 mb-1">{label}</label>
                    <input
                      type="text"
                      value={profileForm[key] ?? ''}
                      onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Location</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Address', key: 'address' },
                  { label: 'City', key: 'city' },
                  { label: 'State', key: 'state' },
                  { label: 'Country', key: 'country' },
                  { label: 'Zip Code', key: 'zip_code' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-dark/60 mb-1">{label}</label>
                    <input
                      type="text"
                      value={profileForm[key] ?? ''}
                      onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Social */}
            <div>
              <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Social / Media</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Logo and Banner — include file upload button */}
                {(['logo_url', 'banner_url'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-dark/60 mb-1">
                      {key === 'logo_url' ? 'Logo URL' : 'Banner URL'}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={profileForm[key] ?? ''}
                        onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                        className="flex-1 min-w-0 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="https://..."
                      />
                      <label
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                          mediaUploading[key]
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-secondary/10 text-secondary hover:bg-secondary/20 cursor-pointer'
                        }`}
                      >
                        {mediaUploading[key] ? '...' : '↑ Upload'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={!!mediaUploading[key]}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleFileSelected(key, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    {profileForm[key] && (
                      <div className="relative mt-1.5 inline-block">
                        <img
                          src={profileForm[key]}
                          alt=""
                          className="h-8 max-w-[120px] object-contain rounded border border-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => startEditLogoBanner(key, profileForm[key])}
                          disabled={!!mediaUploading[key]}
                          title="Edit photo"
                          className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-black/50 text-white hover:bg-[#10214F] disabled:opacity-50"
                        >
                          <Edit2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {/* Social links */}
                {[
                  { label: 'Facebook URL', key: 'facebook_url' },
                  { label: 'Instagram URL', key: 'instagram_url' },
                  { label: 'Twitter URL', key: 'twitter_url' },
                  { label: 'LinkedIn URL', key: 'linkedin_url' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-dark/60 mb-1">{label}</label>
                    <input
                      type="text"
                      value={profileForm[key] ?? ''}
                      onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Text areas */}
            <div>
              <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Content</h3>
              <div className="space-y-3">
                {[
                  { label: 'Description', key: 'description' },
                  { label: 'About Section', key: 'about_section' },
                  { label: 'Meta Title', key: 'meta_title' },
                  { label: 'Meta Description', key: 'meta_description' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-dark/60 mb-1">{label}</label>
                    <textarea
                      rows={key === 'description' || key === 'about_section' ? 3 : 2}
                      value={profileForm[key] ?? ''}
                      onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div>
              <h3 className="text-xs font-semibold text-dark/40 uppercase tracking-wider mb-3">Settings</h3>
              <div className="flex flex-wrap gap-5">
                {[
                  { label: 'Co-brokering enabled', key: 'cobrokering_enabled' },
                  { label: 'Show team on profile', key: 'show_team_on_profile' },
                  ...(showTrustToggles ? [
                    { label: 'Verified', key: 'verified' },
                    { label: 'Active', key: 'active' },
                  ] : []),
                ].map(({ label, key }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-dark/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!profileForm[key]}
                      onChange={e => setProfileForm((f: Record<string, any>) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveProfile} disabled={profileSaving} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-60">
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingCropFile && (
        <ImageCropModal
          files={[pendingCropFile.file]}
          aspect={pendingCropFile.key === 'logo_url' ? 1 : undefined}
          onComplete={finishEditLogoBanner}
          onCancel={() => setPendingCropFile(null)}
        />
      )}
    </div>
  );
}
