'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    // Welcome flow is now handled by the BrokerOnboarding modal in /dashboard
    router.replace('/dashboard');
  }, [router]);

  return null;
}
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
              {isSalesman ? (
                <>
                  <p>
                    Welcome to YachtVersal! You've been added as a team member on this brokerage account.
                  </p>
                  <p>
                    Set up your personal sales profile so buyers can find you, and explore the listings you've been assigned.
                  </p>
                  <p className="font-bold text-dark text-lg">Let's get you set up!</p>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>

          {/* CTA cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-8 md:px-12 pb-8">
            {isSalesman ? (
              <>
                <Link
                  href="/dashboard/salesman-profile"
                  className="group flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-xl hover:border-primary hover:shadow-md transition-all text-center"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <User size={28} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary tracking-widest text-xs uppercase mb-1">
                      Setup Your Profile
                    </p>
                    <p className="text-xs text-dark/55">
                      Add your photo, bio, and contact details.
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-primary mt-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </Link>

                <Link
                  href="/sales-rep/dashboard"
                  className="group flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-xl hover:border-primary hover:shadow-md transition-all text-center"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Anchor size={28} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary tracking-widest text-xs uppercase mb-1">
                      View Your Listings
                    </p>
                    <p className="text-xs text-dark/55">
                      See your assigned listings and manage inquiries.
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-primary mt-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </Link>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Skip */}
          <div className="text-center pb-8">
            <Link
              href={dashboardHref}
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
