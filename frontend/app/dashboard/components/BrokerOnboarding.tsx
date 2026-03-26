'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, List, ChevronRight, CheckCircle, Upload, Globe,
  ArrowLeft, Loader2, LinkIcon, Layers, PenSquare, X, AlertTriangle
} from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

type Step =
  | 'welcome'
  | 'listings_choice'
  | 'import_single'
  | 'import_bulk'
  | 'brokerage_profile';

interface Props {
  userId: number;
  onComplete: () => void;
}

export default function BrokerOnboarding({ userId, onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [importUrl, setImportUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const markDone = () => {
    localStorage.setItem(`onboarding_done_${userId}`, '1');
    onComplete();
  };

  const submitImport = async (type: 'single' | 'bulk') => {
    if (!importUrl.trim()) return;
    setSubmitting(true);
    setImportError(null);
    try {
      const token = localStorage.getItem('token');
      if (type === 'single') {
        const res = await fetch(apiUrl('/scraper/dealer/import'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: importUrl.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setImportError(err.detail || 'Failed to import. Please check the URL and try again.');
          setSubmitting(false);
          return;
        }
      } else {
        await fetch(apiUrl('/broker/import-request'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: importUrl.trim(), import_type: type }),
        });
      }
      setSubmitted(true);
    } catch {
      if (type === 'bulk') setSubmitted(true);
      else setImportError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Progress bar ─────────────────────────────────────────────────────────
  const stepIndex: Record<Step, number> = {
    welcome: 0,
    brokerage_profile: 1,
    listings_choice: 2,
    import_single: 2,
    import_bulk: 2,
  };
  const totalSteps = 2;
  const progress = Math.round((stepIndex[step] / totalSteps) * 100);

  // ── WELCOME POPUP ──────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 sm:p-10">
          {/* Close / skip */}
          <button
            onClick={markDone}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            title="Skip for now"
          >
            <X size={20} />
          </button>

          {/* Logo mark */}
          <div className="flex justify-center mb-6">
            <img src="/logo/logo-icon.png" alt="" className="h-14 w-auto opacity-90 select-none" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-bold text-secondary text-center mb-5">
            Welcome to <span className="text-primary">YachtVersal</span>
          </h1>

          {/* Body text */}
          <p className="text-gray-600 leading-relaxed text-sm sm:text-base mb-3">
            Thank you for joining YachtVersal. We&apos;re excited to have your brokerage on the platform
            and appreciate the opportunity to help market your company and your yacht listings to a broader audience.
          </p>
          <p className="text-gray-600 leading-relaxed text-sm sm:text-base mb-3">
            Our goal is to make it easy for buyers to discover your brand, explore your inventory,
            and connect with you through a modern marketplace built for visibility, credibility, and growth.
          </p>
          <p className="text-gray-600 leading-relaxed text-sm sm:text-base mb-3">
            The next steps will guide you through setting up your brokerage profile and adding your listings
            so you can begin showcasing your business with confidence.
          </p>
          <p className="font-bold text-secondary mt-4 mb-6">Let&apos;s get started!</p>

          {/* CTA */}
          <button
            onClick={() => setStep('brokerage_profile')}
            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold text-sm tracking-wide rounded-xl hover:bg-primary/90 transition-colors"
          >
            Get Started <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ── FULL-SCREEN FLOW (all other steps) ────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      {/* Background watermark */}
      <div
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <img
          src="/logo/logo-icon.png"
          alt=""
          className="w-[480px] max-w-[70vw] opacity-[0.04] select-none"
        />
      </div>
      <div className="relative z-10 w-full max-w-3xl mx-auto min-h-full flex flex-col py-10 px-4">

        {/* Progress bar */}
        {step !== 'welcome' && (
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Close / skip */}
        <button
          onClick={markDone}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
          title="Skip for now"
        >
          <X size={22} />
        </button>

        {/* ── LISTINGS CHOICE ─────────────────────────────────────────── */}
        {step === 'listings_choice' && (
          <div className="p-10">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep('brokerage_profile')} className="text-gray-400 hover:text-secondary transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-secondary">Set Up Your Listings</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold text-primary uppercase tracking-widest">Step 2 of 2</span>
                  <span className="text-xs text-gray-400">· Listing Setup</span>
                </div>
              </div>
            </div>
            <hr className="my-4 border-gray-100" />

            <p className="text-sm text-primary italic mb-1">Choose how you&apos;d like to add your listings to YachtVersal.</p>
            <p className="text-sm text-gray-600 mb-6">
              Let&apos;s get your listings set up. You can choose the method that works best for you — whether you want to
              enter listings manually or import them directly from your website.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: <PenSquare size={28} className="text-secondary" />,
                  title: 'CREATE LISTING MANUALLY',
                  desc1: 'Enter your listing details manually, including photos, specifications, pricing, and descriptions.',
                  desc2: 'This option gives you full control over how each listing appears and is ideal if you are adding listings one at a time.',
                  action: () => { markDone(); router.push('/listings/create'); },
                },
                {
                  icon: <LinkIcon size={28} className="text-secondary" />,
                  title: 'IMPORT SINGLE LISTING',
                  desc1: 'Paste the link to a specific yacht listing from your website, and YachtVersal will automatically pull in the details, photos, and information for you.',
                  desc2: 'This is the fastest way to add an individual listing without entering everything manually.',
                  action: () => setStep('import_single'),
                },
                {
                  icon: <Layers size={28} className="text-secondary" />,
                  title: 'IMPORT BULK LISTINGS',
                  desc1: 'Paste the link to your listings page on your website (where multiple yachts are shown), and YachtVersal will automatically import your listings in bulk.',
                  desc2: 'This is the easiest way to add multiple listings at once.',
                  action: () => setStep('import_bulk'),
                },
              ].map((card) => (
                <div key={card.title} className="flex flex-col border-2 border-secondary/20 rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
                  <div className="p-6 flex-1">
                    <div className="flex justify-center mb-4">{card.icon}</div>
                    <h3 className="font-bold text-secondary text-center text-sm tracking-wide mb-4">{card.title}</h3>
                    <p className="text-sm text-gray-600 text-center mb-3">{card.desc1}</p>
                    <p className="text-sm text-gray-600 text-center">{card.desc2}</p>
                  </div>
                  <div className="p-4 pt-0">
                    <button
                      onClick={card.action}
                      className="w-full py-3 bg-secondary text-white font-bold text-sm tracking-widest rounded-lg hover:bg-primary transition-colors"
                    >
                      LET&apos;S GO!
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── IMPORT SINGLE ───────────────────────────────────────────── */}
        {step === 'import_single' && (
          <div className="p-10">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep('listings_choice')} className="text-gray-400 hover:text-secondary transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-secondary">Import Single Listing</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold text-primary uppercase tracking-widest">Step 2 of 2</span>
                  <span className="text-xs text-gray-400">· Single Import</span>
                </div>
              </div>
            </div>
            <hr className="my-4 border-gray-100" />

            <p className="text-sm text-primary italic mb-2">Quickly add one yacht listing from your website by pasting the listing URL below.</p>
            <p className="text-sm text-gray-600 mb-6">
              To import a single listing, paste the direct URL from <strong>your brokerage website page</strong> for the <em>specific</em> yacht listing below.
              Our system will review the page and pull in the available listing information, including key details, images, specifications, and descriptive content.
              Once your import is submitted, the listing will be processed and delivered to the <strong>Needs Approval</strong> section of your dashboard for final review.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { num: '1.', title: 'Copy & Paste the Listing URL', body: 'Copy the direct URL of the yacht listing from your brokerage website page and paste it into the field below.' },
                { num: '2.', title: 'Click Import Listing', body: <>Click <strong>Import Listing</strong> to begin. YachtVersal will automatically scan the page and extract the available listing details, images, and specifications.</> },
                { num: '3.', title: 'We Prepare Your Listing', body: 'Our system will process the page content and prepare the imported listing for review inside your dashboard.' },
                { num: '4.', title: 'Review For Approval', body: <>Check the <strong>Needs Approval</strong> section of your dashboard. Your imported listing will appear there once it is ready for review, editing, and approval.</> },
              ].map((s) => (
                <div key={s.num} className="border border-secondary/20 rounded-xl p-4">
                  <p className="text-xl font-bold text-secondary mb-2">{s.num}</p>
                  <p className="font-bold text-secondary text-sm mb-2">{s.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle size={48} className="text-primary" />
                <p className="text-lg font-bold text-secondary">Import Request Submitted!</p>
                <p className="text-sm text-gray-600 text-center max-w-sm">
                  We&apos;re processing your listing. Check the <strong>Needs Approval</strong> section of your dashboard shortly.
                </p>
                <button onClick={markDone} className="mt-4 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors">
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">Enter URL:</label>
                    <input
                      type="url"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://yourbrokerage.com/listings/yacht-name"
                      className="w-full px-4 py-3 border-2 border-secondary/30 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => submitImport('single')}
                    disabled={submitting || !importUrl.trim()}
                    className="flex items-center gap-2 px-7 py-3 bg-secondary text-white font-bold text-sm tracking-wide rounded-xl hover:bg-primary disabled:bg-gray-300 transition-colors self-end"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    IMPORT LISTING
                  </button>
                </div>
                {importError && (
                  <p className="text-sm text-red-600 flex items-center gap-1.5 mt-2">
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    {importError}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── IMPORT BULK ─────────────────────────────────────────────── */}
        {step === 'import_bulk' && (
          <div className="p-10">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep('listings_choice')} className="text-gray-400 hover:text-secondary transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-secondary">Import Bulk Listings</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold text-primary uppercase tracking-widest">Step 2 of 2</span>
                  <span className="text-xs text-gray-400">· Bulk Import</span>
                </div>
              </div>
            </div>
            <hr className="my-4 border-gray-100" />

            <p className="text-sm text-primary italic mb-2">Bring your full inventory into YachtVersal in just a few steps.</p>
            <p className="text-sm text-gray-600 mb-6">
              Bulk import is the fastest way to add multiple yacht listings to YachtVersal. Simply paste the link to your brokerage website
              listings page — <strong><em>where multiple yachts are displayed</em></strong> — and our system will automatically scan the page and import your
              available listings, including details, photos, specifications, and descriptions. Once submitted, your listings will be processed
              and sent to the <strong>Needs Approval</strong> section of your dashboard for review.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { num: '1.', title: 'Copy & Paste the Listing URL', body: <>Copy the URL on your brokerage website where <strong>multiple</strong> yacht listings are displayed, and paste it into the field below. <span className="block mt-2 text-gray-500">Tip: This should be a page that shows multiple yacht listings — not a single listing or your homepage.</span></> },
                { num: '2.', title: 'Click Import Listing', body: <>Click <strong>Import All Listings</strong> to begin. YachtVersal will automatically scan the page and extract ALL the listing details, images, and specifications.</> },
                { num: '3.', title: 'We Prepare Your Listing', body: 'Our system will process the page content and prepare the imported listings for review inside your dashboard.' },
                { num: '4.', title: 'Review For Approval', body: <>Check the <strong>Needs Approval</strong> section of your dashboard. All of your imported listings will appear there once they are ready for review, editing, and approval.</> },
              ].map((s) => (
                <div key={s.num} className="border border-secondary/20 rounded-xl p-4">
                  <p className="text-xl font-bold text-secondary mb-2">{s.num}</p>
                  <p className="font-bold text-secondary text-sm mb-2">{s.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle size={48} className="text-primary" />
                <p className="text-lg font-bold text-secondary">Bulk Import Request Submitted!</p>
                <p className="text-sm text-gray-600 text-center max-w-sm">
                  We&apos;re processing your listings. Check the <strong>Needs Approval</strong> section of your dashboard shortly.
                </p>
                <button onClick={markDone} className="mt-4 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors">
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">Enter URL:</label>
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://yourbrokerage.com/listings"
                    className="w-full px-4 py-3 border-2 border-secondary/30 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <button
                  onClick={() => submitImport('bulk')}
                  disabled={submitting || !importUrl.trim()}
                  className="flex items-center gap-2 px-7 py-3 bg-secondary text-white font-bold text-sm tracking-wide rounded-xl hover:bg-primary disabled:bg-gray-300 transition-colors self-end"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                  IMPORT ALL LISTINGS
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── BROKERAGE PROFILE ───────────────────────────────────────── */}
        {step === 'brokerage_profile' && (
          <BrokerageProfileStep onBack={markDone} onDone={() => setStep('listings_choice')} />
        )}

      </div>
    </div>
  );
}

// ── Brokerage Profile inline step ────────────────────────────────────────────
function BrokerageProfileStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    company_name: '', description: '', phone: '', email: '', website: '',
    facebook_url: '', instagram_url: '', linkedin_url: '', twitter_url: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setUploadingLogo(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(apiUrl('/media/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        const url = data?.media?.url ?? data?.url;
        if (url) setProfile(p => ({ ...p, logo_url: url } as any));
      }
    } catch {}
    finally { setUploadingLogo(false); }
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/dealer-profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.detail || 'Failed to save profile. Please try again.');
        return;
      }
      setSaved(true);
      setTimeout(onDone, 800);
    } catch {
      setSaveError('Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof profile, label: string, placeholder: string, type = 'text') => (
    <div key={key}>
      <label className="block text-xs font-semibold text-secondary mb-1">{label}</label>
      <input type={type} value={(profile as any)[key] ?? ''} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="text-gray-400 hover:text-secondary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-secondary">Brokerage Profile</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">Step 1 of 2</span>
            <span className="text-xs text-gray-400">· Company Setup</span>
          </div>
        </div>
      </div>
      <hr className="my-4 border-gray-100" />

      <p className="text-sm text-primary italic mb-1">Create your company page and showcase your brand to buyers worldwide.</p>
      <p className="text-sm text-gray-600 mb-6">
        Your brokerage profile is how buyers discover and connect with your company on YachtVersal. Complete the sections below
        to build a professional and trustworthy presence for your brokerage.
      </p>

      <div className="space-y-5">
        {/* Section 1: Company Information */}
        <div className="border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-secondary mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
            Company Information &amp; Brand
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('company_name', 'Company Name *', 'Your Brokerage Name')}
            {field('phone', 'Phone Number', '+1 (555) 000-0000')}
            {field('email', 'Email Address', 'contact@yourbrokerage.com', 'email')}
            {field('website', 'Company Website', 'https://yourbrokerage.com', 'url')}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-secondary mb-1">Company Bio / Description</label>
              <textarea
                rows={3}
                value={profile.description}
                onChange={e => setProfile(p => ({...p, description: e.target.value}))}
                placeholder="Tell buyers about your brokerage, your experience, and what makes your company unique."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">A strong profile builds trust and attracts more buyer inquiries.</p>
            </div>
          </div>

          {/* Logo upload */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-secondary mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-soft flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Upload size={24} className="text-gray-300" />
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-soft transition-colors">
                  {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, or SVG recommended</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Social Media */}
        <div className="border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-secondary mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
            Social Media
          </h3>
          <p className="text-xs text-gray-500 mb-4 ml-8">Add your social profiles to build credibility and give buyers more ways to explore your brand.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('instagram_url', 'Instagram', 'https://instagram.com/yourbrokerage', 'url')}
            {field('facebook_url', 'Facebook', 'https://facebook.com/yourbrokerage', 'url')}
            {field('linkedin_url', 'LinkedIn', 'https://linkedin.com/company/yourbrokerage', 'url')}
            {field('twitter_url', 'X / Twitter', 'https://x.com/yourbrokerage', 'url')}
          </div>
        </div>

        {/* Section 3: Team hint */}
        <div className="border border-gray-200 rounded-xl p-5 bg-soft/50">
          <h3 className="font-bold text-secondary mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">3</span>
            Team Members &amp; Access
          </h3>
          <p className="text-xs text-gray-500 ml-8">Invite other brokers from your company to connect to this brokerage profile. You can do this from the Team section in your dashboard after setup.</p>
          <p className="text-xs text-primary ml-8 mt-2 font-medium">Each team member can manage listings and be associated with your brokerage on YachtVersal.</p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-6">
        {saveError && (
          <p className="text-sm text-red-600 flex items-center gap-1.5 mb-3">
            <AlertTriangle size={14} className="flex-shrink-0" />
            {saveError}
          </p>
        )}
        <div className="flex items-center justify-between">
          <button onClick={onDone} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Skip for now
          </button>
          <button
            onClick={save}
            disabled={saving || !profile.company_name.trim()}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:bg-gray-300 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <ChevronRight size={16} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
