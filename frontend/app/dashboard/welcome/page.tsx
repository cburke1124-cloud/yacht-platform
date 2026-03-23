'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Building2, Anchor, ArrowRight } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { router.replace('/login'); return; }
        if (u.user_type === 'user') router.replace('/account');
        else if (u.user_type === 'admin') router.replace('/admin');
        else if (u.user_type === 'salesman') router.replace('/sales-rep/dashboard');
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen section-light flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl">
        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Title */}
          <div className="text-center pt-10 pb-8 px-8 border-b border-gray-100">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Welcome to{' '}
              <span className="text-secondary">Yacht</span>
              <span className="text-primary">Versal</span>
            </h1>
          </div>

          {/* Logo + copy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
            {/* Logomark */}
            <div className="flex justify-center md:justify-center">
              <Image
                src="/logo/logo-icon.png"
                alt="YachtVersal"
                width={200}
                height={200}
                className="object-contain"
                priority
              />
            </div>

            {/* Copy */}
            <div className="space-y-4 text-dark/70 text-base leading-relaxed">
              <p>
                Thank you for joining YachtVersal. We're excited to have your brokerage on the platform and appreciate the opportunity to help market your company and your yacht listings to a broader audience.
              </p>
              <p>
                Our goal is to make it easy for buyers to discover your brand, explore your inventory, and connect with you through a modern marketplace built for visibility, credibility, and growth.
              </p>
              <p>
                The next steps will guide you through setting up your brokerage profile and adding your listings so you can begin showcasing your business with confidence.
              </p>
              <p className="font-bold text-dark text-lg">Let's get started!</p>
            </div>
          </div>

          {/* CTA cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-8 md:px-12 pb-8">
            <Link
              href="/dashboard/dealer-profile"
              className="group flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-xl hover:border-primary hover:shadow-md transition-all text-center"
            >
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Building2 size={28} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-secondary tracking-widest text-xs uppercase mb-1">
                  Setup Company Profile
                </p>
                <p className="text-xs text-dark/55">
                  Add your logo, branding, and company details.
                </p>
              </div>
              <ArrowRight
                size={16}
                className="text-primary mt-auto opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </Link>

            <Link
              href="/dashboard/listings"
              className="group flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-xl hover:border-primary hover:shadow-md transition-all text-center"
            >
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Anchor size={28} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-secondary tracking-widest text-xs uppercase mb-1">
                  Setup Your Listings
                </p>
                <p className="text-xs text-dark/55">
                  Add your listings, yacht details, pricing, and photos.
                </p>
              </div>
              <ArrowRight
                size={16}
                className="text-primary mt-auto opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </Link>
          </div>

          {/* Skip */}
          <div className="text-center pb-8">
            <Link
              href="/dashboard"
              className="text-sm text-dark/45 hover:text-primary transition-colors"
            >
              Skip for now — take me to the dashboard →
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
